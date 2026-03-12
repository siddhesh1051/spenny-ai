// Supabase Edge Function: Telegram Webhook for Spenny AI
// Handles incoming Telegram messages and converts them to expenses
//
// Required secrets (set via `supabase secrets set`):
//   TELEGRAM_BOT_TOKEN - Bot token from @BotFather

import { createClient } from "npm:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf";
import autoTable from "npm:jspdf-autotable";

// ── Types ────────────────────────────────────────────────────────────────────

interface ParsedExpense {
  amount: number;
  category: string;
  description: string;
}

interface ConversationContext {
  userId: string;
  chatId: number;
  recentExpenses?: Array<{ category: string; amount: number; description: string }>;
  monthlyTotal?: number;
  topCategory?: string;
}

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text?: string;
  voice?: {
    file_id: string;
    file_unique_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
  };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// ── Telegram API helpers ──────────────────────────────────────────────────────

async function sendTelegramMessage(
  chatId: number,
  text: string,
  token: string,
  parseMode: "Markdown" | "HTML" | undefined = "Markdown"
): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Telegram sendMessage failed:", res.status, err);
  }
}

async function sendTelegramDocument(
  chatId: number,
  fileContent: Uint8Array,
  filename: string,
  caption: string,
  token: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendDocument`;
  const formData = new FormData();
  formData.append("chat_id", chatId.toString());
  formData.append("caption", caption);
  formData.append(
    "document",
    new Blob([fileContent], { type: filename.endsWith(".csv") ? "text/csv" : "application/pdf" }),
    filename
  );

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Telegram sendDocument failed:", res.status, err);
  }
}

async function downloadTelegramFile(
  fileId: string,
  token: string
): Promise<{ data: Uint8Array; mimeType: string }> {
  // Step 1: Get file path
  const metaRes = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
  );
  if (!metaRes.ok) {
    throw new Error(`Failed to get file info: ${metaRes.status}`);
  }
  const metaData = await metaRes.json();
  const filePath = metaData.result?.file_path;
  if (!filePath) {
    throw new Error("No file_path in Telegram response");
  }

  // Step 2: Download actual file
  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${token}/${filePath}`
  );
  if (!fileRes.ok) {
    throw new Error(`Failed to download file: ${fileRes.status}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const mimeType = filePath.endsWith(".oga") || filePath.endsWith(".ogg")
    ? "audio/ogg"
    : filePath.endsWith(".mp3")
    ? "audio/mpeg"
    : "audio/ogg";

  return { data: new Uint8Array(arrayBuffer), mimeType };
}

// ── Groq helpers (shared with WhatsApp webhook) ───────────────────────────────

async function transcribeAudio(
  audioData: Uint8Array,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const extMap: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/ogg; codecs=opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/webm": "webm",
  };
  const ext = extMap[mimeType] || "ogg";

  const formData = new FormData();
  const blob = new Blob([audioData], { type: mimeType });
  formData.append("file", blob, `voice.${ext}`);
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", "en");
  formData.append("response_format", "json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq Whisper error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return typeof data?.text === "string" ? data.text : "";
}

async function classifyIntent(
  text: string,
  apiKey: string,
  context?: ConversationContext
): Promise<"expense" | "query" | "conversation" | "export" | "insights"> {
  const trimmed = text.trim().toLowerCase();

  const exportPatterns = [
    /^export(\s+my)?(\s+expenses?)?$/i,
    /^download(\s+my)?(\s+expenses?)?$/i,
    /^send(\s+me)?(\s+my)?(\s+expenses?)?$/i,
    /^(get|give)(\s+me)?(\s+my)?(\s+expenses?)(\s+(file|csv|pdf))?$/i,
    /(export|download|send)\s+(csv|pdf|expenses?|data)/i,
    /save\s+(my\s+)?expenses?/i,
  ];
  if (exportPatterns.some((p) => p.test(trimmed))) return "export";

  const conversationPatterns = [
    /^(hi|hello|hey|hiya|hey there|hola|namaste|good morning|good afternoon|good evening)[\s!?.,]*$/i,
    /^(thanks?|thank you|thx|ty|appreciated?)[\s!?.,]*$/i,
    /^(ok|okay|cool|great|nice|awesome|perfect|alright)[\s!?.,]*$/i,
    /^(bye|goodbye|see you|cya|later)[\s!?.,]*$/i,
  ];
  if (conversationPatterns.some((p) => p.test(trimmed))) return "conversation";

  const expensePatterns = [
    /spent\s+\d+/i,
    /paid\s+\d+/i,
    /bought\s+.+\s+for\s+\d+/i,
    /\d+\s+(on|for)\s+\w+/i,
    /^\d+\s+(rupees?|rs|inr|₹)/i,
  ];
  if (expensePatterns.some((p) => p.test(trimmed))) return "expense";

  const queryPatterns = [
    /(how much|total|summary|show|list|what).*(spent|spend|expenses?|cost)/i,
    /(where|what).*(money|went|spending)/i,
    /(breakdown|analysis|report).*(month|week|day|year)/i,
  ];
  if (queryPatterns.some((p) => p.test(trimmed))) return "query";

  const insightPatterns = [
    /(suggest|recommendation|advice|tip|help me|should i)/i,
    /(save|reduce|cut|lower).*(spending|expenses?|cost)/i,
    /(budget|plan|goal)/i,
    /(compare|vs|versus)/i,
  ];
  if (insightPatterns.some((p) => p.test(trimmed))) return "insights";

  const contextInfo = context
    ? `\nRecent user activity:\n- Total expenses this month: ${context.monthlyTotal ?? "unknown"}\n- Top spending category: ${context.topCategory || "unknown"}`
    : "";

  const prompt = `You are an intent classifier for an expense tracking chatbot. Classify the user's message into EXACTLY ONE category.

${contextInfo}

Categories:
1. "expense" — User is logging a new expense
2. "query" — User wants information about their expenses
3. "export" — User wants to download/export their data
4. "insights" — User wants suggestions, analysis, or advice
5. "conversation" — Greetings, questions about the bot, thanks, or general chat

User message: "${text}"

Reply with ONLY ONE WORD: expense OR query OR export OR insights OR conversation`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 10,
    }),
  });

  if (!res.ok) return "expense";

  const data = await res.json();
  const answer = (data.choices?.[0]?.message?.content || "").trim().toLowerCase();

  if (answer.includes("conversation")) return "conversation";
  if (answer.includes("export")) return "export";
  if (answer.includes("query")) return "query";
  if (answer.includes("insights")) return "insights";
  return "expense";
}

async function parseExpensesWithGroq(text: string, apiKey: string): Promise<ParsedExpense[]> {
  const prompt = `You are an AI expense parser. Extract ALL expenses from the user's message.

CRITICAL: Find EVERY expense mentioned, even multiple in one sentence.

Input: "${text}"

CATEGORIES (use ONLY these):
- Food & Dining: restaurants, cafes, snacks, dining, takeout, delivery
- Groceries: supermarket, vegetables, household items, kirana
- Travel: fuel, parking, uber, auto, bus, train, flights, hotels
- Entertainment: movies, games, hobbies, sports, concerts, events
- Utilities: electricity, water, gas, internet, phone bill
- Rent: housing rent, PG, accommodation
- Shopping: clothes, electronics, online shopping, accessories
- Education: courses, books, tuition, school fees
- Investments: mutual funds, stocks, SIP, savings
- Healthcare: doctor, pharmacy, hospital, medicine, gym
- Subscriptions: Netflix, Spotify, Prime, software subscriptions
- Other: anything else

DESCRIPTION RULES:
- Short and clean (max 50 chars)
- Main item/service name only
- Remove: "spent", "bought", "paid", "for"
- Capitalize first letter

EXAMPLES:
Input: "spent 10 on coffee and 150 for groceries"
Output: [{"amount": 10, "category": "food", "description": "Coffee"}, {"amount": 150, "category": "groceries", "description": "Groceries"}]

Input: "Netflix 199, spotify 119"
Output: [{"amount": 199, "category": "entertainment", "description": "Netflix subscription"}, {"amount": 119, "category": "entertainment", "description": "Spotify subscription"}]

Now extract from: "${text}"

Return ONLY valid JSON array (no markdown, no explanation):
[{"amount": number, "category": string, "description": string}]`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!res.ok) throw new Error(`Groq API error ${res.status}`);

  const data = await res.json();
  const responseText = data.choices?.[0]?.message?.content || "";
  const cleanedJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed: ParsedExpense[] = JSON.parse(cleanedJson);

  return parsed
    .filter(
      (e) =>
        e &&
        typeof e.amount === "number" &&
        e.amount > 0 &&
        typeof e.category === "string" &&
        ["Food & Dining", "Groceries", "Travel", "Entertainment", "Utilities", "Rent", "Shopping", "Education", "Investments", "Healthcare", "Subscriptions", "Other"].includes(e.category) &&
        typeof e.description === "string" &&
        e.description.trim().length > 0
    )
    .map((e) => ({ ...e, description: e.description.trim().slice(0, 100) }));
}

async function answerExpenseQuery(
  question: string,
  userId: string,
  apiKey: string,
  supabase: any,
  fmt: (n: number) => string
): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const currentMonth = now.toLocaleString("default", { month: "long" });
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toLocaleString("default", { month: "long" });

  const filterPrompt = `You are a SQL query builder for an expense tracking database. Extract filter parameters from the user's natural language question.

Today: ${today}
Current month: ${currentMonth}
Last month: ${lastMonth}

Available categories: Food & Dining, Groceries, Travel, Entertainment, Utilities, Rent, Shopping, Education, Investments, Healthcare, Subscriptions, Other

User question: "${question}"

Extract these fields and return ONLY valid JSON:
{
  "start_date": "YYYY-MM-DD" or null,
  "end_date": "YYYY-MM-DD" or null,
  "category": string or null,
  "min_amount": number or null,
  "max_amount": number or null,
  "sort_by": "date" | "amount",
  "sort_order": "asc" | "desc",
  "limit": number,
  "group_by": "category" | "day" | "week" | "month" | null,
  "search_description": string or null
}

Rules:
- "last month" = full previous calendar month
- "this month" = first day of current month to today
- "this week" / "last 7 days" = last 7 days
- "biggest", "highest" → sort_by=amount, sort_order=desc
- "by category" → group_by=category
- Default limit = 100

Return ONLY the JSON object.`;

  const filterRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: filterPrompt }],
      temperature: 0,
      max_tokens: 300,
    }),
  });

  let filters: any = {
    start_date: null, end_date: null, category: null,
    min_amount: null, max_amount: null, sort_by: "date",
    sort_order: "desc", limit: 100, group_by: null, search_description: null,
  };

  if (filterRes.ok) {
    const filterData = await filterRes.json();
    const raw = (filterData.choices?.[0]?.message?.content || "")
      .replace(/```json/g, "").replace(/```/g, "").trim();
    try { filters = { ...filters, ...JSON.parse(raw) }; } catch { /* keep defaults */ }
  }

  let query = supabase.from("expenses").select("amount, category, description, date").eq("user_id", userId);
  if (filters.start_date) query = query.gte("date", `${filters.start_date}T00:00:00.000Z`);
  if (filters.end_date) query = query.lte("date", `${filters.end_date}T23:59:59.999Z`);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.min_amount) query = query.gte("amount", filters.min_amount);
  if (filters.max_amount) query = query.lte("amount", filters.max_amount);
  if (filters.search_description) query = query.ilike("description", `%${filters.search_description}%`);
  query = query.order(filters.sort_by, { ascending: filters.sort_order === "asc" }).limit(Math.min(filters.limit || 100, 500));

  const { data: expenses, error } = await query;
  if (error) throw new Error(`Query failed: ${error.message}`);

  if (!expenses || expenses.length === 0) {
    return "No expenses found for that query.\n\nStart logging by sending: _Spent 50 on coffee_";
  }

  let groupedInfo = "";
  if (filters.group_by === "category") {
    const byCategory: Record<string, { total: number; count: number }> = {};
    expenses.forEach((e: any) => {
      if (!byCategory[e.category]) byCategory[e.category] = { total: 0, count: 0 };
      byCategory[e.category].total += e.amount;
      byCategory[e.category].count += 1;
    });
    groupedInfo = "\n\nGrouped by category:\n" +
      Object.entries(byCategory)
        .sort((a: any, b: any) => b[1].total - a[1].total)
        .map(([key, val]: [string, any]) => `${key}: ${fmt(val.total)} (${val.count} items)`)
        .join("\n");
  }

  const totalAmount = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
  const expenseLines = expenses.slice(0, 50).map(
    (e: any) => `${new Date(e.date).toISOString().split("T")[0]} | ${e.category} | ${e.description} | ${fmt(e.amount)}`
  );

  const answerPrompt = `You are Spenny AI, a friendly expense tracking assistant on Telegram.

Today: ${today}
Results: ${expenses.length} transactions, total ${fmt(totalAmount)}${groupedInfo}

Sample data (date | category | description | amount):
${expenseLines.join("\n")}${expenses.length > 50 ? `\n...and ${expenses.length - 50} more` : ""}

User's question: "${question}"

Instructions:
1. Answer ACCURATELY using ONLY the data provided
2. Format amounts using the same currency format as the sample data
3. Be CONCISE (keep under 1000 chars)
4. Use Telegram Markdown: *bold*, _italic_, \`code\`
5. Use • for bullet points
6. Calculate totals, averages, breakdowns as needed
7. NO markdown tables — use simple lists with emojis
8. Be friendly and conversational`;

  const answerRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: answerPrompt }],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!answerRes.ok) throw new Error(`Groq API error ${answerRes.status}`);
  const answerData = await answerRes.json();
  return answerData.choices?.[0]?.message?.content || "Sorry, I couldn't process your question.";
}

async function generateInsights(
  question: string,
  userId: string,
  apiKey: string,
  supabase: any,
  fmt: (n: number) => string
): Promise<string> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount, category, description, date")
    .eq("user_id", userId)
    .gte("date", ninetyDaysAgo.toISOString())
    .order("date", { ascending: false });

  if (!expenses || expenses.length === 0) {
    return "I need some expense data to provide insights. Start logging your expenses, and I'll help you understand your spending patterns! 📊";
  }

  const now = new Date();
  const thisMonth = expenses.filter((e: any) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = expenses.filter((e: any) => {
    const d = new Date(e.date);
    return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
  });

  const byCategory: Record<string, number> = {};
  expenses.forEach((e: any) => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
  const totalThisMonth = thisMonth.reduce((sum: number, e: any) => sum + e.amount, 0);
  const totalLastMonth = lastMonth.reduce((sum: number, e: any) => sum + e.amount, 0);
  const avgDaily = totalThisMonth / now.getDate();
  const categoryStats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, amt]) => `${cat}: ${fmt(amt as number)}`);

  const prompt = `You are Spenny AI, a financial insights assistant. Provide personalized spending advice.

User's question: "${question}"

SPENDING DATA (last 90 days):
- This month: ${thisMonth.length} expenses, ${fmt(totalThisMonth)}
- Last month: ${lastMonth.length} expenses, ${fmt(totalLastMonth)}
- Average daily spend: ${fmt(avgDaily)}
- Top categories: ${categoryStats.join(", ")}

Recent expenses:
${expenses.slice(0, 20).map((e: any) => `${new Date(e.date).toISOString().split("T")[0]} | ${e.category} | ${e.description} | ${fmt(e.amount)}`).join("\n")}

Instructions:
1. Provide ACTIONABLE insights based on the data
2. Be specific with numbers — use the same currency format as the sample data
3. Use Telegram Markdown: *bold*, _italic_
4. Use • bullets
5. Be encouraging and positive
6. Keep under 1000 characters`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 700,
    }),
  });

  if (!res.ok) throw new Error(`Insights API error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "I couldn't generate insights at this time.";
}

// ── Export helpers ────────────────────────────────────────────────────────────

function parseExportPeriod(text: string): { from: string; to: string } | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  if (/^1$|^one$/.test(t)) {
    const from = new Date(now); from.setDate(from.getDate() - 6);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/^2$|^two$/.test(t)) {
    const from = new Date(now); from.setDate(from.getDate() - 29);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/^3$|^three$/.test(t)) {
    const from = new Date(now); from.setDate(from.getDate() - 89);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/^4$|^four$/.test(t)) {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
  }
  if (/last\s*7|7\s*days?|past\s*week|this\s*week/.test(t)) {
    const from = new Date(now); from.setDate(from.getDate() - 6);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/last\s*30|30\s*days?|past\s*month/.test(t)) {
    const from = new Date(now); from.setDate(from.getDate() - 29);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/last\s*90|90\s*days?|past\s*(3|three)\s*months?/.test(t)) {
    const from = new Date(now); from.setDate(from.getDate() - 89);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/this\s*month|current\s*month/.test(t)) {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
  }
  if (/last\s*month|previous\s*month/.test(t)) {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
  }
  if (/^today$/.test(t)) return { from: today, to: today };
  return null;
}

function parseExportFormat(text: string): "csv" | "pdf" | null {
  const t = text.trim().toLowerCase();
  if (/^1$|^csv$|send csv|want csv/.test(t) || t.includes("csv")) return "csv";
  if (/^2$|^pdf$|send pdf|want pdf/.test(t) || t.includes("pdf")) return "pdf";
  return null;
}

function generateCSV(expenses: Array<{ date: string; description: string; category: string; amount: number }>, currency = "INR"): Uint8Array {
  const header = `Date,Description,Category,Amount (${currency})\n`;
  const rows = expenses.map(
    (e) => `${new Date(e.date).toISOString().split("T")[0]},"${(e.description || "").replace(/"/g, '""')}",${e.category},${e.amount.toFixed(2)}`
  );
  return new TextEncoder().encode("\uFEFF" + header + rows.join("\n"));
}

function generatePDF(
  expenses: Array<{ date: string; description: string; category: string; amount: number }>,
  dateFrom: string,
  dateTo: string,
  fmt: (n: number) => string,
  currency = "INR"
): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Expenses Export", 14, 15);
  doc.setFontSize(10);
  doc.text(`Date range: ${dateFrom} to ${dateTo}`, 14, 22);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  doc.text(`Total: ${fmt(total)} | ${expenses.length} transactions`, 14, 27);
  autoTable(doc, {
    startY: 32,
    head: [["Date", "Description", "Category", `Amount (${currency})`]],
    body: expenses.map((e) => [
      new Date(e.date).toISOString().split("T")[0],
      (e.description || "").slice(0, 40),
      e.category,
      e.amount.toFixed(2),
    ]),
  });
  const out = doc.output("arraybuffer");
  return new Uint8Array(out instanceof ArrayBuffer ? out : (out as unknown as ArrayBuffer));
}

async function doExportAndSend(
  supabase: any,
  chatId: number,
  userId: string,
  dateFrom: string,
  dateTo: string,
  formatChoice: "csv" | "pdf",
  token: string,
  fmt: (n: number) => string,
  currency: string
): Promise<void> {
  const { data: expenses, error: fetchErr } = await supabase
    .from("expenses")
    .select("date, description, category, amount")
    .eq("user_id", userId)
    .gte("date", `${dateFrom}T00:00:00.000Z`)
    .lte("date", `${dateTo}T23:59:59.999Z`)
    .order("date", { ascending: true });

  if (fetchErr || !expenses || expenses.length === 0) {
    await sendTelegramMessage(chatId, `No expenses found between ${dateFrom} and ${dateTo}. Try a different period.`, token);
    return;
  }

  const total = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);

  if (formatChoice === "csv") {
    const csvBytes = generateCSV(expenses, currency);
    const filename = `expenses_${dateFrom}_to_${dateTo}.csv`;
    await sendTelegramDocument(chatId, csvBytes, filename, `Your expenses (${dateFrom} to ${dateTo}). ${expenses.length} transactions, total ${fmt(total)}.`, token);
  } else {
    const pdfBytes = generatePDF(expenses, dateFrom, dateTo, fmt, currency);
    const filename = `expenses_${dateFrom}_to_${dateTo}.pdf`;
    await sendTelegramDocument(chatId, pdfBytes, filename, `Your expenses (${dateFrom} to ${dateTo}). ${expenses.length} transactions, total ${fmt(total)}.`, token);
  }

  await sendTelegramMessage(
    chatId,
    `✅ *Expense report sent!*\n\n📊 ${expenses.length} transactions\n💰 Total: ${fmt(total)}`,
    token
  );
}

// Export state helpers
function getExportState(supabase: any, chatId: number): Promise<any | null> {
  return supabase
    .from("telegram_export_state")
    .select("chat_id, user_id, step, date_from, date_to, format")
    .eq("chat_id", chatId)
    .maybeSingle()
    .then((r: { data: any | null }) => r.data ?? null);
}

function upsertExportState(supabase: any, chatId: number, userId: string, step: number, dateFrom: string | null, dateTo: string | null, format: string | null): Promise<void> {
  return supabase
    .from("telegram_export_state")
    .upsert({ chat_id: chatId, user_id: userId, step, date_from: dateFrom, date_to: dateTo, format }, { onConflict: "chat_id" })
    .then(() => {});
}

function clearExportState(supabase: any, chatId: number): Promise<void> {
  return supabase.from("telegram_export_state").delete().eq("chat_id", chatId).then(() => {});
}

// ── Conversation replies ──────────────────────────────────────────────────────

function getConversationReply(text: string, context?: ConversationContext): string {
  const t = text.trim().toLowerCase();

  if (/^(hi|hello|hey|hiya|hola|namaste|good morning|good afternoon|good evening)/i.test(t)) {
    const contextGreeting = context?.monthlyTotal
      ? `\n\n📊 Quick update: you've spent this month${context.topCategory ? ` (mostly on ${context.topCategory})` : ""}.`
      : "";
    return `Hi! 👋 I'm *Spenny AI* — your smart expense tracker on Telegram.${contextGreeting}\n\n*What I can do:*\n📝 Log expenses (text or voice)\n❓ Answer expense questions\n📤 Export your data\n💡 Give spending insights\n\nTry: _Spent 50 on coffee_ or _How much last month?_`;
  }

  if (/what can you do|who are you|how do you work|help me|capabilities|features/i.test(t)) {
    return `*Spenny AI — Your Expense Assistant* 🤖\n\n📝 *Log Expenses*\n• Text: _Spent 50 on coffee_\n• Multiple: _Lunch 150, auto 30_\n• Voice: 🎙 Just send a voice note!\n\n❓ *Ask Questions*\n• _How much did I spend last month?_\n• _Show my food expenses_\n• _Top spending categories_\n\n📤 *Export Data*\n• _Export last month as CSV_\n• _Download this year as PDF_\n\n💡 *Get Insights*\n• _Suggest ways to save_\n• _Compare this month vs last_\n\n⚡ *Commands:* /help • /today • /total • /export`;
  }

  if (/^(thanks?|thank you|thx|ty)/i.test(t)) {
    return "You're welcome! 😊 I'm here whenever you need to track expenses.";
  }
  if (/^(bye|goodbye|see you|cya|later)/i.test(t)) {
    return "Goodbye! 👋 Keep tracking those expenses. Message anytime!";
  }
  if (/^(ok|okay|cool|great|nice|awesome|perfect|alright)[\s!?.,]*$/i.test(t)) {
    return "👍 Anything else I can help with? Log expenses, ask questions, or type /help.";
  }

  return "I'm *Spenny AI*, your expense tracking assistant! 💰\n\nI can help you:\n• Log expenses (text or voice)\n• Answer spending questions\n• Export your data\n• Get insights\n\nTry: _Spent 100 on lunch_ or /help for all features.";
}

async function getUserContext(userId: string, chatId: number, supabase: any): Promise<ConversationContext> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: monthExpenses } = await supabase
    .from("expenses")
    .select("amount, category, description")
    .eq("user_id", userId)
    .gte("date", monthStart.toISOString())
    .limit(10);

  if (!monthExpenses || monthExpenses.length === 0) return { userId, chatId };

  const total = monthExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
  const byCategory: Record<string, number> = {};
  monthExpenses.forEach((e: any) => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0];

  return { userId, chatId, recentExpenses: monthExpenses, monthlyTotal: total, topCategory };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, service: "telegram-webhook" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TELEGRAM_BOT_TOKEN) {
    console.error("Missing required environment variables");
    return new Response("OK", { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return new Response("OK", { status: 200 });
  }

  const message = update.message;
  if (!message) return new Response("OK", { status: 200 });

  const chatId = message.chat.id;
  const telegramUserId = message.from.id;

  try {
    // ── Handle /start command (linking flow) ──
    if (message.text?.startsWith("/start")) {
      const parts = message.text.split(" ");
      const token = parts[1]?.trim();

      if (token) {
        // Verify token and link account
        const { data: linkRecord, error: linkErr } = await supabase
          .from("telegram_link_tokens")
          .select("user_id, expires_at")
          .eq("token", token)
          .eq("used", false)
          .maybeSingle();

        if (linkErr || !linkRecord) {
          await sendTelegramMessage(
            chatId,
            "❌ This link has expired or is invalid. Please go back to the Spenny AI app and try again.",
            TELEGRAM_BOT_TOKEN
          );
          return new Response("OK", { status: 200 });
        }

        if (new Date(linkRecord.expires_at) < new Date()) {
          await sendTelegramMessage(
            chatId,
            "❌ This link has expired. Please go back to the Spenny AI app and generate a new one.",
            TELEGRAM_BOT_TOKEN
          );
          return new Response("OK", { status: 200 });
        }

        // Save telegram_chat_id to profile
        await supabase
          .from("profiles")
          .update({ telegram_chat_id: chatId.toString(), updated_at: new Date().toISOString() })
          .eq("id", linkRecord.user_id);

        // Mark token as used
        await supabase
          .from("telegram_link_tokens")
          .update({ used: true })
          .eq("token", token);

        await sendTelegramMessage(
          chatId,
          `✅ *Your Telegram is linked to Spenny AI!*\n\nHi ${message.from.first_name}! You can now log expenses here.\n\nTry: _Spent 50 on coffee_ or send a voice note! 🎙\n\nType /help to see all features.`,
          TELEGRAM_BOT_TOKEN
        );
        return new Response("OK", { status: 200 });
      }

      // /start without token — generic welcome
      await sendTelegramMessage(
        chatId,
        `👋 Hi ${message.from.first_name}! I'm *Spenny AI*.\n\nTo link your account, open the Spenny AI app, go to *Settings → Telegram*, and tap *Connect Telegram*.\n\nAlready linked? Type /help to get started!`,
        TELEGRAM_BOT_TOKEN
      );
      return new Response("OK", { status: 200 });
    }

    // ── Resolve user from chat ID ──
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, groq_api_key, currency")
      .eq("telegram_chat_id", chatId.toString())
      .single();

    if (profileError || !profile) {
      await sendTelegramMessage(
        chatId,
        `Hey! Your Telegram account isn't linked to Spenny AI yet.\n\n1. Open the *Spenny AI* app\n2. Go to *Settings → Telegram*\n3. Tap *Connect Telegram*\n\nThen message me again!`,
        TELEGRAM_BOT_TOKEN
      );
      return new Response("OK", { status: 200 });
    }

    const userId = profile.id;
    const groqKey = profile.groq_api_key || GROQ_API_KEY;
    const userCurrency: string = profile.currency || "INR";
    const formatCurrency = (n: number): string => {
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency", currency: userCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0,
        }).format(n);
      } catch {
        return `${userCurrency} ${n.toFixed(0)}`;
      }
    };

    if (!groqKey) {
      await sendTelegramMessage(chatId, "No Groq API key configured. Please add one in Spenny AI Settings.", TELEGRAM_BOT_TOKEN);
      return new Response("OK", { status: 200 });
    }

    // ── Resolve message text (text or voice) ──
    let messageText = "";

    if (message.text) {
      messageText = message.text.trim();
    } else if (message.voice?.file_id) {
      try {
        const { data: audioData, mimeType } = await downloadTelegramFile(message.voice.file_id, TELEGRAM_BOT_TOKEN);
        messageText = await transcribeAudio(audioData, mimeType, groqKey);
        if (!messageText || messageText.trim().length === 0) {
          await sendTelegramMessage(chatId, "I couldn't understand the voice message. Please try again or type your expenses.", TELEGRAM_BOT_TOKEN);
          return new Response("OK", { status: 200 });
        }
        messageText = messageText.trim();
      } catch (voiceError) {
        console.error("Voice processing error:", voiceError);
        await sendTelegramMessage(chatId, "Sorry, I had trouble processing your voice message. Please try again or type your expenses.", TELEGRAM_BOT_TOKEN);
        return new Response("OK", { status: 200 });
      }
    } else {
      await sendTelegramMessage(
        chatId,
        "I can process text and voice messages. Send me your expenses like:\n\n_Spent 50 on coffee and 200 for groceries_\n\nOr just send a voice note!",
        TELEGRAM_BOT_TOKEN
      );
      return new Response("OK", { status: 200 });
    }

    if (!messageText) return new Response("OK", { status: 200 });

    // ── Built-in commands ──
    if (messageText === "/help" || messageText.toLowerCase() === "help") {
      await sendTelegramMessage(
        chatId,
        `*Spenny AI — Expense Tracker*\n\n📝 *Add expenses:*\n• _Spent 50 on coffee_\n• _Lunch 150, auto 30, movie 500_\n• 🎙 Send a voice note!\n\n❓ *Ask anything:*\n• _How much did I spend last month?_\n• _Show my food expenses this week_\n• _Top spending categories_\n\n📤 *Export:*\n• /export — Download your expenses\n\n💡 *Get Insights:*\n• _How can I save money?_\n• _Compare this month vs last_\n\n⚡ *Commands:*\n/help • /today • /total • /export`,
        TELEGRAM_BOT_TOKEN
      );
      return new Response("OK", { status: 200 });
    }

    if (messageText === "/today") {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const { data: todayExpenses } = await supabase
        .from("expenses").select("amount, category, description")
        .eq("user_id", userId).gte("date", todayStart.toISOString())
        .order("date", { ascending: false });

      if (!todayExpenses || todayExpenses.length === 0) {
        await sendTelegramMessage(chatId, "No expenses logged today yet. Send me your expenses to get started!", TELEGRAM_BOT_TOKEN);
      } else {
        const total = todayExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        const lines = todayExpenses.map((e: any) => `• ${e.description} — ${formatCurrency(e.amount)}`);
        await sendTelegramMessage(chatId, `*Today's Expenses*\n\n${lines.join("\n")}\n\n*Total: ${formatCurrency(total)}*`, TELEGRAM_BOT_TOKEN);
      }
      return new Response("OK", { status: 200 });
    }

    if (messageText === "/total") {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data: monthExpenses } = await supabase
        .from("expenses").select("amount, category")
        .eq("user_id", userId).gte("date", monthStart.toISOString());

      if (!monthExpenses || monthExpenses.length === 0) {
        await sendTelegramMessage(chatId, "No expenses this month yet!", TELEGRAM_BOT_TOKEN);
      } else {
        const total = monthExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        const byCategory: Record<string, number> = {};
        monthExpenses.forEach((e: any) => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
        const categoryEmoji: Record<string, string> = { "Food & Dining": "🍔", "Groceries": "🛒", "Travel": "✈️", "Entertainment": "🎉", "Utilities": "💡", "Rent": "🏠", "Shopping": "🛍️", "Education": "📚", "Investments": "📈", "Healthcare": "🏥", "Subscriptions": "📱", "Other": "🤷" };
        const breakdown = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => `${categoryEmoji[cat] || "•"} ${cat}: ${formatCurrency(amt)}`).join("\n");
        const monthName = now.toLocaleString("default", { month: "long" });
        await sendTelegramMessage(chatId, `*${monthName} Summary*\n\n${breakdown}\n\n*Total: ${formatCurrency(total)}*\n${monthExpenses.length} transactions`, TELEGRAM_BOT_TOKEN);
      }
      return new Response("OK", { status: 200 });
    }

    // ── Export flow ──
    const exportState = await getExportState(supabase, chatId);

    if (exportState) {
      const cancelMsg = messageText.trim().toLowerCase();
      if (cancelMsg === "cancel" || cancelMsg === "exit" || cancelMsg === "/cancel") {
        await clearExportState(supabase, chatId);
        await sendTelegramMessage(chatId, "Export cancelled. Message me anytime to export again.", TELEGRAM_BOT_TOKEN);
        return new Response("OK", { status: 200 });
      }

      if (exportState.step === 1) {
        const period = parseExportPeriod(messageText);
        if (period) {
          const prefilled = exportState.format as "csv" | "pdf" | null;
          if (prefilled) {
            await doExportAndSend(supabase, chatId, userId, period.from, period.to, prefilled, TELEGRAM_BOT_TOKEN, formatCurrency, userCurrency);
            await clearExportState(supabase, chatId);
          } else {
            await upsertExportState(supabase, chatId, userId, 2, period.from, period.to, null);
            await sendTelegramMessage(chatId, "Send as *CSV* or *PDF*?\n\nReply *1* or *csv* for CSV\nReply *2* or *pdf* for PDF\n\nOr /cancel to cancel.", TELEGRAM_BOT_TOKEN);
          }
        } else {
          await sendTelegramMessage(chatId, "I couldn't understand the period. Try:\n• *1* — Last 7 days\n• *2* — Last 30 days\n• *3* — Last 90 days\n• *4* — This month\n\nOr /cancel to cancel.", TELEGRAM_BOT_TOKEN);
        }
        return new Response("OK", { status: 200 });
      }

      if (exportState.step === 2) {
        const formatChoice = parseExportFormat(messageText);
        if (formatChoice) {
          await doExportAndSend(supabase, chatId, userId, exportState.date_from!, exportState.date_to!, formatChoice, TELEGRAM_BOT_TOKEN, formatCurrency, userCurrency);
          await clearExportState(supabase, chatId);
        } else {
          await sendTelegramMessage(chatId, "Reply *1* or *csv* for CSV, *2* or *pdf* for PDF.\n\nOr /cancel to cancel.", TELEGRAM_BOT_TOKEN);
        }
        return new Response("OK", { status: 200 });
      }
    }

    if (messageText === "/export" || messageText.toLowerCase() === "export") {
      await upsertExportState(supabase, chatId, userId, 1, null, null, null);
      await sendTelegramMessage(
        chatId,
        `📤 *Export your expenses*\n\nWhich period?\n• *1* — Last 7 days\n• *2* — Last 30 days\n• *3* — Last 90 days\n• *4* — This month\n\nOr type a range like _last month_, _this year_\n\nOr /cancel to cancel.`,
        TELEGRAM_BOT_TOKEN
      );
      return new Response("OK", { status: 200 });
    }

    // ── Classify intent ──
    const context = await getUserContext(userId, chatId, supabase);
    const intent = await classifyIntent(messageText, groqKey, context);
    console.log(`💡 Intent: ${intent} for: "${messageText}"`);

    if (intent === "conversation") {
      await sendTelegramMessage(chatId, getConversationReply(messageText, context), TELEGRAM_BOT_TOKEN);
      return new Response("OK", { status: 200 });
    }

    if (intent === "query") {
      try {
        const answer = await answerExpenseQuery(messageText, userId, groqKey, supabase, formatCurrency);
        await sendTelegramMessage(chatId, answer, TELEGRAM_BOT_TOKEN);
      } catch (err) {
        console.error("Query error:", err);
        await sendTelegramMessage(chatId, "Sorry, I had trouble answering that. Please try rephrasing.", TELEGRAM_BOT_TOKEN);
      }
      return new Response("OK", { status: 200 });
    }

    if (intent === "insights") {
      try {
        const insights = await generateInsights(messageText, userId, groqKey, supabase, formatCurrency);
        await sendTelegramMessage(chatId, insights, TELEGRAM_BOT_TOKEN);
      } catch (err) {
        console.error("Insights error:", err);
        await sendTelegramMessage(chatId, "Sorry, couldn't generate insights right now. Please try again.", TELEGRAM_BOT_TOKEN);
      }
      return new Response("OK", { status: 200 });
    }

    if (intent === "export") {
      await upsertExportState(supabase, chatId, userId, 1, null, null, null);
      await sendTelegramMessage(
        chatId,
        `📤 *Export your expenses*\n\nWhich period?\n• *1* — Last 7 days\n• *2* — Last 30 days\n• *3* — Last 90 days\n• *4* — This month\n\nOr /cancel to cancel.`,
        TELEGRAM_BOT_TOKEN
      );
      return new Response("OK", { status: 200 });
    }

    // ── Parse and save expense ──
    let expenses: ParsedExpense[];
    try {
      expenses = await parseExpensesWithGroq(messageText, groqKey);
    } catch (parseError) {
      console.error("Groq parsing error:", parseError);
      await sendTelegramMessage(chatId, `Sorry, I couldn't understand that. Try:\n_Spent 50 on coffee and 200 for groceries_`, TELEGRAM_BOT_TOKEN);
      return new Response("OK", { status: 200 });
    }

    if (expenses.length === 0) {
      await sendTelegramMessage(chatId, `I couldn't find any expenses in your message. Try:\n_Spent 50 on coffee and 200 for groceries_`, TELEGRAM_BOT_TOKEN);
      return new Response("OK", { status: 200 });
    }

    const expensesWithMeta = expenses.map((e) => ({
      ...e,
      date: new Date().toISOString(),
      user_id: userId,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("expenses")
      .insert(expensesWithMeta)
      .select();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      await sendTelegramMessage(chatId, "Something went wrong saving your expenses. Please try again.", TELEGRAM_BOT_TOKEN);
      return new Response("OK", { status: 200 });
    }

    const total = inserted.reduce((sum: number, e: any) => sum + e.amount, 0);
    const lines = inserted.map((e: any) => `✅ ${e.description} — ${formatCurrency(e.amount)}`);
    const voiceTag = message.voice ? "🎙 " : "";
    const replyText =
      inserted.length === 1
        ? `${voiceTag}${lines[0]}\n\nAdded to your expenses!`
        : `${voiceTag}*Added ${inserted.length} expenses:*\n\n${lines.join("\n")}\n\n*Total: ${formatCurrency(total)}*`;

    await sendTelegramMessage(chatId, replyText, TELEGRAM_BOT_TOKEN);
    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("OK", { status: 200 });
  }
});

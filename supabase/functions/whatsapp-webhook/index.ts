// Supabase Edge Function: WhatsApp Webhook for Spenny AI
// Handles incoming WhatsApp messages and converts them to expenses
//
// Required secrets (set via `supabase secrets set`):
//   WHATSAPP_VERIFY_TOKEN    - any string you choose, must match Meta webhook config
//   WHATSAPP_TOKEN           - Meta WhatsApp Cloud API access token
//   WHATSAPP_PHONE_NUMBER_ID - your WhatsApp Business phone number ID
//   GROQ_API_KEY             - Groq API key for expense parsing

import { createClient } from "npm:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf";
import autoTable from "npm:jspdf-autotable";

// ── Types ────────────────────────────────────────────────────────────────────

interface ParsedExpense {
  amount: number;
  category: string;
  description: string;
}

interface WhatsAppMessage {
  from: string; // sender phone in E.164 without '+'
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  audio?: { id: string; mime_type: string };
}

interface ConversationContext {
  userId: string;
  phone: string;
  recentExpenses?: Array<{ category: string; amount: number; description: string }>;
  monthlyTotal?: number;
  topCategory?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize a phone number to digits only (E.164 without +) */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}


/** Send a WhatsApp text reply */
async function sendWhatsAppReply(
  to: string,
  text: string,
  phoneNumberId: string,
  token: string
): Promise<void> {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("WhatsApp send failed:", res.status, errBody);
  } else {
    console.log("WhatsApp reply sent to", to);
  }
}

/** Send a WhatsApp document by URL (e.g. signed Storage URL) */
async function sendWhatsAppDocument(
  to: string,
  documentUrl: string,
  filename: string,
  caption: string,
  phoneNumberId: string,
  token: string
): Promise<void> {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: {
        link: documentUrl,
        caption,
        filename,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("WhatsApp document send failed:", res.status, errBody);
  } else {
    console.log("WhatsApp document sent to", to, filename);
  }
}

/** Download media from WhatsApp by media ID */
async function downloadWhatsAppMedia(
  mediaId: string,
  token: string
): Promise<{ data: Uint8Array; mimeType: string }> {
  // Step 1: Get the media URL
  const metaRes = await fetch(
    `https://graph.facebook.com/v21.0/${mediaId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!metaRes.ok) {
    const err = await metaRes.text();
    console.error("WhatsApp media meta fetch failed:", mediaId, metaRes.status, err);
    throw new Error(`Failed to get media URL: ${metaRes.status} ${err}`);
  }

  const metaData = await metaRes.json();
  console.log("WhatsApp media meta fetched:", mediaId, "mime:", metaData.mime_type);
  const mediaUrl = metaData.url;
  const mimeType = metaData.mime_type || "audio/ogg";

  // Step 2: Download the actual audio file
  const audioRes = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!audioRes.ok) {
    const err = await audioRes.text();
    throw new Error(`Failed to download audio: ${audioRes.status} ${err}`);
  }

  const arrayBuffer = await audioRes.arrayBuffer();
  return { data: new Uint8Array(arrayBuffer), mimeType };
}

/** Transcribe audio using Groq Whisper API */
async function transcribeAudio(
  audioData: Uint8Array,
  mimeType: string,
  apiKey: string
): Promise<string> {
  // Determine file extension from mime type
  const extMap: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/ogg; codecs=opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/webm": "webm",
    "audio/amr": "amr",
  };
  const ext = extMap[mimeType] || "ogg";

  // Build multipart form data
  const formData = new FormData();
  const blob = new Blob([audioData], { type: mimeType });
  formData.append("file", blob, `voice.${ext}`);
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", "en");
  formData.append("response_format", "json");

  const res = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Groq Whisper transcription failed:", res.status, err);
    throw new Error(`Groq Whisper error ${res.status}: ${err}`);
  }

  const data = await res.json();
  console.log("Groq Whisper transcription completed, length:", data?.text?.length ?? 0);
  const text = data?.text;
  return typeof text === "string" ? text : "";
}

/** IMPROVED: Classify user intent with better patterns and context awareness */
async function classifyIntent(
  text: string,
  apiKey: string,
  context?: ConversationContext
): Promise<"expense" | "query" | "conversation" | "export" | "insights"> {
  const trimmed = text.trim().toLowerCase();
  
  // Fast path: export / download requests
  const exportPatterns = [
    /^export(\s+my)?(\s+expenses?)?$/i,
    /^download(\s+my)?(\s+expenses?)?$/i,
    /^send(\s+me)?(\s+my)?(\s+expenses?)?$/i,
    /^(get|give)(\s+me)?(\s+my)?(\s+expenses?)(\s+(file|csv|pdf))?$/i,
    /(export|download|send)\s+(csv|pdf|expenses?|data)/i,
    /save\s+(my\s+)?expenses?/i,
  ];
  if (exportPatterns.some((p) => p.test(trimmed))) {
    return "export";
  }
  
  // Fast path: greetings and simple conversation
  const conversationPatterns = [
    /^(hi|hello|hey|hiya|hey there|hola|namaste|good morning|good afternoon|good evening)[\s!?.,]*$/i,
    /^(thanks?|thank you|thx|ty|appreciated?)[\s!?.,]*$/i,
    /^(ok|okay|cool|great|nice|awesome|perfect|alright)[\s!?.,]*$/i,
    /^(bye|goodbye|see you|cya|later)[\s!?.,]*$/i,
  ];
  if (conversationPatterns.some((p) => p.test(trimmed))) {
    return "conversation";
  }

  // Fast path: obvious expense entries
  const expensePatterns = [
    /spent\s+\d+/i,
    /paid\s+\d+/i,
    /bought\s+.+\s+for\s+\d+/i,
    /\d+\s+(on|for)\s+\w+/i,
    /^\d+\s+(rupees?|rs|inr|₹)/i,
  ];
  if (expensePatterns.some((p) => p.test(trimmed))) {
    return "expense";
  }

  // Fast path: obvious queries
  const queryPatterns = [
    /(how much|total|summary|show|list|what).*(spent|spend|expenses?|cost)/i,
    /(where|what).*(money|went|spending)/i,
    /(breakdown|analysis|report).*(month|week|day|year)/i,
  ];
  if (queryPatterns.some((p) => p.test(trimmed))) {
    return "query";
  }

  // Fast path: insights and suggestions
  const insightPatterns = [
    /(suggest|recommendation|advice|tip|help me|should i)/i,
    /(save|reduce|cut|lower).*(spending|expenses?|cost)/i,
    /(budget|plan|goal)/i,
    /(compare|vs|versus)/i,
  ];
  if (insightPatterns.some((p) => p.test(trimmed))) {
    return "insights";
  }

  // Use LLM for ambiguous cases
  const contextInfo = context ? `
Recent user activity:
- Total expenses this month: ${context.monthlyTotal ?? 'unknown'}
- Top spending category: ${context.topCategory || 'unknown'}
- Recent expenses: ${context.recentExpenses?.length || 0} transactions
` : '';

  const prompt = `You are an intent classifier for an expense tracking chatbot. Classify the user's message into EXACTLY ONE category.

${contextInfo}

Categories:
1. "expense" — User is logging a new expense
   Examples: "spent 50 on coffee", "lunch 200", "paid rent 15000", "bought groceries for 500"
   
2. "query" — User wants information about their expenses
   Examples: "how much did I spend last month", "show food expenses", "total spending", "what did I spend on entertainment"
   
3. "export" — User wants to download/export their data
   Examples: "export my expenses", "download csv", "send me my data", "save expenses"
   
4. "insights" — User wants suggestions, analysis, or advice
   Examples: "how can I save money", "suggest ways to reduce spending", "should I budget more for food", "compare this month vs last month"
   
5. "conversation" — Greetings, questions about the bot, thanks, or general chat
   Examples: "what can you do", "how does this work", "who made you", "tell me about yourself"

User message: "${text}"

Reply with ONLY ONE WORD: expense OR query OR export OR insights OR conversation`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 10,
    }),
  });

  if (!res.ok) {
    console.warn("Intent classification API failed:", res.status, ", defaulting to expense");
    return "expense";
  }

  const data = await res.json();
  const answer = (data.choices?.[0]?.message?.content || "")
    .trim()
    .toLowerCase();

  if (answer.includes("conversation")) return "conversation";
  if (answer.includes("export")) return "export";
  if (answer.includes("query")) return "query";
  if (answer.includes("insights")) return "insights";
  return "expense";
}

// ── Export flow: follow-up questions (period → format) ───────────────────────

const EXPORT_BUCKET = "whatsapp-exports";
const SIGNED_URL_EXPIRY_SEC = 3600; // 1 hour for WhatsApp to fetch the document

/** Create the export bucket if it does not exist (idempotent). Uses service role. */
async function ensureExportBucket(supabase: any): Promise<void> {
  const { error } = await supabase.storage.createBucket(EXPORT_BUCKET, {
    public: false,
    fileSizeLimit: "10MB",
    allowedMimeTypes: ["text/csv", "application/pdf"],
  });
  if (error) {
    const msg = (error as { message?: string }).message ?? String(error);
    if (msg.includes("already exists") || msg.includes("BucketAlreadyExists") || (error as { error?: string }).error === "BucketAlreadyExists") {
      return; // bucket exists, ok
    }
    console.error("Export bucket create failed:", error);
    throw new Error(`Bucket unavailable: ${msg}`);
  }
}

interface ExportStateRow {
  phone: string;
  user_id: string;
  step: number;
  date_from: string | null;
  date_to: string | null;
  format: string | null;
}

function getExportState(supabase: any, phone: string): Promise<ExportStateRow | null> {
  return supabase
    .from("whatsapp_export_state")
    .select("phone, user_id, step, date_from, date_to, format")
    .eq("phone", phone)
    .maybeSingle()
    .then((r: { data: ExportStateRow | null }) => r.data ?? null);
}

function upsertExportState(
  supabase: any,
  phone: string,
  userId: string,
  step: number,
  dateFrom: string | null,
  dateTo: string | null,
  format: string | null
): Promise<void> {
  return supabase
    .from("whatsapp_export_state")
    .upsert(
      { phone, user_id: userId, step, date_from: dateFrom, date_to: dateTo, format },
      { onConflict: "phone" }
    )
    .then(() => {});
}

function clearExportState(supabase: any, phone: string): Promise<void> {
  return supabase.from("whatsapp_export_state").delete().eq("phone", phone).then(() => {});
}

/** IMPROVED: Parse period choice with better natural language understanding */
function parseExportPeriod(text: string): { from: string; to: string } | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Numbered options
  if (/^1$|^one$|^option\s*1/.test(t)) {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/^2$|^two$|^option\s*2/.test(t)) {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/^3$|^three$|^option\s*3/.test(t)) {
    const from = new Date(now);
    from.setDate(from.getDate() - 89);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/^4$|^four$|^option\s*4/.test(t)) {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
  }

  // Natural language
  if (/last\s*7|7\s*days?|past\s*week|this\s*week/.test(t)) {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/last\s*30|30\s*days?|past\s*month/.test(t)) {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/last\s*90|90\s*days?|past\s*(3|three)\s*months?/.test(t)) {
    const from = new Date(now);
    from.setDate(from.getDate() - 89);
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
  if (/this\s*year|current\s*year/.test(t)) {
    const from = new Date(now.getFullYear(), 0, 1);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/^today$|^just\s*today/.test(t)) {
    return { from: today, to: today };
  }
  if (/^yesterday$/.test(t)) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const day = yesterday.toISOString().split("T")[0];
    return { from: day, to: day };
  }

  return null;
}

/** IMPROVED: Parse date ranges with better Groq prompt */
async function parseDateRangeWithGroq(
  text: string,
  apiKey: string
): Promise<{ from: string; to: string } | null> {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const currentMonth = now.toLocaleString('default', { month: 'long' });
  const currentYear = now.getFullYear();
  
  const prompt = `You are a date range parser. Extract start and end dates from the user's message.

Today's date: ${today}
Current month: ${currentMonth} ${currentYear}

Rules:
1. Accept ANY date format:
   - DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
   - "1st Jan 2026", "Jan 1", "January 15th"
   - "21/01/2026 to 31-01-2026"
   - "from Jan 1 to today"
   - "first 2 weeks of last month"
   - "last January" (January ${currentYear - 1} if we're past January, else January ${currentYear})
   - "this quarter", "last quarter"
   - Relative: "yesterday", "last week", "2 weeks ago"

2. Special periods:
   - "last month" = full previous calendar month
   - "this month" = ${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}-01 to today
   - "last week" = 7-14 days ago
   - "this week" = last 7 days to today
   - "last year" = ${currentYear - 1}-01-01 to ${currentYear - 1}-12-31

3. If only ONE date:
   - If it sounds like "from X onwards" → start_date = X, end_date = today
   - If it's just a date → start_date = end_date = that date

4. start_date must be <= end_date
5. If cannot parse, return { "start_date": null, "end_date": null }

User message: "${text}"

Return ONLY valid JSON:
{
  "start_date": "YYYY-MM-DD" or null,
  "end_date": "YYYY-MM-DD" or null
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 100,
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const raw = (data.choices?.[0]?.message?.content || "")
    .replace(/```json?/g, "")
    .replace(/```/g, "")
    .trim();
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.start_date && parsed?.end_date) {
      let from = parsed.start_date;
      let to = parsed.end_date;
      if (from > to) {
        [from, to] = [to, from];
      }
      return { from, to };
    }
  } catch {
    // ignore
  }
  return null;
}

/** IMPROVED: Extract period and format with better parsing */
async function parseExportIntentFromMessage(
  text: string,
  apiKey: string
): Promise<{ start_date: string | null; end_date: string | null; format: "csv" | "pdf" | null }> {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const currentMonth = now.toLocaleString('default', { month: 'long' });
  const currentYear = now.getFullYear();
  
  const prompt = `Extract date range and export format from the user's export request.

Today: ${today}
Current: ${currentMonth} ${currentYear}

Extract THREE things:
1. start_date: "YYYY-MM-DD" or null
2. end_date: "YYYY-MM-DD" or null  
3. format: "csv" or "pdf" or null

Date format examples:
- "export last 30 days" → last 30 days
- "send expenses 1st jan to today" → ${currentYear}-01-01 to today
- "download this month as pdf" → first day of this month to today
- "export last month" → first to last day of previous month
- "21/01/2026 to 31-01-2026" → parse both dates
- "first 2 weeks of last month" → calculate
- "this quarter" → current quarter dates
- "expenses from january" → ${currentYear}-01-01 to today

Format detection:
- "csv", "as csv", "in csv format", "send csv" → "csv"
- "pdf", "as pdf", "pdf format", "send pdf" → "pdf"
- No mention → null

Rules:
- start_date <= end_date
- Accept any date format
- If no dates mentioned → both null
- If no format mentioned → null

User message: "${text}"

Return ONLY valid JSON:
{
  "start_date": "YYYY-MM-DD" or null,
  "end_date": "YYYY-MM-DD" or null,
  "format": "csv" or "pdf" or null
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 120,
    }),
  });

  if (!res.ok) {
    return { start_date: null, end_date: null, format: null };
  }

  const data = await res.json();
  const raw = (data.choices?.[0]?.message?.content || "")
    .replace(/```json?/g, "")
    .replace(/```/g, "")
    .trim();
  try {
    const parsed = JSON.parse(raw);
    let start = parsed?.start_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.start_date) ? parsed.start_date : null;
    let end = parsed?.end_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.end_date) ? parsed.end_date : null;
    if (start && end && start > end) {
      [start, end] = [end, start];
    }
    const format = parsed?.format === "csv" || parsed?.format === "pdf" ? parsed.format : null;
    return { start_date: start, end_date: end, format };
  } catch {
    return { start_date: null, end_date: null, format: null };
  }
}

/** Parse format choice: "1"/"2", "one"/"two", "csv"/"pdf", or phrases like "send csv", "I want pdf". Returns 'csv' | 'pdf' or null. */
function parseExportFormat(text: string): "csv" | "pdf" | null {
  const t = text.trim().toLowerCase();
  if (/^1$|^one$|^csv$|send csv|want csv|choose csv|select csv/.test(t)) return "csv";
  if (/^2$|^two$|^pdf$|send pdf|want pdf|choose pdf|select pdf/.test(t)) return "pdf";
  if (t.includes("pdf")) return "pdf";
  if (t.includes("csv")) return "csv";
  return null;
}

/** Generate CSV content for expenses (UTF-8 with BOM). */
function generateExportCSV(expenses: Array<{ date: string; description: string; category: string; amount: number }>, currency = "INR"): string {
  const header = `Date,Description,Category,Amount (${currency})\n`;
  const rows = expenses.map(
    (e) =>
      `${new Date(e.date).toISOString().split("T")[0]},"${(e.description || "").replace(/"/g, '""')}",${e.category},${e.amount.toFixed(2)}`
  );
  return "\uFEFF" + header + rows.join("\n");
}

/** Generate PDF as Uint8Array for expenses (landscape, table). */
function generateExportPDF(
  expenses: Array<{ date: string; description: string; category: string; amount: number }>,
  dateFrom: string,
  dateTo: string,
  fmt: (n: number) => string = (n) => `${n}`,
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

/** Upload export file (CSV or PDF) to Storage and return a signed URL. Ensures bucket exists first. */
async function uploadExportAndGetSignedUrl(
  supabase: any,
  phone: string,
  filename: string,
  contentType: string,
  body: string | Uint8Array
): Promise<string> {
  await ensureExportBucket(supabase);
  const path = `${phone}/${Date.now()}_${filename}`;
  const { error: uploadError } = await supabase.storage.from(EXPORT_BUCKET).upload(path, body, {
    contentType,
    upsert: false,
  });
  if (uploadError) {
    console.error("Export upload failed:", uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }
  const { data: signed, error: signError } = await supabase.storage
    .from(EXPORT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SEC);
  if (signError || !signed?.signedUrl) {
    console.error("Signed URL failed:", signError);
    throw new Error("Could not create download link");
  }
  return signed.signedUrl;
}

/** Fetch expenses, generate CSV/PDF, upload, send document. */
async function doExportAndSend(
  supabase: any,
  senderPhone: string,
  userId: string,
  dateFrom: string,
  dateTo: string,
  formatChoice: "csv" | "pdf",
  phoneNumberId: string,
  token: string,
  fmt: (n: number) => string = (n) => `${n}`,
  currency = "INR"
): Promise<void> {
  const fromTs = `${dateFrom}T00:00:00.000Z`;
  const toTs = `${dateTo}T23:59:59.999Z`;

  const { data: expenses, error: fetchErr } = await supabase
    .from("expenses")
    .select("date, description, category, amount")
    .eq("user_id", userId)
    .gte("date", fromTs)
    .lte("date", toTs)
    .order("date", { ascending: true });

  if (fetchErr) {
    console.error("Export fetch error:", fetchErr);
    await sendWhatsAppReply(
      senderPhone,
      "Something went wrong fetching your expenses. Please try again.",
      phoneNumberId,
      token
    );
    return;
  }

  if (!expenses || expenses.length === 0) {
    await sendWhatsAppReply(
      senderPhone,
      `No expenses found between ${dateFrom} and ${dateTo}. Try a different period.`,
      phoneNumberId,
      token
    );
    return;
  }

  try {
    if (formatChoice === "csv") {
      const csvContent = generateExportCSV(expenses, currency);
      const filename = `expenses_${dateFrom}_to_${dateTo}.csv`;
      const signedUrl = await uploadExportAndGetSignedUrl(
        supabase,
        senderPhone,
        filename,
        "text/csv; charset=utf-8",
        new TextEncoder().encode(csvContent)
      );
      await sendWhatsAppDocument(
        senderPhone,
        signedUrl,
        filename,
        `Your expenses (${dateFrom} to ${dateTo}). ${expenses.length} transactions.`,
        phoneNumberId,
        token
      );
    } else {
      const pdfBytes = generateExportPDF(expenses, dateFrom, dateTo, fmt, currency);
      const filename = `expenses_${dateFrom}_to_${dateTo}.pdf`;
      const signedUrl = await uploadExportAndGetSignedUrl(
        supabase,
        senderPhone,
        filename,
        "application/pdf",
        pdfBytes
      );
      await sendWhatsAppDocument(
        senderPhone,
        signedUrl,
        filename,
        `Your expenses (${dateFrom} to ${dateTo}). ${expenses.length} transactions.`,
        phoneNumberId,
        token
      );
    }
    
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    await sendWhatsAppReply(
      senderPhone,
      `✅ Sent your expense report!\n\n📊 ${expenses.length} transactions\n💰 Total: ${fmt(total)}\n⏰ Link expires in 1 hour.`,
      phoneNumberId,
      token
    );
  } catch (uploadErr) {
    console.error("Export upload/send error:", uploadErr);
    await sendWhatsAppReply(
      senderPhone,
      "Could not generate or send the file. Please try again.",
      phoneNumberId,
      token
    );
  }
}

/** IMPROVED: Better conversation replies with context */
function getConversationReply(messageText: string, context?: ConversationContext): string {
  const t = messageText.trim().toLowerCase();
  
  // Greetings
  if (/^(hi|hello|hey|hiya|hola|namaste|good morning|good afternoon|good evening)/i.test(t)) {
    const contextGreeting = context?.monthlyTotal 
      ? `\n\n📊 Quick update: You've spent ${formatCurrencyUser(context.monthlyTotal)} this month${context.topCategory ? ` (mostly on ${context.topCategory})` : ''}.`
      : '';
    return `Hi! 👋 I'm Spenny AI — your smart expense tracker on WhatsApp.${contextGreeting}\n\n*What I can do:*\n📝 Log expenses (text or voice)\n❓ Answer expense questions\n📤 Export your data\n💡 Give spending insights\n\nTry: "Spent 50 on coffee" or "How much last month?"`;
  }
  
  // What can you do / who are you
  if (/what can you do|what do you do|who are you|how do you work|what are you|tell me about yourself|help me|capabilities|features/i.test(t)) {
    return `*Spenny AI - Your Expense Assistant* 🤖\n\n✨ *What I can do:*\n\n📝 *Log Expenses*\n• Text: "Spent 50 on coffee"\n• Multiple: "Lunch 150, auto 30"\n• Voice: 🎙️ Just send a voice note!\n\n❓ *Answer Questions*\n• "How much did I spend last month?"\n• "Show my food expenses"\n• "What's my biggest expense category?"\n• "Average daily spending"\n\n📤 *Export Data*\n• "Export last month as CSV"\n• "Download this year's expenses"\n• PDF or CSV format\n\n💡 *Get Insights*\n• "Suggest ways to save"\n• "Compare this month vs last"\n• Spending pattern analysis\n\n⚡ *Quick Commands:*\nType *help* • *today* • *total* • *export*`;
  }
  
  // Thanks / acknowledgment
  if (/^(thanks?|thank you|thx|ty|appreciated?)/i.test(t)) {
    return "You're welcome! 😊 I'm here whenever you need to track expenses or get spending insights.";
  }
  
  // Bye
  if (/^(bye|goodbye|see you|cya|later)/i.test(t)) {
    return "Goodbye! 👋 Keep tracking those expenses. Message anytime!";
  }
  
  // OK/Cool acknowledgment
  if (/^(ok|okay|cool|great|nice|awesome|perfect|alright)[\s!?.,]*$/i.test(t)) {
    return "👍 Anything else I can help with? Log expenses, ask questions, or type *help*.";
  }
  
  // Fallback
  return "I'm Spenny AI, your expense tracking assistant! 💰\n\nI can help you:\n• Log expenses (text or voice)\n• Answer spending questions\n• Export your data\n• Get insights\n\nTry: \"Spent 100 on lunch\" or type *help* for all features.";
}

/** IMPROVED: Extract query filters with better SQL building */
interface QueryFilters {
  start_date: string | null;
  end_date: string | null;
  category: string | null;
  min_amount: number | null;
  max_amount: number | null;
  sort_by: "date" | "amount";
  sort_order: "asc" | "desc";
  limit: number;
  group_by: "category" | "day" | "week" | "month" | null;
  search_description: string | null;
}

async function extractQueryFilters(
  question: string,
  apiKey: string
): Promise<QueryFilters> {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const currentMonth = now.toLocaleString('default', { month: 'long' });
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toLocaleString('default', { month: 'long' });
  
  const prompt = `You are a SQL query builder for an expense tracking database. Extract filter parameters from the user's natural language question.

Today: ${today}
Current month: ${currentMonth}
Last month: ${lastMonth}

Available categories: Food & Dining, Groceries, Travel, Entertainment, Utilities, Rent, Shopping, Education, Investments, Healthcare, Subscriptions, Other

User question: "${question}"

Extract these fields and return ONLY valid JSON:

{
  "start_date": "YYYY-MM-DD" or null,
  "end_date": "YYYY-MM-DD" or null,
  "category": "Food & Dining" | "Groceries" | "Travel" | "Entertainment" | "Utilities" | "Rent" | "Shopping" | "Education" | "Investments" | "Healthcare" | "Subscriptions" | "Other" | null,
  "min_amount": number or null,
  "max_amount": number or null,
  "sort_by": "date" | "amount",
  "sort_order": "asc" | "desc",
  "limit": number (1-500),
  "group_by": "category" | "day" | "week" | "month" | null,
  "search_description": string or null
}

Rules:
1. Date ranges:
   - "last month" = full previous calendar month (${lastMonth})
   - "this month" = first day of current month to today
   - "this week" = last 7 days
   - "last week" = 7-14 days ago
   - "yesterday" = yesterday only
   - "today" = today only
   - "january", "feb" etc = that specific month
   - No time range = both null (fetch all)

2. Amount filters:
   - "over 1000", "more than 500" → min_amount
   - "under 100", "less than 50" → max_amount
   - "between 100 and 500" → both

3. Category:
   - Mentioned category → set it
   - "food expenses", "travel costs" → category
   - Not mentioned → null

4. Sorting:
   - "biggest", "highest", "most expensive", "top" → sort_by=amount, sort_order=desc
   - "smallest", "lowest", "cheapest" → sort_by=amount, sort_order=asc
   - "recent", "latest", "newest" → sort_by=date, sort_order=desc
   - "oldest", "first" → sort_by=date, sort_order=asc
   - Default → sort_by=date, sort_order=desc

5. Grouping:
   - "by category", "breakdown by category" → group_by=category
   - "daily", "per day" → group_by=day
   - "weekly", "per week" → group_by=week
   - "monthly", "per month" → group_by=month
   - Not mentioned → null

6. Search:
   - "coffee expenses", "spent on uber" → search_description
   - Extract key terms from description

7. Limit:
   - "top 5", "last 10" → that number
   - "all" → 500
   - Default → 100

Examples:
- "show food expenses last month" → last month dates, category=food
- "biggest expenses this week" → last 7 days, sort_by=amount, sort_order=desc
- "how much on coffee" → search_description="coffee"
- "spending by category this month" → this month dates, group_by=category
- "expenses over 1000" → min_amount=1000

Return ONLY the JSON object.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    console.warn("Query filter extraction failed:", res.status);
    return {
      start_date: null,
      end_date: null,
      category: null,
      min_amount: null,
      max_amount: null,
      sort_by: "date",
      sort_order: "desc",
      limit: 100,
      group_by: null,
      search_description: null,
    };
  }

  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content || "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(text);
    return {
      start_date: parsed.start_date || null,
      end_date: parsed.end_date || null,
      category: parsed.category || null,
      min_amount: parsed.min_amount || null,
      max_amount: parsed.max_amount || null,
      sort_by: parsed.sort_by === "amount" ? "amount" : "date",
      sort_order: parsed.sort_order === "asc" ? "asc" : "desc",
      limit: Math.min(Math.max(parsed.limit || 100, 1), 500),
      group_by: ["category", "day", "week", "month"].includes(parsed.group_by) ? parsed.group_by : null,
      search_description: parsed.search_description || null,
    };
  } catch {
    return {
      start_date: null,
      end_date: null,
      category: null,
      min_amount: null,
      max_amount: null,
      sort_by: "date",
      sort_order: "desc",
      limit: 100,
      group_by: null,
      search_description: null,
    };
  }
}

/** IMPROVED: Answer expense queries with better SQL and response formatting */
async function answerExpenseQuery(
  question: string,
  userId: string,
  apiKey: string,
  supabase: any,
  fmt: (n: number) => string = (n) => `₹${n}`
): Promise<string> {
  const filters = await extractQueryFilters(question, apiKey);
  console.log("🔍 Query filters:", JSON.stringify(filters));

  // Build Supabase query
  let query = supabase
    .from("expenses")
    .select("amount, category, description, date")
    .eq("user_id", userId);

  if (filters.start_date) {
    query = query.gte("date", `${filters.start_date}T00:00:00.000Z`);
  }
  if (filters.end_date) {
    query = query.lte("date", `${filters.end_date}T23:59:59.999Z`);
  }
  if (filters.category) {
    query = query.eq("category", filters.category);
  }
  if (filters.min_amount) {
    query = query.gte("amount", filters.min_amount);
  }
  if (filters.max_amount) {
    query = query.lte("amount", filters.max_amount);
  }
  if (filters.search_description) {
    query = query.ilike("description", `%${filters.search_description}%`);
  }

  query = query
    .order(filters.sort_by, { ascending: filters.sort_order === "asc" })
    .limit(filters.limit);

  const { data: expenses, error } = await query;

  if (error) {
    console.error("Expense query error:", error);
    throw new Error(`Query failed: ${error.message}`);
  }

  const today = new Date().toISOString().split("T")[0];

  if (!expenses || expenses.length === 0) {
    const parts = [];
    if (filters.category) parts.push(`in ${filters.category}`);
    if (filters.start_date) parts.push(`from ${filters.start_date}`);
    if (filters.end_date) parts.push(`to ${filters.end_date}`);
    if (filters.min_amount) parts.push(`over ${formatCurrencyUser(filters.min_amount)}`);
    if (filters.max_amount) parts.push(`under ${formatCurrencyUser(filters.max_amount)}`);
    if (filters.search_description) parts.push(`matching "${filters.search_description}"`);
    
    const context = parts.length > 0 ? ` ${parts.join(", ")}` : "";
    return `No expenses found${context}.\n\nStart logging by sending: "Spent 50 on coffee"`;
  }

  // Group if requested
  let groupedData: any = null;
  if (filters.group_by === "category") {
    const byCategory: Record<string, { total: number; count: number }> = {};
    expenses.forEach((e: any) => {
      if (!byCategory[e.category]) {
        byCategory[e.category] = { total: 0, count: 0 };
      }
      byCategory[e.category].total += e.amount;
      byCategory[e.category].count += 1;
    });
    groupedData = { type: "category", data: byCategory };
  } else if (filters.group_by === "day" || filters.group_by === "week" || filters.group_by === "month") {
    const byPeriod: Record<string, { total: number; count: number }> = {};
    expenses.forEach((e: any) => {
      const date = new Date(e.date);
      let key: string;
      if (filters.group_by === "day") {
        key = date.toISOString().split("T")[0];
      } else if (filters.group_by === "week") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      if (!byPeriod[key]) {
        byPeriod[key] = { total: 0, count: 0 };
      }
      byPeriod[key].total += e.amount;
      byPeriod[key].count += 1;
    });
    groupedData = { type: filters.group_by, data: byPeriod };
  }

  const totalAmount = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);

  // Build data for Groq
  const expenseLines = expenses.slice(0, 50).map((e: any) =>
    `${new Date(e.date).toISOString().split("T")[0]} | ${e.category} | ${e.description} | ${fmt(e.amount)}`
  );

  const filterDesc = [];
  if (filters.start_date) filterDesc.push(`from ${filters.start_date}`);
  if (filters.end_date) filterDesc.push(`to ${filters.end_date}`);
  if (filters.category) filterDesc.push(`category: ${filters.category}`);
  if (filters.min_amount) filterDesc.push(`min: ${fmt(filters.min_amount)}`);
  if (filters.max_amount) filterDesc.push(`max: ${fmt(filters.max_amount)}`);
  if (filters.search_description) filterDesc.push(`search: "${filters.search_description}"`);

  const groupingInfo = groupedData 
    ? `\n\nGrouped by ${groupedData.type}:\n${Object.entries(groupedData.data)
        .sort((a: any, b: any) => b[1].total - a[1].total)
        .map(([key, val]: [string, any]) => `${key}: ${fmt(val.total)} (${val.count} items)`)
        .join("\n")}`
    : "";

  const prompt = `You are Spenny AI, a friendly and helpful expense tracking assistant on WhatsApp.

Today: ${today}

Query: ${filterDesc.length > 0 ? filterDesc.join(", ") : "all expenses"}
Results: ${expenses.length} transactions, total ${fmt(totalAmount)}${groupingInfo}

Sample data (date | category | description | amount):
${expenseLines.join("\n")}
${expenses.length > 50 ? `\n...and ${expenses.length - 50} more transactions` : ""}

User's question: "${question}"

Instructions:
1. Answer ACCURATELY using ONLY the data provided
2. Format amounts using the same currency format as the sample data above
3. Be CONCISE - this is WhatsApp (keep under 1000 chars when possible)
4. Use WhatsApp formatting: *bold* for emphasis, • for bullets
5. Calculate totals, averages, breakdowns, comparisons as needed
6. If grouped data exists, present it clearly
7. Be friendly and conversational
8. NO markdown tables - use simple lists with emojis
9. If data is limited, acknowledge it
10. Provide actionable insights when relevant

Focus on being helpful and clear, not just listing data.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq API error ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Sorry, I couldn't process your question.";
}

/** IMPROVED: Parse expenses with better prompt and validation */
async function parseExpensesWithGroq(
  text: string,
  apiKey: string
): Promise<ParsedExpense[]> {
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
Output: [
  {"amount": 10, "category": "food", "description": "Coffee"},
  {"amount": 150, "category": "groceries", "description": "Groceries"}
]

Input: "bought lunch for 25, paid 50 for gas, and spent 15 on parking"
Output: [
  {"amount": 25, "category": "food", "description": "Lunch"},
  {"amount": 50, "category": "travel", "description": "Gas"},
  {"amount": 15, "category": "travel", "description": "Parking"}
]

Input: "Netflix 199, spotify 119"
Output: [
  {"amount": 199, "category": "entertainment", "description": "Netflix subscription"},
  {"amount": 119, "category": "entertainment", "description": "Spotify subscription"}
]

Input: "dinner 500"
Output: [
  {"amount": 500, "category": "food", "description": "Dinner"}
]

Now extract from: "${text}"

Return ONLY valid JSON array (no markdown, no explanation):
[
  {"amount": number, "category": string, "description": string}
]`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("Groq parsing failed:", res.status, errBody);
    throw new Error(`Groq API error ${res.status}`);
  }

  const data = await res.json();
  const responseText = data.choices?.[0]?.message?.content || "";
  
  const cleanedJson = responseText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const parsed: ParsedExpense[] = JSON.parse(cleanedJson);

  // Validate and clean
  return parsed
    .filter(e =>
      e &&
      typeof e.amount === "number" &&
      e.amount > 0 &&
      typeof e.category === "string" &&
      ["Food & Dining", "Groceries", "Travel", "Entertainment", "Utilities", "Rent", "Shopping", "Education", "Investments", "Healthcare", "Subscriptions", "Other"].includes(e.category) &&
      typeof e.description === "string" &&
      e.description.trim().length > 0
    )
    .map(e => ({
      ...e,
      description: e.description.trim().slice(0, 100),
    }));
}

/** NEW: Generate spending insights and suggestions */
async function generateInsights(
  question: string,
  userId: string,
  apiKey: string,
  supabase: any,
  fmt: (n: number) => string = (n) => `₹${n}`
): Promise<string> {
  // Fetch recent spending data (last 90 days)
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

  // Calculate statistics
  const now = new Date();
  const thisMonth = expenses.filter((e: any) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  
  const lastMonth = expenses.filter((e: any) => {
    const d = new Date(e.date);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
  });

  const byCategory: Record<string, number> = {};
  expenses.forEach((e: any) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });

  const totalThisMonth = thisMonth.reduce((sum: number, e: any) => sum + e.amount, 0);
  const totalLastMonth = lastMonth.reduce((sum: number, e: any) => sum + e.amount, 0);
  const avgDaily = totalThisMonth / now.getDate();

  const categoryStats = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amt]) => `${cat}: ${fmt(amt as number)}`);

  const prompt = `You are Spenny AI, a financial insights assistant. Provide personalized spending advice.

User's question: "${question}"

SPENDING DATA (last 90 days):
- This month: ${thisMonth.length} expenses, ${fmt(totalThisMonth)}
- Last month: ${lastMonth.length} expenses, ${fmt(totalLastMonth)}
- Average daily spend: ${fmt(avgDaily)}
- Top categories: ${categoryStats.join(", ")}

Recent expenses (sample):
${expenses.slice(0, 20).map((e: any) => 
  `${new Date(e.date).toISOString().split("T")[0]} | ${e.category} | ${e.description} | ${fmt(e.amount)}`
).join("\n")}

Instructions:
1. Provide ACTIONABLE insights based on the data
2. Be specific with numbers and comparisons — use the same currency format as the sample data
3. Suggest realistic ways to save money
4. Use WhatsApp formatting: *bold*, • bullets
5. Be encouraging and positive
6. Keep under 1000 characters
7. Focus on what the user asked about

Provide helpful, specific advice now.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    throw new Error(`Insights API error ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "I couldn't generate insights at this time.";
}

/** Get user context for better responses */
async function getUserContext(userId: string, supabase: any): Promise<ConversationContext> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: monthExpenses } = await supabase
    .from("expenses")
    .select("amount, category, description")
    .eq("user_id", userId)
    .gte("date", monthStart.toISOString())
    .limit(10);

  if (!monthExpenses || monthExpenses.length === 0) {
    return { userId, phone: "" };
  }

  const total = monthExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
  
  const byCategory: Record<string, number> = {};
  monthExpenses.forEach((e: any) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });
  
  const topCategory = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    userId,
    phone: "",
    recentExpenses: monthExpenses,
    monthlyTotal: total,
    topCategory,
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  console.log("[webhook] Incoming", req.method, req.url);

  // ── Env vars (Supabase injects SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY when deployed) ──
  const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
  const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
  const WHATSAPP_PHONE_NUMBER_ID =
    Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // ── GET: Health check (no params) or webhook verification (Meta sends hub.* on setup) ──
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // Health check: GET with no hub params → 200 OK (so you can test the function URL)
    if (!mode && !token && !challenge) {
      console.log("[webhook] Health check");
      return new Response(JSON.stringify({ ok: true, service: "whatsapp-webhook" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!WHATSAPP_VERIFY_TOKEN) {
      console.error("WHATSAPP_VERIFY_TOKEN secret is not set");
      return new Response(
        JSON.stringify({ error: "Webhook not configured: missing verify token" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      if (challenge == null || challenge === "") {
        console.error("Meta did not send hub.challenge");
        return new Response("Missing hub.challenge", { status: 400 });
      }
      console.log("Webhook verified successfully");
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    console.warn("Webhook verification failed: mode=%s token match=%s", mode, !!token);
    return new Response("Forbidden", { status: 403 });
  }

  // ── POST: Incoming message ──
  if (req.method === "POST") {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
      return new Response("OK", { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let body: unknown;
    try {
      body = await req.json();
    } catch (e) {
      console.error("Invalid webhook body (not JSON):", e);
      return new Response("OK", { status: 200 });
    }

    try {
      if (body == null || typeof body !== "object") {
        return new Response("OK", { status: 200 });
      }

      // Meta sends various webhook events; we only care about messages
      const b = body as { entry?: Array<{ changes?: Array<{ value?: { messages?: unknown[] } }> }> };
      const entry = b.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // Ignore status updates (sent, delivered, read)
      if (!value?.messages || value.messages.length === 0) {
        console.log("[webhook] POST: no messages in payload (status update or empty)");
        return new Response("OK", { status: 200 });
      }

      const message = value.messages[0] as WhatsAppMessage;
      const senderPhone = normalizePhone(message.from);
      console.log("[webhook] Message from", senderPhone, "type:", message.type);

      // Only handle text and audio messages
      if (message.type !== "text" && message.type !== "audio") {
        console.log("[webhook] Unsupported message type:", message.type);
        await sendWhatsAppReply(
          senderPhone,
          "Hey! I can process text and voice messages. Send me your expenses like:\n\n\"Spent 50 on coffee and 200 for groceries\"\n\nOr just send a voice note!",
          WHATSAPP_PHONE_NUMBER_ID,
          WHATSAPP_TOKEN
        );
        return new Response("OK", { status: 200 });
      }

      // ── Resolve message text (from text or voice transcription) ──
      let messageText = "";

      if (message.type === "text" && message.text?.body) {
        messageText = message.text.body.trim();
      } else if (message.type === "audio" && message.audio?.id) {
        // We need the user's Groq key for transcription, so look up profile first
        const { data: audioProfile } = await supabase
          .from("profiles")
          .select("id, groq_api_key")
          .eq("whatsapp_phone", senderPhone)
          .single();

        if (!audioProfile) {
          console.log("[webhook] Audio from unlinked number:", senderPhone);
          await sendWhatsAppReply(
            senderPhone,
            `Hey! Your WhatsApp number isn't linked to a Spenny AI account yet.\n\nTo link it:\n1. Open Spenny AI app\n2. Go to Settings\n3. Enter your WhatsApp number: +${senderPhone}\n4. Save\n\nThen message me again!`,
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
          return new Response("OK", { status: 200 });
        }

        const audioGroqKey = audioProfile.groq_api_key || GROQ_API_KEY;
        if (!audioGroqKey) {
          await sendWhatsAppReply(
            senderPhone,
            "No API key configured for voice transcription. Please add a Groq API key in Spenny AI Settings.",
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
          return new Response("OK", { status: 200 });
        }

        try {
          // Download audio from WhatsApp
          const { data: audioData, mimeType } = await downloadWhatsAppMedia(
            message.audio.id,
            WHATSAPP_TOKEN
          );

          // Transcribe with Groq Whisper
          messageText = await transcribeAudio(audioData, mimeType, audioGroqKey);
          console.log("🎙️ Voice transcription:", messageText);

          if (!messageText || messageText.trim().length === 0) {
            await sendWhatsAppReply(
              senderPhone,
              "I couldn't understand the voice message. Please try again or type your expenses.",
              WHATSAPP_PHONE_NUMBER_ID,
              WHATSAPP_TOKEN
            );
            return new Response("OK", { status: 200 });
          }

          messageText = messageText.trim();
        } catch (voiceError) {
          console.error("Voice processing error:", voiceError);
          await sendWhatsAppReply(
            senderPhone,
            "Sorry, I had trouble processing your voice message. Please try again or type your expenses.",
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
          return new Response("OK", { status: 200 });
        }
      }

      if (!messageText) {
        console.log("[webhook] Empty message text, skipping");
        return new Response("OK", { status: 200 });
      }

      console.log("[webhook] Processing message:", messageText.substring(0, 80) + (messageText.length > 80 ? "..." : ""));

      // ── Handle special commands ──

      // HELP command
      if (messageText.toLowerCase() === "help") {
        await sendWhatsAppReply(
          senderPhone,
          `*Spenny AI - Expense Tracker*\n\n📝 *Add expenses:*\n• "Spent 50 on coffee"\n• "Lunch 150, auto 30, movie 500"\n• 🎙️ Send a voice note!\n\n❓ *Ask anything:*\n• "How much did I spend last month?"\n• "Show my food expenses this week"\n• "Top spending categories"\n\n📤 *Export:*\n• *export* - Download your expenses (CSV/PDF)\n\n💡 *Get Insights:*\n• "How can I save money?"\n• "Compare this month vs last"\n\n⚡ *Quick commands:*\n• *help* - This message\n• *today* - Today's expenses\n• *total* - This month's summary\n• *export* - Download expenses`,
          WHATSAPP_PHONE_NUMBER_ID,
          WHATSAPP_TOKEN
        );
        return new Response("OK", { status: 200 });
      }

      // ── Look up user by phone number ──
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, groq_api_key, currency")
        .eq("whatsapp_phone", senderPhone)
        .single();

      if (profileError || !profile) {
        console.log("[webhook] Profile not found for phone:", senderPhone, profileError?.message ?? "");
        await sendWhatsAppReply(
          senderPhone,
          `Hey! Your WhatsApp number isn't linked to a Spenny AI account yet.\n\nTo link it:\n1. Open Spenny AI app\n2. Go to Settings\n3. Enter your WhatsApp number: +${senderPhone}\n4. Save\n\nThen message me again!`,
          WHATSAPP_PHONE_NUMBER_ID,
          WHATSAPP_TOKEN
        );
        return new Response("OK", { status: 200 });
      }

      const userId = profile.id;
      // Use user's own Groq key if available, else fallback to server key
      const groqKey = profile.groq_api_key || GROQ_API_KEY;
      const userCurrency: string = profile.currency || "INR";
      const formatCurrencyUser = (n: number): string => {
        try {
          return new Intl.NumberFormat(undefined, {
            style: "currency", currency: userCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0,
          }).format(n);
        } catch {
          return `${userCurrency} ${n.toFixed(0)}`;
        }
      };

      if (!groqKey) {
        await sendWhatsAppReply(
          senderPhone,
          "No Groq API key configured. Please add one in Spenny AI Settings or contact support.",
          WHATSAPP_PHONE_NUMBER_ID,
          WHATSAPP_TOKEN
        );
        return new Response("OK", { status: 200 });
      }

      // Get user context for better responses
      const context = await getUserContext(userId, supabase);
      context.phone = senderPhone;

      // ── Export flow: follow-up questions (period → format) ──
      let intent: "expense" | "query" | "conversation" | "export" | "insights" | null = null;
      const exportState = await getExportState(supabase, senderPhone);
      if (exportState) {
        const cancelMsg = messageText.trim().toLowerCase();
        if (cancelMsg === "cancel" || cancelMsg === "exit" || cancelMsg === "stop") {
          await clearExportState(supabase, senderPhone);
          await sendWhatsAppReply(
            senderPhone,
            "Export cancelled. Message me anytime to export again.",
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
          return new Response("OK", { status: 200 });
        }

        if (exportState.step === 1) {
          let period: { from: string; to: string } | null = parseExportPeriod(messageText);
          if (!period) {
            period = await parseDateRangeWithGroq(messageText, groqKey);
          }
          if (period) {
            const formatPrefilled = exportState.format as "csv" | "pdf" | null;
            if (formatPrefilled) {
              await doExportAndSend(
                supabase,
                senderPhone,
                userId,
                period.from,
                period.to,
                formatPrefilled,
                WHATSAPP_PHONE_NUMBER_ID,
                WHATSAPP_TOKEN,
                formatCurrencyUser,
                userCurrency
              );
              await clearExportState(supabase, senderPhone);
            } else {
              await upsertExportState(
                supabase,
                senderPhone,
                userId,
                2,
                period.from,
                period.to,
                null
              );
              await sendWhatsAppReply(
                senderPhone,
                "Send as *CSV* or *PDF*?\n\nReply *1* or *csv* for CSV\nReply *2* or *pdf* for PDF\n\nOr say *cancel* to cancel.",
                WHATSAPP_PHONE_NUMBER_ID,
                WHATSAPP_TOKEN
              );
            }
          } else {
            await sendWhatsAppReply(
              senderPhone,
              "I couldn't understand the period. Try:\n• *1* — Last 7 days, *2* — Last 30 days, *3* — Last 90 days, *4* — This month\n• Or say a range: \"1st Jan to today\", \"21/01/2026 to 31/01/2026\", \"first 2 weeks of last month\"\n\nOr say *cancel* to cancel.",
              WHATSAPP_PHONE_NUMBER_ID,
              WHATSAPP_TOKEN
            );
          }
          return new Response("OK", { status: 200 });
        }

        if (exportState.step === 2) {
          const formatChoice = parseExportFormat(messageText);
          if (formatChoice) {
            await doExportAndSend(
              supabase,
              senderPhone,
              userId,
              exportState.date_from!,
              exportState.date_to!,
              formatChoice,
              WHATSAPP_PHONE_NUMBER_ID,
              WHATSAPP_TOKEN,
              formatCurrencyUser,
              userCurrency
            );
            await clearExportState(supabase, senderPhone);
          } else {
            await sendWhatsAppReply(
              senderPhone,
              "Reply *1* or *csv* for CSV, *2* or *pdf* for PDF.\n\nOr say *cancel* to cancel.",
              WHATSAPP_PHONE_NUMBER_ID,
              WHATSAPP_TOKEN
            );
          }
          return new Response("OK", { status: 200 });
        }
      }

      // ── New export request (no state): parse message for period/format, or start flow ──
      if (messageText.trim().toLowerCase() === "export") {
        intent = "export";
      } else {
        intent = await classifyIntent(messageText, groqKey, context);
      }
      
      if (intent === "export") {
        const parsed = await parseExportIntentFromMessage(messageText, groqKey);
        const hasPeriod = parsed.start_date && parsed.end_date;
        const hasFormat = parsed.format !== null;

        if (hasPeriod && hasFormat) {
          await doExportAndSend(
            supabase,
            senderPhone,
            userId,
            parsed.start_date!,
            parsed.end_date!,
            parsed.format!,
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN,
            formatCurrencyUser,
            userCurrency
          );
          return new Response("OK", { status: 200 });
        }

        if (hasPeriod) {
          await upsertExportState(
            supabase,
            senderPhone,
            userId,
            2,
            parsed.start_date!,
            parsed.end_date!,
            null
          );
          await sendWhatsAppReply(
            senderPhone,
            "Send as *CSV* or *PDF*?\n\nReply *1* or *csv* for CSV\nReply *2* or *pdf* for PDF\n\nOr say *cancel* to cancel.",
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
          return new Response("OK", { status: 200 });
        }

        if (hasFormat) {
          await upsertExportState(supabase, senderPhone, userId, 1, null, null, parsed.format);
          await sendWhatsAppReply(
            senderPhone,
            "📤 *Which period?* Say anything, for example:\n• *1* — Last 7 days, *2* — Last 30 days, *3* — Last 90 days, *4* — This month\n• \"1st Jan to today\", \"21/01/2026 to 31/01/2026\"\n• \"first 2 weeks of last month\"\n\nOr say *cancel* to cancel.",
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
          return new Response("OK", { status: 200 });
        }

        await upsertExportState(supabase, senderPhone, userId, 1, null, null, null);
        await sendWhatsAppReply(
          senderPhone,
          "📤 *Export your expenses*\n\nWhich period? Say anything, for example:\n• *1* — Last 7 days, *2* — Last 30 days, *3* — Last 90 days, *4* — This month\n• \"1st Jan to today\", \"21/01/2026 to 31/01/2026\"\n• \"first 2 weeks of last month\"\n\nOr say *cancel* to cancel.",
          WHATSAPP_PHONE_NUMBER_ID,
          WHATSAPP_TOKEN
        );
        return new Response("OK", { status: 200 });
      }

      // ── TODAY command ──
      if (messageText.toLowerCase() === "today") {
        console.log("[webhook] TODAY command, userId:", userId);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: todayExpenses } = await supabase
          .from("expenses")
          .select("amount, category, description")
          .eq("user_id", userId)
          .gte("date", todayStart.toISOString())
          .order("date", { ascending: false });

        if (!todayExpenses || todayExpenses.length === 0) {
          await sendWhatsAppReply(
            senderPhone,
            "No expenses logged today yet. Send me your expenses to get started!",
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
        } else {
          const total = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
          const lines = todayExpenses.map(
            (e) => `• ${e.description} — ${formatCurrencyUser(e.amount)}`
          );
          await sendWhatsAppReply(
            senderPhone,
            `*Today's Expenses*\n\n${lines.join("\n")}\n\n*Total: ${formatCurrencyUser(total)}*`,
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
        }
        return new Response("OK", { status: 200 });
      }

      // ── TOTAL command (current month) ──
      if (messageText.toLowerCase() === "total") {
        console.log("[webhook] TOTAL command, userId:", userId);
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const { data: monthExpenses } = await supabase
          .from("expenses")
          .select("amount, category")
          .eq("user_id", userId)
          .gte("date", monthStart.toISOString());

        if (!monthExpenses || monthExpenses.length === 0) {
          await sendWhatsAppReply(
            senderPhone,
            "No expenses this month yet!",
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
        } else {
          const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

          // Category breakdown
          const byCategory: Record<string, number> = {};
          monthExpenses.forEach((e) => {
            byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
          });

          const categoryEmoji: Record<string, string> = {
            "Food & Dining": "🍔",
            "Groceries": "🛒",
            "Travel": "✈️",
            "Entertainment": "🎉",
            "Utilities": "💡",
            "Rent": "🏠",
            "Shopping": "🛍️",
            "Education": "📚",
            "Investments": "📈",
            "Healthcare": "🏥",
            "Subscriptions": "📱",
            "Other": "🤷",
          };

          const breakdown = Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(
              ([cat, amt]) =>
                `${categoryEmoji[cat] || "•"} ${cat}: ${formatCurrencyUser(amt)}`
            )
            .join("\n");

          const monthName = now.toLocaleString("default", { month: "long" });

          await sendWhatsAppReply(
            senderPhone,
            `*${monthName} Summary*\n\n${breakdown}\n\n*Total: ${formatCurrencyUser(total)}*\n${monthExpenses.length} transactions`,
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
        }
        return new Response("OK", { status: 200 });
      }

      // ── Classify: expense entry, expense question, insights, or general conversation ──
      console.log(`💡 Intent: ${intent} for message: "${messageText}"`);

      if (intent === "conversation") {
        const reply = getConversationReply(messageText, context);
        await sendWhatsAppReply(
          senderPhone,
          reply,
          WHATSAPP_PHONE_NUMBER_ID,
          WHATSAPP_TOKEN
        );
        return new Response("OK", { status: 200 });
      }

      if (intent === "query") {
        console.log("[webhook] Query intent, answering question");
        try {
          const answer = await answerExpenseQuery(
            messageText,
            userId,
            groqKey,
            supabase,
            formatCurrencyUser
          );
          await sendWhatsAppReply(
            senderPhone,
            answer,
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
        } catch (queryError) {
          console.error("Query error:", queryError);
          await sendWhatsAppReply(
            senderPhone,
            "Sorry, I had trouble answering that. Please try rephrasing your question.",
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
        }
        return new Response("OK", { status: 200 });
      }

      if (intent === "insights") {
        console.log("[webhook] Insights intent, generating advice");
        try {
          const insights = await generateInsights(
            messageText,
            userId,
            groqKey,
            supabase,
            formatCurrencyUser
          );
          await sendWhatsAppReply(
            senderPhone,
            insights,
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
        } catch (insightError) {
          console.error("Insights error:", insightError);
          await sendWhatsAppReply(
            senderPhone,
            "Sorry, I couldn't generate insights right now. Please try again later.",
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
        }
        return new Response("OK", { status: 200 });
      }

      // ── Parse expense from text ──
      let expenses: ParsedExpense[];
      try {
        expenses = await parseExpensesWithGroq(messageText, groqKey);
      } catch (parseError) {
        console.error("Groq parsing error:", parseError);
        await sendWhatsAppReply(
          senderPhone,
          "Sorry, I couldn't understand that. Try something like:\n\"Spent 50 on coffee and 200 for groceries\"",
          WHATSAPP_PHONE_NUMBER_ID,
          WHATSAPP_TOKEN
        );
        return new Response("OK", { status: 200 });
      }

      if (expenses.length === 0) {
        console.log("[webhook] Groq returned 0 valid expenses");
        await sendWhatsAppReply(
          senderPhone,
          "I couldn't find any expenses in your message. Try:\n\"Spent 50 on coffee and 200 for groceries\"",
          WHATSAPP_PHONE_NUMBER_ID,
          WHATSAPP_TOKEN
        );
        return new Response("OK", { status: 200 });
      }

      // ── Insert expenses into Supabase ──
      const expensesWithMeta = expenses.map((e) => ({
        ...e,
        date: new Date().toISOString(),
        user_id: userId,
      }));

      console.log("[webhook] Inserting", expenses.length, "expenses for userId:", userId);
      const { data: inserted, error: insertError } = await supabase
        .from("expenses")
        .insert(expensesWithMeta)
        .select();

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        await sendWhatsAppReply(
          senderPhone,
          "Something went wrong saving your expenses. Please try again.",
          WHATSAPP_PHONE_NUMBER_ID,
          WHATSAPP_TOKEN
        );
        return new Response("OK", { status: 200 });
      }

      // ── Reply with confirmation ──
      const total = inserted.reduce(
        (sum: number, e: any) => sum + e.amount,
        0
      );
      const lines = inserted.map(
        (e: any) => `✅ ${e.description} — ${formatCurrencyUser(e.amount)}`
      );
      const voiceTag = message.type === "audio" ? "🎙️ " : "";
      const replyText =
        inserted.length === 1
          ? `${voiceTag}${lines[0]}\n\nAdded to your expenses!`
          : `${voiceTag}*Added ${inserted.length} expenses:*\n\n${lines.join("\n")}\n\n*Total: ${formatCurrencyUser(total)}*`;

      console.log("[webhook] Success: inserted", inserted?.length ?? 0, "expenses, sending confirmation");
      await sendWhatsAppReply(
        senderPhone,
        replyText,
        WHATSAPP_PHONE_NUMBER_ID,
        WHATSAPP_TOKEN
      );

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Webhook error:", error);
      // Always return 200 to Meta so they don't retry
      return new Response("OK", { status: 200 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
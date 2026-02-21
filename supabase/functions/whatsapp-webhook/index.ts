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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize a phone number to digits only (E.164 without +) */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Format INR amount */
function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
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
  // Groq/OpenAI transcription returns { text: "..." } when response_format is json
  const text = data?.text;
  return typeof text === "string" ? text : "";
}

/** Classify user intent: expense entry, expense question, export, or general conversation */
async function classifyIntent(
  text: string,
  apiKey: string
): Promise<"expense" | "query" | "conversation" | "export"> {
  const trimmed = text.trim().toLowerCase();
  // Fast path: export / download requests
  const exportPatterns = [
    /^export\s*(my\s*)?expenses?$/i,
    /^download\s*(my\s*)?expenses?$/i,
    /^send\s*(me\s*)?(my\s*)?expenses?$/i,
    /^export\s*(csv|pdf)$/i,
    /^download\s*(csv|pdf)$/i,
    /^get\s*(my\s*)?expenses?\s*(file|csv|pdf)?$/i,
  ];
  if (exportPatterns.some((p) => p.test(trimmed))) {
    return "export";
  }
  // Fast path: obvious greetings or capability questions → conversation
  const conversationPatterns = [
    /^(hi|hello|hey|hiya|hey there|hola|namaste|good morning|good afternoon|good evening)[\s!?.,]*$/i,
    /^(what can you do|what do you do|who are you|how do you work|what are you|tell me about yourself)[\s?]*$/i,
    /^(thanks?|thank you|thx|ok|okay|cool|great|bye|goodbye)[\s!?.,]*$/i,
  ];
  if (conversationPatterns.some((p) => p.test(trimmed))) {
    return "conversation";
  }

  const prompt = `You are an intent classifier for an expense tracking app. Classify the following user message into exactly one of four categories:

1. "expense" — the user is logging/adding a new expense (e.g. "spent 50 on coffee", "lunch 200", "paid rent 15000")
2. "query" — the user is asking a question about their expenses, requesting a summary or information (e.g. "how much did I spend last month", "show my food expenses", "top categories")
3. "export" — the user wants to download/export/send their expense data as a file (e.g. "export my expenses", "download expenses", "send me my expenses csv", "I want to export")
4. "conversation" — greetings, small talk, thanks, goodbye, or anything that is NOT logging an expense, NOT a question about expense data, and NOT a request to export/download (e.g. "hi", "what can you do", "thanks", "bye")

Message: "${text}"

Reply with ONLY one word: expense OR query OR export OR conversation`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 15,
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

/** Parse period choice: "1"|"2"|"3"|"4" or "one"/"last 7" etc. Returns { from, to } in YYYY-MM-DD or null. */
function parseExportPeriod(text: string): { from: string; to: string } | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  if (/^1$|^one$|^last\s*7|^7\s*days?/.test(t)) {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/^2$|^two$|^last\s*30|^30\s*days?/.test(t)) {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/^3$|^three$|^last\s*90|^90\s*days?/.test(t)) {
    const from = new Date(now);
    from.setDate(from.getDate() - 89);
    return { from: from.toISOString().split("T")[0], to: today };
  }
  if (/^4$|^four$|^this\s*month|^current\s*month/.test(t)) {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
  }
  return null;
}

/** Parse any date range from user text (Groq): "first 2 weeks of last month", "21/01/2026 to 31-01-2026", "1st jan to today", etc. */
async function parseDateRangeWithGroq(
  text: string,
  apiKey: string
): Promise<{ from: string; to: string } | null> {
  const today = new Date().toISOString().split("T")[0];
  const prompt = `You parse a date range from the user's message into exactly two dates.

Today's date: ${today}

Rules:
- Accept any format: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, "1st Jan 2026", "Jan 1 to today", "first 2 weeks of last month", "21/01/2026 to 31-01-2026", "jan 1 to today", "last jan" (January just passed or last year's January), etc.
- If only one date given, use it for both start and end, or infer end as today if it sounds like "from X onwards".
- "today" = ${today}. "yesterday" = yesterday's date.
- Return JSON only: { "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }. start_date must be <= end_date.
- If the message cannot be parsed as a date range, return: { "start_date": null, "end_date": null }

User message: "${text}"

Return ONLY the JSON object.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 80,
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

/** Extract period and format from an export message (Groq): "export last 30 days csv", "send expenses 1st jan to today as pdf", etc. */
async function parseExportIntentFromMessage(
  text: string,
  apiKey: string
): Promise<{ start_date: string | null; end_date: string | null; format: "csv" | "pdf" | null }> {
  const today = new Date().toISOString().split("T")[0];
  const prompt = `The user wants to export/download their expenses. Extract date range and format from their message.

Today's date: ${today}

Extract:
1. start_date: "YYYY-MM-DD" or null (if they said a period like "last 30 days", "from 1st jan", "21/01/2026 to 31-01-2026", "first 2 weeks of last month", "jan 1 to today", etc.)
2. end_date: "YYYY-MM-DD" or null
3. format: "csv" or "pdf" or null (if they said "csv", "as csv", "in pdf", "pdf", "send csv", etc.)

Accept any date format: DD/MM/YYYY, DD-MM-YYYY, "1st Jan", "Jan 1 to today", "last month", "first 2 weeks of last month". start_date must be <= end_date.
If only one date or "from X" then end_date can be today. If they don't mention dates, return null for both. If they don't mention format, return null for format.

User message: "${text}"

Return ONLY a JSON object: { "start_date": "YYYY-MM-DD" or null, "end_date": "YYYY-MM-DD" or null, "format": "csv" or "pdf" or null }`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 100,
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
  if (/^1$|^one$|^csv$/.test(t)) return "csv";
  if (/^2$|^two$|^pdf$/.test(t)) return "pdf";
  if (t.includes("pdf")) return "pdf";
  if (t.includes("csv")) return "csv";
  return null;
}

/** Generate CSV content for expenses (UTF-8 with BOM). */
function generateExportCSV(expenses: Array<{ date: string; description: string; category: string; amount: number }>): string {
  const header = "Date,Description,Category,Amount (₹)\n";
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
  dateTo: string
): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Expenses Export", 14, 15);
  doc.setFontSize(10);
  doc.text(`Date range: ${dateFrom} to ${dateTo}`, 14, 22);
  autoTable(doc, {
    startY: 28,
    head: [["Date", "Description", "Category", "Amount (₹)"]],
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

/** Fetch expenses, generate CSV, upload, send document. Used when we have both period and format. */
async function doExportAndSend(
  supabase: any,
  senderPhone: string,
  userId: string,
  dateFrom: string,
  dateTo: string,
  formatChoice: "csv" | "pdf",
  phoneNumberId: string,
  token: string
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
      const csvContent = generateExportCSV(expenses);
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
      const pdfBytes = generateExportPDF(expenses, dateFrom, dateTo);
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
    await sendWhatsAppReply(
      senderPhone,
      `✅ Sent your expense report (${expenses.length} transactions). Link expires in 1 hour.`,
      phoneNumberId,
      token
    );
  } catch (uploadErr) {
    console.error("Export upload/send error:", uploadErr);
    await sendWhatsAppReply(
      senderPhone,
      "Could not generate or send the file. The export bucket will be created automatically on first use — please try again.",
      phoneNumberId,
      token
    );
  }
}

/** Reply for general conversation (greetings, "what can you do", etc.) */
function getConversationReply(messageText: string): string {
  const t = messageText.trim().toLowerCase();
  // Greetings
  if (/^(hi|hello|hey|hiya|hola|namaste|good morning|good afternoon|good evening)/i.test(t)) {
    return "Hi! 👋 I'm Spenny AI — your expense tracker on WhatsApp.\n\nYou can *log expenses* (e.g. \"spent 50 on coffee\") or *ask about your spending* (e.g. \"how much last month?\").\n\nSay *help* for all commands.";
  }
  // What can you do / who are you
  if (/what can you do|what do you do|who are you|how do you work|what are you|tell me about yourself/i.test(t)) {
    return `*Spenny AI - Expense Tracker*\n\n📝 *Add expenses:*\n• "Spent 50 on coffee"\n• "Lunch 150, auto 30, movie 500"\n• 🎙️ Send a voice note!\n\n❓ *Ask anything:*\n• "How much did I spend last month?"\n• "Show my food expenses this week"\n• "What's my average daily spend?"\n• "Top spending categories"\n\n⚡ *Quick:* *help* • *today* • *total*`;
  }
  // Thanks / bye
  if (/^(thanks?|thank you|thx|ok|okay|cool|great)/i.test(t)) {
    return "You're welcome! 😊 Message me anytime to log expenses or ask about your spending.";
  }
  if (/^(bye|goodbye)/i.test(t)) {
    return "Bye! 👋 Log your expenses anytime.";
  }
  // Fallback: short helpful reply
  return "I'm Spenny AI — I help you track expenses on WhatsApp. You can log expenses (e.g. \"spent 100 on lunch\") or ask about your spending (e.g. \"how much last month?\"). Say *help* for more.";
}

/** Step 1: Extract Supabase query filters from a natural language question */
interface QueryFilters {
  start_date: string | null; // ISO date string
  end_date: string | null;   // ISO date string
  category: string | null;   // one of: food, travel, groceries, entertainment, utilities, rent, other
  sort_by: "date" | "amount";
  sort_order: "asc" | "desc";
  limit: number;
}

async function extractQueryFilters(
  question: string,
  apiKey: string
): Promise<QueryFilters> {
  const today = new Date().toISOString().split("T")[0];
  const prompt = `You extract database query filters from a natural language question about expenses.

Today's date: ${today}

Given the user's question, return a JSON object with these fields:
{
  "start_date": "YYYY-MM-DD" or null,
  "end_date": "YYYY-MM-DD" or null,
  "category": "food" | "travel" | "groceries" | "entertainment" | "utilities" | "rent" | "other" | null,
  "sort_by": "date" | "amount",
  "sort_order": "asc" | "desc",
  "limit": number (default 100, max 500)
}

Rules:
- "last month" = first day to last day of previous month
- "this month" = first day of current month to today
- "this week" = last 7 days
- "last week" = 7-14 days ago
- "january", "feb" etc = that month of the current year (or last year if the month is in the future)
- "yesterday" = yesterday's date for both start and end
- "today" = today's date for both start and end
- If no time range mentioned, set both dates to null (we'll fetch all data)
- If user asks about a specific category like "food expenses", set category
- If user asks "biggest" or "highest", sort_by=amount, sort_order=desc
- If user asks "smallest" or "lowest", sort_by=amount, sort_order=asc
- If user asks "recent" or "latest", sort_by=date, sort_order=desc
- Default: sort_by=date, sort_order=desc, limit=100

User's question: "${question}"

Return ONLY the JSON object, no other text.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    console.warn("Query filter extraction failed:", res.status, ", using defaults");
    return {
      start_date: null,
      end_date: null,
      category: null,
      sort_by: "date",
      sort_order: "desc",
      limit: 100,
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
      sort_by: parsed.sort_by === "amount" ? "amount" : "date",
      sort_order: parsed.sort_order === "asc" ? "asc" : "desc",
      limit: Math.min(Math.max(parsed.limit || 100, 1), 500),
    };
  } catch {
    return {
      start_date: null,
      end_date: null,
      category: null,
      sort_by: "date",
      sort_order: "desc",
      limit: 100,
    };
  }
}

/** Step 2 & 3: Query Supabase with filters, then answer using Groq */
async function answerExpenseQuery(
  question: string,
  userId: string,
  apiKey: string,
  supabase: any
): Promise<string> {
  // Step 1: Extract query filters from the question
  const filters = await extractQueryFilters(question, apiKey);
  console.log("🔍 Query filters:", JSON.stringify(filters));

  // Step 2: Build targeted Supabase query
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

  query = query
    .order(filters.sort_by, { ascending: filters.sort_order === "asc" })
    .limit(filters.limit);

  const { data: expenses, error } = await query;

  if (error) {
    console.error("Supabase expenses fetch error:", error.message, "userId:", userId);
    throw new Error(`Failed to fetch expenses: ${error.message}`);
  }
  console.log("Fetched", expenses?.length ?? 0, "expenses for query");

  const today = new Date().toISOString().split("T")[0];

  if (!expenses || expenses.length === 0) {
    const dateInfo = filters.start_date
      ? ` between ${filters.start_date} and ${filters.end_date || today}`
      : "";
    const catInfo = filters.category ? ` in ${filters.category}` : "";
    return `No expenses found${catInfo}${dateInfo}. Start logging expenses by sending messages like "Spent 50 on coffee"!`;
  }

  // Step 3: Build compact data for Groq to summarize
  const expenseLines = expenses.map(
    (e: any) =>
      `${new Date(e.date).toISOString().split("T")[0]} | ${e.category} | ${e.description} | ₹${e.amount}`
  );

  const totalAmount = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);

  const filterDesc = [];
  if (filters.start_date) filterDesc.push(`from ${filters.start_date}`);
  if (filters.end_date) filterDesc.push(`to ${filters.end_date}`);
  if (filters.category) filterDesc.push(`category: ${filters.category}`);

  const prompt = `You are Spenny AI, a friendly expense tracking assistant on WhatsApp.

Today's date: ${today}
Currency: Indian Rupees (₹ / INR)

Query applied: ${filterDesc.length > 0 ? filterDesc.join(", ") : "all expenses"}
Results: ${expenses.length} transactions, total ₹${totalAmount}

Expense data (date | category | description | amount):
${expenseLines.join("\n")}

User's question: "${question}"

Instructions:
- Answer accurately using ONLY the data above
- Use ₹ symbol and Indian number format (e.g. ₹1,50,000)
- Be concise — this is WhatsApp, keep it readable
- Use WhatsApp formatting: *bold* for emphasis, • for bullet points
- Calculate totals, averages, comparisons, breakdowns as needed
- Be friendly and helpful
- Do NOT use markdown tables, use simple lists
- Keep response under 1000 characters when possible`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Sorry, I couldn't process your question.";
}

/** Call Groq REST API to parse expenses from natural language */
async function parseExpensesWithGroq(
  text: string,
  apiKey: string
): Promise<ParsedExpense[]> {
  const prompt = `You are an AI that extracts structured expense data from natural language input.

IMPORTANT: Extract ALL expenses mentioned in the text, even if multiple expenses are mentioned in a single sentence.

For the input: '${text}'

Return a JSON array of objects with this exact format:
[
  {
    "amount": number,
    "category": string,
    "description": string
  }
]

CATEGORY RULES:
- Use only these categories: food, travel, groceries, entertainment, utilities, rent, other
- food: restaurants, cafes, fast food, dining out
- groceries: supermarket, grocery store, fresh food, household items
- travel: transportation, fuel, parking, public transport, flights, hotels
- entertainment: movies, games, hobbies, sports, concerts
- utilities: electricity, water, gas, internet, phone bills
- rent: housing rent, accommodation
- other: anything that doesn't fit above categories

DESCRIPTION RULES:
- Keep descriptions short and clean (max 50 characters)
- Extract the main item/service name
- Remove unnecessary words like "spent", "bought", "paid"

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

Please extract all expenses from: '${text}'`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("Groq expense parsing failed:", res.status, errBody);
    throw new Error(`Groq API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const responseText = data.choices?.[0]?.message?.content || "";
  console.log("Groq expense parse response length:", responseText.length);

  const cleanedJson = responseText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const parsed: ParsedExpense[] = JSON.parse(cleanedJson);

  // Validate
  return parsed.filter(
    (e) =>
      e &&
      typeof e.amount === "number" &&
      e.amount > 0 &&
      typeof e.category === "string" &&
      typeof e.description === "string" &&
      e.description.trim().length > 0
  );
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
        // (profile lookup is duplicated below for text commands, but needed here for audio)
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
          `*Spenny AI - Expense Tracker*\n\n📝 *Add expenses:*\n• "Spent 50 on coffee"\n• "Lunch 150, auto 30, movie 500"\n• 🎙️ Send a voice note!\n\n❓ *Ask anything:*\n• "How much did I spend last month?"\n• "Show my food expenses this week"\n• "Top spending categories"\n\n📤 *Export:*\n• *export* - Download your expenses (CSV)\n\n⚡ *Quick commands:*\n• *help* - This message\n• *today* - Today's expenses\n• *total* - This month's summary\n• *export* - Download expenses`,
          WHATSAPP_PHONE_NUMBER_ID,
          WHATSAPP_TOKEN
        );
        return new Response("OK", { status: 200 });
      }

      // ── Look up user by phone number ──
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, groq_api_key")
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

      if (!groqKey) {
        await sendWhatsAppReply(
          senderPhone,
          "No Groq API key configured. Please add one in Spenny AI Settings or contact support.",
          WHATSAPP_PHONE_NUMBER_ID,
          WHATSAPP_TOKEN
        );
        return new Response("OK", { status: 200 });
      }

      // ── Export flow: follow-up questions (period → format) ──
      let intent: "expense" | "query" | "conversation" | "export" | null = null;
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
                WHATSAPP_TOKEN
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
              WHATSAPP_TOKEN
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
        intent = await classifyIntent(messageText, groqKey);
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
            WHATSAPP_TOKEN
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
            (e) => `• ${e.description} — ${formatINR(e.amount)}`
          );
          await sendWhatsAppReply(
            senderPhone,
            `*Today's Expenses*\n\n${lines.join("\n")}\n\n*Total: ${formatINR(total)}*`,
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
            food: "🍔",
            travel: "✈️",
            groceries: "🛒",
            entertainment: "🎉",
            utilities: "💡",
            rent: "🏠",
            other: "🤷",
          };

          const breakdown = Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(
              ([cat, amt]) =>
                `${categoryEmoji[cat] || "•"} ${cat}: ${formatINR(amt)}`
            )
            .join("\n");

          const monthName = now.toLocaleString("default", { month: "long" });

          await sendWhatsAppReply(
            senderPhone,
            `*${monthName} Summary*\n\n${breakdown}\n\n*Total: ${formatINR(total)}*\n${monthExpenses.length} transactions`,
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN
          );
        }
        return new Response("OK", { status: 200 });
      }

      // ── Classify: expense entry, expense question, or general conversation (intent already set above) ──
      console.log(`💡 Intent: ${intent} for message: "${messageText}"`);

      if (intent === "conversation") {
        const reply = getConversationReply(messageText);
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
            supabase
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
        (e: any) => `✅ ${e.description} — ${formatINR(e.amount)}`
      );
      const voiceTag = message.type === "audio" ? "🎙️ " : "";
      const replyText =
        inserted.length === 1
          ? `${voiceTag}${lines[0]}\n\nAdded to your expenses!`
          : `${voiceTag}*Added ${inserted.length} expenses:*\n\n${lines.join("\n")}\n\n*Total: ${formatINR(total)}*`;

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

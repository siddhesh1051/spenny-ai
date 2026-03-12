// Supabase Edge Function: sync-gmail-expenses
// Strategy: regex-first extraction (amount, merchant, date) for structured bank alerts.
// AI (Groq) is used ONLY as a fallback when regex can't find an amount.
// This eliminates rate-limit failures and non-determinism for the 95% of emails
// that follow a standard Indian bank alert template.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── Types ───────────────────────────────────────────────────────────────────

interface GmailMessage { id: string; threadId: string }

interface GmailMessageDetail {
  id: string;
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
    body?: { data?: string };
    parts?: { mimeType: string; body?: { data?: string }; parts?: { mimeType: string; body?: { data?: string } }[] }[];
  };
  internalDate: string;
}

interface ExtractedExpense {
  amount: number;
  category: string;
  description: string;
  date: string;
  gmail_message_id: string;
  extraction_method: "regex" | "ai";
}

// ── Config ──────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  "Food & Dining", "Groceries", "Travel", "Entertainment", "Utilities",
  "Rent", "Shopping", "Education", "Investments", "Healthcare", "Subscriptions", "Other",
] as const;
type Category = typeof VALID_CATEGORIES[number];

const MAX_MESSAGES_PER_SYNC = 500;

// ── Gmail query ─────────────────────────────────────────────────────────────

const GMAIL_QUERY =
  "(subject:\"debited\" OR subject:\"credited\" OR subject:\"transaction\" OR subject:\"payment\" OR subject:\"spent\" OR subject:\"purchase\" OR subject:\"UPI\" OR subject:\"NEFT\" OR subject:\"IMPS\" OR subject:\"alert\" OR subject:\"order confirmed\" OR subject:\"order placed\" OR subject:\"subscription\" OR subject:\"charged\" OR subject:\"receipt\" OR subject:\"recharge\" OR from:alerts OR from:noreply@paytm.com OR from:alerts@hdfcbank.net OR from:alerts@hdfcbank.bank.in OR from:alerts@icicibank.com OR from:alerts@axisbank.com OR from:sbiintouch@sbi.co.in OR from:kotak OR from:alerts@indusind.com OR from:no-reply@swiggy.in OR from:no-reply@zomato.com OR from:order-update@amazon.in OR from:noreply@flipkart.com OR from:receipts@razorpay.com OR from:noreply@phonepe.com OR from:gpay-noreply@google.com) category:primary";

// ── HTML / text extraction ───────────────────────────────────────────────────

function decodeBase64Url(data: string): string {
  try { return atob(data.replace(/-/g, "+").replace(/_/g, "/")); }
  catch { return ""; }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ").trim();
}

function extractEmailText(msg: GmailMessageDetail): string {
  const subject = msg.payload.headers.find((h) => h.name.toLowerCase() === "subject")?.value ?? "";
  const from = msg.payload.headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";

  let plainText = "";
  let htmlText = "";

  const findParts = (parts: typeof msg.payload.parts): void => {
    if (!parts) return;
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data && !plainText)
        plainText = decodeBase64Url(part.body.data);
      else if (part.mimeType === "text/html" && part.body?.data && !htmlText)
        htmlText = stripHtml(decodeBase64Url(part.body.data));
      if (part.parts) findParts(part.parts);
    }
  };

  if (msg.payload.body?.data) {
    const topBody = decodeBase64Url(msg.payload.body.data);
    const ct = msg.payload.headers.find((h) => h.name.toLowerCase() === "content-type")?.value ?? "";
    if (ct.includes("text/html")) htmlText = stripHtml(topBody);
    else plainText = topBody;
  }

  findParts(msg.payload.parts);

  const body = plainText || htmlText || msg.snippet || "";
  return `From: ${from}\nSubject: ${subject}\n\n${body}`;
}

// ── Pre-filter: is this even potentially a debit email? ──────────────────────

const DEBIT_SIGNAL = /\b(debited|deducted|debit alert|paid|payment of|payment done|payment successful|spent|purchased?|charged|withdrawn|withdrawal|money sent|transferred to|transfer of|upi debit|upi payment|upi transfer|sent via upi|subscription charged|subscription renewed|auto.?debit|auto.?pay|bill paid|recharge successful|order placed|order confirmed)\b|rs\.?\s*[\d,]+|inr\s*[\d,]+|₹\s*[\d,]+/i;

const IGNORE_SIGNAL = /\b(otp|one.?time.?pass(word)?|your\s+otp|verification\s+code|login\s+alert|new\s+device|signed\s+in|security\s+alert)\b/i;

function isLikelyDebitEmail(text: string): boolean {
  if (IGNORE_SIGNAL.test(text)) return false;
  return DEBIT_SIGNAL.test(text);
}

// ── REGEX-FIRST EXTRACTION ───────────────────────────────────────────────────
// Generic patterns that work across ALL Indian banks and payment apps.
// No bank-specific logic — we match structural patterns in the text.

// ── Amount ───────────────────────────────────────────────────────────────────
// Priority order: most specific (adjacent to debit keyword) → most permissive (any currency symbol)
const AMOUNT_PATTERNS = [
  // "Rs.897.64 has been debited/paid/charged..." — currency then amount then debit word
  /(?:rs\.?\s*|inr\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)(?:\s*\/?\-?)?\s*(?:has been|is|was|have been)?\s*(?:debited|deducted|charged|spent|paid|withdrawn|transferred)/i,
  // "debited/paid/charged Rs.500" — debit word then currency+amount
  /(?:debited|deducted|charged|spent|paid|withdrawn|transferred)\s+(?:with\s+|of\s+|for\s+)?(?:rs\.?\s*|inr\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)/i,
  // "amount of Rs.500" / "txn of Rs 500" / "transaction of INR 500"
  /(?:amount|txn|transaction|payment|purchase)\s+(?:of\s+)?(?:rs\.?\s*|inr\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)/i,
  // "Rs.500 paid/sent/spent" — without "has been"
  /(?:rs\.?\s*|inr\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)\s+(?:paid|sent|spent|debited|deducted|charged|withdrawn)/i,
  // Last resort: any currency symbol with a number (catches ₹450, Rs 450, INR 450)
  /(?:rs\.?\s*|inr\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)/i,
];

function extractAmount(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const n = parseFloat(match[1].replace(/,/g, ""));
      // Sanity: ignore amounts like account numbers (>10 lakh unlikely as a txn)
      if (!isNaN(n) && n > 0 && n < 10_000_000) return n;
    }
  }
  return null;
}

// ── Merchant ─────────────────────────────────────────────────────────────────
// Strategy (in priority order):
// 1. Named merchant field after the VPA  (HDFC: "to VPA xxx@yyy MERCHANT NAME on date")
// 2. Full UPI VPA  (any bank: "to/at xxx@yyy")
// 3. "at <merchant>" / "to <merchant>" / "for <merchant>" with tight stop words
// 4. Known brand keywords in subject / body

// Known brand keyword → clean display name
const BRAND_MAP: Record<string, string> = {
  zomato: "Zomato", swiggy: "Swiggy", paytm: "Paytm", phonepe: "PhonePe",
  "google pay": "Google Pay", gpay: "Google Pay", "amazon pay": "Amazon Pay",
  amazon: "Amazon", flipkart: "Flipkart", blinkit: "Blinkit",
  bigbasket: "BigBasket", zepto: "Zepto", ola: "Ola", uber: "Uber",
  rapido: "Rapido", irctc: "IRCTC", makemytrip: "MakeMyTrip",
  bookmyshow: "BookMyShow", netflix: "Netflix", spotify: "Spotify",
  airtel: "Airtel", jio: "Jio", "vi ": "Vi", vodafone: "Vodafone",
  bsnl: "BSNL", dmart: "DMart", nykaa: "Nykaa", myntra: "Myntra",
  meesho: "Meesho", razorpay: "Razorpay", cashfree: "Cashfree",
  "tata sky": "Tata Play", tataplay: "Tata Play", "dish tv": "Dish TV",
  "sun direct": "Sun Direct", swipe: "Swipe", cred: "CRED",
  "bajaj finserv": "Bajaj Finserv", emi: "EMI Payment",
};

// Resolve a UPI VPA → clean name
// Tries brand map first; for unknown VPAs uses the part before @ with light cleanup
function resolveVpa(vpa: string): string {
  const [handle] = vpa.split("@");
  const lower = handle.toLowerCase();

  // Check brand map against handle
  for (const [key, name] of Object.entries(BRAND_MAP)) {
    if (lower.includes(key.replace(/ /g, ""))) return name;
  }

  // Unknown VPA: strip trailing digits (QR codes append random numbers)
  // e.g. "paytmqr5dam2e" → "paytmqr" — not ideal, so we try word extraction
  // Split on dots/underscores/hyphens and take the first meaningful word
  const words = handle.split(/[._\-@]/).filter((w) => /[a-zA-Z]{2,}/.test(w));
  if (words.length > 0) {
    // Capitalise each word, skip pure-digit tokens
    const name = words
      .filter((w) => !/^\d+$/.test(w))
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ")
      .slice(0, 35);
    if (name.length >= 2) return name;
  }

  return handle.slice(0, 35);
}

// Stop words that should never appear in a merchant name
const MERCHANT_STOP = /\b(on|via|ref|upi|neft|imps|rtgs|id|no|number|dated|date|account|a\/c|ac|bank|your|from|has|been|is|was|the|this|transaction|txn|transfer|payment|amount|balance|available|dear|customer|please|immediately|calling|regards|for more|click|here|if you)\b/i;

function extractMerchant(text: string, subject: string): string {
  // ── Priority 1: HDFC-style "to VPA xxx@yyy MERCHANT NAME on DD-MM-YY"
  // The merchant name sits BETWEEN the VPA and "on <date>"
  const vpaWithName = text.match(
    /\b(?:vpa|upi\s*id|upi)\s+([A-Za-z0-9._+\-]+@[A-Za-z0-9._]+)\s+([A-Z][A-Z0-9 &'.\/\-]{1,60}?)\s+(?:on\s+\d|on\s+\w)/i
  );
  if (vpaWithName) {
    const namedMerchant = vpaWithName[2].trim().replace(/\s+/g, " ");
    // Prefer the inline name if it looks like a real business name (not all caps garbage)
    if (namedMerchant.length >= 3 && !MERCHANT_STOP.test(namedMerchant)) {
      return namedMerchant.slice(0, 40);
    }
    // Fall through to VPA resolution
    return resolveVpa(vpaWithName[1]);
  }

  // ── Priority 2: Any bare VPA (xxx@yyy) in the text
  // Covers ICICI, Axis, SBI, Kotak, PhonePe, GPay alerts
  const bareVpa = text.match(/([A-Za-z0-9._+\-]{3,}@[A-Za-z0-9]{2,}(?:\.[A-Za-z]{2,})?)/);
  if (bareVpa) {
    const resolved = resolveVpa(bareVpa[1]);
    if (resolved && resolved !== "Unknown") return resolved;
  }

  // ── Priority 3: Sentence patterns — "paid to X", "sent to X", "debited to X",
  //    "at X", "merchant X", "purchase at X"
  const TO_PATTERNS = [
    // "paid to / sent to / transferred to / debited to MERCHANT on|via|ref"
    /(?:paid|sent|transferred|debited|trf)\s+to\s+([A-Za-z0-9 &'.\/\-]{3,50}?)(?:\s+on\s+\d|\s+via\s+|\s+ref\b|\s*\.|\s*,|\s*$)/i,
    // "purchase at / spent at / transaction at MERCHANT"
    /(?:purchase|spent|txn|transaction)\s+at\s+([A-Za-z0-9 &'.\/\-]{3,50}?)(?:\s+on\s+\d|\s+via\s+|\s+ref\b|\s*\.|\s*,|\s*$)/i,
    // "merchant: MERCHANT" or "merchant name: MERCHANT"
    /merchant(?:\s+name)?\s*:\s*([A-Za-z0-9 &'.\/\-]{3,50}?)(?:\s+on\s+\d|\s*\.|\s*,|\s*$)/i,
    // "to MERCHANT" — most permissive, used as fallback
    /\bto\s+([A-Za-z][A-Za-z0-9 &'.\/\-]{2,49}?)(?:\s+on\s+\d|\s+via\s+|\s+ref\b|\s*\.|\s*,|\s*$)/i,
  ];

  for (const pat of TO_PATTERNS) {
    const m = text.match(pat);
    if (m?.[1]) {
      const raw = m[1].trim().replace(/\s+/g, " ");
      // Reject if it's just stop words
      if (raw.length >= 3 && !MERCHANT_STOP.test(raw.replace(/\s/g, " ").trim())) {
        return raw.slice(0, 40);
      }
    }
  }

  // ── Priority 4: Known brand anywhere in subject or body
  const haystack = `${subject} ${text}`.toLowerCase();
  for (const [key, name] of Object.entries(BRAND_MAP)) {
    if (haystack.includes(key)) return name;
  }

  return "Unknown";
}

// ── Category ─────────────────────────────────────────────────────────────────
const CATEGORY_RULES: [Category, RegExp][] = [
  ["food",          /\b(zomato|swiggy|food|restaurant|cafe|dhaba|bakery|juice|barbeque|pizza|burger|biryani|meal|dining|eat|hunger|dominos|kfc|mcdonalds|subway|starbucks)\b/i],
  ["groceries",     /\b(bigbasket|blinkit|zepto|dmart|kirana|grocer|supermarket|pharmacy|medical|medicine|drugstore|chemist|health|nykaa|cosmetic|beauty|wellness|apollo|medplus)\b/i],
  ["travel",        /\b(ola|uber|rapido|irctc|railway|flight|airline|indigo|air\s*india|goair|spicejet|vistara|petrol|fuel|diesel|fastag|toll|parking|cab|auto|metro|bus|makemytrip|goibibo|cleartrip|yatra|redbus|ixigo)\b/i],
  ["entertainment", /\b(bookmyshow|netflix|spotify|prime\s*video|hotstar|disney|youtube|gaming|gym|fitness|cult|pub|bar|movie|theatre|concert|event|ticket|lenskart)\b/i],
  ["utilities",     /\b(airtel|jio|bsnl|vodafone|\bvi\b|electricity|bescom|msedcl|water\s*bill|gas\s*bill|lpg|insurance|lic|hdfc\s*life|icici\s*pru|emi|loan|dth|tata\s*play|dish\s*tv|recharge|mobile\s*bill|broadband|internet|wifi)\b/i],
  ["rent",          /\b(rent|paying\s*guest|\bpg\b|society|maintenance|hostel|flat|apartment|housing|nobroker|magicbricks|99acres)\b/i],
];

function categorise(merchant: string, emailText: string): Category {
  const haystack = `${merchant} ${emailText}`.toLowerCase();
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(haystack)) return cat;
  }
  return "other";
}

// ── Is it definitely a DEBIT (not a credit-only email)? ──────────────────────
function isDebitTransaction(text: string): boolean {
  const hasDebit = /\b(debited|deducted|paid|sent|spent|withdrawn|charged|payment\s+(?:of|done|successful)|transferred\s+to|purchase)\b/i.test(text);
  const hasCredit = /\b(credited|received|refund|cashback|salary|interest\s+credited|deposit)\b/i.test(text);
  // If both present (e.g. "debited X, new balance credited") → still a debit
  // If only credit signal → not a debit
  return hasDebit || !hasCredit;
}

// ── Regex extraction entry point ─────────────────────────────────────────────

interface RegexResult { amount: number; merchant: string; category: Category }

function extractByRegex(emailText: string, subject: string): RegexResult | null {
  if (!isDebitTransaction(emailText)) return null;

  const amount = extractAmount(emailText);
  if (!amount) return null;

  const merchant = extractMerchant(emailText, subject);
  const category = categorise(merchant, emailText);

  return { amount, merchant, category };
}

// ── Groq AI — fallback only ──────────────────────────────────────────────────

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant"; // 800k TPM — no rate limit issues

async function groqExtract(
  emailText: string,
  emailDate: string,
  msgId: string,
  groqKey: string
): Promise<{ amount: number; category: string; description: string } | null> {
  const prompt = `Indian bank/payment email. Extract expense if money was DEBITED/PAID/SPENT.

EMAIL:
${emailText.slice(0, 1500)}

Rules:
- DEBIT only: debited/paid/sent/spent/withdrawn/charged. IGNORE: credited/refund/cashback/OTP/salary.
- amount: number in INR (no symbol). description: merchant ≤35 chars. category: exactly one of Food & Dining|Groceries|Travel|Entertainment|Utilities|Rent|Shopping|Education|Investments|Healthcare|Subscriptions|Other

If NOT a debit → {"is_expense":false}
If debit → {"is_expense":true,"amount":<number>,"category":"<cat>","description":"<merchant>"}
JSON only.`;

  // Retry up to 5 times — we MUST get an answer
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: "Respond with valid JSON only. No markdown." },
            { role: "user", content: prompt },
          ],
          temperature: 0,
          max_tokens: 150,
          seed: 42,
        }),
      });

      if (res.status === 429) {
        const errJson = await res.json().catch(() => ({}));
        const msg: string = errJson?.error?.message ?? "";
        const waitMatch = msg.match(/try again in ([\d.]+)s/i);
        const waitMs = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500 : attempt * 3000;
        console.warn(`[AI:429] ${msgId} attempt=${attempt} waiting=${waitMs}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (!res.ok) {
        console.error(`[AI:error] ${msgId} status=${res.status}`);
        if (attempt < 5) { await new Promise((r) => setTimeout(r, attempt * 2000)); continue; }
        return null;
      }

      const d = await res.json();
      const raw = d.choices?.[0]?.message?.content ?? "";
      console.log(`[AI:response] ${msgId} raw="${raw}"`);
      const cleaned = raw.replace(/```json?/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.is_expense) return null;
      if (typeof parsed.amount !== "number" || parsed.amount <= 0) return null;
      if (!VALID_CATEGORIES.includes(parsed.category)) return null;
      if (!parsed.description) return null;

      return { amount: parsed.amount, category: parsed.category, description: parsed.description };
    } catch (err) {
      console.error(`[AI:exception] ${msgId} attempt=${attempt} ${err instanceof Error ? err.message : String(err)}`);
      if (attempt < 5) await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  return null;
}

// ── Classify one email (regex → AI fallback) ─────────────────────────────────

async function classifyEmail(
  detail: GmailMessageDetail,
  msgId: string,
  groqKey: string
): Promise<ExtractedExpense | null> {
  const emailText = extractEmailText(detail);
  const subject = detail.payload.headers.find((h) => h.name.toLowerCase() === "subject")?.value ?? "(no subject)";
  const emailDate = new Date(Number(detail.internalDate)).toISOString();
  const preview = emailText.replace(/\n+/g, " ").trim().slice(0, 400);

  // Gate 1: pre-filter
  if (!isLikelyDebitEmail(emailText)) {
    console.log(`[SKIP:pre-filter] ${msgId} | "${subject}" | ${preview}`);
    return null;
  }

  // Gate 2: regex extraction (fast, deterministic, no API call)
  const regexResult = extractByRegex(emailText, subject);
  if (regexResult) {
    console.log(`[EXPENSE:regex] ${msgId} | ₹${regexResult.amount} | ${regexResult.category} | "${regexResult.merchant}" | "${subject}"`);
    return {
      amount: regexResult.amount,
      category: regexResult.category,
      description: regexResult.merchant,
      date: emailDate,
      gmail_message_id: msgId,
      extraction_method: "regex",
    };
  }

  // Gate 3: AI fallback — only reaches here if regex couldn't find an amount
  console.log(`[AI:fallback] ${msgId} | "${subject}" — regex found no amount, trying AI`);
  const aiResult = await groqExtract(emailText, emailDate, msgId, groqKey);
  if (aiResult) {
    console.log(`[EXPENSE:ai] ${msgId} | ₹${aiResult.amount} | ${aiResult.category} | "${aiResult.description}" | "${subject}"`);
    return {
      amount: aiResult.amount,
      category: aiResult.category,
      description: aiResult.description.trim().slice(0, 100),
      date: emailDate,
      gmail_message_id: msgId,
      extraction_method: "ai",
    };
  }

  console.log(`[SKIP:no-expense] ${msgId} | "${subject}" | regex+AI both say not a debit expense | ${preview}`);
  return null;
}

// ── Parallel chunk runner ────────────────────────────────────────────────────

async function chunk<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return results;
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "No auth" }, 401);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user }, error: userError } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);
    const userId = user.id;

    const { data: profile } = await db.from("profiles").select("groq_api_key").eq("id", userId).single();
    const groqKey = profile?.groq_api_key || Deno.env.get("GROQ_API_KEY") || "";
    if (!groqKey) return jsonResponse({ error: "No Groq API key configured" }, 400);

    const body = await req.json().catch(() => ({}));
    const gmailAccessToken: string = body.gmail_access_token;
    const sinceDateOverride: string | null = body.since_date ?? null;
    if (!gmailAccessToken) return jsonResponse({ error: "gmail_access_token required" }, 400);

    // ── Gmail profile + sync state ────────────────────────────────────────
    const [gmailProfileRes, syncStateRes] = await Promise.all([
      fetch("https://www.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${gmailAccessToken}` },
      }),
      db.from("gmail_sync_state").select("last_synced_at, synced_message_ids").eq("user_id", userId).maybeSingle(),
    ]);

    let gmailEmail: string | null = null;
    if (gmailProfileRes.ok) gmailEmail = (await gmailProfileRes.json()).emailAddress ?? null;

    const syncState = syncStateRes.data;
    const lastSyncedAt: string | null = syncState?.last_synced_at ?? null;
    const syncedMessageIds: Set<string> = new Set(syncState?.synced_message_ids ?? []);

    // ── Gmail date filter (only on first sync or explicit override) ────────
    const toGmailDate = (d: Date) =>
      `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;

    let gmailQuery = GMAIL_QUERY;
    if (sinceDateOverride) {
      const [y, m, d] = sinceDateOverride.split("-");
      gmailQuery += ` after:${y}/${m}/${d}`;
    } else if (!lastSyncedAt) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() - 90);
      gmailQuery += ` after:${toGmailDate(fallback)}`;
    }
    console.log(`[QUERY] ${gmailQuery}`);

    // ── Fetch message IDs — early-stop when we hit known messages ─────────
    const allMessages: GmailMessage[] = [];
    let pageToken: string | undefined;
    let hitKnownPage = false;

    do {
      const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
      listUrl.searchParams.set("q", gmailQuery);
      listUrl.searchParams.set("maxResults", "100");
      if (pageToken) listUrl.searchParams.set("pageToken", pageToken);

      const listRes = await fetch(listUrl.toString(), { headers: { Authorization: `Bearer ${gmailAccessToken}` } });
      if (!listRes.ok) return jsonResponse({ error: `Gmail API error: ${await listRes.text()}` }, 400);

      const listData: { messages?: GmailMessage[]; nextPageToken?: string } = await listRes.json();
      const page = listData.messages ?? [];
      allMessages.push(...page);
      pageToken = listData.nextPageToken;

      if (page.length > 0 && page.every((m) => syncedMessageIds.has(m.id))) {
        hitKnownPage = true;
        break;
      }
    } while (pageToken);

    console.log(`[FETCH] ${allMessages.length} messages from Gmail (early-stop=${hitKnownPage})`);

    if (allMessages.length === 0) {
      await db.from("gmail_sync_state").upsert({
        user_id: userId, last_synced_at: new Date().toISOString(),
        synced_message_ids: Array.from(syncedMessageIds).slice(-2000),
        ...(gmailEmail ? { gmail_email: gmailEmail } : {}),
      });
      return jsonResponse({ inserted: 0, skipped: 0, total_processed: 0, gmail_email: gmailEmail, message: "No new bank emails found." });
    }

    // ── Deduplicate ───────────────────────────────────────────────────────
    const newMessages = allMessages.filter((m) => !syncedMessageIds.has(m.id)).slice(0, MAX_MESSAGES_PER_SYNC);
    const cappedAt = newMessages.length < allMessages.filter((m) => !syncedMessageIds.has(m.id)).length;

    if (newMessages.length === 0) {
      await db.from("gmail_sync_state").upsert({
        user_id: userId, last_synced_at: new Date().toISOString(),
        synced_message_ids: Array.from(syncedMessageIds).slice(-2000),
        ...(gmailEmail ? { gmail_email: gmailEmail } : {}),
      });
      return jsonResponse({ inserted: 0, skipped: allMessages.length, total_processed: 0, gmail_email: gmailEmail, message: "All emails already synced." });
    }

    // ── Fetch full email bodies in parallel batches of 20 ─────────────────
    const details = await chunk(newMessages, 20, async (msg) => {
      try {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${gmailAccessToken}` } }
        );
        if (!res.ok) return null;
        return await res.json() as GmailMessageDetail;
      } catch { return null; }
    });

    // ── Classify: regex first, AI fallback ────────────────────────────────
    // Run in batches of 10. Regex emails are instant; AI fallbacks self-throttle via retry.
    type ClassifyInput = { detail: GmailMessageDetail; msgId: string };
    const toClassify: ClassifyInput[] = details
      .map((d, i) => d ? { detail: d, msgId: newMessages[i].id } : null)
      .filter((x): x is ClassifyInput => x !== null);

    const classifyResults = await chunk(toClassify, 10, async ({ detail, msgId }) => {
      try {
        const expense = await classifyEmail(detail, msgId, groqKey);
        return { msgId, expense };
      } catch (err) {
        console.error(`[ERROR] ${msgId} ${err instanceof Error ? err.message : String(err)}`);
        return { msgId, expense: null };
      }
    });

    const processedIds = classifyResults.map((r) => r.msgId);
    const expensesToInsert = classifyResults.filter((r) => r.expense !== null).map((r) => ({ ...r.expense!, user_id: userId }));

    const regexCount = expensesToInsert.filter((e) => e.extraction_method === "regex").length;
    const aiCount = expensesToInsert.filter((e) => e.extraction_method === "ai").length;
    console.log(`[SUMMARY] processed=${processedIds.length} expenses=${expensesToInsert.length} (regex=${regexCount} ai=${aiCount}) skipped=${processedIds.length - expensesToInsert.length}`);

    // ── Insert ────────────────────────────────────────────────────────────
    let insertedCount = 0;
    if (expensesToInsert.length > 0) {
      const { data: inserted, error: insertErr } = await db
        .from("expenses")
        .insert(expensesToInsert.map((e) => ({
          user_id: e.user_id, amount: e.amount, category: e.category,
          description: e.description, date: e.date, gmail_message_id: e.gmail_message_id,
        })))
        .select("id");
      if (insertErr) console.error(`[DB:error] ${insertErr.message}`);
      else insertedCount = inserted?.length ?? 0;
    }

    // ── Update sync state — keep up to 2000 IDs ───────────────────────────
    await db.from("gmail_sync_state").upsert({
      user_id: userId,
      last_synced_at: new Date().toISOString(),
      synced_message_ids: [...Array.from(syncedMessageIds), ...processedIds].slice(-2000),
      ...(gmailEmail ? { gmail_email: gmailEmail } : {}),
    });

    const skipped = processedIds.length - expensesToInsert.length;
    const cappedNote = cappedAt ? ` (capped at ${MAX_MESSAGES_PER_SYNC} — sync again for more)` : "";

    return jsonResponse({
      inserted: insertedCount, skipped, total_processed: processedIds.length,
      gmail_email: gmailEmail, capped: cappedAt,
      message: insertedCount > 0
        ? `Synced ${insertedCount} new expense${insertedCount > 1 ? "s" : ""}!${cappedNote}`
        : `No expense transactions found.${cappedNote}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});

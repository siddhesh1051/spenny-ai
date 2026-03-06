// Supabase Edge Function: sync-gmail-expenses
// Fetches bank/transaction emails from Gmail, extracts expenses using AI,
// deduplicates by Gmail message ID, and inserts into expenses table.

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

// ── Types ──────────────────────────────────────────────────────────────────

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailMessageDetail {
  id: string;
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
    body?: { data?: string };
    parts?: { mimeType: string; body?: { data?: string } }[];
  };
  internalDate: string;
}

interface ExtractedExpense {
  amount: number;
  category: string;
  description: string;
  date: string;
  gmail_message_id: string;
}

// ── Categories ─────────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  "food",
  "travel",
  "groceries",
  "entertainment",
  "utilities",
  "rent",
  "other",
] as const;

// ── Gmail query to find bank/transaction emails ────────────────────────────

const GMAIL_QUERY =
  "(subject:\"debited\" OR subject:\"credited\" OR subject:\"transaction\" OR subject:\"payment\" OR subject:\"spent\" OR subject:\"purchase\" OR subject:\"UPI\" OR subject:\"NEFT\" OR subject:\"IMPS\" OR subject:\"alert\" OR from:alerts OR from:noreply@paytm.com OR from:alerts@hdfcbank.net OR from:alerts@icicibank.com OR from:alerts@axisbank.com OR from:sbiintouch@sbi.co.in OR from:kotak OR from:alerts@indusind.com) category:primary";

// ── Groq helpers ────────────────────────────────────────────────────────────

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

async function groqJSON<T>(prompt: string, key: string): Promise<T | null> {
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 200,
      }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const raw = d.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// ── Extract text from Gmail message payload ─────────────────────────────────

function extractEmailText(msg: GmailMessageDetail): string {
  const subject =
    msg.payload.headers.find((h) => h.name.toLowerCase() === "subject")?.value ?? "";
  const from =
    msg.payload.headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";

  let body = "";

  // Try plain text parts first
  const parts = msg.payload.parts ?? [];
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      body = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
      break;
    }
  }

  // Fall back to snippet
  if (!body) body = msg.snippet ?? "";

  // Trim body to avoid huge tokens
  return `From: ${from}\nSubject: ${subject}\n\n${body}`.slice(0, 1200);
}

// ── AI: decide if email is a debit/expense transaction ─────────────────────

async function extractExpenseFromEmail(
  emailText: string,
  emailDate: string,
  gmailMessageId: string,
  groqKey: string
): Promise<ExtractedExpense | null> {
  const prompt = `You are an Indian expense categorization AI specialized in UPI, NEFT, IMPS, and bank debit alert emails. Your job is to extract the expense amount, write a clean description, and assign the most accurate category.

EMAIL CONTENT:
${emailText}

EMAIL DATE: ${emailDate}

━━━ CATEGORY RULES ━━━

Use merchant name, UPI VPA (the part before @), and context clues to decide the category.

FOOD — restaurants, cafes, dhabas, bakeries, food delivery, juice bars, ice cream, street food
  Brands: Swiggy, Zomato, Blinkit (food orders), McDonald's, KFC, Domino's, Pizza Hut, Burger King, Subway, Starbucks, Cafe Coffee Day, Chaayos, Haldiram's, Bikanervala, Amul parlour, Naturals, Baskin Robbins, Wow Momo, Behrouz, Fasoos, Box8, Faasos, Oven Story, La Pino'z, Saravana Bhavan
  UPI clues: names like "hotel", "dhaba", "cafe", "kitchen", "foods", "restaurant", "snacks", "biryani", "sweets", "mithai", "juice", "chai", "tea", "bakery", "tiffin", "meals", "lunch", "dinner", "canteen"

GROCERIES — supermarkets, kirana stores, vegetables, fruits, dairy, household items, pharmacy staples
  Brands: BigBasket, Blinkit (grocery), Zepto, Swiggy Instamart, DMart, Reliance Fresh, Reliance Smart, More Supermarket, Spencer's, Nature's Basket, JioMart, Grofers, Licious, Country Delight, Milkbasket, Natures Basket, Nilgiris
  UPI clues: "kirana", "grocery", "general store", "provision", "mart", "supermarket", "vegetables", "sabzi", "fruits", "dairy", "medical store", "chemist", "pharmacy" (day-to-day items), "departmental"

TRAVEL — fuel, ride-hailing, public transport, flights, hotels, parking, tolls, cab rentals
  Brands: Ola, Uber, Rapido, InDrive, Namma Yatri, BluSmart, Meru, Redbus, IRCTC, MakeMyTrip, GoIbibo, Cleartrip, EaseMyTrip, Indigo, Air India, SpiceJet, Akasa, Indian Oil, BPCL, HP Petrol, Shell, Reliance Petrol, FASTag, NHAI, Ola Money (rides), metro card, BEST, BMTC, DTC, TSRTC
  UPI clues: "fuel", "petrol", "diesel", "pump", "garage", "cab", "auto", "travels", "tours", "parking", "toll", "airport", "station", "bus", "taxi", "rental"

ENTERTAINMENT — movies, OTT, gaming, events, sports, amusement parks, streaming
  Brands: BookMyShow, PVR, INOX, Cinepolis, Netflix, Amazon Prime, Disney+ Hotstar, SonyLIV, ZEE5, Spotify, Apple Music, YouTube Premium, JioSaavn, Gaana, Steam, PlayStation, Xbox, Dream11, MPL, WinZO, Ludo King, Paytm Games, Smaaash, Wonderla
  UPI clues: "cinema", "movies", "games", "entertainment", "club", "lounge", "pub", "bar", "event", "concert", "sports", "gym", "fitness", "bowling", "arcade"

UTILITIES — electricity, water, gas, internet, mobile recharge, DTH, insurance, EMI
  Brands: Airtel, Jio, Vi (Vodafone Idea), BSNL, Tata Sky, Dish TV, Hathway, ACT Fibernet, YOU Broadband, Indraprashtha Gas, MGL, Adani Gas, BESCOM, MSEDCL, TATA Power, CESC, Jal Board, LIC, HDFC Life, ICICI Prudential, BajajAllianz, Star Health, PhonePe Recharge, Paytm Recharge, BBPS
  UPI clues: "electricity", "ebill", "recharge", "broadband", "internet", "wifi", "gas", "water", "insurance", "premium", "emi", "loan", "dth", "cable", "bill payment"

RENT — rent, PG, hostel, accommodation payments
  UPI clues: "rent", "pg", "hostel", "accommodation", "society", "flat", "house", "maintenance", "apartment"

OTHER — use ONLY when none of the above clearly fits (e.g. bank transfers to individuals, ATM withdrawals, investment, shopping for clothes/electronics)

━━━ DESCRIPTION RULES ━━━
- Extract the merchant/payee name from the UPI VPA, reference, or email body
- For UPI: use the part BEFORE the @ in the VPA as a starting point, then clean it up
  e.g. "zomatoorders@icici" → "Zomato", "swiggy.in@icici" → "Swiggy", "rohit.sharma99@ybl" → "Rohit Sharma"
- Capitalize properly, remove numbers/special chars from names
- Max 40 characters, no bank names in description

━━━ DECISION RULES ━━━
1. Only extract DEBIT transactions (money going OUT). Look for words: "debited", "paid", "sent", "transferred to", "payment of", "spent"
2. IGNORE: credit, received, refund, cashback, reward, salary, interest credited
3. If NOT a debit expense → return: {"is_expense": false}
4. If IS a debit expense → return:
{
  "is_expense": true,
  "amount": <number, no symbols>,
  "category": <exactly one of: food, travel, groceries, entertainment, utilities, rent, other>,
  "description": <clean merchant name, max 40 chars>
}

Return ONLY valid JSON. No markdown, no explanation.`;

  const result = await groqJSON<{
    is_expense: boolean;
    amount?: number;
    category?: string;
    description?: string;
  }>(prompt, groqKey);

  if (!result || !result.is_expense) return null;
  if (
    typeof result.amount !== "number" ||
    result.amount <= 0 ||
    !result.category ||
    !VALID_CATEGORIES.includes(result.category as typeof VALID_CATEGORIES[number]) ||
    !result.description
  )
    return null;

  return {
    amount: result.amount,
    category: result.category,
    description: result.description.trim().slice(0, 100),
    date: emailDate,
    gmail_message_id: gmailMessageId,
  };
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "No auth" }, 401);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      data: { user },
      error: userError,
    } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const userId = user.id;

    // ── Get Groq API key from profiles ────────────────────────────────────
    const { data: profile } = await db
      .from("profiles")
      .select("groq_api_key")
      .eq("id", userId)
      .single();

    const groqKey = profile?.groq_api_key || Deno.env.get("GROQ_API_KEY") || "";
    if (!groqKey) return jsonResponse({ error: "No Groq API key configured" }, 400);

    // ── Get Gmail access token from request body ──────────────────────────
    const body = await req.json().catch(() => ({}));
    const gmailAccessToken: string = body.gmail_access_token;
    const sinceDateOverride: string | null = body.since_date ?? null; // YYYY-MM-DD, for first sync
    if (!gmailAccessToken) {
      return jsonResponse({ error: "gmail_access_token required" }, 400);
    }

    // ── Fetch Gmail account email for display in UI ───────────────────────
    let gmailEmail: string | null = null;
    try {
      const gmailProfileRes = await fetch(
        "https://www.googleapis.com/gmail/v1/users/me/profile",
        { headers: { Authorization: `Bearer ${gmailAccessToken}` } }
      );
      if (gmailProfileRes.ok) {
        const gp = await gmailProfileRes.json();
        gmailEmail = gp.emailAddress ?? null;
      }
    } catch { /* non-fatal */ }

    // ── Get last sync state ────────────────────────────────────────────────
    const { data: syncState } = await db
      .from("gmail_sync_state")
      .select("last_synced_at, synced_message_ids")
      .eq("user_id", userId)
      .maybeSingle();

    const lastSyncedAt: string | null = syncState?.last_synced_at ?? null;
    const syncedMessageIds: Set<string> = new Set(syncState?.synced_message_ids ?? []);

    // ── Build Gmail query with date filter ────────────────────────────────
    let gmailQuery = GMAIL_QUERY;
    if (lastSyncedAt) {
      // Subsequent sync: fetch only emails after last sync date
      const afterDate = new Date(lastSyncedAt);
      const y = afterDate.getFullYear();
      const m = String(afterDate.getMonth() + 1).padStart(2, "0");
      const d = String(afterDate.getDate()).padStart(2, "0");
      gmailQuery += ` after:${y}/${m}/${d}`;
    } else if (sinceDateOverride) {
      // First sync: user-selected start date (YYYY-MM-DD)
      const [y, m, d] = sinceDateOverride.split("-");
      gmailQuery += ` after:${y}/${m}/${d}`;
    } else {
      // First sync fallback: last 90 days
      const fallback = new Date();
      fallback.setDate(fallback.getDate() - 90);
      const y = fallback.getFullYear();
      const m = String(fallback.getMonth() + 1).padStart(2, "0");
      const d = String(fallback.getDate()).padStart(2, "0");
      gmailQuery += ` after:${y}/${m}/${d}`;
    }

    // ── Fetch ALL matching emails via pagination ───────────────────────────
    const allMessages: GmailMessage[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
      listUrl.searchParams.set("q", gmailQuery);
      listUrl.searchParams.set("maxResults", "500");
      if (pageToken) listUrl.searchParams.set("pageToken", pageToken);

      const listRes = await fetch(listUrl.toString(), {
        headers: { Authorization: `Bearer ${gmailAccessToken}` },
      });

      if (!listRes.ok) {
        const err = await listRes.text();
        return jsonResponse({ error: `Gmail API error: ${err}` }, 400);
      }

      const listData: { messages?: GmailMessage[]; nextPageToken?: string } = await listRes.json();
      allMessages.push(...(listData.messages ?? []));
      pageToken = listData.nextPageToken;
    } while (pageToken);

    const messages = allMessages;

    if (messages.length === 0) {
      await db.from("gmail_sync_state").upsert({
        user_id: userId,
        last_synced_at: new Date().toISOString(),
        synced_message_ids: Array.from(syncedMessageIds).slice(-1000),
        ...(gmailEmail ? { gmail_email: gmailEmail } : {}),
      });
      return jsonResponse({
        inserted: 0,
        skipped: 0,
        total_processed: 0,
        gmail_email: gmailEmail,
        message: "No new bank emails found since last sync.",
      });
    }

    // ── Filter out already-synced messages ────────────────────────────────
    const newMessages = messages.filter((m) => !syncedMessageIds.has(m.id));

    if (newMessages.length === 0) {
      await db.from("gmail_sync_state").upsert({
        user_id: userId,
        last_synced_at: new Date().toISOString(),
        synced_message_ids: Array.from(syncedMessageIds).slice(-1000),
        ...(gmailEmail ? { gmail_email: gmailEmail } : {}),
      });
      return jsonResponse({
        inserted: 0,
        skipped: messages.length,
        total_processed: 0,
        gmail_email: gmailEmail,
        message: "All emails already synced. No new expenses.",
      });
    }

    // ── Fetch & process each message ──────────────────────────────────────
    const expensesToInsert: Omit<ExtractedExpense, "gmail_message_id"> & {
      user_id: string;
      gmail_message_id: string;
    }[] = [];

    const processedIds: string[] = [];

    for (const msg of newMessages) {
      try {
        const detailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${gmailAccessToken}` } }
        );
        if (!detailRes.ok) continue;

        const detail: GmailMessageDetail = await detailRes.json();
        const emailText = extractEmailText(detail);
        const emailDate = new Date(Number(detail.internalDate)).toISOString();

        const expense = await extractExpenseFromEmail(emailText, emailDate, msg.id, groqKey);

        processedIds.push(msg.id);

        if (expense) {
          expensesToInsert.push({
            ...expense,
            user_id: userId,
          });
        }
      } catch {
        // Skip individual message errors
      }
    }

    // ── Insert expenses ────────────────────────────────────────────────────
    let insertedCount = 0;
    if (expensesToInsert.length > 0) {
      const { data: inserted, error: insertErr } = await db
        .from("expenses")
        .insert(
          expensesToInsert.map((e) => ({
            user_id: e.user_id,
            amount: e.amount,
            category: e.category,
            description: e.description,
            date: e.date,
            gmail_message_id: e.gmail_message_id,
          }))
        )
        .select("id");

      if (!insertErr) insertedCount = inserted?.length ?? 0;
    }

    // ── Update sync state ──────────────────────────────────────────────────
    const allSyncedIds = [
      ...Array.from(syncedMessageIds),
      ...processedIds,
    ];

    // Keep last 1000 IDs to bound storage size
    const trimmedIds = allSyncedIds.slice(-1000);

    await db.from("gmail_sync_state").upsert({
      user_id: userId,
      last_synced_at: new Date().toISOString(),
      synced_message_ids: trimmedIds,
      ...(gmailEmail ? { gmail_email: gmailEmail } : {}),
    });

    const skipped = processedIds.length - expensesToInsert.length;

    return jsonResponse({
      inserted: insertedCount,
      skipped,
      total_processed: processedIds.length,
      gmail_email: gmailEmail,
      // Return the IDs added this session so the client can revert them on undo
      processed_message_ids: processedIds,
      previous_synced_message_ids: Array.from(syncedMessageIds),
      previous_last_synced_at: lastSyncedAt,
      message:
        insertedCount > 0
          ? `Synced ${insertedCount} new expense${insertedCount > 1 ? "s" : ""} from your bank emails!`
          : "No expense transactions found in the latest emails.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});

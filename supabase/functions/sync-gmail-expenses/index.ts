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
        max_tokens: 600,
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
  const prompt = `You are an expense extraction AI. Analyze this bank/payment email and extract the expense.

Email content:
${emailText}

Email date: ${emailDate}

Categories (use ONLY these): food, travel, groceries, entertainment, utilities, rent, other
- food: restaurants, cafes, takeout, delivery, swiggy, zomato
- groceries: supermarket, vegetables, household items, blinkit, zepto
- travel: fuel, uber, ola, rapido, auto, taxi, bus, train, flights, hotels, parking, metro
- entertainment: movies, games, netflix, spotify, hotstar, hobbies, pvr
- utilities: electricity, water, gas, internet, phone bill, recharge
- rent: rent, accommodation, housing
- other: anything else including shopping, medical, transfers

IMPORTANT RULES:
1. Only extract DEBIT transactions (money going OUT from the account)
2. Ignore credit transactions, salary credits, refunds, cashbacks
3. If this is NOT a debit expense email, return: {"is_expense": false}
4. If it IS a debit expense, return:
{
  "is_expense": true,
  "amount": <positive number only, no currency symbols>,
  "category": <one of the valid categories>,
  "description": <merchant name or short description, max 50 chars>
}

Return ONLY valid JSON, no markdown.`;

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
    if (!gmailAccessToken) {
      return jsonResponse({ error: "gmail_access_token required" }, 400);
    }

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
      const afterDate = new Date(lastSyncedAt);
      // Gmail date format: after:YYYY/MM/DD
      const y = afterDate.getFullYear();
      const m = String(afterDate.getMonth() + 1).padStart(2, "0");
      const d = String(afterDate.getDate()).padStart(2, "0");
      gmailQuery += ` after:${y}/${m}/${d}`;
    } else {
      // First sync: look back 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const y = ninetyDaysAgo.getFullYear();
      const m = String(ninetyDaysAgo.getMonth() + 1).padStart(2, "0");
      const d = String(ninetyDaysAgo.getDate()).padStart(2, "0");
      gmailQuery += ` after:${y}/${m}/${d}`;
    }

    // ── Fetch email list from Gmail API ───────────────────────────────────
    const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    listUrl.searchParams.set("q", gmailQuery);
    listUrl.searchParams.set("maxResults", "50");

    const listRes = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${gmailAccessToken}` },
    });

    if (!listRes.ok) {
      const err = await listRes.text();
      return jsonResponse({ error: `Gmail API error: ${err}` }, 400);
    }

    const listData: { messages?: GmailMessage[] } = await listRes.json();
    const messages = listData.messages ?? [];

    if (messages.length === 0) {
      return jsonResponse({
        inserted: 0,
        skipped: 0,
        message: "No new bank emails found since last sync.",
      });
    }

    // ── Filter out already-synced messages ────────────────────────────────
    const newMessages = messages.filter((m) => !syncedMessageIds.has(m.id));

    if (newMessages.length === 0) {
      return jsonResponse({
        inserted: 0,
        skipped: messages.length,
        message: "All emails already synced. No new expenses.",
      });
    }

    // ── Fetch & process each message ──────────────────────────────────────
    const expensesToInsert: Omit<ExtractedExpense, "gmail_message_id"> & {
      user_id: string;
      gmail_message_id: string;
    }[] = [];

    const processedIds: string[] = [];

    // Process up to 30 messages to stay within function timeout
    const batch = newMessages.slice(0, 30);

    for (const msg of batch) {
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
    });

    const skipped = processedIds.length - expensesToInsert.length;

    return jsonResponse({
      inserted: insertedCount,
      skipped,
      total_processed: processedIds.length,
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

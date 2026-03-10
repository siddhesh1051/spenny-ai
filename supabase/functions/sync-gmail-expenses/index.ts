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
}

// ── Categories ─────────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  "food", "travel", "groceries", "entertainment", "utilities", "rent", "other",
] as const;

// ── Gmail query to find bank/transaction emails ────────────────────────────

const GMAIL_QUERY =
  "(subject:\"debited\" OR subject:\"credited\" OR subject:\"transaction\" OR subject:\"payment\" OR subject:\"spent\" OR subject:\"purchase\" OR subject:\"UPI\" OR subject:\"NEFT\" OR subject:\"IMPS\" OR subject:\"alert\" OR from:alerts OR from:noreply@paytm.com OR from:alerts@hdfcbank.net OR from:alerts@icicibank.com OR from:alerts@axisbank.com OR from:sbiintouch@sbi.co.in OR from:kotak OR from:alerts@indusind.com) category:primary";

// Max new messages to process per invocation — keeps us well inside the 150s limit
const MAX_MESSAGES_PER_SYNC = 500;

// ── Groq helpers ────────────────────────────────────────────────────────────

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// 8b-instant is ~10x faster than 70b for short classification tasks
const MODEL = "llama-3.1-8b-instant";

async function groqJSON<T>(prompt: string, key: string): Promise<T | null> {
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 120,
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

// ── Run promises in parallel chunks ─────────────────────────────────────────

async function chunk<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

// ── Extract text from Gmail message payload ─────────────────────────────────

function extractEmailText(msg: GmailMessageDetail): string {
  const subject =
    msg.payload.headers.find((h) => h.name.toLowerCase() === "subject")?.value ?? "";
  const from =
    msg.payload.headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";

  let body = "";

  const findText = (parts: typeof msg.payload.parts): string => {
    if (!parts) return "";
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
      }
      // Recurse into multipart
      if (part.parts) {
        const sub = findText(part.parts);
        if (sub) return sub;
      }
    }
    return "";
  };

  body = findText(msg.payload.parts) || msg.snippet || "";

  // Keep text short — bank alerts are short, 800 chars is plenty
  return `From: ${from}\nSubject: ${subject}\n\n${body}`.slice(0, 800);
}

// ── AI: classify a single email ─────────────────────────────────────────────

async function extractExpenseFromEmail(
  emailText: string,
  emailDate: string,
  gmailMessageId: string,
  groqKey: string
): Promise<ExtractedExpense | null> {
  const prompt = `Indian bank debit alert classifier. Extract expense if this is a DEBIT/PAYMENT alert.

EMAIL:
${emailText}
DATE: ${emailDate}

CATEGORIES (pick the best fit):
food - restaurants, cafes, dhabas, Swiggy, Zomato, food delivery, juice bars, bakeries
groceries - supermarkets, kirana, BigBasket, Zepto, DMart, Blinkit(grocery), pharmacy
travel - Ola, Uber, Rapido, fuel/petrol, IRCTC, flights, toll, parking, cab, auto
entertainment - BookMyShow, Netflix, Spotify, movies, gaming, gym, pub
utilities - Airtel, Jio, electricity, gas, insurance, EMI, DTH, recharge, water
rent - rent, PG, society maintenance, hostel, flat
other - ATM withdrawal, bank transfer to individual, investment, shopping (clothes/electronics)

UPI VPA hints: part before @ = likely merchant. Clean it up (e.g. zomatoorders@icici → Zomato, rohit.sharma99@ybl → Rohit Sharma).

RULES:
- Only extract DEBIT (debited/paid/sent/spent). Ignore: credit/received/refund/cashback/OTP/salary.
- If not a debit → {"is_expense":false}
- If debit → {"is_expense":true,"amount":<number>,"category":<one of above>,"description":<merchant name max 35 chars>}

JSON only. No markdown.`;

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

    const { data: { user }, error: userError } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);
    const userId = user.id;

    // ── Get Groq API key ──────────────────────────────────────────────────
    const { data: profile } = await db
      .from("profiles")
      .select("groq_api_key")
      .eq("id", userId)
      .single();

    const groqKey = profile?.groq_api_key || Deno.env.get("GROQ_API_KEY") || "";
    if (!groqKey) return jsonResponse({ error: "No Groq API key configured" }, 400);

    // ── Request body ──────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const gmailAccessToken: string = body.gmail_access_token;
    const sinceDateOverride: string | null = body.since_date ?? null;
    if (!gmailAccessToken) return jsonResponse({ error: "gmail_access_token required" }, 400);

    // ── Fetch Gmail profile + sync state in parallel ───────────────────────
    const [gmailProfileRes, syncStateRes] = await Promise.all([
      fetch("https://www.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${gmailAccessToken}` },
      }),
      db.from("gmail_sync_state")
        .select("last_synced_at, synced_message_ids")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    let gmailEmail: string | null = null;
    if (gmailProfileRes.ok) {
      const gp = await gmailProfileRes.json();
      gmailEmail = gp.emailAddress ?? null;
    }

    const syncState = syncStateRes.data;
    const lastSyncedAt: string | null = syncState?.last_synced_at ?? null;
    const syncedMessageIds: Set<string> = new Set(syncState?.synced_message_ids ?? []);

    // ── Build Gmail date filter ───────────────────────────────────────────
    const toGmailDate = (d: Date) =>
      `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;

    let gmailQuery = GMAIL_QUERY;
    if (lastSyncedAt) {
      gmailQuery += ` after:${toGmailDate(new Date(lastSyncedAt))}`;
    } else if (sinceDateOverride) {
      const [y, m, d] = sinceDateOverride.split("-");
      gmailQuery += ` after:${y}/${m}/${d}`;
    } else {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() - 90);
      gmailQuery += ` after:${toGmailDate(fallback)}`;
    }

    // ── Fetch ALL matching message IDs (paginated, metadata only) ─────────
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

    if (allMessages.length === 0) {
      await db.from("gmail_sync_state").upsert({
        user_id: userId,
        last_synced_at: new Date().toISOString(),
        synced_message_ids: Array.from(syncedMessageIds).slice(-1000),
        ...(gmailEmail ? { gmail_email: gmailEmail } : {}),
      });
      return jsonResponse({
        inserted: 0, skipped: 0, total_processed: 0, gmail_email: gmailEmail,
        message: "No new bank emails found since last sync.",
      });
    }

    // ── Deduplicate against already-synced IDs ────────────────────────────
    const newMessages = allMessages
      .filter((m) => !syncedMessageIds.has(m.id))
      .slice(0, MAX_MESSAGES_PER_SYNC);

    const cappedAt = newMessages.length < allMessages.filter(m => !syncedMessageIds.has(m.id)).length;

    if (newMessages.length === 0) {
      await db.from("gmail_sync_state").upsert({
        user_id: userId,
        last_synced_at: new Date().toISOString(),
        synced_message_ids: Array.from(syncedMessageIds).slice(-1000),
        ...(gmailEmail ? { gmail_email: gmailEmail } : {}),
      });
      return jsonResponse({
        inserted: 0, skipped: allMessages.length, total_processed: 0,
        gmail_email: gmailEmail, message: "All emails already synced. No new expenses.",
      });
    }

    // ── Fetch full email details in parallel batches of 25 ─────────────────
    const details = await chunk(newMessages, 25, async (msg) => {
      try {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${gmailAccessToken}` } }
        );
        if (!res.ok) return null;
        return await res.json() as GmailMessageDetail;
      } catch {
        return null;
      }
    });

    // ── Run AI classification in parallel batches of 15 ───────────────────
    // Groq's rate limit on 8b-instant is very high; 15 concurrent is safe
    type ClassifyInput = { detail: GmailMessageDetail; msgId: string };
    const toClassify: ClassifyInput[] = details
      .map((d, i) => d ? { detail: d, msgId: newMessages[i].id } : null)
      .filter((x): x is ClassifyInput => x !== null);

    const classifyResults = await chunk(toClassify, 15, async ({ detail, msgId }) => {
      try {
        const emailText = extractEmailText(detail);
        const emailDate = new Date(Number(detail.internalDate)).toISOString();
        const expense = await extractExpenseFromEmail(emailText, emailDate, msgId, groqKey);
        return { msgId, expense };
      } catch {
        return { msgId, expense: null };
      }
    });

    const processedIds = classifyResults.map((r) => r.msgId);
    const expensesToInsert = classifyResults
      .filter((r) => r.expense !== null)
      .map((r) => ({ ...r.expense!, user_id: userId }));

    // ── Insert expenses in one batch ──────────────────────────────────────
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
    const allSyncedIds = [...Array.from(syncedMessageIds), ...processedIds].slice(-1000);

    await db.from("gmail_sync_state").upsert({
      user_id: userId,
      last_synced_at: new Date().toISOString(),
      synced_message_ids: allSyncedIds,
      ...(gmailEmail ? { gmail_email: gmailEmail } : {}),
    });

    const skipped = processedIds.length - expensesToInsert.length;
    const cappedNote = cappedAt ? ` (first ${MAX_MESSAGES_PER_SYNC} emails processed — sync again for more)` : "";

    return jsonResponse({
      inserted: insertedCount,
      skipped,
      total_processed: processedIds.length,
      gmail_email: gmailEmail,
      processed_message_ids: processedIds,
      previous_synced_message_ids: Array.from(syncedMessageIds),
      previous_last_synced_at: lastSyncedAt,
      capped: cappedAt,
      message:
        insertedCount > 0
          ? `Synced ${insertedCount} new expense${insertedCount > 1 ? "s" : ""} from your bank emails!${cappedNote}`
          : `No expense transactions found in the latest emails.${cappedNote}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});

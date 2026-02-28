// Supabase Edge Function: extract-receipt
// Uses Groq Vision (llama-4-scout) to extract transactions from a receipt / payment screenshot
// Returns structured expense data + automatically saves to DB

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Convert ArrayBuffer to base64 string (Deno-safe) */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

const VALID_CATEGORIES = [
  "food", "travel", "groceries", "entertainment", "utilities", "rent", "other",
];

const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const SERVER_GROQ_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

  // ── Auth ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  // ── Get user's Groq key ──
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: profile } = await db
    .from("profiles")
    .select("groq_api_key")
    .eq("id", user.id)
    .single();

  const groqKey = profile?.groq_api_key || SERVER_GROQ_KEY;
  if (!groqKey) return json({ error: "No API key configured" }, 400);

  // ── Parse multipart form ──
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json({ error: "Expected multipart form data" }, 400);
  }

  const imageFile = formData.get("image") as File | null;
  if (!imageFile) return json({ error: "No image file in form data" }, 400);

  // Validate image type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
  if (!allowedTypes.includes(imageFile.type) && !imageFile.type.startsWith("image/")) {
    return json({ error: "Only image files are supported" }, 400);
  }

  // Limit size to 10MB
  if (imageFile.size > 10 * 1024 * 1024) {
    return json({ error: "Image too large (max 10MB)" }, 400);
  }

  console.log(`[extract-receipt] userId=${user.id} size=${imageFile.size} type=${imageFile.type}`);

  // ── Convert image to base64 data URL ──
  const buffer = await imageFile.arrayBuffer();
  const base64 = bufferToBase64(buffer);
  const mimeType = imageFile.type || "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  // ── Build Groq Vision prompt ──
  const today = new Date().toISOString().split("T")[0];

  const extractionPrompt = `You are an expense extraction AI. Extract ALL transactions from this receipt or payment screenshot.

Today's date: ${today}
Currency: Assume Indian Rupees (₹ / INR) unless another currency is clearly visible.

CATEGORIES — use EXACTLY one of these:
- food: restaurants, cafes, Swiggy, Zomato, takeout, snacks, delivery
- groceries: Big Basket, supermarket, vegetables, household items, kirana
- travel: Uber, Ola, auto, taxi, fuel, parking, flights, hotels, trains, Rapido
- entertainment: movies, Netflix, Spotify, games, events, BookMyShow
- utilities: electricity, water, gas, internet, phone bill, Jio, Airtel, BSNL
- rent: housing rent, PG, accommodation
- other: anything that doesn't fit above

EXTRACTION RULES:
1. For itemized bills: create ONE expense per meaningful line item (skip taxes/discounts as separate items, add them to the item total)
2. For single-total receipts (e.g. UPI screenshot, bank SMS): create ONE expense for the total
3. amount: final amount PAID (positive number, no currency symbols)
4. description: clean, short (max 50 chars). E.g. "Swiggy order", "Uber ride", "Big Basket"
5. date: extract visible date in YYYY-MM-DD format, or null if not visible
6. If this is clearly not a receipt/transaction (selfie, random photo, etc.) return []

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {"amount": number, "category": "string", "description": "string", "date": "YYYY-MM-DD or null"}
]`;

  // ── Call Groq Vision API ──
  let groqRaw = "";
  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
              {
                type: "text",
                text: extractionPrompt,
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 600,
      }),
    });

    if (!groqRes.ok) {
      const errBody = await groqRes.text();
      console.error("[extract-receipt] Groq error:", groqRes.status, errBody);
      return json({ error: `Vision API error: ${groqRes.status}` }, 500);
    }

    const groqData = await groqRes.json();
    groqRaw = (groqData.choices?.[0]?.message?.content ?? "")
      .replace(/```json?/g, "")
      .replace(/```/g, "")
      .trim();
  } catch (err) {
    console.error("[extract-receipt] Fetch error:", err);
    return json({ error: "Failed to call Vision API" }, 500);
  }

  // ── Parse & validate extracted expenses ──
  let parsed: Array<{
    amount: number;
    category: string;
    description: string;
    date: string | null;
  }> = [];

  try {
    parsed = JSON.parse(groqRaw);
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    console.error("[extract-receipt] JSON parse failed. Raw:", groqRaw.slice(0, 200));
    return json({
      intent: "conversation",
      text: "I couldn't read the receipt clearly. Please try a clearer, well-lit photo.",
      loggedExpenses: [],
      totalAmount: 0,
    });
  }

  const valid = parsed.filter(
    (e) =>
      typeof e.amount === "number" &&
      e.amount > 0 &&
      VALID_CATEGORIES.includes(e.category) &&
      typeof e.description === "string" &&
      e.description.trim()
  );

  if (!valid.length) {
    return json({
      intent: "conversation",
      text: "No transactions found in that image. Make sure it's a receipt, payment confirmation, or bank SMS screenshot.",
      loggedExpenses: [],
      totalAmount: 0,
    });
  }

  // ── Save to DB ──
  const toInsert = valid.map((e) => ({
    amount: e.amount,
    category: e.category,
    description: e.description.trim().slice(0, 100),
    date: e.date ? new Date(e.date).toISOString() : new Date().toISOString(),
    user_id: user.id,
  }));

  const { data: inserted, error: insertErr } = await db
    .from("expenses")
    .insert(toInsert)
    .select("id, description, category, amount");

  if (insertErr) {
    console.error("[extract-receipt] DB insert error:", insertErr);
    return json({ error: `Failed to save: ${insertErr.message}` }, 500);
  }

  const total = (inserted ?? []).reduce(
    (s: number, e: { amount: number }) => s + e.amount,
    0
  );
  const count = inserted?.length ?? 0;

  console.log(`[extract-receipt] Logged ${count} expenses, total ₹${total}`);

  return json({
    intent: "expense",
    text: `${count} expense${count !== 1 ? "s" : ""} extracted from your receipt!`,
    loggedExpenses: (inserted ?? []).map((e: {
      id: string;
      description: string;
      category: string;
      amount: number;
    }) => ({
      id: e.id,
      description: e.description,
      category: e.category,
      amount: e.amount,
    })),
    totalAmount: total,
  });
});

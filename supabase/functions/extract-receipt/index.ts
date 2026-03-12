// Supabase Edge Function: extract-receipt
// Uses Groq Vision (llama-4-scout) to extract transactions from a receipt / payment screenshot
// Returns uiResponse in the same SDK structure as sage-chat (expense intent)

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
  "Food & Dining", "Groceries", "Travel", "Entertainment", "Utilities",
  "Rent", "Shopping", "Education", "Investments", "Healthcare", "Subscriptions", "Other",
];

const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TEXT_MODEL = "llama-3.3-70b-versatile";

async function groqJSON<T>(prompt: string, key: string, temp = 0.7, tokens = 600): Promise<T | null> {
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: temp,
        max_tokens: tokens,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const UI_COMPONENT_CATALOG = `
## Available UI Components

### Layout nodes
{ "kind": "column", "children": [...] }
{ "kind": "row", "children": [...] }

### Content nodes
{ "kind": "block", "style": "subheading"|"body"|"insight", "text": "..." }
{ "kind": "collection", "text": "label", "items": [...] }

## Composition rules
- Always wrap everything in a "column" root
- Optionally add a "block" subheading before the collection
- Optionally add a brief "block" body or "insight" after (1 sentence max, encouraging)
- Do NOT add charts, tables, or summary cards
- Keep it minimal and celebratory
`.trim();

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

  // ── Get user's Groq key + currency preference ──
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: profile } = await db
    .from("profiles")
    .select("groq_api_key, currency")
    .eq("id", user.id)
    .single();

  const groqKey = profile?.groq_api_key || SERVER_GROQ_KEY;
  if (!groqKey) return json({ error: "No API key configured" }, 400);

  const userCurrency: string = profile?.currency || "INR";
  function formatCurrency(n: number): string {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency", currency: userCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `${userCurrency} ${n.toFixed(0)}`;
    }
  }

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
Currency: The user's preferred currency is ${userCurrency}. Assume that currency unless another currency is clearly visible on the receipt.

CATEGORIES — use EXACTLY one of these: Food & Dining, Groceries, Travel, Entertainment, Utilities, Rent, Shopping, Education, Investments, Healthcare, Subscriptions, Other

PRIORITY OVERRIDE RULES (apply before category matching):
1. If the merchant is a RECURRING digital service (Netflix, Spotify, Prime, Hotstar, Zee5, Apple TV+, YouTube Premium, ChatGPT, Adobe, Microsoft 365, iCloud, Google One, Notion, Dropbox, GitHub, LinkedIn Premium, Duolingo Plus, Headspace, Calm) → always "Subscriptions", even if it seems like entertainment or education.
2. If the item is a raw ingredient, packaged food, household supply, or daily-use item bought from a store (not a restaurant/cafe/delivery app) → always "Groceries", even if it could seem like food.

Category definitions with examples:
- Food & Dining: eating out, ordering food, cafes, restaurants, street food, fast food, delivery apps — Zomato, Swiggy, McDonald's, KFC, Domino's, Pizza Hut, Burger King, Subway, Starbucks, Cafe Coffee Day, Chaayos, Haldiram's, Barbeque Nation, Social, Nando's, Wow! Momo, Behrouz Biryani, Faasos, Box8, EatFit, FreshMenu, Rebel Foods, Taco Bell, Dunkin' Donuts, Baskin Robbins, Keventers, Naturals ice cream, dhabas, food court, bakery, paan shop, juice bar, tea stall, snacks outside, office canteen, hotel dining, biryani, momos, rolls, pizza, chaat
- Groceries: supermarkets, kirana stores, wholesale stores, raw produce, packaged food for home, cleaning/hygiene products, household essentials — BigBasket, Blinkit, Zepto, Dunzo, Swiggy Instamart, JioMart, DMart, More Supermarket, Star Bazaar, Nature's Basket, Reliance Fresh, Reliance Smart, Spencer's, Grofers, Milkbasket, Spar, Easyday, vegetables, fruits, milk, eggs, bread, flour, rice, dal, oil, ghee, sugar, salt, chips, biscuits, packaged snacks at home, soap, shampoo, detergent, toothpaste, toilet paper, rice cooker items, kitchen supplies
- Travel: commute, transport, fuel, ride-hailing, intercity travel, hotels/stays for travel, tolls, parking — Uber, Ola, Rapido, InDrive, BluSmart, Namma Yatri, Meru, auto-rickshaw, cab, taxi, metro, DMRC, bus, BMTC, BEST, KSRTC, MSRTC, local train, Mumbai local, IRCTC, MakeMyTrip flights, Goibibo, Ixigo, EaseMyTrip, IndiGo, Air India, SpiceJet, Vistara, Akasa Air, petrol, diesel, CNG, HP Petrol, Indian Oil, Bharat Petroleum, Fastag, toll booth, parking meter, hotel stay (for trip), OYO (travel stay), Treebo, FabHotels, Zostel, car service, bike service, driver charges
- Entertainment: leisure activities, events, gaming, hobbies, live shows, amusement — BookMyShow, Paytm Movies, PVR Cinemas, INOX, Cinepolis, movie tickets, concert tickets, comedy show, standup tickets, IPL tickets, sporting event, theme park, Wonderla, EsselWorld, gaming cafe, PlayStation, Xbox, Steam, Epic Games, Google Play Games, in-app game purchases, bowling, go-karting, paintball, escape room, clubbing, bar tab (non-food), hobby supplies (art, craft), photography gear (non-professional), fishing, trekking gear, Ludo Club, board games, lottery, CaratLane (gifting), gift items
- Utilities: recurring home bills, essential services, monthly charges tied to property — BESCOM, MSEDCL, BSES, Tata Power, electricity bill, water bill, piped gas (IGL, MGL), Airtel broadband, Jio Fiber, ACT Fibernet, BSNL, postpaid mobile bill, Airtel prepaid recharge, Vi, Jio mobile recharge, MTNL, gas cylinder (LPG — Indane, HP Gas, Bharat Gas), maintenance charges, society maintenance, water tanker, property tax, municipal tax, cable TV (Tata Sky, Dish TV, Airtel DTH, DEN Networks, Hathway)
- Rent: monthly housing rent, PG rent, hostel fees, co-living rent — NestAway, NoBroker rent, Stanza Living, OYO Rooms (long-term stay), housing.com rental, flat rent, room rent, PG charges, hostel monthly fee, co-living monthly fee, security deposit
- Shopping: buying physical goods online or offline that are not groceries — Amazon, Flipkart, Meesho, Myntra, Ajio, Nykaa, Nykaa Fashion, Tata Cliq, Snapdeal, ShopClues, Reliance Digital, Croma, Vijay Sales, Apple Store, Samsung Store, OnePlus, boAt, Noise, clothes, shoes, bags, watches, accessories, jewellery, Tanishq, Kalyan Jewellers, furniture, home decor, Ikea, Pepperfry, Urban Ladder, electronics, mobile phones, laptops, tablets, camera, headphones, kitchen appliances, personal care devices, Dyson, Philips, stationery, toys, sports equipment (offline purchase), Decathlon
- Education: learning, courses, coaching, school/college expenses, books — Unacademy, BYJU's, Vedantu, Coursera, Udemy, edX, Simplilearn, upGrad, Skill-Lync, Khan Academy, Duolingo (if one-time), school fees, tuition fees, college fees, exam fees, UPSC coaching, CAT coaching, GATE coaching, online certification, programming bootcamp, language class, music class, dance class, books (academic/textbooks), stationery for school/college, Kindle (educational book purchase), exam mock tests, NEET coaching
- Investments: money put into savings or investment instruments — Zerodha, Groww, Kuvera, ET Money, Paytm Money, INDmoney, Scripbox, Angel One, Upstox, Dhan, 5paisa, Coin by Zerodha, mutual fund SIP, lump-sum mutual fund, stocks, ETF, NPS contribution, PPF, EPF voluntary, FD (fixed deposit), RD (recurring deposit), gold fund, sovereign gold bond, REITs, cryptocurrency (WazirX, CoinDCX, CoinSwitch), LIC premium, insurance premium (non-health term/ULIP), emergency fund transfer
- Healthcare: medical, wellness, mental health, fitness — Apollo Pharmacy, MedPlus, Netmeds, 1mg, PharmEasy, Practo, doctor consultation, clinic fees, hospital bill, diagnostic tests, blood test, X-ray, MRI, Apollo Hospitals, Fortis, Max Hospital, Manipal, Aster, lab fees, medicine, prescription drugs, OTC drugs, health insurance premium (if health-specific), gym membership, Cult.fit, Curefit, Fitternity, yoga class, Zumba, CrossFit, meditation class, physiotherapy, dental checkup, eye checkup, Lenskart (prescription eyewear), menstrual hygiene products, baby care, vaccination, Ayurvedic/homeopathy treatment
- Subscriptions: recurring digital subscriptions and memberships — Netflix, Hotstar (Disney+), Amazon Prime Video, SonyLIV, Zee5, Voot, ALTBalaji, Apple TV+, YouTube Premium, Spotify, Apple Music, Gaana, JioSaavn, Wynk, Amazon Prime (full), Audible, Kindle Unlimited, Readly, Magzter, ChatGPT Plus, Claude Pro, Gemini Advanced, Copilot Pro, Adobe Creative Cloud, Canva Pro, Figma, Notion, Obsidian Sync, Todoist, Microsoft 365, Google Workspace, Apple One, iCloud+, Google One, Dropbox, OneDrive, NordVPN, ExpressVPN, Surfshark, GitHub Pro, LinkedIn Premium, Naukri subscription, Headspace, Calm, BetterMe, any annual/monthly recurring digital service fee
- Other: anything that genuinely does not fit any above category — bank charges, ATM fee, late payment fee, legal fees, visa fee, charity/donation, religious donation, home loan EMI (principal), personal loan EMI, gifts sent via bank transfer, miscellaneous, unknown expenses

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
      uiResponse: {
        layout: {
          kind: "column",
          children: [
            { kind: "block", style: "body", text: "I couldn't read the receipt clearly. Please try a clearer, well-lit photo." },
          ],
        },
      },
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
      uiResponse: {
        layout: {
          kind: "column",
          children: [
            { kind: "block", style: "subheading", text: "No transactions found" },
            { kind: "block", style: "body", text: "Make sure it's a receipt, payment confirmation, or bank SMS screenshot." },
          ],
        },
      },
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

  const rows = (inserted ?? []).map((e: {
    id: string; description: string; category: string; amount: number;
  }) => ({ id: e.id, description: e.description, category: e.category, amount: e.amount }));

  const total = rows.reduce((s: number, e: { amount: number }) => s + e.amount, 0);
  const count = rows.length;

  console.log(`[extract-receipt] Logged ${count} expenses, total ${formatCurrency(total)}`);

  const collectionNode = {
    kind: "collection",
    variant: "items",
    text: `${count} expense${count !== 1 ? "s" : ""} extracted from your receipt!`,
    items: rows.map((r: { id: string; description: string; category: string; amount: number }) => ({
      id: r.id,
      label: r.description,
      badge: r.category,
      value: formatCurrency(r.amount),
    })),
  };

  const expenseSummary = rows.map((r: { description: string; category: string; amount: number }) =>
    `- ${r.description} (${r.category}): ${formatCurrency(r.amount)}`
  ).join("\n");

  const aiLayout = await groqJSON<{ layout: unknown }>(
    `You are Spenny AI. The user just scanned a receipt and ${count} expense${count !== 1 ? "s were" : " was"} extracted, totalling ${formatCurrency(total)}.

Extracted expenses:
${expenseSummary}

${UI_COMPONENT_CATALOG}

Compose a concise confirmation UI. Rules:
- MUST include this exact collection node as one of the children (do not modify it):
${JSON.stringify(collectionNode)}
- Optionally add a "block" subheading before the collection (e.g. "1 expense extracted")
- Do NOT add a "block" with style "insight" — no Sage Insight for expense logging
- Do NOT add charts, tables, or summary cards
- Keep it minimal and celebratory
- The collection node MUST be the last child

Return ONLY valid JSON (no markdown):
{ "layout": { "kind": "column", "children": [ ...nodes including the collection node ] } }`,
    groqKey,
    0.7,
    600,
  );

  const fallbackUiResponse = {
    layout: {
      kind: "column",
      children: [
        { kind: "block", style: "subheading", text: `${count} expense${count !== 1 ? "s" : ""} logged` },
        collectionNode,
      ],
    },
  };

  return json({
    intent: "expense",
    uiResponse: aiLayout ?? fallbackUiResponse,
  });
});

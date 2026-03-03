// Supabase Edge Function: sage-chat
// Handles web chat messages from the Sage AI page
// Returns structured JSON for rich UI rendering (unlike WhatsApp which sends plain text)

import { createClient } from "npm:@supabase/supabase-js@2";

// ── CORS ─────────────────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

type Intent = "expense" | "query" | "insights" | "conversation";

interface ParsedExpense {
  amount: number;
  category: string;
  description: string;
}

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

type ChartKind = "category_pie" | "category_bar";

interface ChartConfig {
  kind: ChartKind;
  xKey: string;
  yKey: string;
  data: { name: string; value: number; percentage?: number }[];
}

// ── Groq helpers ─────────────────────────────────────────────────────────────

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

async function groqChat(prompt: string, key: string, temp = 0.7, tokens = 800): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: temp,
      max_tokens: tokens,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content ?? "";
}

async function groqJSON<T>(prompt: string, key: string, temp = 0, tokens = 400): Promise<T | null> {
  try {
    const raw = await groqChat(prompt, key, temp, tokens);
    const cleaned = raw.replace(/```json?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// ── Intent classifier ─────────────────────────────────────────────────────────

async function classifyIntent(msg: string, key: string): Promise<Intent> {
  const t = msg.trim().toLowerCase();

  // Fast path: conversation
  if (
    /^(hi|hello|hey|namaste|good\s+(morning|afternoon|evening))/i.test(t) ||
    /^(thanks?|thank\s+you|thx|ty)[\s!.,]*$/i.test(t) ||
    /^(bye|goodbye|see\s+ya|cya)[\s!.,]*$/i.test(t) ||
    /^(ok|okay|cool|great|nice|awesome|perfect)[\s!?.,]*$/i.test(t) ||
    /^what\s+(can\s+you|do\s+you|are\s+you)/i.test(t)
  ) return "conversation";

  // Fast path: expense
  if (
    /spent\s+\d+/i.test(t) ||
    /paid\s+\d+/i.test(t) ||
    /\d+\s+(on|for)\s+\w+/i.test(t) ||
    /bought\s+.+\s+for\s+\d+/i.test(t) ||
    /^\d+\s+(rs|₹|inr|rupees?)/i.test(t)
  ) return "expense";

  // Fast path: query
  if (
    /(how\s+much|total|summary|show|list|what\s+did).*(spent?|expense|cost)/i.test(t) ||
    /(where|breakdown|analysis|report).*(money|spend|expense)/i.test(t) ||
    /my\s+(food|travel|grocery|groceries|entertainment|utilities|rent)\s+expense/i.test(t)
  ) return "query";

  // Fast path: insights
  if (
    /(suggest|advice|tip|should\s+i|how\s+can|how\s+to\s+save)/i.test(t) ||
    /(save|reduce|cut|lower).*(spending|expense|cost|money)/i.test(t) ||
    /(budget|compare|vs|versus|trend|pattern|insight)/i.test(t)
  ) return "insights";

  // LLM fallback
  const reply = await groqChat(
    `Classify this message into ONE category: expense, query, insights, or conversation.
Message: "${msg}"
- expense: logging a new expense ("spent 50 on coffee", "lunch 200")
- query: asking about past spending ("show food expenses", "how much last month")
- insights: asking for advice/analysis ("save money", "compare months", "budget tips")
- conversation: greeting, thanks, general chat

Reply with ONE WORD only.`,
    key, 0, 5
  );
  const r = reply.toLowerCase().trim();
  if (r.includes("query")) return "query";
  if (r.includes("insights")) return "insights";
  if (r.includes("expense")) return "expense";
  return "conversation";
}

// ── Query filter extractor ─────────────────────────────────────────────────────

async function getQueryFilters(question: string, key: string): Promise<QueryFilters> {
  const defaults: QueryFilters = {
    start_date: null, end_date: null, category: null,
    min_amount: null, max_amount: null,
    sort_by: "date", sort_order: "desc",
    limit: 100, group_by: null, search_description: null,
  };

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const sevenAgo = new Date(now); sevenAgo.setDate(now.getDate() - 6);
  const thirtyAgo = new Date(now); thirtyAgo.setDate(now.getDate() - 29);

  const result = await groqJSON<QueryFilters>(`
Today: ${today}
This month (${now.toLocaleString("default", { month: "long", year: "numeric" })}): ${thisMonthStart} to ${today}
Last month: ${lastMDate.toISOString().split("T")[0]} to ${lastMEnd.toISOString().split("T")[0]}
Last 7 days: ${sevenAgo.toISOString().split("T")[0]} to ${today}
Last 30 days: ${thirtyAgo.toISOString().split("T")[0]} to ${today}

Extract query filters from: "${question}"
Available categories: food, travel, groceries, entertainment, utilities, rent, other

Return ONLY valid JSON (no markdown):
{
  "start_date": "YYYY-MM-DD" or null,
  "end_date": "YYYY-MM-DD" or null,
  "category": "food"|"travel"|"groceries"|"entertainment"|"utilities"|"rent"|"other" or null,
  "min_amount": number or null,
  "max_amount": number or null,
  "sort_by": "date" or "amount",
  "sort_order": "asc" or "desc",
  "limit": number (1-200, default 100),
  "group_by": "category" or "day" or "week" or "month" or null,
  "search_description": string or null
}

Rules:
- "this month" / "current month" → ${thisMonthStart} to ${today}
- "last month" → full previous month
- "this week" / "last 7 days" / "past week" → last 7 days
- "last 30 days" / "this month so far" → last 30 days
- "today" → only today
- "biggest" / "top" / "most" → sort_by=amount, sort_order=desc
- "recent" / "latest" → sort_by=date, sort_order=desc
- "by category" / "breakdown" / "most on" → group_by=category
- "per week" / "weekly" → group_by=week
- "recurring" / "subscriptions" → search_description = relevant keyword
- No date mentioned → null (fetch all)
`, key, 0, 300);

  if (!result) return defaults;
  return {
    start_date: result.start_date || null,
    end_date: result.end_date || null,
    category: result.category || null,
    min_amount: result.min_amount ?? null,
    max_amount: result.max_amount ?? null,
    sort_by: result.sort_by === "amount" ? "amount" : "date",
    sort_order: result.sort_order === "asc" ? "asc" : "desc",
    limit: Math.min(Math.max(Number(result.limit) || 100, 1), 200),
    group_by: (["category", "day", "week", "month"] as const).includes(result.group_by as never) ? result.group_by : null,
    search_description: result.search_description || null,
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

const VALID_CATEGORIES = ["food", "travel", "groceries", "entertainment", "utilities", "rent", "other"];

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const SERVER_GROQ_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

  // ── Auth ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const userId = user.id;
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── Get user's Groq key ──
  const { data: profile } = await db.from("profiles").select("groq_api_key").eq("id", userId).single();
  const groqKey = profile?.groq_api_key || SERVER_GROQ_KEY;

  if (!groqKey) {
    return jsonResponse({
      intent: "conversation",
      text: "No AI key is configured. Please add your Groq API key in Settings to start using Sage AI.",
    });
  }

  // ── Parse body ──
  let body: { message?: string };
  try { body = await req.json(); } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const message = (body.message ?? "").trim();
  if (!message) return jsonResponse({ error: "Message is required" }, 400);

  console.log(`[sage-chat] userId=${userId} message="${message.slice(0, 80)}"`);

  try {
    const intent = await classifyIntent(message, groqKey);
    console.log(`[sage-chat] intent=${intent}`);

    // ────────────────────────────────────────────────────────────────────────
    // CONVERSATION
    // ────────────────────────────────────────────────────────────────────────
    if (intent === "conversation") {
      const text = await groqChat(
        `You are Spenny AI, a friendly and smart expense tracking assistant.
Respond helpfully and concisely to: "${message}"
If asked what you can do, mention: log expenses by text, answer questions about spending history, and give financial insights.
Keep under 80 words. Plain text only, no markdown or bullet points.`,
        groqKey,
        0.8,
        150
      );

      const uiResponse = {
        layout: {
          kind: "column" as const,
          children: [
            {
              kind: "block" as const,
              style: "body" as const,
              text,
            },
          ],
        },
      };

      return jsonResponse({ intent: "conversation", uiResponse });
    }

    // ────────────────────────────────────────────────────────────────────────
    // EXPENSE
    // ────────────────────────────────────────────────────────────────────────
    if (intent === "expense") {
      const parsed = await groqJSON<ParsedExpense[]>(
        `Extract ALL expenses from this message: "${message}"

Categories (use ONLY these): food, travel, groceries, entertainment, utilities, rent, other
- food: restaurants, cafes, takeout, delivery, snacks
- groceries: supermarket, vegetables, household items
- travel: fuel, uber, auto, taxi, bus, train, flights, hotels, parking
- entertainment: movies, games, netflix, spotify, hobbies
- utilities: electricity, water, gas, internet, phone bill
- rent: rent, accommodation
- other: anything else

Return ONLY a JSON array (no markdown):
[{"amount": number, "category": string, "description": string}]

Rules:
- amount must be a positive number
- description: clean short name (max 50 chars), capitalize first letter
- Extract EVERY expense mentioned`,
        groqKey, 0.2, 500
      );

      const valid = (parsed ?? []).filter(
        (e) =>
          typeof e.amount === "number" &&
          e.amount > 0 &&
          VALID_CATEGORIES.includes(e.category) &&
          e.description?.trim()
      );

      if (!valid.length) {
        return jsonResponse({
          intent: "conversation",
          text: "I couldn't find any expenses in your message. Try something like: \"Spent 500 on groceries\" or \"Coffee 50, Uber 200\"",
        });
      }

      const toInsert = valid.map((e) => ({
        amount: e.amount,
        category: e.category,
        description: e.description.trim().slice(0, 100),
        date: new Date().toISOString(),
        user_id: userId,
      }));

      const { data: inserted, error: insertErr } = await db
        .from("expenses")
        .insert(toInsert)
        .select("id, description, category, amount");

      if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

      const rows =
        inserted?.map((e: { id: string; description: string; category: string; amount: number }) => ({
          id: e.id,
          description: e.description,
          category: e.category,
          amount: e.amount,
        })) ?? [];

      const total = rows.reduce((s: number, e) => s + e.amount, 0);

      const uiResponse = {
        layout: {
          kind: "column" as const,
          children: [
            {
              kind: "block" as const,
              style: "subheading" as const,
              text: `${rows.length} expense${rows.length > 1 ? "s" : ""} logged`,
            },
            {
              kind: "collection" as const,
              variant: "items" as const,
              text: `${rows.length} expense${rows.length > 1 ? "s" : ""} logged successfully!`,
              items: rows,
            },
          ],
        },
      };

      return jsonResponse({
        intent: "expense",
        uiResponse,
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // QUERY
    // ────────────────────────────────────────────────────────────────────────
    if (intent === "query") {
      const filters = await getQueryFilters(message, groqKey);
      console.log("[sage-chat] query filters:", JSON.stringify(filters));

      let q = db
        .from("expenses")
        .select("id, date, description, category, amount")
        .eq("user_id", userId);

      if (filters.start_date) q = q.gte("date", `${filters.start_date}T00:00:00.000Z`);
      if (filters.end_date) q = q.lte("date", `${filters.end_date}T23:59:59.999Z`);
      if (filters.category) q = q.eq("category", filters.category);
      if (filters.min_amount) q = q.gte("amount", filters.min_amount);
      if (filters.max_amount) q = q.lte("amount", filters.max_amount);
      if (filters.search_description) q = q.ilike("description", `%${filters.search_description}%`);
      q = q.order(filters.sort_by, { ascending: filters.sort_order === "asc" }).limit(filters.limit);

      const { data: expenses, error: qErr } = await q;
      if (qErr) throw new Error(`Query: ${qErr.message}`);

      if (!expenses?.length) {
        const uiResponse = {
          layout: {
            kind: "column",
            children: [
              {
                kind: "block",
                style: "subheading",
                text: "No results",
              },
              {
                kind: "block",
                style: "body",
                text: "No expenses found for that query. Start logging expenses to see them here!",
              },
            ],
          },
        };

        return jsonResponse({
          intent: "query",
          uiResponse,
        });
      }

      const totalAmount = expenses.reduce((s: number, e: { amount: number }) => s + e.amount, 0);

      // Category breakdown
      const byCat: Record<string, { total: number; count: number }> = {};
      expenses.forEach((e: { category: string; amount: number }) => {
        if (!byCat[e.category]) byCat[e.category] = { total: 0, count: 0 };
        byCat[e.category].total += e.amount;
        byCat[e.category].count += 1;
      });
      const categoryBreakdown = Object.entries(byCat)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([category, { total, count }]) => ({
          category,
          total,
          count,
          percentage: Math.round((total / totalAmount) * 100),
        }));

      // AI summary (concise)
      const sampleLines = expenses
        .slice(0, 20)
        .map((e: { date: string; category: string; description: string; amount: number }) =>
          `${new Date(e.date).toISOString().split("T")[0]} | ${e.category} | ${e.description} | ₹${e.amount}`
        )
        .join("\n");
      const catSummary = categoryBreakdown
        .map((c) => `${c.category}: ${formatINR(c.total)} (${c.count} txns, ${c.percentage}%)`)
        .join(", ");

      const summaryText = await groqChat(
        `Answer this expense question: "${message}"

Data: ${expenses.length} transactions, total ${formatINR(totalAmount)}
Categories: ${catSummary}
Sample transactions:
${sampleLines}${expenses.length > 20 ? `\n...and ${expenses.length - 20} more` : ""}

Write 2 sentences: first directly answer the question with specific numbers, second give one interesting observation or insight.
Plain text only, no markdown, no bullet points, friendly tone.`,
        groqKey, 0.7, 200
      );

      // Build title
      const parts: string[] = [];
      if (filters.category) {
        parts.push(filters.category.charAt(0).toUpperCase() + filters.category.slice(1));
      }
      if (filters.start_date) {
        const from = new Date(filters.start_date);
        const to = filters.end_date ? new Date(filters.end_date) : new Date();
        const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
        if (sameMonth) {
          parts.push(from.toLocaleString("default", { month: "long", year: "numeric" }));
        } else {
          parts.push(
            `${from.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} – ${to.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}`
          );
        }
      }
      const title = parts.length > 0
        ? `${parts.join(" · ")} expenses`
        : "Your expenses";

      const chart: ChartConfig | null =
        categoryBreakdown.length > 1
          ? {
              kind: categoryBreakdown.length <= 4 ? "category_pie" : "category_bar",
              xKey: "name",
              yKey: "value",
              data: categoryBreakdown.map((c) => ({
                name: c.category,
                value: c.total,
                percentage: c.percentage,
              })),
            }
          : null;

      const summaryMetrics = [
        {
          label: "Total",
          value: formatINR(totalAmount),
        },
        {
          label: "Transactions",
          value: String(expenses.length),
        },
        ...(filters.category
          ? [
              {
                label: "Category",
                value: filters.category.charAt(0).toUpperCase() + filters.category.slice(1),
              },
            ]
          : []),
      ];

      const expenseRows = expenses.map((
        e: { id: string; date: string; description: string; category: string; amount: number },
      ) => ({
        id: e.id,
        date: e.date,
        description: e.description,
        category: e.category,
        amount: e.amount,
      }));

      const uiResponse = {
        layout: {
          kind: "column",
          children: [
            {
              kind: "block",
              style: "subheading",
              text: title,
            },
            {
              kind: "row",
              children: summaryMetrics.map((m) => ({
                kind: "summary",
                id: m.label.toLowerCase().replace(/\s+/g, "-"),
                heading: m.label,
                primary: m.value,
                secondary: null,
                sentiment: "neutral",
              })),
            },
            chart
              ? {
                  kind: "visual",
                  variant: chart.kind === "category_pie" ? "donut" : "bars",
                  x: chart.xKey,
                  y: chart.yKey,
                  points: chart.data.map((d) => ({
                    label: d.name,
                    value: d.value,
                    share: d.percentage ?? null,
                  })),
                }
              : null,
            // Optional table of matching records, capped to 50 rows
            expenseRows.length > 0
              ? {
                  kind: "table",
                  variant: "records",
                  rows: expenseRows.slice(0, 50),
                }
              : null,
            {
              kind: "block",
              style: "insight",
              text: summaryText,
            },
          ].filter(Boolean),
        },
      };

      return jsonResponse({
        intent: "query",
        uiResponse,
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // INSIGHTS
    // ────────────────────────────────────────────────────────────────────────
    if (intent === "insights") {
      const ninetyAgo = new Date();
      ninetyAgo.setDate(ninetyAgo.getDate() - 90);

      const { data: all } = await db
        .from("expenses")
        .select("amount, category, description, date")
        .eq("user_id", userId)
        .gte("date", ninetyAgo.toISOString())
        .order("date", { ascending: false });

      const now = new Date();
      const thisM = (all ?? []).filter((e: { date: string }) => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const lastMDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastM = (all ?? []).filter((e: { date: string }) => {
        const d = new Date(e.date);
        return d.getMonth() === lastMDate.getMonth() && d.getFullYear() === lastMDate.getFullYear();
      });

      const totalThis = thisM.reduce((s: number, e: { amount: number }) => s + e.amount, 0);
      const totalLast = lastM.reduce((s: number, e: { amount: number }) => s + e.amount, 0);
      const daysSoFar = now.getDate();
      const dailyAvg = daysSoFar > 0 ? totalThis / daysSoFar : 0;
      const pct = totalLast > 0 ? Math.round(((totalThis - totalLast) / totalLast) * 100) : 0;

      // 90-day category breakdown
      const byCat90: Record<string, number> = {};
      (all ?? []).forEach((e: { category: string; amount: number }) => {
        byCat90[e.category] = (byCat90[e.category] ?? 0) + e.amount;
      });
      const topCat = Object.entries(byCat90).sort((a, b) => b[1] - a[1])[0];
      const total90 = Object.values(byCat90).reduce((s, v) => s + v, 0);

      const metrics = [
        {
          label: `${now.toLocaleString("default", { month: "long" })} Total`,
          value: formatINR(totalThis),
          change: pct !== 0 ? `${pct > 0 ? "+" : ""}${pct}% vs last month` : undefined,
          positive: pct <= 0,
        },
        {
          label: "Daily Average",
          value: formatINR(dailyAvg),
          change: `${daysSoFar} days so far`,
          positive: true,
        },
        ...(topCat
          ? [{
              label: "Top Category",
              value: topCat[0].charAt(0).toUpperCase() + topCat[0].slice(1),
              change: `${formatINR(topCat[1])} (90 days)`,
              positive: false,
            }]
          : []),
      ];

      const catBreakdown = Object.entries(byCat90)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([category, total]) => ({
          category,
          total,
          count: (all ?? []).filter((e: { category: string }) => e.category === category).length,
          percentage: total90 > 0 ? Math.round((total / total90) * 100) : 0,
        }));

      const sampleLines = (all ?? [])
        .slice(0, 15)
        .map((e: { date: string; category: string; description: string; amount: number }) =>
          `${new Date(e.date).toISOString().split("T")[0]} | ${e.category} | ${e.description} | ₹${e.amount}`
        )
        .join("\n");

      const insightText = await groqChat(
        `You are Spenny AI, a friendly financial advisor.

User question: "${message}"

Spending data (last 90 days):
- This month (${now.toLocaleString("default", { month: "long" })}): ${formatINR(totalThis)} (${thisM.length} expenses)
- Last month: ${formatINR(totalLast)} (${lastM.length} expenses)
- Change: ${pct > 0 ? "+" : ""}${pct}%
- Daily average: ${formatINR(dailyAvg)}
- Top categories: ${Object.entries(byCat90).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, a]) => `${c}: ${formatINR(a)}`).join(", ")}

Recent transactions:
${sampleLines}

Provide 2-3 actionable, specific insights. Mention real numbers from the data. Be encouraging and practical.
Plain text only, no markdown, no asterisks, no bullet points.`,
        groqKey, 0.8, 300
      );

      const chart: ChartConfig | null =
        catBreakdown.length > 1
          ? {
              kind: catBreakdown.length <= 4 ? "category_pie" : "category_bar",
              xKey: "name",
              yKey: "value",
              data: catBreakdown.map((c) => ({
                name: c.category,
                value: c.total,
                percentage: c.percentage,
              })),
            }
          : null;

      const uiResponse = {
        layout: {
          kind: "column",
          children: [
            {
              kind: "row",
              children: metrics.map((m) => ({
                kind: "summary",
                id: m.label.toLowerCase().replace(/\s+/g, "-"),
                heading: m.label,
                primary: m.value,
                secondary: m.change ?? null,
                sentiment:
                  m.positive === undefined ? "neutral" : m.positive ? "up" : "down",
              })),
            },
            {
              kind: "block",
              style: "subheading",
              text: "Spending breakdown (90 days)",
            },
            chart
              ? {
                  kind: "visual",
                  variant: chart.kind === "category_pie" ? "donut" : "bars",
                  x: chart.xKey,
                  y: chart.yKey,
                  points: chart.data.map((d) => ({
                    label: d.name,
                    value: d.value,
                    share: d.percentage ?? null,
                  })),
                }
              : null,
            {
              kind: "block",
              style: "insight",
              text: insightText,
            },
          ].filter(Boolean),
        },
      };

      return jsonResponse({
        intent: "insights",
        uiResponse,
      });
    }

    return jsonResponse({ intent: "conversation", text: "I'm here to help with your expenses!" });
  } catch (err) {
    console.error("[sage-chat] error:", err);
    return jsonResponse({
      intent: "conversation",
      text: "I ran into a hiccup — please try again!",
    });
  }
});

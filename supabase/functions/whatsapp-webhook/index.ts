// Supabase Edge Function: WhatsApp Webhook for Spenny AI
// Handles incoming WhatsApp messages and converts them to expenses
//
// Required secrets (set via `supabase secrets set`):
//   WHATSAPP_VERIFY_TOKEN    - any string you choose, must match Meta webhook config
//   WHATSAPP_TOKEN           - Meta WhatsApp Cloud API access token
//   WHATSAPP_PHONE_NUMBER_ID - your WhatsApp Business phone number ID
//   GROQ_API_KEY             - Groq API key for expense parsing

import { createClient } from "npm:@supabase/supabase-js@2";

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
    throw new Error(`Failed to get media URL: ${metaRes.status} ${err}`);
  }

  const metaData = await metaRes.json();
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
    throw new Error(`Groq Whisper error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.text || "";
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
    throw new Error(`Groq API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const responseText = data.choices?.[0]?.message?.content || "";

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
  // ── Env vars ──
  const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "";
  const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") || "";
  const WHATSAPP_PHONE_NUMBER_ID =
    Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_ROLE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── GET: Webhook verification (Meta sends this on setup) ──
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("Webhook verified successfully");
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  // ── POST: Incoming message ──
  if (req.method === "POST") {
    try {
      const body = await req.json();

      // Meta sends various webhook events; we only care about messages
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // Ignore status updates (sent, delivered, read)
      if (!value?.messages || value.messages.length === 0) {
        return new Response("OK", { status: 200 });
      }

      const message: WhatsAppMessage = value.messages[0];
      const senderPhone = normalizePhone(message.from);

      // Only handle text and audio messages
      if (message.type !== "text" && message.type !== "audio") {
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
        return new Response("OK", { status: 200 });
      }

      // ── Handle special commands ──

      // HELP command
      if (messageText.toLowerCase() === "help") {
        await sendWhatsAppReply(
          senderPhone,
          `*Spenny AI - Expense Tracker*\n\nJust text or voice note me your expenses:\n\n• "Spent 50 on coffee"\n• "Paid 200 for groceries and 100 for petrol"\n• "Lunch 150, auto 30, movie tickets 500"\n• 🎙️ Send a voice note with your expenses!\n\nCommands:\n• *help* - Show this message\n• *today* - Show today's expenses\n• *total* - Show this month's total`,
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

      // ── TODAY command ──
      if (messageText.toLowerCase() === "today") {
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

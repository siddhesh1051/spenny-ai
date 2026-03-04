// Supabase Edge Function: transcribe-audio
// Accepts a voice recording (multipart form), forwards to Groq Whisper, returns transcript

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

  // ── Parse audio from multipart form ──
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json({ error: "Expected multipart form data" }, 400);
  }

  const audioFile = formData.get("audio") as File | null;
  if (!audioFile) return json({ error: "No audio file in form data" }, 400);

  console.log(`[transcribe-audio] userId=${user.id} size=${audioFile.size} type=${audioFile.type}`);

  // ── Call Groq Whisper ──
  const groqForm = new FormData();
  // Groq requires a filename to detect format — use webm for browser recordings
  groqForm.append("file", audioFile, "voice.webm");
  groqForm.append("model", "whisper-large-v3-turbo");
  groqForm.append("language", "en");
  groqForm.append("response_format", "json");

  const whisperRes = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: groqForm,
    }
  );

  if (!whisperRes.ok) {
    const errBody = await whisperRes.text();
    console.error("[transcribe-audio] Whisper error:", whisperRes.status, errBody);
    return json({ error: `Transcription failed: ${whisperRes.status}` }, 500);
  }

  const whisperData = await whisperRes.json();
  const transcript = (whisperData?.text ?? "").trim();

  console.log(`[transcribe-audio] transcript length=${transcript.length}`);
  return json({ transcript });
});

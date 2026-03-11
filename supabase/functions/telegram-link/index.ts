// Supabase Edge Function: telegram-link
// Generates a one-time deep-link token for connecting Telegram to a Spenny AI account.
// Also handles status checks (polling from frontend).

import { createClient } from "npm:@supabase/supabase-js@2";

function generateToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  // SUPABASE_ANON_KEY is injected automatically by Supabase as "ANON_KEY"
  const ANON_KEY = Deno.env.get("ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Supabase not configured" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Service-role client for DB writes; anon client for JWT validation
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);

  // Auth check — validate user JWT with the anon/public client
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "").trim();
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(jwt);
  if (authError || !user) {
    console.error("Auth error:", authError?.message);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const url = new URL(req.url);

  // ── GET ?action=status — check if Telegram is already linked ──
  if (req.method === "GET" && url.searchParams.get("action") === "status") {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("telegram_chat_id")
      .eq("id", user.id)
      .single();

    return new Response(
      JSON.stringify({ linked: !!(profile?.telegram_chat_id) }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // ── POST — generate a new link token ──
  if (req.method === "POST") {
    // Delete any existing unused tokens for this user
    await supabaseAdmin
      .from("telegram_link_tokens")
      .delete()
      .eq("user_id", user.id)
      .eq("used", false);

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const { error: insertError } = await supabaseAdmin
      .from("telegram_link_tokens")
      .insert({ user_id: user.id, token, expires_at: expiresAt.toISOString(), used: false });

    if (insertError) {
      console.error("Error inserting link token:", insertError);
      return new Response(JSON.stringify({ error: `Failed to generate link token: ${insertError.message}` }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const TELEGRAM_BOT_USERNAME = Deno.env.get("TELEGRAM_BOT_USERNAME") ?? "SpennyAIBot";

    return new Response(
      JSON.stringify({
        token,
        deepLink: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`,
        expiresAt: expiresAt.toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // ── DELETE — unlink Telegram ──
  if (req.method === "DELETE") {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ telegram_chat_id: null, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to unlink Telegram" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});

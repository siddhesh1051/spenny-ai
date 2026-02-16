// Supabase Edge Function: Verify WhatsApp OTP
// Verifies OTP and saves WhatsApp phone to profile

import { createClient } from "npm:@supabase/supabase-js@2";

interface VerifyOTPRequest {
  phone: string;
  otp: string;
  userId: string;
}

/** Normalize phone to digits only */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

Deno.serve(async (req: Request) => {
  // CORS headers for all responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  console.log("[verify-whatsapp-otp]", req.method, req.url);

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { 
        status: 405, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        } 
      }
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Supabase not configured" }),
      { 
        status: 500, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        } 
      }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body: VerifyOTPRequest = await req.json();
    const { phone, otp, userId } = body;

    if (!phone || !otp || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing phone, otp, or userId" }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    const normalizedPhone = normalizePhone(phone);

    // Fetch OTP record
    const { data: otpRecord, error: fetchError } = await supabase
      .from("whatsapp_otps")
      .select("*")
      .eq("user_id", userId)
      .eq("phone", normalizedPhone)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching OTP:", fetchError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    if (!otpRecord) {
      return new Response(
        JSON.stringify({ error: "No OTP found. Please request a new code." }),
        { 
          status: 404, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    // Check if OTP is expired
    const now = new Date();
    const expiresAt = new Date(otpRecord.expires_at);
    if (now > expiresAt) {
      // Delete expired OTP
      await supabase
        .from("whatsapp_otps")
        .delete()
        .eq("user_id", userId)
        .eq("phone", normalizedPhone);

      return new Response(
        JSON.stringify({ error: "OTP expired. Please request a new code." }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      return new Response(
        JSON.stringify({ error: "Invalid OTP. Please check and try again." }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    // OTP is valid - update profile with WhatsApp phone
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        whatsapp_phone: normalizedPhone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save WhatsApp number" }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    // Mark OTP as verified
    await supabase
      .from("whatsapp_otps")
      .update({ verified: true })
      .eq("user_id", userId)
      .eq("phone", normalizedPhone);

    // Delete old OTP records for this user
    await supabase
      .from("whatsapp_otps")
      .delete()
      .eq("user_id", userId)
      .neq("phone", normalizedPhone);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "WhatsApp number verified and saved successfully",
        phone: normalizedPhone
      }),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        } 
      }
    );

  } catch (error: any) {
    console.error("Error in verify-whatsapp-otp:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { 
        status: 500, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        } 
      }
    );
  }
});

// Supabase Edge Function: Send WhatsApp OTP
// Sends a 4-digit OTP to verify WhatsApp number before saving

import { createClient } from "npm:@supabase/supabase-js@2";

interface SendOTPRequest {
  phone: string; // E.164 format without +
  userId: string;
}

interface OTPRecord {
  phone: string;
  otp: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  verified: boolean;
}

/** Normalize phone to digits only */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Generate 4-digit OTP */
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/** Send WhatsApp message via Meta Graph API */
async function sendWhatsAppMessage(
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
    throw new Error(`Failed to send WhatsApp message: ${res.status}`);
  }

  console.log("WhatsApp OTP sent to", to);
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

  console.log("[send-whatsapp-otp]", req.method, req.url);

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

  // Get environment variables
  const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
  const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return new Response(
      JSON.stringify({ error: "WhatsApp API not configured" }),
      { 
        status: 500, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        } 
      }
    );
  }

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
    const body: SendOTPRequest = await req.json();
    const { phone, userId } = body;

    if (!phone || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing phone or userId" }),
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

    if (normalizedPhone.length < 10) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number" }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    // Test/Demo wildcard: Skip actual OTP sending for test number
    if (normalizedPhone === "919999999999") {
      // Return success without sending actual WhatsApp message or storing OTP
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "OTP sent successfully (test mode)",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        }),
        { 
          status: 200, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    // Check if phone already exists for another user
    const { data: existingProfile, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("whatsapp_phone", normalizedPhone)
      .neq("id", userId)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing phone:", checkError);
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

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "This WhatsApp number is already linked to another account" }),
        { 
          status: 409, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    const otpRecord: Omit<OTPRecord, "created_at"> = {
      phone: normalizedPhone,
      otp,
      user_id: userId,
      expires_at: expiresAt.toISOString(),
      verified: false,
    };

    // Delete any existing unverified OTPs for this user
    await supabase
      .from("whatsapp_otps")
      .delete()
      .eq("user_id", userId)
      .eq("verified", false);

    // Insert new OTP
    const { error: insertError } = await supabase
      .from("whatsapp_otps")
      .insert(otpRecord);

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    // Send OTP via WhatsApp
    const message = `🔐 Your Spenny AI verification code is: *${otp}*\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this message.`;

    try {
      await sendWhatsAppMessage(
        normalizedPhone,
        message,
        WHATSAPP_PHONE_NUMBER_ID,
        WHATSAPP_TOKEN
      );
    } catch (whatsappError) {
      console.error("WhatsApp send error:", whatsappError);
      // Delete the OTP record if WhatsApp send failed
      await supabase
        .from("whatsapp_otps")
        .delete()
        .eq("user_id", userId)
        .eq("phone", normalizedPhone);

      return new Response(
        JSON.stringify({ error: "Failed to send OTP via WhatsApp" }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP sent successfully",
        expiresAt: expiresAt.toISOString()
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
    console.error("Error in send-whatsapp-otp:", error);
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

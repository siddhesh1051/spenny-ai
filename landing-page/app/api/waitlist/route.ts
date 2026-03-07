import { NextRequest, NextResponse } from "next/server";

// ── Guard: ensure env vars are present at boot, not at request time ──────────
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME ?? "Waitlist";

// Simple in-memory rate limiter: max 3 submissions per IP per 15 minutes.
// This is per-instance; for multi-instance deploys, use Upstash/Redis.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

// Basic email regex — good enough to block garbage without false-positives
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function sanitize(val: unknown, maxLen: number): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxLen);
}

export async function POST(req: NextRequest) {
  // ── Env guard ────────────────────────────────────────────────────────────
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error("Waitlist: AIRTABLE_API_KEY or AIRTABLE_BASE_ID not configured.");
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": "900" },
      }
    );
  }

  // ── Parse & sanitize body ────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = sanitize(body.email, 254);
  const mobile = sanitize(body.mobile, 20);
  const referral = sanitize(body.referral, 100);
  const interestedInPro = body.interestedInPro === true;

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  // ── Submit to Airtable ───────────────────────────────────────────────────
  try {
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            Email: email,
            ...(mobile ? { Mobile: mobile } : {}),
            ...(referral ? { "How did you hear about us": referral } : {}),
            "Interested in Pro": interestedInPro,
          },
        }),
      }
    );

    if (!airtableRes.ok) {
      // Log the raw Airtable error server-side; never expose it to the client
      const errText = await airtableRes.text();
      console.error("Airtable POST error:", airtableRes.status, errText);
      return NextResponse.json(
        { error: "Failed to join waitlist. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error("Waitlist API unexpected error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

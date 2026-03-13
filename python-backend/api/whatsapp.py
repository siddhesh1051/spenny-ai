"""WhatsApp OTP and webhook endpoints."""

from __future__ import annotations

import logging
import os
import random
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.http import async_client
from pydantic import BaseModel

from auth.supabase_jwt import get_current_user
from db.client import get_admin_client

logger = logging.getLogger(__name__)
router = APIRouter()


def _normalize_phone(phone: str) -> str:
    return re.sub(r"\D", "", phone)


def _generate_otp() -> str:
    return str(random.randint(1000, 9999))


async def _send_whatsapp_text(to: str, text: str) -> None:
    token = os.environ.get("WHATSAPP_TOKEN", "")
    phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
    url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
    async with async_client(timeout=30) as client:
        r = await client.post(
            url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": text}},
        )
        if not r.is_success:
            raise HTTPException(status_code=500, detail=f"WhatsApp send failed: {r.status_code}")


# ── Send OTP ──────────────────────────────────────────────────────────────────

class SendOTPRequest(BaseModel):
    phone: str
    userId: str


@router.post("/whatsapp/otp/send")
async def send_whatsapp_otp(body: SendOTPRequest) -> dict:
    token = os.environ.get("WHATSAPP_TOKEN", "")
    phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
    if not token or not phone_id:
        raise HTTPException(status_code=500, detail="WhatsApp API not configured")

    phone = _normalize_phone(body.phone)
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    # Test/demo wildcard
    if phone == "919999999999":
        return {
            "success": True,
            "message": "OTP sent successfully (test mode)",
            "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        }

    db = get_admin_client()

    # Check duplicate phone
    existing = (
        db.table("profiles")
        .select("id")
        .eq("whatsapp_phone", phone)
        .neq("id", body.userId)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="This WhatsApp number is already linked to another account")

    otp = _generate_otp()
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()

    # Delete old OTPs
    db.table("whatsapp_otps").delete().eq("user_id", body.userId).eq("verified", False).execute()

    db.table("whatsapp_otps").insert({
        "phone": phone,
        "otp": otp,
        "user_id": body.userId,
        "expires_at": expires_at,
        "verified": False,
    }).execute()

    message = f"🔐 Your Spenny AI verification code is: *{otp}*\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this message."

    try:
        await _send_whatsapp_text(phone, message)
    except Exception as exc:
        db.table("whatsapp_otps").delete().eq("user_id", body.userId).eq("phone", phone).execute()
        raise HTTPException(status_code=500, detail="Failed to send OTP via WhatsApp") from exc

    return {"success": True, "message": "OTP sent successfully", "expiresAt": expires_at}


# ── Verify OTP ────────────────────────────────────────────────────────────────

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str
    userId: str


@router.post("/whatsapp/otp/verify")
async def verify_whatsapp_otp(body: VerifyOTPRequest) -> dict:
    phone = _normalize_phone(body.phone)
    db = get_admin_client()

    # Test wildcard
    if phone == "919999999999" and body.otp == "0007":
        db.table("profiles").update({"whatsapp_phone": phone, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", body.userId).execute()
        return {"success": True, "message": "WhatsApp number verified (test mode)", "phone": phone}

    record = (
        db.table("whatsapp_otps")
        .select("*")
        .eq("user_id", body.userId)
        .eq("phone", phone)
        .eq("verified", False)
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )

    if not record.data:
        raise HTTPException(status_code=404, detail="No OTP found. Please request a new code.")

    otp_record = record.data
    if datetime.now(timezone.utc) > datetime.fromisoformat(otp_record["expires_at"].replace("Z", "+00:00")):
        db.table("whatsapp_otps").delete().eq("user_id", body.userId).eq("phone", phone).execute()
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new code.")

    if otp_record["otp"] != body.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP. Please check and try again.")

    db.table("profiles").update({"whatsapp_phone": phone, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", body.userId).execute()
    db.table("whatsapp_otps").update({"verified": True}).eq("user_id", body.userId).eq("phone", phone).execute()
    db.table("whatsapp_otps").delete().eq("user_id", body.userId).neq("phone", phone).execute()

    return {"success": True, "message": "WhatsApp number verified and saved successfully", "phone": phone}


# ── Webhook (incoming WhatsApp messages) ─────────────────────────────────────

@router.get("/whatsapp/webhook")
async def whatsapp_webhook_verify(request: Request) -> Response:
    """Meta webhook verification challenge."""
    params = dict(request.query_params)
    verify_token = os.environ.get("WHATSAPP_VERIFY_TOKEN", "")
    if params.get("hub.verify_token") == verify_token:
        return Response(content=params.get("hub.challenge", ""), media_type="text/plain")
    raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/whatsapp/webhook")
async def whatsapp_webhook_receive(request: Request) -> dict:
    """
    Handle incoming WhatsApp messages.
    The full WhatsApp bot logic (expense, query, insights, export) is handled here.
    This is a pass-through that processes the webhook and calls the existing logic.
    """
    try:
        body = await request.json()
        # Extract the message from the WhatsApp webhook payload
        entry = (body.get("entry") or [{}])[0]
        changes = (entry.get("changes") or [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])

        if not messages:
            return {"status": "ok"}

        msg = messages[0]
        from_phone = msg.get("from", "")
        msg_type = msg.get("type", "")

        db = get_admin_client()

        # Look up user by phone
        profile_result = (
            db.table("profiles")
            .select("id, groq_api_key, currency")
            .eq("whatsapp_phone", from_phone)
            .maybe_single()
            .execute()
        )
        if not profile_result.data:
            logger.info("WhatsApp msg from unlinked phone: %s", from_phone)
            return {"status": "ok"}

        profile = profile_result.data
        user_id = profile["id"]
        groq_key = profile.get("groq_api_key") or os.environ.get("GROQ_API_KEY", "")
        currency = profile.get("currency") or "INR"

        # Handle text messages
        if msg_type == "text":
            text = msg.get("text", {}).get("body", "").strip()
            if not text:
                return {"status": "ok"}

            # Import and run the WhatsApp-specific handler (reuse existing logic)
            await _handle_whatsapp_text(from_phone, text, user_id, groq_key, currency, db)

        # Handle voice messages
        elif msg_type == "audio":
            audio_id = msg.get("audio", {}).get("id", "")
            if audio_id and groq_key:
                await _handle_whatsapp_audio(from_phone, audio_id, user_id, groq_key, currency, db)

        return {"status": "ok"}
    except Exception as exc:
        logger.exception("WhatsApp webhook error: %s", exc)
        return {"status": "ok"}  # Always 200 to Meta


async def _handle_whatsapp_text(
    phone: str, text: str, user_id: str, groq_key: str, currency: str, db
) -> None:
    """Process text message and send WhatsApp reply."""
    from agent.nodes.classifier import classify_intent
    from agent.nodes.expense import handle_expense
    from agent.nodes.query import handle_query
    from agent.nodes.insights import handle_insights

    intent = await classify_intent(text, groq_key)

    if intent == "expense":
        result = await handle_expense(text, user_id, groq_key, currency)
        # Convert UI response to plain text for WhatsApp
        items = result.get("uiResponse", {}).get("layout", {}).get("children", [])
        collection = next((c for c in items if isinstance(c, dict) and c.get("kind") == "collection"), None)
        if collection:
            count = len(collection.get("items", []))
            total = sum(i.get("amount", 0) for i in collection.get("items", []))
            reply = f"✅ {count} expense{'s' if count > 1 else ''} logged! Total: {currency} {total:,.0f}\n"
            for item in collection.get("items", []):
                reply += f"  • {item['description']} ({item['category']}): {currency} {item['amount']:,.0f}\n"
        else:
            reply = result.get("text", "Expenses logged!")
    elif intent == "query":
        result = await handle_query(text, user_id, groq_key, currency)
        # Extract insight text for WhatsApp
        children = result.get("uiResponse", {}).get("layout", {}).get("children", [])
        insight = next((c.get("text", "") for c in children if isinstance(c, dict) and c.get("style") == "insight"), "")
        summaries = [c for c in children if isinstance(c, dict) and c.get("kind") == "row"]
        reply = insight or "Here's your spending summary!"
    elif intent == "insights":
        result = await handle_insights(text, user_id, groq_key, currency)
        children = result.get("uiResponse", {}).get("layout", {}).get("children", [])
        insight = next((c.get("text", "") for c in children if isinstance(c, dict) and c.get("style") == "insight"), "")
        reply = insight or "Here are your spending insights!"
    else:
        reply = "👋 Hi! I can help you log expenses, check your spending, or give insights. Try: \"Spent 200 on coffee\" or \"Show last month's expenses\"."

    await _send_whatsapp_text(phone, reply)


async def _handle_whatsapp_audio(
    phone: str, audio_id: str, user_id: str, groq_key: str, currency: str, db
) -> None:
    """Download WhatsApp audio, transcribe, then process as text."""
    token = os.environ.get("WHATSAPP_TOKEN", "")
    try:
        async with async_client(timeout=30) as client:
            meta_r = await client.get(
                f"https://graph.facebook.com/v21.0/{audio_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            meta = meta_r.json()
            audio_r = await client.get(meta["url"], headers={"Authorization": f"Bearer {token}"})
            audio_bytes = audio_r.content
            mime = meta.get("mime_type", "audio/ogg")

        async with async_client(timeout=60) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {groq_key}"},
                files={"file": ("voice.ogg", audio_bytes, mime)},
                data={"model": "whisper-large-v3-turbo", "language": "en", "response_format": "json"},
            )
            transcript = r.json().get("text", "").strip()

        if transcript:
            await _handle_whatsapp_text(phone, transcript, user_id, groq_key, currency, db)
        else:
            await _send_whatsapp_text(phone, "Sorry, I couldn't understand the audio. Please try again.")
    except Exception as exc:
        logger.exception("WhatsApp audio processing failed: %s", exc)
        await _send_whatsapp_text(phone, "Sorry, I couldn't process your voice message.")

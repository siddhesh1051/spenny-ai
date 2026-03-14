"""WhatsApp OTP and webhook endpoints.

Incoming messages are processed through the same agentic LangGraph pipeline
as the web chat, but with channel="whatsapp" so that respond agents produce
plain-text replies instead of UI JSON.
"""

from __future__ import annotations

import base64
import logging
import os
import random
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from agent.graph import receipt_graph, sage_graph
from auth.supabase_jwt import get_current_user
from db.client import get_admin_client
from utils.http import async_client

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
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"body": text},
            },
        )
        if not r.is_success:
            raise HTTPException(
                status_code=500, detail=f"WhatsApp send failed: {r.status_code}"
            )


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

    if phone == "919999999999":
        return {
            "success": True,
            "message": "OTP sent successfully (test mode)",
            "expiresAt": (
                datetime.now(timezone.utc) + timedelta(minutes=10)
            ).isoformat(),
        }

    db = get_admin_client()

    existing = (
        db.table("profiles")
        .select("id")
        .eq("whatsapp_phone", phone)
        .neq("id", body.userId)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail="This WhatsApp number is already linked to another account",
        )

    otp = _generate_otp()
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()

    db.table("whatsapp_otps").delete().eq("user_id", body.userId).eq(
        "verified", False
    ).execute()

    db.table("whatsapp_otps").insert(
        {
            "phone": phone,
            "otp": otp,
            "user_id": body.userId,
            "expires_at": expires_at,
            "verified": False,
        }
    ).execute()

    message = (
        f"Your Spenny AI verification code is: *{otp}*\n\n"
        "This code will expire in 10 minutes.\n\n"
        "If you didn't request this code, please ignore this message."
    )

    try:
        await _send_whatsapp_text(phone, message)
    except Exception as exc:
        db.table("whatsapp_otps").delete().eq("user_id", body.userId).eq(
            "phone", phone
        ).execute()
        raise HTTPException(
            status_code=500, detail="Failed to send OTP via WhatsApp"
        ) from exc

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

    if phone == "919999999999" and body.otp == "0007":
        db.table("profiles").update(
            {
                "whatsapp_phone": phone,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", body.userId).execute()
        return {
            "success": True,
            "message": "WhatsApp number verified (test mode)",
            "phone": phone,
        }

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
        raise HTTPException(
            status_code=404, detail="No OTP found. Please request a new code."
        )

    otp_record = record.data
    if datetime.now(timezone.utc) > datetime.fromisoformat(
        otp_record["expires_at"].replace("Z", "+00:00")
    ):
        db.table("whatsapp_otps").delete().eq("user_id", body.userId).eq(
            "phone", phone
        ).execute()
        raise HTTPException(
            status_code=400, detail="OTP expired. Please request a new code."
        )

    if otp_record["otp"] != body.otp:
        raise HTTPException(
            status_code=400, detail="Invalid OTP. Please check and try again."
        )

    db.table("profiles").update(
        {
            "whatsapp_phone": phone,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", body.userId).execute()
    db.table("whatsapp_otps").update({"verified": True}).eq(
        "user_id", body.userId
    ).eq("phone", phone).execute()
    db.table("whatsapp_otps").delete().eq("user_id", body.userId).neq(
        "phone", phone
    ).execute()

    return {
        "success": True,
        "message": "WhatsApp number verified and saved successfully",
        "phone": phone,
    }


# ── Webhook (incoming WhatsApp messages) ──────────────────────────────────────


@router.get("/whatsapp/webhook")
async def whatsapp_webhook_verify(request: Request) -> Response:
    """Meta webhook verification challenge."""
    params = dict(request.query_params)
    verify_token = os.environ.get("WHATSAPP_VERIFY_TOKEN", "")
    if params.get("hub.verify_token") == verify_token:
        return Response(
            content=params.get("hub.challenge", ""), media_type="text/plain"
        )
    raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/whatsapp/webhook")
async def whatsapp_webhook_receive(request: Request) -> dict:
    """Handle incoming WhatsApp messages through the agentic pipeline."""
    try:
        body = await request.json()
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

        if msg_type == "text":
            text = msg.get("text", {}).get("body", "").strip()
            if not text:
                return {"status": "ok"}
            await _handle_whatsapp_message(
                from_phone, text, user_id, groq_key, currency
            )

        elif msg_type == "audio":
            audio_id = msg.get("audio", {}).get("id", "")
            if audio_id and groq_key:
                await _handle_whatsapp_audio(
                    from_phone, audio_id, user_id, groq_key, currency
                )

        elif msg_type == "image":
            image_id = msg.get("image", {}).get("id", "")
            if image_id and groq_key:
                await _handle_whatsapp_image(
                    from_phone, image_id, user_id, groq_key, currency
                )

        return {"status": "ok"}
    except Exception as exc:
        logger.exception("WhatsApp webhook error: %s", exc)
        return {"status": "ok"}


async def _handle_whatsapp_message(
    phone: str,
    text: str,
    user_id: str,
    groq_key: str,
    currency: str,
) -> None:
    """Process text through the agentic graph with channel=whatsapp."""
    thread_id = f"wa-{phone}"
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "messages": [HumanMessage(content=text)],
        "user_id": user_id,
        "groq_key": groq_key,
        "currency": currency,
        "channel": "whatsapp",
        "intent": "",
        "result": {},
    }

    try:
        text_response = ""
        async for chunk in sage_graph.astream(initial_state, config=config):
            for _node_name, node_output in chunk.items():
                if isinstance(node_output, dict):
                    if node_output.get("text_response"):
                        text_response = node_output["text_response"]
                    elif node_output.get("result", {}).get("text"):
                        text_response = node_output["result"]["text"]

        if not text_response:
            text_response = (
                "I can help you log expenses, check your spending, or give insights. "
                'Try: "Spent 200 on coffee" or "Show last month\'s expenses".'
            )

        await _send_whatsapp_text(phone, text_response)
    except Exception as exc:
        logger.exception("WhatsApp message processing failed: %s", exc)
        await _send_whatsapp_text(
            phone, "Sorry, something went wrong. Please try again."
        )


async def _handle_whatsapp_audio(
    phone: str,
    audio_id: str,
    user_id: str,
    groq_key: str,
    currency: str,
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
            audio_r = await client.get(
                meta["url"], headers={"Authorization": f"Bearer {token}"}
            )
            audio_bytes = audio_r.content
            mime = meta.get("mime_type", "audio/ogg")

        async with async_client(timeout=60) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {groq_key}"},
                files={"file": ("voice.ogg", audio_bytes, mime)},
                data={
                    "model": "whisper-large-v3-turbo",
                    "language": "en",
                    "response_format": "json",
                },
            )
            transcript = r.json().get("text", "").strip()

        if transcript:
            await _handle_whatsapp_message(
                phone, transcript, user_id, groq_key, currency
            )
        else:
            await _send_whatsapp_text(
                phone, "Sorry, I couldn't understand the audio. Please try again."
            )
    except Exception as exc:
        logger.exception("WhatsApp audio processing failed: %s", exc)
        await _send_whatsapp_text(
            phone, "Sorry, I couldn't process your voice message."
        )


async def _handle_whatsapp_image(
    phone: str,
    image_id: str,
    user_id: str,
    groq_key: str,
    currency: str,
) -> None:
    """Download WhatsApp image, run through the receipt agentic pipeline."""
    token = os.environ.get("WHATSAPP_TOKEN", "")
    try:
        async with async_client(timeout=30) as client:
            meta_r = await client.get(
                f"https://graph.facebook.com/v21.0/{image_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            meta = meta_r.json()
            img_r = await client.get(
                meta["url"], headers={"Authorization": f"Bearer {token}"}
            )
            image_bytes = img_r.content
            mime = meta.get("mime_type", "image/jpeg")

        b64 = base64.b64encode(image_bytes).decode()
        data_url = f"data:{mime};base64,{b64}"

        thread_id = f"wa-receipt-{phone}"
        config = {"configurable": {"thread_id": thread_id}}

        initial_state = {
            "messages": [HumanMessage(content="[receipt image]")],
            "user_id": user_id,
            "groq_key": groq_key,
            "currency": currency,
            "channel": "whatsapp",
            "intent": "receipt",
            "receipt_image_url": data_url,
            "result": {},
        }

        text_response = ""
        async for chunk in receipt_graph.astream(initial_state, config=config):
            for _node_name, node_output in chunk.items():
                if isinstance(node_output, dict):
                    if node_output.get("text_response"):
                        text_response = node_output["text_response"]
                    elif node_output.get("result", {}).get("text"):
                        text_response = node_output["result"]["text"]

        if not text_response:
            text_response = "I couldn't read the receipt. Please try a clearer photo."

        await _send_whatsapp_text(phone, text_response)
    except Exception as exc:
        logger.exception("WhatsApp image processing failed: %s", exc)
        await _send_whatsapp_text(
            phone, "Sorry, I couldn't process the image. Please try again."
        )

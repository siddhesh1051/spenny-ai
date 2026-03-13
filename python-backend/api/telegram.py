"""Telegram link and webhook endpoints."""

from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from utils.http import async_client
from pydantic import BaseModel

from auth.supabase_jwt import get_current_user
from db.client import get_admin_client

logger = logging.getLogger(__name__)
router = APIRouter()


async def _send_telegram_message(chat_id: int, text: str, parse_mode: str = "Markdown") -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    async with async_client(timeout=30) as client:
        await client.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": parse_mode},
        )


# ── GET ?action=status ─────────────────────────────────────────────────────────

@router.get("/telegram/link")
async def telegram_link_status(
    action: Optional[str] = None,
    user: dict = Depends(get_current_user),
) -> dict:
    if action != "status":
        raise HTTPException(status_code=400, detail="Use action=status for GET, or POST to generate link")

    user_id: str = user["sub"]
    db = get_admin_client()
    profile = db.table("profiles").select("telegram_chat_id").eq("id", user_id).single().execute()
    linked = bool(profile.data and profile.data.get("telegram_chat_id"))
    return {"linked": linked}


# ── POST — generate link token ──────────────────────────────────────────────

@router.post("/telegram/link")
async def telegram_link_generate(
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()

    # Delete unused tokens
    db.table("telegram_link_tokens").delete().eq("user_id", user_id).eq("used", False).execute()

    token = secrets.token_hex(16)
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()

    db.table("telegram_link_tokens").insert({
        "user_id": user_id,
        "token": token,
        "expires_at": expires_at,
        "used": False,
    }).execute()

    bot_username = os.environ.get("TELEGRAM_BOT_USERNAME", "SpennyAIBot")
    return {
        "token": token,
        "deepLink": f"https://t.me/{bot_username}?start={token}",
        "expiresAt": expires_at,
    }


# ── DELETE — unlink Telegram ──────────────────────────────────────────────────

@router.delete("/telegram/link")
async def telegram_link_delete(
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()
    db.table("profiles").update({"telegram_chat_id": None, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", user_id).execute()
    return {"success": True}


# ── POST /telegram/webhook — Telegram bot messages ────────────────────────────

@router.post("/telegram/webhook")
async def telegram_webhook(request: Request) -> dict:
    try:
        body = await request.json()
        message = body.get("message")
        if not message:
            return {"ok": True}

        chat_id: int = message["chat"]["id"]
        text: str = message.get("text", "").strip()
        voice = message.get("voice")

        db = get_admin_client()

        # Handle /start <token> for linking
        if text.startswith("/start "):
            link_token = text.split(" ", 1)[1].strip()
            await _handle_telegram_link(chat_id, link_token, db)
            return {"ok": True}

        if text == "/start":
            await _send_telegram_message(chat_id, "👋 Hello! I'm Spenny AI. Link your account from the Spenny web app to get started!")
            return {"ok": True}

        # Look up user by Telegram chat ID
        profile_result = (
            db.table("profiles")
            .select("id, groq_api_key, currency")
            .eq("telegram_chat_id", str(chat_id))
            .maybe_single()
            .execute()
        )
        if not profile_result.data:
            await _send_telegram_message(chat_id, "Please link your Telegram account from the Spenny web app first!")
            return {"ok": True}

        profile = profile_result.data
        user_id = profile["id"]
        groq_key = profile.get("groq_api_key") or os.environ.get("GROQ_API_KEY", "")
        currency = profile.get("currency") or "INR"

        if voice and groq_key:
            await _handle_telegram_voice(chat_id, voice, user_id, groq_key, currency, db)
        elif text:
            await _handle_telegram_text(chat_id, text, user_id, groq_key, currency, db)

        return {"ok": True}
    except Exception as exc:
        logger.exception("Telegram webhook error: %s", exc)
        return {"ok": True}  # Always 200 to Telegram


async def _handle_telegram_link(chat_id: int, token: str, db) -> None:
    token_result = (
        db.table("telegram_link_tokens")
        .select("*")
        .eq("token", token)
        .eq("used", False)
        .maybe_single()
        .execute()
    )
    if not token_result.data:
        await _send_telegram_message(chat_id, "❌ Invalid or expired link token. Please generate a new link from the Spenny web app.")
        return

    record = token_result.data
    if datetime.now(timezone.utc) > datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00")):
        await _send_telegram_message(chat_id, "❌ Link token expired. Please generate a new link from the Spenny web app.")
        return

    user_id = record["user_id"]
    db.table("profiles").update({"telegram_chat_id": str(chat_id), "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", user_id).execute()
    db.table("telegram_link_tokens").update({"used": True}).eq("token", token).execute()
    await _send_telegram_message(chat_id, "✅ Your Telegram account is now linked to Spenny AI!\n\nYou can now log expenses by sending messages like:\n• \"Spent 200 on coffee\"\n• \"Show last month expenses\"\n• \"How much did I spend on food?\"")


async def _handle_telegram_text(
    chat_id: int, text: str, user_id: str, groq_key: str, currency: str, db
) -> None:
    from agent.nodes.classifier import classify_intent
    from agent.nodes.expense import handle_expense
    from agent.nodes.query import handle_query
    from agent.nodes.insights import handle_insights

    intent = await classify_intent(text, groq_key)

    if intent == "expense":
        result = await handle_expense(text, user_id, groq_key, currency)
        items_node = None
        for child in result.get("uiResponse", {}).get("layout", {}).get("children", []):
            if isinstance(child, dict) and child.get("kind") == "collection":
                items_node = child
                break
        if items_node:
            count = len(items_node.get("items", []))
            total = sum(i.get("amount", 0) for i in items_node.get("items", []))
            reply = f"✅ *{count} expense{'s' if count > 1 else ''} logged!* Total: {currency} {total:,.0f}\n\n"
            for item in items_node.get("items", []):
                reply += f"• {item['description']} _{item['category']}_ — {currency} {item['amount']:,.0f}\n"
        else:
            reply = result.get("text", "Expenses logged!")
    elif intent == "query":
        result = await handle_query(text, user_id, groq_key, currency)
        children = result.get("uiResponse", {}).get("layout", {}).get("children", [])
        insight = next((c.get("text", "") for c in children if isinstance(c, dict) and c.get("style") == "insight"), "")
        reply = insight or "Here's your spending summary!"
    elif intent == "insights":
        result = await handle_insights(text, user_id, groq_key, currency)
        children = result.get("uiResponse", {}).get("layout", {}).get("children", [])
        insight = next((c.get("text", "") for c in children if isinstance(c, dict) and c.get("style") == "insight"), "")
        reply = insight or "Here are your spending insights!"
    else:
        reply = "👋 Hi! I can help you log expenses, check your spending, or give insights.\n\nTry: \"Spent 200 on coffee\" or \"Show last month's expenses\""

    await _send_telegram_message(chat_id, reply)


async def _handle_telegram_voice(
    chat_id: int, voice: dict, user_id: str, groq_key: str, currency: str, db
) -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    try:
        file_id = voice["file_id"]
        async with async_client(timeout=30) as client:
            file_r = await client.get(f"https://api.telegram.org/bot{token}/getFile?file_id={file_id}")
            file_path = file_r.json()["result"]["file_path"]
            audio_r = await client.get(f"https://api.telegram.org/file/bot{token}/{file_path}")
            audio_bytes = audio_r.content

        async with async_client(timeout=60) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {groq_key}"},
                files={"file": ("voice.ogg", audio_bytes, "audio/ogg")},
                data={"model": "whisper-large-v3-turbo", "language": "en", "response_format": "json"},
            )
            transcript = r.json().get("text", "").strip()

        if transcript:
            await _handle_telegram_text(chat_id, transcript, user_id, groq_key, currency, db)
        else:
            await _send_telegram_message(chat_id, "Sorry, I couldn't understand the audio. Please try again.")
    except Exception as exc:
        logger.exception("Telegram voice processing failed: %s", exc)
        await _send_telegram_message(chat_id, "Sorry, I couldn't process your voice message.")

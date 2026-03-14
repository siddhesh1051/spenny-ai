"""Telegram link and webhook endpoints.

Incoming messages are processed through the same agentic LangGraph pipeline
as the web chat, but with channel="telegram" so that respond agents produce
plain-text replies instead of UI JSON.
"""

from __future__ import annotations

import base64
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from agent.graph import receipt_graph, sage_graph
from auth.supabase_jwt import get_current_user
from db.client import get_admin_client
from utils.http import async_client

logger = logging.getLogger(__name__)
router = APIRouter()


async def _send_telegram_message(
    chat_id: int, text: str, parse_mode: str = "Markdown"
) -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    async with async_client(timeout=30) as client:
        await client.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": parse_mode},
        )


# ── GET ?action=status ────────────────────────────────────────────────────────


@router.get("/telegram/link")
async def telegram_link_status(
    action: Optional[str] = None,
    user: dict = Depends(get_current_user),
) -> dict:
    if action != "status":
        raise HTTPException(
            status_code=400,
            detail="Use action=status for GET, or POST to generate link",
        )

    user_id: str = user["sub"]
    db = get_admin_client()
    profile = (
        db.table("profiles")
        .select("telegram_chat_id")
        .eq("id", user_id)
        .single()
        .execute()
    )
    linked = bool(profile.data and profile.data.get("telegram_chat_id"))
    return {"linked": linked}


# ── POST — generate link token ───────────────────────────────────────────────


@router.post("/telegram/link")
async def telegram_link_generate(
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()

    db.table("telegram_link_tokens").delete().eq("user_id", user_id).eq(
        "used", False
    ).execute()

    token = secrets.token_hex(16)
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()

    db.table("telegram_link_tokens").insert(
        {
            "user_id": user_id,
            "token": token,
            "expires_at": expires_at,
            "used": False,
        }
    ).execute()

    bot_username = os.environ.get("TELEGRAM_BOT_USERNAME", "SpennyAIBot")
    return {
        "token": token,
        "deepLink": f"https://t.me/{bot_username}?start={token}",
        "expiresAt": expires_at,
    }


# ── DELETE — unlink Telegram ─────────────────────────────────────────────────


@router.delete("/telegram/link")
async def telegram_link_delete(
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()
    db.table("profiles").update(
        {
            "telegram_chat_id": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", user_id).execute()
    return {"success": True}


# ── POST /telegram/webhook ───────────────────────────────────────────────────


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
        photo_list = message.get("photo")

        db = get_admin_client()

        # Handle /start <token> for linking
        if text.startswith("/start "):
            link_token = text.split(" ", 1)[1].strip()
            await _handle_telegram_link(chat_id, link_token, db)
            return {"ok": True}

        if text == "/start":
            await _send_telegram_message(
                chat_id,
                "Hello! I'm Spenny AI. Link your account from the Spenny web app to get started!",
            )
            return {"ok": True}

        profile_result = (
            db.table("profiles")
            .select("id, groq_api_key, currency")
            .eq("telegram_chat_id", str(chat_id))
            .maybe_single()
            .execute()
        )
        if not profile_result.data:
            await _send_telegram_message(
                chat_id,
                "Please link your Telegram account from the Spenny web app first!",
            )
            return {"ok": True}

        profile = profile_result.data
        user_id = profile["id"]
        groq_key = profile.get("groq_api_key") or os.environ.get("GROQ_API_KEY", "")
        currency = profile.get("currency") or "INR"

        if voice and groq_key:
            await _handle_telegram_voice(
                chat_id, voice, user_id, groq_key, currency
            )
        elif photo_list and groq_key:
            await _handle_telegram_photo(
                chat_id, photo_list, user_id, groq_key, currency
            )
        elif text:
            await _handle_telegram_message(
                chat_id, text, user_id, groq_key, currency
            )

        return {"ok": True}
    except Exception as exc:
        logger.exception("Telegram webhook error: %s", exc)
        return {"ok": True}


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
        await _send_telegram_message(
            chat_id,
            "Invalid or expired link token. Please generate a new link from the Spenny web app.",
        )
        return

    record = token_result.data
    if datetime.now(timezone.utc) > datetime.fromisoformat(
        record["expires_at"].replace("Z", "+00:00")
    ):
        await _send_telegram_message(
            chat_id,
            "Link token expired. Please generate a new link from the Spenny web app.",
        )
        return

    user_id = record["user_id"]
    db.table("profiles").update(
        {
            "telegram_chat_id": str(chat_id),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", user_id).execute()
    db.table("telegram_link_tokens").update({"used": True}).eq(
        "token", token
    ).execute()
    await _send_telegram_message(
        chat_id,
        (
            "Your Telegram account is now linked to Spenny AI!\n\n"
            "You can now log expenses by sending messages like:\n"
            '- "Spent 200 on coffee"\n'
            '- "Show last month expenses"\n'
            '- "How much did I spend on food?"\n\n'
            "You can also send receipt photos!"
        ),
    )


async def _handle_telegram_message(
    chat_id: int,
    text: str,
    user_id: str,
    groq_key: str,
    currency: str,
) -> None:
    """Process text through the agentic graph with channel=telegram."""
    thread_id = f"tg-{chat_id}"
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "messages": [HumanMessage(content=text)],
        "user_id": user_id,
        "groq_key": groq_key,
        "currency": currency,
        "channel": "telegram",
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
                "I can help you log expenses, check your spending, or give insights.\n\n"
                'Try: "Spent 200 on coffee" or "Show last month\'s expenses"'
            )

        await _send_telegram_message(chat_id, text_response)
    except Exception as exc:
        logger.exception("Telegram message processing failed: %s", exc)
        await _send_telegram_message(
            chat_id, "Sorry, something went wrong. Please try again."
        )


async def _handle_telegram_voice(
    chat_id: int,
    voice: dict,
    user_id: str,
    groq_key: str,
    currency: str,
) -> None:
    """Download Telegram voice note, transcribe, then process as text."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    try:
        file_id = voice["file_id"]
        async with async_client(timeout=30) as client:
            file_r = await client.get(
                f"https://api.telegram.org/bot{token}/getFile?file_id={file_id}"
            )
            file_path = file_r.json()["result"]["file_path"]
            audio_r = await client.get(
                f"https://api.telegram.org/file/bot{token}/{file_path}"
            )
            audio_bytes = audio_r.content

        async with async_client(timeout=60) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {groq_key}"},
                files={"file": ("voice.ogg", audio_bytes, "audio/ogg")},
                data={
                    "model": "whisper-large-v3-turbo",
                    "language": "en",
                    "response_format": "json",
                },
            )
            transcript = r.json().get("text", "").strip()

        if transcript:
            await _handle_telegram_message(
                chat_id, transcript, user_id, groq_key, currency
            )
        else:
            await _send_telegram_message(
                chat_id,
                "Sorry, I couldn't understand the audio. Please try again.",
            )
    except Exception as exc:
        logger.exception("Telegram voice processing failed: %s", exc)
        await _send_telegram_message(
            chat_id, "Sorry, I couldn't process your voice message."
        )


async def _handle_telegram_photo(
    chat_id: int,
    photo_list: list,
    user_id: str,
    groq_key: str,
    currency: str,
) -> None:
    """Download Telegram photo, run through the receipt agentic pipeline."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    try:
        # Telegram sends multiple sizes — pick the largest
        photo = photo_list[-1] if photo_list else {}
        file_id = photo.get("file_id", "")
        if not file_id:
            return

        async with async_client(timeout=30) as client:
            file_r = await client.get(
                f"https://api.telegram.org/bot{token}/getFile?file_id={file_id}"
            )
            file_path = file_r.json()["result"]["file_path"]
            img_r = await client.get(
                f"https://api.telegram.org/file/bot{token}/{file_path}"
            )
            image_bytes = img_r.content

        b64 = base64.b64encode(image_bytes).decode()
        data_url = f"data:image/jpeg;base64,{b64}"

        thread_id = f"tg-receipt-{chat_id}"
        config = {"configurable": {"thread_id": thread_id}}

        initial_state = {
            "messages": [HumanMessage(content="[receipt photo]")],
            "user_id": user_id,
            "groq_key": groq_key,
            "currency": currency,
            "channel": "telegram",
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

        await _send_telegram_message(chat_id, text_response)
    except Exception as exc:
        logger.exception("Telegram photo processing failed: %s", exc)
        await _send_telegram_message(
            chat_id, "Sorry, I couldn't process the image. Please try again."
        )

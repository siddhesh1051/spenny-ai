"""
WhatsApp webhook route — ported from supabase/functions/whatsapp-webhook.
Handles Meta webhook verification (GET) and incoming messages (POST).
"""

import json
import io
import re
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import PlainTextResponse

from services.supabase import get_service_client
from services.config import get_settings
from services.formatting import VALID_CATEGORIES

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])
_settings = get_settings()

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
WA_BASE = "https://graph.facebook.com/v21.0"


# ── WhatsApp API helpers ──────────────────────────────────────────────────────

async def _send_text(to: str, text: str) -> None:
    s = _settings
    if not s.whatsapp_token or not s.whatsapp_phone_number_id:
        return
    async with httpx.AsyncClient(timeout=30) as client:
        await client.post(
            f"{WA_BASE}/{s.whatsapp_phone_number_id}/messages",
            headers={"Authorization": f"Bearer {s.whatsapp_token}", "Content-Type": "application/json"},
            json={"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": text}},
        )


async def _download_media(media_id: str) -> tuple[bytes, str]:
    token = _settings.whatsapp_token
    async with httpx.AsyncClient(timeout=30) as client:
        meta = await client.get(f"{WA_BASE}/{media_id}", headers={"Authorization": f"Bearer {token}"})
        meta.raise_for_status()
        meta_data = meta.json()
        audio_resp = await client.get(meta_data["url"], headers={"Authorization": f"Bearer {token}"})
        audio_resp.raise_for_status()
        return audio_resp.content, meta_data.get("mime_type", "audio/ogg")


async def _transcribe(audio: bytes, mime: str, key: str) -> str:
    ext_map = {"audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/webm": "webm", "audio/amr": "amr"}
    ext = ext_map.get(mime.split(";")[0].strip(), "ogg")
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            WHISPER_URL,
            headers={"Authorization": f"Bearer {key}"},
            files={"file": (f"voice.{ext}", audio, mime)},
            data={"model": "whisper-large-v3-turbo", "language": "en", "response_format": "json"},
        )
        resp.raise_for_status()
        return resp.json().get("text", "").strip()


# ── Groq helpers ──────────────────────────────────────────────────────────────

async def _groq(prompt: str, key: str, model: str = "llama-3.1-8b-instant", max_tokens: int = 10) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0, "max_tokens": max_tokens},
        )
        if not resp.is_success:
            return ""
        return resp.json()["choices"][0]["message"]["content"].strip()


async def _classify_intent(text: str, key: str) -> str:
    t = text.lower()
    for p in [r"(export|download|send)\s+(csv|pdf|expenses?|data)", r"^export$"]:
        if re.search(p, t, re.I):
            return "export"
    if re.match(r"^(hi|hello|hey|thanks?|ok|bye)", t, re.I):
        return "conversation"
    if re.search(r"(spent|paid)\s+\d+|\d+\s+(on|for)\s+\w+", t, re.I):
        return "expense"
    if re.search(r"(how\s+much|total|show|list|what).*(spent|expense)", t, re.I):
        return "query"
    if re.search(r"(save|suggest|budget|compare|insight|reduce)", t, re.I):
        return "insights"

    word = await _groq(f"""Classify: expense, query, insights, export, conversation.
Message: "{text}"
Reply ONE word.""", key)
    for intent in ["export", "query", "insights", "expense", "conversation"]:
        if intent in word.lower():
            return intent
    return "expense"


async def _parse_expenses(text: str, key: str) -> list[dict]:
    raw = await _groq(f"""Extract ALL expenses from: "{text}"
Categories: food, travel, groceries, entertainment, utilities, rent, other
Return ONLY JSON array: [{{"amount": number, "category": string, "description": string}}]""",
        key, max_tokens=500)
    try:
        parsed = json.loads(re.sub(r"```json?|```", "", raw).strip())
        return [e for e in (parsed if isinstance(parsed, list) else [])
                if isinstance(e.get("amount"), (int, float)) and e["amount"] > 0
                and e.get("category") in VALID_CATEGORIES and e.get("description", "").strip()]
    except Exception:
        return []


async def _answer_query(question: str, user_id: str, key: str, fmt) -> str:
    db = get_service_client()
    result = await db.table("expenses").select("amount, category, description, date") \
        .eq("user_id", user_id).order("date", desc=True).limit(200).execute()
    expenses = result.data or []
    if not expenses:
        return "No expenses found yet. Start logging with: \"Spent 50 on coffee\""

    total = sum(e["amount"] for e in expenses)
    lines = "\n".join(f"{e['date'][:10]} | {e['category']} | {e['description']} | {fmt(e['amount'])}" for e in expenses[:30])

    return await _groq(f"""You are Spenny AI on WhatsApp. Answer: "{question}"
Total expenses: {fmt(total)} ({len(expenses)} transactions)
Sample:
{lines}
Be concise, use *bold* and • bullets. Under 500 chars.""", key, max_tokens=500)


async def _generate_insights(question: str, user_id: str, key: str, fmt) -> str:
    db = get_service_client()
    ninety_ago = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    result = await db.table("expenses").select("amount, category, description, date") \
        .eq("user_id", user_id).gte("date", ninety_ago).order("date", desc=True).execute()
    expenses = result.data or []
    if not expenses:
        return "Log some expenses first and I'll give you insights! 📊"

    total = sum(e["amount"] for e in expenses)
    by_cat: dict[str, float] = {}
    for e in expenses:
        by_cat[e["category"]] = by_cat.get(e["category"], 0) + e["amount"]
    top_cats = sorted(by_cat.items(), key=lambda x: -x[1])[:5]

    return await _groq(f"""You are Spenny AI. Give spending insights for: "{question}"
90-day data: {fmt(total)} total, {len(expenses)} transactions
Top categories: {', '.join(f"{c}: {fmt(v)}" for c, v in top_cats)}
Be actionable, concise, under 600 chars. Use *bold* and • bullets.""", key, max_tokens=600)


def _format_currency(amount: float, currency: str = "INR") -> str:
    try:
        import locale
        return f"{currency} {amount:,.0f}"
    except Exception:
        return f"{currency} {amount:.0f}"


# ── Export state helpers ──────────────────────────────────────────────────────

async def _get_export_state(db, phone: str) -> dict | None:
    r = await db.table("whatsapp_export_state").select("*").eq("phone", phone).limit(1).execute()
    rows = r.data if isinstance(r.data, list) else ([r.data] if r.data else [])
    return rows[0] if rows else None


async def _upsert_export_state(db, phone: str, user_id: str, step: int, date_from=None, date_to=None, fmt=None):
    await db.table("whatsapp_export_state").upsert(
        {"phone": phone, "user_id": user_id, "step": step, "date_from": date_from, "date_to": date_to, "format": fmt},
        on_conflict="phone",
    ).execute()


async def _clear_export_state(db, phone: str):
    await db.table("whatsapp_export_state").delete().eq("phone", phone).execute()


def _parse_period(text: str) -> tuple[str, str] | None:
    t = text.strip().lower()
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    if re.match(r"^[12]$|^(one|two|last\s*7|7\s*days?|past\s*week|this\s*week)", t):
        from_d = (now - timedelta(days=6)).date().isoformat()
        return from_d, today
    if re.match(r"^[3]$|^(three|last\s*30|30\s*days?|past\s*month)", t):
        from_d = (now - timedelta(days=29)).date().isoformat()
        return from_d, today
    if re.match(r"^[4]$|^(four|this\s*month|current\s*month)", t):
        from_d = now.replace(day=1).date().isoformat()
        return from_d, today
    if re.search(r"last\s*month|previous\s*month", t):
        lm = (now.replace(day=1) - timedelta(days=1))
        from_d = lm.replace(day=1).date().isoformat()
        to_d = lm.date().isoformat()
        return from_d, to_d
    return None


def _parse_format(text: str) -> str | None:
    t = text.lower()
    if re.search(r"\bcsv\b|^1$|^one$", t):
        return "csv"
    if re.search(r"\bpdf\b|^2$|^two$", t):
        return "pdf"
    return None


async def _do_export(db, phone: str, user_id: str, date_from: str, date_to: str, fmt_choice: str, fmt_fn):
    result = await db.table("expenses").select("date, description, category, amount") \
        .eq("user_id", user_id) \
        .gte("date", f"{date_from}T00:00:00.000Z") \
        .lte("date", f"{date_to}T23:59:59.999Z") \
        .order("date").execute()
    expenses = result.data or []

    if not expenses:
        await _send_text(phone, f"No expenses found between {date_from} and {date_to}.")
        return

    total = sum(e["amount"] for e in expenses)

    if fmt_choice == "csv":
        lines = [f"Date,Description,Category,Amount"]
        for e in expenses:
            lines.append(f"{e['date'][:10]},{e['description']},{e['category']},{e['amount']:.2f}")
        content = "\n".join(lines).encode()
        mime = "text/csv"
        filename = f"expenses_{date_from}_to_{date_to}.csv"
    else:
        # Build a simple text-based PDF using reportlab
        try:
            from reportlab.lib.pagesizes import A4, landscape
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
            from reportlab.lib import colors
            buf = io.BytesIO()
            doc = SimpleDocTemplate(buf, pagesize=landscape(A4))
            table_data = [["Date", "Description", "Category", "Amount"]]
            for e in expenses:
                table_data.append([e["date"][:10], e["description"][:40], e["category"], f"{e['amount']:.2f}"])
            t = Table(table_data)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
            ]))
            doc.build([t])
            content = buf.getvalue()
        except Exception:
            content = "\n".join(f"{e['date'][:10]},{e['description']},{e['category']},{e['amount']:.2f}" for e in expenses).encode()
        mime = "application/pdf"
        filename = f"expenses_{date_from}_to_{date_to}.pdf"

    # Upload to Supabase Storage and get signed URL
    storage_path = f"{phone}/{filename}"
    try:
        db.storage.from_("whatsapp-exports").upload(storage_path, content, {"content-type": mime, "upsert": "true"})
        signed = db.storage.from_("whatsapp-exports").create_signed_url(storage_path, 3600)
        url = signed.get("signedURL") or signed.get("signedUrl") or ""
    except Exception:
        url = ""

    if url:
        # Send document
        s = _settings
        async with httpx.AsyncClient(timeout=30) as client:
            await client.post(
                f"{WA_BASE}/{s.whatsapp_phone_number_id}/messages",
                headers={"Authorization": f"Bearer {s.whatsapp_token}", "Content-Type": "application/json"},
                json={
                    "messaging_product": "whatsapp", "to": phone, "type": "document",
                    "document": {"link": url, "caption": f"Your expenses ({date_from} to {date_to}). {len(expenses)} transactions.", "filename": filename},
                },
            )
        await _send_text(phone, f"✅ Sent your report!\n\n📊 {len(expenses)} transactions\n💰 Total: {fmt_fn(total)}\n⏰ Link expires in 1 hour.")
    else:
        # Fallback: send plain text summary
        summary = "\n".join(f"• {e['description']}: {fmt_fn(e['amount'])}" for e in expenses[:20])
        await _send_text(phone, f"*Expenses {date_from} to {date_to}*\n\n{summary}\n\n*Total: {fmt_fn(total)}*")


# ── Main route handlers ───────────────────────────────────────────────────────

@router.get("/webhook")
async def verify_webhook(request: Request):
    params = dict(request.query_params)
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if not mode and not token:
        return {"ok": True, "service": "whatsapp-webhook"}

    if mode == "subscribe" and token == _settings.whatsapp_verify_token and challenge:
        return PlainTextResponse(challenge)

    raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/webhook")
async def handle_webhook(request: Request):
    try:
        body = await request.json()
    except Exception:
        return Response("OK", status_code=200)

    try:
        entry = (body.get("entry") or [{}])[0]
        changes = (entry.get("changes") or [{}])[0]
        value = changes.get("value") or {}
        messages = value.get("messages") or []

        if not messages:
            return Response("OK", status_code=200)

        msg = messages[0]
        sender_phone = re.sub(r"\D", "", msg.get("from", ""))
        msg_type = msg.get("type")

        if msg_type not in ("text", "audio"):
            await _send_text(sender_phone, "I can process text and voice messages. Try: \"Spent 50 on coffee\"")
            return Response("OK", status_code=200)

        db = get_service_client()

        # Resolve text
        message_text = ""
        if msg_type == "text":
            message_text = (msg.get("text") or {}).get("body", "").strip()
        elif msg_type == "audio":
            audio_id = (msg.get("audio") or {}).get("id")
            profile_r = await db.table("profiles").select("id, groq_api_key").eq("whatsapp_phone", sender_phone).limit(1).execute()
            _profile_rows = profile_r.data if isinstance(profile_r.data, list) else ([profile_r.data] if profile_r.data else [])
            if not _profile_rows:
                await _send_text(sender_phone, f"Link your WhatsApp in the Spenny AI app first.")
                return Response("OK", status_code=200)
            key = _profile_rows[0].get("groq_api_key") or _settings.groq_api_key
            audio_bytes, mime = await _download_media(audio_id)
            message_text = await _transcribe(audio_bytes, mime, key)

        if not message_text:
            return Response("OK", status_code=200)

        # HELP command
        if message_text.lower() == "help":
            await _send_text(sender_phone, "*Spenny AI*\n\n📝 Log: \"Spent 50 on coffee\"\n❓ Ask: \"How much this month?\"\n📤 Export: \"export expenses\"\n💡 Insights: \"how can I save?\"\n\n⚡ Commands: help, today, total, export")
            return Response("OK", status_code=200)

        # Look up user
        profile_r = await db.table("profiles").select("id, groq_api_key, currency").eq("whatsapp_phone", sender_phone).limit(1).execute()
        _prows = profile_r.data if isinstance(profile_r.data, list) else ([profile_r.data] if profile_r.data else [])
        if not _prows:
            await _send_text(sender_phone, f"Your WhatsApp isn't linked to a Spenny AI account.\n\nOpen the app → Settings → enter +{sender_phone}")
            return Response("OK", status_code=200)

        profile = _prows[0]
        user_id = profile["id"]
        groq_key = profile.get("groq_api_key") or _settings.groq_api_key
        currency = profile.get("currency") or "INR"

        def fmt(n: float) -> str:
            return _format_currency(n, currency)

        # TODAY command
        if message_text.lower() == "today":
            today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            r = await db.table("expenses").select("amount, category, description").eq("user_id", user_id).gte("date", today_start).order("date", desc=True).execute()
            exps = r.data or []
            if not exps:
                await _send_text(sender_phone, "No expenses today yet.")
            else:
                total = sum(e["amount"] for e in exps)
                lines = "\n".join(f"• {e['description']} — {fmt(e['amount'])}" for e in exps)
                await _send_text(sender_phone, f"*Today's Expenses*\n\n{lines}\n\n*Total: {fmt(total)}*")
            return Response("OK", status_code=200)

        # TOTAL command
        if message_text.lower() == "total":
            now = datetime.now(timezone.utc)
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
            r = await db.table("expenses").select("amount, category").eq("user_id", user_id).gte("date", month_start).execute()
            exps = r.data or []
            if not exps:
                await _send_text(sender_phone, "No expenses this month yet!")
            else:
                total = sum(e["amount"] for e in exps)
                by_cat: dict[str, float] = {}
                for e in exps:
                    by_cat[e["category"]] = by_cat.get(e["category"], 0) + e["amount"]
                breakdown = "\n".join(f"• {c}: {fmt(v)}" for c, v in sorted(by_cat.items(), key=lambda x: -x[1]))
                await _send_text(sender_phone, f"*{now.strftime('%B')} Summary*\n\n{breakdown}\n\n*Total: {fmt(total)}*\n{len(exps)} transactions")
            return Response("OK", status_code=200)

        # Export flow
        export_state = await _get_export_state(db, sender_phone)
        if export_state:
            cancel = message_text.strip().lower()
            if cancel in ("cancel", "exit", "stop"):
                await _clear_export_state(db, sender_phone)
                await _send_text(sender_phone, "Export cancelled.")
                return Response("OK", status_code=200)

            step = export_state.get("step", 1)
            if step == 1:
                period = _parse_period(message_text)
                if period:
                    fmt_pref = export_state.get("format")
                    if fmt_pref:
                        await _do_export(db, sender_phone, user_id, period[0], period[1], fmt_pref, fmt)
                        await _clear_export_state(db, sender_phone)
                    else:
                        await _upsert_export_state(db, sender_phone, user_id, 2, period[0], period[1], None)
                        await _send_text(sender_phone, "Send as *CSV* or *PDF*?\n\nReply *1* or *csv* for CSV\nReply *2* or *pdf* for PDF\n\nOr say *cancel*.")
                else:
                    await _send_text(sender_phone, "Try:\n*1* Last 7 days, *2* Last 30, *3* Last 90, *4* This month\nOr: \"1st Jan to today\"")
                return Response("OK", status_code=200)

            if step == 2:
                fmt_choice = _parse_format(message_text)
                if fmt_choice:
                    await _do_export(db, sender_phone, user_id, export_state["date_from"], export_state["date_to"], fmt_choice, fmt)
                    await _clear_export_state(db, sender_phone)
                else:
                    await _send_text(sender_phone, "Reply *1* or *csv* for CSV, *2* or *pdf* for PDF.")
                return Response("OK", status_code=200)

        # Classify intent
        intent = await _classify_intent(message_text, groq_key)

        if intent == "conversation":
            await _send_text(sender_phone, "I'm Spenny AI! 💰 Log expenses, ask questions, or type *help*.")
            return Response("OK", status_code=200)

        if intent == "export":
            await _upsert_export_state(db, sender_phone, user_id, 1, None, None, None)
            await _send_text(sender_phone, "📤 *Export expenses*\n\nWhich period?\n*1* Last 7 days, *2* Last 30, *3* Last 90, *4* This month\nOr specify dates: \"1st Jan to today\"\n\nSay *cancel* to cancel.")
            return Response("OK", status_code=200)

        if intent == "query":
            answer = await _answer_query(message_text, user_id, groq_key, fmt)
            await _send_text(sender_phone, answer)
            return Response("OK", status_code=200)

        if intent == "insights":
            reply = await _generate_insights(message_text, user_id, groq_key, fmt)
            await _send_text(sender_phone, reply)
            return Response("OK", status_code=200)

        # Expense
        expenses = await _parse_expenses(message_text, groq_key)
        if not expenses:
            await _send_text(sender_phone, "Couldn't find expenses. Try: \"Spent 50 on coffee\"")
            return Response("OK", status_code=200)

        to_insert = [{"amount": e["amount"], "category": e["category"], "description": e["description"][:100], "date": datetime.now(timezone.utc).isoformat(), "user_id": user_id} for e in expenses]
        inserted_r = await db.table("expenses").insert(to_insert).execute()
        inserted = inserted_r.data or []
        total = sum(e["amount"] for e in inserted)
        lines = "\n".join(f"✅ {e['description']} — {fmt(e['amount'])}" for e in inserted)
        reply = f"{lines}\n\n*Total: {fmt(total)}*" if len(inserted) > 1 else lines
        await _send_text(sender_phone, reply)

    except Exception as e:
        import traceback
        print(f"[whatsapp webhook error] {e}\n{traceback.format_exc()}")

    return Response("OK", status_code=200)

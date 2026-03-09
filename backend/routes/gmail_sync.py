"""
Gmail sync route — ported from supabase/functions/sync-gmail-expenses.
Fetches bank/transaction emails, extracts expenses with Groq, deduplicates by Gmail message ID.
"""

import base64
import json
import re
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from pydantic import BaseModel

from middleware.auth import get_current_user
from services.supabase import get_service_client
from services.config import get_settings
from services.formatting import VALID_CATEGORIES

router = APIRouter(prefix="/gmail", tags=["gmail"])
_settings = get_settings()

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"
GMAIL_QUERY = (
    "(subject:\"debited\" OR subject:\"credited\" OR subject:\"transaction\" "
    "OR subject:\"payment\" OR subject:\"spent\" OR subject:\"purchase\" "
    "OR subject:\"UPI\" OR subject:\"NEFT\" OR subject:\"IMPS\" OR subject:\"alert\" "
    "OR from:alerts OR from:noreply@paytm.com OR from:alerts@hdfcbank.net "
    "OR from:alerts@icicibank.com OR from:alerts@axisbank.com "
    "OR from:sbiintouch@sbi.co.in OR from:kotak OR from:alerts@indusind.com) "
    "category:primary"
)
MAX_MESSAGES = 500
BATCH_SIZE = 5


class GmailSyncRequest(BaseModel):
    access_token: str


async def _groq_json(prompt: str, key: str) -> dict | list | None:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}], "temperature": 0, "max_tokens": 120},
        )
        if not resp.is_success:
            return None
        raw = resp.json()["choices"][0]["message"]["content"]
        cleaned = re.sub(r"```json?|```", "", raw).strip()
        try:
            return json.loads(cleaned)
        except Exception:
            return None


def _decode_body(data: str | None) -> str:
    if not data:
        return ""
    try:
        return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
    except Exception:
        return ""


def _extract_text_from_payload(payload: dict) -> str:
    """Recursively extract plain text from Gmail message payload."""
    if not payload:
        return ""
    body = (payload.get("body") or {}).get("data")
    if body and payload.get("mimeType", "").startswith("text/plain"):
        return _decode_body(body)
    for part in payload.get("parts") or []:
        text = _extract_text_from_payload(part)
        if text:
            return text
    return ""


async def _process_message(msg_id: str, token: str, groq_key: str) -> list[dict] | None:
    """Fetch a Gmail message and extract expense(s) from it. Returns None to skip."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"https://www.googleapis.com/gmail/v1/users/me/messages/{msg_id}",
            headers={"Authorization": f"Bearer {token}"},
            params={"format": "full"},
        )
        if not resp.is_success:
            return None
        detail = resp.json()

    subject = next(
        (h["value"] for h in (detail.get("payload") or {}).get("headers", []) if h["name"].lower() == "subject"),
        "",
    )
    body_text = _extract_text_from_payload(detail.get("payload") or {})
    snippet = detail.get("snippet", "")
    internal_date = detail.get("internalDate", "")
    date_iso = datetime.fromtimestamp(int(internal_date) / 1000, tz=timezone.utc).isoformat() if internal_date else datetime.now(timezone.utc).isoformat()

    content = f"Subject: {subject}\n{snippet}\n{body_text[:500]}"

    result = await _groq_json(
        f"""Extract expense from this bank email. Return null if it's not a debit/spending transaction.

Email:
{content}

Categories: food, travel, groceries, entertainment, utilities, rent, other

Return ONLY valid JSON or null:
{{"amount": number, "category": "string", "description": "string", "date": "YYYY-MM-DD"}}

Rules:
- amount: numeric amount debited (positive)
- description: merchant name or brief description (max 50 chars)
- date: transaction date from email or today
- Return null if: credit, interest, OTP, promotional, not a spending transaction""",
        groq_key,
    )

    if not result or not isinstance(result, dict):
        return None

    amount = result.get("amount")
    category = result.get("category")
    if not isinstance(amount, (int, float)) or amount <= 0 or category not in VALID_CATEGORIES:
        return None

    return [{
        "amount": amount,
        "category": category,
        "description": str(result.get("description", "Bank transaction"))[:100],
        "date": result.get("date") or date_iso,
        "gmail_message_id": msg_id,
    }]


async def _run_sync(user_id: str, access_token: str, groq_key: str):
    """Background task: fetch emails and insert new expenses."""
    db = get_service_client()

    # Get already-synced message IDs
    state_r = await db.table("gmail_sync_state").select("synced_message_ids").eq("user_id", user_id).limit(1).execute()
    rows = state_r.data if isinstance(state_r.data, list) else ([state_r.data] if state_r.data else [])
    synced_ids: list[str] = (rows[0] if rows else {}).get("synced_message_ids") or []
    synced_set = set(synced_ids)

    # List Gmail messages
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            "https://www.googleapis.com/gmail/v1/users/me/messages",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"q": GMAIL_QUERY, "maxResults": MAX_MESSAGES},
        )
        if not resp.is_success:
            print(f"[gmail-sync] Gmail list failed: {resp.status_code}")
            return
        data = resp.json()

    messages = data.get("messages") or []
    new_ids = [m["id"] for m in messages if m["id"] not in synced_set]

    print(f"[gmail-sync] {len(messages)} total, {len(new_ids)} new for user {user_id}")

    if not new_ids:
        # Update last_synced_at
        await db.table("gmail_sync_state").upsert(
            {"user_id": user_id, "last_synced_at": datetime.now(timezone.utc).isoformat(), "synced_message_ids": synced_ids},
            on_conflict="user_id",
        ).execute()
        return

    # Process in batches
    new_expenses: list[dict] = []
    newly_synced: list[str] = []

    for i in range(0, min(len(new_ids), 100), BATCH_SIZE):
        batch = new_ids[i:i + BATCH_SIZE]
        import asyncio
        results = await asyncio.gather(*[_process_message(mid, access_token, groq_key) for mid in batch])
        for mid, exps in zip(batch, results):
            newly_synced.append(mid)
            if exps:
                new_expenses.extend([{**e, "user_id": user_id} for e in exps])

    if new_expenses:
        await db.table("expenses").insert(new_expenses).execute()

    # Update sync state
    all_synced = list(set(synced_ids + newly_synced))
    await db.table("gmail_sync_state").upsert(
        {
            "user_id": user_id,
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
            "synced_message_ids": all_synced,
        },
        on_conflict="user_id",
    ).execute()

    print(f"[gmail-sync] Inserted {len(new_expenses)} expenses for user {user_id}")


@router.post("/sync")
async def sync_gmail(
    body: GmailSyncRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Trigger Gmail sync in background. Returns immediately."""
    db = get_service_client(user["token"])
    profile_r = await db.table("profiles").select("groq_api_key").eq("id", user["id"]).single().execute()
    groq_key = (profile_r.data or {}).get("groq_api_key") or _settings.groq_api_key
    if not groq_key:
        raise HTTPException(status_code=400, detail="No API key configured")

    background_tasks.add_task(_run_sync, user["id"], body.access_token, groq_key)
    return {"status": "sync_started"}

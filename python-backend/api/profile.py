"""Profile, currency, and Groq API key management."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth.supabase_jwt import get_current_user
from db.client import get_admin_client

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    groq_api_key: Optional[str] = None


class CurrencyUpdate(BaseModel):
    currency: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(user: dict = Depends(get_current_user)) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()
    result = (
        db.table("profiles")
        .select("id, full_name, groq_api_key, currency, updated_at")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if result.data:
        return result.data

    # Auto-create profile for new users (e.g. first Google sign-in)
    from datetime import datetime, timezone
    email = user.get("email", "")
    full_name = (
        user.get("user_metadata", {}).get("full_name")
        or user.get("user_metadata", {}).get("name")
        or (email.split("@")[0] if email else "")
    )
    row = {
        "id": user_id,
        "full_name": full_name,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    db.table("profiles").upsert(row).execute()
    return row


@router.put("/profile")
async def update_profile(
    body: ProfileUpdate,
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()

    updates: dict = {}
    if body.full_name is not None:
        updates["full_name"] = body.full_name
    if body.groq_api_key is not None:
        updates["groq_api_key"] = body.groq_api_key

    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    from datetime import datetime, timezone
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    db.table("profiles").upsert({"id": user_id, **updates}).execute()
    return {"ok": True}


@router.get("/profile/currency")
async def get_currency(user: dict = Depends(get_current_user)) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()
    result = (
        db.table("profiles")
        .select("currency")
        .eq("id", user_id)
        .single()
        .execute()
    )
    return {"currency": (result.data or {}).get("currency") or "INR"}


@router.put("/profile/currency")
async def update_currency(
    body: CurrencyUpdate,
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()
    from datetime import datetime, timezone
    db.table("profiles").upsert({
        "id": user_id,
        "currency": body.currency,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    return {"ok": True, "currency": body.currency}

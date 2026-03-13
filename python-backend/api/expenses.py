"""Expenses CRUD endpoints."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth.supabase_jwt import get_current_user
from db.client import get_admin_client

logger = logging.getLogger(__name__)
router = APIRouter()


class ExpenseUpdate(BaseModel):
    amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None


@router.get("/expenses")
async def list_expenses(user: dict = Depends(get_current_user)) -> list:
    user_id: str = user["sub"]
    db = get_admin_client()
    result = (
        db.table("expenses")
        .select("id, amount, category, description, date, created_at")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .execute()
    )
    return result.data or []


@router.delete("/expenses/{expense_id}")
async def delete_expense(
    expense_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()
    db.table("expenses").delete().eq("id", expense_id).eq("user_id", user_id).execute()
    return {"ok": True}


@router.put("/expenses/{expense_id}")
async def update_expense(
    expense_id: str,
    body: ExpenseUpdate,
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    result = (
        db.table("expenses")
        .update(updates)
        .eq("id", expense_id)
        .eq("user_id", user_id)
        .execute()
    )
    # Fetch updated row
    row = (
        db.table("expenses")
        .select("id, amount, category, description, date")
        .eq("id", expense_id)
        .single()
        .execute()
    )
    return row.data or {}

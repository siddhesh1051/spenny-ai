"""Database helper tools that nodes use to query/write Supabase."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from db.client import get_admin_client

logger = logging.getLogger(__name__)

VALID_CATEGORIES = [
    "Food & Dining", "Groceries", "Travel", "Entertainment", "Utilities",
    "Rent", "Shopping", "Education", "Investments", "Healthcare",
    "Subscriptions", "Other",
]


def get_user_profile(user_id: str) -> dict:
    db = get_admin_client()
    result = (
        db.table("profiles")
        .select("groq_api_key, currency")
        .eq("id", user_id)
        .single()
        .execute()
    )
    return result.data or {}


def insert_expenses(user_id: str, expenses: list[dict]) -> list[dict]:
    """Insert expenses and return inserted rows with ids."""
    db = get_admin_client()
    now = datetime.now(timezone.utc).isoformat()
    rows = [
        {
            "user_id": user_id,
            "amount": e["amount"],
            "category": e["category"],
            "description": e["description"][:100].strip(),
            "date": e.get("date") or now,
        }
        for e in expenses
    ]
    # Insert first, then fetch the inserted rows by user_id + description + amount
    db.table("expenses").insert(rows).execute()

    # Fetch the most recently inserted rows for this user
    result = (
        db.table("expenses")
        .select("id, description, category, amount")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(len(rows))
        .execute()
    )
    return result.data or []


def query_expenses(
    user_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    search_description: Optional[str] = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    limit: Optional[int] = None,
) -> list[dict]:
    db = get_admin_client()
    q = (
        db.table("expenses")
        .select("id, date, description, category, amount")
        .eq("user_id", user_id)
    )
    if start_date:
        q = q.gte("date", f"{start_date}T00:00:00.000Z")
    if end_date:
        q = q.lte("date", f"{end_date}T23:59:59.999Z")
    if category:
        q = q.eq("category", category)
    if min_amount is not None:
        q = q.gte("amount", min_amount)
    if max_amount is not None:
        q = q.lte("amount", max_amount)
    if search_description:
        q = q.ilike("description", f"%{search_description}%")
    q = q.order(sort_by, desc=(sort_order == "desc"))
    # Only apply a limit when explicitly requested (e.g. "top 5").
    # Without a limit Supabase PostgREST returns up to its server-side max (1000).
    if limit is not None:
        q = q.limit(limit)
    result = q.execute()
    return result.data or []


def query_expenses_since(user_id: str, days: int = 90) -> list[dict]:
    from datetime import timedelta
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    db = get_admin_client()
    result = (
        db.table("expenses")
        .select("amount, category, description, date")
        .eq("user_id", user_id)
        .gte("date", since)
        .order("date", desc=True)
        .execute()
    )
    return result.data or []

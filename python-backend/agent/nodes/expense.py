"""Expense node — extract expenses from text and save to DB."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from agent.constants import EXPENSE_CATEGORY_GUIDE, UI_COMPONENT_CATALOG, VALID_CATEGORIES
from agent.tools.db_tools import insert_expenses
from agent.tools.groq_tools import groq_json

logger = logging.getLogger(__name__)


def _format_currency(amount: float, currency: str) -> str:
    try:
        import locale
        return f"{currency} {amount:,.0f}"
    except Exception:
        return f"{currency} {amount:.0f}"


async def handle_expense(
    message: str,
    user_id: str,
    groq_key: str,
    currency: str = "INR",
) -> dict[str, Any]:
    parsed = await groq_json(
        f"""Extract ALL expenses from this message: "{message}"

{EXPENSE_CATEGORY_GUIDE}

Return ONLY a JSON array (no markdown):
[{{"amount": number, "category": string, "description": string}}]

Rules:
- amount must be a positive number
- description: clean short name (max 50 chars), capitalize first letter
- Extract EVERY expense mentioned""",
        groq_key,
        temperature=0.2,
        max_tokens=500,
    )

    valid = [
        e for e in (parsed or [])
        if isinstance(e.get("amount"), (int, float))
        and e["amount"] > 0
        and e.get("category") in VALID_CATEGORIES
        and e.get("description", "").strip()
    ]

    if not valid:
        return {
            "intent": "conversation",
            "text": "I couldn't find any expenses in your message. Try something like: \"Spent 500 on groceries\" or \"Coffee 50, Uber 200\"",
        }

    inserted = insert_expenses(user_id, valid)
    rows = [
        {"id": r["id"], "description": r["description"], "category": r["category"], "amount": r["amount"]}
        for r in inserted
    ]
    total = sum(r["amount"] for r in rows)

    # Fire-and-forget: embed new expenses for RAG (non-blocking)
    import asyncio
    try:
        from agent.memory.rag import embed_and_store_expense
        for r in rows:
            asyncio.ensure_future(embed_and_store_expense(r["id"], r["description"], r["category"], groq_key))
    except Exception:
        pass
    fmt_total = _format_currency(total, currency)

    collection_node = {
        "kind": "collection",
        "variant": "items",
        "text": f"{len(rows)} expense{'s' if len(rows) > 1 else ''} logged successfully!",
        "items": rows,
    }

    expense_summary = "\n".join(
        f"- {r['description']} ({r['category']}): {_format_currency(r['amount'], currency)}"
        for r in rows
    )

    ai_layout = await groq_json(
        f"""You are Spenny AI. The user just logged {len(rows)} expense{'s' if len(rows) > 1 else ''} totalling {fmt_total}.

Logged expenses:
{expense_summary}

{UI_COMPONENT_CATALOG}

Compose a concise confirmation UI. Rules:
- MUST include this exact collection node as one of the children (do not modify it):
{json.dumps(collection_node)}
- Optionally add a "block" subheading before the collection
- Do NOT add "insight" blocks, charts, tables, or summary cards
- Keep it minimal and celebratory
- The collection node MUST be the last child

Return ONLY valid JSON (no markdown):
{{ "layout": {{ "kind": "column", "children": [ ...nodes including the collection node ] }} }}""",
        groq_key,
        temperature=0.7,
        max_tokens=600,
    )

    fallback = {
        "layout": {
            "kind": "column",
            "children": [
                {"kind": "block", "style": "subheading", "text": f"{len(rows)} expense{'s' if len(rows) > 1 else ''} logged"},
                collection_node,
            ],
        }
    }

    return {"intent": "expense", "uiResponse": ai_layout or fallback}

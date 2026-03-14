"""Receipt / screenshot agentic workflow — vision → categorize → execute → respond.

Four specialised agents that process receipt images:
1. Vision Agent     — extracts raw line items from the image via Groq Vision
2. Category Agent   — assigns accurate categories to each extracted item
3. Execution Agent  — writes validated rows to the database
4. Response Agent   — builds a rich UI layout (web) or plain text (messaging)
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from langchain_core.messages import AIMessage

from agent.channels.formatter import format_receipt_text
from agent.constants import (
    EXPENSE_CATEGORY_GUIDE,
    UI_COMPONENT_CATALOG,
    VALID_CATEGORIES,
)
from agent.tools.db_tools import insert_expenses
from agent.tools.groq_tools import FAST_MODEL, groq_json, groq_vision_extract

logger = logging.getLogger(__name__)


def _fmt(amount: float, currency: str) -> str:
    return f"{currency} {amount:,.0f}"


# ── Agent 1: Vision extraction ───────────────────────────────────────────────

async def receipt_vision_agent(state: dict) -> dict:
    """Extract line items from a receipt/screenshot image.

    Uses the vision model to read the image and output structured data.
    Categories are NOT assigned here — that's the categoriser's job.
    """
    image_url = state.get("receipt_image_url", "")
    currency = state.get("currency", "INR")
    groq_key = state["groq_key"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    raw = await groq_vision_extract(
        image_url,
        f"""You are an expense extraction AI. Extract ALL transactions from this receipt or payment screenshot.

Today's date: {today}
Currency: {currency}. Assume that currency unless another is clearly visible.

EXTRACTION RULES:
1. For itemized bills: create ONE expense per meaningful line item
2. For single-total receipts (UPI screenshot, bank SMS): create ONE expense for the total
3. amount: final amount PAID (positive number)
4. description: clean, short (max 50 chars)
5. date: visible date in YYYY-MM-DD format, or null if not visible
6. If this is not a receipt/transaction return []

Return ONLY a valid JSON array — no markdown:
[
  {{"amount": number, "description": "string", "date": "YYYY-MM-DD or null"}}
]""",
        groq_key,
    )

    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            parsed = []
    except Exception:
        logger.error("Receipt vision parse failed. Raw: %s", raw[:200])
        parsed = []

    valid = [
        e
        for e in parsed
        if isinstance(e.get("amount"), (int, float))
        and e["amount"] > 0
        and isinstance(e.get("description"), str)
        and e["description"].strip()
    ]

    logger.info("receipt_vision: extracted %d items", len(valid))
    return {"receipt_raw_items": valid, "extracted_expenses": valid}


# ── Agent 2: Categorisation ──────────────────────────────────────────────────

async def receipt_categorize_agent(state: dict) -> dict:
    """Assign categories to receipt items.

    Reuses the same category guide as the expense workflow for consistency.
    """
    items = state.get("receipt_raw_items") or state.get("extracted_expenses", [])

    if not items:
        return {"categorized_expenses": []}

    descriptions = "\n".join(
        f"- \"{e['description']}\": {e['amount']}" for e in items
    )

    result = await groq_json(
        f"""Assign the BEST category to each expense from a receipt.

{EXPENSE_CATEGORY_GUIDE}

Items to categorize:
{descriptions}

Return ONLY a JSON array with the category added (no markdown):
[{{"amount": number, "description": string, "category": string, "date": string_or_null}}]

Rules:
- Use ONLY categories from the list above
- Apply the PRIORITY OVERRIDE RULES strictly
- Each item must have exactly one category""",
        state["groq_key"],
        temperature=0.0,
        max_tokens=500,
        model=FAST_MODEL,
    )

    if not result:
        result = [{**e, "category": "Other"} for e in items]

    # Preserve dates from vision extraction
    date_map = {(e["description"], e["amount"]): e.get("date") for e in items}
    for item in result:
        if not item.get("date"):
            item["date"] = date_map.get((item.get("description"), item.get("amount")))

    valid = [
        e
        for e in result
        if e.get("category") in VALID_CATEGORIES
        and isinstance(e.get("amount"), (int, float))
        and e["amount"] > 0
    ]

    logger.info("receipt_categorize: %d valid items", len(valid))
    return {"categorized_expenses": valid}


# ── Agent 3: Execution ───────────────────────────────────────────────────────

async def receipt_execute_agent(state: dict) -> dict:
    """Insert categorised receipt items into the database.

    Same logic as expense execution — no LLM call.
    """
    expenses = state.get("categorized_expenses", [])

    if not expenses:
        return {
            "inserted_expenses": [],
            "result": {
                "intent": "conversation",
                "uiResponse": {
                    "layout": {
                        "kind": "column",
                        "children": [
                            {"kind": "block", "style": "subheading", "text": "No transactions found"},
                            {
                                "kind": "block",
                                "style": "body",
                                "text": "Make sure it's a receipt, payment confirmation, or bank SMS screenshot.",
                            },
                        ],
                    }
                },
            },
        }

    inserted = insert_expenses(state["user_id"], expenses)
    rows: list[dict[str, Any]] = [
        {
            "id": r["id"],
            "description": r["description"],
            "category": r["category"],
            "amount": r["amount"],
        }
        for r in inserted
    ]

    try:
        from agent.memory.rag import embed_and_store_expense

        for r in rows:
            asyncio.ensure_future(
                embed_and_store_expense(
                    r["id"], r["description"], r["category"], state["groq_key"]
                )
            )
    except Exception:
        pass

    logger.info("receipt_execute: inserted %d rows", len(rows))
    return {"inserted_expenses": rows}


# ── Agent 4: Response builder ────────────────────────────────────────────────

async def receipt_respond_agent(state: dict) -> dict:
    """Build the receipt confirmation response."""
    rows = state.get("inserted_expenses", [])
    channel = state.get("channel", "web")
    currency = state.get("currency", "INR")
    groq_key = state["groq_key"]

    if not rows:
        existing = state.get("result")
        if existing:
            text = "Couldn't read the receipt. Please try a clearer photo."
            return {
                "text_response": text,
                "messages": [AIMessage(content=text)],
            }
        return {
            "result": {
                "intent": "conversation",
                "text": "Couldn't read the receipt. Please try a clearer photo.",
            },
            "text_response": "Couldn't read the receipt. Please try a clearer photo.",
            "messages": [AIMessage(content="Couldn't read the receipt.")],
        }

    total = sum(r["amount"] for r in rows)
    count = len(rows)
    fmt_total = _fmt(total, currency)

    # ── Messaging channels ────────────────────────────────────────────────
    if channel != "web":
        text = format_receipt_text(rows, currency)
        return {
            "result": {"intent": "expense", "text": text},
            "text_response": text,
            "messages": [AIMessage(content=f"[receipt] {count} items, {fmt_total}")],
        }

    # ── Web: rich UI ──────────────────────────────────────────────────────
    collection_node: dict[str, Any] = {
        "kind": "collection",
        "variant": "items",
        "text": f"{count} expense{'s' if count != 1 else ''} extracted from your receipt!",
        "items": [
            {
                "id": r["id"],
                "label": r["description"],
                "badge": r["category"],
                "value": _fmt(r["amount"], currency),
            }
            for r in rows
        ],
    }

    expense_summary = "\n".join(
        f"- {r['description']} ({r['category']}): {_fmt(r['amount'], currency)}"
        for r in rows
    )

    ai_layout = await groq_json(
        f"""You are Spenny AI. The user scanned a receipt and {count} expense{'s were' if count != 1 else ' was'} extracted, totalling {fmt_total}.

Extracted expenses:
{expense_summary}

{UI_COMPONENT_CATALOG}

Compose a concise confirmation UI. Rules:
- MUST include this exact collection node as one of the children (do not modify it):
{json.dumps(collection_node)}
- Optionally add a "block" subheading before the collection
- No insight blocks, charts, tables, or summary cards
- The collection node MUST be the last child

Return ONLY valid JSON (no markdown):
{{ "layout": {{ "kind": "column", "children": [ ...nodes including the collection node ] }} }}""",
        groq_key,
        temperature=0.7,
        max_tokens=600,
    ) or {
        "layout": {
            "kind": "column",
            "children": [
                {
                    "kind": "block",
                    "style": "subheading",
                    "text": f"{count} expense{'s' if count != 1 else ''} logged from receipt",
                },
                collection_node,
            ],
        }
    }

    return {
        "result": {"intent": "expense", "uiResponse": ai_layout},
        "messages": [AIMessage(content=f"[receipt] {count} expenses extracted, {fmt_total}")],
    }

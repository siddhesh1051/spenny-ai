"""POST /api/receipt/extract — Groq Vision receipt extraction."""

from __future__ import annotations

import base64
import json
import logging
import os
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from agent.constants import EXPENSE_CATEGORY_GUIDE, UI_COMPONENT_CATALOG, VALID_CATEGORIES
from agent.tools.db_tools import get_user_profile, insert_expenses
from agent.tools.groq_tools import groq_json, groq_vision_extract
from auth.supabase_jwt import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


def _fmt(amount: float, currency: str) -> str:
    return f"{currency} {amount:,.0f}"


@router.post("/receipt/extract")
async def extract_receipt(
    image: UploadFile = File(...),
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    profile = get_user_profile(user_id)
    groq_key = profile.get("groq_api_key") or os.environ.get("GROQ_API_KEY", "")
    currency = profile.get("currency") or "INR"

    if not groq_key:
        raise HTTPException(status_code=400, detail="No API key configured")

    content_type = image.content_type or "image/jpeg"
    if content_type not in ALLOWED_TYPES and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are supported")

    image_bytes = await image.read()
    if len(image_bytes) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    logger.info("extract_receipt user=%s size=%d type=%s", user_id, len(image_bytes), content_type)

    # Build base64 data URL
    b64 = base64.b64encode(image_bytes).decode()
    data_url = f"data:{content_type};base64,{b64}"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    extraction_prompt = f"""You are an expense extraction AI. Extract ALL transactions from this receipt or payment screenshot.

Today's date: {today}
Currency: {currency}. Assume that currency unless another is clearly visible.

{EXPENSE_CATEGORY_GUIDE}

EXTRACTION RULES:
1. For itemized bills: create ONE expense per meaningful line item
2. For single-total receipts (UPI screenshot, bank SMS): create ONE expense for the total
3. amount: final amount PAID (positive number)
4. description: clean, short (max 50 chars)
5. date: visible date in YYYY-MM-DD format, or null if not visible
6. If this is not a receipt/transaction return []

Return ONLY a valid JSON array — no markdown:
[
  {{"amount": number, "category": "string", "description": "string", "date": "YYYY-MM-DD or null"}}
]"""

    raw = await groq_vision_extract(data_url, extraction_prompt, groq_key)

    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            parsed = []
    except Exception:
        logger.error("Receipt JSON parse failed. Raw: %s", raw[:200])
        return {
            "intent": "conversation",
            "uiResponse": {
                "layout": {
                    "kind": "column",
                    "children": [{"kind": "block", "style": "body", "text": "I couldn't read the receipt clearly. Please try a clearer, well-lit photo."}],
                }
            },
        }

    valid = [
        e for e in parsed
        if isinstance(e.get("amount"), (int, float))
        and e["amount"] > 0
        and e.get("category") in VALID_CATEGORIES
        and isinstance(e.get("description"), str)
        and e["description"].strip()
    ]

    if not valid:
        return {
            "intent": "conversation",
            "uiResponse": {
                "layout": {
                    "kind": "column",
                    "children": [
                        {"kind": "block", "style": "subheading", "text": "No transactions found"},
                        {"kind": "block", "style": "body", "text": "Make sure it's a receipt, payment confirmation, or bank SMS screenshot."},
                    ],
                }
            },
        }

    # Save to DB
    inserted = insert_expenses(user_id, valid)
    rows = [
        {"id": r["id"], "description": r["description"], "category": r["category"], "amount": r["amount"]}
        for r in inserted
    ]
    total = sum(r["amount"] for r in rows)
    count = len(rows)

    logger.info("extract_receipt logged=%d total=%s", count, _fmt(total, currency))

    collection_node = {
        "kind": "collection",
        "variant": "items",
        "text": f"{count} expense{'s' if count != 1 else ''} extracted from your receipt!",
        "items": [
            {"id": r["id"], "label": r["description"], "badge": r["category"], "value": _fmt(r["amount"], currency)}
            for r in rows
        ],
    }

    expense_summary = "\n".join(f"- {r['description']} ({r['category']}): {_fmt(r['amount'], currency)}" for r in rows)

    mini_catalog = """
## Available UI Components
{ "kind": "column", "children": [...] }
{ "kind": "block", "style": "subheading"|"body"|"insight", "text": "..." }
{ "kind": "collection", "text": "label", "items": [...] }
Rules: column root, optional subheading before collection, no charts/tables, minimal.
""".strip()

    ai_layout = await groq_json(
        f"""You are Spenny AI. The user scanned a receipt and {count} expense{'s were' if count != 1 else ' was'} extracted, totalling {_fmt(total, currency)}.

Extracted expenses:
{expense_summary}

{mini_catalog}

Compose a concise confirmation UI. Rules:
- MUST include this exact collection node as one of the children (do not modify it):
{json.dumps(collection_node)}
- Optionally add a "block" subheading before the collection
- No insight blocks, charts, tables, or summary cards
- The collection node MUST be the last child

Return ONLY valid JSON (no markdown):
{{ "layout": {{ "kind": "column", "children": [ ...nodes including the collection node ] }} }}""",
        groq_key, temperature=0.7, max_tokens=600,
    ) or {
        "layout": {
            "kind": "column",
            "children": [
                {"kind": "block", "style": "subheading", "text": f"{count} expense{'s' if count != 1 else ''} logged"},
                collection_node,
            ],
        }
    }

    return {"intent": "expense", "uiResponse": ai_layout}

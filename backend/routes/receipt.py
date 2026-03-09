"""Receipt extraction route — vision-based expense extraction from images."""

import base64
import json
import re
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from middleware.auth import get_current_user
from services.supabase import get_service_client
from services.config import get_settings
from services.formatting import VALID_CATEGORIES, UI_COMPONENT_CATALOG

router = APIRouter(prefix="/receipt", tags=["receipt"])
_settings = get_settings()

VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
TEXT_MODEL = "llama-3.1-8b-instant"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MAX_SIZE = 10 * 1024 * 1024  # 10MB


def _clean_json(raw: str) -> str:
    return re.sub(r"```json?|```", "", raw).strip()


async def _groq_json(prompt: str, key: str, temperature: float = 0.7, max_tokens: int = 600) -> dict | None:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": TEXT_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
        )
        if not resp.is_success:
            return None
        data = resp.json()
        raw = data["choices"][0]["message"]["content"]
        try:
            return json.loads(raw)
        except Exception:
            return None


@router.post("/extract")
async def extract_receipt(
    image: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    db = get_service_client(user["token"])
    profile_result = await db.table("profiles").select("groq_api_key, currency").eq("id", user["id"]).single().execute()
    profile = profile_result.data or {}
    groq_key = profile.get("groq_api_key") or _settings.groq_api_key
    currency = profile.get("currency") or "INR"

    if not groq_key:
        raise HTTPException(status_code=400, detail="No API key configured")

    content = await image.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    mime = image.content_type or "image/jpeg"
    if not mime.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are supported")

    b64 = base64.b64encode(content).decode()
    data_url = f"data:{mime};base64,{b64}"
    today = datetime.now(timezone.utc).date().isoformat()

    extraction_prompt = f"""You are an expense extraction AI. Extract ALL transactions from this receipt or payment screenshot.

Today's date: {today}
Currency: The user's preferred currency is {currency}.

CATEGORIES — use EXACTLY one of these:
- food: restaurants, cafes, Swiggy, Zomato, takeout, snacks, delivery
- groceries: supermarket, vegetables, household items
- travel: Uber, Ola, auto, taxi, fuel, parking, flights, hotels, trains
- entertainment: movies, Netflix, Spotify, games, events
- utilities: electricity, water, gas, internet, phone bill
- rent: housing rent, PG, accommodation
- other: anything else

EXTRACTION RULES:
1. For itemized bills: create ONE expense per meaningful line item
2. For single-total receipts: create ONE expense for the total
3. amount: final amount PAID (positive number)
4. description: clean, short (max 50 chars)
5. date: extract visible date in YYYY-MM-DD format, or null if not visible
6. If this is clearly not a receipt return []

Return ONLY a valid JSON array — no markdown:
[
  {{"amount": number, "category": "string", "description": "string", "date": "YYYY-MM-DD or null"}}
]"""

    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
            json={
                "model": VISION_MODEL,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_url}},
                        {"type": "text", "text": extraction_prompt},
                    ],
                }],
                "temperature": 0.1,
                "max_tokens": 600,
            },
        )

    if not resp.is_success:
        raise HTTPException(status_code=500, detail=f"Vision API error: {resp.status_code}")

    raw_content = resp.json()["choices"][0]["message"]["content"]
    raw_content = _clean_json(raw_content)

    try:
        parsed = json.loads(raw_content)
        if not isinstance(parsed, list):
            parsed = []
    except Exception:
        return {
            "intent": "conversation",
            "uiResponse": {
                "layout": {"kind": "column", "children": [
                    {"kind": "block", "style": "body", "text": "I couldn't read the receipt clearly. Please try a clearer, well-lit photo."}
                ]}
            }
        }

    valid = [
        e for e in parsed
        if isinstance(e.get("amount"), (int, float)) and e["amount"] > 0
        and e.get("category") in VALID_CATEGORIES
        and e.get("description", "").strip()
    ]

    if not valid:
        return {
            "intent": "conversation",
            "uiResponse": {
                "layout": {"kind": "column", "children": [
                    {"kind": "block", "style": "subheading", "text": "No transactions found"},
                    {"kind": "block", "style": "body", "text": "Make sure it's a receipt, payment confirmation, or bank SMS screenshot."},
                ]}
            }
        }

    to_insert = [
        {
            "amount": e["amount"],
            "category": e["category"],
            "description": e["description"].strip()[:100],
            "date": datetime.fromisoformat(e["date"]).isoformat() if e.get("date") else datetime.now(timezone.utc).isoformat(),
            "user_id": user["id"],
        }
        for e in valid
    ]

    insert_result = await get_service_client(user["token"]).table("expenses").insert(to_insert).execute()
    rows = [
        {"id": r["id"], "description": r["description"], "category": r["category"], "amount": r["amount"]}
        for r in (insert_result.data or [])
    ]

    total = sum(r["amount"] for r in rows)
    count = len(rows)

    collection_node = {
        "kind": "collection",
        "variant": "items",
        "text": f"{count} expense{'s' if count != 1 else ''} extracted from your receipt!",
        "items": rows,
    }

    expense_summary = "\n".join(f"- {r['description']} ({r['category']}): {currency} {r['amount']}" for r in rows)

    ai_layout = await _groq_json(
        f"""You are Spenny AI. {count} expense{'s were' if count != 1 else ' was'} extracted from a receipt, totalling {currency} {total:.0f}.

Extracted expenses:
{expense_summary}

## Available UI Components (simplified)
{{ "kind": "column", "children": [...] }}
{{ "kind": "block", "style": "subheading"|"body"|"insight", "text": "..." }}
The collection node (already prepared, do not modify):
{json.dumps(collection_node)}

Compose a concise confirmation UI:
- Optionally add a "block" subheading before the collection
- Do NOT add insight/chart/table
- Collection node MUST be the last child

Return ONLY valid JSON:
{{ "layout": {{ "kind": "column", "children": [ ...nodes ] }} }}""",
        groq_key,
        0.7,
        600,
    )

    fallback_ui = {
        "layout": {
            "kind": "column",
            "children": [
                {"kind": "block", "style": "subheading", "text": f"{count} expense{'s' if count != 1 else ''} logged"},
                collection_node,
            ],
        }
    }

    return {
        "intent": "expense",
        "uiResponse": ai_layout if ai_layout else fallback_ui,
    }

"""Expense logging tool — parses natural language and inserts into DB."""

import json
import re
from datetime import datetime, timezone
from langchain_core.tools import tool
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage

from services.formatting import VALID_CATEGORIES, UI_COMPONENT_CATALOG


def _clean_json(raw: str) -> str:
    return re.sub(r"```json?|```", "", raw).strip()


async def parse_expenses(message: str, llm: ChatGroq) -> list[dict]:
    """Use LLM to extract expense entries from a natural language message."""
    prompt = f"""Extract ALL expenses from this message: "{message}"

Categories (use ONLY these): food, travel, groceries, entertainment, utilities, rent, other
- food: restaurants, cafes, takeout, delivery, snacks
- groceries: supermarket, vegetables, household items
- travel: fuel, uber, auto, taxi, bus, train, flights, hotels, parking
- entertainment: movies, games, netflix, spotify, hobbies
- utilities: electricity, water, gas, internet, phone bill
- rent: rent, accommodation
- other: anything else

Return ONLY a JSON array (no markdown):
[{{"amount": number, "category": string, "description": string}}]

Rules:
- amount must be a positive number
- description: clean short name (max 50 chars), capitalize first letter
- Extract EVERY expense mentioned"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    try:
        parsed = json.loads(_clean_json(response.content))
        if not isinstance(parsed, list):
            return []
        return [
            e for e in parsed
            if isinstance(e.get("amount"), (int, float))
            and e["amount"] > 0
            and e.get("category") in VALID_CATEGORIES
            and e.get("description", "").strip()
        ]
    except Exception:
        return []


async def build_expense_ui(rows: list[dict], total: float, currency: str, llm: ChatGroq) -> dict:
    """Ask the LLM to compose a confirmation UI layout."""
    summary = "\n".join(f"- {r['description']} ({r['category']}): {currency} {r['amount']}" for r in rows)
    collection_node = {
        "kind": "collection",
        "variant": "items",
        "text": f"{len(rows)} expense{'s' if len(rows) > 1 else ''} logged successfully!",
        "items": rows,
    }

    prompt = f"""You are Spenny AI. The user just logged {len(rows)} expense{'s' if len(rows) > 1 else ''} totalling {currency} {total:.0f}.

Logged expenses:
{summary}

{UI_COMPONENT_CATALOG}

Compose a concise confirmation UI. Rules:
- MUST include this exact collection node as one of the children (do not modify it):
{json.dumps(collection_node)}
- Optionally add a "block" subheading before the collection
- Do NOT add a "block" with style "insight"
- Do NOT add charts, tables, or summary cards
- Keep it minimal and celebratory
- The collection node MUST be the last child

Return ONLY valid JSON (no markdown):
{{ "layout": {{ "kind": "column", "children": [ ...nodes including the collection node ] }} }}"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    try:
        result = json.loads(_clean_json(response.content))
        return result
    except Exception:
        return {
            "layout": {
                "kind": "column",
                "children": [
                    {"kind": "block", "style": "subheading", "text": f"{len(rows)} expense{'s' if len(rows) > 1 else ''} logged"},
                    collection_node,
                ],
            }
        }

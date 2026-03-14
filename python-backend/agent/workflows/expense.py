"""Expense agentic workflow — extract → categorize → execute → respond.

Four specialised agents that each own one step of the expense pipeline:
1. Extraction Agent  — pulls raw amounts / descriptions from the message
2. Category Agent    — assigns the best-fit category to each item
3. Execution Agent   — writes validated rows to the database
4. Response Agent    — builds a rich UI layout (web) or plain text (messaging)
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage

from agent.channels.formatter import format_expense_text
from agent.constants import (
    EXPENSE_CATEGORY_GUIDE,
    UI_COMPONENT_CATALOG,
    VALID_CATEGORIES,
)
from agent.tools.db_tools import insert_expenses
from agent.tools.groq_tools import FAST_MODEL, groq_json

logger = logging.getLogger(__name__)


def _fmt(amount: float, currency: str) -> str:
    return f"{currency} {amount:,.0f}"


def _last_human_text(state: dict) -> str:
    return next(
        (m.content for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        "",
    )


# ── Agent 1: Extraction ──────────────────────────────────────────────────────

async def expense_extract_agent(state: dict) -> dict:
    """Pull every expense mention from the user message.

    Output: list of ``{amount, description, date?}`` — no categories yet.
    Uses the fast 8B model to keep latency and rate-limit usage low.
    """
    message = _last_human_text(state)

    parsed = await groq_json(
        f"""Extract ALL expenses from this message: "{message}"

Return ONLY a JSON array (no markdown):
[{{"amount": number, "description": string, "date": "YYYY-MM-DD or null"}}]

Rules:
- amount must be a positive number
- description: clean short name (max 50 chars), capitalize first letter
- date: extract if mentioned, otherwise null
- Extract EVERY expense mentioned""",
        state["groq_key"],
        temperature=0.1,
        max_tokens=400,
        model=FAST_MODEL,
    )

    valid = [
        e
        for e in (parsed or [])
        if isinstance(e.get("amount"), (int, float))
        and e["amount"] > 0
        and isinstance(e.get("description"), str)
        and e["description"].strip()
    ]

    logger.info("expense_extract: found %d items from '%.60s'", len(valid), message)
    return {"extracted_expenses": valid}


# ── Agent 2: Categorisation ──────────────────────────────────────────────────

async def expense_categorize_agent(state: dict) -> dict:
    """Assign the most accurate category to each extracted expense.

    Runs independently from extraction so it can apply the full category
    guide with priority-override rules without bloating the extraction prompt.
    """
    expenses = state.get("extracted_expenses", [])
    if not expenses:
        return {"categorized_expenses": []}

    descriptions = "\n".join(
        f"- \"{e['description']}\": {e['amount']}" for e in expenses
    )

    result = await groq_json(
        f"""Assign the BEST category to each expense.

{EXPENSE_CATEGORY_GUIDE}

Expenses to categorize:
{descriptions}

Return ONLY a JSON array with the category added (no markdown):
[{{"amount": number, "description": string, "category": string, "date": string_or_null}}]

Rules:
- Use ONLY categories from the list above
- Apply the PRIORITY OVERRIDE RULES strictly
- Each expense must have exactly one category""",
        state["groq_key"],
        temperature=0.0,
        max_tokens=500,
        model=FAST_MODEL,
    )

    if not result:
        result = [{**e, "category": "Other"} for e in expenses]

    # Merge dates from the extraction step when the categoriser drops them
    date_map = {(e["description"], e["amount"]): e.get("date") for e in expenses}
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

    logger.info("expense_categorize: %d valid items", len(valid))
    return {"categorized_expenses": valid}


# ── Agent 3: Execution ───────────────────────────────────────────────────────

async def expense_execute_agent(state: dict) -> dict:
    """Persist categorised expenses to the database.

    No LLM call — pure DB write + fire-and-forget RAG embedding.
    """
    expenses = state.get("categorized_expenses", [])

    if not expenses:
        return {
            "inserted_expenses": [],
            "result": {
                "intent": "conversation",
                "text": (
                    "I couldn't find any expenses in your message. "
                    'Try something like: "Spent 500 on groceries" or "Coffee 50, Uber 200"'
                ),
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

    logger.info("expense_execute: inserted %d rows", len(rows))
    return {"inserted_expenses": rows}


# ── Agent 4: Response builder ────────────────────────────────────────────────

async def expense_respond_agent(state: dict) -> dict:
    """Build the final response — rich UI for web, plain text for messaging."""
    rows = state.get("inserted_expenses", [])
    channel = state.get("channel", "web")
    currency = state.get("currency", "INR")
    groq_key = state["groq_key"]

    if not rows:
        existing = state.get("result")
        fallback_text = (existing or {}).get("text", "No expenses found.")
        return {
            "result": existing or {"intent": "conversation", "text": fallback_text},
            "messages": [AIMessage(content=fallback_text)],
            "text_response": fallback_text,
        }

    total = sum(r["amount"] for r in rows)
    fmt_total = _fmt(total, currency)

    # ── Messaging channels: quick text ────────────────────────────────────
    if channel != "web":
        text = format_expense_text(rows, currency)
        return {
            "result": {"intent": "expense", "text": text},
            "text_response": text,
            "messages": [AIMessage(content=f"[expense logged] {len(rows)} expenses, {fmt_total}")],
        }

    # ── Web channel: rich UI ──────────────────────────────────────────────
    collection_node: dict[str, Any] = {
        "kind": "collection",
        "variant": "items",
        "text": f"{len(rows)} expense{'s' if len(rows) > 1 else ''} logged successfully!",
        "items": rows,
    }

    expense_summary = "\n".join(
        f"- {r['description']} ({r['category']}): {_fmt(r['amount'], currency)}"
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

    fallback_layout = {
        "layout": {
            "kind": "column",
            "children": [
                {
                    "kind": "block",
                    "style": "subheading",
                    "text": f"{len(rows)} expense{'s' if len(rows) > 1 else ''} logged",
                },
                collection_node,
            ],
        }
    }

    reply = f"[expense logged] {len(rows)} expenses totalling {fmt_total}"
    return {
        "result": {"intent": "expense", "uiResponse": ai_layout or fallback_layout},
        "messages": [AIMessage(content=reply)],
    }

"""Query agentic workflow — extract → execute → respond.

Three specialised agents:
1. Extraction Agent  — derives structured filters from the natural-language question
2. Execution Agent   — runs the DB query and computes analytics
3. Response Agent    — builds a rich UI layout (web) or plain text (messaging)
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage

from agent.channels.formatter import format_query_text
from agent.constants import UI_COMPONENT_CATALOG
from agent.tools.db_tools import query_expenses
from agent.tools.groq_tools import FAST_MODEL, groq_json

logger = logging.getLogger(__name__)


def _fmt(amount: float, currency: str) -> str:
    return f"{currency} {amount:,.0f}"


def _last_human_text(state: dict) -> str:
    return next(
        (m.content for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        "",
    )


# ── Agent 1: Filter extraction ───────────────────────────────────────────────

async def query_extract_agent(state: dict) -> dict:
    """Parse the user's question into structured query filters.

    Uses the fast model with a detailed date-reference prompt so it can
    resolve relative time expressions ("last month", "this week", etc.).
    """
    message = _last_human_text(state)
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    this_month_start = now.strftime("%Y-%m-01")

    last_m = datetime(
        now.year if now.month > 1 else now.year - 1,
        now.month - 1 if now.month > 1 else 12,
        1,
        tzinfo=timezone.utc,
    )
    last_m_end = datetime(now.year, now.month, 1, tzinfo=timezone.utc) - timedelta(days=1)
    seven_ago = (now - timedelta(days=6)).strftime("%Y-%m-%d")
    thirty_ago = (now - timedelta(days=29)).strftime("%Y-%m-%d")
    ninety_ago = (now - timedelta(days=89)).strftime("%Y-%m-%d")
    six_months_ago = (now - timedelta(days=182)).strftime("%Y-%m-%d")
    one_year_ago = (now - timedelta(days=364)).strftime("%Y-%m-%d")

    result = await groq_json(
        f"""Today: {today}
This month: {this_month_start} to {today}
Last month: {last_m.strftime('%Y-%m-%d')} to {last_m_end.strftime('%Y-%m-%d')}
Last 7 days: {seven_ago} to {today}
Last 30 days: {thirty_ago} to {today}
Last 3 months: {ninety_ago} to {today}
Last 6 months: {six_months_ago} to {today}
Last 1 year: {one_year_ago} to {today}

Extract query filters from: "{message}"
Available categories: Food & Dining, Groceries, Travel, Entertainment, Utilities, Rent, Shopping, Education, Investments, Healthcare, Subscriptions, Other

Return ONLY valid JSON (no markdown):
{{
  "start_date": "YYYY-MM-DD" or null,
  "end_date": "YYYY-MM-DD" or null,
  "category": "Food & Dining"|...|"Other" or null,
  "min_amount": number or null,
  "max_amount": number or null,
  "sort_by": "date" or "amount",
  "sort_order": "asc" or "desc",
  "limit": number or null,
  "group_by": "category" or "day" or "week" or "month" or null,
  "search_description": string or null
}}

Rules:
- "this month" → {this_month_start} to {today}
- "last month" → full previous month
- "last 7 days"/"this week" → {seven_ago} to {today}
- "last 30 days" → {thirty_ago} to {today}
- "last 3 months" → {ninety_ago} to {today}
- "last 6 months" → {six_months_ago} to {today}
- "last year" → {one_year_ago} to {today}
- "till date"/"all time" → start_date=null, end_date=null
- "biggest"/"top N" → sort_by=amount, sort_order=desc, limit=N
- "trend"/"over time" → group_by="month"
- No date, no explicit count → limit=null""",
        state["groq_key"],
        temperature=0,
        max_tokens=300,
        model=FAST_MODEL,
    )

    defaults: dict[str, Any] = {
        "start_date": None,
        "end_date": None,
        "category": None,
        "min_amount": None,
        "max_amount": None,
        "sort_by": "date",
        "sort_order": "desc",
        "limit": None,
        "group_by": None,
        "search_description": None,
    }

    if not result:
        return {"query_filters": defaults}

    valid_cats = {
        "Food & Dining", "Groceries", "Travel", "Entertainment", "Utilities",
        "Rent", "Shopping", "Education", "Investments", "Healthcare",
        "Subscriptions", "Other",
    }
    raw_limit = result.get("limit")

    filters = {
        "start_date": result.get("start_date") or None,
        "end_date": result.get("end_date") or None,
        "category": result.get("category") if result.get("category") in valid_cats else None,
        "min_amount": result.get("min_amount"),
        "max_amount": result.get("max_amount"),
        "sort_by": result.get("sort_by") if result.get("sort_by") in {"date", "amount"} else "date",
        "sort_order": result.get("sort_order") if result.get("sort_order") in {"asc", "desc"} else "desc",
        "limit": int(raw_limit) if raw_limit is not None else None,
        "group_by": result.get("group_by") if result.get("group_by") in {"category", "day", "week", "month", None} else None,
        "search_description": result.get("search_description") or None,
    }

    logger.info("query_extract: filters=%s", filters)
    return {"query_filters": filters}


# ── Agent 2: Execution + analytics ───────────────────────────────────────────

async def query_execute_agent(state: dict) -> dict:
    """Run the database query and compute summary analytics.

    No LLM call — pure DB + arithmetic.
    """
    filters = state.get("query_filters", {})
    user_id = state["user_id"]
    currency = state.get("currency", "INR")

    expenses = query_expenses(
        user_id,
        start_date=filters.get("start_date"),
        end_date=filters.get("end_date"),
        category=filters.get("category"),
        min_amount=filters.get("min_amount"),
        max_amount=filters.get("max_amount"),
        search_description=filters.get("search_description"),
        sort_by=filters.get("sort_by", "date"),
        sort_order=filters.get("sort_order", "desc"),
        limit=filters.get("limit"),
    )

    if not expenses:
        return {
            "query_results": [],
            "query_analytics": {"total": 0, "count": 0, "category_breakdown": []},
        }

    total = sum(e["amount"] for e in expenses)

    # Category breakdown
    by_cat: dict[str, dict] = {}
    for e in expenses:
        cat = e["category"]
        if cat not in by_cat:
            by_cat[cat] = {"total": 0, "count": 0}
        by_cat[cat]["total"] += e["amount"]
        by_cat[cat]["count"] += 1

    cat_breakdown = sorted(
        [
            {
                "category": c,
                "total": round(d["total"]),
                "count": d["count"],
                "percentage": round(d["total"] / total * 100) if total else 0,
            }
            for c, d in by_cat.items()
        ],
        key=lambda x: -x["total"],
    )

    # Daily aggregation
    by_day: dict[str, float] = {}
    for e in expenses:
        day = e["date"][:10]
        by_day[day] = by_day.get(day, 0) + e["amount"]
    daily_points = [
        {"label": datetime.fromisoformat(d).strftime("%b %d"), "value": round(v)}
        for d, v in sorted(by_day.items())
    ]

    # Weekly aggregation
    by_week: dict[str, float] = {}
    for e in expenses:
        d = datetime.fromisoformat(e["date"][:10])
        week_start = (d - timedelta(days=d.weekday())).strftime("%Y-%m-%d")
        by_week[week_start] = by_week.get(week_start, 0) + e["amount"]
    weekly_points = [
        {"label": datetime.fromisoformat(d).strftime("%b %d"), "value": round(v)}
        for d, v in sorted(by_week.items())
    ]

    # Period label for messaging
    start = filters.get("start_date", "")
    end = filters.get("end_date", "")
    period_label = ""
    if start and end:
        period_label = f"{start} to {end}"
    elif start:
        period_label = f"from {start}"
    elif end:
        period_label = f"until {end}"

    analytics = {
        "total": total,
        "count": len(expenses),
        "category_breakdown": cat_breakdown,
        "category_points": [
            {"label": c["category"], "value": c["total"], "share": c["percentage"]}
            for c in cat_breakdown
        ],
        "daily_points": daily_points,
        "weekly_points": weekly_points,
        "period_label": period_label,
    }

    logger.info("query_execute: %d results, total=%s", len(expenses), _fmt(total, currency))
    return {"query_results": expenses, "query_analytics": analytics}


# ── Agent 3: Response builder ────────────────────────────────────────────────

async def query_respond_agent(state: dict) -> dict:
    """Build the final query response — rich UI or plain text."""
    expenses = state.get("query_results", [])
    analytics = state.get("query_analytics", {})
    channel = state.get("channel", "web")
    currency = state.get("currency", "INR")
    groq_key = state["groq_key"]
    message = _last_human_text(state)

    # ── Empty state ───────────────────────────────────────────────────────
    if not expenses:
        empty_text = "No expenses found for that query. Start logging expenses to see them here!"
        if channel != "web":
            return {
                "result": {"intent": "query", "text": empty_text},
                "text_response": empty_text,
                "messages": [AIMessage(content=empty_text)],
            }

        ui = await groq_json(
            f"""You are Spenny AI. The user asked: "{message}" but no matching expenses were found.

{UI_COMPONENT_CATALOG}

Create a friendly empty-state UI using only "block" nodes. No charts, no tables.
Return ONLY valid JSON: {{ "layout": {{ "kind": "column", "children": [...] }} }}""",
            groq_key,
            temperature=0.7,
            max_tokens=200,
        ) or {
            "layout": {
                "kind": "column",
                "children": [
                    {"kind": "block", "style": "subheading", "text": "No results"},
                    {"kind": "block", "style": "body", "text": empty_text},
                ],
            }
        }
        return {
            "result": {"intent": "query", "uiResponse": ui},
            "messages": [AIMessage(content=empty_text)],
        }

    total = analytics["total"]
    fmt_total = _fmt(total, currency)
    cat_breakdown = analytics.get("category_breakdown", [])

    # ── Messaging channels ────────────────────────────────────────────────
    if channel != "web":
        # Generate a short insight line with the fast model
        cat_summary = ", ".join(
            f"{c['category']}: {_fmt(c['total'], currency)}" for c in cat_breakdown[:4]
        )
        insight = await _generate_text_insight(message, fmt_total, len(expenses), cat_summary, groq_key)
        analytics_with_insight = {**analytics, "insight_text": insight}
        text = format_query_text(analytics_with_insight, expenses, currency)
        return {
            "result": {"intent": "query", "text": text},
            "text_response": text,
            "messages": [AIMessage(content=f"[query] {text[:120]}")],
        }

    # ── Web: rich UI ──────────────────────────────────────────────────────
    cat_summary = ", ".join(
        f"{c['category']}: {_fmt(c['total'], currency)} ({c['count']} txns, {c['percentage']}%)"
        for c in cat_breakdown
    )

    sample_lines = "\n".join(
        f"{e['date'][:10]} | {e['category']} | {e['description']} | {_fmt(e['amount'], currency)}"
        for e in expenses[:20]
    )

    user_asked_for_list = bool(
        re.search(r"\b(list|show|display|all|transactions?|records?|history)\b", message, re.I)
    )

    expense_rows = [
        {"id": e["id"], "date": e["date"], "description": e["description"], "category": e["category"], "amount": e["amount"]}
        for e in expenses[:50]
    ]

    ui = await groq_json(
        f"""You are Spenny AI answering a spending query. User asked: "{message}"

## Data available to you

Total: {fmt_total} across {len(expenses)} transactions
Category breakdown:
{cat_summary}
Sample transactions (up to 20):
{sample_lines}{f"\\n...and {len(expenses) - 20} more" if len(expenses) > 20 else ""}
User explicitly asked for a list/transactions: {user_asked_for_list}
Full transaction rows available (for table node): {json.dumps(expense_rows)}

## Chart-ready data points
Category points (for pie or bars): {json.dumps(analytics.get("category_points", []))}
Daily points (for area chart): {json.dumps(analytics.get("daily_points", []))}
Weekly points (for area chart): {json.dumps(analytics.get("weekly_points", []))}

{UI_COMPONENT_CATALOG}

## Your task
Design the best UI layout. Choose:
- Metric summary cards (most relevant)
- Chart type: "area" with dailyPoints/weeklyPoints for trends, "pie" for category proportion, "bars" for comparisons — skip if only 1 data point
- Table ONLY if user explicitly asked for list/transactions
- An "insight" block at the end (2 sentences: answer + observation)

Return ONLY valid JSON (no markdown):
{{ "layout": {{ "kind": "column", "children": [ ...nodes ] }} }}""",
        groq_key,
        temperature=0.7,
        max_tokens=1200,
    ) or {
        "layout": {
            "kind": "column",
            "children": [
                {"kind": "block", "style": "subheading", "text": "Your expenses"},
                {
                    "kind": "row",
                    "children": [
                        {"kind": "summary", "id": "total", "heading": "Total", "primary": fmt_total, "secondary": None, "sentiment": "neutral"},
                        {"kind": "summary", "id": "txns", "heading": "Transactions", "primary": str(len(expenses)), "secondary": None, "sentiment": "neutral"},
                    ],
                },
                {"kind": "block", "style": "insight", "text": f"Found {len(expenses)} transactions totalling {fmt_total}."},
            ],
        }
    }

    reply = f"[query response] {fmt_total} across {len(expenses)} transactions"
    return {
        "result": {"intent": "query", "uiResponse": ui},
        "messages": [AIMessage(content=reply)],
    }


async def _generate_text_insight(
    question: str, total: str, count: int, cat_summary: str, groq_key: str,
) -> str:
    """Generate a one-line insight for messaging channels."""
    from agent.tools.groq_tools import groq_chat

    try:
        return await groq_chat(
            f"""User asked: "{question}"
Data: {total} total, {count} transactions. Categories: {cat_summary}
Write ONE short insightful sentence (max 30 words) answering the user and adding a useful observation. No emoji.""",
            groq_key,
            temperature=0.5,
            max_tokens=60,
            model=FAST_MODEL,
        )
    except Exception:
        return f"You spent {total} across {count} transactions."

"""Query node — fetch expense data and render a UI layout."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from agent.constants import UI_COMPONENT_CATALOG
from agent.tools.db_tools import query_expenses
from agent.tools.groq_tools import groq_json

logger = logging.getLogger(__name__)


def _fmt(amount: float, currency: str) -> str:
    return f"{currency} {amount:,.0f}"


async def _get_query_filters(question: str, groq_key: str) -> dict:
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    this_month_start = now.strftime("%Y-%m-01")
    last_m = datetime(now.year, now.month - 1 if now.month > 1 else 12, 1,
                      tzinfo=timezone.utc) if now.month > 1 else datetime(now.year - 1, 12, 1, tzinfo=timezone.utc)
    last_m_end = datetime(now.year, now.month, 1, tzinfo=timezone.utc) - timedelta(days=1)
    seven_ago = (now - timedelta(days=6)).strftime("%Y-%m-%d")
    thirty_ago = (now - timedelta(days=29)).strftime("%Y-%m-%d")
    ninety_ago = (now - timedelta(days=89)).strftime("%Y-%m-%d")
    six_months_ago = (now - timedelta(days=182)).strftime("%Y-%m-%d")
    one_year_ago = (now - timedelta(days=364)).strftime("%Y-%m-%d")

    defaults = {
        "start_date": None, "end_date": None, "category": None,
        "min_amount": None, "max_amount": None,
        "sort_by": "date", "sort_order": "desc",
        "limit": None, "group_by": None, "search_description": None,
    }

    result = await groq_json(
        f"""Today: {today}
This month: {this_month_start} to {today}
Last month: {last_m.strftime('%Y-%m-%d')} to {last_m_end.strftime('%Y-%m-%d')}
Last 7 days: {seven_ago} to {today}
Last 30 days: {thirty_ago} to {today}
Last 3 months: {ninety_ago} to {today}
Last 6 months: {six_months_ago} to {today}
Last 1 year: {one_year_ago} to {today}

Extract query filters from: "{question}"
Available categories: Food & Dining, Groceries, Travel, Entertainment, Utilities, Rent, Shopping, Education, Investments, Healthcare, Subscriptions, Other

Return ONLY valid JSON (no markdown):
{{
  "start_date": "YYYY-MM-DD" or null,
  "end_date": "YYYY-MM-DD" or null,
  "category": "Food & Dining"|"Groceries"|...|"Other" or null,
  "min_amount": number or null,
  "max_amount": number or null,
  "sort_by": "date" or "amount",
  "sort_order": "asc" or "desc",
  "limit": number or null (ONLY set when user says "top N", "show N", "last N" — otherwise null to fetch ALL matching),
  "group_by": "category" or "day" or "week" or "month" or null,
  "search_description": string or null
}}

Rules:
- "this month" → {this_month_start} to {today}
- "last month" → full previous month
- "last 7 days"/"this week" → {seven_ago} to {today}
- "last 30 days" / "1 month" → {thirty_ago} to {today}
- "last 3 months" / "3 months" → {ninety_ago} to {today}
- "last 5 months" / "5 months" → compute: 5*30=150 days ago to {today}
- "last 6 months" / "6 months" → {six_months_ago} to {today}
- "last year" / "12 months" → {one_year_ago} to {today}
- "till date" / "to date" / "all time" / "since beginning" → start_date=null, end_date=null (no filter = all data)
- "today" → only today
- "biggest"/"top N" → sort_by=amount, sort_order=desc, limit=N
- "recent"/"latest" → sort_by=date, sort_order=desc
- "trend" / "chart" / "over time" → group_by="month" (unless finer granularity makes sense)
- "all"/"every" → limit=null (fetch everything)
- No date mentioned and no explicit count → limit=null""",
        groq_key,
        temperature=0,
        max_tokens=300,
    )

    if not result:
        return defaults

    valid_sort_by = {"date", "amount"}
    valid_sort_order = {"asc", "desc"}
    valid_group_by = {"category", "day", "week", "month", None}
    valid_categories = {
        "Food & Dining", "Groceries", "Travel", "Entertainment", "Utilities",
        "Rent", "Shopping", "Education", "Investments", "Healthcare", "Subscriptions", "Other",
    }

    raw_limit = result.get("limit")
    limit_val = int(raw_limit) if raw_limit is not None else None

    return {
        "start_date": result.get("start_date") or None,
        "end_date": result.get("end_date") or None,
        "category": result.get("category") if result.get("category") in valid_categories else None,
        "min_amount": result.get("min_amount"),
        "max_amount": result.get("max_amount"),
        "sort_by": result.get("sort_by") if result.get("sort_by") in valid_sort_by else "date",
        "sort_order": result.get("sort_order") if result.get("sort_order") in valid_sort_order else "desc",
        "limit": limit_val,
        "group_by": result.get("group_by") if result.get("group_by") in valid_group_by else None,
        "search_description": result.get("search_description") or None,
    }


async def handle_query(
    message: str,
    user_id: str,
    groq_key: str,
    currency: str = "INR",
) -> dict[str, Any]:
    filters = await _get_query_filters(message, groq_key)
    logger.info("Query filters: %s", filters)

    expenses = query_expenses(
        user_id,
        start_date=filters["start_date"],
        end_date=filters["end_date"],
        category=filters["category"],
        min_amount=filters["min_amount"],
        max_amount=filters["max_amount"],
        search_description=filters["search_description"],
        sort_by=filters["sort_by"],
        sort_order=filters["sort_order"],
        limit=filters["limit"],
    )

    if not expenses:
        ui = await groq_json(
            f"""You are Spenny AI. The user asked: "{message}" but no matching expenses were found.

{UI_COMPONENT_CATALOG}

Create a friendly empty-state UI using only "block" nodes. No charts, no tables.
Return ONLY valid JSON: {{ "layout": {{ "kind": "column", "children": [...] }} }}""",
            groq_key, temperature=0.7, max_tokens=200,
        ) or {
            "layout": {
                "kind": "column",
                "children": [
                    {"kind": "block", "style": "subheading", "text": "No results"},
                    {"kind": "block", "style": "body", "text": "No expenses found for that query. Start logging expenses to see them here!"},
                ],
            }
        }
        return {"intent": "query", "uiResponse": ui}

    total = sum(e["amount"] for e in expenses)
    fmt_total = _fmt(total, currency)

    # Category breakdown
    by_cat: dict[str, dict] = {}
    for e in expenses:
        cat = e["category"]
        if cat not in by_cat:
            by_cat[cat] = {"total": 0, "count": 0}
        by_cat[cat]["total"] += e["amount"]
        by_cat[cat]["count"] += 1
    cat_breakdown = sorted(by_cat.items(), key=lambda x: -x[1]["total"])
    cat_summary = ", ".join(
        f"{c}: {_fmt(d['total'], currency)} ({d['count']} txns, {round(d['total']/total*100)}%)"
        for c, d in cat_breakdown
    )

    sample_lines = "\n".join(
        f"{e['date'][:10]} | {e['category']} | {e['description']} | {_fmt(e['amount'], currency)}"
        for e in expenses[:20]
    )

    # Category points for charts
    category_points = [
        {"label": c, "value": round(d["total"]), "share": round(d["total"] / total * 100)}
        for c, d in cat_breakdown
    ]

    # Daily points
    by_day: dict[str, float] = {}
    for e in expenses:
        day = e["date"][:10]
        by_day[day] = by_day.get(day, 0) + e["amount"]
    daily_points = [
        {"label": datetime.fromisoformat(d).strftime("%b %d"), "value": round(v)}
        for d, v in sorted(by_day.items())
    ]

    # Weekly points
    by_week: dict[str, float] = {}
    for e in expenses:
        d = datetime.fromisoformat(e["date"][:10])
        day_of_week = d.weekday()
        week_start = (d - timedelta(days=day_of_week)).strftime("%Y-%m-%d")
        by_week[week_start] = by_week.get(week_start, 0) + e["amount"]
    weekly_points = [
        {"label": datetime.fromisoformat(d).strftime("%b %d"), "value": round(v)}
        for d, v in sorted(by_week.items())
    ]

    user_asked_for_list = bool(
        __import__("re").search(r"\b(list|show|display|all|transactions?|records?|history)\b", message, __import__("re").I)
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
{sample_lines}{f"\n...and {len(expenses) - 20} more" if len(expenses) > 20 else ""}
User explicitly asked for a list/transactions: {user_asked_for_list}
Full transaction rows available (for table node): {json.dumps(expense_rows)}

## Chart-ready data points
Category points (for pie or bars): {json.dumps(category_points)}
Daily points (for area chart): {json.dumps(daily_points)}
Weekly points (for area chart): {json.dumps(weekly_points)}

{UI_COMPONENT_CATALOG}

## Your task
Design the best UI layout. Choose:
- Metric summary cards (most relevant)
- Chart type: "area" with dailyPoints/weeklyPoints for trends, "pie" for category proportion, "bars" for comparisons — skip if only 1 data point
- Table ONLY if user explicitly asked for list/transactions
- An "insight" block at the end (2 sentences: answer + observation)

Return ONLY valid JSON (no markdown):
{{ "layout": {{ "kind": "column", "children": [ ...nodes ] }} }}""",
        groq_key, temperature=0.7, max_tokens=1200,
    ) or {
        "layout": {
            "kind": "column",
            "children": [
                {"kind": "block", "style": "subheading", "text": "Your expenses"},
                {"kind": "row", "children": [
                    {"kind": "summary", "id": "total", "heading": "Total", "primary": fmt_total, "secondary": None, "sentiment": "neutral"},
                    {"kind": "summary", "id": "txns", "heading": "Transactions", "primary": str(len(expenses)), "secondary": None, "sentiment": "neutral"},
                ]},
                {"kind": "block", "style": "insight", "text": f"Found {len(expenses)} transactions totalling {fmt_total}."},
            ],
        }
    }

    return {"intent": "query", "uiResponse": ui}

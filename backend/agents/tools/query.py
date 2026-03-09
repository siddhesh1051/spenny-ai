"""Query tool — extracts filters, queries DB, and builds a rich UI layout."""

import json
import re
from datetime import datetime, timezone, timedelta
from langchain_core.messages import HumanMessage
from langchain_groq import ChatGroq

from services.formatting import UI_COMPONENT_CATALOG

_VALID_SORT_BY = {"date", "amount"}
_VALID_SORT_ORDER = {"asc", "desc"}
_VALID_GROUP_BY = {"category", "day", "week", "month", None}
_VALID_CATEGORIES = ["food", "travel", "groceries", "entertainment", "utilities", "rent", "other"]


def _clean_json(raw: str) -> str:
    return re.sub(r"```json?|```", "", raw).strip()


def _date_context() -> str:
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    month_start = now.replace(day=1).date().isoformat()
    last_m_start = (now.replace(day=1) - timedelta(days=1)).replace(day=1).date().isoformat()
    last_m_end = (now.replace(day=1) - timedelta(days=1)).date().isoformat()
    seven_ago = (now - timedelta(days=6)).date().isoformat()
    thirty_ago = (now - timedelta(days=29)).date().isoformat()
    month_name = now.strftime("%B %Y")
    return f"""Today: {today}
This month ({month_name}): {month_start} to {today}
Last month: {last_m_start} to {last_m_end}
Last 7 days: {seven_ago} to {today}
Last 30 days: {thirty_ago} to {today}"""


async def get_query_filters(question: str, llm: ChatGroq, conversation_history: str = "") -> dict:
    defaults = {
        "start_date": None, "end_date": None, "category": None,
        "min_amount": None, "max_amount": None,
        "sort_by": "date", "sort_order": "desc",
        "limit": 100, "group_by": None, "search_description": None,
    }

    history_section = f"\nRecent conversation (for resolving references like 'those', 'same period', 'travel ones'):\n{conversation_history}\n" if conversation_history else ""

    prompt = f"""{_date_context()}
{history_section}
Extract query filters from: "{question}"
Available categories: food, travel, groceries, entertainment, utilities, rent, other

Return ONLY valid JSON (no markdown):
{{
  "start_date": "YYYY-MM-DD" or null,
  "end_date": "YYYY-MM-DD" or null,
  "category": "food"|"travel"|"groceries"|"entertainment"|"utilities"|"rent"|"other" or null,
  "min_amount": number or null,
  "max_amount": number or null,
  "sort_by": "date" or "amount",
  "sort_order": "asc" or "desc",
  "limit": number (1-200, default 100),
  "group_by": "category" or "day" or "week" or "month" or null,
  "search_description": string or null
}}

Rules:
- "this month" / "current month" → current month
- "last month" → full previous month
- "this week" / "last 7 days" → last 7 days
- "last 30 days" → last 30 days
- "today" → only today
- "biggest" / "top" / "most" → sort_by=amount, sort_order=desc
- "recent" / "latest" → sort_by=date, sort_order=desc
- "by category" / "breakdown" → group_by=category
- "per week" / "weekly" → group_by=week
- No date mentioned → null"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    try:
        result = json.loads(_clean_json(response.content))
        return {
            "start_date": result.get("start_date"),
            "end_date": result.get("end_date"),
            "category": result.get("category") if result.get("category") in _VALID_CATEGORIES else None,
            "min_amount": result.get("min_amount"),
            "max_amount": result.get("max_amount"),
            "sort_by": result.get("sort_by") if result.get("sort_by") in _VALID_SORT_BY else "date",
            "sort_order": result.get("sort_order") if result.get("sort_order") in _VALID_SORT_ORDER else "desc",
            "limit": min(max(int(result.get("limit") or 100), 1), 200),
            "group_by": result.get("group_by") if result.get("group_by") in _VALID_GROUP_BY else None,
            "search_description": result.get("search_description"),
        }
    except Exception:
        return defaults


async def build_query_ui(
    question: str,
    expenses: list[dict],
    filters: dict,
    currency: str,
    llm: ChatGroq,
) -> dict:
    total = sum(e["amount"] for e in expenses)

    # Category breakdown
    by_cat: dict[str, dict] = {}
    for e in expenses:
        c = e["category"]
        if c not in by_cat:
            by_cat[c] = {"total": 0, "count": 0}
        by_cat[c]["total"] += e["amount"]
        by_cat[c]["count"] += 1

    cat_breakdown = sorted(by_cat.items(), key=lambda x: -x[1]["total"])
    cat_summary = ", ".join(
        f"{c}: {currency} {v['total']:.0f} ({v['count']} txns, {round(v['total'] / total * 100) if total else 0}%)"
        for c, v in cat_breakdown
    )

    sample_lines = "\n".join(
        f"{e['date'][:10]} | {e['category']} | {e['description']} | {currency} {e['amount']}"
        for e in expenses[:20]
    )
    user_asked_list = bool(re.search(r"\b(list|show|display|all|transactions?|records?|history)\b", question, re.I))
    expense_rows = [
        {"id": e["id"], "date": e["date"], "description": e["description"],
         "category": e["category"], "amount": e["amount"]}
        for e in expenses[:50]
    ]

    prompt = f"""You are Spenny AI answering a spending query. User asked: "{question}"

## Data available to you

Total: {currency} {total:.0f} across {len(expenses)} transactions
Category breakdown: {cat_summary}
Sample transactions (up to 20):
{sample_lines}{f"{chr(10)}...and {len(expenses) - 20} more" if len(expenses) > 20 else ""}
User explicitly asked for a list/transactions: {user_asked_list}
Full transaction rows available (for table node): {json.dumps(expense_rows)}

{UI_COMPONENT_CATALOG}

## Your task
Design the best UI layout to answer this question. You decide:
- Which metric summary cards to show
- Whether to show a chart (donut for ≤5 categories, bars for >5) — skip if only 1 category
- Whether to show a table (ONLY if user explicitly asked for list/transactions)
- What insight text to write (always include an "insight" block)
- How to label sections

Return ONLY valid JSON (no markdown):
{{ "layout": {{ "kind": "column", "children": [ ...nodes ] }} }}"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    try:
        return json.loads(_clean_json(response.content))
    except Exception:
        # Fallback
        title = filters.get("category", "").capitalize() + " expenses" if filters.get("category") else "Your expenses"
        return {
            "layout": {
                "kind": "column",
                "children": [
                    {"kind": "block", "style": "subheading", "text": title},
                    {"kind": "row", "children": [
                        {"kind": "summary", "id": "total", "heading": "Total", "primary": f"{currency} {total:.0f}", "secondary": None, "sentiment": "neutral"},
                        {"kind": "summary", "id": "txns", "heading": "Transactions", "primary": str(len(expenses)), "secondary": None, "sentiment": "neutral"},
                    ]},
                    {"kind": "block", "style": "insight", "text": f"Found {len(expenses)} transactions totalling {currency} {total:.0f}."},
                ],
            }
        }

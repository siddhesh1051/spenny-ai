"""Insights node — dynamic-window analytics with AI commentary."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone, timedelta

from agent.constants import UI_COMPONENT_CATALOG
from agent.tools.db_tools import query_expenses_since
from agent.tools.groq_tools import groq_json

logger = logging.getLogger(__name__)


def _fmt(amount: float, currency: str) -> str:
    return f"{currency} {amount:,.0f}"


def _parse_days_from_message(message: str) -> int:
    """Extract a lookback window in days from natural-language message."""
    t = message.lower()
    # "last N months" / "N months"
    m = re.search(r"(\d+)\s*month", t)
    if m:
        return int(m.group(1)) * 30
    # "last N weeks" / "N weeks"
    m = re.search(r"(\d+)\s*week", t)
    if m:
        return int(m.group(1)) * 7
    # "last N days" / "N days"
    m = re.search(r"(\d+)\s*day", t)
    if m:
        return int(m.group(1))
    # "last year" / "1 year"
    if re.search(r"\byear\b", t):
        return 365
    # "till date" / "all time" — use a very wide window
    if re.search(r"(till\s+date|all\s+time|since\s+(start|beginning)|to\s+date)", t):
        return 3650
    # default: 90 days
    return 90


async def handle_insights(
    message: str,
    user_id: str,
    groq_key: str,
    currency: str = "INR",
) -> dict:
    days = _parse_days_from_message(message)
    all_expenses = query_expenses_since(user_id, days=days)
    now = datetime.now(timezone.utc)

    # This month vs last month
    this_m = [
        e for e in all_expenses
        if datetime.fromisoformat(e["date"].replace("Z", "+00:00")).month == now.month
        and datetime.fromisoformat(e["date"].replace("Z", "+00:00")).year == now.year
    ]
    last_m_date = datetime(now.year if now.month > 1 else now.year - 1,
                           now.month - 1 if now.month > 1 else 12, 1, tzinfo=timezone.utc)
    last_m = [
        e for e in all_expenses
        if datetime.fromisoformat(e["date"].replace("Z", "+00:00")).month == last_m_date.month
        and datetime.fromisoformat(e["date"].replace("Z", "+00:00")).year == last_m_date.year
    ]

    total_this = sum(e["amount"] for e in this_m)
    total_last = sum(e["amount"] for e in last_m)
    days_so_far = now.day
    daily_avg = total_this / days_so_far if days_so_far > 0 else 0
    pct = round(((total_this - total_last) / total_last) * 100) if total_last > 0 else 0

    # 90-day category breakdown
    by_cat: dict[str, float] = {}
    for e in all_expenses:
        by_cat[e["category"]] = by_cat.get(e["category"], 0) + e["amount"]

    total_90 = sum(by_cat.values())
    top_cat = max(by_cat.items(), key=lambda x: x[1]) if by_cat else ("Unknown", 0)
    cat_breakdown = sorted(by_cat.items(), key=lambda x: -x[1])[:6]
    cat_breakdown_data = [
        {
            "category": c,
            "total": round(t),
            "count": sum(1 for e in all_expenses if e["category"] == c),
            "percentage": round(t / total_90 * 100) if total_90 > 0 else 0,
        }
        for c, t in cat_breakdown
    ]

    sample_lines = "\n".join(
        f"{e['date'][:10]} | {e['category']} | {e['description']} | {_fmt(e['amount'], currency)}"
        for e in all_expenses[:15]
    )

    metrics_context = "\n".join([
        f"{now.strftime('%B')} Total: {_fmt(total_this, currency)}" + (f" ({'+' if pct >= 0 else ''}{pct}% vs last month)" if total_last > 0 else ""),
        f"Daily Average: {_fmt(daily_avg, currency)} ({days_so_far} days so far)",
        f"Top Category: {top_cat[0]} ({_fmt(top_cat[1], currency)}, 90 days)",
    ])
    cat_context = "\n".join(
        f"{d['category']}: {_fmt(d['total'], currency)} ({d['count']} txns, {d['percentage']}%)"
        for d in cat_breakdown_data
    )

    visual_points = json.dumps([
        {"label": d["category"], "value": d["total"], "share": d["percentage"]}
        for d in cat_breakdown_data
    ])

    window_label = f"last {days} days" if days < 3650 else "all time"
    ui = await groq_json(
        f"""You are Spenny AI, a friendly financial advisor. User asked: "{message}"

## Spending data ({window_label})

Key metrics:
{metrics_context}

Category breakdown (top 6, 90 days):
{cat_context}

This month ({now.strftime('%B')}): {_fmt(total_this, currency)} ({len(this_m)} expenses)
Last month: {_fmt(total_last, currency)} ({len(last_m)} expenses)
Month-over-month change: {'+' if pct >= 0 else ''}{pct}%

Recent transactions:
{sample_lines}

Available visual data for chart:
{visual_points}

{UI_COMPONENT_CATALOG}

## Your task
Design the best insight dashboard UI. You decide:
- Which metric cards to highlight (pick 2-4 most relevant)
- Whether to show a chart and which type (pie, bars, or area) — recommended for insights
- What actionable insights to write in an "insight" block (2-3 sentences with real numbers, encouraging, practical) — at the end always

Return ONLY valid JSON (no markdown):
{{ "layout": {{ "kind": "column", "children": [ ...nodes ] }} }}""",
        groq_key, temperature=0.8, max_tokens=1200,
    ) or {
        "layout": {
            "kind": "column",
            "children": [
                {"kind": "row", "children": [
                    {"kind": "summary", "id": "this-month", "heading": f"{now.strftime('%B')} Total",
                     "primary": _fmt(total_this, currency),
                     "secondary": f"{'+' if pct >= 0 else ''}{pct}% vs last month" if total_last > 0 else None,
                     "sentiment": "up" if pct <= 0 else "down"},
                    {"kind": "summary", "id": "daily-avg", "heading": "Daily Average",
                     "primary": _fmt(daily_avg, currency),
                     "secondary": f"{days_so_far} days so far", "sentiment": "neutral"},
                ]},
                {"kind": "block", "style": "subheading", "text": "Spending breakdown (90 days)"},
                *([{
                    "kind": "visual", "variant": "pie", "x": "name", "y": "value",
                    "points": [{"label": d["category"], "value": d["total"], "share": d["percentage"]} for d in cat_breakdown_data],
                }] if len(cat_breakdown_data) > 1 else []),
                {"kind": "block", "style": "insight",
                 "text": f"Your top spending category is {top_cat[0]} at {_fmt(top_cat[1], currency)} over the last 90 days."},
            ],
        }
    }

    return {"intent": "insights", "uiResponse": ui}

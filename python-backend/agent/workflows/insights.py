"""Insights agentic workflow — extract → analyze → respond.

Three specialised agents:
1. Extraction Agent  — determines the lookback window from the message
2. Analysis Agent    — computes month-over-month, category breakdown, trends
3. Response Agent    — builds the insight dashboard (web) or summary text (messaging)
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage

from agent.channels.formatter import format_insights_text
from agent.constants import UI_COMPONENT_CATALOG
from agent.tools.db_tools import query_expenses_since
from agent.tools.groq_tools import FAST_MODEL, groq_chat, groq_json

logger = logging.getLogger(__name__)


def _fmt(amount: float, currency: str) -> str:
    return f"{currency} {amount:,.0f}"


def _last_human_text(state: dict) -> str:
    return next(
        (m.content for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        "",
    )


# ── Agent 1: Window extraction ───────────────────────────────────────────────

async def insights_extract_agent(state: dict) -> dict:
    """Determine the lookback window from the user message.

    Pure regex — no LLM call needed, keeping rate limits untouched.
    """
    message = _last_human_text(state)
    t = message.lower()

    m = re.search(r"(\d+)\s*month", t)
    if m:
        days = int(m.group(1)) * 30
    elif re.search(r"(\d+)\s*week", t):
        days = int(re.search(r"(\d+)\s*week", t).group(1)) * 7
    elif re.search(r"(\d+)\s*day", t):
        days = int(re.search(r"(\d+)\s*day", t).group(1))
    elif re.search(r"\byear\b", t):
        days = 365
    elif re.search(r"(till\s+date|all\s+time|since\s+(start|beginning)|to\s+date)", t):
        days = 3650
    else:
        days = 90

    logger.info("insights_extract: window=%d days for '%.60s'", days, message)
    return {"insights_window": days}


# ── Agent 2: Analytics computation ───────────────────────────────────────────

async def insights_analyze_agent(state: dict) -> dict:
    """Fetch expense data and compute analytics.

    No LLM call — pure DB query + arithmetic.
    """
    days = state.get("insights_window", 90)
    user_id = state["user_id"]
    currency = state.get("currency", "INR")

    all_expenses = query_expenses_since(user_id, days=days)
    now = datetime.now(timezone.utc)

    this_m = [
        e for e in all_expenses
        if datetime.fromisoformat(e["date"].replace("Z", "+00:00")).month == now.month
        and datetime.fromisoformat(e["date"].replace("Z", "+00:00")).year == now.year
    ]

    last_m_date = datetime(
        now.year if now.month > 1 else now.year - 1,
        now.month - 1 if now.month > 1 else 12,
        1,
        tzinfo=timezone.utc,
    )
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

    by_cat: dict[str, float] = {}
    for e in all_expenses:
        by_cat[e["category"]] = by_cat.get(e["category"], 0) + e["amount"]

    total_all = sum(by_cat.values())
    top_cat = max(by_cat.items(), key=lambda x: x[1]) if by_cat else ("Unknown", 0)

    cat_breakdown = sorted(by_cat.items(), key=lambda x: -x[1])[:6]
    cat_breakdown_data = [
        {
            "category": c,
            "total": round(t),
            "count": sum(1 for e in all_expenses if e["category"] == c),
            "percentage": round(t / total_all * 100) if total_all > 0 else 0,
        }
        for c, t in cat_breakdown
    ]

    sample_lines = "\n".join(
        f"{e['date'][:10]} | {e['category']} | {e['description']} | {_fmt(e['amount'], currency)}"
        for e in all_expenses[:15]
    )

    visual_points = [
        {"label": d["category"], "value": d["total"], "share": d["percentage"]}
        for d in cat_breakdown_data
    ]

    insights_data: dict[str, Any] = {
        "month_name": now.strftime("%B"),
        "this_month_total": total_this,
        "last_month_total": total_last,
        "this_month_count": len(this_m),
        "last_month_count": len(last_m),
        "pct_change": pct,
        "daily_avg": daily_avg,
        "days_so_far": days_so_far,
        "top_category": {"name": top_cat[0], "total": top_cat[1]},
        "category_breakdown": cat_breakdown_data,
        "visual_points": visual_points,
        "sample_lines": sample_lines,
        "total_all": total_all,
        "total_expenses": len(all_expenses),
        "window_days": days,
    }

    logger.info("insights_analyze: %d expenses, window=%d days", len(all_expenses), days)
    return {"insights_data": insights_data}


# ── Agent 3: Response builder ────────────────────────────────────────────────

async def insights_respond_agent(state: dict) -> dict:
    """Build the insights dashboard — rich UI or plain text."""
    data = state.get("insights_data", {})
    channel = state.get("channel", "web")
    currency = state.get("currency", "INR")
    groq_key = state["groq_key"]
    message = _last_human_text(state)

    month_name = data.get("month_name", "This month")
    total_this = data.get("this_month_total", 0)
    total_last = data.get("last_month_total", 0)
    pct = data.get("pct_change", 0)
    daily_avg = data.get("daily_avg", 0)
    days_so_far = data.get("days_so_far", 0)
    top_cat = data.get("top_category", {})
    cat_breakdown = data.get("category_breakdown", [])
    visual_points = data.get("visual_points", [])
    sample_lines = data.get("sample_lines", "")
    days = data.get("window_days", 90)

    # ── Messaging channels ────────────────────────────────────────────────
    if channel != "web":
        cat_summary = ", ".join(
            f"{c['category']}: {_fmt(c['total'], currency)} ({c['percentage']}%)"
            for c in cat_breakdown[:4]
        )
        try:
            tip = await groq_chat(
                f"""You are a concise financial advisor. User: "{message}"
Data: {month_name} total {_fmt(total_this, currency)} ({'+' if pct >= 0 else ''}{pct}% vs last month).
Top: {top_cat.get('name', 'N/A')} ({_fmt(top_cat.get('total', 0), currency)}).
Categories: {cat_summary}
Give ONE actionable tip (max 25 words). No emoji.""",
                groq_key,
                temperature=0.6,
                max_tokens=50,
                model=FAST_MODEL,
            )
        except Exception:
            tip = ""

        text_data = {
            **data,
            "tip": tip,
        }
        text = format_insights_text(text_data, currency)
        return {
            "result": {"intent": "insights", "text": text},
            "text_response": text,
            "messages": [AIMessage(content="[insights] Spending insights generated.")],
        }

    # ── Web: rich UI dashboard ────────────────────────────────────────────
    metrics_context = "\n".join([
        f"{month_name} Total: {_fmt(total_this, currency)}"
        + (f" ({'+' if pct >= 0 else ''}{pct}% vs last month)" if total_last > 0 else ""),
        f"Daily Average: {_fmt(daily_avg, currency)} ({days_so_far} days so far)",
        f"Top Category: {top_cat.get('name', 'N/A')} ({_fmt(top_cat.get('total', 0), currency)}, {days} days)",
    ])

    cat_context = "\n".join(
        f"{d['category']}: {_fmt(d['total'], currency)} ({d['count']} txns, {d['percentage']}%)"
        for d in cat_breakdown
    )

    window_label = f"last {days} days" if days < 3650 else "all time"

    ui = await groq_json(
        f"""You are Spenny AI, a friendly financial advisor. User asked: "{message}"

## Spending data ({window_label})

Key metrics:
{metrics_context}

Category breakdown (top 6):
{cat_context}

This month ({month_name}): {_fmt(total_this, currency)} ({data.get('this_month_count', 0)} expenses)
Last month: {_fmt(total_last, currency)} ({data.get('last_month_count', 0)} expenses)
Month-over-month change: {'+' if pct >= 0 else ''}{pct}%

Recent transactions:
{sample_lines}

Available visual data for chart:
{json.dumps(visual_points)}

{UI_COMPONENT_CATALOG}

## Your task
Design the best insight dashboard UI. You decide:
- Which metric cards to highlight (pick 2-4 most relevant)
- Whether to show a chart and which type (pie, bars, or area) — recommended for insights
- What actionable insights to write in an "insight" block (2-3 sentences with real numbers, encouraging, practical) — at the end always

Return ONLY valid JSON (no markdown):
{{ "layout": {{ "kind": "column", "children": [ ...nodes ] }} }}""",
        groq_key,
        temperature=0.8,
        max_tokens=1200,
    ) or {
        "layout": {
            "kind": "column",
            "children": [
                {
                    "kind": "row",
                    "children": [
                        {
                            "kind": "summary",
                            "id": "this-month",
                            "heading": f"{month_name} Total",
                            "primary": _fmt(total_this, currency),
                            "secondary": f"{'+' if pct >= 0 else ''}{pct}% vs last month" if total_last > 0 else None,
                            "sentiment": "up" if pct <= 0 else "down",
                        },
                        {
                            "kind": "summary",
                            "id": "daily-avg",
                            "heading": "Daily Average",
                            "primary": _fmt(daily_avg, currency),
                            "secondary": f"{days_so_far} days so far",
                            "sentiment": "neutral",
                        },
                    ],
                },
                {"kind": "block", "style": "subheading", "text": f"Spending breakdown ({window_label})"},
                *(
                    [
                        {
                            "kind": "visual",
                            "variant": "pie",
                            "x": "name",
                            "y": "value",
                            "points": visual_points,
                        }
                    ]
                    if len(visual_points) > 1
                    else []
                ),
                {
                    "kind": "block",
                    "style": "insight",
                    "text": f"Your top spending category is {top_cat.get('name', 'N/A')} at {_fmt(top_cat.get('total', 0), currency)} over the {window_label}.",
                },
            ],
        }
    }

    return {
        "result": {"intent": "insights", "uiResponse": ui},
        "messages": [AIMessage(content="[insights] Here are your spending insights.")],
    }

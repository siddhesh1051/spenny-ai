"""Insights tool — fetches 90-day data and builds an insight dashboard UI."""

import json
import re
from datetime import datetime, timezone, timedelta
from langchain_core.messages import HumanMessage
from langchain_groq import ChatGroq

from services.formatting import UI_COMPONENT_CATALOG


def _clean_json(raw: str) -> str:
    return re.sub(r"```json?|```", "", raw).strip()


async def build_insights_ui(
    question: str,
    all_expenses: list[dict],
    currency: str,
    llm: ChatGroq,
) -> dict:
    now = datetime.now(timezone.utc)

    this_m = [
        e for e in all_expenses
        if datetime.fromisoformat(e["date"].replace("Z", "+00:00")).month == now.month
        and datetime.fromisoformat(e["date"].replace("Z", "+00:00")).year == now.year
    ]
    last_m_date = (now.replace(day=1) - timedelta(days=1))
    last_m = [
        e for e in all_expenses
        if datetime.fromisoformat(e["date"].replace("Z", "+00:00")).month == last_m_date.month
        and datetime.fromisoformat(e["date"].replace("Z", "+00:00")).year == last_m_date.year
    ]

    total_this = sum(e["amount"] for e in this_m)
    total_last = sum(e["amount"] for e in last_m)
    days_so_far = now.day
    daily_avg = total_this / days_so_far if days_so_far else 0
    pct = round(((total_this - total_last) / total_last) * 100) if total_last else 0

    by_cat: dict[str, float] = {}
    for e in all_expenses:
        by_cat[e["category"]] = by_cat.get(e["category"], 0) + e["amount"]
    total_90 = sum(by_cat.values())

    cat_breakdown = sorted(by_cat.items(), key=lambda x: -x[1])[:6]
    cat_breakdown_ctx = "\n".join(
        f"{c}: {currency} {v:.0f} ({len([e for e in all_expenses if e['category'] == c])} txns, {round(v / total_90 * 100) if total_90 else 0}%)"
        for c, v in cat_breakdown
    )

    sample_lines = "\n".join(
        f"{e['date'][:10]} | {e['category']} | {e['description']} | {currency} {e['amount']}"
        for e in all_expenses[:15]
    )

    visual_data = json.dumps([
        {"label": c, "value": round(v), "share": round(v / total_90 * 100) if total_90 else 0}
        for c, v in cat_breakdown
    ])

    prompt = f"""You are Spenny AI, a friendly financial advisor. User asked: "{question}"

## Spending data (last 90 days)

Key metrics:
{now.strftime("%B")} Total: {currency} {total_this:.0f} ({f'+{pct}%' if pct > 0 else f'{pct}%'} vs last month)
Daily Average: {currency} {daily_avg:.0f} ({days_so_far} days so far)
Top Category: {cat_breakdown[0][0].capitalize() if cat_breakdown else "N/A"} ({currency} {cat_breakdown[0][1]:.0f} over 90 days)

Category breakdown (top 6, 90 days):
{cat_breakdown_ctx}

This month ({now.strftime("%B")}): {currency} {total_this:.0f} ({len(this_m)} expenses)
Last month: {currency} {total_last:.0f} ({len(last_m)} expenses)
Month-over-month change: {'+' if pct > 0 else ''}{pct}%

Recent transactions:
{sample_lines}

Available visual data for chart:
{visual_data}

{UI_COMPONENT_CATALOG}

## Your task
Design the best insight dashboard UI for this user. You decide:
- Which metric cards to highlight (pick 2-4 most relevant)
- Whether to show a chart (donut for ≤5 categories, bars for >5) — recommended
- What actionable insights to write in an "insight" block (2-3 sentences with real numbers)
- The order and grouping of sections

Do NOT include a table. Return ONLY valid JSON (no markdown):
{{ "layout": {{ "kind": "column", "children": [ ...nodes ] }} }}"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    try:
        return json.loads(_clean_json(response.content))
    except Exception:
        children = [
            {"kind": "row", "children": [
                {"kind": "summary", "id": "month-total", "heading": f"{now.strftime('%B')} Total", "primary": f"{currency} {total_this:.0f}", "secondary": f"{'+' if pct > 0 else ''}{pct}% vs last month", "sentiment": "down" if pct > 0 else "up"},
                {"kind": "summary", "id": "daily-avg", "heading": "Daily Average", "primary": f"{currency} {daily_avg:.0f}", "secondary": f"{days_so_far} days so far", "sentiment": "neutral"},
            ]},
            {"kind": "block", "style": "subheading", "text": "Spending breakdown (90 days)"},
        ]
        if len(cat_breakdown) > 1:
            children.append({
                "kind": "visual",
                "variant": "donut" if len(cat_breakdown) <= 5 else "bars",
                "x": "name", "y": "value",
                "points": [{"label": c, "value": round(v), "share": round(v / total_90 * 100) if total_90 else 0} for c, v in cat_breakdown],
            })
        if cat_breakdown:
            children.append({"kind": "block", "style": "insight", "text": f"Your top spending category is {cat_breakdown[0][0]} at {currency} {cat_breakdown[0][1]:.0f} over 90 days."})
        return {"layout": {"kind": "column", "children": children}}

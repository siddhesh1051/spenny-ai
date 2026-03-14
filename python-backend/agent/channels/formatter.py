"""Channel-specific response formatters for WhatsApp and Telegram.

These produce plain-text responses from structured data so messaging
channels get clean, readable output without any UI JSON.
"""

from __future__ import annotations

from typing import Any


def _fmt(amount: float, currency: str) -> str:
    return f"{currency} {amount:,.0f}"


def format_expense_text(
    expenses: list[dict[str, Any]],
    currency: str,
) -> str:
    count = len(expenses)
    total = sum(e.get("amount", 0) for e in expenses)
    lines = [f"✅ *{count} expense{'s' if count != 1 else ''} logged!* Total: {_fmt(total, currency)}"]
    for e in expenses:
        lines.append(f"  • {e['description']} ({e['category']}): {_fmt(e['amount'], currency)}")
    return "\n".join(lines)


def format_query_text(
    analytics: dict[str, Any],
    results: list[dict[str, Any]],
    currency: str,
) -> str:
    total = analytics.get("total", 0)
    count = analytics.get("count", len(results))
    cat_breakdown = analytics.get("category_breakdown", [])
    period = analytics.get("period_label", "")

    lines = [f"📊 *Spending Summary*{f' ({period})' if period else ''}"]
    lines.append(f"Total: {_fmt(total, currency)} across {count} transactions")

    if cat_breakdown:
        lines.append("")
        lines.append("*By category:*")
        for cat in cat_breakdown[:6]:
            pct = cat.get("percentage", 0)
            lines.append(f"  • {cat['category']}: {_fmt(cat['total'], currency)} ({pct}%)")

    insight = analytics.get("insight_text", "")
    if insight:
        lines.append(f"\n💡 {insight}")

    return "\n".join(lines)


def format_insights_text(
    data: dict[str, Any],
    currency: str,
) -> str:
    lines = ["📈 *Spending Insights*"]

    this_month_total = data.get("this_month_total", 0)
    month_name = data.get("month_name", "This month")
    pct_change = data.get("pct_change", 0)
    daily_avg = data.get("daily_avg", 0)
    top_category = data.get("top_category", {})

    lines.append(f"{month_name}: {_fmt(this_month_total, currency)}")
    if pct_change != 0:
        direction = "↑" if pct_change > 0 else "↓"
        lines.append(f"  {direction} {abs(pct_change)}% vs last month")
    lines.append(f"Daily average: {_fmt(daily_avg, currency)}")

    if top_category:
        lines.append(f"Top category: {top_category.get('name', 'N/A')} ({_fmt(top_category.get('total', 0), currency)})")

    tip = data.get("tip", "")
    if tip:
        lines.append(f"\n💡 {tip}")

    return "\n".join(lines)


def format_receipt_text(
    expenses: list[dict[str, Any]],
    currency: str,
) -> str:
    count = len(expenses)
    total = sum(e.get("amount", 0) for e in expenses)
    lines = [f"🧾 *{count} expense{'s' if count != 1 else ''} extracted from receipt!* Total: {_fmt(total, currency)}"]
    for e in expenses:
        lines.append(f"  • {e['description']} ({e['category']}): {_fmt(e['amount'], currency)}")
    return "\n".join(lines)

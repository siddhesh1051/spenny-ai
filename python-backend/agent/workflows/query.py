"""Query agentic workflow — extract → execute → respond.

Three specialised agents:
1. Extraction Agent  — derives structured filters from the natural-language question
2. Execution Agent   — runs the DB query and computes analytics
3. Response Agent    — builds a rich UI layout (web) or plain text (messaging)
"""

from __future__ import annotations

import calendar
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

def _month_range(year: int, month: int) -> tuple[str, str]:
    """Return (start, end) date strings for a given year/month."""
    last_day = calendar.monthrange(year, month)[1]
    return (
        f"{year}-{month:02d}-01",
        f"{year}-{month:02d}-{last_day:02d}",
    )


def _week_range(anchor: datetime, week_offset: int = 0) -> tuple[str, str]:
    """Return (start, end) for the ISO week containing anchor, shifted by week_offset."""
    start = anchor - timedelta(days=anchor.weekday()) + timedelta(weeks=week_offset)
    end = start + timedelta(days=6)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


def _build_date_reference_block(now: datetime) -> str:
    """Pre-compute every named date range the LLM might need, so it never has to guess."""
    today = now.strftime("%Y-%m-%d")
    y, m = now.year, now.month

    # ── rolling windows ──────────────────────────────────────────────────────
    rolling = {
        "today":          (today, today),
        "yesterday":      ((now - timedelta(days=1)).strftime("%Y-%m-%d"),) * 2,
        "last 7 days":    ((now - timedelta(days=6)).strftime("%Y-%m-%d"), today),
        "last 14 days":   ((now - timedelta(days=13)).strftime("%Y-%m-%d"), today),
        "last 30 days":   ((now - timedelta(days=29)).strftime("%Y-%m-%d"), today),
        "last 60 days":   ((now - timedelta(days=59)).strftime("%Y-%m-%d"), today),
        "last 90 days":   ((now - timedelta(days=89)).strftime("%Y-%m-%d"), today),
        "last 3 months":  ((now - timedelta(days=89)).strftime("%Y-%m-%d"), today),
        "last 6 months":  ((now - timedelta(days=181)).strftime("%Y-%m-%d"), today),
        "last 1 year":    ((now - timedelta(days=364)).strftime("%Y-%m-%d"), today),
    }

    # ── named months — current year and previous year ────────────────────────
    month_names = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December",
    ]
    months: dict[str, tuple[str, str]] = {}
    for i, name in enumerate(month_names, start=1):
        # current year
        months[f"{name} {y}"] = _month_range(y, i)
        months[name[:3] + f" {y}"] = _month_range(y, i)
        # previous year
        months[f"{name} {y-1}"] = _month_range(y - 1, i)
        months[name[:3] + f" {y-1}"] = _month_range(y - 1, i)
        # bare name → assume current year if month <= current month, else last year
        ref_year = y if i <= m else y - 1
        months[name] = _month_range(ref_year, i)
        months[name[:3]] = _month_range(ref_year, i)

    # current / last month
    this_month_s, this_month_e = _month_range(y, m)
    prev_m = m - 1 if m > 1 else 12
    prev_y = y if m > 1 else y - 1
    last_month_s, last_month_e = _month_range(prev_y, prev_m)

    months["this month"] = (this_month_s, today)          # up to today, not full month
    months["current month"] = (this_month_s, today)
    months["last month"] = (last_month_s, last_month_e)
    months["previous month"] = (last_month_s, last_month_e)

    # ── quarters ─────────────────────────────────────────────────────────────
    q = (m - 1) // 3 + 1
    q_starts = {1: 1, 2: 4, 3: 7, 4: 10}
    q_start_m = q_starts[q]
    q_end_m = q_start_m + 2
    quarters = {
        "this quarter":     (f"{y}-{q_start_m:02d}-01", today),
        "last quarter":     (
            f"{y if q > 1 else y-1}-{q_starts[q-1 if q > 1 else 4]:02d}-01",
            _month_range(y if q > 1 else y-1, (q_start_m - 1) if q > 1 else 12)[1],
        ),
        f"Q{q} {y}":        (f"{y}-{q_start_m:02d}-01", _month_range(y, q_end_m)[1]),
    }

    # ── week references ───────────────────────────────────────────────────────
    tw_s, tw_e = _week_range(now, 0)
    lw_s, lw_e = _week_range(now, -1)
    weeks = {
        "this week":        (tw_s, today),
        "current week":     (tw_s, today),
        "last week":        (lw_s, lw_e),
        "previous week":    (lw_s, lw_e),
    }

    # ── "first/second/third/fourth/last week of <month>" pre-built for all named months ──
    week_of_month: dict[str, tuple[str, str]] = {}
    ordinals = ["first", "second", "third", "fourth", "last", "1st", "2nd", "3rd", "4th"]
    for i, name in enumerate(month_names, start=1):
        ref_year = y if i <= m else y - 1
        first_day = datetime(ref_year, i, 1, tzinfo=timezone.utc)
        last_day_n = calendar.monthrange(ref_year, i)[1]
        # compute week starts for this month
        week_starts = []
        d = first_day - timedelta(days=first_day.weekday())  # Monday of first partial week
        while d.month <= i and d.year == ref_year or d <= datetime(ref_year, i, last_day_n, tzinfo=timezone.utc):
            if d.month == i:
                week_starts.append(d)
            d += timedelta(weeks=1)
            if d.month > i and d.year >= ref_year:
                break

        for abbr in (name, name[:3]):
            for oi, ord_name in enumerate(ordinals):
                idx = min(oi, len(week_starts) - 1) if ord_name in ("last", "4th", "fourth") else oi
                idx = len(week_starts) - 1 if ord_name in ("last",) else idx
                if idx < len(week_starts):
                    ws = week_starts[idx]
                    we = min(ws + timedelta(days=6), datetime(ref_year, i, last_day_n, tzinfo=timezone.utc))
                    week_of_month[f"{ord_name} week of {abbr}"] = (
                        ws.strftime("%Y-%m-%d"), we.strftime("%Y-%m-%d"),
                    )

    # ── years ────────────────────────────────────────────────────────────────
    years = {
        "this year":    (f"{y}-01-01", today),
        "last year":    (f"{y-1}-01-01", f"{y-1}-12-31"),
        str(y):         (f"{y}-01-01", today),
        str(y - 1):     (f"{y-1}-01-01", f"{y-1}-12-31"),
        str(y - 2):     (f"{y-2}-01-01", f"{y-2}-12-31"),
    }

    # ── build the reference block ─────────────────────────────────────────────
    all_refs = {**rolling, **months, **quarters, **weeks, **week_of_month, **years}
    lines = [f'  "{k}" → start={v[0]}, end={v[1]}' for k, v in sorted(all_refs.items())]
    return "DATE REFERENCE TABLE (use these exact dates):\n" + "\n".join(lines)


_MONTH_MAP = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}

_ORDINAL_MAP = {
    "first": 0, "1st": 0,
    "second": 1, "2nd": 1,
    "third": 2, "3rd": 2,
    "fourth": 3, "4th": 3,
    "last": -1,
}


def _resolve_dates_in_python(msg: str, now: datetime) -> tuple[str | None, str | None]:
    """
    Attempt to resolve the date expression in msg entirely in Python.
    Returns (start_date, end_date) as YYYY-MM-DD strings, or (None, None)
    if no date phrase is detected (caller should let the LLM handle it).
    """
    s = msg.lower().strip()
    today = now.strftime("%Y-%m-%d")
    y, m = now.year, now.month

    def fmt(d: datetime) -> str:
        return d.strftime("%Y-%m-%d")

    # ── no date signal at all ─────────────────────────────────────────────────
    date_signals = [
        "today", "yesterday", "week", "month", "year", "quarter",
        "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug",
        "sep", "oct", "nov", "dec",
        "january", "february", "march", "april", "june", "july",
        "august", "september", "october", "november", "december",
        "fortnight", "days", "last ", "this ", "since", "before",
        "2020", "2021", "2022", "2023", "2024", "2025", "2026",
    ]
    if not any(sig in s for sig in date_signals):
        return None, None

    # ── today / yesterday ────────────────────────────────────────────────────
    if re.search(r"\btoday\b", s):
        return today, today
    if re.search(r"\byesterday\b", s):
        d = fmt(now - timedelta(days=1))
        return d, d

    # ── rolling N days/weeks ─────────────────────────────────────────────────
    m_roll = re.search(r"last\s+(\d+)\s+(day|week|month)s?", s)
    if m_roll:
        n, unit = int(m_roll.group(1)), m_roll.group(2)
        delta = timedelta(days=n if unit == "day" else n * 7 if unit == "week" else n * 30)
        return fmt(now - delta + timedelta(days=1)), today

    if re.search(r"\bfortnight\b", s):
        return fmt(now - timedelta(days=13)), today

    # ── N-th week of <month> — check BEFORE generic "last week" ─────────────
    m_wk = re.search(
        r"\b(first|second|third|fourth|last|1st|2nd|3rd|4th)\s+week\s+of\s+([a-z]+)(?:\s+(\d{4}))?", s
    )
    if m_wk:
        ord_key, mon_name, yr_str = m_wk.group(1), m_wk.group(2), m_wk.group(3)
        mon_n = _MONTH_MAP.get(mon_name)
        if mon_n:
            ref_y = int(yr_str) if yr_str else (y if mon_n <= m else y - 1)
            first_day = datetime(ref_y, mon_n, 1, tzinfo=timezone.utc)
            last_day_n = calendar.monthrange(ref_y, mon_n)[1]
            week_starts = []
            d = first_day - timedelta(days=first_day.weekday())
            while True:
                if d.month == mon_n and d.year == ref_y:
                    week_starts.append(d)
                d += timedelta(weeks=1)
                if (d.year > ref_y) or (d.year == ref_y and d.month > mon_n):
                    break
            if week_starts:
                idx = _ORDINAL_MAP.get(ord_key, 0)
                ws = week_starts[idx]
                we = min(ws + timedelta(days=6), datetime(ref_y, mon_n, last_day_n, tzinfo=timezone.utc))
                return fmt(ws), fmt(we)

    # ── this/last week ────────────────────────────────────────────────────────
    if re.search(r"\bthis\s+week\b", s) or re.search(r"\bcurrent\s+week\b", s):
        ws, _ = _week_range(now, 0)
        return ws, today
    if re.search(r"\blast\s+week\b", s) or re.search(r"\bprevious\s+week\b", s):
        return _week_range(now, -1)

    # ── this/last/previous month ──────────────────────────────────────────────
    if re.search(r"\bthis\s+month\b", s) or re.search(r"\bcurrent\s+month\b", s):
        return f"{y}-{m:02d}-01", today
    if re.search(r"\blast\s+month\b", s) or re.search(r"\bprevious\s+month\b", s):
        prev_m = m - 1 if m > 1 else 12
        prev_y = y if m > 1 else y - 1
        return _month_range(prev_y, prev_m)

    # ── <month name> [year] ───────────────────────────────────────────────────
    m_mon = re.search(
        r"\b(january|february|march|april|may|june|july|august|september|october|november|december"
        r"|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b(?:\s+(\d{4}))?",
        s,
    )
    if m_mon:
        mon_n = _MONTH_MAP[m_mon.group(1)]
        yr_str = m_mon.group(2)
        ref_y = int(yr_str) if yr_str else (y if mon_n <= m else y - 1)
        return _month_range(ref_y, mon_n)

    # ── this/last quarter ────────────────────────────────────────────────────
    if re.search(r"\bthis\s+quarter\b", s):
        q_starts = {1: 1, 2: 4, 3: 7, 4: 10}
        q = (m - 1) // 3 + 1
        return f"{y}-{q_starts[q]:02d}-01", today
    if re.search(r"\blast\s+quarter\b", s):
        q_starts = {1: 1, 2: 4, 3: 7, 4: 10}
        q = (m - 1) // 3 + 1
        pq = q - 1 if q > 1 else 4
        pq_y = y if q > 1 else y - 1
        return f"{pq_y}-{q_starts[pq]:02d}-01", _month_range(pq_y, q_starts[pq] + 2)[1]

    # ── Q<n> <year> ───────────────────────────────────────────────────────────
    m_q = re.search(r"\bq([1-4])\s*(\d{4})?\b", s)
    if m_q:
        qn = int(m_q.group(1))
        qy = int(m_q.group(2)) if m_q.group(2) else y
        q_sm = {1: 1, 2: 4, 3: 7, 4: 10}[qn]
        return f"{qy}-{q_sm:02d}-01", _month_range(qy, q_sm + 2)[1]

    # ── "since <date>" / "after <date>" — before bare year check ────────────
    m_since = re.search(r"\b(?:since|from|after)\s+(\d{4}-\d{2}-\d{2})\b", s)
    if m_since:
        return m_since.group(1), today

    # ── "before <date>" / "until <date>" — before bare year check ────────────
    m_before = re.search(r"\b(?:before|until|up\s+to)\s+(\d{4}-\d{2}-\d{2})\b", s)
    if m_before:
        return None, m_before.group(1)

    # ── explicit YYYY-MM-DD range ────────────────────────────────────────────
    m_range = re.search(r"(\d{4}-\d{2}-\d{2})\s+(?:to|-)\s+(\d{4}-\d{2}-\d{2})", s)
    if m_range:
        return m_range.group(1), m_range.group(2)

    # ── single YYYY-MM-DD ────────────────────────────────────────────────────
    m_single = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", s)
    if m_single:
        return m_single.group(1), m_single.group(1)

    # ── this/last year or bare 4-digit year ──────────────────────────────────
    if re.search(r"\bthis\s+year\b", s):
        return f"{y}-01-01", today
    if re.search(r"\blast\s+year\b", s):
        return f"{y-1}-01-01", f"{y-1}-12-31"
    m_yr = re.search(r"\b(20\d{2})\b", s)
    if m_yr:
        yr = int(m_yr.group(1))
        end = today if yr == y else f"{yr}-12-31"
        return f"{yr}-01-01", end

    # couldn't resolve — fall through to LLM
    return None, None


async def query_extract_agent(state: dict) -> dict:
    """Parse the user's question into structured query filters.

    Dates are resolved in Python first (zero tokens). The LLM only receives a
    compact prompt for category/sort/group extraction, keeping input tokens
    to ~200 regardless of how many date patterns exist.
    """
    message = _last_human_text(state)
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    y, m = now.year, now.month

    # ── Resolve dates in Python — free, deterministic, no tokens used ────────
    start_date, end_date = _resolve_dates_in_python(message, now)
    date_note = (
        f"Dates already resolved: start_date={start_date}, end_date={end_date}. "
        "Do NOT change these values."
        if (start_date is not None or end_date is not None)
        else "No date mentioned — set start_date=null, end_date=null."
    )

    # ── Compact LLM prompt — only category/sort/group/search ─────────────────
    this_month_start = f"{y}-{m:02d}-01"
    result = await groq_json(
        f"""Today: {today}. {date_note}

Extract query filters from: "{message}"
Categories: Food & Dining, Groceries, Travel, Entertainment, Utilities, Rent, Shopping, Education, Investments, Healthcare, Subscriptions, Other

Return ONLY valid JSON:
{{
  "start_date": {f'"{start_date}"' if start_date else 'null'},
  "end_date": {f'"{end_date}"' if end_date else 'null'},
  "category": string or null,
  "min_amount": number or null,
  "max_amount": number or null,
  "sort_by": "date" or "amount",
  "sort_order": "asc" or "desc",
  "limit": number or null,
  "group_by": "category" or "day" or "week" or "month" or null,
  "search_description": string or null
}}

Rules:
- start_date / end_date: use the pre-resolved values above, do not change them.
- category: match loosely — "food/eating/restaurant" → "Food & Dining"; "movies/netflix/spotify" → "Entertainment"; "ola/uber/flights" → "Travel"; "kirana/supermarket" → "Groceries"; etc. Set null if no category mentioned.
- search_description: ONLY set if user names a specific merchant/item (e.g. "Zomato", "coffee"). Null otherwise.
- sort: "biggest/top N/most expensive" → sort_by=amount, sort_order=desc, limit=N. "cheapest" → asc. Default: sort_by=date, sort_order=desc.
- group_by: "trend/monthly/over time" → month. "daily" → day. "weekly" → week. "by category/breakdown" → category. Else null.""",
        state["groq_key"],
        temperature=0,
        max_tokens=200,
        model=FAST_MODEL,
    )

    defaults: dict[str, Any] = {
        "start_date": start_date,
        "end_date": end_date,
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

    raw_search = result.get("search_description") or None
    if raw_search and len(raw_search.split()) > 4:
        raw_search = None

    filters = {
        "start_date": start_date,
        "end_date": end_date,
        "category": result.get("category") if result.get("category") in valid_cats else None,
        "min_amount": result.get("min_amount"),
        "max_amount": result.get("max_amount"),
        "sort_by": result.get("sort_by") if result.get("sort_by") in {"date", "amount"} else "date",
        "sort_order": result.get("sort_order") if result.get("sort_order") in {"asc", "desc"} else "desc",
        "limit": int(raw_limit) if raw_limit is not None else None,
        "group_by": result.get("group_by") if result.get("group_by") in {"category", "day", "week", "month", None} else None,
        "search_description": raw_search,
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

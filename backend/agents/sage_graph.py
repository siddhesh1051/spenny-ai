"""
Sage LangGraph Agent
====================
Stateful multi-turn expense assistant. Each conversation thread has its own
MemorySaver checkpoint so Sage remembers context across messages in a session.

Graph nodes
-----------
router       → classifies intent using regex fast-paths + LLM fallback
expense      → parses + inserts expenses, builds collection UI
query        → extracts filters, queries DB (+ optional vector search), builds UI
insights     → fetches 90-day data, builds insight dashboard UI
conversation → friendly chat / help response

Memory
------
Short-term:  LangGraph MemorySaver (in-process, per thread_id)
Long-term:   sage_sessions table in Supabase (summary saved after each turn)
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone, timedelta
from typing import Annotated, TypedDict, Literal, AsyncGenerator

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from agents.tools.expense import parse_expenses, build_expense_ui
from agents.tools.query import get_query_filters, build_query_ui
from agents.tools.insights import build_insights_ui
from services.formatting import UI_COMPONENT_CATALOG, VALID_CATEGORIES


# ── State ─────────────────────────────────────────────────────────────────────

class SageState(TypedDict):
    messages: Annotated[list[BaseMessage], lambda a, b: a + b]
    user_id: str
    user_token: str       # user's JWT — needed for RLS-aware DB queries
    groq_key: str
    currency: str
    intent: str
    result: dict          # final output sent to the frontend


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clean_json(raw: str) -> str:
    return re.sub(r"```json?|```", "", raw).strip()


def _last_human_message(state: SageState) -> str:
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            return str(msg.content)
    return ""


def _make_llm(groq_key: str, model: str = "llama-3.1-8b-instant", temperature: float = 0.7) -> ChatGroq:
    return ChatGroq(api_key=groq_key, model=model, temperature=temperature)


# ── Router node ───────────────────────────────────────────────────────────────

async def router_node(state: SageState) -> dict:
    msg = _last_human_message(state)
    t = msg.strip().lower()

    # Fast-path regex
    if re.match(r"^(hi|hello|hey|namaste|good\s+(morning|afternoon|evening))", t, re.I):
        return {"intent": "conversation"}
    if re.match(r"^(thanks?|thank\s+you|thx|ty)[\s!.,]*$", t, re.I):
        return {"intent": "conversation"}
    if re.match(r"^(bye|goodbye|see\s+ya)[\s!.,]*$", t, re.I):
        return {"intent": "conversation"}
    if re.match(r"^(ok|okay|cool|great|awesome|perfect)[\s!?.,]*$", t, re.I):
        return {"intent": "conversation"}
    if re.match(r"^what\s+(can\s+you|do\s+you|are\s+you)", t, re.I):
        return {"intent": "conversation"}

    if re.search(r"(spent|paid)\s+\d+", t, re.I):
        return {"intent": "expense"}
    if re.search(r"\d+\s+(on|for)\s+\w+", t, re.I):
        return {"intent": "expense"}
    if re.search(r"^\d+\s+(rs|₹|inr|rupees?)", t, re.I):
        return {"intent": "expense"}

    if re.search(r"(how\s+much|total|summary|show|list|what\s+did).*(spent?|expense|cost)", t, re.I):
        return {"intent": "query"}
    if re.search(r"my\s+(food|travel|grocery|groceries|entertainment|utilities|rent)\s+expense", t, re.I):
        return {"intent": "query"}

    if re.search(r"(suggest|advice|tip|should\s+i|how\s+can|how\s+to\s+save)", t, re.I):
        return {"intent": "insights"}
    if re.search(r"(save|reduce|cut|lower).*(spending|expense|cost|money)", t, re.I):
        return {"intent": "insights"}
    if re.search(r"(budget|compare|vs|versus|trend|pattern|insight)", t, re.I):
        return {"intent": "insights"}

    # LLM fallback
    llm = _make_llm(state["groq_key"], model="llama-3.1-8b-instant", temperature=0)
    response = await llm.ainvoke([HumanMessage(content=f"""Classify into ONE: expense, query, insights, conversation.
Message: "{msg}"
- expense: logging a new expense
- query: asking about past spending
- insights: advice/analysis/tips
- conversation: greeting, thanks, general chat
Reply with ONE WORD only.""")])
    word = response.content.strip().lower()
    if "query" in word:
        return {"intent": "query"}
    if "insights" in word:
        return {"intent": "insights"}
    if "expense" in word:
        return {"intent": "expense"}
    return {"intent": "conversation"}


def _route_by_intent(state: SageState) -> Literal["expense", "query", "insights", "conversation"]:
    return state.get("intent", "conversation")


# ── Expense node ──────────────────────────────────────────────────────────────

async def expense_node(state: SageState) -> dict:
    from services.supabase import get_service_client

    msg = _last_human_message(state)
    llm = _make_llm(state["groq_key"], temperature=0.2)
    db = get_service_client(state.get("user_token"))
    currency = state.get("currency", "INR")

    parsed = await parse_expenses(msg, llm)
    if not parsed:
        return {"result": {
            "intent": "conversation",
            "uiResponse": {
                "layout": {
                    "kind": "column",
                    "children": [{"kind": "block", "style": "body",
                                  "text": "I couldn't find any expenses in your message. Try: \"Spent 500 on groceries\""}],
                }
            },
        }, "messages": [AIMessage(content="No expenses found.")]}

    to_insert = [
        {
            "amount": e["amount"],
            "category": e["category"],
            "description": e["description"].strip()[:100],
            "date": datetime.now(timezone.utc).isoformat(),
            "user_id": state["user_id"],
        }
        for e in parsed
    ]

    result = await db.table("expenses").insert(to_insert).execute()
    rows = [
        {"id": r["id"], "description": r["description"], "category": r["category"], "amount": r["amount"]}
        for r in (result.data or [])
    ]

    total = sum(r["amount"] for r in rows)
    llm_layout = _make_llm(state["groq_key"], temperature=0.7)
    ui = await build_expense_ui(rows, total, currency, llm_layout)

    summary = f"Logged {len(rows)} expense(s): " + ", ".join(f"{r['description']} {currency}{r['amount']}" for r in rows)
    return {
        "result": {"intent": "expense", "uiResponse": ui},
        "messages": [AIMessage(content=summary)],
    }


# ── Query node ────────────────────────────────────────────────────────────────

async def query_node(state: SageState) -> dict:
    from services.supabase import get_service_client

    msg = _last_human_message(state)
    llm = _make_llm(state["groq_key"], temperature=0)
    db = get_service_client(state.get("user_token"))
    currency = state.get("currency", "INR")
    user_id = state["user_id"]

    # Build recent conversation history to help resolve follow-up references
    history_turns = []
    for m in state["messages"][-8:]:  # last 4 turns
        if isinstance(m, HumanMessage):
            history_turns.append(f"User: {str(m.content)[:150]}")
        elif isinstance(m, AIMessage):
            history_turns.append(f"Sage: {str(m.content)[:150]}")
    conversation_history = "\n".join(history_turns)

    filters = await get_query_filters(msg, llm, conversation_history)

    query = db.table("expenses").select("id, date, description, category, amount").eq("user_id", user_id)

    if filters["start_date"]:
        query = query.gte("date", f"{filters['start_date']}T00:00:00.000Z")
    if filters["end_date"]:
        query = query.lte("date", f"{filters['end_date']}T23:59:59.999Z")
    if filters["category"]:
        query = query.eq("category", filters["category"])
    if filters["min_amount"] is not None:
        query = query.gte("amount", filters["min_amount"])
    if filters["max_amount"] is not None:
        query = query.lte("amount", filters["max_amount"])
    if filters["search_description"]:
        query = query.ilike("description", f"%{filters['search_description']}%")

    asc = filters["sort_order"] == "asc"
    result = await query.order(filters["sort_by"], desc=not asc).limit(filters["limit"]).execute()
    expenses = result.data or []

    if not expenses:
        empty_ui = {
            "layout": {
                "kind": "column",
                "children": [
                    {"kind": "block", "style": "subheading", "text": "No results"},
                    {"kind": "block", "style": "body", "text": "No expenses found for that query. Start logging to see them here!"},
                ],
            }
        }
        return {
            "result": {"intent": "query", "uiResponse": empty_ui},
            "messages": [AIMessage(content="No expenses found for query.")],
        }

    llm_layout = _make_llm(state["groq_key"], temperature=0.7)
    ui = await build_query_ui(msg, expenses, filters, currency, llm_layout)
    total = sum(e["amount"] for e in expenses)

    return {
        "result": {"intent": "query", "uiResponse": ui},
        "messages": [AIMessage(content=f"Found {len(expenses)} expenses totalling {currency} {total:.0f}.")],
    }


# ── Insights node ─────────────────────────────────────────────────────────────

async def insights_node(state: SageState) -> dict:
    from services.supabase import get_service_client

    msg = _last_human_message(state)
    db = get_service_client(state.get("user_token"))
    currency = state.get("currency", "INR")
    user_id = state["user_id"]

    ninety_ago = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    result = await (
        db.table("expenses")
        .select("amount, category, description, date")
        .eq("user_id", user_id)
        .gte("date", ninety_ago)
        .order("date", desc=True)
        .execute()
    )
    all_expenses = result.data or []

    llm = _make_llm(state["groq_key"], temperature=0.8)
    ui = await build_insights_ui(msg, all_expenses, currency, llm)

    return {
        "result": {"intent": "insights", "uiResponse": ui},
        "messages": [AIMessage(content="Insights generated.")],
    }


# ── Conversation node ─────────────────────────────────────────────────────────

async def conversation_node(state: SageState) -> dict:
    msg = _last_human_message(state)
    llm = _make_llm(state["groq_key"], temperature=0.8)

    # Include recent conversation history for context
    history_msgs = []
    for m in state["messages"][-6:]:  # last 3 turns
        if isinstance(m, HumanMessage):
            history_msgs.append(HumanMessage(content=str(m.content)))
        elif isinstance(m, AIMessage):
            history_msgs.append(AIMessage(content=str(m.content)))

    system_prompt = f"""You are Spenny AI, a friendly expense tracking assistant.
User message: "{msg}"

{UI_COMPONENT_CATALOG}

Respond helpfully and concisely.
If asked what you can do: mention logging expenses by text, answering spending questions, and giving financial insights.
Keep responses under 80 words. Use only "block" nodes (body or insight style). No charts, no tables, no summaries.

Return ONLY valid JSON (no markdown):
{{ "layout": {{ "kind": "column", "children": [ ...block nodes ] }} }}"""

    response = await llm.ainvoke([HumanMessage(content=system_prompt)])
    try:
        ui = json.loads(re.sub(r"```json?|```", "", response.content).strip())
    except Exception:
        ui = {
            "layout": {
                "kind": "column",
                "children": [{"kind": "block", "style": "body", "text": "I'm here to help with your expenses!"}],
            }
        }

    return {
        "result": {"intent": "conversation", "uiResponse": ui},
        "messages": [AIMessage(content=response.content)],
    }


# ── Build graph ───────────────────────────────────────────────────────────────

def build_sage_graph() -> tuple:
    """Returns (compiled_graph, memory_saver)."""
    memory = MemorySaver()

    builder = StateGraph(SageState)
    builder.add_node("router", router_node)
    builder.add_node("expense", expense_node)
    builder.add_node("query", query_node)
    builder.add_node("insights", insights_node)
    builder.add_node("conversation", conversation_node)

    builder.add_edge(START, "router")
    builder.add_conditional_edges("router", _route_by_intent, {
        "expense": "expense",
        "query": "query",
        "insights": "insights",
        "conversation": "conversation",
    })
    builder.add_edge("expense", END)
    builder.add_edge("query", END)
    builder.add_edge("insights", END)
    builder.add_edge("conversation", END)

    graph = builder.compile(checkpointer=memory)
    return graph, memory


# Singleton graph + memory
_graph, _memory = build_sage_graph()


async def run_sage(
    message: str,
    user_id: str,
    groq_key: str,
    currency: str = "INR",
    thread_id: str | None = None,
    user_token: str = "",
) -> dict:
    """
    Run the Sage agent for a single turn. Returns the result dict.
    thread_id is used to persist conversation memory across turns.
    user_token is the user's JWT for RLS-aware DB queries.
    """
    from agents.memory import load_session_summary
    tid = thread_id or user_id
    config = {"configurable": {"thread_id": tid}}

    # If the thread has no in-memory state (e.g. after a server restart),
    # seed it with the persisted summary so follow-ups still have context.
    existing = await _graph.aget_state(config)
    seed_messages: list[BaseMessage] = []
    if not existing or not existing.values.get("messages"):
        try:
            summary = await load_session_summary(user_id, tid)
            if summary:
                seed_messages = [AIMessage(content=f"[Previous conversation summary: {summary}]")]
        except Exception:
            pass

    initial_state: SageState = {
        "messages": seed_messages + [HumanMessage(content=message)],
        "user_id": user_id,
        "user_token": user_token,
        "groq_key": groq_key,
        "currency": currency,
        "intent": "",
        "result": {},
    }

    final_state = await _graph.ainvoke(initial_state, config=config)
    return final_state.get("result", {"intent": "conversation", "uiResponse": {
        "layout": {"kind": "column", "children": [{"kind": "block", "style": "body", "text": "Something went wrong. Please try again!"}]}
    }})


async def run_sage_stream(
    message: str,
    user_id: str,
    groq_key: str,
    currency: str = "INR",
    thread_id: str | None = None,
    user_token: str = "",
) -> AsyncGenerator[str, None]:
    """
    Stream the Sage agent response as SSE events.
    Yields SSE-formatted strings.
    """
    config = {"configurable": {"thread_id": thread_id or user_id}}
    initial_state: SageState = {
        "messages": [HumanMessage(content=message)],
        "user_id": user_id,
        "user_token": user_token,
        "groq_key": groq_key,
        "currency": currency,
        "intent": "",
        "result": {},
    }

    # Stream node updates
    async for event in _graph.astream(initial_state, config=config, stream_mode="updates"):
        for node_name, node_output in event.items():
            if node_name == "router":
                intent = node_output.get("intent", "")
                yield f"data: {json.dumps({'type': 'intent', 'intent': intent})}\n\n"
            elif "result" in node_output and node_output["result"]:
                result = node_output["result"]
                yield f"data: {json.dumps({'type': 'result', **result})}\n\n"

    yield "data: [DONE]\n\n"

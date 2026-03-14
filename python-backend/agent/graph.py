"""
LangGraph StateGraph for Sage — the agentic chat brain.

Architecture: every intent triggers a specialised multi-agent pipeline.

  ┌─────────┐
  │ START   │
  └────┬────┘
       ▼
  ┌──────────────┐
  │  classifier  │
  └──────┬───────┘
         ▼
  ┌──────────────────────────────────────────┐
  │            route_intent                  │
  ├──────────┬──────────┬──────────┬─────────┤
  ▼          ▼          ▼          ▼         ▼
expense   query     insights  conversation receipt
extract   extract   extract       │        vision
  ▼          ▼          ▼         │          ▼
categorize execute   analyze      │       categorize
  ▼          ▼          ▼         │          ▼
execute   respond   respond       │       execute
  ▼                               │          ▼
respond                           │       respond
  │          │          │         │          │
  └──────────┴──────────┴─────────┴──────────┘
                   ▼
                  END

Memory: InMemorySaver by default; AsyncPostgresSaver when
SUPABASE_POSTGRES_URL is set.
"""

from __future__ import annotations

import logging
import os
import textwrap
from typing import Literal

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from agent.nodes.classifier import classify_intent
from agent.nodes.conversation import handle_conversation
from agent.state import SageState
from agent.workflows.expense import (
    expense_categorize_agent,
    expense_execute_agent,
    expense_extract_agent,
    expense_respond_agent,
)
from agent.workflows.insights import (
    insights_analyze_agent,
    insights_extract_agent,
    insights_respond_agent,
)
from agent.workflows.query import (
    query_execute_agent,
    query_extract_agent,
    query_respond_agent,
)
from agent.workflows.receipt import (
    receipt_categorize_agent,
    receipt_execute_agent,
    receipt_respond_agent,
    receipt_vision_agent,
)

logger = logging.getLogger(__name__)

_SEP = "─" * 60


def _log_node(name: str, emoji: str, output: dict) -> None:
    """Pretty-print a node name and its state output to the console."""
    lines = [f"\n{_SEP}", f"  {emoji}  NODE: {name}", _SEP]
    for key, val in output.items():
        if key == "messages":
            for m in (val if isinstance(val, list) else [val]):
                content = getattr(m, "content", str(m))
                lines.append(f"  messages  → {textwrap.shorten(content, 120)}")
        else:
            short = textwrap.shorten(str(val), 200)
            lines.append(f"  {key:<22} → {short}")
    lines.append(_SEP)
    logger.info("\n".join(lines))


# ── Thin wrapper nodes ────────────────────────────────────────────────────────
# Each wraps the domain function so it can read/write SageState correctly.


async def classifier_node(state: SageState) -> dict:
    last_human = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        None,
    )
    message = last_human.content if last_human else ""
    intent = await classify_intent(message, state["groq_key"])
    out = {"intent": intent}
    _log_node("classifier", "🔍", {"user_message": message, **out})
    return out


def route_intent(
    state: SageState,
) -> Literal[
    "expense_extract",
    "query_extract",
    "insights_extract",
    "conversation_node",
    "receipt_vision",
]:
    intent = state.get("intent", "conversation")
    routes = {
        "expense": "expense_extract",
        "query": "query_extract",
        "insights": "insights_extract",
        "conversation": "conversation_node",
        "receipt": "receipt_vision",
    }
    return routes.get(intent, "conversation_node")


async def conversation_node(state: SageState) -> dict:
    last_human = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        None,
    )
    message = last_human.content if last_human else ""
    channel = state.get("channel", "web")

    history = []
    for m in state["messages"][:-1]:
        if isinstance(m, HumanMessage):
            history.append({"role": "user", "content": m.content})
        elif isinstance(m, AIMessage):
            history.append({"role": "assistant", "content": m.content})

    result = await handle_conversation(
        message,
        state["groq_key"],
        user_id=state["user_id"],
        chat_history=history if history else None,
        channel=channel,
    )

    if channel != "web":
        text = result.get("text", "I'm here to help!")
        out = {
            "result": result,
            "text_response": text,
            "messages": [AIMessage(content=text)],
        }
        _log_node("conversation", "💬", {"channel": channel, "reply": text})
        return out

    reply_ui = result.get("uiResponse", {})
    children = reply_ui.get("layout", {}).get("children", [])
    reply_text = ""
    if children and isinstance(children[0], dict):
        reply_text = children[0].get("text", "I'm here to help!")

    out = {
        "result": result,
        "messages": [AIMessage(content=reply_text or "I'm here to help!")],
    }
    _log_node("conversation", "💬", {"channel": channel, "reply": reply_text or "I'm here to help!"})
    return out


# ── Build graph ──────────────────────────────────────────────────────────────


def _build_checkpointer():
    postgres_url = os.environ.get("SUPABASE_POSTGRES_URL")
    if postgres_url:
        try:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

            return AsyncPostgresSaver.from_conn_string(postgres_url)
        except Exception as exc:
            logger.warning(
                "PostgresSaver init failed (%s), falling back to InMemorySaver", exc
            )
    return MemorySaver()


def build_sage_graph():
    """Build the main agentic chat graph."""
    builder = StateGraph(SageState)

    # ── Nodes ─────────────────────────────────────────────────────────────
    builder.add_node("classifier", classifier_node)
    builder.add_node("conversation_node", conversation_node)

    # Expense pipeline
    async def _expense_extract(state):
        out = await expense_extract_agent(state)
        _log_node("expense_extract", "📝", out)
        return out

    async def _expense_categorize(state):
        out = await expense_categorize_agent(state)
        _log_node("expense_categorize", "🏷️ ", out)
        return out

    async def _expense_execute(state):
        out = await expense_execute_agent(state)
        _log_node("expense_execute", "💾", {k: v for k, v in out.items() if k != "result"})
        return out

    async def _expense_respond(state):
        out = await expense_respond_agent(state)
        _log_node("expense_respond", "✅", {"messages": out.get("messages", [])})
        return out

    builder.add_node("expense_extract", _expense_extract)
    builder.add_node("expense_categorize", _expense_categorize)
    builder.add_node("expense_execute", _expense_execute)
    builder.add_node("expense_respond", _expense_respond)

    # Query pipeline
    async def _query_extract(state):
        out = await query_extract_agent(state)
        _log_node("query_extract", "🔎", out)
        return out

    async def _query_execute(state):
        out = await query_execute_agent(state)
        _log_node("query_execute", "📊", {
            "query_results_count": len(out.get("query_results", [])),
            "query_analytics": out.get("query_analytics", {}),
        })
        return out

    async def _query_respond(state):
        out = await query_respond_agent(state)
        _log_node("query_respond", "✅", {"messages": out.get("messages", [])})
        return out

    builder.add_node("query_extract", _query_extract)
    builder.add_node("query_execute", _query_execute)
    builder.add_node("query_respond", _query_respond)

    # Insights pipeline
    async def _insights_extract(state):
        out = await insights_extract_agent(state)
        _log_node("insights_extract", "🔎", out)
        return out

    async def _insights_analyze(state):
        out = await insights_analyze_agent(state)
        _log_node("insights_analyze", "🧠", {"insights_data_keys": list(out.get("insights_data", {}).keys())})
        return out

    async def _insights_respond(state):
        out = await insights_respond_agent(state)
        _log_node("insights_respond", "✅", {"messages": out.get("messages", [])})
        return out

    builder.add_node("insights_extract", _insights_extract)
    builder.add_node("insights_analyze", _insights_analyze)
    builder.add_node("insights_respond", _insights_respond)

    # Receipt pipeline
    async def _receipt_vision(state):
        out = await receipt_vision_agent(state)
        _log_node("receipt_vision", "📷", {"receipt_raw_items": out.get("receipt_raw_items", [])})
        return out

    async def _receipt_categorize(state):
        out = await receipt_categorize_agent(state)
        _log_node("receipt_categorize", "🏷️ ", out)
        return out

    async def _receipt_execute(state):
        out = await receipt_execute_agent(state)
        _log_node("receipt_execute", "💾", {k: v for k, v in out.items() if k != "result"})
        return out

    async def _receipt_respond(state):
        out = await receipt_respond_agent(state)
        _log_node("receipt_respond", "✅", {"messages": out.get("messages", [])})
        return out

    builder.add_node("receipt_vision", _receipt_vision)
    builder.add_node("receipt_categorize", _receipt_categorize)
    builder.add_node("receipt_execute", _receipt_execute)
    builder.add_node("receipt_respond", _receipt_respond)

    # ── Edges ─────────────────────────────────────────────────────────────
    builder.add_edge(START, "classifier")
    builder.add_conditional_edges("classifier", route_intent)

    # Expense chain
    builder.add_edge("expense_extract", "expense_categorize")
    builder.add_edge("expense_categorize", "expense_execute")
    builder.add_edge("expense_execute", "expense_respond")
    builder.add_edge("expense_respond", END)

    # Query chain
    builder.add_edge("query_extract", "query_execute")
    builder.add_edge("query_execute", "query_respond")
    builder.add_edge("query_respond", END)

    # Insights chain
    builder.add_edge("insights_extract", "insights_analyze")
    builder.add_edge("insights_analyze", "insights_respond")
    builder.add_edge("insights_respond", END)

    # Conversation — single node
    builder.add_edge("conversation_node", END)

    # Receipt chain
    builder.add_edge("receipt_vision", "receipt_categorize")
    builder.add_edge("receipt_categorize", "receipt_execute")
    builder.add_edge("receipt_execute", "receipt_respond")
    builder.add_edge("receipt_respond", END)

    checkpointer = _build_checkpointer()
    return builder.compile(checkpointer=checkpointer)


def build_receipt_graph():
    """Build a standalone receipt-processing graph (no classifier)."""
    builder = StateGraph(SageState)

    builder.add_node("receipt_vision", receipt_vision_agent)
    builder.add_node("receipt_categorize", receipt_categorize_agent)
    builder.add_node("receipt_execute", receipt_execute_agent)
    builder.add_node("receipt_respond", receipt_respond_agent)
    builder.add_edge(START, "receipt_vision")
    builder.add_edge("receipt_vision", "receipt_categorize")
    builder.add_edge("receipt_categorize", "receipt_execute")
    builder.add_edge("receipt_execute", "receipt_respond")
    builder.add_edge("receipt_respond", END)

    checkpointer = _build_checkpointer()
    return builder.compile(checkpointer=checkpointer)


# Module-level singletons — compiled once at startup
sage_graph = build_sage_graph()
receipt_graph = build_receipt_graph()

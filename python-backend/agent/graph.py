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


# ── Thin wrapper nodes ────────────────────────────────────────────────────────
# Each wraps the domain function so it can read/write SageState correctly.


async def classifier_node(state: SageState) -> dict:
    last_human = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        None,
    )
    message = last_human.content if last_human else ""
    intent = await classify_intent(message, state["groq_key"])
    logger.info("Intent classified: %s for message: %.60s", intent, message)
    return {"intent": intent}


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
        return {
            "result": result,
            "text_response": text,
            "messages": [AIMessage(content=text)],
        }

    reply_ui = result.get("uiResponse", {})
    children = reply_ui.get("layout", {}).get("children", [])
    reply_text = ""
    if children and isinstance(children[0], dict):
        reply_text = children[0].get("text", "I'm here to help!")

    return {
        "result": result,
        "messages": [AIMessage(content=reply_text or "I'm here to help!")],
    }


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
    builder.add_node("expense_extract", expense_extract_agent)
    builder.add_node("expense_categorize", expense_categorize_agent)
    builder.add_node("expense_execute", expense_execute_agent)
    builder.add_node("expense_respond", expense_respond_agent)

    # Query pipeline
    builder.add_node("query_extract", query_extract_agent)
    builder.add_node("query_execute", query_execute_agent)
    builder.add_node("query_respond", query_respond_agent)

    # Insights pipeline
    builder.add_node("insights_extract", insights_extract_agent)
    builder.add_node("insights_analyze", insights_analyze_agent)
    builder.add_node("insights_respond", insights_respond_agent)

    # Receipt pipeline
    builder.add_node("receipt_vision", receipt_vision_agent)
    builder.add_node("receipt_categorize", receipt_categorize_agent)
    builder.add_node("receipt_execute", receipt_execute_agent)
    builder.add_node("receipt_respond", receipt_respond_agent)

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

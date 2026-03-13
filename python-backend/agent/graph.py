"""
LangGraph StateGraph for Sage — the agentic chat brain.

State carries the full conversation so follow-up questions work naturally.
The graph:
  1. Classifies intent
  2. Routes to the appropriate node
  3. Returns a structured UI response

Memory: We use LangGraph's InMemorySaver by default (good for single-process
deployments on Render free tier). When SUPABASE_POSTGRES_URL is set we switch
to PostgresSaver for persistence across restarts.
"""

from __future__ import annotations

import logging
import os
from typing import Annotated, Any, Literal, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage

from agent.nodes.classifier import classify_intent
from agent.nodes.conversation import handle_conversation
from agent.nodes.expense import handle_expense
from agent.nodes.insights import handle_insights
from agent.nodes.query import handle_query

logger = logging.getLogger(__name__)


# ── State ─────────────────────────────────────────────────────────────────────

class SageState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    groq_key: str
    currency: str
    intent: str
    result: dict[str, Any]


# ── Node functions ─────────────────────────────────────────────────────────────

async def classifier_node(state: SageState) -> dict:
    last_human = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        None,
    )
    message = last_human.content if last_human else ""
    intent = await classify_intent(message, state["groq_key"])
    logger.info("Intent classified: %s for message: %.60s", intent, message)
    return {"intent": intent}


def route_intent(state: SageState) -> Literal["expense_node", "query_node", "insights_node", "conversation_node"]:
    intent = state.get("intent", "conversation")
    routes = {
        "expense": "expense_node",
        "query": "query_node",
        "insights": "insights_node",
        "conversation": "conversation_node",
    }
    return routes.get(intent, "conversation_node")


async def expense_node(state: SageState) -> dict:
    last_human = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        None,
    )
    message = last_human.content if last_human else ""
    result = await handle_expense(
        message, state["user_id"], state["groq_key"], state["currency"]
    )
    # Add AI response to message history for context
    reply_text = f"[expense logged] {result.get('text', 'Expenses logged.')}"
    return {
        "result": result,
        "messages": [AIMessage(content=reply_text)],
    }


async def query_node(state: SageState) -> dict:
    last_human = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        None,
    )
    message = last_human.content if last_human else ""
    result = await handle_query(
        message, state["user_id"], state["groq_key"], state["currency"]
    )
    reply_text = f"[query response] {result.get('text', 'Here is your spending data.')}"
    return {
        "result": result,
        "messages": [AIMessage(content=reply_text)],
    }


async def insights_node(state: SageState) -> dict:
    last_human = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        None,
    )
    message = last_human.content if last_human else ""
    result = await handle_insights(
        message, state["user_id"], state["groq_key"], state["currency"]
    )
    reply_text = f"[insights] Here are your spending insights."
    return {
        "result": result,
        "messages": [AIMessage(content=reply_text)],
    }


async def conversation_node(state: SageState) -> dict:
    last_human = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        None,
    )
    message = last_human.content if last_human else ""

    # Build chat history from state messages for context
    history = []
    for m in state["messages"][:-1]:  # exclude current message
        if isinstance(m, HumanMessage):
            history.append({"role": "user", "content": m.content})
        elif isinstance(m, AIMessage):
            history.append({"role": "assistant", "content": m.content})

    result = await handle_conversation(
        message, state["groq_key"],
        user_id=state["user_id"],
        chat_history=history if history else None,
    )

    reply_ui = result.get("uiResponse", {})
    # Extract text from first block for the message store
    reply_text = ""
    children = reply_ui.get("layout", {}).get("children", [])
    if children and isinstance(children[0], dict):
        reply_text = children[0].get("text", "I'm here to help!")

    return {
        "result": result,
        "messages": [AIMessage(content=reply_text or "I'm here to help!")],
    }


# ── Build graph ───────────────────────────────────────────────────────────────

def _build_checkpointer():
    postgres_url = os.environ.get("SUPABASE_POSTGRES_URL")
    if postgres_url:
        try:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
            return AsyncPostgresSaver.from_conn_string(postgres_url)
        except Exception as exc:
            logger.warning("PostgresSaver init failed (%s), falling back to InMemorySaver", exc)
    return MemorySaver()


def build_sage_graph():
    builder = StateGraph(SageState)

    builder.add_node("classifier", classifier_node)
    builder.add_node("expense_node", expense_node)
    builder.add_node("query_node", query_node)
    builder.add_node("insights_node", insights_node)
    builder.add_node("conversation_node", conversation_node)

    builder.add_edge(START, "classifier")
    builder.add_conditional_edges("classifier", route_intent)
    builder.add_edge("expense_node", END)
    builder.add_edge("query_node", END)
    builder.add_edge("insights_node", END)
    builder.add_edge("conversation_node", END)

    checkpointer = _build_checkpointer()
    return builder.compile(checkpointer=checkpointer)


# Module-level singleton — compiled once at startup
sage_graph = build_sage_graph()

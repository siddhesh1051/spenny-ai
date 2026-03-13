"""Sage agent state — shared across all workflow agents."""

from __future__ import annotations

from typing import Annotated, Any, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class SageState(TypedDict):
    """Shared state flowing through the agentic workflow graph.

    Fields are populated progressively by each agent in the pipeline.
    """

    # Core context (set once at invocation)
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    groq_key: str
    currency: str
    channel: str  # "web" | "whatsapp" | "telegram"

    # Classification
    intent: str

    # Expense workflow
    extracted_expenses: list[dict[str, Any]]
    categorized_expenses: list[dict[str, Any]]
    inserted_expenses: list[dict[str, Any]]

    # Query workflow
    query_filters: dict[str, Any]
    query_results: list[dict[str, Any]]
    query_analytics: dict[str, Any]

    # Insights workflow
    insights_window: int
    insights_data: dict[str, Any]

    # Receipt workflow
    receipt_image_url: str
    receipt_raw_items: list[dict[str, Any]]

    # Final output
    result: dict[str, Any]
    text_response: str

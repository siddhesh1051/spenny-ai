"""Conversation agent — RAG-enhanced context-aware chat.

Channel-aware: generates rich UI layout for web, plain text for messaging.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from agent.constants import UI_COMPONENT_CATALOG
from agent.tools.groq_tools import FAST_MODEL, groq_chat, groq_json

logger = logging.getLogger(__name__)


async def handle_conversation(
    message: str,
    groq_key: str,
    user_id: Optional[str] = None,
    chat_history: Optional[list[dict]] = None,
    channel: str = "web",
) -> dict[str, Any]:
    """Context-aware conversation handler with RAG.

    For web: returns ``{intent, uiResponse: {layout}}``
    For messaging: returns ``{intent, text}``
    """
    spending_context = ""
    if user_id and groq_key:
        try:
            from agent.memory.rag import retrieve_spending_context

            ctx = await retrieve_spending_context(message, user_id, groq_key)
            if ctx:
                spending_context = f"\n\nUser's spending context (semantically relevant):\n{ctx}\n"
        except Exception as exc:
            logger.debug("RAG context retrieval skipped: %s", exc)

    history_block = ""
    if chat_history:
        lines = []
        for h in chat_history[-6:]:
            role = "User" if h["role"] == "user" else "Sage"
            lines.append(f"{role}: {h['content']}")
        history_block = "\n\nConversation history:\n" + "\n".join(lines) + "\n"

    # ── Messaging channels: plain text ────────────────────────────────────
    if channel != "web":
        try:
            text = await groq_chat(
                f"""You are Spenny AI, a friendly expense tracking assistant.{spending_context}{history_block}
User message: "{message}"

Respond helpfully and concisely (max 80 words). Plain text only, no JSON.
If asked what you can do, mention: log expenses by text/voice/receipt, answer spending questions, give financial insights.
If the user asks a follow-up about spending and context is available, use it.""",
                groq_key,
                temperature=0.8,
                max_tokens=200,
                model=FAST_MODEL,
            )
        except Exception:
            text = "I'm here to help with your expenses!"

        return {"intent": "conversation", "text": text}

    # ── Web: rich UI layout ───────────────────────────────────────────────
    ui = await groq_json(
        f"""You are Spenny AI, a friendly and smart expense tracking assistant.{spending_context}{history_block}
User message: "{message}"

{UI_COMPONENT_CATALOG}

Respond helpfully and concisely.
If asked what you can do, mention: log expenses by text/voice/receipt, answer questions about spending history, and give financial insights.
Keep responses under 80 words. Use only "block" nodes (body or insight style). No charts, no tables, no summaries.
If the user asks a follow-up about spending and context is available, use it to give a specific answer.

Return ONLY valid JSON (no markdown):
{{ "layout": {{ "kind": "column", "children": [ ...block nodes ] }} }}""",
        groq_key,
        temperature=0.8,
        max_tokens=300,
    ) or {
        "layout": {
            "kind": "column",
            "children": [
                {"kind": "block", "style": "body", "text": "I'm here to help with your expenses!"}
            ],
        }
    }

    return {"intent": "conversation", "uiResponse": ui}

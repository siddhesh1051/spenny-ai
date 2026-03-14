"""POST /api/sage/chat — LangGraph-powered agentic Sage chat."""

from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from agent.graph import sage_graph
from agent.tools.db_tools import get_user_profile
from auth.supabase_jwt import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None
    channel: Optional[str] = "web"


@router.post("/sage/chat")
async def sage_chat(
    body: ChatRequest,
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    message = body.message.strip()

    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    profile = get_user_profile(user_id)
    groq_key = profile.get("groq_api_key") or os.environ.get("GROQ_API_KEY", "")
    currency = profile.get("currency") or "INR"

    if not groq_key:
        return {
            "intent": "conversation",
            "uiResponse": {
                "layout": {
                    "kind": "column",
                    "children": [
                        {
                            "kind": "block",
                            "style": "body",
                            "text": "No AI key is configured. Please add your Groq API key in Settings to start using Sage AI.",
                        }
                    ],
                }
            },
        }

    thread_id = body.thread_id or f"{user_id}-default"
    config = {"configurable": {"thread_id": thread_id}}
    channel = body.channel or "web"

    initial_state = {
        "messages": [HumanMessage(content=message)],
        "user_id": user_id,
        "groq_key": groq_key,
        "currency": currency,
        "channel": channel,
        "intent": "",
        "result": {},
    }

    try:
        logger.info(
            "sage_chat user=%s thread=%s channel=%s msg=%.80s",
            user_id,
            thread_id,
            channel,
            message,
        )

        result: dict = {}
        async for chunk in sage_graph.astream(initial_state, config=config):
            for node_name, node_output in chunk.items():
                if (
                    isinstance(node_output, dict)
                    and "result" in node_output
                    and node_output["result"]
                ):
                    result = node_output["result"]

        if not result:
            raise ValueError("Empty result from graph")
        return result
    except Exception as exc:
        logger.exception("sage_chat error: %s", exc)
        return {
            "intent": "conversation",
            "uiResponse": {
                "layout": {
                    "kind": "column",
                    "children": [
                        {
                            "kind": "block",
                            "style": "body",
                            "text": "I ran into a hiccup — please try again!",
                        }
                    ],
                }
            },
        }

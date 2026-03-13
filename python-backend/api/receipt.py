"""POST /api/receipt/extract — Agentic receipt processing via LangGraph."""

from __future__ import annotations

import base64
import logging
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from langchain_core.messages import HumanMessage

from agent.graph import receipt_graph
from agent.tools.db_tools import get_user_profile
from auth.supabase_jwt import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/receipt/extract")
async def extract_receipt(
    image: UploadFile = File(...),
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    profile = get_user_profile(user_id)
    groq_key = profile.get("groq_api_key") or os.environ.get("GROQ_API_KEY", "")
    currency = profile.get("currency") or "INR"

    if not groq_key:
        raise HTTPException(status_code=400, detail="No API key configured")

    content_type = image.content_type or "image/jpeg"
    if content_type not in ALLOWED_TYPES and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are supported")

    image_bytes = await image.read()
    if len(image_bytes) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    logger.info(
        "extract_receipt user=%s size=%d type=%s", user_id, len(image_bytes), content_type
    )

    b64 = base64.b64encode(image_bytes).decode()
    data_url = f"data:{content_type};base64,{b64}"

    thread_id = f"{user_id}-receipt-{uuid.uuid4().hex[:8]}"
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "messages": [HumanMessage(content="[receipt uploaded]")],
        "user_id": user_id,
        "groq_key": groq_key,
        "currency": currency,
        "channel": "web",
        "intent": "receipt",
        "receipt_image_url": data_url,
        "result": {},
    }

    try:
        result: dict = {}
        async for chunk in receipt_graph.astream(initial_state, config=config):
            for _node_name, node_output in chunk.items():
                if (
                    isinstance(node_output, dict)
                    and "result" in node_output
                    and node_output["result"]
                ):
                    result = node_output["result"]

        if not result:
            raise ValueError("Empty result from receipt graph")
        return result
    except Exception as exc:
        logger.exception("extract_receipt error: %s", exc)
        return {
            "intent": "conversation",
            "uiResponse": {
                "layout": {
                    "kind": "column",
                    "children": [
                        {
                            "kind": "block",
                            "style": "body",
                            "text": "I couldn't process the receipt. Please try a clearer photo.",
                        }
                    ],
                }
            },
        }

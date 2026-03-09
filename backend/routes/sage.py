"""Sage chat route — supports both streaming (SSE) and non-streaming JSON."""

import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from middleware.auth import get_current_user
from agents.sage_graph import run_sage, run_sage_stream
from agents.memory import load_session_summary, save_session_summary, summarize_conversation
from services.supabase import get_service_client
from services.config import get_settings

router = APIRouter(prefix="/sage", tags=["sage"])
_settings = get_settings()


class SageRequest(BaseModel):
    message: str
    thread_id: str | None = None
    stream: bool = False


async def _get_user_profile(user_id: str, user_token: str) -> tuple[str, str]:
    """Returns (groq_key, currency) for the user."""
    db = get_service_client(user_token)
    result = await db.table("profiles").select("groq_api_key, currency").eq("id", user_id).single().execute()
    profile = result.data or {}
    groq_key = profile.get("groq_api_key") or _settings.groq_api_key
    currency = profile.get("currency") or "INR"
    return groq_key, currency


async def _persist_session(user_id: str, thread_id: str, groq_key: str):
    """Background task: summarize and save the conversation to Supabase."""
    try:
        from agents.sage_graph import _memory, _graph
        config = {"configurable": {"thread_id": thread_id}}
        state = await _graph.aget_state(config)
        if state and state.values:
            messages = state.values.get("messages", [])
            if len(messages) >= 4:  # Only summarize after a few turns
                summary = await summarize_conversation(messages, groq_key)
                msg_dicts = [
                    {"role": "human" if hasattr(m, "type") and m.type == "human" else "ai",
                     "content": str(m.content)[:500]}
                    for m in messages[-10:]
                ]
                await save_session_summary(user_id, thread_id, msg_dicts, summary)
    except Exception as e:
        print(f"[sage session persist] error: {e}")


@router.post("/chat")
async def sage_chat(
    body: SageRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    groq_key, currency = await _get_user_profile(user["id"], user["token"])
    if not groq_key:
        return {
            "intent": "conversation",
            "uiResponse": {
                "layout": {
                    "kind": "column",
                    "children": [{"kind": "block", "style": "body",
                                  "text": "No AI key is configured. Please add your Groq API key in Settings."}],
                }
            },
        }

    thread_id = body.thread_id or user["id"]

    if body.stream:
        async def streamer():
            async for chunk in run_sage_stream(message, user["id"], groq_key, currency, thread_id, user["token"]):
                yield chunk
            # Persist session after stream completes
            await _persist_session(user["id"], thread_id, groq_key)

        return StreamingResponse(
            streamer(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    result = await run_sage(message, user["id"], groq_key, currency, thread_id, user["token"])

    # Persist session in background after response
    background_tasks.add_task(_persist_session, user["id"], thread_id, groq_key)

    return result

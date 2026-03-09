"""
Session persistence helpers.

Short-term memory is handled by LangGraph's MemorySaver (in-process).
Long-term memory (session summaries) is stored in the sage_sessions table
so context survives server restarts.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from services.supabase import get_service_client


async def load_session_summary(user_id: str, thread_id: str) -> str | None:
    """
    Load the conversation summary for a thread from Supabase.
    Returns None if no session exists yet.
    """
    db = get_service_client()
    result = await (
        db.table("sage_sessions")
        .select("summary")
        .eq("user_id", user_id)
        .eq("thread_id", thread_id)
        .limit(1)
        .execute()
    )
    rows = result.data if isinstance(result.data, list) else ([result.data] if result.data else [])
    if rows:
        return rows[0].get("summary")
    return None


async def save_session_summary(user_id: str, thread_id: str, messages: list[dict], new_summary: str):
    """
    Upsert the conversation summary to Supabase.
    `messages` is the full message list as dicts.
    """
    db = get_service_client()
    await db.table("sage_sessions").upsert(
        {
            "user_id": user_id,
            "thread_id": thread_id,
            "messages": messages,
            "summary": new_summary,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="user_id,thread_id",
    ).execute()


async def summarize_conversation(messages: list, groq_key: str) -> str:
    """
    Ask the LLM to produce a concise summary of the conversation so far.
    Used to create long-term memory without storing full message history.
    """
    from langchain_groq import ChatGroq
    from langchain_core.messages import HumanMessage

    if not messages:
        return ""

    turns = []
    for m in messages[-20:]:  # last 20 messages at most
        role = "User" if hasattr(m, "type") and m.type == "human" else "Sage"
        turns.append(f"{role}: {str(m.content)[:200]}")

    conversation = "\n".join(turns)

    llm = ChatGroq(api_key=groq_key, model="llama-3.1-8b-instant", temperature=0)
    response = await llm.ainvoke([HumanMessage(content=f"""Summarize this expense tracking conversation in 2-3 sentences. 
Focus on: what expenses were logged, what queries were asked, key numbers mentioned.

Conversation:
{conversation}

Summary:""")])
    return response.content.strip()

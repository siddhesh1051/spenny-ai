"""
RAG (Retrieval-Augmented Generation) utilities for Sage.

Uses Groq's embedding model (nomic-embed-text-v1.5, free) to embed
messages and retrieve semantically similar context from the DB.

Embeddings are stored lazily — only generated when a message is saved
to chat_messages and the embedding column is null.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

from utils.http import async_client
from db.client import get_admin_client

logger = logging.getLogger(__name__)

EMBED_URL = "https://api.groq.com/openai/v1/embeddings"
EMBED_MODEL = "nomic-embed-text-v1.5"
EMBED_DIM = 768


async def embed_text(text: str, groq_key: str) -> Optional[list[float]]:
    """Get a text embedding from Groq. Returns None on failure."""
    try:
        async with async_client(timeout=30) as client:
            r = await client.post(
                EMBED_URL,
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={"model": EMBED_MODEL, "input": text[:2048]},
            )
            if not r.is_success:
                logger.warning("Embed API failed: %s", r.status_code)
                return None
            data = r.json()
            return data["data"][0]["embedding"]
    except Exception as exc:
        logger.warning("embed_text failed: %s", exc)
        return None


async def retrieve_spending_context(
    query: str,
    user_id: str,
    groq_key: str,
    max_items: int = 5,
) -> Optional[str]:
    """
    Retrieve semantically similar expenses to use as context for conversation.
    Returns a formatted string summary, or None if RAG is unavailable.
    """
    embedding = await embed_text(query, groq_key)
    if not embedding:
        return None

    db = get_admin_client()
    try:
        result = db.rpc(
            "match_expenses",
            {
                "query_embedding": embedding,
                "match_user_id": user_id,
                "match_count": max_items,
                "match_threshold": 0.5,
            },
        ).execute()
        rows = result.data or []
        if not rows:
            return None

        lines = [
            f"- {r['description']} ({r['category']}): {r['amount']} on {r['date'][:10]}"
            for r in rows
        ]
        return "Relevant past expenses:\n" + "\n".join(lines)
    except Exception as exc:
        logger.debug("RAG retrieval failed (pgvector may not be set up yet): %s", exc)
        return None


async def embed_and_store_message(
    message_id: str,
    content: str,
    groq_key: str,
) -> None:
    """Embed a chat message and store in DB. Fire-and-forget."""
    embedding = await embed_text(content, groq_key)
    if not embedding:
        return
    db = get_admin_client()
    try:
        db.table("chat_messages").update({"embedding": embedding}).eq("id", message_id).execute()
    except Exception as exc:
        logger.debug("Failed to store message embedding: %s", exc)


async def embed_and_store_expense(
    expense_id: str,
    description: str,
    category: str,
    groq_key: str,
) -> None:
    """Embed an expense description and store in DB. Fire-and-forget."""
    text = f"{description} {category}"
    embedding = await embed_text(text, groq_key)
    if not embedding:
        return
    db = get_admin_client()
    try:
        db.table("expenses").update({"embedding": embedding}).eq("id", expense_id).execute()
    except Exception as exc:
        logger.debug("Failed to store expense embedding: %s", exc)

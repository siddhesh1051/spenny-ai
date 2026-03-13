"""Chat thread and message management."""

from __future__ import annotations

import logging
from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth.supabase_jwt import get_current_user
from db.client import get_admin_client

logger = logging.getLogger(__name__)
router = APIRouter()

PAGE_SIZE = 10


# ── Models ────────────────────────────────────────────────────────────────────

class CreateThreadBody(BaseModel):
    title: str = "New Chat"


class UpdateThreadBody(BaseModel):
    title: str


class SaveMessageBody(BaseModel):
    id: str
    role: str  # "user" | "assistant"
    content: str
    response: Optional[Any] = None
    voice: Optional[Any] = None
    receipt: Optional[Any] = None


class RemoveItemsBody(BaseModel):
    removed_ids: list[str]


# ── Thread endpoints ───────────────────────────────────────────────────────────

@router.get("/threads")
async def list_threads(
    page: int = 0,
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()
    from_ = page * PAGE_SIZE
    to_ = from_ + PAGE_SIZE  # fetch one extra to detect hasMore

    result = (
        db.table("chat_threads")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .range(from_, to_)
        .execute()
    )
    data = result.data or []
    has_more = len(data) > PAGE_SIZE
    return {
        "threads": data[:PAGE_SIZE],
        "has_more": has_more,
        "page": page,
    }


@router.post("/threads")
async def create_thread(
    body: CreateThreadBody,
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()
    result = (
        db.table("chat_threads")
        .insert({"user_id": user_id, "title": body.title})
        .execute()
    )
    inserted = (result.data or [{}])[0]
    # fetch back with full fields
    row = (
        db.table("chat_threads")
        .select("id, title, created_at, updated_at")
        .eq("id", inserted["id"])
        .single()
        .execute()
    )
    return row.data or {}


@router.put("/threads/{thread_id}")
async def update_thread(
    thread_id: str,
    body: UpdateThreadBody,
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()
    db.table("chat_threads").update({"title": body.title}).eq("id", thread_id).eq("user_id", user_id).execute()
    return {"ok": True}


@router.delete("/threads/{thread_id}")
async def delete_thread(
    thread_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()
    # Delete messages first to avoid FK constraint violation
    db.table("chat_messages").delete().eq("thread_id", thread_id).execute()
    db.table("chat_threads").delete().eq("id", thread_id).eq("user_id", user_id).execute()
    return {"ok": True}


# ── Message endpoints ─────────────────────────────────────────────────────────

@router.get("/threads/{thread_id}/messages")
async def get_messages(
    thread_id: str,
    user: dict = Depends(get_current_user),
) -> list:
    user_id: str = user["sub"]
    db = get_admin_client()
    # Verify thread belongs to user
    check = (
        db.table("chat_threads")
        .select("id")
        .eq("id", thread_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=404, detail="Thread not found")

    result = (
        db.table("chat_messages")
        .select("id, role, content, response, voice, receipt, created_at")
        .eq("thread_id", thread_id)
        .order("seq", desc=False)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data or []


@router.post("/threads/{thread_id}/messages")
async def save_message(
    thread_id: str,
    body: SaveMessageBody,
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    db = get_admin_client()

    voice_payload = None
    if body.voice and isinstance(body.voice, dict):
        voice_payload = {
            "waveformData": body.voice.get("waveformData"),
            "duration": body.voice.get("duration"),
        }

    db.table("chat_messages").insert({
        "id": body.id,
        "thread_id": thread_id,
        "user_id": user_id,
        "role": body.role,
        "content": body.content,
        "response": body.response,
        "voice": voice_payload,
        "receipt": body.receipt,
    }).execute()
    return {"ok": True}


@router.patch("/threads/{thread_id}/messages/{message_id}/remove-items")
async def remove_items_from_message(
    thread_id: str,
    message_id: str,
    body: RemoveItemsBody,
    user: dict = Depends(get_current_user),
) -> dict:
    """Strip deleted expense IDs from a collection node in a stored message."""
    db = get_admin_client()
    result = (
        db.table("chat_messages")
        .select("response")
        .eq("id", message_id)
        .single()
        .execute()
    )
    if not result.data or not result.data.get("response"):
        return {"response": None}

    import json, copy
    response = copy.deepcopy(result.data["response"])

    def strip(node: dict) -> None:
        if node.get("kind") == "collection" and isinstance(node.get("items"), list):
            node["items"] = [
                item for item in node["items"]
                if not item.get("id") or item["id"] not in body.removed_ids
            ]
        for child in node.get("children", []):
            if isinstance(child, dict):
                strip(child)

    ui = response.get("uiResponse", {})
    layout = ui.get("layout", {})
    if layout:
        strip(layout)

    db.table("chat_messages").update({"response": response}).eq("id", message_id).execute()
    return {"response": response}

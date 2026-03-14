"""App API key management (for MCP server access).

The api_keys table uses RLS and is only accessible with the user's own JWT,
not the service-role key via PostgREST. We proxy requests to Supabase directly
using the user's token from the Authorization header.
"""

from __future__ import annotations

import os
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from auth.supabase_jwt import get_current_user
from utils.http import async_client

logger = logging.getLogger(__name__)
router = APIRouter()


def _supabase_headers(access_token: str) -> dict:
    return {
        "Authorization": f"Bearer {access_token}",
        "apikey": os.environ["SUPABASE_ANON_KEY"],
        "Content-Type": "application/json",
    }


def _supabase_url(path: str) -> str:
    return f"{os.environ['SUPABASE_URL']}{path}"


class CreateKeyBody(BaseModel):
    key_name: str


@router.get("/api-keys")
async def list_api_keys(
    authorization: Optional[str] = Header(default=None),
    user: dict = Depends(get_current_user),
) -> list:
    token = (authorization or "").removeprefix("Bearer ").strip()
    async with async_client(timeout=15) as client:
        r = await client.get(
            _supabase_url("/rest/v1/api_keys"),
            params={
                "select": "id,key_name,api_key_plain,is_active,created_at,last_used_at",
                "order": "created_at.desc",
            },
            headers=_supabase_headers(token),
        )
    if r.status_code != 200:
        logger.error("api_keys list failed: %s %s", r.status_code, r.text)
        return []
    return r.json()


@router.post("/api-keys")
async def create_api_key(
    body: CreateKeyBody,
    authorization: Optional[str] = Header(default=None),
    user: dict = Depends(get_current_user),
) -> dict:
    if not body.key_name.strip():
        raise HTTPException(status_code=400, detail="key_name is required")
    token = (authorization or "").removeprefix("Bearer ").strip()
    async with async_client(timeout=15) as client:
        r = await client.post(
            _supabase_url("/rest/v1/rpc/create_api_key"),
            json={"key_name_param": body.key_name.strip()},
            headers=_supabase_headers(token),
        )
    if r.status_code not in (200, 201):
        logger.error("create_api_key failed: %s %s", r.status_code, r.text)
        raise HTTPException(status_code=500, detail="Failed to create API key")
    rows = r.json()
    if isinstance(rows, list) and rows:
        return rows[0]
    if isinstance(rows, dict):
        return rows
    raise HTTPException(status_code=500, detail="Failed to create API key")


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    authorization: Optional[str] = Header(default=None),
    user: dict = Depends(get_current_user),
) -> dict:
    token = (authorization or "").removeprefix("Bearer ").strip()
    async with async_client(timeout=15) as client:
        r = await client.post(
            _supabase_url("/rest/v1/rpc/revoke_api_key"),
            json={"key_id_param": key_id},
            headers=_supabase_headers(token),
        )
    if r.status_code not in (200, 201, 204):
        logger.error("revoke_api_key failed: %s %s", r.status_code, r.text)
        raise HTTPException(status_code=500, detail="Failed to revoke API key")
    return {"ok": True}

"""
Supabase JWT verification.

Supabase signs JWTs with a secret (HS256). We verify the token locally
without making a network call — fast and free. Falls back to calling
supabase.auth.getUser() if the secret is not configured.
"""

import os
import logging
from typing import Optional

from fastapi import HTTPException, Header
from jose import jwt, JWTError
from utils.http import async_client

logger = logging.getLogger(__name__)


def _verify_jwt_local(token: str) -> dict:
    """Verify Supabase JWT using the project JWT secret (HS256)."""
    secret = os.environ.get("SUPABASE_JWT_SECRET", "")
    if not secret:
        raise JWTError("No JWT secret configured")

    payload = jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        options={"verify_aud": False},
    )
    return payload


async def _verify_jwt_remote(token: str) -> dict:
    """Fall back: call Supabase auth /user endpoint to validate token."""
    url = os.environ["SUPABASE_URL"]
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    async with async_client(timeout=10) as client:
        r = await client.get(
            f"{url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": anon_key,
            },
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Unauthorized")
    data = r.json()
    user_id = data.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {"sub": user_id, "email": data.get("email"), **data}


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
) -> dict:
    """
    FastAPI dependency that extracts and validates the Supabase JWT.
    Returns the decoded payload dict with at least `sub` (user_id).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        payload = _verify_jwt_local(token)
        return payload
    except JWTError:
        pass

    # Secret not configured or token invalid locally — fall back to remote
    try:
        logger.debug("Local JWT verification failed, trying remote")
        return await _verify_jwt_remote(token)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Remote JWT verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Unauthorized")

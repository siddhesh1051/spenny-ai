"""JWT verification middleware — validates Supabase user tokens via REST API."""

import httpx
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from services.config import get_settings

_settings = get_settings()
_bearer = HTTPBearer()


def _make_client() -> httpx.AsyncClient:
    """Create httpx client — SSL verify disabled locally for Zscaler proxy."""
    return httpx.AsyncClient(verify=_settings.ssl_verify, timeout=10)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
) -> dict:
    """
    Validates the Bearer JWT against Supabase Auth REST API.
    Returns {"id": ..., "email": ..., "token": ...} on success.
    Raises HTTP 401 on failure.
    """
    token = credentials.credentials
    try:
        async with _make_client() as client:
            resp = await client.get(
                f"{_settings.supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": _settings.supabase_anon_key,
                },
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Unauthorized")
        data = resp.json()
        user_id = data.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        return {"id": user_id, "email": data.get("email", ""), "token": token}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[auth] error: {e}")
        raise HTTPException(status_code=401, detail="Unauthorized")

"""Supabase client factory — service role for all DB operations."""

import os
from functools import lru_cache

import httpx
from supabase import create_client, Client


def _make_httpx_client() -> httpx.Client:
    """
    Create an httpx.Client with SSL verification disabled for local macOS dev.
    Controlled by the SSL_VERIFY env var (default: true).
    In production (Render), SSL_VERIFY is not set so it defaults to True.
    """
    verify: bool | str = os.environ.get("SSL_VERIFY", "true").lower() != "false"
    if not verify:
        # Local dev only — silence the InsecureRequestWarning
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    return httpx.Client(verify=verify)


@lru_cache(maxsize=1)
def get_admin_client() -> Client:
    """
    Service-role client for server-side DB operations.
    Cached as a singleton — created once at startup.
    """
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(url, key)

    # Patch the underlying httpx client used by postgrest to fix macOS SSL
    http = _make_httpx_client()
    client.postgrest.session = http  # type: ignore[attr-defined]

    return client

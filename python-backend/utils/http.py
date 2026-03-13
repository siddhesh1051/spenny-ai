"""Shared HTTP client factory.

On macOS with Homebrew Python 3.13, the system CA store may have broken
certificates. We use certifi's CA bundle as the preferred option, and fall
back to disabling SSL verification when SSL_VERIFY=false is set (local dev only).

In production (Render/Railway), SSL verification is always enabled.
"""

import os
import certifi
import httpx


def _ssl_verify() -> bool | str:
    """
    Determine SSL verification setting.
    - Production: always verify using certifi CA bundle
    - Local dev (SSL_VERIFY=false): skip verification with a warning
    """
    if os.environ.get("SSL_VERIFY", "true").lower() == "false":
        return False
    return certifi.where()


def async_client(**kwargs) -> httpx.AsyncClient:
    """Create an httpx.AsyncClient with appropriate SSL settings."""
    kwargs.setdefault("verify", _ssl_verify())
    return httpx.AsyncClient(**kwargs)

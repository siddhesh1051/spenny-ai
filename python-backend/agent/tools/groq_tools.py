"""Groq API helpers — chat completion and JSON extraction."""

import json
import os
import re
import logging
from typing import Any, Optional, TypeVar

from utils.http import async_client as _async_client

logger = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
FAST_MODEL = "llama-3.1-8b-instant"

T = TypeVar("T")


async def groq_chat(
    prompt: str,
    key: str,
    temperature: float = 0.7,
    max_tokens: int = 800,
    model: str = DEFAULT_MODEL,
    system: Optional[str] = None,
) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    async with _async_client(timeout=60) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
        )
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"] or ""


class GroqRateLimitError(Exception):
    """Raised when Groq returns a 429 Too Many Requests."""


async def groq_json(
    prompt: str,
    key: str,
    temperature: float = 0.0,
    max_tokens: int = 400,
    model: str = DEFAULT_MODEL,
) -> Optional[Any]:
    """Call Groq and parse the response as JSON. Returns None on failure."""
    try:
        raw = await groq_chat(prompt, key, temperature=temperature, max_tokens=max_tokens, model=model)
        cleaned = re.sub(r"```json?", "", raw)
        cleaned = re.sub(r"```", "", cleaned).strip()
        return json.loads(cleaned)
    except Exception as exc:
        if "429" in str(exc) or getattr(getattr(exc, "response", None), "status_code", None) == 429:
            raise GroqRateLimitError("Groq rate limit hit") from exc
        logger.debug("groq_json failed: %s", exc)
        return None


async def groq_vision_extract(
    image_data_url: str,
    text_prompt: str,
    key: str,
    max_tokens: int = 600,
) -> str:
    """Call Groq vision model with an image data URL."""
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": image_data_url}},
                {"type": "text", "text": text_prompt},
            ],
        }
    ]
    async with _async_client(timeout=90) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": VISION_MODEL,
                "messages": messages,
                "temperature": 0.1,
                "max_tokens": max_tokens,
            },
        )
        r.raise_for_status()
        data = r.json()
        raw = data["choices"][0]["message"]["content"] or ""
        return re.sub(r"```json?|```", "", raw).strip()

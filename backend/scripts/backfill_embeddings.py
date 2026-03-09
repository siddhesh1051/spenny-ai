#!/usr/bin/env python3
"""
Backfill vector embeddings for existing expenses using Groq.

Usage:
  cd backend
  source .venv/bin/activate
  python scripts/backfill_embeddings.py

This script fetches expenses without embeddings, generates embeddings using
Groq's embedding model, and updates the expenses table.
"""

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import httpx
from services.supabase import get_service_client
from services.config import get_settings

EMBED_MODEL = "nomic-embed-text-v1.5"
GROQ_EMBED_URL = "https://api.groq.com/openai/v1/embeddings"
BATCH_SIZE = 20


async def embed_texts(texts: list[str], api_key: str) -> list[list[float]]:
    """Get embeddings for a batch of texts from Groq."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            GROQ_EMBED_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": EMBED_MODEL, "input": texts},
        )
        if not resp.is_success:
            raise RuntimeError(f"Groq embed error {resp.status_code}: {resp.text}")
        data = resp.json()
        return [item["embedding"] for item in sorted(data["data"], key=lambda x: x["index"])]


async def main():
    settings = get_settings()
    groq_key = settings.groq_api_key
    if not groq_key:
        print("ERROR: GROQ_API_KEY not set")
        sys.exit(1)

    db = get_service_client()

    # Fetch expenses without embeddings
    result = db.table("expenses").select("id, description, category, amount").is_("embedding", "null").execute()
    expenses = result.data or []
    print(f"Found {len(expenses)} expenses without embeddings")

    if not expenses:
        print("Nothing to backfill.")
        return

    updated = 0
    for i in range(0, len(expenses), BATCH_SIZE):
        batch = expenses[i:i + BATCH_SIZE]
        texts = [
            f"{e['description']} — {e['category']} — {e['amount']}"
            for e in batch
        ]
        try:
            embeddings = await embed_texts(texts, groq_key)
            for expense, embedding in zip(batch, embeddings):
                db.table("expenses").update({"embedding": embedding}).eq("id", expense["id"]).execute()
                updated += 1
            print(f"  Updated {updated}/{len(expenses)} expenses...")
        except Exception as e:
            print(f"  Batch {i//BATCH_SIZE + 1} failed: {e}")

    print(f"Done. Backfilled {updated} embeddings.")


if __name__ == "__main__":
    asyncio.run(main())

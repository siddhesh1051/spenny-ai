"""
Spenny AI — FastAPI Backend
Replaces Supabase Edge Functions with a proper Python backend.
"""

import sys
import os

# Allow imports from the backend root
sys.path.insert(0, os.path.dirname(__file__))

# Disable SSL verification globally when SSL_VERIFY=false (Zscaler/corporate proxy env)
# This must run before any httpx/groq/langchain clients are created
if os.environ.get("SSL_VERIFY", "true").lower() == "false":
    import ssl
    import httpx
    # Monkey-patch httpx to skip SSL verification globally
    _orig_init = httpx.AsyncClient.__init__
    def _patched_async_init(self, *args, **kwargs):
        kwargs.setdefault("verify", False)
        _orig_init(self, *args, **kwargs)
    httpx.AsyncClient.__init__ = _patched_async_init

    _orig_sync_init = httpx.Client.__init__
    def _patched_sync_init(self, *args, **kwargs):
        kwargs.setdefault("verify", False)
        _orig_sync_init(self, *args, **kwargs)
    httpx.Client.__init__ = _patched_sync_init

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.config import get_settings
from routes.sage import router as sage_router
from routes.receipt import router as receipt_router
from routes.audio import router as audio_router
from routes.whatsapp import router as whatsapp_router
from routes.gmail_sync import router as gmail_router

settings = get_settings()

app = FastAPI(
    title="Spenny AI API",
    version="2.0.0",
    description="Agentic expense tracking backend (FastAPI + LangGraph)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sage_router, prefix="/api")
app.include_router(receipt_router, prefix="/api")
app.include_router(audio_router, prefix="/api")
app.include_router(whatsapp_router, prefix="/api")
app.include_router(gmail_router, prefix="/api")


@app.get("/")
async def health():
    return {"ok": True, "service": "spenny-ai-backend", "version": "2.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

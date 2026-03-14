"""Spenny AI — Python Backend (FastAPI + LangGraph)."""

import logging
import os
import sys

# Fix macOS Python SSL certificate verification before any network imports
if sys.platform == "darwin":
    import ssl
    import certifi
    ssl._create_default_https_context = ssl.create_default_context
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from api import sage, audio, receipt, whatsapp, telegram, gmail
from api import profile, threads, expenses, apikeys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Spenny AI Backend",
    description="Python FastAPI backend with LangGraph-powered Sage AI",
    version="1.0.0",
)

# CORS — allow web app origins
cors_origins_raw = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
cors_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def no_cache_middleware(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    return response

# Mount all API routers
app.include_router(sage.router, prefix="/api")
app.include_router(audio.router, prefix="/api")
app.include_router(receipt.router, prefix="/api")
app.include_router(whatsapp.router, prefix="/api")
app.include_router(telegram.router, prefix="/api")
app.include_router(gmail.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(threads.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(apikeys.router, prefix="/api")


@app.get("/")
async def root():
    return {"status": "ok", "service": "Spenny AI Backend"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)

"""POST /api/audio/transcribe — Groq Whisper transcription."""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from utils.http import async_client

from auth.supabase_jwt import get_current_user
from agent.tools.db_tools import get_user_profile

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/audio/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    user: dict = Depends(get_current_user),
) -> dict:
    user_id: str = user["sub"]
    profile = get_user_profile(user_id)
    groq_key = profile.get("groq_api_key") or os.environ.get("GROQ_API_KEY", "")

    if not groq_key:
        raise HTTPException(status_code=400, detail="No API key configured")

    audio_bytes = await audio.read()
    content_type = audio.content_type or "audio/webm"
    filename = audio.filename or "voice.webm"

    logger.info("transcribe_audio user=%s size=%d type=%s", user_id, len(audio_bytes), content_type)

    async with async_client(timeout=60) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {groq_key}"},
            files={"file": (filename, audio_bytes, content_type)},
            data={"model": "whisper-large-v3-turbo", "language": "en", "response_format": "json"},
        )
        if not r.is_success:
            logger.error("Whisper error: %s %s", r.status_code, r.text)
            raise HTTPException(status_code=500, detail=f"Transcription failed: {r.status_code}")

        data = r.json()
        transcript = (data.get("text") or "").strip()

    logger.info("transcribe_audio transcript_len=%d", len(transcript))
    return {"transcript": transcript}

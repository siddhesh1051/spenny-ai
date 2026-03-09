"""Audio transcription route — forwards to Groq Whisper."""

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from middleware.auth import get_current_user
from services.supabase import get_service_client
from services.config import get_settings

router = APIRouter(prefix="/audio", tags=["audio"])
_settings = get_settings()

WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions"


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    db = get_service_client(user["token"])
    profile_result = await db.table("profiles").select("groq_api_key").eq("id", user["id"]).single().execute()
    profile = profile_result.data or {}
    groq_key = profile.get("groq_api_key") or _settings.groq_api_key

    if not groq_key:
        raise HTTPException(status_code=400, detail="No API key configured")

    content = await audio.read()
    filename = audio.filename or "voice.webm"

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            WHISPER_URL,
            headers={"Authorization": f"Bearer {groq_key}"},
            files={"file": (filename, content, audio.content_type or "audio/webm")},
            data={"model": "whisper-large-v3-turbo", "language": "en", "response_format": "json"},
        )

    if not resp.is_success:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {resp.status_code}")

    transcript = resp.json().get("text", "").strip()
    return {"transcript": transcript}

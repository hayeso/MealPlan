"""
Transcribe audio from social recipe videos using OpenAI Whisper.
"""
from __future__ import annotations

import logging
from pathlib import Path

from openai import AsyncOpenAI

from ..config import settings

log = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set in backend/.env")
        kwargs: dict = {"api_key": settings.openai_api_key}
        if settings.openai_base_url:
            kwargs["base_url"] = settings.openai_base_url
        _client = AsyncOpenAI(**kwargs)
    return _client


async def transcribe_audio_file(audio_path: Path) -> str:
    """Transcribe an audio file and return the transcript text."""
    client = _get_client()
    with audio_path.open("rb") as audio_file:
        response = await client.audio.transcriptions.create(
            model=settings.whisper_model,
            file=audio_file,
            response_format="text",
        )

    text = response if isinstance(response, str) else getattr(response, "text", "") or ""
    log.info("Whisper transcribed %d chars from %s", len(text), audio_path.name)
    return text.strip()

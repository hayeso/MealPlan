"""
Vision-based recipe text extraction using LLM image understanding.
Replaces traditional OCR (pytesseract) with the model's native vision,
which handles cookbook layouts, columns, and handwriting far better.
"""
from __future__ import annotations

import asyncio
import base64
import logging

from openai import AsyncOpenAI

from ..config import settings

log = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None

EXTRACTION_PROMPT = """\
Extract ALL text from this recipe photo. Preserve the structure:
- Recipe title
- Serving size
- Prep/cook times (if shown)
- Full ingredient list with quantities and units
- Full method/directions, numbered if the original is numbered

Output ONLY the extracted recipe text. Do not summarise or reformat — \
transcribe everything you can read from the image.\
"""

FRAME_EXTRACTION_PROMPT = """\
This is a frame from a cooking video. Extract ALL on-screen recipe text visible \
(ingredient lists, method steps, quantities, titles). Ignore UI chrome, usernames, \
and like counts. Output ONLY the recipe-related text you can read. If there is no \
recipe text on screen, output nothing.\
"""


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


def _detect_mime(image_bytes: bytes) -> str:
    if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if image_bytes[:2] == b"\xff\xd8":
        return "image/jpeg"
    if image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"


async def extract_text_from_image(image_bytes: bytes, *, prompt: str | None = None) -> str:
    """
    Send the image to the LLM vision model and extract recipe text.
    Uses the fast model since this is a straightforward transcription task.
    """
    client = _get_client()
    b64 = base64.b64encode(image_bytes).decode("ascii")
    mime = _detect_mime(image_bytes)

    response = await client.chat.completions.create(
        model=settings.llm_fast_model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt or EXTRACTION_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"},
                    },
                ],
            }
        ],
        max_tokens=2000,
        temperature=0.1,
    )

    text = response.choices[0].message.content or ""
    log.info("Vision extracted %d chars from image", len(text))
    return text.strip()


def _sample_video_frame_bytes(video_path, interval_secs: float, max_frames: int) -> list[bytes]:
    """Extract JPEG frame bytes from a video at regular intervals."""
    import cv2

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_interval = max(int(fps * interval_secs), 1)
    frames: list[bytes] = []
    frame_idx = 0

    try:
        while len(frames) < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % frame_interval == 0:
                ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                if ok:
                    frames.append(buf.tobytes())
            frame_idx += 1
    finally:
        cap.release()

    return frames


async def extract_on_screen_recipe_text_from_frames(
    video_path,
    *,
    interval_secs: float = 4.0,
    max_frames: int = 12,
) -> str:
    """Sample video frames and extract on-screen recipe overlays via vision LLM."""
    from pathlib import Path

    path = Path(video_path)
    frame_bytes_list = await asyncio.to_thread(
        _sample_video_frame_bytes, path, interval_secs, max_frames
    )
    if not frame_bytes_list:
        return ""

    seen: set[str] = set()
    chunks: list[str] = []
    for frame_bytes in frame_bytes_list:
        text = await extract_text_from_image(frame_bytes, prompt=FRAME_EXTRACTION_PROMPT)
        normalized = text.strip().lower()
        if normalized and normalized not in seen and len(normalized) > 10:
            seen.add(normalized)
            chunks.append(text.strip())

    return "\n\n".join(chunks)

"""
Vision-based recipe text extraction using LLM image understanding.
Replaces traditional OCR (pytesseract) with the model's native vision,
which handles cookbook layouts, columns, and handwriting far better.
"""
from __future__ import annotations

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


async def extract_text_from_image(image_bytes: bytes) -> str:
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
                    {"type": "text", "text": EXTRACTION_PROMPT},
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

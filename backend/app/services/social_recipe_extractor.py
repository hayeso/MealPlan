"""
Extract recipe text from TikTok and Instagram post URLs.

Tier 1: caption/metadata via yt-dlp (fast).
Tier 2: video download → audio transcription + on-screen frame OCR (when caption is sparse).
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from ..config import settings

log = logging.getLogger(__name__)

TIKTOK_HOSTS = frozenset(
    {"tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com"}
)
INSTAGRAM_HOSTS = frozenset(
    {"instagram.com", "www.instagram.com", "m.instagram.com"}
)

_RECIPE_KEYWORDS = re.compile(
    r"\b(ingredient|method|direction|step|tbsp|tsp|cup|grams?|ml|oz)\b",
    re.I,
)
_QUANTITY_PATTERN = re.compile(
    r"\d+\s*(?:/\d+)?\s*(?:g|kg|ml|l|oz|lb|cup|cups|tbsp|tsp|clove|cloves|pinch)?",
    re.I,
)
_COOK_VERBS = re.compile(
    r"\b(chop|dice|slice|mix|stir|bake|fry|simmer|boil|roast|grill|add|heat)\b",
    re.I,
)


def resolve_ffmpeg() -> str | None:
    """Return ffmpeg executable path from config, PATH, or common WinGet install."""
    if settings.ffmpeg_path:
        configured = Path(settings.ffmpeg_path)
        if configured.is_file():
            return str(configured)

    on_path = shutil.which("ffmpeg")
    if on_path:
        return on_path

    local_app = os.environ.get("LOCALAPPDATA", "")
    if local_app:
        winget_root = Path(local_app) / "Microsoft" / "WinGet" / "Packages"
        if winget_root.is_dir():
            for candidate in winget_root.glob("Gyan.FFmpeg*/**/bin/ffmpeg.exe"):
                if candidate.is_file():
                    return str(candidate)

    return None


class SocialImportError(Exception):
    """Raised when social post extraction fails with a user-facing message."""

    def __init__(self, message: str, *, user_message: str | None = None):
        super().__init__(message)
        self.user_message = user_message or message


@dataclass
class SocialPostMeta:
    platform: str
    canonical_url: str
    title: str
    caption: str
    uploader: str
    duration_secs: float | None


def is_social_url(url: str) -> str | None:
    """Return 'tiktok', 'instagram', or None."""
    try:
        host = urlparse(url.strip()).netloc.lower().removeprefix("www.")
        if not host:
            return None
        if host in TIKTOK_HOSTS or host.endswith(".tiktok.com"):
            return "tiktok"
        if host in INSTAGRAM_HOSTS or host.endswith(".instagram.com"):
            return "instagram"
    except Exception:
        return None
    return None


def normalize_social_url(url: str) -> str:
    """Strip tracking params; yt-dlp resolves short links when fetching."""
    parsed = urlparse(url.strip())
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip("/")


def caption_quality_score(text: str) -> float:
    """
    Score 0–1 indicating whether caption alone likely contains a full recipe.
    """
    if not text or not text.strip():
        return 0.0

    stripped = text.strip()
    score = 0.0

    if len(stripped) >= 80:
        score += 0.25
    if len(stripped) >= 200:
        score += 0.15

    if _QUANTITY_PATTERN.search(stripped):
        score += 0.2
    if _RECIPE_KEYWORDS.search(stripped):
        score += 0.2
    if _COOK_VERBS.search(stripped):
        score += 0.1

    lines = [ln.strip() for ln in stripped.splitlines() if ln.strip()]
    bullet_lines = sum(1 for ln in lines if ln.startswith(("-", "•", "*")) or re.match(r"^\d+[\.\)]", ln))
    if bullet_lines >= 3:
        score += 0.15

    return min(score, 1.0)


def _ydl_base_opts() -> dict:
    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "socket_timeout": settings.social_import_timeout_secs,
    }
    if settings.instagram_cookies_file:
        opts["cookiefile"] = settings.instagram_cookies_file
    return opts


def _run_ydl_extract_info(url: str, *, download: bool = False, out_dir: str | None = None) -> dict:
    import yt_dlp

    opts = _ydl_base_opts()
    if download:
        opts["skip_download"] = False
        opts["format"] = "best[height<=720]/best"
        opts["outtmpl"] = str(Path(out_dir or ".") / "%(id)s.%(ext)s")
    else:
        opts["skip_download"] = True

    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=download)


async def fetch_metadata(url: str, platform: str) -> SocialPostMeta:
    normalized = normalize_social_url(url)

    def _fetch() -> dict:
        return _run_ydl_extract_info(normalized)

    try:
        info = await asyncio.wait_for(
            asyncio.to_thread(_fetch),
            timeout=settings.social_import_timeout_secs,
        )
    except asyncio.TimeoutError:
        raise SocialImportError(
            "Timed out fetching post metadata",
            user_message="Import timed out — try again or use Photo import on a screenshot.",
        )
    except Exception as exc:
        msg = str(exc).lower()
        if "private" in msg or "not available" in msg:
            raise SocialImportError(
                str(exc),
                user_message="This post isn't publicly accessible.",
            )
        if platform == "instagram" and (
            "login" in msg or "cookie" in msg or "rate-limit" in msg
        ):
            raise SocialImportError(
                str(exc),
                user_message=(
                    "Instagram blocked access — try a public reel or upload a "
                    "screenshot via Photo import."
                ),
            )
        raise SocialImportError(
            str(exc),
            user_message=f"Could not fetch post: {exc}",
        )

    if not info:
        raise SocialImportError(
            "No metadata returned",
            user_message="Could not extract content from this URL.",
        )

    canonical = info.get("webpage_url") or info.get("original_url") or normalized
    caption = (info.get("description") or "").strip()
    title = (info.get("title") or "").strip()
    uploader = info.get("uploader") or info.get("channel") or info.get("uploader_id") or ""
    duration = info.get("duration")

    return SocialPostMeta(
        platform=platform,
        canonical_url=canonical,
        title=title,
        caption=caption,
        uploader=uploader,
        duration_secs=float(duration) if duration else None,
    )


def _merge_sections(
    meta: SocialPostMeta,
    *,
    transcript: str = "",
    frame_text: str = "",
) -> str:
    platform_label = "TikTok" if meta.platform == "tiktok" else "Instagram"
    parts = [f"Source: {platform_label}"]
    if meta.uploader:
        parts[0] += f" by @{meta.uploader.lstrip('@')}"
    if meta.title and meta.title != meta.caption:
        parts.append(f"Title: {meta.title}")
    if meta.caption:
        parts.append(f"Caption:\n{meta.caption}")
    if transcript.strip():
        parts.append(f"Audio transcript:\n{transcript.strip()}")
    if frame_text.strip():
        parts.append(f"On-screen text:\n{frame_text.strip()}")
    return "\n\n".join(parts)


async def extract_from_video(url: str, meta: SocialPostMeta) -> tuple[str, str]:
    """
    Download video, transcribe audio, OCR keyframes.
    Returns (transcript, frame_text).
    """
    ffmpeg = resolve_ffmpeg()
    if not ffmpeg:
        raise SocialImportError(
            "ffmpeg not found on PATH",
            user_message="Video extraction requires ffmpeg — install ffmpeg or paste a post with a full caption.",
        )

    max_duration = settings.social_max_video_duration_secs
    if meta.duration_secs and meta.duration_secs > max_duration:
        raise SocialImportError(
            f"Video too long ({meta.duration_secs}s > {max_duration}s)",
            user_message=f"Video is longer than {max_duration // 60} minutes — try a shorter clip or Photo import.",
        )

    from .video_transcription import transcribe_audio_file
    from .ocr_service import extract_on_screen_recipe_text_from_frames

    with tempfile.TemporaryDirectory(prefix="mealplan_social_") as tmp:
        tmp_path = Path(tmp)

        def _download() -> Path:
            info = _run_ydl_extract_info(
                meta.canonical_url, download=True, out_dir=str(tmp_path)
            )
            video_id = info.get("id", "video")
            ext = info.get("ext", "mp4")
            candidate = tmp_path / f"{video_id}.{ext}"
            if candidate.exists():
                return candidate
            # yt-dlp may use a different extension
            files = list(tmp_path.glob("*"))
            if not files:
                raise SocialImportError(
                    "Video download produced no file",
                    user_message="Could not download video — try Photo import on a screenshot.",
                )
            return files[0]

        try:
            video_path = await asyncio.wait_for(
                asyncio.to_thread(_download),
                timeout=settings.social_import_timeout_secs,
            )
        except asyncio.TimeoutError:
            raise SocialImportError(
                "Video download timed out",
                user_message="Video download timed out — try again or use Photo import.",
            )
        except SocialImportError:
            raise
        except Exception as exc:
            raise SocialImportError(
                str(exc),
                user_message="Could not download video — try Photo import on a screenshot.",
            )

        audio_path = tmp_path / "audio.mp3"

        def _extract_audio() -> None:
            import subprocess

            subprocess.run(
                [
                    ffmpeg,
                    "-y",
                    "-i",
                    str(video_path),
                    "-vn",
                    "-acodec",
                    "libmp3lame",
                    "-q:a",
                    "4",
                    str(audio_path),
                ],
                check=True,
                capture_output=True,
            )

        transcript = ""
        try:
            await asyncio.to_thread(_extract_audio)
            if audio_path.exists() and audio_path.stat().st_size > 0:
                transcript = await transcribe_audio_file(audio_path)
        except Exception as exc:
            log.warning("Audio transcription failed: %s", exc)

        frame_text = ""
        try:
            frame_text = await extract_on_screen_recipe_text_from_frames(
                video_path,
                interval_secs=settings.social_frame_interval_secs,
                max_frames=settings.social_max_frames,
            )
        except Exception as exc:
            log.warning("Frame OCR failed: %s", exc)

        return transcript, frame_text


async def extract_social_recipe(url: str) -> tuple[str, str, str]:
    """
    Orchestrate social extraction. Returns (raw_text, source_label, canonical_url).
    source_label is 'TikTok' or 'Instagram'.
    """
    platform = is_social_url(url)
    if not platform:
        raise SocialImportError("Not a social URL")

    meta = await fetch_metadata(url, platform)
    source_label = "TikTok" if platform == "tiktok" else "Instagram"

    caption_score = caption_quality_score(meta.caption)
    transcript = ""
    frame_text = ""

    needs_video = (
        settings.social_video_extraction
        and caption_score < settings.social_caption_quality_threshold
    )

    if needs_video:
        log.info(
            "Caption score %.2f below threshold — running video extraction",
            caption_score,
        )
        transcript, frame_text = await extract_from_video(url, meta)

    raw_text = _merge_sections(meta, transcript=transcript, frame_text=frame_text)

    combined_score = caption_quality_score(
        "\n".join(filter(None, [meta.caption, transcript, frame_text]))
    )
    if combined_score < 0.15 and len(raw_text.strip()) < 40:
        raise SocialImportError(
            "No recipe signal found",
            user_message=(
                "Couldn't find a recipe in this video — try Photo import on a screenshot."
            ),
        )

    return raw_text, source_label, meta.canonical_url

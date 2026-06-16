"""Unit tests for TikTok / Instagram social recipe extraction."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services.social_recipe_extractor import (
    SocialImportError,
    SocialPostMeta,
    caption_quality_score,
    extract_social_recipe,
    is_social_url,
    normalize_social_url,
    _merge_sections,
)


@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://www.tiktok.com/@chef/video/1234567890", "tiktok"),
        ("https://vm.tiktok.com/ZMabcdef/", "tiktok"),
        ("https://www.instagram.com/reel/ABC123/", "instagram"),
        ("https://instagram.com/p/XYZ789/", "instagram"),
        ("https://www.bbcgoodfood.com/recipes/pasta", None),
        ("not-a-url", None),
    ],
)
def test_is_social_url(url: str, expected: str | None):
    assert is_social_url(url) == expected


def test_normalize_social_url_strips_query():
    url = "https://www.tiktok.com/@chef/video/123?utm_source=share"
    assert normalize_social_url(url) == "https://www.tiktok.com/@chef/video/123"


@pytest.mark.parametrize(
    "text,min_score",
    [
        ("", 0.0),
        ("Just a fun cooking clip!", 0.0),
        (
            "Ingredients:\n- 2 cups flour\n- 1 tbsp olive oil\n- 3 cloves garlic\n"
            "Method:\n1. Mix flour and oil\n2. Chop garlic and stir\n3. Bake 20 min",
            0.45,
        ),
    ],
)
def test_caption_quality_score(text: str, min_score: float):
    assert caption_quality_score(text) >= min_score


def test_merge_sections_includes_all_sources():
    meta = SocialPostMeta(
        platform="tiktok",
        canonical_url="https://www.tiktok.com/@chef/video/1",
        title="Easy Pasta",
        caption="Full caption here",
        uploader="chef",
        duration_secs=60.0,
    )
    merged = _merge_sections(
        meta,
        transcript="add the pasta and simmer",
        frame_text="2 cups penne",
    )
    assert "TikTok" in merged
    assert "@chef" in merged
    assert "Caption:" in merged
    assert "Audio transcript:" in merged
    assert "On-screen text:" in merged


@pytest.mark.asyncio
async def test_extract_social_recipe_uses_caption_when_sufficient():
    meta = SocialPostMeta(
        platform="tiktok",
        canonical_url="https://www.tiktok.com/@chef/video/1",
        title="Pasta",
        caption=(
            "Ingredients:\n- 200g pasta\n- 2 tbsp olive oil\n- 3 garlic cloves\n"
            "Method:\n1. Boil pasta\n2. Sauté garlic in oil\n3. Combine and serve"
        ),
        uploader="chef",
        duration_secs=45.0,
    )

    with patch(
        "app.services.social_recipe_extractor.fetch_metadata",
        new_callable=AsyncMock,
        return_value=meta,
    ):
        with patch(
            "app.services.social_recipe_extractor.extract_from_video",
            new_callable=AsyncMock,
        ) as mock_video:
            raw, source, url = await extract_social_recipe(
                "https://www.tiktok.com/@chef/video/1"
            )

    mock_video.assert_not_called()
    assert source == "TikTok"
    assert url == meta.canonical_url
    assert "Caption:" in raw


@pytest.mark.asyncio
async def test_extract_social_recipe_runs_video_when_caption_sparse():
    meta = SocialPostMeta(
        platform="instagram",
        canonical_url="https://www.instagram.com/reel/ABC/",
        title="Yummy food",
        caption="So good!",
        uploader="foodie",
        duration_secs=30.0,
    )

    with patch(
        "app.services.social_recipe_extractor.fetch_metadata",
        new_callable=AsyncMock,
        return_value=meta,
    ):
        with patch(
            "app.services.social_recipe_extractor.extract_from_video",
            new_callable=AsyncMock,
            return_value=("chop onions and fry", "1 onion diced"),
        ) as mock_video:
            raw, source, _ = await extract_social_recipe(
                "https://www.instagram.com/reel/ABC/"
            )

    mock_video.assert_called_once()
    assert source == "Instagram"
    assert "Audio transcript:" in raw
    assert "On-screen text:" in raw


@pytest.mark.asyncio
async def test_extract_social_recipe_raises_when_no_signal():
    meta = SocialPostMeta(
        platform="tiktok",
        canonical_url="https://www.tiktok.com/@chef/video/1",
        title="",
        caption="",
        uploader="",
        duration_secs=None,
    )

    with patch(
        "app.services.social_recipe_extractor.fetch_metadata",
        new_callable=AsyncMock,
        return_value=meta,
    ):
        with patch(
            "app.services.social_recipe_extractor.extract_from_video",
            new_callable=AsyncMock,
            return_value=("", ""),
        ):
            with pytest.raises(SocialImportError) as exc_info:
                await extract_social_recipe("https://www.tiktok.com/@chef/video/1")

    assert "screenshot" in exc_info.value.user_message.lower()

"""
AI parser: structured recipe extraction with cheap-model-first strategy
and automatic escalation to a heavier model when quality checks fail.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import Coroutine
from typing import Any

from openai import AsyncOpenAI
from pydantic import ValidationError

from ..config import settings
from ..schemas.recipe import RecipeDraft

log = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.openai_api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not set. Add it to backend/.env "
                "(supports OpenAI or OpenRouter keys with OPENAI_BASE_URL)."
            )
        kwargs: dict[str, Any] = {"api_key": settings.openai_api_key}
        if settings.openai_base_url:
            kwargs["base_url"] = settings.openai_base_url
        _client = AsyncOpenAI(**kwargs)
    return _client


SYSTEM_PROMPT = """\
You are a recipe parsing assistant. Given raw recipe text you must return a single JSON object that precisely matches the schema below. Do NOT include any text outside the JSON object.

Schema:
{
  "name": "string",
  "servings": integer,
  "cuisine": "string or null",
  "prep_time_mins": integer or null,
  "cook_time_mins": integer or null,
  "calories": float or null,
  "protein_g": float or null,
  "carbs_g": float or null,
  "fat_g": float or null,
  "make_ahead_type": "none" | "partial" | "full",
  "storage_days": integer or null,
  "reheat_instructions": "string or null",
  "steps": [
    {
      "step_number": integer (starting at 1),
      "instruction": "string — full step text",
      "cooking_method": "raw_prep" | "sauté" | "boil" | "simmer" | "bake" | "roast" | "grill" | "fry" | "steam" | "combine" | "marinate" | "blend" | null,
      "step_type": "raw_prep" | "cook_ahead" | "cook_fresh" | "reheat" | "combine",
      "can_cook_ahead": boolean,
      "ingredients": [
        {
          "ingredient_name": "string — normalised lowercase name, e.g. 'bell pepper' not 'red bell pepper'",
          "ingredient_category": "Produce" | "Protein" | "Dairy" | "Pantry" | "Spices",
          "quantity": float or null,
          "unit": "string or null — g, ml, cup, tbsp, tsp, whole, clove, etc.",
          "prep_note": "diced" | "sliced" | "julienned" | "chopped" | "whole" | "grated" | "minced" | "crushed" | null
        }
      ]
    }
  ]
}

Rules:
1. Every ingredient in the recipe MUST appear in exactly one step's ingredients array — the step where it is first used.
2. Normalise ingredient names: "red bell pepper" → "bell pepper", "chicken breast" → "chicken breast", "garlic cloves" → "garlic".
3. Normalise prep notes to the canonical set: diced, sliced, julienned, chopped, whole, grated, minced, crushed. Map synonyms: "finely diced"→"diced", "thinly sliced"→"sliced", "roughly chopped"→"chopped", "shredded"→"grated".
4. Assign ingredient_category: vegetables/fruits→Produce, meat/fish/tofu→Protein, milk/cheese/cream/butter/eggs→Dairy, oil/flour/rice/pasta/canned/sauce/stock→Pantry, spices/herbs/seasoning→Spices.
5. step_type rules: chopping/dicing/slicing with no heat→"raw_prep"; long simmer/slow cook/bake/braise→"cook_ahead"; quick sauté/stir-fry/fresh cook→"cook_fresh"; reheat/warm through→"reheat"; toss/mix/combine/plate→"combine".
6. can_cook_ahead: true for steps that survive reheating (simmering sauces, braised dishes), false for quick-cook steps or texturally sensitive operations (crispy elements, fresh salads).
7. make_ahead_type: "full" for curries/stews/casseroles/bolognese/chili/soup; "partial" if a sauce or component can be made ahead but protein/carb is cooked fresh; "none" for stir-fries/fajitas/salads/assembled dishes.
8. storage_days: estimate fridge shelf life (curry≈4, stew≈4, soup≈3-4, bolognese≈4, salad≈0). Null for "none" make-ahead.
9. reheat_instructions: brief instructions like "Microwave 3 mins, stir halfway" or "Reheat in pan over medium heat 5 mins". Null for "none" make-ahead.
"""

# ──────────────────────────────────────────────
# Low-level: call a specific model
# ──────────────────────────────────────────────

async def _call_model(raw_text: str, model: str, source: str) -> RecipeDraft:
    """Single LLM call → RecipeDraft (may raise on bad JSON or validation)."""
    client = _get_client()
    response = await client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": raw_text},
        ],
        temperature=0.2,
    )
    content = response.choices[0].message.content or "{}"
    data = json.loads(content)
    data["source"] = source
    return RecipeDraft(**data)


# ──────────────────────────────────────────────
# Quality assessment
# ──────────────────────────────────────────────

_MAKE_AHEAD_KEYWORDS = re.compile(
    r"\b(stew|curry|casserole|bolognese|chili|chilli|soup|braise|ragout|ragu|dal|dhal)\b",
    re.IGNORECASE,
)


def _count_raw_ingredient_lines(raw_text: str) -> int:
    """Rough count of ingredient-like lines in the raw text."""
    in_section = False
    count = 0
    for line in raw_text.splitlines():
        stripped = line.strip().lower()
        if stripped.startswith("ingredient"):
            in_section = True
            continue
        if in_section:
            if stripped.startswith(("method", "direction", "instruction", "step")):
                break
            # Skip section headers like "FOR THE SAUCE"
            if stripped and not stripped.startswith("for "):
                count += 1
    return count


def assess_quality(raw_text: str, draft: RecipeDraft) -> list[str]:
    """
    Return a list of quality issues. Empty list = good quality.
    Each entry is a short description of the problem detected.
    """
    issues: list[str] = []

    # --- Structural ---
    if not draft.name or draft.name.strip() == "":
        issues.append("empty_name")
    if draft.servings <= 0:
        issues.append("bad_servings")
    if len(draft.steps) < 1:
        issues.append("no_steps")

    # --- Ingredient coverage ---
    total_ingredients = sum(len(s.ingredients) for s in draft.steps)
    raw_count = _count_raw_ingredient_lines(raw_text)
    if raw_count >= 4 and total_ingredients < raw_count * 0.5:
        issues.append(f"low_coverage({total_ingredients}/{raw_count})")

    if total_ingredients == 0 and raw_count > 0:
        issues.append("zero_ingredients_mapped")

    # --- Make-ahead sanity ---
    if _MAKE_AHEAD_KEYWORDS.search(raw_text) and draft.make_ahead_type == "none":
        all_fresh = all(s.step_type == "cook_fresh" for s in draft.steps)
        if all_fresh:
            issues.append("make_ahead_mismatch")

    # --- cook_ahead sanity ---
    long_cook_re = re.compile(
        r"\b(simmer|braise|slow.cook|bake|roast)\b", re.IGNORECASE
    )
    has_long_cook = bool(long_cook_re.search(raw_text))
    any_cook_ahead = any(s.can_cook_ahead for s in draft.steps)
    if has_long_cook and not any_cook_ahead and len(draft.steps) >= 3:
        issues.append("missing_cook_ahead")

    return issues


# ──────────────────────────────────────────────
# Smart parser: try fast, escalate if needed
# ──────────────────────────────────────────────

async def parse_recipe_text(raw_text: str, source: str = "Manual") -> RecipeDraft:
    """
    Parse recipe text using fast model first. If the output fails quality
    checks, automatically re-parse with the heavy model.
    """
    fast = settings.llm_fast_model
    heavy = settings.llm_heavy_model

    # If both models are the same, skip the escalation logic
    if fast == heavy:
        return await _call_model(raw_text, fast, source)

    # --- Try fast model ---
    try:
        draft = await _call_model(raw_text, fast, source)
    except (json.JSONDecodeError, ValidationError, KeyError) as exc:
        log.info("Fast model (%s) returned invalid output, escalating: %s", fast, exc)
        return await _call_model(raw_text, heavy, source)

    # --- Assess quality ---
    issues = assess_quality(raw_text, draft)
    if not issues:
        log.debug("Fast model (%s) passed quality checks for '%s'", fast, draft.name)
        return draft

    log.info(
        "Fast model quality issues for '%s': %s — escalating to %s",
        draft.name,
        issues,
        heavy,
    )
    try:
        heavy_draft = await _call_model(raw_text, heavy, source)
        heavy_issues = assess_quality(raw_text, heavy_draft)
        if len(heavy_issues) < len(issues):
            return heavy_draft
        # Heavy model didn't improve things; return whichever has fewer issues
        return heavy_draft if len(heavy_issues) <= len(issues) else draft
    except Exception:
        # Heavy model errored; return the fast draft (imperfect > nothing)
        return draft


# ──────────────────────────────────────────────
# Parallel batch parsing
# ──────────────────────────────────────────────

async def parse_recipes_parallel(
    texts: list[str],
    source: str = "Manual",
    concurrency: int | None = None,
) -> list[RecipeDraft | None]:
    """
    Parse multiple recipe texts concurrently with bounded parallelism.
    Returns a list aligned with `texts` — None for any recipe that failed.
    """
    sem = asyncio.Semaphore(concurrency or settings.llm_concurrency)

    async def _parse_one(raw_text: str) -> RecipeDraft | None:
        async with sem:
            try:
                return await parse_recipe_text(raw_text, source)
            except Exception as exc:
                log.warning("Failed to parse recipe: %s", exc)
                return None

    results = await asyncio.gather(*[_parse_one(t) for t in texts])
    return list(results)

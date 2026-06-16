"""Normalise prep notes for batch-prep grouping."""
from __future__ import annotations

CANONICAL_PREP_NOTES = frozenset({
    "diced", "sliced", "julienned", "chopped", "whole", "grated", "minced", "crushed",
})


def normalize_prep_note(note: str | None) -> str | None:
    if not note:
        return None
    lower = note.lower().strip()
    if lower in CANONICAL_PREP_NOTES:
        return lower
    if "julien" in lower:
        return "julienned"
    if "dice" in lower:
        return "diced"
    if "slice" in lower or "thinly" in lower:
        return "sliced"
    if "chop" in lower or "tear" in lower or "cut into" in lower:
        return "chopped"
    if "grate" in lower or "zest" in lower:
        return "grated"
    if "mince" in lower or "crush" in lower or "press" in lower:
        return "minced"
    if "drain" in lower or "rinse" in lower or "beaten" in lower or "blanch" in lower:
        return lower
    if any(k in lower for k in ("peel", "trim", "halve", "wedge")):
        return lower
    return lower


def is_batch_prep_ingredient(step_type: str, prep_note: str | None) -> bool:
    """True when this ingredient should appear in Section 1 batch prep."""
    if step_type == "raw_prep":
        return True
    if not prep_note:
        return False
    normalized = normalize_prep_note(prep_note)
    if normalized in CANONICAL_PREP_NOTES:
        return True
    # Extended knife-work / prep phrases from imported recipes
    lower = prep_note.lower()
    return any(
        k in lower
        for k in (
            "dice", "slice", "chop", "mince", "grate", "julien", "crush",
            "tear", "cut into", "blanch", "drain", "rinse", "beaten", "peel",
        )
    )


def include_cook_ahead_step(
    make_ahead_type: str,
    step_type: str,
    instruction: str,
    can_cook_ahead: bool,
    is_last_step: bool,
) -> bool:
    if make_ahead_type == "partial":
        return can_cook_ahead
    if make_ahead_type != "full":
        return False
    if step_type == "reheat":
        return False
    if is_last_step and step_type == "combine":
        lower = instruction.lower()
        if any(w in lower for w in ("serve", "plate", "divide between", "enjoy", "garnish")):
            return False
    return True

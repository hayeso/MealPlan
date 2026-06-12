"""Resolve container reminders for a recipe on a given day from a prep guide."""
from __future__ import annotations

from .prep_optimizer import DAY_NAMES, PrepGuide


def containers_for_today(
    guide: PrepGuide,
    recipe_name: str,
    day_of_week: int,
    make_ahead_type: str,
) -> list[dict[str, str]]:
    day_name = DAY_NAMES[day_of_week] if day_of_week < 7 else f"Day {day_of_week}"
    seen: set[str] = set()
    containers: list[dict[str, str]] = []

    for task in guide.raw_prep:
        for portion in task.portions:
            if portion.recipe_name != recipe_name or portion.day != day_name:
                continue
            if portion.container in seen:
                continue
            seen.add(portion.container)
            contents = task.ingredient
            if task.prep_note:
                contents = f"{task.prep_note} {task.ingredient}"
            containers.append({"container": portion.container, "contents": contents})

    if make_ahead_type in ("full", "partial"):
        for cook in guide.cook_ahead:
            if cook.recipe_name == recipe_name and cook.day == day_name:
                if cook.container not in seen:
                    seen.add(cook.container)
                    containers.append(
                        {"container": cook.container, "contents": cook.recipe_name}
                    )
                break

    return containers

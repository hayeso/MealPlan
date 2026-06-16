"""
Prep Day Optimizer: generates a two-section prep guide from a meal plan.

Section 1 — Raw Prep: groups (ingredient, prep_note) tasks across recipes,
assigns container labels, provides portioning instructions.

Section 2 — Cook Ahead: lists full cooking steps for make-ahead recipes,
assigns container labels for finished dishes, includes storage and reheat info.
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.meal_plan import MealPlan, MealPlanSlot
from ..models.recipe import Recipe, RecipeStep, StepIngredient
from .prep_notes import include_cook_ahead_step, is_batch_prep_ingredient, normalize_prep_note
from .quantity_formatter import format_quantity, format_quantity_totals

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


@dataclass
class ContainerPortion:
    container: str
    amount: str
    recipe_name: str
    day: str


@dataclass
class RawPrepTask:
    ingredient: str
    prep_note: str | None
    total_quantity: str
    portions: list[ContainerPortion] = field(default_factory=list)


@dataclass
class CookAheadRecipe:
    recipe_name: str
    container: str
    day: str
    servings: int
    storage_days: int | None
    reheat_instructions: str | None
    steps: list[dict] = field(default_factory=list)


@dataclass
class PrepGuide:
    raw_prep: list[RawPrepTask]
    cook_ahead: list[CookAheadRecipe]
    container_summaries: list[dict] = field(default_factory=list)
    container_strategy: str = "heuristic"
    container_warnings: list[dict] = field(default_factory=list)


async def generate_prep_guide(plan_id: uuid.UUID, db: AsyncSession) -> PrepGuide:
    result = await db.execute(
        select(MealPlan)
        .options(
            selectinload(MealPlan.slots)
            .selectinload(MealPlanSlot.recipe)
            .selectinload(Recipe.steps)
            .selectinload(RecipeStep.step_ingredients)
            .selectinload(StepIngredient.ingredient)
        )
        .where(MealPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        return PrepGuide(raw_prep=[], cook_ahead=[])

    from ..config import settings as app_settings
    from .container_grouper import assign_batch_containers, container_label

    container_counter = 0

    def next_container() -> str:
        nonlocal container_counter
        label = container_label(container_counter)
        container_counter += 1
        return label

    # ---- SECTION 1: RAW PREP ----
    # Group by (ingredient_name, prep_note) across all raw_prep steps
    prep_groups: dict[tuple[str, str | None], list[dict]] = defaultdict(list)

    for slot in plan.slots:
        recipe = slot.recipe
        if not recipe:
            continue
        day = DAY_NAMES[slot.day_of_week] if slot.day_of_week < 7 else f"Day {slot.day_of_week}"
        scale = (slot.servings_override / recipe.servings) if slot.servings_override else 1.0

        for step in recipe.steps:
            for si in step.step_ingredients:
                if not is_batch_prep_ingredient(step.step_type, si.prep_note):
                    continue
                prep_key = normalize_prep_note(si.prep_note)
                key = (si.ingredient.name, prep_key)
                prep_groups[key].append({
                    "recipe_name": recipe.name,
                    "day": day,
                    "quantity": si.quantity * scale if si.quantity else None,
                    "unit": si.unit,
                })

    def _merge_usages(usages: list[dict]) -> list[dict]:
        """Merge duplicate recipe/day rows (same ingredient split across steps)."""
        merged: dict[tuple[str, str], dict] = {}
        for u in usages:
            key = (u["recipe_name"], u["day"])
            if key not in merged:
                merged[key] = dict(u)
                continue
            existing = merged[key]
            if u["quantity"] is not None:
                if existing["quantity"] is None:
                    existing["quantity"] = u["quantity"]
                elif existing["unit"] == u["unit"]:
                    existing["quantity"] += u["quantity"]
        return list(merged.values())

    raw_prep_tasks: list[RawPrepTask] = []
    for (ingredient, prep_note), usages in sorted(prep_groups.items()):
        merged = _merge_usages(usages)
        total_str = format_quantity_totals(
            [(u["quantity"], u["unit"]) for u in merged]
        )

        portions: list[ContainerPortion] = []
        for u in merged:
            qty_str = format_quantity(u["quantity"], u["unit"])
            portions.append(ContainerPortion(
                container="",  # assigned after AI/heuristic grouping
                amount=qty_str,
                recipe_name=u["recipe_name"],
                day=u["day"],
            ))

        raw_prep_tasks.append(RawPrepTask(
            ingredient=ingredient,
            prep_note=prep_note,
            total_quantity=total_str,
            portions=portions,
        ))

    container_summaries, container_strategy, container_counter, container_warnings = (
        await assign_batch_containers(
            plan,
            raw_prep_tasks,
            use_ai=app_settings.container_grouping_ai,
        )
    )

    # ---- SECTION 2: COOK AHEAD ----
    cook_ahead_recipes: list[CookAheadRecipe] = []

    for slot in sorted(plan.slots, key=lambda s: s.day_of_week):
        recipe = slot.recipe
        if not recipe:
            continue
        if recipe.make_ahead_type not in ("full", "partial"):
            continue
        day = DAY_NAMES[slot.day_of_week] if slot.day_of_week < 7 else f"Day {slot.day_of_week}"
        servings = slot.servings_override or recipe.servings
        scale = servings / recipe.servings

        cook_steps = []
        max_step = max((s.step_number for s in recipe.steps), default=0)
        for step in recipe.steps:
            is_last = step.step_number == max_step
            if not include_cook_ahead_step(
                recipe.make_ahead_type,
                step.step_type,
                step.instruction,
                step.can_cook_ahead,
                is_last,
            ):
                continue
            ings = []
            for si in step.step_ingredients:
                q = si.quantity * scale if si.quantity else None
                ings.append({
                    "name": si.ingredient.name,
                    "quantity": format_quantity(q, si.unit),
                    "prep_note": si.prep_note,
                })
            cook_steps.append({
                "step_number": step.step_number,
                "instruction": step.instruction,
                "ingredients": ings,
            })

        if cook_steps:
            container = next_container()
            cook_ahead_recipes.append(CookAheadRecipe(
                recipe_name=recipe.name,
                container=container,
                day=day,
                servings=servings,
                storage_days=recipe.storage_days,
                reheat_instructions=recipe.reheat_instructions,
                steps=cook_steps,
            ))

    return PrepGuide(
        raw_prep=raw_prep_tasks,
        cook_ahead=cook_ahead_recipes,
        container_summaries=[
            {
                "container": s.container,
                "description": s.description,
                "recipe_name": s.recipe_name,
                "day": s.day,
                "ingredients": s.ingredients,
                "prep_phase": s.prep_phase,
                "storage_rationale": s.storage_rationale,
            }
            for s in container_summaries
        ],
        container_strategy=container_strategy,
        container_warnings=container_warnings,
    )

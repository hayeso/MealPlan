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

    container_counter = 0

    def next_container() -> str:
        nonlocal container_counter
        label = chr(65 + container_counter)
        container_counter += 1
        return f"Container {label}"

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
            if step.step_type != "raw_prep":
                continue
            for si in step.step_ingredients:
                key = (si.ingredient.name, si.prep_note)
                prep_groups[key].append({
                    "recipe_name": recipe.name,
                    "day": day,
                    "quantity": si.quantity * scale if si.quantity else None,
                    "unit": si.unit,
                })

    raw_prep_tasks: list[RawPrepTask] = []
    for (ingredient, prep_note), usages in sorted(prep_groups.items()):
        total_str = format_quantity_totals(
            [(u["quantity"], u["unit"]) for u in usages]
        )

        portions: list[ContainerPortion] = []
        for u in usages:
            container = next_container()
            qty_str = format_quantity(u["quantity"], u["unit"])
            portions.append(ContainerPortion(
                container=container,
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
        for step in recipe.steps:
            if recipe.make_ahead_type == "full" and step.step_type in ("cook_ahead", "raw_prep"):
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
            elif recipe.make_ahead_type == "partial" and step.can_cook_ahead:
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

    return PrepGuide(raw_prep=raw_prep_tasks, cook_ahead=cook_ahead_recipes)

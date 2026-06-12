"""
Grocery list generator: aggregates ingredients across all recipes in a meal plan,
groups by category, handles servings scaling.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.meal_plan import MealPlan, MealPlanSlot
from ..models.recipe import Recipe, RecipeStep, StepIngredient
from .quantity_formatter import format_quantity_totals


class GroceryItem:
    def __init__(self, name: str, category: str):
        self.name = name
        self.category = category
        self.quantities: list[tuple[float | None, str | None]] = []
        self.used_in: list[str] = []

    def add(self, qty: float | None, unit: str | None, recipe_name: str):
        self.quantities.append((qty, unit))
        if recipe_name not in self.used_in:
            self.used_in.append(recipe_name)

    def total_display(self) -> str:
        return format_quantity_totals(self.quantities)


CATEGORY_ORDER = ["Produce", "Protein", "Dairy", "Pantry", "Spices"]


async def generate_grocery_list(
    plan_id: uuid.UUID, db: AsyncSession
) -> dict[str, list[dict]]:
    """
    Return a grocery list grouped by category.
    Each item: {name, total, unit, used_in, category}
    """
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
        return {}

    items: dict[str, GroceryItem] = {}

    for slot in plan.slots:
        recipe = slot.recipe
        if not recipe:
            continue
        scale = (
            (slot.servings_override / recipe.servings)
            if slot.servings_override
            else 1.0
        )
        for step in recipe.steps:
            for si in step.step_ingredients:
                key = si.ingredient.name
                if key not in items:
                    items[key] = GroceryItem(key, si.ingredient.category)
                scaled_qty = si.quantity * scale if si.quantity is not None else None
                items[key].add(scaled_qty, si.unit, recipe.name)

    grouped: dict[str, list[dict]] = {cat: [] for cat in CATEGORY_ORDER}
    for item in sorted(items.values(), key=lambda i: i.name):
        cat = item.category if item.category in CATEGORY_ORDER else "Pantry"
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(
            {
                "name": item.name,
                "total": item.total_display(),
                "used_in": item.used_in,
                "category": cat,
            }
        )

    return {k: v for k, v in grouped.items() if v}


def grocery_list_to_text(grouped: dict[str, list[dict]]) -> str:
    lines: list[str] = []
    for cat in CATEGORY_ORDER:
        items = grouped.get(cat, [])
        if not items:
            continue
        lines.append(f"\n{cat.upper()}")
        lines.append("-" * len(cat))
        for item in items:
            lines.append(f"  {item['name']}: {item['total']}")
    return "\n".join(lines)

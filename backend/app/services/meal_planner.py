"""
Vegetable waste minimization algorithm.
Greedy set-cover approach to maximize vegetable overlap across the weekly plan.
"""
from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.recipe import Ingredient, Recipe, RecipeStep, StepIngredient
from ..schemas.meal_plan import AISuggestResponse, OverlapItem


async def _get_recipe_produce(recipe_id: uuid.UUID, db: AsyncSession) -> set[str]:
    """Return set of Produce-category ingredient names for a recipe."""
    result = await db.execute(
        select(Recipe)
        .options(
            selectinload(Recipe.steps)
            .selectinload(RecipeStep.step_ingredients)
            .selectinload(StepIngredient.ingredient)
        )
        .where(Recipe.id == recipe_id)
    )
    recipe = result.scalar_one_or_none()
    if not recipe:
        return set()
    produce: set[str] = set()
    for step in recipe.steps:
        for si in step.step_ingredients:
            if si.ingredient.category == "Produce":
                produce.add(si.ingredient.name)
    return produce


async def suggest_meals(
    anchor_id: uuid.UUID, num_suggestions: int, db: AsyncSession
) -> AISuggestResponse:
    """
    Given an anchor recipe, find N recipes that maximize vegetable overlap
    using a greedy set-cover approach.
    """
    anchor_produce = await _get_recipe_produce(anchor_id, db)

    all_recipes = await db.execute(
        select(Recipe)
        .options(
            selectinload(Recipe.steps)
            .selectinload(RecipeStep.step_ingredients)
            .selectinload(StepIngredient.ingredient)
        )
        .where(Recipe.id != anchor_id)
    )
    candidates: list[tuple[Recipe, set[str]]] = []
    for recipe in all_recipes.scalars().all():
        produce = set()
        for step in recipe.steps:
            for si in step.step_ingredients:
                if si.ingredient.category == "Produce":
                    produce.add(si.ingredient.name)
        candidates.append((recipe, produce))

    selected: list[Recipe] = []
    selected_produce: set[str] = set(anchor_produce)
    used_ids: set[uuid.UUID] = set()

    for _ in range(num_suggestions):
        best_recipe = None
        best_score = -1
        best_produce: set[str] = set()

        for recipe, produce in candidates:
            if recipe.id in used_ids:
                continue
            shared = produce & selected_produce
            new_shared = produce & anchor_produce
            score = len(shared) * 2 + len(new_shared)
            if score > best_score or (
                score == best_score
                and best_recipe
                and (recipe.cook_time_mins or 999) < (best_recipe.cook_time_mins or 999)
            ):
                best_score = score
                best_recipe = recipe
                best_produce = produce

        if best_recipe is None:
            break

        selected.append(best_recipe)
        used_ids.add(best_recipe.id)
        selected_produce |= best_produce

    # Build overlap summary
    ingredient_recipes: dict[str, list[str]] = defaultdict(list)
    anchor_result = await db.execute(select(Recipe).where(Recipe.id == anchor_id))
    anchor_recipe = anchor_result.scalar_one()

    for ing_name in anchor_produce:
        ingredient_recipes[ing_name].append(anchor_recipe.name)
    for recipe in selected:
        for step in recipe.steps:
            for si in step.step_ingredients:
                if si.ingredient.category == "Produce":
                    ingredient_recipes[si.ingredient.name].append(recipe.name)

    overlap = [
        OverlapItem(
            ingredient=name,
            recipe_count=len(names),
            recipe_names=names,
        )
        for name, names in sorted(ingredient_recipes.items(), key=lambda x: -len(x[1]))
        if len(names) >= 2
    ]

    return AISuggestResponse(
        suggested_recipe_ids=[r.id for r in selected],
        overlap_summary=overlap,
    )

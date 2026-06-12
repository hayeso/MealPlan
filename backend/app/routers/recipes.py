"""
Recipe CRUD endpoints.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.recipe import Ingredient, Recipe, RecipeStep, StepIngredient
from ..schemas.recipe import RecipeDraft, RecipeOut, RecipeSummary

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("", response_model=list[RecipeSummary])
async def list_recipes(
    search: str = "",
    cuisine: str = "",
    db: AsyncSession = Depends(get_db),
):
    q = select(Recipe).order_by(Recipe.created_at.desc())
    if search:
        ingredient_match = (
            select(Recipe.id)
            .join(RecipeStep, RecipeStep.recipe_id == Recipe.id)
            .join(StepIngredient, StepIngredient.step_id == RecipeStep.id)
            .join(Ingredient, Ingredient.id == StepIngredient.ingredient_id)
            .where(Ingredient.name.ilike(f"%{search}%"))
        )
        q = q.where(
            or_(
                Recipe.name.ilike(f"%{search}%"),
                Recipe.id.in_(ingredient_match),
            )
        )
    if cuisine:
        q = q.where(Recipe.cuisine.ilike(f"%{cuisine}%"))
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{recipe_id}", response_model=RecipeOut)
async def get_recipe(recipe_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
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
        raise HTTPException(404, "Recipe not found")
    return recipe


@router.post("", response_model=RecipeOut)
async def create_recipe(draft: RecipeDraft, db: AsyncSession = Depends(get_db)):
    from .import_routes import _save_draft

    recipe = await _save_draft(draft, db)
    result = await db.execute(
        select(Recipe)
        .options(
            selectinload(Recipe.steps)
            .selectinload(RecipeStep.step_ingredients)
            .selectinload(StepIngredient.ingredient)
        )
        .where(Recipe.id == recipe.id)
    )
    return result.scalar_one()


@router.put("/{recipe_id}", response_model=RecipeOut)
async def update_recipe(
    recipe_id: uuid.UUID, draft: RecipeDraft, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(404, "Recipe not found")

    # Delete old steps (cascades to step_ingredients)
    old_steps = await db.execute(
        select(RecipeStep).where(RecipeStep.recipe_id == recipe_id)
    )
    for s in old_steps.scalars().all():
        await db.delete(s)
    await db.flush()

    recipe.name = draft.name
    recipe.servings = draft.servings
    recipe.cuisine = draft.cuisine
    recipe.source = draft.source
    recipe.source_url = draft.source_url
    recipe.prep_time_mins = draft.prep_time_mins
    recipe.cook_time_mins = draft.cook_time_mins
    recipe.calories = draft.calories
    recipe.protein_g = draft.protein_g
    recipe.carbs_g = draft.carbs_g
    recipe.fat_g = draft.fat_g
    recipe.make_ahead_type = draft.make_ahead_type
    recipe.storage_days = draft.storage_days
    recipe.reheat_instructions = draft.reheat_instructions

    for step_draft in draft.steps:
        step = RecipeStep(
            recipe_id=recipe.id,
            step_number=step_draft.step_number,
            instruction=step_draft.instruction,
            cooking_method=step_draft.cooking_method,
            step_type=step_draft.step_type,
            can_cook_ahead=step_draft.can_cook_ahead,
        )
        db.add(step)
        await db.flush()

        for si in step_draft.ingredients:
            normalized = si.ingredient_name.strip().lower()
            ing_result = await db.execute(
                select(Ingredient).where(Ingredient.name == normalized)
            )
            ingredient = ing_result.scalar_one_or_none()
            if not ingredient:
                ingredient = Ingredient(
                    name=normalized, category=si.ingredient_category, default_unit=si.unit
                )
                db.add(ingredient)
                await db.flush()
            db.add(
                StepIngredient(
                    step_id=step.id,
                    ingredient_id=ingredient.id,
                    quantity=si.quantity,
                    unit=si.unit,
                    prep_note=si.prep_note,
                )
            )

    await db.commit()

    final = await db.execute(
        select(Recipe)
        .options(
            selectinload(Recipe.steps)
            .selectinload(RecipeStep.step_ingredients)
            .selectinload(StepIngredient.ingredient)
        )
        .where(Recipe.id == recipe_id)
    )
    return final.scalar_one()


@router.delete("/{recipe_id}")
async def delete_recipe(recipe_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    await db.delete(recipe)
    await db.commit()
    return {"deleted": True}

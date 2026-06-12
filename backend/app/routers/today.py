"""
Today's View endpoint: returns today's recipe from the active (most recent) meal plan.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.meal_plan import MealPlan, MealPlanSlot
from ..models.recipe import Recipe, RecipeStep, StepIngredient
from ..services.container_lookup import containers_for_today
from ..services.prep_optimizer import generate_prep_guide
from ..services.quantity_formatter import format_quantity

router = APIRouter(tags=["today"])


@router.get("/today")
async def get_today(db: AsyncSession = Depends(get_db)):
    today = date.today()
    day_of_week = today.weekday()  # 0=Monday

    # Find the most recent plan that covers today
    result = await db.execute(
        select(MealPlan)
        .options(
            selectinload(MealPlan.slots)
            .selectinload(MealPlanSlot.recipe)
            .selectinload(Recipe.steps)
            .selectinload(RecipeStep.step_ingredients)
            .selectinload(StepIngredient.ingredient)
        )
        .order_by(MealPlan.created_at.desc())
        .limit(1)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        return {"has_plan": False, "message": "No active meal plan. Create one to get started!"}

    slot = None
    for s in plan.slots:
        if s.day_of_week == day_of_week and s.meal_type == "dinner":
            slot = s
            break

    if not slot or not slot.recipe:
        return {
            "has_plan": True,
            "has_recipe": False,
            "plan_id": str(plan.id),
            "plan_name": plan.name,
            "message": "No recipe assigned for today. Check your planner!",
        }

    recipe = slot.recipe
    servings = slot.servings_override or recipe.servings
    scale = servings / recipe.servings

    steps = []
    for step in recipe.steps:
        ingredients = []
        for si in step.step_ingredients:
            q = si.quantity * scale if si.quantity else None
            ingredients.append({
                "name": si.ingredient.name,
                "quantity": format_quantity(q, si.unit),
                "prep_note": si.prep_note,
            })

        steps.append({
            "step_number": step.step_number,
            "instruction": step.instruction,
            "step_type": step.step_type,
            "can_cook_ahead": step.can_cook_ahead,
            "ingredients": ingredients,
        })

    # Filter steps based on make_ahead_type for Today's View
    visible_steps = steps
    hidden_summary = None
    if recipe.make_ahead_type == "full":
        visible_steps = []
        hidden_summary = "This meal was fully cooked on Sunday. Just reheat!"
    elif recipe.make_ahead_type == "partial":
        visible_steps = [s for s in steps if s["step_type"] in ("cook_fresh", "combine")]
        hidden_count = len(steps) - len(visible_steps)
        if hidden_count > 0:
            hidden_summary = f"{hidden_count} step(s) were completed during Sunday prep."

    prep_guide = await generate_prep_guide(plan.id, db)
    containers_needed = containers_for_today(
        prep_guide,
        recipe.name,
        day_of_week,
        recipe.make_ahead_type,
    )

    return {
        "has_plan": True,
        "has_recipe": True,
        "plan_id": str(plan.id),
        "plan_name": plan.name,
        "recipe": {
            "id": str(recipe.id),
            "name": recipe.name,
            "servings": servings,
            "cuisine": recipe.cuisine,
            "cook_time_mins": recipe.cook_time_mins,
            "make_ahead_type": recipe.make_ahead_type,
            "reheat_instructions": recipe.reheat_instructions,
            "storage_days": recipe.storage_days,
        },
        "visible_steps": visible_steps,
        "hidden_summary": hidden_summary,
        "containers_needed": containers_needed,
    }

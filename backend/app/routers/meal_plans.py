"""
Meal plan CRUD + AI suggestion endpoints.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.meal_plan import MealPlan, MealPlanSlot
from ..models.recipe import Recipe
from ..schemas.meal_plan import (
    AISuggestRequest,
    AISuggestResponse,
    MealPlanCreate,
    MealPlanOut,
    MealPlanSlotCreate,
    MealPlanSlotOut,
    MealPlanSummary,
)

router = APIRouter(prefix="/meal-plans", tags=["meal-plans"])


@router.get("", response_model=list[MealPlanSummary])
async def list_plans(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MealPlan).order_by(MealPlan.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=MealPlanOut)
async def create_plan(body: MealPlanCreate, db: AsyncSession = Depends(get_db)):
    name = body.name or f"Week of {body.week_start.strftime('%B %d')}"
    plan = MealPlan(name=name, week_start=body.week_start)
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return MealPlanOut(
        id=plan.id,
        name=plan.name,
        week_start=plan.week_start,
        created_at=plan.created_at,
        slots=[],
    )


@router.get("/{plan_id}", response_model=MealPlanOut)
async def get_plan(plan_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MealPlan)
        .options(selectinload(MealPlan.slots).selectinload(MealPlanSlot.recipe))
        .where(MealPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(404, "Meal plan not found")
    return plan


@router.put("/{plan_id}/slots", response_model=MealPlanSlotOut)
async def assign_slot(
    plan_id: uuid.UUID, body: MealPlanSlotCreate, db: AsyncSession = Depends(get_db)
):
    plan_result = await db.execute(select(MealPlan).where(MealPlan.id == plan_id))
    if not plan_result.scalar_one_or_none():
        raise HTTPException(404, "Meal plan not found")

    existing = await db.execute(
        select(MealPlanSlot).where(
            MealPlanSlot.meal_plan_id == plan_id,
            MealPlanSlot.day_of_week == body.day_of_week,
            MealPlanSlot.meal_type == body.meal_type,
        )
    )
    slot = existing.scalar_one_or_none()
    if slot:
        slot.recipe_id = body.recipe_id
        slot.servings_override = body.servings_override
        slot.is_anchor = body.is_anchor
    else:
        slot = MealPlanSlot(
            meal_plan_id=plan_id,
            day_of_week=body.day_of_week,
            meal_type=body.meal_type,
            recipe_id=body.recipe_id,
            servings_override=body.servings_override,
            is_anchor=body.is_anchor,
        )
        db.add(slot)

    await db.commit()
    await db.refresh(slot)

    recipe_result = await db.execute(select(Recipe).where(Recipe.id == slot.recipe_id))
    slot.recipe = recipe_result.scalar_one_or_none()
    return slot


@router.delete("/{plan_id}/slots/{slot_id}")
async def remove_slot(
    plan_id: uuid.UUID, slot_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(MealPlanSlot).where(
            MealPlanSlot.id == slot_id, MealPlanSlot.meal_plan_id == plan_id
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(404, "Slot not found")
    await db.delete(slot)
    await db.commit()
    return {"deleted": True}


@router.post("/{plan_id}/ai-suggest", response_model=AISuggestResponse)
async def ai_suggest(
    plan_id: uuid.UUID, body: AISuggestRequest, db: AsyncSession = Depends(get_db)
):
    from ..services.meal_planner import suggest_meals

    plan_result = await db.execute(select(MealPlan).where(MealPlan.id == plan_id))
    if not plan_result.scalar_one_or_none():
        raise HTTPException(404, "Meal plan not found")

    return await suggest_meals(body.anchor_recipe_id, body.num_suggestions, db)

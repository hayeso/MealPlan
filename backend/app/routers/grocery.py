"""
Grocery list endpoint.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.responses import PlainTextResponse

from ..database import get_db
from ..services.grocery_service import generate_grocery_list, grocery_list_to_text

router = APIRouter(tags=["grocery"])


@router.get("/meal-plans/{plan_id}/grocery-list")
async def get_grocery_list(
    plan_id: uuid.UUID,
    format: str = Query("json", pattern="^(json|text)$"),
    db: AsyncSession = Depends(get_db),
):
    grouped = await generate_grocery_list(plan_id, db)
    if not grouped:
        raise HTTPException(404, "Meal plan not found or has no recipes")
    if format == "text":
        return PlainTextResponse(grocery_list_to_text(grouped))
    return grouped

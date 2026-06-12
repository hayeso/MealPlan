"""
Prep guide endpoint.
"""
from __future__ import annotations

import uuid
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..services.prep_optimizer import generate_prep_guide

router = APIRouter(tags=["prep"])


@router.get("/meal-plans/{plan_id}/prep-guide")
async def get_prep_guide(plan_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    guide = await generate_prep_guide(plan_id, db)
    if not guide.raw_prep and not guide.cook_ahead:
        raise HTTPException(404, "No prep tasks found for this plan")
    return asdict(guide)

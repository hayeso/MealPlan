from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from .recipe import RecipeSummary


class MealPlanSlotCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    meal_type: str = "dinner"
    recipe_id: uuid.UUID
    servings_override: int | None = None
    is_anchor: bool = False


class MealPlanSlotOut(BaseModel):
    id: uuid.UUID
    day_of_week: int
    meal_type: str
    recipe_id: uuid.UUID
    recipe: RecipeSummary | None = None
    servings_override: int | None = None
    is_anchor: bool

    model_config = {"from_attributes": True}


class MealPlanCreate(BaseModel):
    name: str = ""
    week_start: date


class MealPlanSummary(BaseModel):
    id: uuid.UUID
    name: str
    week_start: date
    created_at: datetime

    model_config = {"from_attributes": True}


class MealPlanOut(BaseModel):
    id: uuid.UUID
    name: str
    week_start: date
    created_at: datetime
    slots: list[MealPlanSlotOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class AISuggestRequest(BaseModel):
    anchor_recipe_id: uuid.UUID
    num_suggestions: int = 4


class OverlapItem(BaseModel):
    ingredient: str
    recipe_count: int
    recipe_names: list[str]


class AISuggestResponse(BaseModel):
    suggested_recipe_ids: list[uuid.UUID]
    overlap_summary: list[OverlapItem]

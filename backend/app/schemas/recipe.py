from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ---------- Ingredient ----------

class IngredientOut(BaseModel):
    id: uuid.UUID
    name: str
    category: str
    default_unit: str | None = None

    model_config = {"from_attributes": True}


# ---------- Step Ingredient ----------

class StepIngredientDraft(BaseModel):
    ingredient_name: str
    ingredient_category: str = "Pantry"
    quantity: float | None = None
    unit: str | None = None
    prep_note: str | None = None


class StepIngredientOut(BaseModel):
    id: uuid.UUID
    ingredient_id: uuid.UUID
    ingredient: IngredientOut
    quantity: float | None = None
    unit: str | None = None
    prep_note: str | None = None

    model_config = {"from_attributes": True}


# ---------- Recipe Step ----------

class RecipeStepDraft(BaseModel):
    step_number: int
    instruction: str
    cooking_method: str | None = None
    step_type: str = "cook_fresh"
    can_cook_ahead: bool = False
    ingredients: list[StepIngredientDraft] = Field(default_factory=list)


class RecipeStepOut(BaseModel):
    id: uuid.UUID
    step_number: int
    instruction: str
    cooking_method: str | None = None
    step_type: str
    can_cook_ahead: bool
    step_ingredients: list[StepIngredientOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# ---------- Recipe ----------

class RecipeDraft(BaseModel):
    """The AI-parsed or user-edited recipe that gets confirmed and saved."""
    name: str
    servings: int = 4
    cuisine: str | None = None
    source: str = "Manual"
    source_url: str | None = None
    prep_time_mins: int | None = None
    cook_time_mins: int | None = None
    calories: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    make_ahead_type: str = "none"
    storage_days: int | None = None
    reheat_instructions: str | None = None
    steps: list[RecipeStepDraft] = Field(default_factory=list)


class RecipeSummary(BaseModel):
    id: uuid.UUID
    name: str
    servings: int
    cuisine: str | None = None
    source: str
    source_url: str | None = None
    prep_time_mins: int | None = None
    cook_time_mins: int | None = None
    calories: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    make_ahead_type: str
    storage_days: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RecipeOut(BaseModel):
    id: uuid.UUID
    name: str
    servings: int
    cuisine: str | None = None
    source: str
    source_url: str | None = None
    prep_time_mins: int | None = None
    cook_time_mins: int | None = None
    calories: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    make_ahead_type: str
    storage_days: int | None = None
    reheat_instructions: str | None = None
    created_at: datetime
    steps: list[RecipeStepOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# ---------- Import ----------

class ImportURLRequest(BaseModel):
    url: str


class ImportDraftResponse(BaseModel):
    draft: RecipeDraft


class ImportBatchDraftResponse(BaseModel):
    drafts: list[RecipeDraft]
    total: int

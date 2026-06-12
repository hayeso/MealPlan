"""
Import routes: URL, HTML file upload, OCR image upload, and confirm (save draft to DB).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.recipe import Ingredient, Recipe, RecipeStep, StepIngredient
from ..schemas.recipe import (
    ImportURLRequest,
    ImportDraftResponse,
    ImportBatchDraftResponse,
    RecipeDraft,
    RecipeOut,
)
from ..services.ai_parser import parse_recipe_text, parse_recipes_parallel

router = APIRouter(prefix="/import", tags=["import"])


async def _save_draft(draft: RecipeDraft, db: AsyncSession) -> Recipe:
    """Persist a confirmed RecipeDraft into the database, returning the Recipe ORM object."""
    from sqlalchemy import select

    recipe = Recipe(
        name=draft.name,
        servings=draft.servings,
        cuisine=draft.cuisine,
        source=draft.source,
        source_url=draft.source_url,
        prep_time_mins=draft.prep_time_mins,
        cook_time_mins=draft.cook_time_mins,
        calories=draft.calories,
        protein_g=draft.protein_g,
        carbs_g=draft.carbs_g,
        fat_g=draft.fat_g,
        make_ahead_type=draft.make_ahead_type,
        storage_days=draft.storage_days,
        reheat_instructions=draft.reheat_instructions,
    )
    db.add(recipe)
    await db.flush()

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
            normalized_name = si.ingredient_name.strip().lower()
            result = await db.execute(
                select(Ingredient).where(Ingredient.name == normalized_name)
            )
            ingredient = result.scalar_one_or_none()
            if ingredient is None:
                ingredient = Ingredient(
                    name=normalized_name,
                    category=si.ingredient_category,
                    default_unit=si.unit,
                )
                db.add(ingredient)
                await db.flush()

            step_ingredient = StepIngredient(
                step_id=step.id,
                ingredient_id=ingredient.id,
                quantity=si.quantity,
                unit=si.unit,
                prep_note=si.prep_note,
            )
            db.add(step_ingredient)

    await db.commit()
    return recipe


@router.post("/url", response_model=ImportDraftResponse)
async def import_from_url(body: ImportURLRequest):
    from ..services.url_scraper import scrape_url

    raw_text = await scrape_url(body.url)
    if not raw_text:
        raise HTTPException(400, "Could not extract recipe content from the URL")
    source = f"URL - {body.url.split('/')[2]}" if "/" in body.url else "URL"
    draft = await parse_recipe_text(raw_text, source=source)
    draft.source_url = body.url
    return ImportDraftResponse(draft=draft)


@router.post("/html", response_model=ImportBatchDraftResponse)
async def import_from_html(
    file: UploadFile = File(...),
    limit: int = 10,
    offset: int = 0,
):
    """
    Parse a RecipeKeeper HTML export. Returns AI-parsed drafts in pages.
    Recipes are parsed concurrently for speed, with auto-escalation to a
    heavier model when the fast model produces low-quality output.
    """
    from ..services.html_importer import parse_recipekeeper_html

    content = await file.read()
    recipe_texts = parse_recipekeeper_html(content.decode("utf-8", errors="replace"))
    if not recipe_texts:
        raise HTTPException(400, "Could not parse any recipes from the HTML file")

    total = len(recipe_texts)
    page = recipe_texts[offset : offset + limit]

    results = await parse_recipes_parallel(page, source="HTML Import")
    drafts = [d for d in results if d is not None]

    if not drafts:
        raise HTTPException(400, "AI could not parse any of the recipes from this file")

    return ImportBatchDraftResponse(drafts=drafts, total=total)


@router.post("/ocr", response_model=ImportDraftResponse)
async def import_from_ocr(file: UploadFile = File(...)):
    from ..services.ocr_service import extract_text_from_image

    content = await file.read()
    raw_text = await extract_text_from_image(content)
    if not raw_text or len(raw_text.strip()) < 20:
        raise HTTPException(
            400,
            "Could not extract readable text from the image. Try a clearer photo with good lighting.",
        )
    draft = await parse_recipe_text(raw_text, source="Photo")
    return ImportDraftResponse(draft=draft)


@router.post("/confirm", response_model=RecipeOut)
async def confirm_import(draft: RecipeDraft, db: AsyncSession = Depends(get_db)):
    recipe = await _save_draft(draft, db)
    # Re-query with relationships loaded
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Recipe)
        .options(
            selectinload(Recipe.steps)
            .selectinload(RecipeStep.step_ingredients)
            .selectinload(StepIngredient.ingredient)
        )
        .where(Recipe.id == recipe.id)
    )
    full_recipe = result.scalar_one()
    return full_recipe

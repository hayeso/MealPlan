"""
RecipeKeeper HTML export parser.
Extracts raw recipe text from RecipeKeeper's HTML export format.

RecipeKeeper format uses:
  - div.recipe-details for each recipe
  - h2[itemprop="name"] for the title
  - span[itemprop="recipeYield"] for servings
  - meta[itemprop="prepTime"] / meta[itemprop="cookTime"] for times
  - div.recipe-ingredients[itemprop="recipeIngredients"] with <p> tags
  - div[itemprop="recipeDirections"] with <p> tags
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup


def parse_recipekeeper_html(html_content: str) -> list[str]:
    """
    Parse a RecipeKeeper HTML export and return a list of raw-text recipe strings,
    one per recipe found in the file.
    """
    soup = BeautifulSoup(html_content, "html.parser")
    recipes: list[str] = []

    for div in soup.select("div.recipe-details"):
        text = _extract_single_recipe(div)
        if text and len(text) > 50:
            recipes.append(text)

    if not recipes:
        body = soup.body or soup
        text = body.get_text(separator="\n", strip=True)
        if len(text) > 50:
            recipes.append(text)

    return recipes


def _extract_single_recipe(div) -> str:
    parts: list[str] = []

    # Title
    name_el = div.select_one("[itemprop='name']") or div.find("h2")
    if name_el:
        parts.append(f"Title: {name_el.get_text(strip=True)}")

    # Servings
    yield_el = div.select_one("[itemprop='recipeYield']")
    if yield_el:
        parts.append(f"Servings: {yield_el.get_text(strip=True)}")

    # Times
    prep_el = div.select_one("meta[itemprop='prepTime']")
    if prep_el and prep_el.get("content"):
        parts.append(f"Prep time: {_iso_to_readable(prep_el['content'])}")

    cook_el = div.select_one("meta[itemprop='cookTime']")
    if cook_el and cook_el.get("content"):
        parts.append(f"Cook time: {_iso_to_readable(cook_el['content'])}")

    # Ingredients
    ing_div = div.select_one("[itemprop='recipeIngredients']")
    if ing_div:
        items = []
        for p in ing_div.find_all("p"):
            text = p.get_text(strip=True)
            if text:
                items.append(text)
        if items:
            parts.append("Ingredients:\n" + "\n".join(f"- {i}" for i in items))

    # Directions
    dir_div = div.select_one("[itemprop='recipeDirections']")
    if dir_div:
        steps = []
        step_num = 0
        for p in dir_div.find_all("p"):
            text = p.get_text(strip=True)
            if text:
                step_num += 1
                steps.append(f"{step_num}. {text}")
        if steps:
            parts.append("Method:\n" + "\n".join(steps))

    # Course
    course_el = div.select_one("[itemprop='recipeCourse']")
    if course_el:
        course = course_el.get_text(strip=True)
        if course:
            parts.append(f"Course: {course}")

    return "\n\n".join(parts)


def _iso_to_readable(iso_duration: str) -> str:
    """Convert ISO 8601 duration like PT20M or PT1H30M to readable form."""
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", iso_duration)
    if not m:
        return iso_duration
    hours = int(m.group(1) or 0)
    mins = int(m.group(2) or 0)
    if hours and mins:
        return f"{hours}h {mins}m"
    if hours:
        return f"{hours}h"
    return f"{mins} mins"

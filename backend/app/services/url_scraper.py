"""
URL scraper: fetches recipe pages and extracts raw text for AI parsing.
Supports BBC Good Food with domain-specific selectors, falls back to generic extraction.
"""
from __future__ import annotations

import httpx
from bs4 import BeautifulSoup


async def scrape_url(url: str) -> str:
    """Fetch a recipe URL and return extracted raw text (title + ingredients + method)."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
        resp = await client.get(url, headers={"User-Agent": "MealPlan/1.0"})
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    domain = url.split("/")[2].lower() if "/" in url else ""

    if "bbcgoodfood" in domain:
        return _parse_bbc_good_food(soup)
    return _parse_generic(soup)


def _parse_bbc_good_food(soup: BeautifulSoup) -> str:
    title = ""
    h1 = soup.select_one("h1.heading-1") or soup.select_one("h1")
    if h1:
        title = h1.get_text(strip=True)

    ingredients: list[str] = []
    for section in soup.select(".recipe__ingredients li, .ingredients-list__item"):
        text = section.get_text(strip=True)
        if text:
            ingredients.append(text)

    methods: list[str] = []
    for step in soup.select(
        ".recipe__method-steps li, .method-steps__list-item .editor-content p"
    ):
        text = step.get_text(strip=True)
        if text:
            methods.append(text)

    if not ingredients:
        for li in soup.select("li"):
            text = li.get_text(strip=True)
            parent_class = " ".join(li.parent.get("class", []))  # type: ignore[union-attr]
            if "ingredient" in parent_class.lower() and text:
                ingredients.append(text)

    if not methods:
        for li in soup.select("ol li"):
            text = li.get_text(strip=True)
            if len(text) > 20:
                methods.append(text)

    parts = [f"Title: {title}"]
    if ingredients:
        parts.append("Ingredients:\n" + "\n".join(f"- {i}" for i in ingredients))
    if methods:
        parts.append(
            "Method:\n" + "\n".join(f"{n+1}. {s}" for n, s in enumerate(methods))
        )
    return "\n\n".join(parts)


def _parse_generic(soup: BeautifulSoup) -> str:
    """Best-effort extraction from any recipe page using JSON-LD or article body."""
    import json

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get("@type") == "Recipe" or (
                    isinstance(item.get("@type"), list) and "Recipe" in item["@type"]
                ):
                    return _recipe_jsonld_to_text(item)
        except (json.JSONDecodeError, TypeError):
            continue

    title = ""
    h1 = soup.select_one("h1")
    if h1:
        title = h1.get_text(strip=True)

    body_text = ""
    article = soup.select_one("article") or soup.select_one("main") or soup.body
    if article:
        body_text = article.get_text(separator="\n", strip=True)

    return f"Title: {title}\n\n{body_text}"


def _recipe_jsonld_to_text(data: dict) -> str:
    parts = [f"Title: {data.get('name', 'Unknown')}"]

    ingredients = data.get("recipeIngredient", [])
    if ingredients:
        parts.append("Ingredients:\n" + "\n".join(f"- {i}" for i in ingredients))

    instructions = data.get("recipeInstructions", [])
    method_lines: list[str] = []
    for i, inst in enumerate(instructions, 1):
        if isinstance(inst, str):
            method_lines.append(f"{i}. {inst}")
        elif isinstance(inst, dict):
            method_lines.append(f"{i}. {inst.get('text', '')}")
    if method_lines:
        parts.append("Method:\n" + "\n".join(method_lines))

    servings = data.get("recipeYield")
    if servings:
        s = servings[0] if isinstance(servings, list) else servings
        parts.insert(1, f"Servings: {s}")

    prep_time = data.get("prepTime", "")
    cook_time = data.get("cookTime", "")
    if prep_time:
        parts.insert(1, f"Prep time: {prep_time}")
    if cook_time:
        parts.insert(1, f"Cook time: {cook_time}")

    return "\n\n".join(parts)

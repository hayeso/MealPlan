"""
Assign batch-prep portions to shared containers using an LLM (with heuristic fallback).

The LLM reads full recipe steps, when each ingredient is used, and how many days
items sit in the fridge from Sunday prep until the meal is eaten.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

from ..config import settings
from ..models.meal_plan import MealPlan
from .ai_parser import _get_client
from .prep_notes import is_batch_prep_ingredient, normalize_prep_note
from .prep_optimizer import DAY_NAMES, RawPrepTask

log = logging.getLogger(__name__)

CONTAINER_SYSTEM_PROMPT = """\
You are an expert meal-prep kitchen planner. The user preps on SUNDAY (prep day 1).
Each dinner is eaten on a later weekday. Your job: assign prepped ingredients to
fridge containers so items that can be stored together share one container, while
respecting food safety, texture, and WHEN each ingredient is actually used in the recipe.

Return JSON only:
{
  "groups": [
    {
      "group_key": "thursday_nachos_bean_base",
      "item_ids": ["p0_0", "p1_0"],
      "description": "Thursday nachos — bean & veg base",
      "prep_phase": "early cook",
      "storage_rationale": "Onion, garlic, beans used together in steps 2–4; holds 4 days until Thursday."
    }
  ],
  "warnings": [
    {
      "item_id": "p5_0",
      "message": "Fresh coriander leaves may wilt — consider prepping Thursday morning instead."
    }
  ]
}

## How to analyse each meal

1. Read the FULL recipe_steps list — note step order, step_type, and which ingredients
   appear at each step. Ingredients used in the SAME cooking phase (e.g. all go into the
   pan in steps 2–4) can usually share one container even if the recipe lists them in
   separate prep lines.

2. SPLIT containers when ingredients are used at DIFFERENT times:
   - Early-cook base (sauté aromatics, simmer sauce) vs late assembly (fresh garnish, toppings)
   - Example: chilli for the bean base (step 3) should NOT share a container with sliced
     chilli for garnish (step 12) if they are prepped differently or added at different times.

3. You MAY deviate slightly from strict per-step grouping when it is practical:
   - Combine all "goes in the pot together" items even if prep notes differ
   - Keep separate anything that would make others soggy, brown, or unsafe

## Shelf life (Sunday prep = day 1)

For each meal, use days_until_eat (calendar days from Sunday prep to eat day):
- 1 day (Monday): most prepped veg, herbs, proteins OK if properly stored
- 2–3 days: diced onion, carrot, cabbage, hard veg OK; soft herbs and cut tomato degrade
- 4–5 days (Thu–Fri): avoid pre-cutting delicate herbs, avocado, soft salad leaves;
  wet garnishes; items that oxidise (cut apple, potato unless submerged)
- Use recipe_storage_days when provided — do not exceed it for the whole dish
- Raw meat/fish: max 2–3 days refrigerated after prep; if days_until_eat > 2, split or warn

## Hard rules (never break)

1. NEVER combine raw meat/fish/seafood with ready-to-eat salad vegetables or herbs.
2. NEVER combine wet/marinated items with dry/crispy items (dressing, beaten egg, breadcrumbs).
3. Items for DIFFERENT eat days or DIFFERENT recipes must be in DIFFERENT groups.
4. Every item_id must appear in exactly one group.
5. Use the FEWEST groups possible while respecting safety, shelf life, and cook timing.
6. description: short fridge label (max 12 words).
7. storage_rationale: one sentence explaining hold time and why these items share a container.
8. warnings: optional list for items that are risky to prep on Sunday given days_until_eat
   (omit warnings array if none).
"""


@dataclass
class StepAppearance:
    step_number: int
    step_type: str
    instruction: str


@dataclass
class PrepItem:
    item_id: str
    ingredient: str
    prep_note: str | None
    amount: str
    recipe_name: str
    day: str
    day_of_week: int
    days_until_eat: int
    category: str
    step_appearances: list[StepAppearance] = field(default_factory=list)
    task_idx: int = 0
    portion_idx: int = 0

    @property
    def primary_step(self) -> int:
        if not self.step_appearances:
            return 999
        return min(s.step_number for s in self.step_appearances)


@dataclass
class ContainerSummary:
    container: str
    description: str
    recipe_name: str
    day: str
    ingredients: list[str]
    prep_phase: str | None = None
    storage_rationale: str | None = None


def container_label(index: int) -> str:
    n = index + 1
    letters = ""
    while n > 0:
        n, rem = divmod(n - 1, 26)
        letters = chr(65 + rem) + letters
    return f"Container {letters}"


def days_until_eat(day_of_week: int) -> int:
    """Calendar days from Sunday prep (day 1) until the meal is eaten."""
    if day_of_week < 0:
        return 1
    if day_of_week >= 7:
        return day_of_week + 1
    return day_of_week + 1


def _prep_phase_from_step(step_number: int) -> str:
    if step_number <= 4:
        return "early"
    if step_number <= 8:
        return "mid"
    return "late"


def _build_step_index(plan: MealPlan) -> dict[tuple[str, str, str | None], list[StepAppearance]]:
    """Map (recipe_name, ingredient, prep_note) -> steps where that prep appears."""
    index: dict[tuple[str, str, str | None], list[StepAppearance]] = {}

    for slot in plan.slots:
        if not slot.recipe:
            continue
        recipe_name = slot.recipe.name
        for step in slot.recipe.steps:
            for si in step.step_ingredients:
                if not is_batch_prep_ingredient(step.step_type, si.prep_note):
                    continue
                prep_key = normalize_prep_note(si.prep_note)
                key = (recipe_name, si.ingredient.name, prep_key)
                appearance = StepAppearance(
                    step_number=step.step_number,
                    step_type=step.step_type,
                    instruction=step.instruction[:200],
                )
                index.setdefault(key, []).append(appearance)

    return index


def _build_recipe_meta(plan: MealPlan) -> dict[str, dict]:
    meta: dict[str, dict] = {}
    for slot in plan.slots:
        if not slot.recipe:
            continue
        recipe = slot.recipe
        if recipe.name in meta:
            continue
        meta[recipe.name] = {
            "storage_days": recipe.storage_days,
            "make_ahead_type": recipe.make_ahead_type,
            "steps": [
                {
                    "step_number": s.step_number,
                    "step_type": s.step_type,
                    "instruction": s.instruction,
                    "ingredients": [
                        {
                            "name": si.ingredient.name,
                            "prep_note": si.prep_note,
                            "category": si.ingredient.category,
                        }
                        for si in s.step_ingredients
                    ],
                }
                for s in sorted(recipe.steps, key=lambda x: x.step_number)
            ],
        }
    return meta


def _build_prep_items(plan: MealPlan, raw_prep: list[RawPrepTask]) -> list[PrepItem]:
    step_index = _build_step_index(plan)
    day_for_recipe: dict[tuple[str, str], int] = {}

    for slot in plan.slots:
        if not slot.recipe:
            continue
        day = DAY_NAMES[slot.day_of_week] if slot.day_of_week < 7 else f"Day {slot.day_of_week}"
        day_for_recipe[(slot.recipe.name, day)] = slot.day_of_week

    ing_categories: dict[tuple[str, str], str] = {}
    for slot in plan.slots:
        if not slot.recipe:
            continue
        for step in slot.recipe.steps:
            for si in step.step_ingredients:
                ing_categories[(slot.recipe.name, si.ingredient.name)] = si.ingredient.category

    items: list[PrepItem] = []
    for ti, task in enumerate(raw_prep):
        prep_key = normalize_prep_note(task.prep_note)
        for pi, portion in enumerate(task.portions):
            appearances = step_index.get(
                (portion.recipe_name, task.ingredient, prep_key), []
            )
            dow = day_for_recipe.get((portion.recipe_name, portion.day), 0)
            cat = ing_categories.get((portion.recipe_name, task.ingredient), "Pantry")
            items.append(
                PrepItem(
                    item_id=f"p{ti}_{pi}",
                    ingredient=task.ingredient,
                    prep_note=task.prep_note,
                    amount=portion.amount,
                    recipe_name=portion.recipe_name,
                    day=portion.day,
                    day_of_week=dow,
                    days_until_eat=days_until_eat(dow),
                    category=cat,
                    step_appearances=appearances,
                    task_idx=ti,
                    portion_idx=pi,
                )
            )
    return items


def _heuristic_groups(items: list[PrepItem]) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    """Group by recipe, eat day, and recipe phase (early/mid/late cook)."""
    group_for_item: dict[str, str] = {}
    group_descriptions: dict[str, str] = {}
    group_rationales: dict[str, str] = {}

    for item in items:
        phase = _prep_phase_from_step(item.primary_step)
        gkey = f"{item.day}|{item.recipe_name}|{phase}"
        group_for_item[item.item_id] = gkey
        if gkey not in group_descriptions:
            phase_label = {"early": "base prep", "mid": "mid cook", "late": "finish / garnish"}[phase]
            group_descriptions[gkey] = f"{item.day} — {item.recipe_name} ({phase_label})"
            group_rationales[gkey] = (
                f"Grouped by cook phase (step {item.primary_step}); "
                f"{item.days_until_eat} day(s) from Sunday prep."
            )
    return group_for_item, group_descriptions, group_rationales


def _build_user_payload(items: list[PrepItem], plan: MealPlan) -> str:
    recipe_meta = _build_recipe_meta(plan)
    meals: dict[tuple[str, str], dict] = {}

    for item in items:
        key = (item.recipe_name, item.day)
        if key not in meals:
            meta = recipe_meta.get(item.recipe_name, {})
            meals[key] = {
                "recipe": item.recipe_name,
                "eat_day": item.day,
                "days_until_eat": item.days_until_eat,
                "recipe_storage_days": meta.get("storage_days"),
                "make_ahead_type": meta.get("make_ahead_type"),
                "recipe_steps": meta.get("steps", []),
                "items": [],
            }
        meals[key]["items"].append({
            "item_id": item.item_id,
            "ingredient": item.ingredient,
            "prep_note": item.prep_note,
            "amount": item.amount,
            "category": item.category,
            "primary_step": item.primary_step if item.step_appearances else None,
            "used_in_steps": [
                {
                    "step_number": s.step_number,
                    "step_type": s.step_type,
                    "instruction": s.instruction,
                }
                for s in sorted(item.step_appearances, key=lambda x: x.step_number)
            ],
        })

    payload = {
        "prep_context": {
            "prep_day": "Sunday",
            "prep_day_number": 1,
            "note": (
                "All items are prepped on Sunday. days_until_eat is calendar days "
                "from Sunday prep until the eat_day meal (Monday=1, Tuesday=2, …)."
            ),
        },
        "meals": list(meals.values()),
    }
    return json.dumps(payload, indent=2)


def _meal_keys(items: list[PrepItem]) -> list[tuple[str, str]]:
    seen: list[tuple[str, str]] = []
    for item in items:
        key = (item.recipe_name, item.day)
        if key not in seen:
            seen.append(key)
    return seen


def _prefix_group_keys(
    group_for_item: dict[str, str],
    group_descriptions: dict[str, str],
    group_rationales: dict[str, str],
    group_phases: dict[str, str],
    prefix: str,
) -> tuple[dict[str, str], dict[str, str], dict[str, str], dict[str, str]]:
    """Namespace group keys so meals don't collide when merging."""
    remapped_items: dict[str, str] = {}
    remapped_desc: dict[str, str] = {}
    remapped_rat: dict[str, str] = {}
    remapped_phase: dict[str, str] = {}

    for iid, gkey in group_for_item.items():
        new_key = f"{prefix}|{gkey}"
        remapped_items[iid] = new_key
        if gkey in group_descriptions:
            remapped_desc[new_key] = group_descriptions[gkey]
        if gkey in group_rationales:
            remapped_rat[new_key] = group_rationales[gkey]
        if gkey in group_phases:
            remapped_phase[new_key] = group_phases[gkey]

    return remapped_items, remapped_desc, remapped_rat, remapped_phase


async def _ai_groups_for_meal(
    meal_items: list[PrepItem],
    plan: MealPlan,
    meal_key: tuple[str, str],
) -> tuple[dict[str, str], dict[str, str], dict[str, str], dict[str, str], list[dict]] | None:
    if not meal_items or not settings.openai_api_key:
        return None
    recipe_name, day = meal_key
    payload = _build_user_payload(meal_items, plan)
    try:
        client = _get_client()
        response = await client.chat.completions.create(
            model=settings.llm_fast_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": CONTAINER_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Assign containers for ONE meal only: {recipe_name} on {day}.\n"
                        f"Every item_id in the payload must appear exactly once.\n\n"
                        f"{payload}"
                    ),
                },
            ],
            temperature=0.1,
        )
        data = json.loads(response.choices[0].message.content or "{}")
        group_for_item: dict[str, str] = {}
        group_descriptions: dict[str, str] = {}
        group_rationales: dict[str, str] = {}
        group_phases: dict[str, str] = {}

        for group in data.get("groups", []):
            gkey = str(group.get("group_key", "group"))
            desc = str(group.get("description", ""))
            if desc:
                group_descriptions[gkey] = desc
            rationale = group.get("storage_rationale")
            if rationale:
                group_rationales[gkey] = str(rationale)
            phase = group.get("prep_phase")
            if phase:
                group_phases[gkey] = str(phase)
            for iid in group.get("item_ids", []):
                group_for_item[str(iid)] = gkey

        warnings = data.get("warnings") or []
        if not isinstance(warnings, list):
            warnings = []

        expected_ids = {i.item_id for i in meal_items}
        if set(group_for_item.keys()) != expected_ids:
            log.warning(
                "AI grouping incomplete for %s / %s (%d/%d items)",
                recipe_name,
                day,
                len(group_for_item),
                len(meal_items),
            )
            return None
        return group_for_item, group_descriptions, group_rationales, group_phases, warnings
    except Exception as exc:
        log.warning("AI container grouping failed for %s: %s", meal_key, exc)
        return None


async def _ai_groups(
    items: list[PrepItem],
    plan: MealPlan,
) -> tuple[dict[str, str], dict[str, str], dict[str, str], dict[str, str], list[dict]] | None:
    if not items or not settings.openai_api_key:
        return None

    merged_items: dict[str, str] = {}
    merged_desc: dict[str, str] = {}
    merged_rat: dict[str, str] = {}
    merged_phase: dict[str, str] = {}
    all_warnings: list[dict] = []
    any_ai = False

    for meal_key in _meal_keys(items):
        meal_items = [i for i in items if (i.recipe_name, i.day) == meal_key]
        prefix = f"{meal_key[1]}|{meal_key[0]}"
        result = await _ai_groups_for_meal(meal_items, plan, meal_key)
        if result:
            gfi, gd, gr, gp, warnings = result
            gfi, gd, gr, gp = _prefix_group_keys(gfi, gd, gr, gp, prefix)
            merged_items.update(gfi)
            merged_desc.update(gd)
            merged_rat.update(gr)
            merged_phase.update(gp)
            all_warnings.extend(warnings)
            any_ai = True
        else:
            hfi, hgd, hgr = _heuristic_groups(meal_items)
            hfi, hgd, hgr, hp = _prefix_group_keys(hfi, hgd, hgr, {}, prefix)
            merged_items.update(hfi)
            merged_desc.update(hgd)
            merged_rat.update(hgr)
            merged_phase.update(hp)

    if not any_ai:
        return None
    return merged_items, merged_desc, merged_rat, merged_phase, all_warnings


def apply_container_groups(
    raw_prep: list[RawPrepTask],
    items: list[PrepItem],
    group_for_item: dict[str, str],
    group_descriptions: dict[str, str],
    start_index: int = 0,
    group_rationales: dict[str, str] | None = None,
    group_phases: dict[str, str] | None = None,
) -> tuple[list[ContainerSummary], int]:
    """Apply group keys to portion containers; return summaries and next label index."""
    group_rationales = group_rationales or {}
    group_phases = group_phases or {}

    unique_groups: list[str] = []
    for item in items:
        g = group_for_item[item.item_id]
        if g not in unique_groups:
            unique_groups.append(g)

    group_to_container = {
        g: container_label(start_index + i) for i, g in enumerate(unique_groups)
    }

    for item in items:
        raw_prep[item.task_idx].portions[item.portion_idx].container = group_to_container[
            group_for_item[item.item_id]
        ]

    summaries: list[ContainerSummary] = []
    for g in unique_groups:
        group_items = [i for i in items if group_for_item[i.item_id] == g]
        if not group_items:
            continue
        desc = group_descriptions.get(g) or f"{group_items[0].day} — {group_items[0].recipe_name}"
        ing_labels = []
        for i in group_items:
            label = i.ingredient
            if i.prep_note:
                label = f"{i.ingredient} ({i.prep_note})"
            ing_labels.append(label)
        summaries.append(
            ContainerSummary(
                container=group_to_container[g],
                description=desc,
                recipe_name=group_items[0].recipe_name,
                day=group_items[0].day,
                ingredients=ing_labels,
                prep_phase=group_phases.get(g),
                storage_rationale=group_rationales.get(g),
            )
        )

    return summaries, start_index + len(unique_groups)


async def assign_batch_containers(
    plan: MealPlan,
    raw_prep: list[RawPrepTask],
    *,
    use_ai: bool = True,
) -> tuple[list[ContainerSummary], str, int, list[dict]]:
    """
    Mutates raw_prep portion containers in place.
    Returns (container summaries, strategy used, next container index, warnings).
    """
    items = _build_prep_items(plan, raw_prep)
    if not items:
        return [], "none", 0, []

    strategy = "heuristic"
    warnings: list[dict] = []
    group_for_item: dict[str, str]
    group_descriptions: dict[str, str]
    group_rationales: dict[str, str] = {}
    group_phases: dict[str, str] = {}

    if use_ai:
        ai_result = await _ai_groups(items, plan)
        if ai_result:
            group_for_item, group_descriptions, group_rationales, group_phases, warnings = ai_result
            strategy = "ai"
        else:
            group_for_item, group_descriptions, group_rationales = _heuristic_groups(items)
    else:
        group_for_item, group_descriptions, group_rationales = _heuristic_groups(items)

    summaries, next_index = apply_container_groups(
        raw_prep,
        items,
        group_for_item,
        group_descriptions,
        start_index=0,
        group_rationales=group_rationales,
        group_phases=group_phases,
    )
    return summaries, strategy, next_index, warnings

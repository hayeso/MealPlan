import type { Recipe, IngredientGroup, ParsedIngredient } from '../types/recipe'

function humaniseQuantity(qty: number): string {
  if (qty === Math.floor(qty)) return String(qty)

  const whole = Math.floor(qty)
  const frac = qty - whole

  const fractions: [number, string][] = [
    [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'],
    [0.5, '½'], [0.667, '⅔'], [0.75, '¾'],
  ]

  let closest = fractions[0]
  let minDiff = Math.abs(frac - fractions[0][0])

  for (const entry of fractions) {
    const diff = Math.abs(frac - entry[0])
    if (diff < minDiff) {
      minDiff = diff
      closest = entry
    }
  }

  if (minDiff < 0.05) {
    return whole > 0 ? `${whole} ${closest[1]}` : closest[1]
  }

  return qty.toFixed(1)
}

function scaleIngredient(ing: ParsedIngredient, factor: number): ParsedIngredient {
  return {
    ...ing,
    quantity: ing.quantity != null ? ing.quantity * factor : null,
    raw: ing.quantity != null
      ? `${humaniseQuantity(ing.quantity * factor)}${ing.unit ? ' ' + ing.unit : ''} ${ing.item}${ing.prep ? ', ' + ing.prep : ''}`
      : ing.raw,
  }
}

export function scaleRecipe(recipe: Recipe, targetServings: number): Recipe {
  const factor = targetServings / recipe.servings
  if (factor === 1) return recipe

  return {
    ...recipe,
    servings: targetServings,
    ingredientGroups: recipe.ingredientGroups.map(
      (group: IngredientGroup) => ({
        ...group,
        ingredients: group.ingredients.map(ing => scaleIngredient(ing, factor)),
      })
    ),
  }
}

export { humaniseQuantity }

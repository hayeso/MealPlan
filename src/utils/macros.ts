export interface MacroFields {
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  servings: number
}

export function scaleMacros(recipe: MacroFields, servings: number): MacroFields {
  const factor = servings / recipe.servings
  if (factor === 1) return recipe
  const scale = (v: number | null | undefined) =>
    v != null ? Math.round(v * factor) : null
  return {
    servings,
    calories: scale(recipe.calories),
    protein_g: scale(recipe.protein_g),
    carbs_g: scale(recipe.carbs_g),
    fat_g: scale(recipe.fat_g),
  }
}

export function formatMacroRow(m: MacroFields): string | null {
  if (m.calories == null && m.protein_g == null) return null
  const parts: string[] = []
  if (m.calories != null) parts.push(`${Math.round(m.calories)} kcal`)
  if (m.protein_g != null) parts.push(`${Math.round(m.protein_g)}g protein`)
  if (m.carbs_g != null) parts.push(`${Math.round(m.carbs_g)}g carbs`)
  if (m.fat_g != null) parts.push(`${Math.round(m.fat_g)}g fat`)
  return parts.join(' · ')
}

export function sumMacros(items: MacroFields[]): MacroFields {
  const total: MacroFields = { servings: 1, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  for (const m of items) {
    if (m.calories != null) total.calories = (total.calories ?? 0) + m.calories
    if (m.protein_g != null) total.protein_g = (total.protein_g ?? 0) + m.protein_g
    if (m.carbs_g != null) total.carbs_g = (total.carbs_g ?? 0) + m.carbs_g
    if (m.fat_g != null) total.fat_g = (total.fat_g ?? 0) + m.fat_g
  }
  return total
}

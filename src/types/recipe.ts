export interface ParsedIngredient {
  raw: string
  quantity: number | null
  unit: string | null
  item: string
  prep: string | null
  notes: string | null
}

export interface IngredientGroup {
  groupName: string | null
  ingredients: ParsedIngredient[]
}

export interface Recipe {
  id: string
  name: string
  course: string
  servings: number
  prepMins: number
  cookMins: number
  totalMins: number
  ingredientGroups: IngredientGroup[]
  directions: string[]
  tags: string[]
}

export interface SessionRecipe {
  recipeId: string
  targetServings: number
}

export interface PrepDistribution {
  container: string
  amount: string
}

export interface PrepTask {
  task: string
  distribute: PrepDistribution[]
}

export interface CookStep {
  step: number
  task: string
  containers: string[]
  splitAfter: boolean
  splitReason?: string
}

export interface ShoppingItem {
  ingredient: string
  totalAmount: string
  usedIn: string[]
  category?: string
}

export interface BatchPlan {
  prepPhase: PrepTask[]
  cookingPhase: CookStep[]
  shoppingList: ShoppingItem[]
  estimatedTotalTime: number
}

export type PrepDayCategory = 'vegetable_prep' | 'meat_prep' | 'marinating' | 'measuring' | 'full_cook'

export interface PrepDayTask {
  task: string
  category: PrepDayCategory
  storage: string
  maxStorageDays: number
  safetyNote?: string
  distribute: PrepDistribution[]
}

export interface PrepDayUnsafe {
  item: string
  reason: string
}

export interface PrepDayPlan {
  recommendedDaysInAdvance: number
  tasks: PrepDayTask[]
  notRecommended: PrepDayUnsafe[]
  safetyDisclaimer: string
}

export type PlanStatus = 'idle' | 'loading' | 'error'

export interface Filters {
  course: string
  maxMins: number
  search: string
  protein: string
}

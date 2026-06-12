export interface IngredientOut {
  id: string
  name: string
  category: string
  default_unit: string | null
}

export interface StepIngredientDraft {
  ingredient_name: string
  ingredient_category: string
  quantity: number | null
  unit: string | null
  prep_note: string | null
}

export interface StepIngredientOut {
  id: string
  ingredient_id: string
  ingredient: IngredientOut
  quantity: number | null
  unit: string | null
  prep_note: string | null
}

export interface RecipeStepDraft {
  step_number: number
  instruction: string
  cooking_method: string | null
  step_type: string
  can_cook_ahead: boolean
  ingredients: StepIngredientDraft[]
}

export interface RecipeStepOut {
  id: string
  step_number: number
  instruction: string
  cooking_method: string | null
  step_type: string
  can_cook_ahead: boolean
  step_ingredients: StepIngredientOut[]
}

export interface RecipeDraft {
  name: string
  servings: number
  cuisine: string | null
  source: string
  source_url: string | null
  prep_time_mins: number | null
  cook_time_mins: number | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  make_ahead_type: string
  storage_days: number | null
  reheat_instructions: string | null
  steps: RecipeStepDraft[]
}

export interface RecipeSummary {
  id: string
  name: string
  servings: number
  cuisine: string | null
  source: string
  source_url: string | null
  prep_time_mins: number | null
  cook_time_mins: number | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  make_ahead_type: string
  storage_days: number | null
  created_at: string
}

export interface RecipeOut {
  id: string
  name: string
  servings: number
  cuisine: string | null
  source: string
  source_url: string | null
  prep_time_mins: number | null
  cook_time_mins: number | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  make_ahead_type: string
  storage_days: number | null
  reheat_instructions: string | null
  created_at: string
  steps: RecipeStepOut[]
}

export interface MealPlanSlotCreate {
  day_of_week: number
  meal_type: string
  recipe_id: string
  servings_override: number | null
  is_anchor: boolean
}

export interface MealPlanSlotOut {
  id: string
  day_of_week: number
  meal_type: string
  recipe_id: string
  recipe: RecipeSummary | null
  servings_override: number | null
  is_anchor: boolean
}

export interface MealPlanCreate {
  name: string
  week_start: string
}

export interface MealPlanSummary {
  id: string
  name: string
  week_start: string
  created_at: string
}

export interface MealPlanOut {
  id: string
  name: string
  week_start: string
  created_at: string
  slots: MealPlanSlotOut[]
}

export interface OverlapItem {
  ingredient: string
  recipe_count: number
  recipe_names: string[]
}

export interface AISuggestResponse {
  suggested_recipe_ids: string[]
  overlap_summary: OverlapItem[]
}

export interface ContainerPortion {
  container: string
  amount: string
  recipe_name: string
  day: string
}

export interface RawPrepTask {
  ingredient: string
  prep_note: string | null
  total_quantity: string
  portions: ContainerPortion[]
}

export interface CookAheadStep {
  step_number: number
  instruction: string
  ingredients: { name: string; quantity: string; prep_note: string | null }[]
}

export interface CookAheadRecipe {
  recipe_name: string
  container: string
  day: string
  servings: number
  storage_days: number | null
  reheat_instructions: string | null
  steps: CookAheadStep[]
}

export interface PrepGuide {
  raw_prep: RawPrepTask[]
  cook_ahead: CookAheadRecipe[]
}

export interface GroceryItem {
  name: string
  total: string
  used_in: string[]
  category: string
}

export type GroceryList = Record<string, GroceryItem[]>

export interface ContainerNeeded {
  container: string
  contents: string
}

export interface TodayResponse {
  has_plan: boolean
  has_recipe?: boolean
  plan_id?: string
  plan_name?: string
  message?: string
  recipe?: {
    id: string
    name: string
    servings: number
    cuisine: string | null
    cook_time_mins: number | null
    make_ahead_type: string
    reheat_instructions: string | null
    storage_days: number | null
  }
  visible_steps?: {
    step_number: number
    instruction: string
    step_type: string
    can_cook_ahead: boolean
    ingredients: { name: string; quantity: string; prep_note: string | null }[]
  }[]
  hidden_summary?: string | null
  containers_needed?: ContainerNeeded[]
}

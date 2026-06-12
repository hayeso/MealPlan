import { create } from 'zustand'
import type { Recipe, SessionRecipe, BatchPlan, PrepDayPlan, PlanStatus, Filters } from '../types/recipe'

const STORAGE_KEY_SESSION = 'mealplan-session'
const STORAGE_KEY_PLAN = 'mealplan-plan'
const STORAGE_KEY_PREP_DAY = 'mealplan-prep-day-plan'
const STORAGE_KEY_COMPLETED = 'mealplan-completed-steps'

function loadSession(): SessionRecipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function loadPlan(): BatchPlan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLAN)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function loadPrepDayPlan(): PrepDayPlan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREP_DAY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function loadCompleted(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPLETED)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

interface Store {
  recipes: Recipe[]
  setRecipes: (recipes: Recipe[]) => void

  filters: Filters
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void
  resetFilters: () => void

  session: SessionRecipe[]
  addToSession: (recipeId: string, targetServings: number) => void
  removeFromSession: (recipeId: string) => void
  updateServings: (recipeId: string, targetServings: number) => void
  clearSession: () => void

  plan: BatchPlan | null
  planStatus: PlanStatus
  planError: string | null
  setPlan: (plan: BatchPlan) => void
  setPlanStatus: (status: PlanStatus, error?: string) => void
  clearPlan: () => void

  prepDayPlan: PrepDayPlan | null
  prepDayStatus: PlanStatus
  prepDayError: string | null
  setPrepDayPlan: (plan: PrepDayPlan) => void
  setPrepDayStatus: (status: PlanStatus, error?: string) => void
  clearPrepDayPlan: () => void

  cookingMode: boolean
  setCookingMode: (active: boolean) => void
  completedSteps: number[]
  toggleStep: (stepIndex: number) => void
  resetSteps: () => void
}

const defaultFilters: Filters = {
  course: '',
  maxMins: 0,
  search: '',
  protein: '',
}

export const useStore = create<Store>((set, get) => ({
  recipes: [],
  setRecipes: (recipes) => set({ recipes }),

  filters: { ...defaultFilters },
  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),

  session: loadSession(),
  addToSession: (recipeId, targetServings) => {
    const session = [...get().session]
    if (session.some(s => s.recipeId === recipeId)) return
    if (session.length >= 5) return
    session.push({ recipeId, targetServings })
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session))
    set({ session })
  },
  removeFromSession: (recipeId) => {
    const session = get().session.filter(s => s.recipeId !== recipeId)
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session))
    set({ session })
  },
  updateServings: (recipeId, targetServings) => {
    const session = get().session.map(s =>
      s.recipeId === recipeId ? { ...s, targetServings } : s
    )
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session))
    set({ session })
  },
  clearSession: () => {
    localStorage.removeItem(STORAGE_KEY_SESSION)
    set({ session: [] })
  },

  plan: loadPlan(),
  planStatus: 'idle',
  planError: null,
  setPlan: (plan) => {
    localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(plan))
    set({ plan, planStatus: 'idle', planError: null })
  },
  setPlanStatus: (planStatus, error) => set({ planStatus, planError: error ?? null }),
  clearPlan: () => {
    localStorage.removeItem(STORAGE_KEY_PLAN)
    localStorage.removeItem(STORAGE_KEY_COMPLETED)
    set({ plan: null, planStatus: 'idle', planError: null, completedSteps: [], cookingMode: false })
  },

  prepDayPlan: loadPrepDayPlan(),
  prepDayStatus: 'idle',
  prepDayError: null,
  setPrepDayPlan: (prepDayPlan) => {
    localStorage.setItem(STORAGE_KEY_PREP_DAY, JSON.stringify(prepDayPlan))
    set({ prepDayPlan, prepDayStatus: 'idle', prepDayError: null })
  },
  setPrepDayStatus: (prepDayStatus, error) => set({ prepDayStatus, prepDayError: error ?? null }),
  clearPrepDayPlan: () => {
    localStorage.removeItem(STORAGE_KEY_PREP_DAY)
    set({ prepDayPlan: null, prepDayStatus: 'idle', prepDayError: null })
  },

  cookingMode: false,
  setCookingMode: (cookingMode) => set({ cookingMode }),
  completedSteps: loadCompleted(),
  toggleStep: (stepIndex) => {
    const steps = [...get().completedSteps]
    const idx = steps.indexOf(stepIndex)
    if (idx >= 0) steps.splice(idx, 1)
    else steps.push(stepIndex)
    localStorage.setItem(STORAGE_KEY_COMPLETED, JSON.stringify(steps))
    set({ completedSteps: steps })
  },
  resetSteps: () => {
    localStorage.removeItem(STORAGE_KEY_COMPLETED)
    set({ completedSteps: [] })
  },
}))

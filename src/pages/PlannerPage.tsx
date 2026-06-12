import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { formatMacroRow, scaleMacros, sumMacros } from '../utils/macros'
import type {
  RecipeSummary,
  MealPlanOut,
  MealPlanSummary,
  MealPlanSlotOut,
  AISuggestResponse,
  OverlapItem,
} from '../types/api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export default function PlannerPage() {
  const [plans, setPlans] = useState<MealPlanSummary[]>([])
  const [activePlan, setActivePlan] = useState<MealPlanOut | null>(null)
  const [recipes, setRecipes] = useState<RecipeSummary[]>([])
  const [overlap, setOverlap] = useState<OverlapItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerDay, setPickerDay] = useState<number | null>(null)
  const [anchorId, setAnchorId] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData(planId?: string) {
    setLoading(true)
    try {
      const [planList, recipeList] = await Promise.all([
        api.get<MealPlanSummary[]>('/meal-plans'),
        api.get<RecipeSummary[]>('/recipes'),
      ])
      setPlans(planList)
      setRecipes(recipeList)
      if (planList.length > 0) {
        const targetId = planId ?? planList[0].id
        const full = await api.get<MealPlanOut>(`/meal-plans/${targetId}`)
        setActivePlan(full)
        const anchor = full.slots.find(s => s.is_anchor)
        setAnchorId(anchor?.recipe_id ?? null)
      } else {
        setActivePlan(null)
        setAnchorId(null)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  async function switchPlan(planId: string) {
    const full = await api.get<MealPlanOut>(`/meal-plans/${planId}`)
    setActivePlan(full)
    const anchor = full.slots.find(s => s.is_anchor)
    setAnchorId(anchor?.recipe_id ?? null)
    setOverlap([])
  }

  async function createPlan() {
    const today = new Date()
    const day = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
    const weekStart = monday.toISOString().slice(0, 10)

    const plan = await api.post<MealPlanOut>('/meal-plans', {
      name: `Week of ${monday.toLocaleDateString('en-GB', { month: 'long', day: 'numeric' })}`,
      week_start: weekStart,
    })
    setActivePlan(plan)
    setPlans(prev => [
      { id: plan.id, name: plan.name, week_start: plan.week_start, created_at: plan.created_at },
      ...prev,
    ])
    setAnchorId(null)
    setOverlap([])
  }

  async function assignRecipe(
    recipeId: string,
    dayOfWeek: number,
    opts?: { isAnchor?: boolean; servingsOverride?: number | null },
  ) {
    if (!activePlan) return
    const existing = getSlotForDay(dayOfWeek)
    await api.put<MealPlanSlotOut>(`/meal-plans/${activePlan.id}/slots`, {
      day_of_week: dayOfWeek,
      meal_type: 'dinner',
      recipe_id: recipeId,
      servings_override: opts?.servingsOverride ?? existing?.servings_override ?? null,
      is_anchor: opts?.isAnchor ?? existing?.is_anchor ?? false,
    })
    const full = await api.get<MealPlanOut>(`/meal-plans/${activePlan.id}`)
    setActivePlan(full)
    setPickerDay(null)
    if (opts?.isAnchor) setAnchorId(recipeId)
  }

  async function updateServings(dayOfWeek: number, servings: number) {
    if (!activePlan) return
    const slot = getSlotForDay(dayOfWeek)
    if (!slot?.recipe) return
    await api.put<MealPlanSlotOut>(`/meal-plans/${activePlan.id}/slots`, {
      day_of_week: dayOfWeek,
      meal_type: 'dinner',
      recipe_id: slot.recipe_id,
      servings_override: servings,
      is_anchor: slot.is_anchor,
    })
    const full = await api.get<MealPlanOut>(`/meal-plans/${activePlan.id}`)
    setActivePlan(full)
  }

  async function removeSlot(slotId: string) {
    if (!activePlan) return
    await api.delete(`/meal-plans/${activePlan.id}/slots/${slotId}`)
    const full = await api.get<MealPlanOut>(`/meal-plans/${activePlan.id}`)
    setActivePlan(full)
    if (!full.slots.some(s => s.is_anchor)) setAnchorId(null)
  }

  async function aiSuggest() {
    if (!activePlan || !anchorId) return
    setSuggesting(true)
    try {
      const res = await api.post<AISuggestResponse>(`/meal-plans/${activePlan.id}/ai-suggest`, {
        anchor_recipe_id: anchorId,
        num_suggestions: 4,
      })
      setOverlap(res.overlap_summary)
      const usedDays = new Set(activePlan.slots.map(s => s.day_of_week))
      let nextDay = 0
      for (const rid of res.suggested_recipe_ids) {
        while (usedDays.has(nextDay) && nextDay < 5) nextDay++
        if (nextDay >= 5) break
        await assignRecipe(rid, nextDay)
        usedDays.add(nextDay)
        nextDay++
      }
      const full = await api.get<MealPlanOut>(`/meal-plans/${activePlan.id}`)
      setActivePlan(full)
    } catch {
      /* ignore */
    } finally {
      setSuggesting(false)
    }
  }

  function getSlotForDay(day: number): MealPlanSlotOut | undefined {
    return activePlan?.slots.find(s => s.day_of_week === day && s.meal_type === 'dinner')
  }

  const nutrition = useMemo(() => {
    if (!activePlan) return null
    const scaled = activePlan.slots
      .filter(s => s.recipe)
      .map(s => {
        const servings = s.servings_override ?? s.recipe!.servings
        return scaleMacros(s.recipe!, servings)
      })
    if (scaled.length === 0) return null
    const total = sumMacros(scaled)
    const dailyAvg = {
      ...total,
      calories: total.calories != null ? Math.round(total.calories / scaled.length) : null,
      protein_g: total.protein_g != null ? Math.round(total.protein_g / scaled.length) : null,
      carbs_g: total.carbs_g != null ? Math.round(total.carbs_g / scaled.length) : null,
      fat_g: total.fat_g != null ? Math.round(total.fat_g / scaled.length) : null,
    }
    return { total, dailyAvg, count: scaled.length }
  }, [activePlan])

  const storageWarnings = useMemo(() => {
    if (!activePlan) return []
    return activePlan.slots
      .filter(s => s.recipe?.make_ahead_type === 'full' && s.recipe.storage_days != null)
      .filter(s => s.day_of_week >= (s.recipe!.storage_days ?? 0))
      .map(s => ({
        day: DAYS[s.day_of_week],
        recipe: s.recipe!.name,
        storageDays: s.recipe!.storage_days!,
      }))
  }, [activePlan])

  if (loading) return <div className="text-center py-10 text-muted">Loading...</div>

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl text-text">Weekly Planner</h1>
          {nutrition && (
            <p className="text-sm text-muted mt-1">
              Daily avg: {formatMacroRow(nutrition.dailyAvg)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!activePlan && (
            <button
              type="button"
              onClick={createPlan}
              className="min-h-[44px] px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-hover text-sm font-medium"
            >
              + New Plan
            </button>
          )}
          {activePlan && (
            <>
              <button
                type="button"
                onClick={aiSuggest}
                disabled={!anchorId || suggesting}
                className="min-h-[44px] px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-hover text-sm font-medium disabled:opacity-50"
              >
                {suggesting ? 'Suggesting...' : 'AI Suggest'}
              </button>
              <Link
                to={`/planner/${activePlan.id}/grocery`}
                className="min-h-[44px] px-4 py-2 border border-border rounded-xl hover:bg-surface text-sm flex items-center"
              >
                Grocery List
              </Link>
              <Link
                to={`/planner/${activePlan.id}/prep`}
                className="min-h-[44px] px-4 py-2 border border-border rounded-xl hover:bg-surface text-sm flex items-center"
              >
                Prep Guide
              </Link>
            </>
          )}
        </div>
      </div>

      {plans.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Plan:</span>
          {plans.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => switchPlan(p.id)}
              className={`min-h-[36px] px-3 py-1.5 text-sm rounded-lg border transition ${
                activePlan?.id === p.id
                  ? 'bg-accent/10 border-accent text-accent font-medium'
                  : 'border-border text-muted hover:bg-surface'
              }`}
            >
              {p.name}
            </button>
          ))}
          <button
            type="button"
            onClick={createPlan}
            className="min-h-[36px] px-3 py-1.5 text-sm rounded-lg border border-dashed border-border text-muted hover:text-accent hover:border-accent"
          >
            + New
          </button>
        </div>
      )}

      {!activePlan ? (
        <div className="text-center py-16 bg-surface-elevated rounded-2xl border border-border">
          <p className="text-muted mb-4">No meal plan yet. Create one to start planning your week!</p>
          <button
            type="button"
            onClick={createPlan}
            className="min-h-[44px] px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover font-medium"
          >
            Create Plan
          </button>
        </div>
      ) : (
        <>
          {!anchorId && (
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 mb-6">
              <p className="text-sm text-text font-medium mb-2">
                Pick your anchor recipe — the one meal you definitely want this week:
              </p>
              <div className="flex flex-wrap gap-2">
                {recipes.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => assignRecipe(r.id, 0, { isAnchor: true })}
                    className="min-h-[44px] px-3 py-2 text-sm bg-surface-elevated border border-border rounded-lg hover:border-accent"
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {storageWarnings.length > 0 && (
            <div className="bg-warning-bg border border-warning/30 rounded-xl p-4 mb-6">
              <p className="text-sm font-semibold text-warning mb-2">Storage warnings</p>
              <ul className="text-sm text-text space-y-1">
                {storageWarnings.map(w => (
                  <li key={w.day}>
                    <strong>{w.recipe}</strong> on {w.day} may exceed its {w.storageDays}-day fridge
                    life (prep assumed Sunday).
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {DAYS.map((dayName, dayIdx) => {
              const slot = getSlotForDay(dayIdx)
              const recipe = slot?.recipe
              const makeAhead = recipe?.make_ahead_type
              const servings = slot?.servings_override ?? recipe?.servings

              return (
                <div
                  key={dayIdx}
                  className="border border-border rounded-xl bg-surface-elevated min-h-[200px] flex flex-col shadow-sm"
                >
                  <div className="px-3 py-2 border-b border-border text-sm font-semibold text-text">
                    {dayName}
                  </div>
                  <div className="flex-1 p-3">
                    {recipe ? (
                      <div className="space-y-2">
                        <h4 className="font-display text-base line-clamp-2">{recipe.name}</h4>
                        <div className="flex flex-wrap gap-1">
                          {slot?.is_anchor && (
                            <span className="text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded">
                              Anchor
                            </span>
                          )}
                          {makeAhead === 'full' && (
                            <span className="text-xs px-1.5 py-0.5 bg-success-bg text-success rounded">
                              Cook Ahead
                            </span>
                          )}
                          {makeAhead === 'partial' && (
                            <span className="text-xs px-1.5 py-0.5 bg-warning-bg text-warning rounded">
                              Partial
                            </span>
                          )}
                          {recipe.cook_time_mins != null && (
                            <span className="text-xs text-muted">{recipe.cook_time_mins}m</span>
                          )}
                        </div>
                        <label className="flex items-center gap-2 text-xs text-muted">
                          Serves
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={servings ?? recipe.servings}
                            onChange={e => {
                              const v = parseInt(e.target.value, 10)
                              if (v > 0) updateServings(dayIdx, v)
                            }}
                            className="w-14 px-2 py-1 border border-border rounded text-text bg-surface text-sm min-h-[36px]"
                          />
                        </label>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setPickerDay(dayIdx)}
                            className="text-xs text-accent hover:underline min-h-[36px]"
                          >
                            Swap
                          </button>
                          <button
                            type="button"
                            onClick={() => slot && removeSlot(slot.id)}
                            className="text-xs text-danger hover:underline min-h-[36px]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPickerDay(dayIdx)}
                        className="w-full h-full min-h-[120px] flex items-center justify-center border-2 border-dashed border-border rounded-lg text-muted hover:text-accent hover:border-accent transition text-3xl"
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {nutrition && (
            <div className="bg-surface border border-border rounded-xl p-4 mb-6 text-sm">
              <span className="font-medium text-text">Week totals: </span>
              <span className="text-muted">{formatMacroRow(nutrition.total)}</span>
              <span className="text-muted ml-2">({nutrition.count} meals)</span>
            </div>
          )}

          {overlap.length > 0 && (
            <div className="bg-success-bg border border-success/30 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-success mb-2">Vegetable Overlap</h3>
              <div className="flex flex-wrap gap-2">
                {overlap.map(o => (
                  <span
                    key={o.ingredient}
                    className="text-xs px-2 py-1 bg-surface-elevated text-success rounded-full border border-success/20"
                  >
                    {o.ingredient} — {o.recipe_count} meals
                  </span>
                ))}
              </div>
            </div>
          )}

          {pickerDay !== null && (
            <div
              className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
              onClick={() => setPickerDay(null)}
            >
              <div
                className="bg-surface-elevated rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-auto"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="font-display text-xl mb-4">Pick a recipe for {DAYS[pickerDay]}</h3>
                <div className="space-y-2">
                  {recipes.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => assignRecipe(r.id, pickerDay)}
                      className="w-full text-left p-3 border border-border rounded-xl hover:border-accent transition min-h-[44px]"
                    >
                      <div className="font-medium text-sm">{r.name}</div>
                      <div className="text-xs text-muted">
                        {r.cuisine} · {r.cook_time_mins ?? '?'}m · Serves {r.servings}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

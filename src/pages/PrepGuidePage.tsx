import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useSessionStorageSet } from '../hooks/useSessionStorage'
import type { MealPlanOut, PrepGuide } from '../types/api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export default function PrepGuidePage() {
  const { planId } = useParams<{ planId: string }>()
  const [guide, setGuide] = useState<PrepGuide | null>(null)
  const [plan, setPlan] = useState<MealPlanOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  const storageKey = planId ? `prep-tasks:${planId}` : null
  const { value: completedTasks, toggle: toggleTask } = useSessionStorageSet(storageKey)

  useEffect(() => {
    if (!planId) return
    setLoading(true)
    Promise.all([
      api.get<PrepGuide>(`/meal-plans/${planId}/prep-guide`),
      api.get<MealPlanOut>(`/meal-plans/${planId}`),
    ])
      .then(([g, p]) => {
        setGuide(g)
        setPlan(p)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [planId])

  function toggleCollapse(index: number) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })
  }

  if (loading) return <div className="text-center py-10 text-muted">Generating prep guide...</div>
  if (!guide) return <div className="text-center py-10 text-muted">No prep guide available.</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link to="/planner" className="text-sm text-muted hover:text-text">
        ← Back to Planner
      </Link>
      <h1 className="font-display text-3xl mt-2 mb-6 text-text">Sunday Prep Guide</h1>

      {guide.container_warnings && guide.container_warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2">
            Storage notes
          </h3>
          <ul className="text-sm text-text space-y-1 list-disc list-inside">
            {guide.container_warnings.map((w, i) => (
              <li key={w.item_id ?? i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {guide.container_summaries && guide.container_summaries.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-text">Your Containers</h2>
            <span className="text-xs text-muted px-2 py-1 rounded-full bg-surface border border-border">
              {guide.container_strategy === 'ai' ? 'AI optimised' : 'Grouped by cook phase'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {guide.container_summaries.map(summary => (
              <div
                key={summary.container}
                className="rounded-xl border border-border bg-surface-elevated p-4"
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-bold">
                    {summary.container}
                  </span>
                  <span className="text-sm font-medium text-text">{summary.description}</span>
                  {summary.prep_phase && (
                    <span className="text-xs text-muted px-2 py-0.5 rounded-full bg-surface border border-border">
                      {summary.prep_phase}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mb-2">
                  {summary.day} · {summary.recipe_name}
                </p>
                <p className="text-sm text-text">{summary.ingredients.join(', ')}</p>
                {summary.storage_rationale && (
                  <p className="text-xs text-muted mt-2 italic">{summary.storage_rationale}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {plan && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {DAYS.map((dayName, idx) => {
            const slot = plan.slots.find(s => s.day_of_week === idx && s.meal_type === 'dinner')
            const recipe = slot?.recipe
            const inBatch = recipe
              ? guide.raw_prep.some(t => t.portions.some(p => p.recipe_name === recipe.name))
              : false
            const inCook = recipe
              ? guide.cook_ahead.some(c => c.recipe_name === recipe.name)
              : false
            return (
              <div
                key={dayName}
                className="rounded-xl border border-border bg-surface-elevated p-3 text-sm"
              >
                <div className="font-medium text-text">{dayName}</div>
                {recipe ? (
                  <>
                    <div className="text-muted line-clamp-2 mt-1">{recipe.name}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {inBatch && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-success-bg text-success">
                          Batch
                        </span>
                      )}
                      {inCook && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-warning-bg text-warning">
                          Cook ahead
                        </span>
                      )}
                      {!inBatch && !inCook && (
                        <span className="text-xs text-muted">Cook fresh</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-muted mt-1">Empty</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {guide.raw_prep.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-success bg-success-bg px-4 py-3 rounded-t-xl">
            Section 1 — Batch Prep
          </h2>
          <div className="border border-border border-t-0 rounded-b-xl divide-y divide-border">
            {guide.raw_prep.map((task, i) => {
              const key = `raw-${i}`
              const done = completedTasks.has(key)
              return (
                <div
                  key={key}
                  className={`p-4 ${done ? 'opacity-50 bg-surface' : 'bg-surface-elevated'}`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleTask(key)}
                      className={`w-8 h-8 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 min-h-[44px] min-w-[44px] ${
                        done ? 'bg-success border-success text-white' : 'border-border'
                      }`}
                    >
                      {done && <span className="text-sm">✓</span>}
                    </button>
                    <div className="flex-1">
                      <div className={`font-bold text-text ${done ? 'line-through' : ''}`}>
                        {task.ingredient}
                        {task.prep_note && (
                          <span className="font-normal text-muted"> — {task.prep_note}</span>
                        )}
                        <span className="font-normal text-muted ml-2">({task.total_quantity} total)</span>
                      </div>
                      <div className="mt-3 ml-2 space-y-2 border-l-2 border-border pl-3">
                        {task.portions.map((p, pi) => (
                          <div key={pi} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">
                              {p.container}
                            </span>
                            <span className="text-text">{p.amount}</span>
                            <span className="text-muted">
                              · {p.recipe_name} · {p.day}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {guide.cook_ahead.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-warning bg-warning-bg px-4 py-3 rounded-t-xl">
            Section 2 — Cook Ahead
          </h2>
          <div className="border border-border border-t-0 rounded-b-xl divide-y divide-border">
            {guide.cook_ahead.map((recipe, ri) => {
              const isCollapsed = collapsed.has(ri)
              return (
                <div key={ri} className="p-4 bg-surface-elevated">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(ri)}
                    className="w-full flex items-center gap-2 mb-3 text-left min-h-[44px]"
                  >
                    <span className="text-muted">{isCollapsed ? '▶' : '▼'}</span>
                    <h3 className="font-display text-lg text-text">{recipe.recipe_name}</h3>
                    <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">
                      {recipe.container}
                    </span>
                    <span className="text-xs text-muted">for {recipe.day}</span>
                  </button>

                  {!isCollapsed && (
                    <>
                      <div className="space-y-3 mb-3">
                        {recipe.steps.map((step, si) => {
                          const key = `cook-${ri}-${si}`
                          const done = completedTasks.has(key)
                          return (
                            <div key={key} className={`flex gap-3 ${done ? 'opacity-50' : ''}`}>
                              <button
                                type="button"
                                onClick={() => toggleTask(key)}
                                className={`w-8 h-8 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 min-h-[44px] min-w-[44px] ${
                                  done ? 'bg-accent border-accent text-white' : 'border-border'
                                }`}
                              >
                                {done && <span className="text-sm">✓</span>}
                              </button>
                              <div>
                                <p className={`text-sm text-text ${done ? 'line-through' : ''}`}>
                                  {step.instruction}
                                </p>
                                {step.ingredients.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {step.ingredients.map((ing, ii) => (
                                      <span
                                        key={ii}
                                        className="text-xs px-2 py-0.5 bg-surface text-muted rounded-full"
                                      >
                                        {ing.quantity && <span className="font-medium">{ing.quantity} </span>}
                                        {ing.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="bg-surface rounded-xl p-3 text-sm space-y-1 border border-border">
                        <div className="text-text">
                          Store in <strong>{recipe.container}</strong> · Serves {recipe.servings}
                        </div>
                        {recipe.storage_days != null && (
                          <div className="text-muted">Keeps {recipe.storage_days} days in fridge</div>
                        )}
                        {recipe.reheat_instructions && (
                          <div className="text-muted">Reheat: {recipe.reheat_instructions}</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

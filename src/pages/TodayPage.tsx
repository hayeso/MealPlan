import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useSessionStorageNumbers } from '../hooks/useSessionStorage'
import type { TodayResponse } from '../types/api'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export default function TodayPage() {
  const [data, setData] = useState<TodayResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const progressKey = useMemo(
    () => (data?.plan_id ? `today-progress:${data.plan_id}:${todayKey()}` : null),
    [data?.plan_id],
  )
  const { value: completedSteps, toggle: toggleStep } = useSessionStorageNumbers(progressKey)

  useEffect(() => {
    setLoading(true)
    api
      .get<TodayResponse>('/today')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-center py-20 text-muted text-lg">Loading tonight&apos;s meal...</div>
  }

  if (!data || !data.has_plan) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-text mb-4">No Active Plan</h1>
        <p className="text-muted mb-6">Create a meal plan to see what you&apos;re cooking tonight.</p>
        <Link
          to="/planner"
          className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover font-medium"
        >
          Go to Planner
        </Link>
      </div>
    )
  }

  if (!data.has_recipe || !data.recipe) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-text mb-4">Nothing planned for today</h1>
        <p className="text-muted mb-6">{data.message}</p>
        <Link
          to="/planner"
          className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover font-medium"
        >
          Check Planner
        </Link>
      </div>
    )
  }

  const { recipe, visible_steps = [], hidden_summary, containers_needed = [] } = data
  const isFullReheat = recipe.make_ahead_type === 'full'
  const totalSteps = visible_steps.length
  const doneSteps = visible_steps.filter(s => completedSteps.has(s.step_number)).length
  const allDone =
  (isFullReheat && containers_needed.length === 0) ||
  (totalSteps > 0 && doneSteps === totalSteps) ||
  (totalSteps === 0 && isFullReheat)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-sm text-muted mb-1">Tonight&apos;s Dinner</p>
        <h1 className="font-display text-4xl text-text mb-2">{recipe.name}</h1>
        <div className="flex flex-wrap gap-3 text-sm text-muted">
          {recipe.cuisine && <span>{recipe.cuisine}</span>}
          {recipe.cook_time_mins != null && <span>{recipe.cook_time_mins} mins</span>}
          <span>Serves {recipe.servings}</span>
        </div>
      </div>

      {containers_needed.length > 0 && (
        <div className="bg-warning-bg border border-warning/30 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-warning mb-1">Before you start</p>
          <p className="text-text">
            Take out{' '}
            {containers_needed.map((c, i) => (
              <span key={c.container}>
                {i > 0 && (i === containers_needed.length - 1 ? ' and ' : ', ')}
                <strong>{c.container}</strong>
                {c.contents && ` (${c.contents})`}
              </span>
            ))}{' '}
            from the fridge.
          </p>
        </div>
      )}

      {hidden_summary && (
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 mb-6 text-sm text-text">
          {hidden_summary}
        </div>
      )}

      {isFullReheat && recipe.reheat_instructions && (
        <div className="bg-surface-elevated border border-border rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-text mb-3">Reheat Instructions</h2>
          <p className="text-text text-lg leading-relaxed">{recipe.reheat_instructions}</p>
          {recipe.storage_days != null && (
            <p className="text-sm text-muted mt-3">
              This dish keeps for {recipe.storage_days} days in the fridge.
            </p>
          )}
        </div>
      )}

      {totalSteps > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-muted mb-1">
            <span>Progress</span>
            <span>
              {doneSteps}/{totalSteps} steps
            </span>
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full transition-all"
              style={{ width: `${(doneSteps / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      )}

      {visible_steps.length > 0 && (
        <div className="space-y-3">
          {visible_steps.map(step => {
            const done = completedSteps.has(step.step_number)
            return (
              <button
                key={step.step_number}
                type="button"
                onClick={() => toggleStep(step.step_number)}
                className={`w-full text-left p-5 min-h-[56px] rounded-xl border transition shadow-sm ${
                  done
                    ? 'bg-success-bg border-success/30 opacity-70'
                    : 'bg-surface-elevated border-border hover:border-accent/40'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                      done ? 'bg-success border-success text-white' : 'border-accent text-accent'
                    }`}
                  >
                    {done ? '✓' : step.step_number}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-base leading-relaxed ${
                        done ? 'line-through text-muted' : 'text-text'
                      }`}
                    >
                      {step.instruction}
                    </p>
                    {step.ingredients.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {step.ingredients.map((ing, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-surface text-muted rounded-full"
                          >
                            {ing.quantity && `${ing.quantity} `}
                            {ing.name}
                            {ing.prep_note && ` (${ing.prep_note})`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {allDone && (
        <div className="mt-8 bg-success-bg border border-success/30 rounded-xl p-8 text-center">
          <h2 className="font-display text-2xl text-success mb-2">Dinner is ready!</h2>
          <p className="text-text">Enjoy your meal.</p>
        </div>
      )}
    </div>
  )
}

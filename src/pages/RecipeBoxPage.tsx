import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import ReviewDraft from '../components/Import/ReviewDraft'
import { formatMacroRow } from '../utils/macros'
import type { RecipeSummary, RecipeOut, RecipeDraft, MealPlanOut } from '../types/api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const MAKE_AHEAD_BADGES: Record<string, { label: string; className: string }> = {
  none: { label: 'Cook Fresh', className: 'bg-success-bg text-success' },
  partial: { label: 'Partial', className: 'bg-warning-bg text-warning' },
  full: { label: 'Cook Ahead', className: 'bg-accent/10 text-accent' },
}

function SourceBadge({ source, sourceUrl }: { source: string; sourceUrl: string | null }) {
  const isUrl = source.startsWith('URL') || source === 'URL'
  const label = isUrl ? 'URL' : source
  const className =
    'text-xs px-2 py-0.5 rounded-full bg-surface text-muted border border-border'

  if (isUrl && sourceUrl) {
    return (
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className={`${className} hover:text-accent hover:border-accent`}
      >
        {label} ↗
      </a>
    )
  }
  return <span className={className}>{label}</span>
}

export default function RecipeBoxPage() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([])
  const [search, setSearch] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [selected, setSelected] = useState<RecipeOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function loadRecipes() {
    setLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (cuisine) params.set('cuisine', cuisine)
      const data = await api.get<RecipeSummary[]>(`/recipes?${params}`)
      setRecipes(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not load recipes'
      setLoadError(msg)
      setRecipes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecipes()
  }, [search, cuisine])

  async function openRecipe(id: string) {
    const data = await api.get<RecipeOut>(`/recipes/${id}`)
    setSelected(data)
  }

  async function deleteRecipe(id: string) {
    let warning = 'Are you sure you want to delete this recipe?'
    try {
      const plans = await api.get<{ id: string }[]>('/meal-plans')
      if (plans.length > 0) {
        const plan = await api.get<MealPlanOut>(`/meal-plans/${plans[0].id}`)
        const slots = plan.slots.filter(s => s.recipe_id === id)
        if (slots.length > 0) {
          const days = slots.map(s => DAYS[s.day_of_week] ?? `Day ${s.day_of_week}`).join(', ')
          warning = `This recipe is used in your current week plan. Deleting it will remove it from ${days}. Continue?`
        }
      }
    } catch {
      /* use default warning */
    }
    if (!confirm(warning)) return
    await api.delete(`/recipes/${id}`)
    setSelected(null)
    loadRecipes()
  }

  const cuisines = [...new Set(recipes.map(r => r.cuisine).filter(Boolean))] as string[]

  if (selected) {
    return (
      <RecipeDetail
        recipe={selected}
        onBack={() => {
          setSelected(null)
          loadRecipes()
        }}
        onDelete={deleteRecipe}
      />
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl text-text">Recipe Box</h1>
        <div className="flex gap-2">
          <Link
            to="/import"
            className="min-h-[44px] px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-hover text-sm font-medium flex items-center"
          >
            + Import Recipe
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or ingredient..."
          className="flex-1 px-4 py-3 min-h-[44px] border border-border rounded-xl bg-surface-elevated text-text"
        />
        <select
          value={cuisine}
          onChange={e => setCuisine(e.target.value)}
          className="px-3 py-3 min-h-[44px] border border-border rounded-xl bg-surface-elevated text-text"
        >
          <option value="">All Cuisines</option>
          {cuisines.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-warning/30 bg-warning-bg p-6 text-center">
          <p className="font-medium text-warning mb-2">Couldn&apos;t load recipes</p>
          <p className="text-sm text-text mb-4">{loadError}</p>
          <button
            type="button"
            onClick={() => loadRecipes()}
            className="min-h-[44px] px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-hover text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="text-center py-10 text-muted">Loading recipes...</div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-16 bg-surface-elevated rounded-2xl border border-border">
          <p className="text-muted mb-4">No recipes yet. Import your first recipe to get started!</p>
          <Link
            to="/import"
            className="inline-flex min-h-[44px] px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover font-medium items-center"
          >
            Import a Recipe
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map(r => {
            const badge = MAKE_AHEAD_BADGES[r.make_ahead_type] || MAKE_AHEAD_BADGES.none
            const macros = formatMacroRow(r)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => openRecipe(r.id)}
                className="relative text-left border border-border rounded-xl p-4 hover:shadow-md transition bg-surface-elevated min-h-[140px]"
              >
                {r.make_ahead_type !== 'none' && (
                  <span
                    className={`absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                )}
                <h3 className="font-display text-lg text-text mb-2 line-clamp-2 pr-16">{r.name}</h3>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <SourceBadge source={r.source} sourceUrl={r.source_url} />
                  {r.cuisine && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-muted">
                      {r.cuisine}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted flex flex-wrap gap-3">
                  {r.prep_time_mins != null && <span>Prep: {r.prep_time_mins}m</span>}
                  {r.cook_time_mins != null && <span>Cook: {r.cook_time_mins}m</span>}
                  <span>Serves {r.servings}</span>
                </div>
                {macros && <p className="text-xs text-muted mt-2">{macros}</p>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RecipeDetail({
  recipe,
  onBack,
  onDelete,
}: {
  recipe: RecipeOut
  onBack: () => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState<RecipeDraft | null>(null)
  const [saving, setSaving] = useState(false)

  function startEdit() {
    const draft: RecipeDraft = {
      name: recipe.name,
      servings: recipe.servings,
      cuisine: recipe.cuisine,
      source: recipe.source,
      source_url: recipe.source_url,
      prep_time_mins: recipe.prep_time_mins,
      cook_time_mins: recipe.cook_time_mins,
      calories: recipe.calories,
      protein_g: recipe.protein_g,
      carbs_g: recipe.carbs_g,
      fat_g: recipe.fat_g,
      make_ahead_type: recipe.make_ahead_type,
      storage_days: recipe.storage_days,
      reheat_instructions: recipe.reheat_instructions,
      steps: recipe.steps.map(s => ({
        step_number: s.step_number,
        instruction: s.instruction,
        cooking_method: s.cooking_method,
        step_type: s.step_type,
        can_cook_ahead: s.can_cook_ahead,
        ingredients: s.step_ingredients.map(si => ({
          ingredient_name: si.ingredient.name,
          ingredient_category: si.ingredient.category,
          quantity: si.quantity,
          unit: si.unit,
          prep_note: si.prep_note,
        })),
      })),
    }
    setEditDraft(draft)
    setEditing(true)
  }

  async function saveEdit(draft: RecipeDraft) {
    setSaving(true)
    try {
      await api.put(`/recipes/${recipe.id}`, draft)
      setEditing(false)
      onBack()
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
  }

  if (editing && editDraft) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="font-display text-2xl mb-4">Edit Recipe</h1>
        <ReviewDraft
          draft={editDraft}
          onConfirm={saveEdit}
          onCancel={() => setEditing(false)}
          loading={saving}
        />
      </div>
    )
  }

  const badge = MAKE_AHEAD_BADGES[recipe.make_ahead_type] || MAKE_AHEAD_BADGES.none
  const macros = formatMacroRow(recipe)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <button type="button" onClick={onBack} className="text-sm text-muted hover:text-text mb-4 min-h-[44px]">
        ← Back to Recipe Box
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="font-display text-3xl text-text">{recipe.name}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <SourceBadge source={recipe.source} sourceUrl={recipe.source_url} />
            <span className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>
            {recipe.cuisine && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-muted">{recipe.cuisine}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={startEdit}
            className="min-h-[44px] px-3 py-1.5 text-sm border border-border rounded-xl hover:bg-surface"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(recipe.id)}
            className="min-h-[44px] px-3 py-1.5 text-sm border border-danger/30 text-danger rounded-xl hover:bg-danger/10"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-muted mb-2">
        {recipe.prep_time_mins != null && <span>Prep: {recipe.prep_time_mins} mins</span>}
        {recipe.cook_time_mins != null && <span>Cook: {recipe.cook_time_mins} mins</span>}
        <span>Serves {recipe.servings}</span>
      </div>
      {macros && <p className="text-sm text-muted mb-6">{macros}</p>}

      {recipe.make_ahead_type !== 'none' && (
        <div className="bg-warning-bg border border-warning/30 rounded-xl p-3 mb-6 text-sm text-text">
          <strong>Make-Ahead:</strong>{' '}
          {recipe.make_ahead_type === 'full' ? 'Cook entire dish on Sunday' : 'Some components cooked ahead'}
          {recipe.storage_days != null && <span> · Keeps {recipe.storage_days} days</span>}
          {recipe.reheat_instructions && (
            <div className="mt-1 text-muted">Reheat: {recipe.reheat_instructions}</div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {recipe.steps.map(step => (
          <div key={step.id} className="bg-surface-elevated border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-accent">Step {step.step_number}</span>
              <span className="text-xs bg-surface px-2 py-0.5 rounded text-muted">{step.step_type}</span>
            </div>
            <p className="text-text mb-2">{step.instruction}</p>
            {step.step_ingredients.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {step.step_ingredients.map(si => (
                  <span key={si.id} className="text-xs px-2 py-1 bg-surface text-muted rounded-full">
                    {si.quantity != null && <span className="font-medium">{si.quantity} {si.unit} </span>}
                    {si.ingredient.name}
                    {si.prep_note && <span> ({si.prep_note})</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

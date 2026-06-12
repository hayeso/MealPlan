import { useState } from 'react'
import type { RecipeDraft, RecipeStepDraft, StepIngredientDraft } from '../../types/api'

interface Props {
  draft: RecipeDraft
  onConfirm: (edited: RecipeDraft) => void
  onCancel: () => void
  loading: boolean
}

const MAKE_AHEAD_OPTIONS = [
  { value: 'none', label: 'Cook Fresh', desc: 'Cooked from scratch on the day' },
  { value: 'partial', label: 'Partial', desc: 'Some components cooked ahead' },
  { value: 'full', label: 'Full Cook-Ahead', desc: 'Entire dish cooked on Sunday' },
]

export default function ReviewDraft({ draft, onConfirm, onCancel, loading }: Props) {
  const [edited, setEdited] = useState<RecipeDraft>({ ...draft })

  function updateField<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    setEdited(prev => ({ ...prev, [key]: value }))
  }

  function updateStep(idx: number, updates: Partial<RecipeStepDraft>) {
    setEdited(prev => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === idx ? { ...s, ...updates } : s)),
    }))
  }

  function updateStepIngredient(stepIdx: number, ingIdx: number, updates: Partial<StepIngredientDraft>) {
    setEdited(prev => ({
      ...prev,
      steps: prev.steps.map((s, si) =>
        si === stepIdx
          ? { ...s, ingredients: s.ingredients.map((ing, ii) => (ii === ingIdx ? { ...ing, ...updates } : ing)) }
          : s
      ),
    }))
  }

  function removeStepIngredient(stepIdx: number, ingIdx: number) {
    setEdited(prev => ({
      ...prev,
      steps: prev.steps.map((s, si) =>
        si === stepIdx ? { ...s, ingredients: s.ingredients.filter((_, ii) => ii !== ingIdx) } : s
      ),
    }))
  }

  function addStepIngredient(stepIdx: number) {
    setEdited(prev => ({
      ...prev,
      steps: prev.steps.map((s, si) =>
        si === stepIdx
          ? {
              ...s,
              ingredients: [
                ...s.ingredients,
                { ingredient_name: '', ingredient_category: 'Pantry', quantity: null, unit: null, prep_note: null },
              ],
            }
          : s
      ),
    }))
  }

  function moveStep(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= edited.steps.length) return
    const steps = [...edited.steps]
    ;[steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]]
    steps.forEach((s, i) => (s.step_number = i + 1))
    setEdited(prev => ({ ...prev, steps }))
  }

  return (
    <div className="space-y-6">
      {/* Recipe metadata */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Name</label>
          <input
            value={edited.name}
            onChange={e => updateField('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Servings</label>
          <input
            type="number"
            value={edited.servings}
            onChange={e => updateField('servings', parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cuisine</label>
          <input
            value={edited.cuisine || ''}
            onChange={e => updateField('cuisine', e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prep Time (mins)</label>
          <input
            type="number"
            value={edited.prep_time_mins ?? ''}
            onChange={e => updateField('prep_time_mins', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cook Time (mins)</label>
          <input
            type="number"
            value={edited.cook_time_mins ?? ''}
            onChange={e => updateField('cook_time_mins', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {/* Make-ahead classification */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Make-Ahead Type</label>
        <div className="grid grid-cols-3 gap-2">
          {MAKE_AHEAD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => updateField('make_ahead_type', opt.value)}
              className={`p-3 rounded-lg border text-left transition ${
                edited.make_ahead_type === opt.value
                  ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {edited.make_ahead_type !== 'none' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Storage Days</label>
            <input
              type="number"
              value={edited.storage_days ?? ''}
              onChange={e => updateField('storage_days', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Reheat Instructions</label>
            <textarea
              value={edited.reheat_instructions || ''}
              onChange={e => updateField('reheat_instructions', e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
            />
          </div>
        </div>
      )}

      {/* Steps */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Steps</h3>
        <div className="space-y-4">
          {edited.steps.map((step, si) => (
            <div key={si} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded">
                  Step {step.step_number}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{step.step_type}</span>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => moveStep(si, -1)} className="text-xs text-gray-400 hover:text-gray-600 px-1">
                    ↑
                  </button>
                  <button onClick={() => moveStep(si, 1)} className="text-xs text-gray-400 hover:text-gray-600 px-1">
                    ↓
                  </button>
                </div>
              </div>
              <textarea
                value={step.instruction}
                onChange={e => updateStep(si, { instruction: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={2}
              />
              <div className="flex gap-2 mt-2">
                <select
                  value={step.step_type}
                  onChange={e => updateStep(si, { step_type: e.target.value })}
                  className="text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value="raw_prep">Raw Prep</option>
                  <option value="cook_ahead">Cook Ahead</option>
                  <option value="cook_fresh">Cook Fresh</option>
                  <option value="reheat">Reheat</option>
                  <option value="combine">Combine</option>
                </select>
                <label className="flex items-center gap-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={step.can_cook_ahead}
                    onChange={e => updateStep(si, { can_cook_ahead: e.target.checked })}
                  />
                  Can cook ahead
                </label>
              </div>

              {/* Step ingredients */}
              {step.ingredients.length > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="text-xs font-medium text-gray-500">Ingredients in this step:</div>
                  {step.ingredients.map((ing, ii) => (
                    <div key={ii} className="flex gap-2 items-center text-sm">
                      <input
                        value={ing.quantity ?? ''}
                        onChange={e =>
                          updateStepIngredient(si, ii, { quantity: e.target.value ? parseFloat(e.target.value) : null })
                        }
                        placeholder="Qty"
                        className="w-16 px-2 py-1 border border-gray-200 rounded text-xs"
                      />
                      <input
                        value={ing.unit || ''}
                        onChange={e => updateStepIngredient(si, ii, { unit: e.target.value || null })}
                        placeholder="Unit"
                        className="w-16 px-2 py-1 border border-gray-200 rounded text-xs"
                      />
                      <input
                        value={ing.ingredient_name}
                        onChange={e => updateStepIngredient(si, ii, { ingredient_name: e.target.value })}
                        placeholder="Ingredient"
                        className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs"
                      />
                      <input
                        value={ing.prep_note || ''}
                        onChange={e => updateStepIngredient(si, ii, { prep_note: e.target.value || null })}
                        placeholder="Prep"
                        className="w-20 px-2 py-1 border border-gray-200 rounded text-xs"
                      />
                      <button
                        onClick={() => removeStepIngredient(si, ii)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => addStepIngredient(si)} className="mt-2 text-xs text-orange-600 hover:text-orange-700">
                + Add ingredient
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={() => onConfirm(edited)}
          disabled={loading || !edited.name.trim()}
          className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Confirm & Save'}
        </button>
        <button onClick={onCancel} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  )
}

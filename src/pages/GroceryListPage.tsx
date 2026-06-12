import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useSessionStorageSet } from '../hooks/useSessionStorage'
import type { GroceryList } from '../types/api'

const CATEGORY_ORDER = ['Produce', 'Protein', 'Dairy', 'Pantry', 'Spices']

export default function GroceryListPage() {
  const { planId } = useParams<{ planId: string }>()
  const [list, setList] = useState<GroceryList>({})
  const [loading, setLoading] = useState(true)

  const storageKey = planId ? `grocery-checked:${planId}` : null
  const { value: checked, toggle, reset } = useSessionStorageSet(storageKey)

  useEffect(() => {
    if (!planId) return
    setLoading(true)
    api
      .get<GroceryList>(`/meal-plans/${planId}/grocery-list`)
      .then(setList)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [planId])

  async function copyAsText() {
    try {
      const resp = await fetch(`http://localhost:8000/meal-plans/${planId}/grocery-list?format=text`)
      const text = await resp.text()
      await navigator.clipboard.writeText(text)
      alert('Copied to clipboard!')
    } catch {
      alert('Failed to copy')
    }
  }

  if (loading) return <div className="text-center py-10 text-muted">Loading grocery list...</div>

  const categories = CATEGORY_ORDER.filter(c => list[c]?.length > 0)
  const totalItems = Object.values(list).flat().length
  const checkedCount = checked.size

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link to="/planner" className="text-sm text-muted hover:text-text">
            ← Back to Planner
          </Link>
          <h1 className="font-display text-3xl mt-1 text-text">Grocery List</h1>
          <p className="text-sm text-muted">
            {checkedCount} of {totalItems} items
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyAsText}
            className="min-h-[44px] px-3 py-2 text-sm border border-border rounded-xl hover:bg-surface"
          >
            Copy as Text
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[44px] px-3 py-2 text-sm border border-border rounded-xl hover:bg-surface"
          >
            Print
          </button>
          <button
            type="button"
            onClick={reset}
            className="min-h-[44px] px-3 py-2 text-sm text-muted hover:text-text"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {categories.map(cat => (
          <div key={cat}>
            <h2 className="text-sm font-bold text-text uppercase tracking-wide mb-2">{cat}</h2>
            <div className="space-y-2">
              {list[cat].map(item => {
                const isChecked = checked.has(item.name)
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => toggle(item.name)}
                    className={`w-full flex items-center gap-3 px-4 py-4 min-h-[56px] rounded-xl text-left transition ${
                      isChecked
                        ? 'bg-surface opacity-60'
                        : 'bg-surface-elevated border border-border hover:border-accent/40'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isChecked ? 'bg-accent border-accent text-white' : 'border-border'
                      }`}
                    >
                      {isChecked && <span className="text-xs">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm font-medium ${isChecked ? 'line-through text-muted' : 'text-text'}`}
                      >
                        {item.name}
                      </span>
                      <span className="text-sm text-muted ml-2">{item.total}</span>
                    </div>
                    <div className="text-xs text-muted hidden sm:block truncate max-w-[120px]">
                      {item.used_in.join(', ')}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

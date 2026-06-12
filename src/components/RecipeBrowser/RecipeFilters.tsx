import { useStore } from '../../store/useStore'

const COURSES = ['Main Dish', 'Side Dish', 'Brunch', 'Breakfast', 'Dessert', 'Snack']
const PROTEINS = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'vegetarian', 'eggs']
const TIME_OPTIONS = [
  { label: 'Any time', value: 0 },
  { label: '< 30 min', value: 30 },
  { label: '< 45 min', value: 45 },
  { label: '< 60 min', value: 60 },
  { label: '< 90 min', value: 90 },
]

export default function RecipeFilters() {
  const filters = useStore(s => s.filters)
  const setFilter = useStore(s => s.setFilter)
  const resetFilters = useStore(s => s.resetFilters)

  const hasFilters = filters.course || filters.maxMins || filters.search || filters.protein

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Search ingredients or name</label>
          <input
            type="text"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            placeholder="e.g. red cabbage, chicken..."
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>

        <div className="min-w-[140px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Course</label>
          <select
            value={filters.course}
            onChange={e => setFilter('course', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">All courses</option>
            {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="min-w-[120px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Protein</label>
          <select
            value={filters.protein}
            onChange={e => setFilter('protein', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">Any protein</option>
            {PROTEINS.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[130px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Max time</label>
          <select
            value={filters.maxMins}
            onChange={e => setFilter('maxMins', Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            {TIME_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={resetFilters}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}

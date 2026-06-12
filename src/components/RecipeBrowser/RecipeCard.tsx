import type { Recipe } from '../../types/recipe'
import { useStore } from '../../store/useStore'

interface Props {
  recipe: Recipe
  onView: (recipe: Recipe) => void
}

const COURSE_COLORS: Record<string, string> = {
  'Main Dish': 'bg-orange-100 text-orange-800',
  'Side Dish': 'bg-green-100 text-green-800',
  'Brunch': 'bg-yellow-100 text-yellow-800',
  'Dessert': 'bg-pink-100 text-pink-800',
  'Breakfast': 'bg-blue-100 text-blue-800',
  'Snack': 'bg-purple-100 text-purple-800',
}

function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bAl\b/g, 'al')
    .replace(/\bWith\b/g, 'with')
    .replace(/\bAnd\b/g, 'and')
    .replace(/\bThe\b/g, 'the')
    .replace(/\bDe\b/g, 'de')
    .replace(/^./, c => c.toUpperCase())
}

export default function RecipeCard({ recipe, onView }: Props) {
  const session = useStore(s => s.session)
  const addToSession = useStore(s => s.addToSession)
  const removeFromSession = useStore(s => s.removeFromSession)

  const inSession = session.some(s => s.recipeId === recipe.id)
  const sessionFull = session.length >= 5

  const totalIngredients = recipe.ingredientGroups.reduce(
    (sum, g) => sum + g.ingredients.length, 0
  )

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm transition hover:shadow-md cursor-pointer ${
        inSession ? 'ring-2 ring-orange-400 border-orange-300' : 'border-gray-200'
      }`}
      onClick={() => onView(recipe)}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-semibold text-gray-900 leading-snug">
            {titleCase(recipe.name)}
          </h3>
          <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
            COURSE_COLORS[recipe.course] || 'bg-gray-100 text-gray-700'
          }`}>
            {recipe.course}
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
          {recipe.totalMins > 0 && (
            <span className="flex items-center gap-1">
              <ClockIcon />
              {recipe.totalMins} min
            </span>
          )}
          <span className="flex items-center gap-1">
            <ServingsIcon />
            {recipe.servings} servings
          </span>
          <span className="text-gray-400">
            {totalIngredients} ingredients
          </span>
        </div>

        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {recipe.tags.slice(0, 4).map(tag => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={e => {
            e.stopPropagation()
            if (inSession) removeFromSession(recipe.id)
            else if (!sessionFull) addToSession(recipe.id, recipe.servings)
          }}
          disabled={!inSession && sessionFull}
          className={`w-full mt-1 py-2 rounded-lg text-sm font-medium transition ${
            inSession
              ? 'bg-orange-50 text-orange-700 hover:bg-orange-100'
              : sessionFull
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-orange-500 text-white hover:bg-orange-600'
          }`}
        >
          {inSession ? '- Remove from Session' : sessionFull ? 'Session Full (5)' : '+ Add to Session'}
        </button>
      </div>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  )
}

function ServingsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

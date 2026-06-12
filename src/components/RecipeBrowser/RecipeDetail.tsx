import type { Recipe } from '../../types/recipe'
import { useStore } from '../../store/useStore'

interface Props {
  recipe: Recipe
  onClose: () => void
}

function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bAl\b/g, 'al')
    .replace(/\bWith\b/g, 'with')
    .replace(/\bAnd\b/g, 'and')
    .replace(/\bThe\b/g, 'the')
    .replace(/^./, c => c.toUpperCase())
}

export default function RecipeDetail({ recipe, onClose }: Props) {
  const session = useStore(s => s.session)
  const addToSession = useStore(s => s.addToSession)
  const removeFromSession = useStore(s => s.removeFromSession)
  const inSession = session.some(s => s.recipeId === recipe.id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-xl font-bold text-gray-900">{titleCase(recipe.name)}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
            <span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full font-medium">
              {recipe.course}
            </span>
            {recipe.totalMins > 0 && (
              <span>Prep {recipe.prepMins}m + Cook {recipe.cookMins}m = {recipe.totalMins}m</span>
            )}
            <span>Serves {recipe.servings}</span>
          </div>

          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-6">
              {recipe.tags.map(tag => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h3 className="font-semibold text-gray-800 mb-3">Ingredients</h3>
          {recipe.ingredientGroups.map((group, gi) => (
            <div key={gi} className="mb-4">
              {group.groupName && (
                <h4 className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1.5">
                  {group.groupName}
                </h4>
              )}
              <ul className="space-y-1">
                {group.ingredients.map((ing, ii) => (
                  <li key={ii} className="text-sm text-gray-700 pl-3 border-l-2 border-gray-100">
                    {ing.raw}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <h3 className="font-semibold text-gray-800 mb-3 mt-6">Directions</h3>
          <ol className="space-y-3">
            {recipe.directions.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-8 pt-4 border-t border-gray-100">
            <button
              onClick={() => {
                if (inSession) removeFromSession(recipe.id)
                else addToSession(recipe.id, recipe.servings)
              }}
              className={`w-full py-3 rounded-xl font-medium transition ${
                inSession
                  ? 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {inSession ? 'Remove from Session' : 'Add to Batch Session'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

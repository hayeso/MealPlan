import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { scaleRecipe } from '../../utils/scaleIngredients'
import { generateBatchPlan } from '../../api/claude'
import { normaliseIngredientName } from '../../data/synonyms'

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

export default function SessionBuilder() {
  const recipes = useStore(s => s.recipes)
  const session = useStore(s => s.session)
  const removeFromSession = useStore(s => s.removeFromSession)
  const updateServings = useStore(s => s.updateServings)
  const planStatus = useStore(s => s.planStatus)
  const setPlan = useStore(s => s.setPlan)
  const setPlanStatus = useStore(s => s.setPlanStatus)
  const navigate = useNavigate()

  const sessionRecipes = session
    .map(s => {
      const recipe = recipes.find(r => r.id === s.recipeId)
      return recipe ? { recipe, targetServings: s.targetServings } : null
    })
    .filter((x): x is { recipe: typeof recipes[number]; targetServings: number } => x !== null)

  const totalTimeSeparate = sessionRecipes.reduce(
    (sum, { recipe }) => sum + recipe.totalMins, 0
  )

  const uniqueIngredients = new Set<string>()
  sessionRecipes.forEach(({ recipe }) => {
    recipe.ingredientGroups.forEach(g => {
      g.ingredients.forEach(ing => {
        uniqueIngredients.add(normaliseIngredientName(ing.item))
      })
    })
  })

  const planError = useStore(s => s.planError)

  const handleGenerate = async () => {
    setPlanStatus('loading')
    try {
      const scaled = sessionRecipes.map(({ recipe, targetServings }) =>
        scaleRecipe(recipe, targetServings)
      )
      const plan = await generateBatchPlan(scaled)
      setPlan(plan)
      navigate('/plan')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('Plan generation failed:', msg)
      setPlanStatus('error', msg)
    }
  }

  if (session.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">No recipes selected</h2>
        <p className="text-gray-500 mb-6">Go back and add 2–5 recipes to your batch session.</p>
        <button
          onClick={() => navigate('/')}
          className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-orange-600 transition"
        >
          Browse Recipes
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to recipes
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Batch Session</h1>
      <p className="text-sm text-gray-500 mb-8">
        Adjust serving sizes, then generate your batch cooking plan.
      </p>

      <div className="space-y-4 mb-8">
        {sessionRecipes.map(({ recipe, targetServings }, i) => (
          <div
            key={recipe.id}
            className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-5"
          >
            <div className="shrink-0 w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-lg">
              {'ABCDE'[i]}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {titleCase(recipe.name)}
              </h3>
              <p className="text-sm text-gray-500">
                {recipe.totalMins > 0 ? `${recipe.totalMins} min` : 'Time N/A'}
                {' · '}
                Original: {recipe.servings} servings
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Servings</label>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => updateServings(recipe.id, Math.max(1, targetServings - 1))}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition"
                >
                  -
                </button>
                <span className="px-3 py-1.5 font-medium text-gray-900 min-w-[2rem] text-center border-x border-gray-300">
                  {targetServings}
                </span>
                <button
                  onClick={() => updateServings(recipe.id, Math.min(20, targetServings + 1))}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={() => removeFromSession(recipe.id)}
              className="shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 rounded-xl p-5 mb-8">
        <h3 className="font-semibold text-gray-800 mb-3">Session Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Recipes</p>
            <p className="text-lg font-bold text-gray-900">{sessionRecipes.length}</p>
          </div>
          <div>
            <p className="text-gray-500">Unique Ingredients</p>
            <p className="text-lg font-bold text-gray-900">{uniqueIngredients.size}</p>
          </div>
          <div>
            <p className="text-gray-500">Time (sequential)</p>
            <p className="text-lg font-bold text-gray-900">
              {totalTimeSeparate > 0 ? `${totalTimeSeparate} min` : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {planStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 text-sm font-medium">
            Failed to generate the batch plan.
          </p>
          {planError && (
            <p className="text-red-600 text-xs mt-1 font-mono break-all">
              {planError}
            </p>
          )}
          <button
            onClick={() => setPlanStatus('idle')}
            className="mt-2 text-xs text-red-600 underline hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={session.length < 2 || planStatus === 'loading'}
        className={`w-full py-4 rounded-xl font-semibold text-lg transition shadow-sm ${
          planStatus === 'loading'
            ? 'bg-orange-300 text-white cursor-wait'
            : session.length < 2
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-orange-500 text-white hover:bg-orange-600'
        }`}
      >
        {planStatus === 'loading' ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating plan...
          </span>
        ) : session.length < 2 ? (
          'Add at least 2 recipes'
        ) : (
          `Generate Batch Plan (${sessionRecipes.length} recipes)`
        )}
      </button>
    </div>
  )
}

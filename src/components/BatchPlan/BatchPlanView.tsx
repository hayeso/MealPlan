import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { scaleRecipe } from '../../utils/scaleIngredients'
import { generatePrepDayPlan } from '../../api/claude'
import PrepPhase from './PrepPhase'
import CookingPhase from './CookingPhase'
import ShoppingList from './ShoppingList'
import PrepDayView from './PrepDayView'

type Tab = 'prep-day' | 'cook-day' | 'shopping'

export default function BatchPlanView() {
  const plan = useStore(s => s.plan)
  const clearPlan = useStore(s => s.clearPlan)
  const setCookingMode = useStore(s => s.setCookingMode)
  const resetSteps = useStore(s => s.resetSteps)

  const prepDayPlan = useStore(s => s.prepDayPlan)
  const prepDayStatus = useStore(s => s.prepDayStatus)
  const prepDayError = useStore(s => s.prepDayError)
  const setPrepDayPlan = useStore(s => s.setPrepDayPlan)
  const setPrepDayStatus = useStore(s => s.setPrepDayStatus)
  const clearPrepDayPlan = useStore(s => s.clearPrepDayPlan)

  const session = useStore(s => s.session)
  const recipes = useStore(s => s.recipes)

  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('cook-day')

  if (!plan) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">No plan generated yet</h2>
        <p className="text-gray-500 mb-6">Select recipes and generate a batch cooking plan first.</p>
        <button
          onClick={() => navigate('/session')}
          className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-orange-600 transition"
        >
          Go to Session
        </button>
      </div>
    )
  }

  const handleGeneratePrepDay = async () => {
    setPrepDayStatus('loading')
    try {
      const scaledRecipes = session
        .map(s => {
          const recipe = recipes.find(r => r.id === s.recipeId)
          return recipe ? scaleRecipe(recipe, s.targetServings) : null
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)

      const result = await generatePrepDayPlan(scaledRecipes)
      setPrepDayPlan(result)
      setActiveTab('prep-day')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('Prep day generation failed:', msg)
      setPrepDayStatus('error', msg)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'prep-day', label: 'Prep Day' },
    { id: 'cook-day', label: 'Cook Day' },
    { id: 'shopping', label: 'Shopping List' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/session')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to session
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Batch Cooking Plan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Estimated cook day time:{' '}
            <span className="font-semibold text-gray-700">{plan.estimatedTotalTime} minutes</span>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              resetSteps()
              setCookingMode(true)
              navigate('/plan/cook')
            }}
            className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-orange-600 transition shadow-sm"
          >
            Start Cooking
          </button>
          <button
            onClick={() => { clearPlan(); clearPrepDayPlan(); navigate('/session') }}
            className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-xl transition"
          >
            New Plan
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.id === 'prep-day' && prepDayPlan && (
              <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Ready</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'prep-day' && (
        <div>
          {prepDayPlan ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">
                  Pre-portion and prepare these items before your cook day.
                </p>
                <button
                  onClick={() => { clearPrepDayPlan(); setPrepDayStatus('idle') }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition"
                >
                  Regenerate
                </button>
              </div>
              <PrepDayView plan={prepDayPlan} />
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Plan your prep day</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                Find out what vegetables, marinades, and portions you can safely prepare 1–3 days before your cook day.
              </p>

              {prepDayStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left max-w-md mx-auto">
                  <p className="text-red-700 text-sm font-medium">Failed to generate prep day plan.</p>
                  {prepDayError && (
                    <p className="text-red-600 text-xs mt-1 font-mono break-all">{prepDayError}</p>
                  )}
                </div>
              )}

              <button
                onClick={handleGeneratePrepDay}
                disabled={prepDayStatus === 'loading'}
                className={`px-6 py-3 rounded-xl font-medium transition ${
                  prepDayStatus === 'loading'
                    ? 'bg-blue-300 text-white cursor-wait'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {prepDayStatus === 'loading' ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating prep day plan...
                  </span>
                ) : (
                  'Generate Prep Day Plan'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'cook-day' && (
        <div className="space-y-10">
          <PrepPhase tasks={plan.prepPhase} />
          <CookingPhase steps={plan.cookingPhase} />
        </div>
      )}

      {activeTab === 'shopping' && (
        <ShoppingList items={plan.shoppingList} />
      )}
    </div>
  )
}

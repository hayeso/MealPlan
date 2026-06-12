import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import type { Recipe } from '../../types/recipe'
import RecipeCard from './RecipeCard'
import RecipeFilters from './RecipeFilters'
import RecipeDetail from './RecipeDetail'

export default function RecipeBrowser() {
  const recipes = useStore(s => s.recipes)
  const filters = useStore(s => s.filters)
  const session = useStore(s => s.session)
  const navigate = useNavigate()
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)

  const filtered = useMemo(() => {
    let result = recipes

    if (filters.course) {
      result = result.filter(r => r.course === filters.course)
    }

    if (filters.maxMins > 0) {
      result = result.filter(r => r.totalMins > 0 && r.totalMins <= filters.maxMins)
    }

    if (filters.protein) {
      result = result.filter(r => r.tags.includes(filters.protein))
    }

    if (filters.search) {
      const terms = filters.search.toLowerCase().split(/\s+/).filter(Boolean)
      result = result.filter(r => {
        const haystack = [
          r.name,
          ...r.tags,
          ...r.ingredientGroups.flatMap(g => g.ingredients.map(i => i.item)),
          ...r.ingredientGroups.flatMap(g => g.ingredients.map(i => i.raw)),
        ].join(' ').toLowerCase()
        return terms.every(t => haystack.includes(t))
      })
    }

    return result
  }, [recipes, filters])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Recipes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} of {recipes.length} recipes
            {session.length > 0 && (
              <span className="ml-2 text-orange-600 font-medium">
                · {session.length} in batch session
              </span>
            )}
          </p>
        </div>

        {session.length >= 2 && (
          <button
            onClick={() => navigate('/session')}
            className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-orange-600 transition shadow-sm"
          >
            Build Session ({session.length})
          </button>
        )}
      </div>

      <RecipeFilters />

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No recipes match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onView={setSelectedRecipe}
            />
          ))}
        </div>
      )}

      {selectedRecipe && (
        <RecipeDetail
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </div>
  )
}

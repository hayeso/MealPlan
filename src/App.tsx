import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useTheme } from './context/ThemeContext'
import { useAuth } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import TodayPage from './pages/TodayPage'
import RecipeBoxPage from './pages/RecipeBoxPage'
import ImportPage from './pages/ImportPage'
import PlannerPage from './pages/PlannerPage'
import GroceryListPage from './pages/GroceryListPage'
import PrepGuidePage from './pages/PrepGuidePage'

function NavBar() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const { user, signOut } = useAuth()

  const navItems = [
    { to: '/', label: 'Today' },
    { to: '/recipes', label: 'Recipes' },
    { to: '/import', label: 'Import' },
    { to: '/planner', label: 'Planner' },
  ]

  return (
    <nav className="bg-surface-elevated border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-4">
        <Link to="/" className="font-display text-xl text-accent mr-4 tracking-tight shrink-0">
          MealPlan
        </Link>
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap min-h-[44px] flex items-center ${
                location.pathname === item.to ||
                (item.to === '/planner' && location.pathname.startsWith('/planner'))
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:bg-surface hover:text-text'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="shrink-0 w-11 h-11 rounded-lg border border-border text-muted hover:text-text hover:bg-surface flex items-center justify-center"
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        {user && (
          <div className="flex items-center gap-2 shrink-0">
            {user.picture ? (
              <img src={user.picture} alt="" className="w-8 h-8 rounded-full" />
            ) : null}
            <button
              type="button"
              onClick={signOut}
              className="px-3 py-2 rounded-lg text-sm text-muted hover:text-text hover:bg-surface min-h-[44px]"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-bg">
        <NavBar />
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/recipes" element={<RecipeBoxPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/planner/:planId/grocery" element={<GroceryListPage />} />
          <Route path="/planner/:planId/prep" element={<PrepGuidePage />} />
        </Routes>
      </div>
    </RequireAuth>
  )
}

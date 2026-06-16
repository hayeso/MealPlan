import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const TOKEN_KEY = 'mealplan-auth-token'
const USER_KEY = 'mealplan-auth-user'

export type AuthUser = {
  email: string
  name?: string | null
  picture?: string | null
}

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  loading: boolean
  signIn: (credential: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? 'http://localhost:8000' : '')

async function exchangeGoogleCredential(credential: string) {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || 'Sign-in failed')
  }
  return res.json() as Promise<{ access_token: string; user: AuthUser }>
}

async function fetchCurrentUser(token: string) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json() as Promise<AuthUser>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function restoreSession() {
      if (!token) {
        setLoading(false)
        return
      }
      const me = await fetchCurrentUser(token)
      if (cancelled) return
      if (!me) {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setToken(null)
        setUser(null)
      } else {
        setUser(me)
        localStorage.setItem(USER_KEY, JSON.stringify(me))
      }
      setLoading(false)
    }
    void restoreSession()
    return () => {
      cancelled = true
    }
  }, [token])

  const signIn = useCallback(async (credential: string) => {
    const data = await exchangeGoogleCredential(credential)
    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    setToken(data.access_token)
    setUser(data.user)
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, token, loading, signIn, signOut }),
    [user, token, loading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function getStoredAuthToken() {
  return localStorage.getItem(TOKEN_KEY)
}

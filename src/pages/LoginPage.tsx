import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

function parseAuthError(message: string) {
  try {
    const parsed = JSON.parse(message) as { detail?: string }
    return parsed.detail ?? message
  } catch {
    return message.replace(/^API \d+: /, '')
  }
}

export default function LoginPage() {
  const { signIn } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  if (!clientId) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface-elevated border border-border rounded-2xl p-8 shadow-sm">
          <h1 className="font-display text-3xl text-text mb-2">MealPlan</h1>
          <p className="text-muted text-sm">
            Google sign-in is not configured. Set <code className="text-accent">VITE_GOOGLE_CLIENT_ID</code> in your
            environment.
          </p>
        </div>
      </div>
    )
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface-elevated border border-border rounded-2xl p-8 shadow-sm">
          <h1 className="font-display text-3xl text-text mb-2">MealPlan</h1>
          <p className="text-muted mb-8">
            Sign in with your Google account to access your meal prep planner.
          </p>

          {error && (
            <div className="mb-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={async cred => {
                if (!cred.credential) {
                  setError('Google did not return a sign-in token.')
                  return
                }
                setError(null)
                try {
                  await signIn(cred.credential)
                } catch (err) {
                  setError(parseAuthError(err instanceof Error ? err.message : 'Sign-in failed'))
                }
              }}
              onError={() => setError('Google sign-in was cancelled or failed.')}
              useOneTap={false}
              theme="outline"
              size="large"
              shape="pill"
              text="signin_with"
            />
          </div>

          <p className="text-xs text-muted text-center mt-8">
            Access is restricted to the authorized account owner.
          </p>
        </div>
      </div>
    </GoogleOAuthProvider>
  )
}

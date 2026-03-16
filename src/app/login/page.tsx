'use client'

import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') ?? '/'

  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setLoading(true)

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, from }),
        })

        if (!res.ok) {
          setError('Incorrect password')
          return
        }

        const { redirectTo } = await res.json()
        router.push(redirectTo)
      } catch {
        setError('Something went wrong. Try again.')
      } finally {
        setLoading(false)
      }
    },
    [password, from, router],
  )

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--brand-bg)] px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-8 text-center">
          Dictator
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="w-full px-4 py-3 rounded-xl bg-[var(--brand-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--brand-color)] text-base"
          />

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-xl bg-[var(--brand-color)] text-white font-medium text-base active:opacity-80 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

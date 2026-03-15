'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SESSION_RECOVERY_KEY } from '@/lib/constants'

interface SessionRecoveryState {
  sessionId: string
  status: string
  startedAt: string
}

export default function RecoveryPage() {
  const router = useRouter()
  const [recoveryState, setRecoveryState] = useState<SessionRecoveryState | null>(null)
  const [parseWarning, setParseWarning] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_RECOVERY_KEY)

    if (!stored) {
      router.replace('/')
      return
    }

    try {
      const parsed = JSON.parse(stored) as SessionRecoveryState
      if (!parsed.sessionId) {
        router.replace('/')
        return
      }
      setRecoveryState(parsed)
    } catch {
      // JSON parse failed — show warning but still offer Resume if we can extract a sessionId
      setParseWarning(true)
      // Try to extract sessionId via regex as best effort
      const match = stored.match(/"sessionId"\s*:\s*"([^"]+)"/)
      if (match?.[1]) {
        setRecoveryState({ sessionId: match[1], status: 'unknown', startedAt: '' })
      } else {
        router.replace('/')
        return
      }
    }

    setLoaded(true)
  }, [router])

  function handleResume() {
    if (!recoveryState) return
    router.push(`/active?sessionId=${recoveryState.sessionId}`)
  }

  function handleStartFresh() {
    if (recoveryState?.sessionId) {
      // Best-effort end the old session — fire and forget
      fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: recoveryState.sessionId, durationSeconds: 0 }),
      }).catch(() => {
        // Ignore errors — this is best effort
      })
    }

    localStorage.removeItem(SESSION_RECOVERY_KEY)
    router.replace('/')
  }

  if (!loaded) {
    return null
  }

  const startedAtLabel = recoveryState?.startedAt
    ? new Date(recoveryState.startedAt).toLocaleTimeString()
    : null

  return (
    <main className="h-full flex flex-col items-center justify-center bg-[var(--brand-bg)] px-6">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center">
          Session in progress
        </h1>

        {startedAtLabel && (
          <p className="text-[var(--text-muted)] text-center">
            Session started at {startedAtLabel}
          </p>
        )}

        {parseWarning && (
          <p className="text-amber-400 text-sm text-center">
            Some of this session may be missing
          </p>
        )}

        <button
          className="w-full min-h-[56px] px-10 rounded-full bg-[var(--brand-color)] text-white text-lg font-semibold hover:opacity-90 active:opacity-80 transition-opacity"
          onClick={handleResume}
        >
          Resume session
        </button>

        <button
          className="w-full min-h-[56px] px-10 rounded-full border border-[var(--text-muted)] text-[var(--text-muted)] text-lg font-semibold hover:opacity-90 active:opacity-80 transition-opacity"
          onClick={handleStartFresh}
        >
          Start fresh
        </button>
      </div>
    </main>
  )
}

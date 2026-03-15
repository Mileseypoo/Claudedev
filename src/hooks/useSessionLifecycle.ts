import { useState, useEffect, useRef, useCallback } from 'react'
import { SESSION_RECOVERY_KEY } from '@/lib/constants'

export type SessionState = 'idle' | 'active' | 'paused' | 'ended' | 'interrupted'

interface LifecycleState {
  status: SessionState
  sessionId: string | null
  startedAt: Date | null
  elapsedSeconds: number
}

interface UseSessionLifecycleReturn {
  status: SessionState
  sessionId: string | null
  elapsedSeconds: number
  start: (consentTimestamp: string) => Promise<string>
  pause: () => Promise<void>
  resume: () => Promise<void>
  end: () => Promise<void>
  interrupt: () => void
  restore: (sessionId: string) => void
}

/**
 * Session lifecycle state machine hook.
 *
 * State transitions:
 *   idle → [start()] → active → [pause()] → paused → [resume()] → active
 *   active/paused → [end()] → ended
 *   active → [interrupt()] → interrupted (visibilityGuard onHide)
 *
 * localStorage: written on every state transition, cleared on clean end.
 */
export function useSessionLifecycle(): UseSessionLifecycleReturn {
  const [state, setState] = useState<LifecycleState>({
    status: 'idle',
    sessionId: null,
    startedAt: null,
    elapsedSeconds: 0,
  })

  // Use a ref to always have current state accessible in callbacks without stale closure
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start elapsed timer when active, clear when not
  useEffect(() => {
    if (state.status === 'active') {
      intervalRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }))
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [state.status])

  const start = useCallback(async (consentTimestamp: string) => {
    const response = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consentConfirmedAt: consentTimestamp }),
    })

    const data = await response.json()
    const sessionId: string = data.sessionId
    const now = new Date()

    // Write recovery key to localStorage
    localStorage.setItem(
      SESSION_RECOVERY_KEY,
      JSON.stringify({ sessionId, status: 'active', startedAt: now.toISOString() }),
    )

    setState({
      status: 'active',
      sessionId,
      startedAt: now,
      elapsedSeconds: 0,
    })

    return sessionId
  }, [])

  const pause = useCallback(async () => {
    const current = stateRef.current
    if (current.status !== 'active') return

    await fetch('/api/session/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: current.sessionId, action: 'pause' }),
    })

    // Update localStorage recovery status
    localStorage.setItem(
      SESSION_RECOVERY_KEY,
      JSON.stringify({
        sessionId: current.sessionId,
        status: 'paused',
        startedAt: current.startedAt?.toISOString(),
      }),
    )

    setState((prev) => ({ ...prev, status: 'paused' }))
  }, [])

  const resume = useCallback(async () => {
    const current = stateRef.current
    if (current.status !== 'paused' && current.status !== 'interrupted') return

    await fetch('/api/session/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: current.sessionId, action: 'resume' }),
    })

    setState((prev) => ({ ...prev, status: 'active' }))
  }, [])

  const end = useCallback(async () => {
    const current = stateRef.current

    await fetch('/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: current.sessionId,
        durationSeconds: current.elapsedSeconds,
      }),
    })

    localStorage.removeItem(SESSION_RECOVERY_KEY)
    setState((prev) => ({ ...prev, status: 'ended' }))
  }, [])

  const interrupt = useCallback(() => {
    const current = stateRef.current
    if (current.status !== 'active') return
    // Do NOT clear localStorage — agent needs to resume
    setState((prev) => ({ ...prev, status: 'interrupted' }))
  }, [])

  /**
   * Restore an existing session from the recovery screen.
   * Sets the sessionId and transitions to 'active' without POSTing to /api/session/start.
   */
  const restore = useCallback((restoredSessionId: string) => {
    setState({
      status: 'active',
      sessionId: restoredSessionId,
      startedAt: new Date(),
      elapsedSeconds: 0,
    })
  }, [])

  return {
    status: state.status,
    sessionId: state.sessionId,
    elapsedSeconds: state.elapsedSeconds,
    start,
    pause,
    resume,
    end,
    interrupt,
    restore,
  }
}

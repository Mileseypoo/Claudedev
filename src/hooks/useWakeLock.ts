import { useState, useRef, useCallback } from 'react'

/**
 * WakeLock hook with iOS fallback.
 * - requestWakeLock(): requests screen WakeLock; sets needsManualWarning on failure
 * - releaseWakeLock(): releases WakeLock and clears both flags
 * - wakeLockActive: true when WakeLock is actively held
 * - needsManualWarning: true when WakeLock unavailable/failed/released — triggers banner
 *
 * Source: MDN WakeLock API + WebKit bug tracker (iOS 18.4 fix)
 */
export function useWakeLock() {
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [needsManualWarning, setNeedsManualWarning] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      // API not supported (older iOS, some Android)
      setNeedsManualWarning(true)
      return
    }
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      setWakeLockActive(true)
      setNeedsManualWarning(false)
      wakeLockRef.current.addEventListener('release', () => {
        setWakeLockActive(false)
        // WakeLock released (page hidden, OS-level release) — surface warning
        setNeedsManualWarning(true)
      })
    } catch {
      // request() throws if page is hidden or permission denied
      setNeedsManualWarning(true)
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    await wakeLockRef.current?.release()
    wakeLockRef.current = null
    setWakeLockActive(false)
    setNeedsManualWarning(false)
  }, [])

  return { wakeLockActive, needsManualWarning, requestWakeLock, releaseWakeLock }
}

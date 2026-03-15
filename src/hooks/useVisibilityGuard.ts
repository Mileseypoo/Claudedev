import { useEffect } from 'react'

/**
 * Visibility guard hook for detecting page visibility changes.
 * - onHide: called when document.visibilityState becomes 'hidden' (screen lock, app switch, call)
 * - onShow: called when document.visibilityState becomes 'visible'
 * - CRITICAL: does NOT auto-resume — per locked decision ("No silent auto-resume")
 *
 * Source: MDN Page Visibility API
 */
export function useVisibilityGuard(onHide: () => void, onShow: () => void) {
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        onHide()
      } else if (document.visibilityState === 'visible') {
        // Do NOT auto-resume — agent must tap Resume (per locked decision)
        onShow()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [onHide, onShow])
}

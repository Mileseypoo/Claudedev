'use client'

interface StatusBannerProps {
  showWakeLockWarning: boolean
  showMicStopped: boolean
  onResume: () => void
}

/**
 * Persistent top banner for session state warnings.
 * - WakeLock warning: amber — "Keep your screen on to avoid losing audio"
 * - Mic stopped: red — "Recording stopped" with Resume button
 * - Renders nothing if no condition is active
 *
 * showMicStopped takes priority over showWakeLockWarning (more critical).
 */
export function StatusBanner({ showWakeLockWarning, showMicStopped, onResume }: StatusBannerProps) {
  if (!showWakeLockWarning && !showMicStopped) {
    return null
  }

  if (showMicStopped) {
    return (
      <div className="fixed top-0 left-0 right-0 z-40 px-4 py-3 text-sm text-center bg-red-600 text-white flex items-center justify-center gap-3">
        <span>Recording stopped</span>
        <button
          onClick={onResume}
          className="underline font-semibold hover:no-underline"
        >
          Resume
        </button>
      </div>
    )
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40 px-4 py-3 text-sm text-center bg-amber-500 text-amber-950">
      Keep your screen on to avoid losing audio
    </div>
  )
}

'use client'

import { useState } from 'react'

interface SessionControlsProps {
  onPause: () => void
  onResume: () => void
  onEnd: () => void
  isPaused: boolean
}

/**
 * Fixed-bottom session control buttons.
 * - Pause/Resume (left): immediate action, no confirmation
 * - End (right): first tap shows "Confirm end"; second tap calls onEnd
 * - Both buttons: min-h-[56px] for thumb-sized tap targets
 */
export function SessionControls({ onPause, onResume, onEnd, isPaused }: SessionControlsProps) {
  const [confirmingEnd, setConfirmingEnd] = useState(false)

  function handlePauseResume() {
    setConfirmingEnd(false) // Reset end confirmation when pause is tapped
    if (isPaused) {
      onResume()
    } else {
      onPause()
    }
  }

  function handleEndTap() {
    if (confirmingEnd) {
      setConfirmingEnd(false)
      onEnd()
    } else {
      setConfirmingEnd(true)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-6 flex gap-4">
      <button
        onClick={handlePauseResume}
        className="flex-1 min-h-[56px] rounded-full text-lg font-semibold bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all"
      >
        {isPaused ? 'Resume' : 'Pause'}
      </button>

      <button
        onClick={handleEndTap}
        className={`flex-1 min-h-[56px] rounded-full text-lg font-semibold transition-all active:scale-95 ${
          confirmingEnd
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
        }`}
      >
        {confirmingEnd ? 'Confirm end' : 'End session'}
      </button>
    </div>
  )
}

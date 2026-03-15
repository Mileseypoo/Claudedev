'use client'

import { useMemo } from 'react'

interface SessionTimerProps {
  elapsedSeconds: number
}

/**
 * Running elapsed timer displayed in HH:MM:SS format.
 * Uses monospace font for stable layout.
 */
export function SessionTimer({ elapsedSeconds }: SessionTimerProps) {
  const formatted = useMemo(() => {
    const hours = Math.floor(elapsedSeconds / 3600)
    const minutes = Math.floor((elapsedSeconds % 3600) / 60)
    const seconds = elapsedSeconds % 60

    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }, [elapsedSeconds])

  return (
    <span
      className="font-mono text-4xl font-light tracking-widest text-white"
      aria-label={`Session time: ${formatted}`}
    >
      {formatted}
    </span>
  )
}

'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { TranscriptChunk } from '@/types/session'
import type { AnswerCard } from '@/types/cards'
import { QASection } from './components/QASection'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function SummaryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  const durationParam = searchParams.get('duration')
  const durationSeconds = durationParam ? parseInt(durationParam, 10) : null

  const [chunks, setChunks] = useState<TranscriptChunk[] | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const [cards, setCards] = useState<AnswerCard[]>([])

  useEffect(() => {
    if (!sessionId) {
      setChunks([])
      return
    }

    fetch(`/api/session/transcript?sessionId=${encodeURIComponent(sessionId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Fetch failed')
        return res.json()
      })
      .then((json) => setChunks(json.chunks ?? []))
      .catch(() => {
        setFetchError(true)
        setChunks([])
      })
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) {
      setCards([])
      return
    }

    const fetchCards = () =>
      fetch(`/api/session/cards?sessionId=${encodeURIComponent(sessionId)}`)
        .then((res) => {
          if (!res.ok) throw new Error('Fetch failed')
          return res.json()
        })
        .then((json) => setCards(json.cards ?? []))
        .catch(() => setCards([]))

    // Fetch immediately, then again after 5s to catch cards fired just before session ended
    fetchCards()
    const timer = setTimeout(fetchCards, 5000)
    return () => clearTimeout(timer)
  }, [sessionId])

  const loading = chunks === null

  return (
    <div className="flex flex-col h-full bg-[var(--brand-bg)] text-[var(--text-primary)] px-6 py-10 max-w-2xl mx-auto w-full">
      {/* Heading */}
      <h1 className="text-2xl font-semibold mb-2">Session complete</h1>

      {/* Duration */}
      {durationSeconds !== null && !isNaN(durationSeconds) && (
        <p className="text-[var(--text-muted)] text-sm mb-8">
          Duration: {formatDuration(durationSeconds)}
        </p>
      )}

      {/* Transcript area */}
      <div className="flex-1 mb-8">
        <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Transcript
        </h2>

        {loading && (
          <p className="text-[var(--text-muted)] text-sm">Loading transcript...</p>
        )}

        {!loading && fetchError && (
          <p className="text-[var(--text-muted)] text-sm">Failed to load transcript.</p>
        )}

        {!loading && !fetchError && chunks!.length === 0 && (
          <div className="text-[var(--text-muted)] text-sm space-y-1">
            <p>No transcript captured.</p>
            <p>Check that microphone permissions were granted and audio was streaming.</p>
          </div>
        )}

        {!loading && !fetchError && chunks!.length > 0 && (
          <div
            className="overflow-y-auto rounded-lg bg-[var(--brand-surface)] p-4 text-sm leading-relaxed text-[var(--text-primary)] space-y-2"
            style={{ maxHeight: '55vh' }}
          >
            {chunks!.map((chunk) => (
              <p key={chunk.id}>{chunk.text}</p>
            ))}
          </div>
        )}
      </div>

      {/* Q&A section — all answer cards from this session */}
      <QASection cards={cards} />

      {/* Start new session */}
      <button
        onClick={() => router.push('/')}
        className="w-full py-3 rounded-xl bg-[var(--brand-color)] text-white font-medium text-base active:opacity-80"
      >
        Start New Session
      </button>
    </div>
  )
}

/**
 * Summary page — wraps content in Suspense for useSearchParams() requirement.
 */
export default function SummaryPage() {
  return (
    <Suspense>
      <SummaryContent />
    </Suspense>
  )
}

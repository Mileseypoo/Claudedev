'use client'

import { useState, useRef, useCallback } from 'react'
import type { AnswerCard as AnswerCardType } from '@/types/cards'

interface AnswerCardProps {
  card: AnswerCardType
  onDismiss: (id: string) => void
}

const CARD_TYPE_LABELS: Record<AnswerCardType['cardType'], string> = {
  listing: 'Listing',
  rag: 'PDF',
  stats: 'Stats',
}

const CARD_TYPE_COLORS: Record<AnswerCardType['cardType'], string> = {
  listing: 'bg-blue-500/20 text-blue-300',
  rag: 'bg-amber-500/20 text-amber-300',
  stats: 'bg-green-500/20 text-green-300',
}

export function AnswerCard({ card, onDismiss }: AnswerCardProps) {
  const [expanded, setExpanded] = useState(false)
  const startXRef = useRef<number | null>(null)
  const [translateX, setTranslateX] = useState(0)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    startXRef.current = e.clientX
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (startXRef.current === null) return
      const delta = e.clientX - startXRef.current
      setTranslateX(delta)
    },
    [],
  )

  const handlePointerUp = useCallback(() => {
    if (Math.abs(translateX) > 80) {
      onDismiss(card.id)
    } else {
      setTranslateX(0)
    }
    startXRef.current = null
  }, [translateX, card.id, onDismiss])

  return (
    <div
      className="rounded-xl bg-[var(--brand-surface)] shadow-lg mb-2 overflow-hidden transition-transform duration-150 touch-pan-y"
      style={{
        transform: `translateX(${translateX}px)`,
        opacity: Math.max(0, 1 - Math.abs(translateX) / 150),
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Collapsed state: always visible */}
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-[var(--text-primary)] font-medium text-sm leading-snug flex-1">
          {card.terseAnswer}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CARD_TYPE_COLORS[card.cardType]}`}
        >
          {CARD_TYPE_LABELS[card.cardType]}
        </span>
      </button>

      {/* Expanded state: full answer + source link */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/10">
          <p className="text-[var(--text-muted)] text-xs mt-2 mb-1">{card.questionText}</p>
          <p className="text-[var(--text-primary)] text-sm leading-relaxed mb-3">
            {card.fullAnswer}
          </p>
          {card.sourceRef && (
            <a
              href={card.sourceRef}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--brand-color)] text-xs underline-offset-2 underline"
              onClick={(e) => e.stopPropagation()}
            >
              View source
            </a>
          )}
        </div>
      )}
    </div>
  )
}

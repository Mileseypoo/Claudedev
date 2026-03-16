'use client'

import type { AnswerCard } from '@/types/cards'

interface QASectionProps {
  cards: AnswerCard[]
}

const CARD_TYPE_LABELS: Record<AnswerCard['cardType'], string> = {
  listing: 'Listing',
  rag: 'PDF',
  stats: 'Stats',
}

const CARD_TYPE_COLORS: Record<AnswerCard['cardType'], string> = {
  listing: 'bg-blue-500/20 text-blue-300',
  rag: 'bg-amber-500/20 text-amber-300',
  stats: 'bg-green-500/20 text-green-300',
}

export function QASection({ cards }: QASectionProps) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
        Questions Answered
      </h2>

      {cards.length === 0 && (
        <p className="text-[var(--text-muted)] text-sm">
          No answer cards were generated during this session.
        </p>
      )}

      {cards.length > 0 && (
        <div className="space-y-3">
          {cards.map((card) => (
            <div key={card.id} className="rounded-lg bg-[var(--brand-surface)] p-4">
              {/* Card type label + question */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-[var(--text-muted)] text-xs leading-relaxed flex-1">
                  {card.questionText}
                </p>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CARD_TYPE_COLORS[card.cardType]}`}
                >
                  {CARD_TYPE_LABELS[card.cardType]}
                </span>
              </div>

              {/* Full answer */}
              <p className="text-[var(--text-primary)] text-sm leading-relaxed">
                {card.fullAnswer}
              </p>

              {/* Source link */}
              {card.sourceRef && (
                <a
                  href={card.sourceRef}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-[var(--brand-color)] text-xs underline underline-offset-2"
                >
                  View source
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

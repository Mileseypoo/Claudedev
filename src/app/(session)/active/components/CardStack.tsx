'use client'

import type { AnswerCard as AnswerCardType } from '@/types/cards'
import { AnswerCard } from './AnswerCard'

interface CardStackProps {
  cards: AnswerCardType[]
  onDismiss: (id: string) => void
}

export function CardStack({ cards, onDismiss }: CardStackProps) {
  if (cards.length === 0) return null

  return (
    <div
      className="flex flex-col justify-end overflow-y-auto px-4 pb-2"
      style={{ maxHeight: '50vh' }}
    >
      {cards.map((card) => (
        <AnswerCard key={card.id} card={card} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

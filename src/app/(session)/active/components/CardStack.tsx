'use client'

import { useEffect, useRef } from 'react'
import type { AnswerCard as AnswerCardType } from '@/types/cards'
import { AnswerCard } from './AnswerCard'

interface CardStackProps {
  cards: AnswerCardType[]
  onDismiss: (id: string) => void
}

export function CardStack({ cards, onDismiss }: CardStackProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to newest card when cards change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [cards.length])

  if (cards.length === 0) return null

  return (
    <div className="overflow-y-auto px-4 pb-2 flex-shrink-0" style={{ maxHeight: '40vh' }}>
      {cards.map((card) => (
        <AnswerCard key={card.id} card={card} onDismiss={onDismiss} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

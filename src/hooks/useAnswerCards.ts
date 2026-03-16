'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { AnswerCard } from '@/types/cards'

/**
 * Subscribes to Supabase Realtime INSERT events on answer_cards for the given session.
 * New cards arrive without polling — Supabase Realtime delivers postgres_changes events.
 *
 * IMPORTANT: answer_cards must have:
 *   1. RLS enabled with tenant_isolation policy (from 003_intelligence_cards.sql)
 *   2. Realtime publication enabled (via: alter publication supabase_realtime add table public.answer_cards)
 *
 * dismissCard is local state only — card persists in DB for summary screen.
 */
export function useAnswerCards(sessionId: string | null) {
  const [cards, setCards] = useState<AnswerCard[]>([])

  useEffect(() => {
    if (!sessionId) return

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const channel = supabase
      .channel(`answer-cards-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'answer_cards',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          // Map DB snake_case to TypeScript camelCase
          const row = payload.new as Record<string, unknown>
          const card: AnswerCard = {
            id: row.id as string,
            sessionId: row.session_id as string,
            tenantId: row.tenant_id as string,
            topicKey: row.topic_key as string,
            questionText: row.question_text as string,
            terseAnswer: row.terse_answer as string,
            fullAnswer: row.full_answer as string,
            sourceRef: (row.source_ref as string) ?? '',
            cardType: row.card_type as AnswerCard['cardType'],
            firedAt: row.fired_at as string,
            createdAt: row.created_at as string,
          }
          setCards((prev) => [...prev, card])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  const dismissCard = useCallback((cardId: string) => {
    // Local state only — DB card is preserved for summary screen
    setCards((prev) => prev.filter((c) => c.id !== cardId))
  }, [])

  return { cards, dismissCard }
}

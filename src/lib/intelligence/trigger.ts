import { getServerSupabase } from '@/lib/supabase/server'
import { classifyIntent } from './classify-intent'
import { retrieveFromListings, retrieveFromPDF, retrieveStats } from './retrieve-answer'
import { generateAnswer } from './generate-answer'
import type { CardType } from '@/types/cards'

/**
 * Full intelligence pipeline: classify → retrieve → generate → persist.
 * Called via waitUntil from the chunk save route — runs non-blocking after chunk is persisted.
 * Average latency: ~3s (classify ~1s + embed+retrieve ~0.5s + generate ~1s + insert ~0.2s).
 */
export async function triggerIntelligence(
  sessionId: string,
  tenantId: string,
): Promise<void> {
  const { client } = getServerSupabase()

  // Step 1: Fetch last 3 final chunks (most recent first, then reversed for chronological order)
  const { data: recentChunks } = await client
    .from('transcript_chunks')
    .select('text, sequence')
    .eq('session_id', sessionId)
    .eq('tenant_id', tenantId)
    .order('sequence', { ascending: false })
    .limit(3)

  if (!recentChunks || recentChunks.length === 0) return

  const chunkTexts = [...recentChunks]
    .reverse()
    .map((c: { text: string; sequence: number }) => c.text)

  // Step 2: Fetch existing topic_keys for this session (soft dedup context for LLM)
  const { data: existingCards } = await client
    .from('answer_cards')
    .select('topic_key')
    .eq('session_id', sessionId)

  const existingTopicKeys: string[] = (existingCards ?? []).map(
    (c: { topic_key: string }) => c.topic_key,
  )

  // Step 3: Classify intent (always logs to console)
  const intent = await classifyIntent(chunkTexts, existingTopicKeys)

  if (!intent.is_question || !intent.topic_key || !intent.query_text) return

  // Step 4: Hard dedup — SELECT before INSERT (race condition protection)
  const { data: duplicate } = await client
    .from('answer_cards')
    .select('id')
    .eq('session_id', sessionId)
    .eq('topic_key', intent.topic_key)
    .maybeSingle()

  if (duplicate) {
    console.log('[intelligence] dedup-skip', { sessionId, topic_key: intent.topic_key })
    return
  }

  // Step 5: Retrieve context based on retrieval_type
  let context = ''
  let cardType: CardType = 'rag'

  if (intent.retrieval_type === 'sql_listing') {
    context = await retrieveFromListings(intent.query_text)
    cardType = 'listing'
  } else if (intent.retrieval_type === 'rag') {
    const chunks = await retrieveFromPDF(intent.query_text)
    context = chunks.map((c) => c.content).join('\n\n')
    cardType = 'rag'
  } else if (intent.retrieval_type === 'stats') {
    context = await retrieveStats()
    cardType = 'stats'
  } else {
    // retrieval_type: 'none' — no company data available for this question
    console.log('[intelligence] no-retrieval', { sessionId, topic_key: intent.topic_key })
    return
  }

  // Step 6: Generate terse + full answer
  const answer = await generateAnswer(intent.query_text, context, cardType)

  // Step 7: Persist card — Supabase Realtime will deliver to active session screen
  const { error } = await client.from('answer_cards').insert({
    session_id: sessionId,
    tenant_id: tenantId,
    topic_key: intent.topic_key,
    question_text: intent.query_text,
    terse_answer: answer.terse_answer,
    full_answer: answer.full_answer,
    source_ref: answer.source_ref,
    card_type: cardType,
    fired_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[intelligence] insert-error', { sessionId, error })
  } else {
    console.log('[intelligence] card-fired', { sessionId, topic_key: intent.topic_key, cardType })
  }
}

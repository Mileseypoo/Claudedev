/**
 * Card types — mirrors the answer_cards table in 003_intelligence_cards.sql.
 * camelCase field names follow the existing TranscriptChunk pattern in session.ts.
 */

export type CardType = 'listing' | 'rag' | 'stats'

export interface AnswerCard {
  id: string
  sessionId: string
  tenantId: string
  topicKey: string
  questionText: string
  terseAnswer: string      // 1–5 words max — lockscreen WhatsApp style
  fullAnswer: string       // 2–3 sentences with context
  sourceRef: string        // URL or document name; empty string if none
  cardType: CardType
  firedAt: string          // ISO timestamp
  createdAt: string
}

/**
 * Structured output from Claude Haiku 4.5 intent classification.
 * Matches the IntentSchema Zod definition in classify-intent.ts.
 */
export interface IntentResult {
  is_question: boolean
  topic_key: string | null
  query_text: string | null
  retrieval_type: 'rag' | 'sql_listing' | 'stats' | 'none' | null
  reason: string   // always populated — logged to Vercel for prompt tuning
}

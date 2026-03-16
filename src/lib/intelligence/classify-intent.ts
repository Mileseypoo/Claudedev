import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type { IntentResult } from '@/types/cards'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Zod schema mirrors IntentResult interface (snake_case to match LLM output + DB column naming)
export const IntentSchema = z.object({
  is_question: z.boolean(),
  topic_key: z.string().nullable(),
  query_text: z.string().nullable(),
  retrieval_type: z.enum(['rag', 'sql_listing', 'stats', 'none']).nullable(),
  reason: z.string(),
})

const SYSTEM_PROMPT = `You are a real-time copilot for Dubai estate agents during client meetings.
Analyze the last few seconds of conversation. Detect only:
- Direct property questions from the client (price, availability, features, developer info, area)
- Requests for statistics or market data (sales counts, price ranges, market trends)

Do NOT fire for:
- Pleasantries, greetings, or small talk
- Agent internal comments, thinking aloud, or directions to themselves
- Rhetorical statements with no information request
- Topics already answered this session (listed in "Already answered topics")

For detected questions/topics, produce:
- topic_key: snake_case, max 5 words, describes the topic (used for deduplication)
- query_text: the question rephrased as a clear information request
- retrieval_type:
  * "sql_listing" — specific property availability, price, features of named units
  * "stats" — aggregate market data (counts, averages, price ranges across portfolio)
  * "rag" — regulatory questions, brochure content, developer info, process questions

Respond with JSON matching the schema exactly.`

export async function classifyIntent(
  recentChunks: string[],
  existingTopicKeys: string[],
): Promise<IntentResult> {
  const transcriptText = recentChunks.join(' ')
  const dedupContext =
    existingTopicKeys.length > 0
      ? `\n\nAlready answered topics (do NOT re-fire): ${existingTopicKeys.join(', ')}`
      : ''

  const response = await client.messages.parse({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Transcript: "${transcriptText}"${dedupContext}`,
      },
    ],
    output_config: { format: zodOutputFormat(IntentSchema) },
  })

  const result = response.parsed_output as IntentResult

  // Classification logging — required by CONTEXT.md. Never silent-skip.
  console.log('[intelligence] classify', {
    is_question: result.is_question,
    topic_key: result.topic_key,
    retrieval_type: result.retrieval_type,
    reason: result.reason,
  })

  return result
}

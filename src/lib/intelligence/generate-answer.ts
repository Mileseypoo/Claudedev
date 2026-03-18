import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type { CardType } from '@/types/cards'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const AnswerSchema = z.object({
  terse_answer: z.string(), // 1–5 words — WhatsApp lockscreen preview style
  full_answer: z.string(), // 2–3 sentences with context
  source_ref: z.string(), // URL, document name, or empty string
})

export type GeneratedAnswer = z.infer<typeof AnswerSchema>

const SYSTEM_PROMPT = `You are a live copilot for a Dubai estate agent in a client meeting.
Generate two answers from the provided context:
1. terse_answer: 1–5 words max. Ultra-brief glanceable answer. Examples: "AED 1.95M", "Yes — allowed", "3 sold this month", "Checking...". No punctuation unless essential.
2. full_answer: 2–3 sentences with the key facts and relevant context for the agent to expand on verbally.
3. source_ref: A URL or document name from the context. Empty string if none available.

Base answers ONLY on the provided context.
- If context shows no matching results (empty list, zero results), use "None available" as terse_answer and explain clearly in full_answer.
- If context is genuinely missing or unclear, use "Checking..." as terse_answer and explain the gap in full_answer.`

export async function generateAnswer(
  question: string,
  context: string,
  _cardType: CardType,
): Promise<GeneratedAnswer> {
  const response = await client.beta.messages.parse({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Question: "${question}"\n\nContext:\n${context}`,
      },
    ],
    output_config: { format: zodOutputFormat(AnswerSchema) },
  })
  return response.parsed_output as GeneratedAnswer
}

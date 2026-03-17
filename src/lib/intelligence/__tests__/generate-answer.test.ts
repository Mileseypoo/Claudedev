// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockParse = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => {
  // Must use regular function (not arrow) — arrow functions cannot be used as constructors
  const MockAnthropic = vi.fn(function (this: unknown) {
    return { beta: { messages: { parse: mockParse } } }
  })
  return { default: MockAnthropic }
})

vi.mock('@anthropic-ai/sdk/helpers/zod', () => ({
  zodOutputFormat: vi.fn().mockReturnValue({ type: 'json_schema', json_schema: {} }),
}))

import { generateAnswer } from '../generate-answer'

const makeAnswerResult = (overrides = {}) => ({
  terse_answer: 'AED 1.95M',
  full_answer: 'The listed price is AED 1.95M. It is a 3-bedroom apartment in Dubai Marina. Available immediately.',
  source_ref: '/listings/P001',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockParse.mockResolvedValue({ parsed_output: makeAnswerResult() })
})

describe('generateAnswer', () => {
  it('returns terse_answer, full_answer, source_ref fields', async () => {
    const result = await generateAnswer('What is the price?', '{"price_aed": 1950000}', 'listing')
    expect(result).toHaveProperty('terse_answer')
    expect(result).toHaveProperty('full_answer')
    expect(result).toHaveProperty('source_ref')
  })

  it('calls client.beta.messages.parse with max_tokens: 512', async () => {
    await generateAnswer('Any question?', 'some context', 'rag')
    const callArgs = mockParse.mock.calls[0][0]
    expect(callArgs.max_tokens).toBe(512)
  })

  it('includes the question and context in the user message', async () => {
    const question = 'Can foreigners buy?'
    const context = 'Foreign buyers allowed since 2002 per Law 7.'
    await generateAnswer(question, context, 'rag')
    const callArgs = mockParse.mock.calls[0][0]
    const userContent = callArgs.messages[0].content as string
    expect(userContent).toContain(question)
    expect(userContent).toContain(context)
  })

  it('returns object matching GeneratedAnswer shape', async () => {
    const result = await generateAnswer('How many sold?', '{"recently_sold_count": 3}', 'stats')
    expect(typeof result.terse_answer).toBe('string')
    expect(typeof result.full_answer).toBe('string')
    expect(typeof result.source_ref).toBe('string')
  })
})

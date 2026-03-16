// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures mock refs are available inside vi.mock factories
const mockParse = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { parse: mockParse },
  })),
}))

vi.mock('@anthropic-ai/sdk/helpers/zod', () => ({
  zodOutputFormat: vi.fn().mockReturnValue({ type: 'json_schema', json_schema: {} }),
}))

import { classifyIntent } from '../classify-intent'

const makeIntentResult = (overrides = {}) => ({
  is_question: true,
  topic_key: 'property_price_query',
  query_text: 'What is the price?',
  retrieval_type: 'sql_listing',
  reason: 'Client asked about price',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockParse.mockResolvedValue({ parsed_output: makeIntentResult() })
})

describe('classifyIntent', () => {
  it('returns is_question: true for a property price question', async () => {
    const result = await classifyIntent(['What is the price of unit 204?'], [])
    expect(result.is_question).toBe(true)
  })

  it('returns is_question: false for pleasantries', async () => {
    mockParse.mockResolvedValue({
      parsed_output: makeIntentResult({ is_question: false, topic_key: null, reason: 'Pleasantry, not a question' }),
    })
    const result = await classifyIntent(['Nice to meet you, shall we sit down?'], [])
    expect(result.is_question).toBe(false)
    expect(result.topic_key).toBeNull()
  })

  it('returns retrieval_type: sql_listing for specific listing questions', async () => {
    const result = await classifyIntent(['What is the price of unit 204?'], [])
    expect(result.retrieval_type).toBe('sql_listing')
  })

  it('returns retrieval_type: stats for aggregate/count questions', async () => {
    mockParse.mockResolvedValue({
      parsed_output: makeIntentResult({ topic_key: 'monthly_sales_count', retrieval_type: 'stats' }),
    })
    const result = await classifyIntent(['How many properties sold this month?'], [])
    expect(result.retrieval_type).toBe('stats')
  })

  it('returns retrieval_type: rag for regulatory questions', async () => {
    mockParse.mockResolvedValue({
      parsed_output: makeIntentResult({ topic_key: 'foreign_buyer_rules', retrieval_type: 'rag' }),
    })
    const result = await classifyIntent(['Can foreigners buy property in Dubai?'], [])
    expect(result.retrieval_type).toBe('rag')
  })

  it('reason is always a non-empty string', async () => {
    const result = await classifyIntent(['Something'], [])
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })

  it('topic_key is null when is_question is false', async () => {
    mockParse.mockResolvedValue({
      parsed_output: makeIntentResult({ is_question: false, topic_key: null, reason: 'Not a question' }),
    })
    const result = await classifyIntent(['Hello there'], [])
    expect(result.topic_key).toBeNull()
  })

  it('includes existing topic keys in the user message for LLM-level dedup', async () => {
    await classifyIntent(['How many sold?'], ['monthly_sales_count', 'price_range_marina'])
    const callArgs = mockParse.mock.calls[0][0]
    const userContent = callArgs.messages[0].content as string
    expect(userContent).toContain('monthly_sales_count')
    expect(userContent).toContain('price_range_marina')
  })
})

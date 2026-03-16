// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase chain mocks (must be hoisted for vi.mock factory access)
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn(() => ({
    client: { from: mockFrom },
    tenantId: '00000000-0000-0000-0000-000000000001',
  })),
}))

const mockClassifyIntent = vi.hoisted(() => vi.fn())
vi.mock('@/lib/intelligence/classify-intent', () => ({ classifyIntent: mockClassifyIntent }))

const mockRetrieveFromListings = vi.hoisted(() => vi.fn())
const mockRetrieveFromPDF = vi.hoisted(() => vi.fn())
const mockRetrieveStats = vi.hoisted(() => vi.fn())
vi.mock('@/lib/intelligence/retrieve-answer', () => ({
  retrieveFromListings: mockRetrieveFromListings,
  retrieveFromPDF: mockRetrieveFromPDF,
  retrieveStats: mockRetrieveStats,
}))

const mockGenerateAnswer = vi.hoisted(() => vi.fn())
vi.mock('@/lib/intelligence/generate-answer', () => ({ generateAnswer: mockGenerateAnswer }))

import { triggerIntelligence } from '../trigger'

const SESSION_ID = '00000000-0000-0000-0000-000000000002'
const TENANT_ID = '00000000-0000-0000-0000-000000000001'

const makeChunks = () => [
  { text: 'What is the price?', sequence: 2 },
  { text: 'Tell me about unit 204', sequence: 1 },
  { text: 'Hello there', sequence: 0 },
]

const makeIntent = (overrides = {}) => ({
  is_question: true,
  topic_key: 'unit_204_price',
  query_text: 'What is the price of unit 204?',
  retrieval_type: 'sql_listing',
  reason: 'Client asked about price',
  ...overrides,
})

// Shared helper: sets up a standard successful pipeline mock
function setupSuccessfulPipeline(intentOverrides = {}) {
  let callCount = 0
  mockFrom.mockImplementation((table: string) => {
    if (table === 'transcript_chunks') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: makeChunks(), error: null }),
      }
    }
    if (table === 'answer_cards') {
      callCount++
      if (callCount === 1) {
        // Fetch existing topic_keys
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      if (callCount === 2) {
        // Hard dedup check
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      // Insert
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    }
    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) }
  })
  mockClassifyIntent.mockResolvedValue(makeIntent(intentOverrides))
  mockRetrieveFromListings.mockResolvedValue('[]')
  mockRetrieveFromPDF.mockResolvedValue([])
  mockRetrieveStats.mockResolvedValue('{}')
  mockGenerateAnswer.mockResolvedValue({ terse_answer: 'AED 1.95M', full_answer: 'The price is...', source_ref: '' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('triggerIntelligence', () => {
  it('exits without calling classifyIntent when no chunks found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
    await triggerIntelligence(SESSION_ID, TENANT_ID)
    expect(mockClassifyIntent).not.toHaveBeenCalled()
  })

  it('fetches last 3 chunks ordered by sequence descending', async () => {
    const orderMock = vi.fn().mockReturnThis()
    const limitMock = vi.fn().mockResolvedValue({ data: [], error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: orderMock,
      limit: limitMock,
    })
    await triggerIntelligence(SESSION_ID, TENANT_ID)
    expect(orderMock).toHaveBeenCalledWith('sequence', { ascending: false })
    expect(limitMock).toHaveBeenCalledWith(3)
  })

  it('fetches existing topic_keys from answer_cards for the session', async () => {
    setupSuccessfulPipeline()
    await triggerIntelligence(SESSION_ID, TENANT_ID)
    expect(mockClassifyIntent).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
    )
  })

  it('calls classifyIntent with chunk texts and existing topic_keys', async () => {
    setupSuccessfulPipeline()
    await triggerIntelligence(SESSION_ID, TENANT_ID)
    expect(mockClassifyIntent).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(String)]),
      expect.any(Array),
    )
  })

  it('exits without inserting when is_question is false', async () => {
    setupSuccessfulPipeline({ is_question: false, topic_key: null })
    await triggerIntelligence(SESSION_ID, TENANT_ID)
    expect(mockGenerateAnswer).not.toHaveBeenCalled()
  })

  it('exits without inserting when topic_key already exists for session (hard dedup)', async () => {
    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'transcript_chunks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: makeChunks(), error: null }),
        }
      }
      callCount++
      if (callCount === 1) {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }
      // Dedup check returns existing row
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing' }, error: null }),
      }
    })
    mockClassifyIntent.mockResolvedValue(makeIntent())
    await triggerIntelligence(SESSION_ID, TENANT_ID)
    expect(mockGenerateAnswer).not.toHaveBeenCalled()
  })

  it('calls retrieveFromListings for sql_listing retrieval_type', async () => {
    setupSuccessfulPipeline({ retrieval_type: 'sql_listing' })
    await triggerIntelligence(SESSION_ID, TENANT_ID)
    expect(mockRetrieveFromListings).toHaveBeenCalled()
  })

  it('calls retrieveFromPDF for rag retrieval_type', async () => {
    setupSuccessfulPipeline({ retrieval_type: 'rag', topic_key: 'foreign_buyer_rules' })
    await triggerIntelligence(SESSION_ID, TENANT_ID)
    expect(mockRetrieveFromPDF).toHaveBeenCalled()
  })

  it('calls retrieveStats for stats retrieval_type', async () => {
    setupSuccessfulPipeline({ retrieval_type: 'stats', topic_key: 'monthly_sales' })
    await triggerIntelligence(SESSION_ID, TENANT_ID)
    expect(mockRetrieveStats).toHaveBeenCalled()
  })

  it('calls generateAnswer with query_text and retrieved context', async () => {
    setupSuccessfulPipeline()
    await triggerIntelligence(SESSION_ID, TENANT_ID)
    expect(mockGenerateAnswer).toHaveBeenCalledWith(
      'What is the price of unit 204?',
      expect.any(String),
      expect.any(String),
    )
  })

  it('inserts to answer_cards with all required fields on success', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'transcript_chunks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: makeChunks(), error: null }),
        }
      }
      callCount++
      if (callCount === 1) {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }
      if (callCount === 2) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      return { insert: insertMock }
    })
    mockClassifyIntent.mockResolvedValue(makeIntent())
    mockRetrieveFromListings.mockResolvedValue('[]')
    mockGenerateAnswer.mockResolvedValue({ terse_answer: 'AED 1.95M', full_answer: 'The price is...', source_ref: '/listings/P001' })

    await triggerIntelligence(SESSION_ID, TENANT_ID)

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      session_id: SESSION_ID,
      tenant_id: TENANT_ID,
      topic_key: 'unit_204_price',
      terse_answer: 'AED 1.95M',
      full_answer: 'The price is...',
      source_ref: '/listings/P001',
    }))
  })
})

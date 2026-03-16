// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())
const mockGenerateEmbedding = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn(() => ({
    client: {
      from: mockFrom,
      rpc: mockRpc,
    },
    tenantId: '00000000-0000-0000-0000-000000000001',
  })),
}))

vi.mock('@/lib/embeddings/generate', () => ({
  generateEmbedding: mockGenerateEmbedding,
}))

import { retrieveFromListings, retrieveFromPDF, retrieveStats } from '../retrieve-answer'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('retrieveFromListings', () => {
  it('returns JSON string of available listings', async () => {
    const listings = [{ property_id: 'P001', price_aed: 1500000, status: 'available' }]
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: listings, error: null }),
    })
    const result = await retrieveFromListings('3 bedroom villa in Dubai Marina')
    expect(JSON.parse(result)).toEqual(listings)
  })

  it('queries with status available and limit 20', async () => {
    const eqMock = vi.fn().mockReturnThis()
    const limitMock = vi.fn().mockResolvedValue({ data: [], error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: eqMock,
      order: vi.fn().mockReturnThis(),
      limit: limitMock,
    })
    await retrieveFromListings('any query')
    expect(eqMock).toHaveBeenCalledWith('status', 'available')
    expect(limitMock).toHaveBeenCalledWith(20)
  })
})

describe('retrieveFromPDF', () => {
  it('calls generateEmbedding then match_document_chunks RPC', async () => {
    const embedding = new Array(1536).fill(0.1)
    mockGenerateEmbedding.mockResolvedValue(embedding)
    mockRpc.mockResolvedValue({
      data: [{ id: 'c1', document_id: 'd1', content: 'Foreign buyers allowed', similarity: 0.85 }],
      error: null,
    })
    await retrieveFromPDF('Can foreigners buy property?')
    expect(mockGenerateEmbedding).toHaveBeenCalledWith('Can foreigners buy property?')
    expect(mockRpc).toHaveBeenCalledWith('match_document_chunks', expect.objectContaining({
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 5,
      p_tenant_id: TENANT_ID,
    }))
  })

  it('returns array with content and sourceRef fields', async () => {
    mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
    mockRpc.mockResolvedValue({
      data: [{ id: 'c1', document_id: 'd1', content: 'Yes, allowed since 2002', similarity: 0.9 }],
      error: null,
    })
    const results = await retrieveFromPDF('foreign buyers')
    expect(results[0]).toHaveProperty('content')
    expect(results[0]).toHaveProperty('sourceRef')
  })

  it('returns empty array on RPC error', async () => {
    mockGenerateEmbedding.mockResolvedValue(new Array(1536).fill(0.1))
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const results = await retrieveFromPDF('query')
    expect(results).toEqual([])
  })
})

describe('retrieveStats', () => {
  it('returns JSON string of listing_stats.stats', async () => {
    const stats = { total_listings: 42, recently_sold_count: 3 }
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { stats }, error: null }),
    })
    const result = await retrieveStats()
    expect(JSON.parse(result)).toEqual(stats)
  })

  it('returns empty JSON object when no stats row exists', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
    const result = await retrieveStats()
    expect(result).toBe('{}')
  })
})

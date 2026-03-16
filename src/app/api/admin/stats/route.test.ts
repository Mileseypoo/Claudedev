import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn().mockReturnValue({
    client: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
      }),
    },
    tenantId: 'test-tenant-id',
  }),
}))

import { GET } from '@/app/api/admin/stats/route'

describe('GET /api/admin/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with { stats: ListingStatsData } when stats exist', async () => {
    const mockStats = {
      total_listings: 42,
      count_by_status: { available: 30, sold: 10, reserved: 2 },
      avg_price_by_bedrooms: { '2': 1500000, '3': 2500000 },
      price_range_by_area: { 'Dubai Marina': { min: 1000000, max: 5000000, median: 2500000 } },
      recently_sold_count: 5,
      calculated_at: '2024-01-15T10:00:00Z',
    }
    mockSingle.mockResolvedValue({ data: { stats: mockStats }, error: null })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.stats).toEqual(mockStats)
    expect(body.stats.total_listings).toBe(42)
  })

  it('returns 200 with { stats: null } when no stats record exists', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'No rows' } })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.stats).toBeNull()
  })
})

import { describe, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn().mockReturnValue({
    client: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { stats: { total_listings: 0, count_by_status: { available: 0, sold: 0, reserved: 0 }, avg_price_by_bedrooms: {}, price_range_by_area: {}, recently_sold_count: 0, calculated_at: '' } },
        error: null,
      }),
    },
    tenantId: 'tenant-id',
  }),
}))

describe('GET /api/admin/stats', () => {
  it.todo('returns { stats: ListingStatsData } with status 200')
})

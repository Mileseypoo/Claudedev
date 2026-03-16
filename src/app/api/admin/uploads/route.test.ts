import { describe, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn().mockReturnValue({
    client: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    },
    tenantId: 'tenant-id',
  }),
}))

describe('GET /api/admin/uploads', () => {
  it.todo('returns { uploads: Upload[] } with status 200')
})

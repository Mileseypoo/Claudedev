import { describe, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn().mockReturnValue({
    client: {
      from: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'upload-id' }, error: null }),
    },
    tenantId: 'tenant-id',
  }),
}))

describe('DELETE /api/admin/uploads/[id]', () => {
  it.todo('returns 200 on successful delete')
  it.todo('returns 404 with unknown id')
})

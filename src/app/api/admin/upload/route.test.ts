import { describe, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn().mockReturnValue({
    client: {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: [{ id: 'upload-id' }], error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 'upload-id' }, error: null }),
    },
    tenantId: 'tenant-id',
  }),
}))

vi.mock('@vercel/functions', () => ({
  waitUntil: vi.fn(),
}))

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0) }],
      }),
    },
  })),
}))

describe('POST /api/admin/upload', () => {
  it.todo('POST with valid CSV FormData returns 201')
  it.todo('POST with PDF returns 202 and calls waitUntil')
  it.todo('POST with CSV missing required column returns 400 with error message')
})

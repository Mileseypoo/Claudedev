import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockOrder = vi.hoisted(() => vi.fn())
const mockEq = vi.hoisted(() => vi.fn())
const mockSelect = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn().mockReturnValue({
    client: {
      from: mockFrom,
    },
    tenantId: 'test-tenant-id',
  }),
}))

import { GET } from '@/app/api/admin/uploads/route'

describe('GET /api/admin/uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOrder.mockResolvedValue({ data: [], error: null })
    mockEq.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  it('returns 200 with { uploads: Upload[] }', async () => {
    const uploads = [
      { id: '1', filename: 'listings.csv', file_type: 'csv', status: 'indexed', created_at: '2024-01-01' },
      { id: '2', filename: 'doc.pdf', file_type: 'pdf', status: 'processing', created_at: '2024-01-02' },
    ]
    mockOrder.mockResolvedValue({ data: uploads, error: null })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.uploads).toHaveLength(2)
    expect(body.uploads[0].filename).toBe('listings.csv')
  })

  it('orders uploads by created_at descending', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    await GET()

    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('returns empty array when no uploads exist', async () => {
    mockOrder.mockResolvedValue({ data: null, error: null })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.uploads).toEqual([])
  })
})

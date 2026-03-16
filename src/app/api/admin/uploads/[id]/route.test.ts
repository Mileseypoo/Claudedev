import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockStorageRemove = vi.hoisted(() => vi.fn())
const mockSingle = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn().mockReturnValue({
    client: {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'uploads') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: mockSingle,
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          }
        }
        return {}
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          remove: mockStorageRemove,
        }),
      },
    },
    tenantId: 'test-tenant-id',
  }),
}))

import { DELETE } from '@/app/api/admin/uploads/[id]/route'

describe('DELETE /api/admin/uploads/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageRemove.mockResolvedValue({ error: null })
  })

  it('returns 200 with { success: true } on valid delete', async () => {
    mockSingle.mockResolvedValue({
      data: { storage_path: null },
      error: null,
    })

    const request = new Request('http://localhost/api/admin/uploads/upload-id-123', {
      method: 'DELETE',
    })
    const response = await DELETE(request, { params: { id: 'upload-id-123' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('calls storage.remove when upload has storage_path (PDF)', async () => {
    mockSingle.mockResolvedValue({
      data: { storage_path: 'tenant-id/123-document.pdf' },
      error: null,
    })

    const request = new Request('http://localhost/api/admin/uploads/pdf-id', {
      method: 'DELETE',
    })
    await DELETE(request, { params: { id: 'pdf-id' } })

    expect(mockStorageRemove).toHaveBeenCalledWith(['tenant-id/123-document.pdf'])
  })

  it('does NOT call storage.remove when storage_path is null (CSV)', async () => {
    mockSingle.mockResolvedValue({
      data: { storage_path: null },
      error: null,
    })

    const request = new Request('http://localhost/api/admin/uploads/csv-id', {
      method: 'DELETE',
    })
    await DELETE(request, { params: { id: 'csv-id' } })

    expect(mockStorageRemove).not.toHaveBeenCalled()
  })

  it('returns 404 when upload not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })

    const request = new Request('http://localhost/api/admin/uploads/nonexistent', {
      method: 'DELETE',
    })
    const response = await DELETE(request, { params: { id: 'nonexistent' } })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBeTruthy()
  })
})

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/admin/upload/route'
import { waitUntil } from '@vercel/functions'
import { getServerSupabase } from '@/lib/supabase/server'

// These are module-level mocks that vi.mock factories can reference via vi.hoisted
const { mockInsert, mockUpsert, mockRpc, mockUpdate, mockFrom, mockStorageUpload } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpsert: vi.fn(),
  mockRpc: vi.fn(),
  mockUpdate: vi.fn(),
  mockFrom: vi.fn(),
  mockStorageUpload: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn().mockReturnValue({
    client: {
      from: mockFrom,
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockStorageUpload,
          remove: vi.fn().mockResolvedValue({ error: null }),
        }),
      },
      rpc: mockRpc,
    },
    tenantId: 'test-tenant-id',
  }),
}))

vi.mock('@vercel/functions', () => ({
  waitUntil: vi.fn(),
}))

vi.mock('@/lib/csv/parse-listings', () => ({
  parseCsv: vi.fn().mockReturnValue({
    rows: [
      {
        property_id: 'PROP001',
        address: '123 Main St',
        area: 'Dubai Marina',
        price_aed: 1500000,
        bedrooms: 2,
        bathrooms: 2,
        size_sqft: 1200,
        status: 'available',
        developer: 'Emaar',
        community: 'Marina Walk',
        property_type: 'apartment',
      },
    ],
    errors: [],
  }),
}))

vi.mock('@/lib/pdf/extract-text', () => ({
  extractPdfText: vi.fn().mockResolvedValue('extracted pdf text'),
}))

vi.mock('@/lib/pdf/chunk-text', () => ({
  chunkText: vi.fn().mockReturnValue(['chunk1', 'chunk2']),
}))

vi.mock('@/lib/embeddings/generate', () => ({
  generateEmbeddings: vi.fn().mockResolvedValue([
    new Array(1536).fill(0),
    new Array(1536).fill(0),
  ]),
}))

describe('POST /api/admin/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset getServerSupabase to return fresh mock client
    vi.mocked(getServerSupabase).mockReturnValue({
      client: {
        from: mockFrom,
        storage: {
          from: vi.fn().mockReturnValue({
            upload: mockStorageUpload,
            remove: vi.fn().mockResolvedValue({ error: null }),
          }),
        },
        rpc: mockRpc,
      } as unknown as ReturnType<typeof getServerSupabase>['client'],
      tenantId: 'test-tenant-id',
      rpc: vi.fn(),
    })

    // Default chain: from() returns an object with insert/upsert/update/select/etc
    const mockSelectChain = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'upload-id-123' }, error: null }),
    }
    mockInsert.mockReturnValue(mockSelectChain)
    mockUpsert.mockResolvedValue({ data: null, error: null })
    mockRpc.mockResolvedValue({ data: null, error: null })
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
    })
    mockStorageUpload.mockResolvedValue({ data: { path: 'test/path' }, error: null })

    mockFrom.mockReturnValue({
      insert: mockInsert,
      upsert: mockUpsert,
      update: mockUpdate,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })
  })

  it('POST with valid CSV returns 201 with uploadId and rowCount', async () => {
    const csvContent = 'property_id,address\nPROP001,123 Main St'
    const file = new File([csvContent], 'listings.csv', { type: 'text/csv' })
    const formData = new FormData()
    formData.append('file', file)

    const request = new Request('http://localhost/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.uploadId).toBeTruthy()
    expect(body.rowCount).toBe(1)
  })

  it('POST with CSV calls upsert on listings table', async () => {
    const csvContent = 'property_id,address\nPROP001,123 Main St'
    const file = new File([csvContent], 'listings.csv', { type: 'text/csv' })
    const formData = new FormData()
    formData.append('file', file)

    const request = new Request('http://localhost/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    await POST(request)

    // Should call from('listings') and upsert
    expect(mockFrom).toHaveBeenCalledWith('listings')
    expect(mockUpsert).toHaveBeenCalled()
  })

  it('POST with CSV calls recalculate_listing_stats rpc', async () => {
    const csvContent = 'property_id,address\nPROP001,123 Main St'
    const file = new File([csvContent], 'listings.csv', { type: 'text/csv' })
    const formData = new FormData()
    formData.append('file', file)

    const request = new Request('http://localhost/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    await POST(request)

    expect(mockRpc).toHaveBeenCalledWith('recalculate_listing_stats', {
      p_tenant_id: 'test-tenant-id',
    })
  })

  it('POST with CSV validation errors returns 400 with errors', async () => {
    const { parseCsv } = await import('@/lib/csv/parse-listings')
    vi.mocked(parseCsv).mockReturnValueOnce({
      rows: [],
      errors: ['Missing required column: price_aed'],
    })

    const file = new File(['bad,csv'], 'bad.csv', { type: 'text/csv' })
    const formData = new FormData()
    formData.append('file', file)

    const request = new Request('http://localhost/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.errors).toContain('Missing required column: price_aed')
  })

  it('POST with PDF returns 202 and calls waitUntil', async () => {
    const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // PDF magic bytes
    const file = new File([pdfContent], 'document.pdf', { type: 'application/pdf' })
    const formData = new FormData()
    formData.append('file', file)

    const request = new Request('http://localhost/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body.uploadId).toBeTruthy()
    expect(vi.mocked(waitUntil)).toHaveBeenCalledWith(expect.any(Promise))
  })

  it('POST with oversized PDF returns 400 before reading file', async () => {
    // Node's native File/Blob has a non-overridable size getter; use a mock object instead
    const file = {
      name: 'large.pdf',
      type: 'application/pdf',
      size: 51 * 1024 * 1024,
      text: vi.fn().mockResolvedValue('pdf content'),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }

    // FormData.append requires a Blob/File — mock formData.get directly
    const mockFormData = {
      get: vi.fn().mockReturnValue(file),
    }
    const mockRequest = {
      formData: vi.fn().mockResolvedValue(mockFormData),
    }

    const response = await POST(mockRequest as unknown as Request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('50MB')
    expect(vi.mocked(waitUntil)).not.toHaveBeenCalled()
  })

  it('POST with unsupported file type returns 400', async () => {
    const file = new File(['data'], 'data.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const formData = new FormData()
    formData.append('file', file)

    const request = new Request('http://localhost/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Unsupported file type')
  })

  it('POST with no file returns 400', async () => {
    const formData = new FormData()
    const request = new Request('http://localhost/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('No file provided')
  })
})

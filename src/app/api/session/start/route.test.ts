import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock getServerSupabase before importing the route
const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn(() => ({
    client: {
      from: mockFrom,
    },
    tenantId: 'test-tenant-id',
  })),
}))

import { POST } from './route'

// Valid UUID v4 for test data
const FAKE_SESSION_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('POST /api/session/start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle.mockResolvedValue({ data: { id: FAKE_SESSION_ID }, error: null })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ insert: mockInsert })
  })

  it('POST /api/session/start creates session record with DEFAULT_TENANT_ID and returns 201 with sessionId', async () => {
    mockSingle.mockResolvedValue({
      data: { id: FAKE_SESSION_ID },
      error: null,
    })

    const request = new Request('http://localhost/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consentConfirmedAt: '2026-03-15T20:00:00.000Z',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(201)

    const body = await response.json()
    expect(body).toHaveProperty('sessionId')
    expect(mockFrom).toHaveBeenCalledWith('sessions')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'test-tenant-id',
        status: 'active',
        consent_confirmed_at: '2026-03-15T20:00:00.000Z',
      }),
    )
  })

  it('returns 400 when consentConfirmedAt is missing', async () => {
    const request = new Request('http://localhost/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 when consentConfirmedAt is not a valid datetime', async () => {
    const request = new Request('http://localhost/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consentConfirmedAt: 'not-a-date' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 500 when Supabase insert fails', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    })

    const request = new Request('http://localhost/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consentConfirmedAt: '2026-03-15T20:00:00.000Z',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })
})

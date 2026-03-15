import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock getServerSupabase before importing the route
const mockUpdate = vi.fn()
const mockEq = vi.fn()
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

// Valid UUID v4 for test payloads
const VALID_SESSION_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('POST /api/session/end', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEq.mockResolvedValue({ error: null, data: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })
  })

  it('updates session status to ended and returns 200 with ok: true', async () => {
    const request = new Request('http://localhost/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: VALID_SESSION_ID,
        durationSeconds: 120,
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.ok).toBe(true)

    expect(mockFrom).toHaveBeenCalledWith('sessions')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ended',
        duration_seconds: 120,
      }),
    )
    expect(mockEq).toHaveBeenCalledWith('id', VALID_SESSION_ID)
  })

  it('returns shortSession: true when durationSeconds is less than MIN_SESSION_DURATION_SECONDS', async () => {
    const request = new Request('http://localhost/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: VALID_SESSION_ID,
        durationSeconds: 3,
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.shortSession).toBe(true)
  })

  it('returns shortSession: false when durationSeconds >= MIN_SESSION_DURATION_SECONDS', async () => {
    const request = new Request('http://localhost/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: VALID_SESSION_ID,
        durationSeconds: 10,
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.shortSession).toBe(false)
  })

  it('returns 400 when sessionId is not a valid UUID', async () => {
    const request = new Request('http://localhost/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'not-a-uuid',
        durationSeconds: 120,
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 when durationSeconds is negative', async () => {
    const request = new Request('http://localhost/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: VALID_SESSION_ID,
        durationSeconds: -1,
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 500 when Supabase update fails', async () => {
    mockEq.mockResolvedValue({ error: { message: 'DB error' }, data: null })

    const request = new Request('http://localhost/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: VALID_SESSION_ID,
        durationSeconds: 120,
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })
})

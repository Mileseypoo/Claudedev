import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSessionLifecycle } from './useSessionLifecycle'

// Mock fetch globally for API calls
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  configurable: true,
  writable: true,
})

const VALID_SESSION_ID = '550e8400-e29b-41d4-a716-446655440000'

function mockStartResponse(sessionId = VALID_SESSION_ID) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ sessionId }),
  })
}

function mockPauseResponse() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ok: true }),
  })
}

function mockEndResponse() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ok: true, shortSession: false }),
  })
}

describe('useSessionLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  it('consent confirm transitions state to active and calls POST /api/session/start', async () => {
    mockStartResponse()

    const { result } = renderHook(() => useSessionLifecycle())
    expect(result.current.status).toBe('idle')

    await act(async () => {
      await result.current.start('2026-03-15T20:00:00.000Z')
    })

    expect(result.current.status).toBe('active')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/session/start',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('consentConfirmedAt'),
      }),
    )
  })

  it('localStorage key dictator_session_recovery written on session start', async () => {
    mockStartResponse()

    const { result } = renderHook(() => useSessionLifecycle())

    await act(async () => {
      await result.current.start('2026-03-15T20:00:00.000Z')
    })

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'dictator_session_recovery',
      expect.stringContaining(VALID_SESSION_ID),
    )
  })

  it('pause transitions state from active to paused and calls POST /api/session/pause with action=pause', async () => {
    mockStartResponse()
    mockPauseResponse()

    const { result } = renderHook(() => useSessionLifecycle())

    await act(async () => {
      await result.current.start('2026-03-15T20:00:00.000Z')
    })

    await act(async () => {
      await result.current.pause()
    })

    expect(result.current.status).toBe('paused')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/session/pause',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"pause"'),
      }),
    )
  })

  it('resume transitions state from paused to active and calls POST /api/session/pause with action=resume', async () => {
    mockStartResponse()
    mockPauseResponse() // pause
    mockPauseResponse() // resume

    const { result } = renderHook(() => useSessionLifecycle())

    await act(async () => {
      await result.current.start('2026-03-15T20:00:00.000Z')
    })
    await act(async () => {
      await result.current.pause()
    })
    await act(async () => {
      await result.current.resume()
    })

    expect(result.current.status).toBe('active')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/session/pause',
      expect.objectContaining({
        body: expect.stringContaining('"resume"'),
      }),
    )
  })

  it('end transitions state to ended, calls POST /api/session/end, and clears localStorage', async () => {
    mockStartResponse()
    mockEndResponse()

    const { result } = renderHook(() => useSessionLifecycle())

    await act(async () => {
      await result.current.start('2026-03-15T20:00:00.000Z')
    })
    await act(async () => {
      await result.current.end()
    })

    expect(result.current.status).toBe('ended')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/session/end',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('sessionId'),
      }),
    )
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('dictator_session_recovery')
  })

  it('localStorage key cleared on clean session end', async () => {
    mockStartResponse()
    mockEndResponse()

    const { result } = renderHook(() => useSessionLifecycle())

    await act(async () => {
      await result.current.start('2026-03-15T20:00:00.000Z')
    })
    await act(async () => {
      await result.current.end()
    })

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('dictator_session_recovery')
  })

  it('interrupt() transitions active state to interrupted without clearing localStorage', async () => {
    mockStartResponse()

    const { result } = renderHook(() => useSessionLifecycle())

    await act(async () => {
      await result.current.start('2026-03-15T20:00:00.000Z')
    })

    act(() => {
      result.current.interrupt()
    })

    expect(result.current.status).toBe('interrupted')
    // localStorage should NOT be cleared on interrupt (agent needs to resume)
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalled()
  })

  it('cannot pause when status is idle (invalid transition)', async () => {
    const { result } = renderHook(() => useSessionLifecycle())

    await act(async () => {
      await result.current.pause()
    })

    // Status should remain idle; no fetch call made for pause
    expect(result.current.status).toBe('idle')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

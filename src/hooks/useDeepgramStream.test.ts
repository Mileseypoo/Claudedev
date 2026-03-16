import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDeepgramStream } from './useDeepgramStream'

// ---------------------------------------------------------------------------
// WebSocket mock
// ---------------------------------------------------------------------------

interface MockWSInstance {
  url: string
  protocols: string | string[]
  binaryType: string
  readyState: number
  onopen: (() => void) | null
  onclose: (() => void) | null
  onerror: ((err: Event) => void) | null
  onmessage: ((evt: { data: string }) => void) | null
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

let mockWSInstance: MockWSInstance | null = null

class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3
  url: string
  protocols: string | string[]
  binaryType = 'blob'
  readyState = 1 // OPEN
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((err: Event) => void) | null = null
  onmessage: ((evt: { data: string }) => void) | null = null
  send = vi.fn()
  close = vi.fn()

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocols = protocols ?? []
    mockWSInstance = this as unknown as MockWSInstance
    // Simulate async open
    setTimeout(() => this.onopen?.(), 0)
  }
}

// Mock fetch for /api/deepgram-token
const mockFetch = vi.fn()

beforeEach(() => {
  mockWSInstance = null
  vi.stubGlobal('WebSocket', MockWebSocket)
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ token: 'test-token', wsUrl: 'wss://api.deepgram.com/v1/listen' }),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDeepgramStream', () => {
  describe('startStream()', () => {
    it('fetches /api/deepgram-token before opening WebSocket', async () => {
      const { result } = renderHook(() => useDeepgramStream())

      await act(async () => {
        await result.current.startStream('session-123', 'audio/webm;codecs=opus')
        // Let the setTimeout(onopen) fire
        await new Promise((r) => setTimeout(r, 10))
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/deepgram-token', { method: 'POST' })
    })

    it('opens a WebSocket to wsUrl with apikey as URL query param', async () => {
      const { result } = renderHook(() => useDeepgramStream())

      await act(async () => {
        await result.current.startStream('session-123', 'audio/webm;codecs=opus')
        await new Promise((r) => setTimeout(r, 10))
      })

      expect(mockWSInstance).not.toBeNull()
      expect(mockWSInstance!.url).toContain('api.deepgram.com')
      expect(mockWSInstance!.url).toContain('apikey=test-token')
    })

    it('sets connectionState to "connected" on WebSocket open', async () => {
      const { result } = renderHook(() => useDeepgramStream())

      await act(async () => {
        await result.current.startStream('session-123', 'audio/webm;codecs=opus')
        await new Promise((r) => setTimeout(r, 10))
      })

      expect(result.current.connectionState).toBe('connected')
    })
  })

  describe('transcript chunk persistence (SESS-06)', () => {
    it('fires POST /api/session/chunk immediately on each is_final Deepgram event with non-empty transcript', async () => {
      const { result } = renderHook(() => useDeepgramStream())

      await act(async () => {
        await result.current.startStream('session-123', 'audio/webm;codecs=opus')
        await new Promise((r) => setTimeout(r, 10))
      })

      // Reset fetch call count after startStream (which called /api/deepgram-token)
      mockFetch.mockClear()
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      })

      // Simulate a Deepgram is_final message
      const deepgramMessage = {
        type: 'Results',
        is_final: true,
        start: 1.5,
        channel: {
          alternatives: [{ transcript: 'Hello world' }],
        },
      }

      await act(async () => {
        mockWSInstance!.onmessage?.({ data: JSON.stringify(deepgramMessage) })
        await new Promise((r) => setTimeout(r, 10))
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/session/chunk',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: expect.stringContaining('Hello world'),
        }),
      )

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string,
      )
      expect(body.sessionId).toBe('session-123')
      expect(body.text).toBe('Hello world')
      expect(body.startSeconds).toBe(1.5)
    })

    it('does NOT fire POST /api/session/chunk for non-final Deepgram events', async () => {
      const { result } = renderHook(() => useDeepgramStream())

      await act(async () => {
        await result.current.startStream('session-123', 'audio/webm;codecs=opus')
        await new Promise((r) => setTimeout(r, 10))
      })

      mockFetch.mockClear()

      // Simulate a non-final (interim) Deepgram message
      const interimMessage = {
        type: 'Results',
        is_final: false,
        start: 0.5,
        channel: {
          alternatives: [{ transcript: 'Hello' }],
        },
      }

      await act(async () => {
        mockWSInstance!.onmessage?.({ data: JSON.stringify(interimMessage) })
        await new Promise((r) => setTimeout(r, 10))
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('does NOT fire POST for is_final events with empty transcript', async () => {
      const { result } = renderHook(() => useDeepgramStream())

      await act(async () => {
        await result.current.startStream('session-123', 'audio/webm;codecs=opus')
        await new Promise((r) => setTimeout(r, 10))
      })

      mockFetch.mockClear()

      const emptyFinalMessage = {
        type: 'Results',
        is_final: true,
        start: 2.0,
        channel: {
          alternatives: [{ transcript: '   ' }],
        },
      }

      await act(async () => {
        mockWSInstance!.onmessage?.({ data: JSON.stringify(emptyFinalMessage) })
        await new Promise((r) => setTimeout(r, 10))
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('increments sequence counter for each chunk', async () => {
      const { result } = renderHook(() => useDeepgramStream())

      await act(async () => {
        await result.current.startStream('session-123', 'audio/webm;codecs=opus')
        await new Promise((r) => setTimeout(r, 10))
      })

      mockFetch.mockClear()
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

      const makeMessage = (text: string, start: number) => ({
        type: 'Results',
        is_final: true,
        start,
        channel: { alternatives: [{ transcript: text }] },
      })

      await act(async () => {
        mockWSInstance!.onmessage?.({ data: JSON.stringify(makeMessage('First chunk', 1.0)) })
        await new Promise((r) => setTimeout(r, 5))
        mockWSInstance!.onmessage?.({ data: JSON.stringify(makeMessage('Second chunk', 2.0)) })
        await new Promise((r) => setTimeout(r, 5))
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)

      const firstBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
      const secondBody = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string)

      expect(firstBody.sequence).toBe(0)
      expect(secondBody.sequence).toBe(1)
    })
  })

  describe('stopStream()', () => {
    it('sends CloseStream message before closing WebSocket', async () => {
      const { result } = renderHook(() => useDeepgramStream())

      await act(async () => {
        await result.current.startStream('session-123', 'audio/webm;codecs=opus')
        await new Promise((r) => setTimeout(r, 10))
      })

      act(() => {
        result.current.stopStream()
      })

      expect(mockWSInstance!.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'CloseStream' }),
      )
      expect(mockWSInstance!.close).toHaveBeenCalled()
    })
  })

  describe('WebSocket close/error', () => {
    it('sets connectionState to "disconnected" on WebSocket close', async () => {
      const { result } = renderHook(() => useDeepgramStream())

      await act(async () => {
        await result.current.startStream('session-123', 'audio/webm;codecs=opus')
        await new Promise((r) => setTimeout(r, 10))
      })

      await act(async () => {
        mockWSInstance!.onclose?.()
      })

      expect(result.current.connectionState).toBe('disconnected')
    })

    it('sets connectionState to "disconnected" on WebSocket error', async () => {
      const { result } = renderHook(() => useDeepgramStream())

      await act(async () => {
        await result.current.startStream('session-123', 'audio/webm;codecs=opus')
        await new Promise((r) => setTimeout(r, 10))
      })

      await act(async () => {
        mockWSInstance!.onerror?.(new Event('error'))
      })

      expect(result.current.connectionState).toBe('disconnected')
    })
  })
})

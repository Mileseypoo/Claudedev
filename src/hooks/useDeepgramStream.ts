import { useState, useRef, useCallback } from 'react'

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected'

interface DeepgramStreamOptions {
  onMicInterrupted?: () => void
}

export function useDeepgramStream(options: DeepgramStreamOptions = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const wsRef = useRef<WebSocket | null>(null)
  const chunkSequenceRef = useRef<number>(0)
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionIdRef = useRef<string>('')

  // ---------------------------------------------------------------------------
  // Heartbeat guard (research anti-pattern supplement for iOS visibilitychange)
  // If ondataavailable hasn't fired in > 5000ms during an active session,
  // the mic may have been interrupted. Calls onMicInterrupted callback.
  // ---------------------------------------------------------------------------
  const resetHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current)
    heartbeatTimerRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        options.onMicInterrupted?.()
      }
    }, 5000)
  }, [options])

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
  }, [])

  // ---------------------------------------------------------------------------
  // startStream
  // 1. Fetch short-lived token from /api/deepgram-token
  // 2. Build WebSocket URL with query params matching mimeType
  // 3. Open browser-direct WebSocket to Deepgram (never relay through Next.js)
  // 4. On is_final transcript: POST immediately to /api/session/chunk
  // ---------------------------------------------------------------------------
  const startStream = useCallback(
    async (sessionId: string, mimeType: string) => {
      sessionIdRef.current = sessionId
      chunkSequenceRef.current = 0
      setConnectionState('connecting')

      // Step 1: Get short-lived token from our API
      // Source: https://deepgram.com/learn/protecting-api-key
      const { token, wsUrl } = await fetch('/api/deepgram-token', {
        method: 'POST',
      }).then((r) => r.json())

      // Step 2: Build URL with Deepgram query params
      // Source: https://developers.deepgram.com/docs/lower-level-websockets
      const url = new URL(wsUrl)
      url.searchParams.set('model', 'nova-2')
      url.searchParams.set('smart_format', 'true')
      url.searchParams.set('interim_results', 'true')
      // Pass encoding hint if mimeType is opus-based (mp4/aac: Deepgram auto-detects)
      if (mimeType.includes('opus')) {
        url.searchParams.set('encoding', 'opus')
        url.searchParams.set('sample_rate', '16000')
      }

      // Step 3: Open browser-direct WebSocket (ANTI-PATTERN: no relay through Next.js)
      const ws = new WebSocket(url.toString(), ['token', token])
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = () => {
        setConnectionState('connected')
        resetHeartbeat()
      }

      ws.onmessage = (event) => {
        try {
          const result = JSON.parse(event.data as string)

          // Step 4: On is_final with non-empty transcript, persist immediately (SESS-06)
          if (
            result.type === 'Results' &&
            result.is_final &&
            result.channel?.alternatives?.[0]?.transcript?.trim()
          ) {
            const transcript = result.channel.alternatives[0].transcript
            fetch('/api/session/chunk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: sessionIdRef.current,
                sequence: chunkSequenceRef.current++,
                text: transcript,
                startSeconds: result.start,
              }),
            }).catch(() => {
              // Non-blocking: chunk save failure should not crash the session
              // Recovery: chunks can be reconstructed from Deepgram webhooks if needed
            })

            resetHeartbeat()
          }
        } catch {
          // Ignore malformed messages
        }
      }

      ws.onclose = () => {
        setConnectionState('disconnected')
        clearHeartbeat()
      }

      ws.onerror = () => {
        setConnectionState('disconnected')
        clearHeartbeat()
      }
    },
    [resetHeartbeat, clearHeartbeat],
  )

  // ---------------------------------------------------------------------------
  // stopStream — sends CloseStream signal before closing WebSocket
  // ---------------------------------------------------------------------------
  const stopStream = useCallback(() => {
    clearHeartbeat()
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'CloseStream' }))
      }
      wsRef.current.close()
      wsRef.current = null
    }
    setConnectionState('idle')
  }, [clearHeartbeat])

  // ---------------------------------------------------------------------------
  // pauseStream — sends KeepAlive to maintain connection during MediaRecorder.pause()
  // Source: Deepgram KeepAlive docs
  // ---------------------------------------------------------------------------
  const pauseStream = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'KeepAlive' }))
    }
    clearHeartbeat()
  }, [clearHeartbeat])

  // ---------------------------------------------------------------------------
  // sendAudioChunk — forwards raw audio blob to Deepgram over binary WebSocket
  // Called from MediaRecorder.ondataavailable
  // ---------------------------------------------------------------------------
  const sendAudioChunk = useCallback(async (blob: Blob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const buffer = await blob.arrayBuffer()
      wsRef.current.send(buffer)
      resetHeartbeat()
    }
  }, [resetHeartbeat])

  return {
    connectionState,
    startStream,
    stopStream,
    pauseStream,
    sendAudioChunk,
  }
}

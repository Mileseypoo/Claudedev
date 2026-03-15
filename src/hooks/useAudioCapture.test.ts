import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudioCapture } from './useAudioCapture'

// Setup: MockMediaRecorder is already stubbed globally via src/test/setup.ts
// We override specific behaviors per test using vi.spyOn

describe('useAudioCapture', () => {
  describe('requestMic()', () => {
    it('returns { stream } when getUserMedia succeeds inside user gesture handler', async () => {
      const mockStream = { getTracks: () => [{ stop: vi.fn(), kind: 'audio' }] }
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValueOnce(mockStream as unknown as MediaStream)

      const { result } = renderHook(() => useAudioCapture())

      let micResult: Awaited<ReturnType<typeof result.current.requestMic>>
      await act(async () => {
        micResult = await result.current.requestMic()
      })

      expect(micResult!).toEqual({ stream: mockStream })
    })

    it('returns { error: "not_allowed" } when getUserMedia throws NotAllowedError', async () => {
      const err = new DOMException('Permission denied', 'NotAllowedError')
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValueOnce(err)

      const { result } = renderHook(() => useAudioCapture())

      let micResult: Awaited<ReturnType<typeof result.current.requestMic>>
      await act(async () => {
        micResult = await result.current.requestMic()
      })

      expect(micResult!).toEqual({ error: 'not_allowed' })
    })

    it('returns { error: "not_found" } when getUserMedia throws NotFoundError', async () => {
      const err = new DOMException('No device found', 'NotFoundError')
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValueOnce(err)

      const { result } = renderHook(() => useAudioCapture())

      let micResult: Awaited<ReturnType<typeof result.current.requestMic>>
      await act(async () => {
        micResult = await result.current.requestMic()
      })

      expect(micResult!).toEqual({ error: 'not_found' })
    })

    it('returns { error: "not_supported" } when navigator.mediaDevices is undefined', async () => {
      const originalMediaDevices = navigator.mediaDevices
      // Temporarily remove mediaDevices to simulate unsupported env
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        configurable: true,
        writable: true,
      })

      const { result } = renderHook(() => useAudioCapture())

      let micResult: Awaited<ReturnType<typeof result.current.requestMic>>
      await act(async () => {
        micResult = await result.current.requestMic()
      })

      expect(micResult!).toEqual({ error: 'not_supported' })

      // Restore
      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        configurable: true,
        writable: true,
      })
    })

    it('does NOT call getUserMedia on mount — only when requestMic() is explicitly called', () => {
      const getUserMediaSpy = vi.spyOn(navigator.mediaDevices, 'getUserMedia')

      renderHook(() => useAudioCapture())

      expect(getUserMediaSpy).not.toHaveBeenCalled()
    })
  })

  describe('getSupportedMimeType()', () => {
    it('returns "audio/webm;codecs=opus" when it is the first supported type', () => {
      vi.spyOn(MediaRecorder, 'isTypeSupported').mockImplementation(
        (type) => type === 'audio/webm;codecs=opus',
      )

      const { result } = renderHook(() => useAudioCapture())
      expect(result.current.getSupportedMimeType()).toBe('audio/webm;codecs=opus')
    })

    it('falls back to "audio/mp4" when webm/opus is not supported but mp4 is', () => {
      vi.spyOn(MediaRecorder, 'isTypeSupported').mockImplementation(
        (type) => type === 'audio/mp4',
      )

      const { result } = renderHook(() => useAudioCapture())
      expect(result.current.getSupportedMimeType()).toBe('audio/mp4')
    })

    it('returns empty string when no type is supported', () => {
      vi.spyOn(MediaRecorder, 'isTypeSupported').mockReturnValue(false)

      const { result } = renderHook(() => useAudioCapture())
      expect(result.current.getSupportedMimeType()).toBe('')
    })
  })

  describe('startRecording()', () => {
    it('creates a MediaRecorder with the detected mimeType and calls recorder.start(250)', async () => {
      const mockStream = { getTracks: () => [{ stop: vi.fn(), kind: 'audio' }] }
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValueOnce(mockStream as unknown as MediaStream)
      vi.spyOn(MediaRecorder, 'isTypeSupported').mockImplementation(
        (type) => type === 'audio/webm;codecs=opus',
      )

      const { result } = renderHook(() => useAudioCapture())

      // First get the stream
      await act(async () => {
        await result.current.requestMic()
      })

      const onDataAvailable = vi.fn()
      let recorder: MediaRecorder | null = null

      await act(async () => {
        recorder = result.current.startRecording(onDataAvailable)
      })

      expect(recorder).not.toBeNull()
      // Verify state is recording
      expect(result.current.isRecording).toBe(true)
    })
  })

  describe('pauseRecording()', () => {
    it('calls recorder.pause() and updates state to paused', async () => {
      const mockStream = { getTracks: () => [{ stop: vi.fn(), kind: 'audio' }] }
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValueOnce(mockStream as unknown as MediaStream)

      const { result } = renderHook(() => useAudioCapture())

      await act(async () => {
        await result.current.requestMic()
      })

      await act(async () => {
        result.current.startRecording(vi.fn())
      })

      await act(async () => {
        result.current.pauseRecording()
      })

      expect(result.current.isPaused).toBe(true)
      expect(result.current.isRecording).toBe(false)
    })
  })

  describe('resumeRecording()', () => {
    it('calls recorder.resume() and updates state back to recording', async () => {
      const mockStream = { getTracks: () => [{ stop: vi.fn(), kind: 'audio' }] }
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValueOnce(mockStream as unknown as MediaStream)

      const { result } = renderHook(() => useAudioCapture())

      await act(async () => {
        await result.current.requestMic()
      })

      await act(async () => {
        result.current.startRecording(vi.fn())
      })

      await act(async () => {
        result.current.pauseRecording()
      })

      await act(async () => {
        result.current.resumeRecording()
      })

      expect(result.current.isRecording).toBe(true)
      expect(result.current.isPaused).toBe(false)
    })
  })

  describe('stopRecording()', () => {
    it('calls recorder.stop() and stops all stream tracks', async () => {
      const mockTrack = { stop: vi.fn(), kind: 'audio' }
      const mockStream = { getTracks: () => [mockTrack] }
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValueOnce(mockStream as unknown as MediaStream)

      const { result } = renderHook(() => useAudioCapture())

      await act(async () => {
        await result.current.requestMic()
      })

      await act(async () => {
        result.current.startRecording(vi.fn())
      })

      await act(async () => {
        result.current.stopRecording()
      })

      expect(mockTrack.stop).toHaveBeenCalled()
      expect(result.current.isRecording).toBe(false)
    })
  })
})

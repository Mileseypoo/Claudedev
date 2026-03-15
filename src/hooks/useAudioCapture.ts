import { useState, useCallback } from 'react'

export type MicError = 'not_allowed' | 'not_found' | 'not_supported' | 'unknown'
export type MicResult = { stream: MediaStream } | { error: MicError }

interface AudioCaptureState {
  recorder: MediaRecorder | null
  stream: MediaStream | null
  mimeType: string
  isRecording: boolean
  isPaused: boolean
  error: MicError | null
}

export function useAudioCapture() {
  const [state, setState] = useState<AudioCaptureState>({
    recorder: null,
    stream: null,
    mimeType: '',
    isRecording: false,
    isPaused: false,
    error: null,
  })

  /**
   * Detect the best supported audio MIME type for MediaRecorder.
   * Tries types in priority order; returns first supported or '' if none.
   * Source: https://www.buildwithmatija.com/blog/iphone-safari-mediarecorder-audio-recording-transcription
   */
  const getSupportedMimeType = useCallback((): string => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ]
    return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
  }, [])

  /**
   * Request microphone access. MUST be called inside a user gesture handler
   * (e.g., consent modal confirm button) — never on mount.
   *
   * Returns { stream } on success.
   * Returns { error } on failure — never throws.
   */
  const requestMic = useCallback(async (): Promise<MicResult> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState((s) => ({ ...s, error: 'not_supported' }))
      return { error: 'not_supported' }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      setState((s) => ({ ...s, stream, error: null }))
      return { stream }
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setState((s) => ({ ...s, error: 'not_allowed' }))
          return { error: 'not_allowed' }
        }
        if (err.name === 'NotFoundError') {
          setState((s) => ({ ...s, error: 'not_found' }))
          return { error: 'not_found' }
        }
      }
      setState((s) => ({ ...s, error: 'unknown' }))
      return { error: 'unknown' }
    }
  }, [])

  /**
   * Create a MediaRecorder and start recording.
   * MUST call requestMic() first to obtain a stream.
   *
   * @param onDataAvailable - Called on each 250ms audio chunk (for streaming to Deepgram)
   * @returns The MediaRecorder instance, or null if no stream available
   */
  const startRecording = useCallback(
    (onDataAvailable: (blob: Blob) => void): MediaRecorder | null => {
      if (!state.stream) return null

      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(
        state.stream,
        mimeType ? { mimeType } : undefined,
      )

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          onDataAvailable(event.data)
        }
      }

      recorder.onstart = () => {
        setState((s) => ({ ...s, isRecording: true, isPaused: false }))
      }

      recorder.onpause = () => {
        setState((s) => ({ ...s, isPaused: true, isRecording: false }))
      }

      recorder.onresume = () => {
        setState((s) => ({ ...s, isPaused: false, isRecording: true }))
      }

      recorder.onstop = () => {
        setState((s) => ({ ...s, isRecording: false, isPaused: false }))
      }

      // Start with 250ms timeslice for streaming — each ondataavailable fires every 250ms
      recorder.start(250)

      setState((s) => ({ ...s, recorder, mimeType, isRecording: true }))
      return recorder
    },
    [state.stream, getSupportedMimeType],
  )

  const pauseRecording = useCallback(() => {
    if (state.recorder && state.recorder.state === 'recording') {
      state.recorder.pause()
      setState((s) => ({ ...s, isPaused: true, isRecording: false }))
    }
  }, [state.recorder])

  const resumeRecording = useCallback(() => {
    if (state.recorder && state.recorder.state === 'paused') {
      state.recorder.resume()
      setState((s) => ({ ...s, isPaused: false, isRecording: true }))
    }
  }, [state.recorder])

  const stopRecording = useCallback(() => {
    if (state.recorder && state.recorder.state !== 'inactive') {
      state.recorder.stop()
    }
    // Stop all media tracks to release the mic
    state.stream?.getTracks().forEach((track) => track.stop())
    setState((s) => ({
      ...s,
      isRecording: false,
      isPaused: false,
      recorder: null,
    }))
  }, [state.recorder, state.stream])

  return {
    // State
    recorder: state.recorder,
    stream: state.stream,
    mimeType: state.mimeType,
    isRecording: state.isRecording,
    isPaused: state.isPaused,
    error: state.error,
    // Actions
    requestMic,
    getSupportedMimeType,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  }
}

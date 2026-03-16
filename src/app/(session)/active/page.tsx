'use client'

import { useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle'
import { useAudioCapture } from '@/hooks/useAudioCapture'
import { useDeepgramStream } from '@/hooks/useDeepgramStream'
import { useWakeLock } from '@/hooks/useWakeLock'
import { useVisibilityGuard } from '@/hooks/useVisibilityGuard'
import { MicIndicator } from '@/components/session/MicIndicator'
import { SessionTimer } from '@/components/session/SessionTimer'
import { SessionControls } from '@/components/session/SessionControls'
import { StatusBanner } from '@/components/session/StatusBanner'

/**
 * Inner component that uses useSearchParams() — must be wrapped in <Suspense>.
 * https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
 */
function ActiveSessionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionIdParam = searchParams.get('sessionId')

  const lifecycle = useSessionLifecycle()
  const audio = useAudioCapture()
  const stream = useDeepgramStream({
    onMicInterrupted: () => {
      lifecycle.interrupt()
    },
  })
  const wakeLock = useWakeLock()

  // On mount: if we have a sessionId param, restore from recovery; otherwise start audio pipeline
  // Note: lifecycle.sessionId may not be populated yet in this effect — use sessionIdParam directly
  // For fresh sessions, sessionId was set by lifecycle.start() before navigation (via router.push)
  // and will be available via lifecycle.sessionId on the next render after hydration
  useEffect(() => {
    if (sessionIdParam) {
      // Recovery resume: restore lifecycle without a new API call
      lifecycle.restore(sessionIdParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdParam])

  // Start audio pipeline once sessionId is known
  useEffect(() => {
    const activeSessionId = sessionIdParam ?? lifecycle.sessionId
    if (!activeSessionId) return
    // Only start stream when lifecycle is active
    if (lifecycle.status !== 'active') return

    async function startAudio() {
      const micResult = await audio.requestMic()
      if ('error' in micResult) {
        // Mic access denied — StatusBanner will show via audio.error
        return
      }

      audio.startRecording((blob: Blob) => {
        stream.sendAudioChunk(blob)
      })

      stream.startStream(activeSessionId!, audio.mimeType)

      wakeLock.requestWakeLock()
    }

    startAudio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifecycle.sessionId, lifecycle.status])

  const handlePause = useCallback(async () => {
    await lifecycle.pause()
    audio.pauseRecording()
    stream.pauseStream()
  }, [lifecycle, audio, stream])

  const handleResume = useCallback(async () => {
    await lifecycle.resume()
    audio.resumeRecording()
    // Stream resumes because KeepAlive kept it open
  }, [lifecycle, audio])

  const handleEnd = useCallback(async () => {
    await lifecycle.end()
    audio.stopRecording()
    stream.stopStream()
    await wakeLock.releaseWakeLock()
    router.push('/')
  }, [lifecycle, audio, stream, wakeLock, router])

  // Visibility guard: pause on hide, show banner on return (no auto-resume)
  useVisibilityGuard(
    () => {
      // onHide: interrupt lifecycle + pause audio + send KeepAlive
      lifecycle.interrupt()
      audio.pauseRecording()
      stream.pauseStream()
    },
    () => {
      // onShow: do nothing — agent must tap Resume (locked decision)
    },
  )

  return (
    <div className="flex flex-col h-full bg-[var(--brand-bg)]">
      {/* Status banner — shown when WakeLock unavailable or mic stopped */}
      <StatusBanner
        showWakeLockWarning={wakeLock.needsManualWarning}
        showMicStopped={lifecycle.status === 'interrupted'}
        onResume={handleResume}
      />

      {/* Phase 3: answer cards will appear here */}
      <div className="flex-1" />

      {/* Center: mic indicator + timer */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <MicIndicator isRecording={audio.isRecording} />
          <SessionTimer elapsedSeconds={lifecycle.elapsedSeconds} />
        </div>
      </div>

      {/* Bottom: session controls */}
      <div className="pb-8 px-6">
        <SessionControls
          onPause={handlePause}
          onResume={handleResume}
          onEnd={handleEnd}
          isPaused={lifecycle.status === 'paused'}
        />
      </div>
    </div>
  )
}

/**
 * Active session page — wraps content in Suspense for useSearchParams() requirement.
 */
export default function ActiveSessionPage() {
  return (
    <Suspense>
      <ActiveSessionContent />
    </Suspense>
  )
}

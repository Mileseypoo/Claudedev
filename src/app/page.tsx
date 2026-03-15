'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle'
import { ConsentModal } from '@/components/session/ConsentModal'
import { SESSION_RECOVERY_KEY } from '@/lib/constants'

export default function Home() {
  const router = useRouter()
  const lifecycle = useSessionLifecycle()
  const [consentModalOpen, setConsentModalOpen] = useState(false)

  // Redirect to recovery screen if a session is in progress
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_RECOVERY_KEY)
    if (stored) {
      router.replace('/recovery')
    }
  }, [router])

  async function handleConsentConfirm(consentTimestamp: string) {
    await lifecycle.start(consentTimestamp)
    router.push('/active')
  }

  return (
    <main className="h-full flex flex-col items-center justify-center bg-[var(--brand-bg)] px-6">
      <div className="flex flex-col items-center gap-8 max-w-sm w-full">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] text-center">
          Dictator
        </h1>
        <p className="text-[var(--text-muted)] text-center">
          Sales Copilot
        </p>

        <button
          className="w-full min-h-[56px] px-10 rounded-full bg-[var(--brand-color)] text-white text-lg font-semibold hover:opacity-90 active:opacity-80 transition-opacity"
          onClick={() => setConsentModalOpen(true)}
        >
          Start Session
        </button>
      </div>

      <ConsentModal
        isOpen={consentModalOpen}
        onConfirm={handleConsentConfirm}
      />
    </main>
  )
}

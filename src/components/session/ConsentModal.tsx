'use client'

interface ConsentModalProps {
  isOpen: boolean
  onConfirm: (consentTimestamp: string) => void
}

/**
 * Pre-recording consent confirmation modal.
 * - Appears before any mic access is requested
 * - Agent must confirm before session starts — no dismiss button
 * - onConfirm receives ISO timestamp for compliance logging
 */
export function ConsentModal({ isOpen, onConfirm }: ConsentModalProps) {
  if (!isOpen) return null

  function handleConfirm() {
    onConfirm(new Date().toISOString())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-heading"
    >
      <div className="bg-[var(--brand-surface,#1a1a2e)] rounded-2xl p-8 mx-4 max-w-sm w-full shadow-2xl">
        <h2
          id="consent-heading"
          className="text-xl font-semibold text-white mb-3"
        >
          Client has consented to recording
        </h2>
        <p className="text-white/60 text-sm mb-8">
          By confirming, you acknowledge that your client has given verbal consent to this session
          being recorded. The consent timestamp will be logged for compliance.
        </p>
        <button
          onClick={handleConfirm}
          className="w-full min-h-[56px] rounded-full bg-white text-[var(--brand-bg,#0f0f1a)] text-lg font-semibold hover:bg-white/90 active:scale-95 transition-all"
        >
          Start Recording
        </button>
      </div>
    </div>
  )
}

'use client'

export default function RecoveryPage() {
  return (
    <main className="h-full flex flex-col items-center justify-center bg-[var(--brand-bg)] px-6">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center">
          Session in progress
        </h1>
        <p className="text-[var(--text-muted)] text-center">
          Your last session was interrupted.
        </p>

        {/* Resume session — wired in Plan 06 */}
        <button
          className="w-full min-h-[56px] px-10 rounded-full bg-[var(--brand-color)] text-white text-lg font-semibold hover:opacity-90 active:opacity-80 transition-opacity"
          onClick={() => {
            // Resume session — wired in Plan 06
          }}
        >
          Resume session
        </button>

        {/* Start fresh — wired in Plan 06 */}
        <button
          className="w-full min-h-[56px] px-10 rounded-full border border-[var(--text-muted)] text-[var(--text-muted)] text-lg font-semibold hover:opacity-90 active:opacity-80 transition-opacity"
          onClick={() => {
            // Start fresh — wired in Plan 06
          }}
        >
          Start fresh
        </button>
      </div>
    </main>
  )
}

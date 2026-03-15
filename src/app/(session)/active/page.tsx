'use client'

export default function ActiveSessionPage() {
  return (
    <div className="flex flex-col h-full bg-[var(--brand-bg)]">
      {/* Cards appear here in Phase 3 */}
      <div className="flex-1" />

      {/* MicIndicator + SessionTimer */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* MicIndicator placeholder — wired in Plan 04 */}
          <div
            className="w-16 h-16 rounded-full bg-[var(--brand-color)] opacity-75"
            aria-label="Recording indicator placeholder"
          />
          {/* SessionTimer placeholder — wired in Plan 04 */}
          <span className="text-[var(--text-muted)] text-sm">00:00</span>
        </div>
      </div>

      {/* SessionControls (Pause + End) */}
      <div className="pb-8 px-6">
        <div className="flex gap-4 justify-center">
          {/* Pause placeholder — wired in Plan 05 */}
          <button
            className="min-h-[56px] px-8 rounded-full border border-[var(--text-muted)] text-[var(--text-muted)] text-lg font-semibold"
            onClick={() => {
              // Pause — wired in Plan 05
            }}
          >
            Pause
          </button>
          {/* End placeholder — wired in Plan 05 */}
          <button
            className="min-h-[56px] px-8 rounded-full bg-red-600 text-white text-lg font-semibold"
            onClick={() => {
              // End — wired in Plan 05
            }}
          >
            End
          </button>
        </div>
      </div>
    </div>
  )
}

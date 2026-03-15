---
phase: 01-foundation
plan: "06"
subsystem: session-management
tags: [react, next-app-router, hooks, tdd, integration, session-lifecycle, audio-capture, deepgram]

requires:
  - phase: 01-04
    provides: useAudioCapture, useDeepgramStream hooks and audio pipeline
  - phase: 01-05
    provides: useSessionLifecycle, useWakeLock, useVisibilityGuard hooks; ConsentModal, MicIndicator, SessionTimer, SessionControls, StatusBanner components

provides:
  - Complete home page (/) wired to ConsentModal + lifecycle.start() + navigation to /active
  - Complete active session page (/active) composing all Phase 1 hooks and components
  - Complete recovery page (/recovery) reading localStorage, Resume/Start Fresh flows
  - restore(sessionId) method on useSessionLifecycle for recovery resume without re-POSTing to API

affects:
  - 01-07 (PWA install verification — the complete session flow is now verifiable on device)

tech-stack:
  added: []
  patterns:
    - "useSearchParams() must be wrapped in <Suspense> in Next.js app router (missing boundary blocks build)"
    - "Stable mock references in vi.mock factories prevent infinite re-render loops in component tests (useRouter returns new object each render)"
    - "Dynamic import in test files causes module caching issues — import pages at the top level with vi.mock hoisting"
    - "useDeepgramStream accepts onMicInterrupted at hook construction level, not startStream call level"

key-files:
  created: []
  modified:
    - src/app/page.tsx
    - src/app/(session)/active/page.tsx
    - src/app/(session)/recovery/page.tsx
    - src/hooks/useSessionLifecycle.ts
    - src/app/page.test.tsx

key-decisions:
  - "useSearchParams() requires Suspense boundary — extracted ActiveSessionContent into inner component; default export wraps in Suspense"
  - "restore(sessionId) method added to useSessionLifecycle: sets sessionId+active state without POSTing to /api/session/start, enabling recovery resume path"
  - "startFresh on recovery page fires POST /api/session/end best-effort (fire and forget, not awaited) before clearing localStorage and navigating"

requirements-completed:
  - SESS-01
  - SESS-02
  - SESS-03
  - SESS-05
  - SESS-06

duration: 33min
completed: 2026-03-15T21:21:27Z
---

# Phase 1 Plan 06: Page Wiring — Complete Session Flow Summary

**Home, active session, and recovery pages fully wired with all Phase 1 hooks and components; 10 TDD-verified integration tests; build passing**

## Performance

- **Duration:** 33 min
- **Started:** 2026-03-15T20:47:53Z
- **Completed:** 2026-03-15T21:21:27Z
- **Tasks:** 2 of 2
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments

- `src/app/page.tsx`: ConsentModal wired; `lifecycle.start(consentTimestamp)` called on confirm; redirect to /recovery if SESSION_RECOVERY_KEY in localStorage; `router.push('/active')` on success
- `src/app/(session)/active/page.tsx`: All hooks composed (lifecycle, audio capture, deepgram stream, wakelock, visibility guard); MicIndicator, SessionTimer, SessionControls, StatusBanner rendered; recovery `?sessionId` param support; Suspense boundary for useSearchParams
- `src/app/(session)/recovery/page.tsx`: Reads SESSION_RECOVERY_KEY from localStorage; shows session info with started-at time; Resume navigates to `/active?sessionId=...`; Start Fresh fires best-effort end, clears key, navigates to /; redirects to / when no key or malformed JSON
- `src/hooks/useSessionLifecycle.ts`: Added `restore(sessionId)` method — transitions to 'active' with given sessionId without POSTing to /api/session/start
- `src/app/page.test.tsx`: 10 TDD integration tests covering all three pages (home, active, recovery)

## Task Commits

1. **RED: Failing tests for all three pages** — `da2c4bf` (test)
2. **GREEN: Wire all pages + restore() method** — `87dbcb9` (feat)
3. **FIX: Suspense boundary for useSearchParams** — `7f0089c` (fix)

## Files Created/Modified

- `src/app/page.tsx` — Home screen: Start Session button, ConsentModal, lifecycle.start(), recovery redirect
- `src/app/(session)/active/page.tsx` — Active session: all hooks wired, full UI rendered, Suspense wrapper
- `src/app/(session)/recovery/page.tsx` — Recovery: localStorage read, Resume/Start Fresh flows
- `src/hooks/useSessionLifecycle.ts` — Added restore() method for recovery resume path
- `src/app/page.test.tsx` — 10 integration tests (home x4, active x2, recovery x4)

## Decisions Made

- `useSearchParams()` in active page requires Suspense — extracted inner `ActiveSessionContent` component, default export wraps in `<Suspense>`. This is a Next.js app router requirement.
- `restore(sessionId)` method: recovery resume must not POST to /api/session/start (session already exists in DB). New method sets state to 'active' + sessionId directly.
- Recovery "Start Fresh": fires `POST /api/session/end` for old session as best effort (not awaited, errors ignored), then clears localStorage and navigates home.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useDeepgramStream onMicInterrupted is a hook-level option, not a startStream argument**
- **Found during:** Task 1 (GREEN phase, TypeScript compile error)
- **Issue:** Plan's `<interfaces>` block specified `startStream(sessionId, mimeType, { onMicInterrupted })` as a 3-argument call. The actual implementation uses `useDeepgramStream({ onMicInterrupted })` hook-level options; `startStream` only takes 2 arguments.
- **Fix:** Moved `onMicInterrupted: () => lifecycle.interrupt()` to the `useDeepgramStream({...})` hook call
- **Files modified:** `src/app/(session)/active/page.tsx`
- **Verification:** `npx tsc --noEmit` clean; tests pass
- **Committed in:** 87dbcb9 (Task GREEN commit)

**2. [Rule 1 - Bug] Unstable router mock reference caused infinite re-render loop in recovery page test**
- **Found during:** Task 1+2 test debugging (test hanging indefinitely)
- **Issue:** `vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }))` returns a new object reference on every call. Recovery page's `useEffect([router])` detected the reference change on each render → infinite loop
- **Fix:** Created a stable `const mockRouter = { push: mockPush, replace: mockReplace }` and returned it from the mock
- **Files modified:** `src/app/page.test.tsx`
- **Verification:** Previously hanging tests now pass in ~50ms
- **Committed in:** 87dbcb9

**3. [Rule 3 - Blocking] Missing Suspense boundary around useSearchParams() prevented Next.js build**
- **Found during:** Final build verification (`npx next build`)
- **Issue:** Next.js app router requires `useSearchParams()` to be wrapped in `<Suspense>` during static page generation; build exited with error on `/active`
- **Fix:** Extracted inner component `ActiveSessionContent`; default export `ActiveSessionPage` wraps it in `<Suspense>`
- **Files modified:** `src/app/(session)/active/page.tsx`
- **Verification:** `npx next build` completes successfully; all static pages generated
- **Committed in:** 7f0089c

---

**Total deviations:** 3 auto-fixed (2 Rule 1 - Bug, 1 Rule 3 - Blocking)
**Impact on plan:** All three fixes essential for correct type signatures, test stability, and production build. No scope creep.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete Phase 1 session flow is now end-to-end wired and test-verified
- All 63 automated tests pass; `npx next build` succeeds
- Plan 07 (PWA install verification) can proceed — the session flow is ready for device-level testing
- SESS-01 through SESS-06 requirements are all covered across Plans 03-06

## Self-Check: PASSED

Files verified:
- FOUND: src/app/page.tsx
- FOUND: src/app/(session)/active/page.tsx
- FOUND: src/app/(session)/recovery/page.tsx
- FOUND: src/hooks/useSessionLifecycle.ts

Commits verified:
- FOUND: da2c4bf (RED phase tests)
- FOUND: 87dbcb9 (GREEN phase implementation)
- FOUND: 7f0089c (Suspense fix)

Tests: 63/63 passing (10 new page tests + 53 carried from plans 04-05)
Build: `npx next build` exits 0

---
*Phase: 01-foundation*
*Completed: 2026-03-15*

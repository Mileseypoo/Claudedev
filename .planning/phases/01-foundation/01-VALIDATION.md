---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + React Testing Library (unit/integration); Playwright (E2E PWA) |
| **Config file** | `vitest.config.ts` — Wave 0 gap (does not exist yet) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npx playwright test` |
| **Estimated runtime** | ~30 seconds (unit); ~2 minutes (full with Playwright) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (unit suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| SESS-01a | 01 | 1 | SESS-01 | unit | `npx vitest run src/hooks/useSessionLifecycle.test.ts` | ❌ W0 | ⬜ pending |
| SESS-01b | 01 | 1 | SESS-01 | unit | `npx vitest run src/hooks/useAudioCapture.test.ts` | ❌ W0 | ⬜ pending |
| SESS-02a | 01 | 1 | SESS-02 | unit | `npx vitest run src/components/session/SessionControls.test.tsx` | ❌ W0 | ⬜ pending |
| SESS-02b | 01 | 1 | SESS-02 | integration | `npx vitest run src/app/api/session/end/route.test.ts` | ❌ W0 | ⬜ pending |
| SESS-03 | 01 | 1 | SESS-03 | unit | `npx vitest run src/components/session/MicIndicator.test.tsx` | ❌ W0 | ⬜ pending |
| SESS-04a | 01 | 1 | SESS-04 | unit | `npx vitest run src/hooks/useAudioCapture.test.ts` | ❌ W0 | ⬜ pending |
| SESS-04b | 01 | 1 | SESS-04 | unit | `npx vitest run src/hooks/useAudioCapture.test.ts` | ❌ W0 | ⬜ pending |
| SESS-05a | 01 | 1 | SESS-05 | unit | `npx vitest run src/hooks/useSessionLifecycle.test.ts` | ❌ W0 | ⬜ pending |
| SESS-05b | 01 | 1 | SESS-05 | unit | `npx vitest run src/hooks/useSessionLifecycle.test.ts` | ❌ W0 | ⬜ pending |
| SESS-06a | 01 | 2 | SESS-06 | unit | `npx vitest run src/hooks/useDeepgramStream.test.ts` | ❌ W0 | ⬜ pending |
| SESS-06b | 01 | 2 | SESS-06 | unit | `npx vitest run src/hooks/useSessionLifecycle.test.ts` | ❌ W0 | ⬜ pending |
| SESS-06c | 01 | 2 | SESS-06 | unit | `npx vitest run src/app/page.test.tsx` | ❌ W0 | ⬜ pending |
| PLAT-01a | 02 | 1 | PLAT-01 | unit | `npx vitest run src/app/manifest.test.ts` | ❌ W0 | ⬜ pending |
| PLAT-01b | 02 | 1 | PLAT-01 | unit | `npx vitest run src/app/manifest.test.ts` | ❌ W0 | ⬜ pending |
| PLAT-02a | 02 | 2 | PLAT-02 | integration | `npx vitest run src/db/rls.test.ts` | ❌ W0 | ⬜ pending |
| PLAT-02b | 02 | 2 | PLAT-02 | integration | `npx vitest run src/app/api/session/start/route.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All test infrastructure is missing — greenfield project. Wave 0 must install and stub everything before any implementation tasks run.

- [ ] `vitest.config.ts` — Vitest configuration with jsdom environment
- [ ] `src/test/setup.ts` — shared test setup (jsdom, mock MediaRecorder, mock Supabase client, mock WakeLock)
- [ ] `src/hooks/useSessionLifecycle.test.ts` — stubs for SESS-01, SESS-05, SESS-06
- [ ] `src/hooks/useAudioCapture.test.ts` — stubs for SESS-01, SESS-04
- [ ] `src/hooks/useDeepgramStream.test.ts` — stubs for SESS-06 (chunk persistence)
- [ ] `src/components/session/SessionControls.test.tsx` — stubs for SESS-02
- [ ] `src/components/session/MicIndicator.test.tsx` — stubs for SESS-03
- [ ] `src/app/page.test.tsx` — stubs for SESS-06 recovery screen render
- [ ] `src/app/manifest.test.ts` — stubs for PLAT-01
- [ ] `src/app/api/session/end/route.test.ts` — stubs for SESS-02 server-side
- [ ] `src/app/api/session/start/route.test.ts` — stubs for PLAT-02
- [ ] `src/db/rls.test.ts` — stubs for PLAT-02 RLS isolation

**Framework install (Wave 0 task):**
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event
npm install -D @playwright/test
```

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WakeLock on physical iPhone | SESS-03, PLAT-01 | API behavior differs from mocks; iOS version-dependent (fixed in 18.4) | Install PWA on iPhone, start session, lock screen — confirm recording continues or warning appears |
| MediaRecorder format detection | SESS-01, PLAT-01 | Requires real Safari on iOS to test `audio/mp4` vs `audio/webm` fallback | Start session on iPhone, check Deepgram receives non-empty transcription |
| App-switch mid-session banner | SESS-03, SESS-05 | Requires physical device to trigger app backgrounding | Start session, switch to another app, return — confirm "Recording stopped" banner shown |
| PWA install flow (iOS + Android) | PLAT-01 | Install flow is OS-native, cannot be automated | Follow Add to Home Screen on both platforms; confirm standalone mode |
| One-handed thumb reachability | SESS-02 | UX concern, device-dependent | Test Pause/End button reach on 5.5" and 6.7" phone screens |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

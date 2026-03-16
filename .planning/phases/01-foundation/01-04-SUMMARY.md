---
plan: "04"
phase: 01-foundation
status: complete
commit: d3291e2
---

# Plan 04 Summary — Audio Pipeline

## Delivered

- `src/hooks/useAudioCapture.ts` — mic capture hook; `requestMic()` user-gesture only; `getSupportedMimeType()` fallback chain (webm/opus → webm → mp4 → ogg); `startRecording(onDataAvailable)` with 250ms timeslice; pause/resume/stop lifecycle
- `src/hooks/useDeepgramStream.ts` — browser-direct Deepgram WebSocket; fetches temporary token before connecting; saves chunk on every `is_final` event; KeepAlive on pause; 5s heartbeat guard calls `onMicInterrupted`; `sendAudioChunk(blob)` for streaming
- `src/app/api/deepgram-token/route.ts` — POST creates 30s Deepgram temporary key; returns `{ token, wsUrl }`; never exposes raw API key
- `src/app/api/session/chunk/route.ts` — POST validates with Zod; upserts to `transcript_chunks` with tenant context; idempotent on `session_id,sequence` conflict

## Test results

22 tests, all passing. Covers: mic permission errors (not_allowed, not_found, not_supported), mimeType detection fallback, MediaRecorder lifecycle, Deepgram WebSocket open/close/error, is_final vs non-final chunk save, sequence increment.

## Deviations

- Fixed test setup: replaced `vi.stubGlobal('navigator', {...})` with `Object.defineProperty` to avoid React 19 `userAgent.indexOf` crash. Added `afterEach(vi.clearAllMocks)` to prevent spy call count pollution across tests.
- Deepgram SDK v5 already corrected in `src/lib/deepgram.ts` by 01-02.

## Integration notes

- `useAudioCapture` exposes `mimeType` — passed to `useDeepgramStream.startStream(sessionId, mimeType)`
- `useDeepgramStream` depends on `/api/deepgram-token` for token and `/api/session/chunk` for persistence
- No WebSocket relay — browser connects directly to `wss://api.deepgram.com` per research anti-pattern guard

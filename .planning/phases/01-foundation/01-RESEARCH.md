# Phase 1: Foundation - Research

**Researched:** 2026-03-15
**Domain:** PWA shell, microphone capture, real-time transcription, session lifecycle
**Confidence:** MEDIUM-HIGH (core patterns HIGH; iOS-specific behaviors need hands-on validation)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Consent flow:** One-tap modal "Client has consented to recording" before recording starts. Timestamped and logged with session record.
- **Active session screen:** Minimal dark/brand-colored screen. Pulsing mic indicator + running timer. Pause (left) + End (right) controls fixed at bottom. Large tap targets. No live transcript visible. End requires secondary confirmation tap.
- **Screen lock handling:** WakeLock API to prevent sleep. If WakeLock unavailable (iOS fallback): persistent warning banner "Keep your screen on to avoid losing audio". Incoming call auto-pauses. If mic cut by OS: "Recording stopped" banner with Resume button. No silent auto-resume.
- **Session recovery:** Re-open with in-progress session → recovery screen with "Resume session" or "Start fresh". Partial corruption: save everything recoverable + warning. Never silently discard.
- **Phase 3 card UX (for-reference):** Cards as lockscreen-style notification banners stacking from the top downward. Controls stay fixed at bottom. Out of scope for Phase 1.
- **Multi-tenancy threading:** Supabase RLS + tenant_id in schema from Phase 1. Non-negotiable.

### Claude's Discretion
- Exact animation style for the pulsing mic indicator
- Specific warning banner styling
- Toast/notification design for minor state changes (e.g., "Session paused")
- How to handle extremely short sessions (< 5 seconds) on accidental start

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SESS-01 | Agent can start a live session with a single tap | Consent modal → immediate session start; `getUserMedia` + MediaRecorder pattern |
| SESS-02 | Agent can stop/end a session with a single tap | End button with secondary confirmation tap; session finalization and auto-save |
| SESS-03 | App displays a clear visual indicator when recording is active | Pulsing mic animation (CSS keyframes); ARIA live region for accessibility |
| SESS-04 | App requests and handles microphone permission gracefully | `getUserMedia` with `NotAllowedError` / `NotFoundError` handling; persistent storage of permission state |
| SESS-05 | Agent can pause and resume a session mid-meeting | `MediaRecorder.pause()` / `resume()`; Deepgram `KeepAlive` message; transcript gap bookmarking |
| SESS-06 | Session transcript and Q&A log auto-saves if app is closed or crashes | Incremental Supabase upsert of transcript_chunks; localStorage fallback; recovery screen on re-open |
| PLAT-01 | App works as a mobile-first web application on iOS and Android phones | Next.js 15 PWA with `app/manifest.ts`; `display: standalone`; iOS Add to Home Screen instructions |
| PLAT-02 | POC operates as a single-tenant deployment (no login required for v1) | Supabase RLS with hardcoded tenant_id constant; schema ready for multi-tenant upgrade |
</phase_requirements>

---

## Summary

Phase 1 establishes the audio pipeline and session shell that every subsequent phase builds on. The three interlocking technical problems are: (1) getting reliable microphone audio out of a PWA on iOS Safari, (2) streaming it to Deepgram with API key security intact, and (3) persisting session state robustly enough that a crash or screen lock never silently loses data.

The biggest architectural surprise is that **Vercel serverless functions do not support WebSocket connections**. The original planned design — browser WebSocket → Next.js API route relay → Deepgram — is not deployable on Vercel. The correct pattern for Vercel is to issue a short-lived Deepgram token from a standard HTTPS API route, then have the browser connect **directly** to Deepgram's WebSocket using that token. This is Deepgram's documented recommended pattern for browser clients.

The second important finding is that **WakeLock in installed PWAs was broken on iOS until iOS 18.4** (released March 31, 2025). Devices on iOS 18.4+ get working WakeLock; older devices get the warning-banner fallback. Both code paths are required.

**Primary recommendation:** Build the audio capture layer around `MediaRecorder` (not `AudioWorklet`) for simplicity, use Deepgram temporary tokens for browser-direct streaming, persist transcript chunks to Supabase incrementally as they arrive, and implement `visibilitychange`-based mic-pause detection as the primary defense against silent data loss.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x | Full-stack framework + PWA shell | App Router with built-in `app/manifest.ts` for PWA; no separate `next-pwa` needed for manifest; service worker via `public/sw.js` |
| React | 19.x | UI layer | Ships with Next.js 15; concurrent features for real-time state |
| TypeScript | 5.x | Type safety | Required for multi-tenant schema correctness |
| Tailwind CSS | 3.x | Styling | Fastest for touch-target-sized mobile UI |
| shadcn/ui | latest | Component primitives | Copy-paste components; no bundle bloat; accessible touch targets |
| @supabase/supabase-js | 2.x | Database client | Direct Postgres access with RLS enforcement |
| @deepgram/sdk | 3.x | Deepgram API (server-side token creation only) | Server-side only for temporary token issuance; browser uses raw WebSocket |
| Zod | 3.x | Runtime schema validation | API request validation; session schema type safety |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Serwist (`@serwist/next`) | latest | Service worker + offline caching | If offline shell caching is needed beyond manifest; webpack-based, not Turbopack |
| `web-push` | latest | VAPID key generation for future push notifications | Phase 1 service worker setup; notifications deferred to Phase 3 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Browser-direct Deepgram WS | Next.js WS relay | Relay is cleaner for key security but impossible on Vercel; temporary token pattern achieves same security |
| MediaRecorder | AudioWorklet + PCM | AudioWorklet gives raw PCM (lower latency) but higher implementation complexity; MediaRecorder `ondataavailable` is sufficient for Deepgram streaming |
| Supabase incremental save | Redis transcript buffer | Redis is Phase 2+ complexity; Supabase direct upsert is simpler and sufficient for POC |

### Installation

```bash
# Core
npm install next@latest react@latest react-dom@latest typescript@latest

# Styling
npm install tailwindcss@latest postcss autoprefixer
npm install -D @tailwindcss/typography

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Deepgram (server-side token creation only)
npm install @deepgram/sdk

# Validation
npm install zod

# Dev dependencies
npm install -D @types/node @types/react @types/react-dom
npm install -D eslint eslint-config-next prettier
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── manifest.ts          # PWA manifest (built-in Next.js)
│   ├── layout.tsx           # Root layout with brand theme vars
│   ├── page.tsx             # Session screen (mobile-first entry)
│   ├── api/
│   │   ├── session/
│   │   │   ├── start/route.ts      # Create session record in Supabase
│   │   │   ├── end/route.ts        # Finalize session
│   │   │   └── pause/route.ts      # Pause/resume state update
│   │   └── deepgram-token/route.ts # Issue short-lived Deepgram token
│   └── (session)/
│       ├── active/page.tsx   # Active recording screen
│       └── recovery/page.tsx # Crash recovery screen
├── components/
│   ├── session/
│   │   ├── ConsentModal.tsx       # Pre-recording consent flow
│   │   ├── MicIndicator.tsx       # Pulsing recording indicator
│   │   ├── SessionTimer.tsx       # Running elapsed timer
│   │   ├── SessionControls.tsx    # Pause + End buttons (fixed bottom)
│   │   └── StatusBanner.tsx       # WakeLock warning / mic-stopped banner
│   └── ui/                        # shadcn/ui primitives
├── hooks/
│   ├── useAudioCapture.ts    # getUserMedia + MediaRecorder lifecycle
│   ├── useDeepgramStream.ts  # Browser WebSocket to Deepgram
│   ├── useSessionLifecycle.ts # Start/pause/resume/end state machine
│   ├── useWakeLock.ts        # WakeLock API + fallback detection
│   └── useVisibilityGuard.ts # visibilitychange mic interruption detection
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # Browser Supabase client
│   │   └── server.ts         # Server Supabase client (API routes)
│   └── deepgram.ts           # Server-side Deepgram SDK init
└── db/
    └── migrations/
        └── 001_foundation.sql  # sessions, transcript_chunks tables with RLS
```

---

### Pattern 1: Browser-Direct Deepgram Streaming via Temporary Token

**What:** Browser requests a short-lived Deepgram token from your API, then opens a WebSocket directly to Deepgram. The API key never reaches the browser.

**When to use:** Required on Vercel (serverless cannot maintain persistent WebSocket connections). Also the correct pattern for any deployment.

**Architecture:**
```
Browser                    Next.js API Route          Deepgram
  |                              |                       |
  |-- POST /api/deepgram-token ->|                       |
  |                              |-- createKey(ttl=30) ->|
  |<-- { token, wsUrl } ---------|<-- { key } -----------|
  |                              |                       |
  |-- WebSocket wss://api.deepgram.com/v1/listen ------->|
  |   (token as protocol header)                         |
  |<-- transcript events --------------------------------|
  |                              |                       |
  |-- POST /api/session/chunk -->|                       |
  |   (final transcript text)    |-- upsert to Supabase  |
```

**Token creation (server-side):**
```typescript
// src/app/api/deepgram-token/route.ts
// Source: https://deepgram.com/learn/protecting-api-key
import { createClient } from '@deepgram/sdk'

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!)

export async function POST(request: Request) {
  const { data: key, error } = await deepgram.manage.createProjectKey(
    process.env.DEEPGRAM_PROJECT_ID!,
    {
      comment: 'browser-session-token',
      scopes: ['usage:write'],
      time_to_live_in_seconds: 30, // Only needs to survive initial WS handshake
    }
  )

  if (error) return Response.json({ error: 'Token creation failed' }, { status: 500 })

  return Response.json({
    token: key.key,
    wsUrl: 'wss://api.deepgram.com/v1/listen',
  })
}
```

**Browser connection:**
```typescript
// src/hooks/useDeepgramStream.ts
// Source: https://developers.deepgram.com/docs/lower-level-websockets
async function startDeepgramConnection(sessionId: string) {
  // 1. Get short-lived token
  const { token, wsUrl } = await fetch('/api/deepgram-token', {
    method: 'POST',
  }).then((r) => r.json())

  // 2. Open direct WebSocket to Deepgram (token only needed at handshake)
  const ws = new WebSocket(wsUrl, ['token', token])
  ws.binaryType = 'arraybuffer'

  ws.onmessage = (event) => {
    const result = JSON.parse(event.data)
    if (result.type === 'Results' && result.is_final) {
      const transcript = result.channel.alternatives[0].transcript
      if (transcript.trim()) {
        // Persist to Supabase incrementally
        saveTranscriptChunk(sessionId, transcript, result.start)
      }
    }
  }

  return ws
}
```

---

### Pattern 2: MediaRecorder Audio Capture with Format Detection

**What:** Use `MediaRecorder` with format detection via `isTypeSupported()`. iOS Safari records in `audio/mp4` or `audio/webm;codecs=opus` depending on version. Detect and pass correct MIME type to Deepgram.

**When to use:** All audio capture in this project.

```typescript
// src/hooks/useAudioCapture.ts
// Source: https://www.buildwithmatija.com/blog/iphone-safari-mediarecorder-audio-recording-transcription
function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

async function startAudioCapture(): Promise<{ stream: MediaStream; recorder: MediaRecorder }> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })

  const mimeType = getSupportedMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

  return { stream, recorder }
}
```

**Deepgram connection URL must include encoding params matching the MIME type:**
```typescript
// Append to wsUrl: ?encoding=opus&sample_rate=16000&model=nova-2&smart_format=true&interim_results=true
const url = new URL(wsUrl)
url.searchParams.set('model', 'nova-2')
url.searchParams.set('smart_format', 'true')
url.searchParams.set('interim_results', 'true')
// For webm/opus: encoding=opus; for mp4/aac: encoding=linear16 (or omit, Deepgram auto-detects)
```

---

### Pattern 3: WakeLock with iOS Fallback

**What:** Request WakeLock to prevent screen sleep. Detect iOS (where WakeLock was broken in PWAs until iOS 18.4) and show warning banner fallback.

**When to use:** Active session screen mount, cleared on session end.

```typescript
// src/hooks/useWakeLock.ts
// Source: https://caniuse.com/wake-lock + https://bugs.webkit.org/show_bug.cgi?id=254545
export function useWakeLock() {
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [needsManualWarning, setNeedsManualWarning] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      // API not supported at all (older iOS, some Android)
      setNeedsManualWarning(true)
      return
    }
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      setWakeLockActive(true)
      wakeLockRef.current.addEventListener('release', () => {
        setWakeLockActive(false)
        // WakeLock released when page hidden — surface warning
        setNeedsManualWarning(true)
      })
    } catch (err) {
      // request() throws if page is hidden or permission denied
      setNeedsManualWarning(true)
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    await wakeLockRef.current?.release()
    setWakeLockActive(false)
    setNeedsManualWarning(false)
  }, [])

  return { wakeLockActive, needsManualWarning, requestWakeLock, releaseWakeLock }
}
```

---

### Pattern 4: visibilitychange Mic Interruption Guard

**What:** When the page becomes hidden (screen lock, incoming call, app switch), auto-pause the session and show the "Recording stopped" banner. Agent must manually resume.

**When to use:** Wrap active session screen.

```typescript
// src/hooks/useVisibilityGuard.ts
// Source: MDN Page Visibility API
export function useVisibilityGuard(
  onHide: () => void,
  onShow: () => void,
) {
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        onHide() // auto-pause session, show "Recording stopped" banner
      } else if (document.visibilityState === 'visible') {
        // Do NOT auto-resume — agent must tap Resume (per locked decision)
        onShow() // update banner to show resume prompt
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [onHide, onShow])
}
```

---

### Pattern 5: Supabase Schema with RLS (Foundation)

**What:** Minimal schema for Phase 1. Every table has `tenant_id` from day one. RLS policies enforce isolation. POC uses a hardcoded `DEFAULT_TENANT_ID` constant — schema is v2-ready without the application needing auth yet.

```sql
-- db/migrations/001_foundation.sql

-- Enable RLS helper
create extension if not exists "pgcrypto";

-- Tenants table (even POC gets one row)
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_color text not null default '#1a1a2e',
  created_at timestamptz not null default now()
);

-- Sessions table
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  agent_id uuid,                       -- null for PLAT-02 single-tenant POC
  status text not null default 'active'
    check (status in ('active', 'paused', 'ended', 'recovered')),
  consent_confirmed_at timestamptz not null,
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_tenant_id_idx on public.sessions(tenant_id);
create index sessions_status_idx on public.sessions(status) where status != 'ended';

-- Transcript chunks (incremental saves, enables SESS-06 crash recovery)
create table public.transcript_chunks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  sequence integer not null,           -- ordering within session
  text text not null,
  start_seconds numeric(10,3) not null, -- Deepgram result.start
  duration_seconds numeric(10,3),
  is_final boolean not null default true,
  created_at timestamptz not null default now()
);

create index transcript_chunks_session_idx on public.transcript_chunks(session_id, sequence);
create index transcript_chunks_tenant_idx on public.transcript_chunks(tenant_id);

-- RLS policies
alter table public.sessions enable row level security;
alter table public.transcript_chunks enable row level security;

-- POC policy: all access for the hardcoded tenant
-- v2: replace with auth.jwt()->>'tenant_id' claim check
create policy "tenant_isolation_sessions"
  on public.sessions
  using (tenant_id = current_setting('app.tenant_id')::uuid);

create policy "tenant_isolation_chunks"
  on public.transcript_chunks
  using (tenant_id = current_setting('app.tenant_id')::uuid);
```

**Setting tenant context in API routes:**
```typescript
// lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js'

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID! // single env var for POC

export function getServerSupabase() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  // Set tenant context so RLS policies apply correctly
  // In v2 this comes from the JWT claim
  return {
    client,
    tenantId: DEFAULT_TENANT_ID,
    async rpc<T>(query: (c: typeof client) => Promise<T>) {
      await client.rpc('set_config', {
        setting_name: 'app.tenant_id',
        new_value: DEFAULT_TENANT_ID,
        is_local: true,
      })
      return query(client)
    }
  }
}
```

---

### Pattern 6: Session State Machine

**What:** Session has explicit states. Transitions are validated. State is persisted to Supabase and mirrored in localStorage for crash recovery.

```
idle → [consent confirmed] → active → [pause tapped] → paused → [resume tapped] → active
active → [end confirmed] → ended
paused → [end confirmed] → ended
active → [mic interrupted] → interrupted → [resume tapped] → active
```

**localStorage key:** `dictator_session_recovery` — stores `{ sessionId, status, startedAt }` — written on every state transition, cleared on clean end.

---

### Anti-Patterns to Avoid

- **WS relay in Vercel API route:** Next.js API routes on Vercel are serverless — persistent WebSocket connections terminate after the function timeout (~30s by default). Use the temporary-token + browser-direct pattern instead.
- **Exposing Deepgram API key to browser:** Even a scoped key visible in client code can be extracted. Always issue temporary tokens server-side.
- **Waiting for `visibilitychange` to be reliable:** Not all iOS events fire reliably. Supplement with an audio chunk heartbeat: if `recorder.ondataavailable` hasn't fired in > 5s during an active session, assume mic is paused.
- **Chunking audio into HTTP POST requests:** Destroys real-time. Use the WebSocket binary stream.
- **Silent session discard:** Never discard state without agent confirmation — this is a locked decision.
- **Skipping `tenant_id` on any table:** Schema is the data contract for Phases 2 and 3. Adding `tenant_id` retroactively requires a migration with downtime.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming ASR | Custom Whisper server | Deepgram Nova-2 | 300ms latency; mobile-friendly; handles noise |
| Service worker | Custom cache logic | Next.js `public/sw.js` + optional Serwist | Complex cache invalidation edge cases |
| Audio format detection | Browser sniffing | `MediaRecorder.isTypeSupported()` | Authoritative; accounts for codec availability |
| RLS enforcement | App-layer tenant filtering | Supabase RLS policies | DB-level guarantee; app bugs can't leak data |
| WakeLock retry | Custom polling | Native WakeLock `release` event | Handles OS-level release correctly |

**Key insight:** The audio pipeline is where complexity hides. Deepgram handles the hardest parts (noise robustness, utterance boundary detection, mobile codec support). Hand-rolling any part of it for POC is a guaranteed schedule risk.

---

## Common Pitfalls

### Pitfall 1: iOS WakeLock Bug in Installed PWAs (Pre-iOS 18.4)
**What goes wrong:** WakeLock API appears to succeed (no error thrown) but the screen still locks, killing the mic stream. The request resolves but has no effect in PWA mode on iOS < 18.4.
**Why it happens:** A long-standing WebKit bug (see bugs.webkit.org/254545) where WakeLock in Add-to-Home-Screen PWAs was silently non-functional.
**How to avoid:** Treat WakeLock as best-effort. Always implement the warning banner fallback regardless of whether the WakeLock request "succeeded." Test on a physical device with iOS < 18.4 if your target users haven't updated.
**Warning signs:** Screen locks during a test session despite WakeLock reporting `active: true`.

### Pitfall 2: Vercel Kills the WebSocket Relay
**What goes wrong:** WebSocket connection from the browser to a Next.js API route works locally (Node.js server) but silently fails or drops on Vercel deployment because serverless functions cannot maintain persistent connections.
**Why it happens:** Vercel functions are stateless and have execution time limits. They are not a WebSocket server.
**How to avoid:** Use Deepgram temporary tokens + browser-direct WebSocket. Never build the relay.
**Warning signs:** Transcription works in `next dev` but not in Vercel preview deployment.

### Pitfall 3: MediaRecorder format mismatch crashes Deepgram
**What goes wrong:** iOS records `audio/mp4` but the Deepgram connection URL specifies `encoding=opus`. Deepgram returns transcription errors or empty results without a clear error message.
**Why it happens:** Different devices produce different audio containers. Deepgram needs to know the encoding to decode correctly.
**How to avoid:** Always detect the mimeType with `getSupportedMimeType()` and pass the appropriate `encoding` param to Deepgram. Log the mimeType in session metadata.
**Warning signs:** Empty transcripts on physical iPhone but correct transcripts on Android.

### Pitfall 4: Transcript data lost on accidental close (SESS-06)
**What goes wrong:** Agent accidentally closes the app. All in-memory transcript chunks are lost. The session appears empty on recovery.
**Why it happens:** Transcript buffered in React state, only saved to Supabase on clean end.
**How to avoid:** Upsert each `is_final: true` transcript chunk to `public.transcript_chunks` immediately when it arrives from Deepgram. Never hold more than 1 chunk in memory before persisting.
**Warning signs:** Recovered session shows 0 transcript chunks despite the agent having recorded for several minutes.

### Pitfall 5: `getUserMedia` called before user gesture
**What goes wrong:** Microphone permission prompt doesn't appear or is silently denied because `getUserMedia` was called outside a user gesture handler.
**Why it happens:** Browsers (especially iOS Safari) enforce that media capture must be initiated by a user gesture (tap, click). Calling `getUserMedia` in `useEffect` on mount is not a user gesture.
**How to avoid:** Call `getUserMedia` inside the consent modal's confirm button handler — this is a direct user gesture. Do not call it in `useEffect` or `componentDidMount`.
**Warning signs:** Microphone permission never requested; stream is undefined with no error thrown.

---

## Code Examples

### PWA Manifest (Next.js built-in)
```typescript
// src/app/manifest.ts
// Source: https://nextjs.org/docs/app/guides/progressive-web-apps
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dictator — Sales Copilot',
    short_name: 'Dictator',
    description: 'Real-time AI assistant for estate agency meetings',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f0f1a',
    theme_color: '#0f0f1a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
```

### Microphone Permission Error Handling
```typescript
// src/hooks/useAudioCapture.ts
type MicError = 'not_allowed' | 'not_found' | 'not_supported' | 'unknown'

async function requestMic(): Promise<{ stream: MediaStream } | { error: MicError }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { error: 'not_supported' }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    })
    return { stream }
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError') return { error: 'not_allowed' }
      if (err.name === 'NotFoundError') return { error: 'not_found' }
    }
    return { error: 'unknown' }
  }
}
```

### Incremental Transcript Save
```typescript
// src/app/api/session/chunk/route.ts
import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'

const ChunkSchema = z.object({
  sessionId: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  text: z.string().min(1),
  startSeconds: z.number().nonneg(),
  durationSeconds: z.number().nonneg().optional(),
})

export async function POST(request: Request) {
  const body = ChunkSchema.safeParse(await request.json())
  if (!body.success) return Response.json({ error: 'Invalid chunk' }, { status: 400 })

  const { client, tenantId } = getServerSupabase()
  const { error } = await client.from('transcript_chunks').upsert({
    session_id: body.data.sessionId,
    tenant_id: tenantId,
    sequence: body.data.sequence,
    text: body.data.text,
    start_seconds: body.data.startSeconds,
    duration_seconds: body.data.durationSeconds,
    is_final: true,
  }, { onConflict: 'session_id,sequence' })

  if (error) return Response.json({ error: 'Save failed' }, { status: 500 })
  return Response.json({ ok: true })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-pwa` package for PWA setup | Next.js built-in `app/manifest.ts` + `public/sw.js` | Next.js 14+ (2024) | No extra dependency; manifest is native App Router file convention |
| `next-pwa` (shadowwalker) | Serwist (`@serwist/next`) for service workers | 2023-2024 | Original next-pwa unmaintained; Serwist is the maintained fork/successor |
| WebSocket relay in Next.js API route | Deepgram temporary token + browser-direct WS | Pattern always existed; Vercel limitation clarified 2024 | Eliminates impossible architecture on Vercel |
| WakeLock broken in iOS PWA | WakeLock fixed in iOS 18.4 (released March 2025) | iOS 18.4, March 31, 2025 | WakeLock now works on devices upgraded to iOS 18.4+; still need fallback for older |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | `auth-helpers-nextjs` deprecated; `@supabase/ssr` is the current package |

**Deprecated/outdated:**
- `next-pwa` (shadowwalker): last commit years ago; do not use
- `@supabase/auth-helpers-nextjs`: deprecated; use `@supabase/ssr`
- AudioScriptProcessor API: replaced by AudioWorklet; do not use

---

## Open Questions

1. **Deepgram Nova-3 availability**
   - What we know: Nova-2 was the recommended model as of research cutoff; Nova-3 may exist now
   - What's unclear: Whether Nova-3 is GA, pricing, and whether it offers better accuracy for UAE-accent English
   - Recommendation: Check `https://developers.deepgram.com/docs/models` at implementation time; default to whichever model Deepgram currently recommends for conversational English

2. **Vercel WebSocket support with Fluid Compute**
   - What we know: As of 2025, Vercel does not support WebSockets even with Fluid Compute enabled (confirmed via Vercel KB)
   - What's unclear: Vercel has been adding long-running compute features; this may change
   - Recommendation: Proceed with temporary-token pattern regardless; it is the cleaner architecture anyway

3. **iOS 18.4 WakeLock adoption rate in target market**
   - What we know: WakeLock fixed in iOS 18.4 released March 31, 2025
   - What's unclear: What percentage of Dubai estate agents are on iOS 18.4+
   - Recommendation: Implement both code paths; test banner on physical devices; the decision to not rely solely on WakeLock is already locked

4. **Extremely short sessions (< 5 seconds) — Claude's discretion**
   - What we know: Agent may accidentally tap start then immediately end
   - What's unclear: Whether to save or silently discard; no locked decision
   - Recommendation: If session duration < 5 seconds and 0 transcript chunks, offer "Discard this session?" before saving. If agent declines, save as a 0-transcript session with status `ended`.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library (for hooks/components); Playwright (for E2E PWA install) |
| Config file | `vitest.config.ts` — Wave 0 gap (does not exist yet) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run && npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-01 | Consent modal → recording starts on confirm | unit | `npx vitest run src/hooks/useSessionLifecycle.test.ts` | Wave 0 |
| SESS-01 | `getUserMedia` called inside consent confirm handler (not on mount) | unit | `npx vitest run src/hooks/useAudioCapture.test.ts` | Wave 0 |
| SESS-02 | End button requires secondary confirmation tap before session finalizes | unit | `npx vitest run src/components/session/SessionControls.test.tsx` | Wave 0 |
| SESS-02 | Session record updated to `ended` status in Supabase on end | integration | `npx vitest run src/app/api/session/end/route.test.ts` | Wave 0 |
| SESS-03 | Pulsing indicator present and aria-labeled during active recording | unit | `npx vitest run src/components/session/MicIndicator.test.tsx` | Wave 0 |
| SESS-04 | `NotAllowedError` renders permission-denied UI (not crash) | unit | `npx vitest run src/hooks/useAudioCapture.test.ts` | Wave 0 |
| SESS-04 | `NotFoundError` renders no-mic UI | unit | `npx vitest run src/hooks/useAudioCapture.test.ts` | Wave 0 |
| SESS-05 | Pause transitions session to `paused`, MediaRecorder.pause() called | unit | `npx vitest run src/hooks/useSessionLifecycle.test.ts` | Wave 0 |
| SESS-05 | Resume transitions session to `active`, MediaRecorder.resume() called | unit | `npx vitest run src/hooks/useSessionLifecycle.test.ts` | Wave 0 |
| SESS-06 | Transcript chunk POST fires on each `is_final` Deepgram event | unit | `npx vitest run src/hooks/useDeepgramStream.test.ts` | Wave 0 |
| SESS-06 | localStorage recovery key written on session start, cleared on clean end | unit | `npx vitest run src/hooks/useSessionLifecycle.test.ts` | Wave 0 |
| SESS-06 | Recovery screen appears when `dictator_session_recovery` key exists on app load | unit | `npx vitest run src/app/page.test.tsx` | Wave 0 |
| PLAT-01 | `app/manifest.ts` returns valid PWA manifest with required fields | unit | `npx vitest run src/app/manifest.test.ts` | Wave 0 |
| PLAT-01 | `display: standalone` set in manifest | unit | `npx vitest run src/app/manifest.test.ts` | Wave 0 |
| PLAT-02 | All Supabase queries include `tenant_id` filter (RLS policy in migration) | integration | `npx vitest run src/db/rls.test.ts` | Wave 0 |
| PLAT-02 | Session created with `DEFAULT_TENANT_ID` (no auth required) | integration | `npx vitest run src/app/api/session/start/route.test.ts` | Wave 0 |

**Manual-only validations (cannot be automated):**
- WakeLock behavior on physical iPhone (install as PWA, lock screen during recording)
- MediaRecorder format on physical iPhone (confirm `audio/mp4` or `audio/webm` is detected and Deepgram receives transcription)
- Banner appearance when switching apps mid-session on iOS
- "Add to Home Screen" install flow on both iOS and Android
- One-handed thumb reachability of Pause/End controls on 5.5"–6.7" phone screens

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run && npx playwright test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

All test infrastructure is missing — this is a greenfield project.

- [ ] `vitest.config.ts` — Vitest configuration with jsdom environment
- [ ] `src/hooks/useSessionLifecycle.test.ts` — covers SESS-01, SESS-05, SESS-06
- [ ] `src/hooks/useAudioCapture.test.ts` — covers SESS-01, SESS-04
- [ ] `src/hooks/useDeepgramStream.test.ts` — covers SESS-06 (chunk persistence)
- [ ] `src/components/session/SessionControls.test.tsx` — covers SESS-02
- [ ] `src/components/session/MicIndicator.test.tsx` — covers SESS-03
- [ ] `src/app/page.test.tsx` — covers SESS-06 recovery screen render
- [ ] `src/app/manifest.test.ts` — covers PLAT-01
- [ ] `src/app/api/session/end/route.test.ts` — covers SESS-02 server-side
- [ ] `src/app/api/session/start/route.test.ts` — covers PLAT-02
- [ ] `src/db/rls.test.ts` — covers PLAT-02 RLS isolation
- [ ] `src/test/setup.ts` — shared test setup (jsdom, mock MediaRecorder, mock Supabase client)

Framework install:
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event
npm install -D @playwright/test
```

---

## Sources

### Primary (HIGH confidence)
- Next.js official docs (nextjs.org) — PWA guide, manifest.ts, App Router
- Vercel Knowledge Base — WebSocket limitation confirmed: https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections
- Deepgram docs — Protecting API keys, temporary tokens: https://deepgram.com/learn/protecting-api-key
- MDN — Page Visibility API, WakeLock API
- WebKit bug tracker — WakeLock in PWA fixed in iOS 18.4: https://bugs.webkit.org/show_bug.cgi?id=254545

### Secondary (MEDIUM confidence)
- Build with Matija — MediaRecorder iOS Safari format detection: https://www.buildwithmatija.com/blog/iphone-safari-mediarecorder-audio-recording-transcription
- caniuse.com — WakeLock browser compatibility table (iOS 16.4+ partial, 16.6+ full)
- Supabase docs — RLS multi-tenant pattern, `@supabase/ssr` migration
- Deepgram lower-level WebSockets guide: https://developers.deepgram.com/docs/lower-level-websockets

### Tertiary (LOW confidence — verify before use)
- Deepgram Nova-3 existence and pricing — unconfirmed, check at implementation time
- Vercel Fluid Compute WebSocket roadmap — active development, may change

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Next.js + Supabase is an established 2025 pattern; package names verified
- Architecture (browser-direct Deepgram): HIGH — Confirmed against Vercel KB and Deepgram docs
- WakeLock iOS 18.4 fix: HIGH — Confirmed via WebKit bug tracker and web.dev
- MediaRecorder format detection: HIGH — Confirmed via MDN and implementation articles
- Audio quality on physical device: LOW — Requires hands-on validation in UAE office environment
- Deepgram model (Nova-2 vs Nova-3): MEDIUM — Nova-2 confirmed current; Nova-3 may exist, verify

**Research date:** 2026-03-15
**Valid until:** 2026-04-14 (30 days — stack is stable; WakeLock situation may improve with further iOS updates)

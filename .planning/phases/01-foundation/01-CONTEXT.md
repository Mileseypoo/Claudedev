# Phase 1: Foundation - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

PWA shell, microphone capture, real-time transcription, and session lifecycle management. Agent installs the app on their phone, starts a session (with consent confirmation), sees a live recording indicator, can pause/resume, and the session auto-saves. No answer cards yet (Phase 3), no data querying (Phase 2) — this phase delivers the audio pipeline and session shell that everything else builds on.

</domain>

<decisions>
## Implementation Decisions

### Client Consent Flow
- Before recording starts, agent sees a one-tap confirmation modal: **"Client has consented to recording"**
- This is an agent-only step — not shown to the client
- Consent is timestamped and logged with the session record for compliance
- Tapping confirm immediately starts the session; no further delay

### Active Session Screen
- Minimal, dark/brand-colored screen (brand color is configurable per agency)
- Prominent pulsing mic indicator + running session timer
- Controls fixed at the bottom of the screen: **Pause** (left) and **End** (right)
- **End** requires a quick confirmation tap to prevent accidental termination
- Controls are large tap targets — one-handed thumb use
- No live transcript visible on the session screen (minimal/clean)
- In Phase 3, cards will appear as **lockscreen-style notification banners** at the top — 2–10 word summary of the question + an ultra-short answer (e.g., "10 houses in this range", "Yes", "AED 1.95M"). Controls stay fixed at bottom; cards overlay the brand-colored background from the top downward.

### Screen Lock Handling
- App requests **WakeLock API** to prevent screen sleep during an active session
- If WakeLock is unavailable (iOS fallback), show a persistent warning banner: "Keep your screen on to avoid losing audio"
- **Incoming call** automatically pauses the session (audio interruption detection)
- If mic is cut by the OS (screen locked, call taken): show a **"Recording stopped" banner with a Resume button** — agent sees the gap clearly and can restart manually
- No silent auto-resume — agent must confirm they're back in the meeting

### Session Recovery
- If agent re-opens the app with an in-progress session (crash, accidental close): show a **recovery screen** with two options:
  - **"Resume session"** — continues from where it left off
  - **"Start fresh"** — discards the paused session and begins a new one
- If session data is partially corrupted: save everything recoverable and show a warning: "Some of this session may be missing"
- Never silently discard a session in progress

### Claude's Discretion
- Exact animation style for the pulsing mic indicator
- Specific warning banner styling
- Toast/notification design for minor state changes (e.g., "Session paused")
- How to handle extremely short sessions (< 5 seconds) on accidental start

</decisions>

<specifics>
## Specific Ideas

- Card UX reference (captured for Phase 3): "Like lockscreen WhatsApp messages — showing brief 2-10 word summary of question and very brief answer. Yes, No, 1953, 10 houses in this area, 100." Cards are notification-style overlays, not full-screen takeovers.
- The session screen should feel like the agent is holding a professional tool, not checking their phone. Dark/branded, minimal, nothing to read mid-meeting.
- The confirmation on End should be fast — a single secondary tap, not a dialog box that requires reading.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — greenfield project

### Established Patterns
- None yet — this is Phase 1; patterns established here will carry forward

### Integration Points
- Multi-tenancy (Supabase RLS + tenant_id) must be threaded through the schema from Phase 1 — not retrofittable later
- Session record schema established here is the data contract for Phase 2 (data pipeline) and Phase 3 (cards/intelligence)
- WakeLock and audio capture patterns established here are the foundation Phase 3 builds its real-time delivery on

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-15*

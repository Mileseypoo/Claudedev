# Phase 3: Intelligence + Cards - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Live transcript → intent detection → retrieve answer from company data → push card to session screen within 8 seconds. Covers: intent classification, RAG + SQL retrieval, card delivery to the active session screen, card persistence, and Q&A section on the summary screen. No web lookup (Phase 4), no post-meeting email (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Card Content Format
- **Collapsed state:** Ultra-terse — 1–5 words max. Examples: "AED 1.95M", "Yes — foreign buyers allowed", "3 sold this week". Glanceable in under a second mid-meeting. (Phase 1 reference confirmed: "like lockscreen WhatsApp messages")
- **Expanded state (tap to expand):** 2–3 sentences with key context, plus a source link that opens the PDF or listing record in the browser
- **Card types:** Listing cards (SQL), PDF/RAG cards, and stats cards all share the same card shape — differentiated by a small icon/label tag (e.g. colour accent or type label). No distinct layouts.
- **Dismiss behaviour:** Swiped cards are gone permanently during the session. No undo. All cards visible in post-session summary.

### Card Trigger Logic
- **Speech source:** All speech triggers intent detection — no speaker diarisation. LLM prompt instructs it to ignore non-question statements, pleasantries, and agent-directed speech.
- **Transcript window:** Last 2–3 final chunks (~15–20 seconds of speech) sent to LLM for context. Enough to capture multi-part questions without processing full session history.
- **Noise reduction:** Deduplication only — no fixed time cooldown. The same topic/question does not fire a second card if one already exists on screen for that topic. No queue/throttle.
- **Classification logging:** Every intent classification result (question detected / not a question / duplicate topic) logged to Vercel logs for prompt tuning. Silent skips are not acceptable.

### Proactive Stats Cards
- **Trigger:** Stats cards use the same trigger logic as answer cards — the LLM detects a stats-relevant topic in conversation and surfaces the relevant stat. No automatic push at session start.
- **Collapsed format:** Key number only — "3 sold this week", "AED 1.2M–3.8M in Dubai Marina". Ultra-terse, same style as other cards.
- **Stats available for surfacing:**
  - Count by status (available / sold / reserved)
  - Price range by area/community (min, max, median)
  - Recently sold count (last 30 days)
  - Average price by bedroom count
- **Pitch support content:** Seasonal insights, team achievements (from PDFs) surface using the same RAG trigger logic as answer cards. No special handling needed — everything indexed in Phase 2 is retrievable.

### Card Persistence
- **Saved to DB:** Every card that fires during a session is persisted (session_id, question detected, terse answer, full answer, source reference, fired_at timestamp)
- **Summary screen:** Phase 3 adds a Q&A section to the existing `/summary` screen — a separate section below the transcript showing all cards from the session in order
- **Summary detail level:** Full expanded answer shown in summary (same as tap-to-expand state), not just the terse title. Agent can review exactly what was surfaced during the meeting.

### Claude's Discretion
- Exact SSE vs. polling delivery mechanism for pushing cards to the active session screen
- LLM model choice for intent classification (claude-haiku-4-5 recommended for speed/cost)
- Exact prompt engineering for intent detection and answer generation
- DB schema for the answer_cards table
- How card source link is stored and displayed (URL vs document name vs chunk reference)
- Animation/transition for card appearing and being dismissed

</decisions>

<specifics>
## Specific Ideas

- Phase 1 reference confirmed: "Like lockscreen WhatsApp messages — brief 2-10 word summary of question and very brief answer. Yes, No, 1953, 10 houses in this area, 100." The ultra-terse collapsed state is the core UX vision.
- The 8-second target from the phase goal is the end-to-end budget: transcript chunk saved → intent classification → retrieval → card on screen.
- All stats available in `listing_stats` JSONB (recalculated on every CSV upsert) — Phase 3 reads this directly rather than querying listings table.
- PDF content retrieved via `match_document_chunks` Postgres function (already built in Phase 2).

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/(session)/active/page.tsx` — already has `{/* Phase 3: answer cards will appear here */}` placeholder in the flex-1 area above the center content
- `src/hooks/useDeepgramStream.ts` — fires on `is_final` and `speech_final` chunks, already calls POST /api/session/chunk. Phase 3 hooks into this event stream.
- `src/app/api/session/transcript/route.ts` — GET endpoint for full transcript; Phase 3's intent detection reads the last N chunks from this or directly from the chunk save event
- `src/lib/supabase/server.ts` — `getServerSupabase()` used by all server routes; Phase 3 API routes follow the same pattern
- `src/types/session.ts` — TranscriptChunk type; Phase 3 adds AnswerCard type in the same file or new src/types/cards.ts
- `src/app/(session)/summary/` — existing summary screen that Phase 3 extends with Q&A section
- `db/migrations/002_data_pipeline.sql` — `match_document_chunks` function and `listing_stats` table already built; Phase 3 calls these directly

### Established Patterns
- All API routes use `getServerSupabase()` → `client.from(table)` pattern
- Client-side hooks (`useSessionLifecycle`, `useDeepgramStream`) follow useState + useRef + useCallback pattern
- Tailwind CSS for all styling — no component library
- Test-first: all plans use TDD (Vitest + React Testing Library)
- `src/app/(session)/active/page.tsx` is the integration point for all session-time UI

### Integration Points
- **Card delivery:** New API route (POST /api/session/cards/generate or SSE endpoint) receives the transcript trigger and returns a card. Active page polls or subscribes.
- **Listings query:** Phase 3 queries `listings` table via SQL for structured data (DATA-06 enforced — not RAG)
- **PDF RAG query:** Phase 3 calls `match_document_chunks` Postgres function with query embedding
- **Stats query:** Phase 3 reads `listing_stats.stats` JSONB directly (pre-calculated, single row per tenant)
- **Card persistence:** New `answer_cards` table stores fired cards linked to session_id; summary screen queries this on load

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-intelligence-cards*
*Context gathered: 2026-03-16*

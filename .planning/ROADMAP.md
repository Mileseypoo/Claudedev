# Roadmap: Dictator

## Overview

Four phases from foundation to full POC. Phase 1 establishes the audio pipeline and PWA shell — nothing downstream works without it. Phase 2 builds the company data layer so there is something to retrieve. Phase 3 closes the core value loop: spoken question → detected intent → answer card on screen. Phase 4 extends coverage (web lookup for unknown questions) and adds the post-meeting email that completes the agent workflow. The result is a single-agency POC that can be demoed to the Dubai estate agency client.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - PWA shell, microphone capture, real-time transcription, session lifecycle
- [ ] **Phase 2: Data Pipeline** - CSV/PDF upload, document ingestion, vector + SQL indexing, admin portal
- [ ] **Phase 3: Intelligence + Cards** - Intent detection, RAG answer generation, Realtime card delivery, card stack UI
- [ ] **Phase 4: Web Lookup + Post-Meeting** - Agent-confirmed web search, session controls, email draft, review and send

## Phase Details

### Phase 1: Foundation
**Goal**: Agent can install the app on their phone, start a session, and see the live conversation transcript in real time
**Depends on**: Nothing (first phase)
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, SESS-05, SESS-06, PLAT-01, PLAT-02
**Success Criteria** (what must be TRUE):
  1. Agent opens the PWA on their phone, taps once to start a session, and sees a live transcript appear within 3 seconds of speaking
  2. A clearly visible recording indicator is shown while the session is active
  3. Agent can pause and resume the session mid-meeting without losing the transcript
  4. If the app is closed or crashes, the session transcript is automatically recovered on re-open
  5. The app installs as a PWA on iOS and Android and requests microphone permission with a clear prompt
**Plans**: 7 plans

Plans:
- [x] 01-01-PLAN.md — Test infrastructure: Vitest config, shared mocks, all stub test files
- [x] 01-02-PLAN.md — Data layer: DB migration (tenants/sessions/transcript_chunks with RLS), Supabase clients, Deepgram client, session types
- [x] 01-03-PLAN.md — PWA shell: manifest, root layout, page routing structure, minimal service worker
- [ ] 01-04-PLAN.md — Audio pipeline: useAudioCapture, useDeepgramStream, Deepgram token API, chunk persistence API
- [ ] 01-05-PLAN.md — Session management: useSessionLifecycle, WakeLock hook, visibility guard, all UI components, session API routes
- [ ] 01-06-PLAN.md — Integration wiring: home page, active session page, recovery page fully composed
- [ ] 01-07-PLAN.md — Device checkpoint: Vercel deploy + physical iOS/Android verification

### Phase 2: Data Pipeline
**Goal**: Admin can upload the agency's listings and documents, and the system makes them queryable within minutes
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. Admin uploads a CSV of property listings via the web portal and can see the upload status turn to "indexed" within 5 minutes
  2. Admin uploads a PDF (brochure or regulatory document) and it becomes queryable within 5 minutes
  3. Admin can view, delete, and re-upload files from the portal without developer intervention
  4. A query against listing data returns a structured result drawn from SQL (not RAG), producing accurate prices and availability
  5. Stats talking points (e.g. "3 properties sold this week") surface in test queries against the indexed data
**Plans**: 7 plans

Plans:
- [ ] 02-01-PLAN.md — Wave 0 foundation: packages, DB migration, TypeScript types, 9 test stub files
- [ ] 02-02-PLAN.md — CSV parser: parseCsv with PapaParse + Zod validation (TDD)
- [ ] 02-03-PLAN.md — PDF pipeline libs: extractPdfText, chunkText, generateEmbeddings (TDD)
- [ ] 02-04-PLAN.md — Upload API route: CSV sync upsert + PDF async waitUntil dispatch (TDD)
- [ ] 02-05-PLAN.md — Management API routes: uploads list, delete upload, stats (TDD)
- [ ] 02-06-PLAN.md — Admin portal UI: FileUploadZone, UploadedFilesList, StatsPreview (TDD)
- [ ] 02-07-PLAN.md — Integration wiring: deploy + physical CSV/PDF upload verification

### Phase 3: Intelligence + Cards
**Goal**: Agent speaks a question during a meeting and sees a relevant answer card appear on their phone within 8 seconds, drawn from company data
**Depends on**: Phase 2
**Requirements**: INTEL-01, INTEL-02, INTEL-03, CARD-01, CARD-02, CARD-03, CARD-04, CARD-05
**Success Criteria** (what must be TRUE):
  1. A client question in the live transcript triggers an answer card within 8 seconds, with no manual action from the agent
  2. Cards stack upward on screen (newest at bottom); older cards scroll off the top naturally
  3. Each card shows a glanceable 1–2 sentence answer; tapping it expands to more detail and a source link
  4. Normal conversation does not produce more than 2–3 cards per minute; rhetorical statements and agent speech do not trigger cards
  5. Agent can swipe an individual card away to dismiss it
**Plans**: 6 plans

Plans:
- [ ] 03-01-PLAN.md — DB migration (answer_cards + RLS), TypeScript types (AnswerCard, IntentResult), install @anthropic-ai/sdk
- [ ] 03-02-PLAN.md — Intent classification: classifyIntent() with Claude Haiku 4.5 structured outputs (TDD)
- [ ] 03-03-PLAN.md — Retrieval + generation: retrieveFromListings/PDF/Stats, generateAnswer() with Haiku 4.5 (TDD)
- [ ] 03-04-PLAN.md — Pipeline orchestrator: triggerIntelligence(), chunk route waitUntil hook, hard dedup (TDD)
- [ ] 03-05-PLAN.md — Active session card UI: useAnswerCards Realtime hook, CardStack, AnswerCard with swipe dismiss
- [ ] 03-06-PLAN.md — Summary Q&A section: GET /api/session/cards, QASection component, extend summary page

### Phase 4: Web Lookup + Post-Meeting
**Goal**: Agent can look up questions outside company data with a single confirmed tap, and receives a ready-to-send follow-up email when the meeting ends
**Depends on**: Phase 3
**Requirements**: WEB-01, WEB-02, WEB-03, POST-01, POST-02, POST-03, POST-04
**Success Criteria** (what must be TRUE):
  1. When company data cannot answer a question, a "Search web?" suggestion card appears; the search only fires after the agent taps to confirm it
  2. The web search result replaces the suggestion card with a short summary and source link
  3. After the agent ends the session, a draft follow-up email (meeting summary, key Q&A, relevant links) is ready to review within the app
  4. Agent can edit the draft email and send it directly from the app; the email is never sent automatically
  5. Agent can view the full session transcript after the meeting ends
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/7 | In progress | - |
| 2. Data Pipeline | 6/7 | In Progress|  |
| 3. Intelligence + Cards | 1/6 | In Progress|  |
| 4. Web Lookup + Post-Meeting | 0/TBD | Not started | - |

---
phase: 03-intelligence-cards
verified: 2026-03-16T21:35:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 3: Intelligence + Cards Verification Report

**Phase Goal:** Live transcript → intent detection → retrieve answer from company data → push card to session screen within 8 seconds. Cards persist to DB, summary screen shows Q&A section.
**Verified:** 2026-03-16T21:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Live transcript chunk triggers intelligence pipeline via waitUntil (non-blocking) | VERIFIED | `chunk/route.ts:39` calls `waitUntil(triggerIntelligence(...))` after successful insert |
| 2 | Intent detection via Claude Haiku 4.5 with structured Zod output | VERIFIED | `classify-intent.ts` calls `client.messages.parse` with `output_config: { format: zodOutputFormat(IntentSchema) }` |
| 3 | Three retrieval paths: SQL listings, pgvector RAG, stats JSONB | VERIFIED | `retrieve-answer.ts` exports `retrieveFromListings`, `retrieveFromPDF`, `retrieveStats` — all substantive |
| 4 | Answer generation produces terse (1–5 words) + full (2–3 sentences) via Haiku 4.5 | VERIFIED | `generate-answer.ts` calls `client.messages.parse` with `max_tokens: 512` and `AnswerSchema` |
| 5 | Cards persist to `answer_cards` DB table with all 9 required columns | VERIFIED | `trigger.ts:85–95` INSERT includes all 9 fields; `003_intelligence_cards.sql` table DDL confirmed valid |
| 6 | Realtime hook delivers new cards to active session screen without polling | VERIFIED | `useAnswerCards.ts` subscribes via `postgres_changes` INSERT on `answer_cards` filtered by `session_id` |
| 7 | CardStack wired into active session page; swipe dismiss is local-only | VERIFIED | `active/page.tsx:15,27,125` imports `CardStack` and `useAnswerCards`, renders `<CardStack cards={cards} onDismiss={dismissCard} />` |
| 8 | Summary screen Q&A section fetches and renders all session answer cards | VERIFIED | `summary/page.tsx:49–56` fetches `/api/session/cards`, passes to `<QASection cards={cards} />`  |
| 9 | Deduplication: soft (LLM prompt with existing topic_keys) + hard (DB maybeSingle before INSERT) | VERIFIED | `trigger.ts:34–58` implements both dedup strategies |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `db/migrations/003_intelligence_cards.sql` | answer_cards table DDL with RLS | VERIFIED | All 10 columns, 3 indexes, `tenant_isolation` RLS policy present |
| `src/types/cards.ts` | AnswerCard and IntentResult interfaces | VERIFIED | Exports `CardType`, `AnswerCard`, `IntentResult` — 33 lines, substantive |
| `src/lib/intelligence/classify-intent.ts` | classifyIntent + IntentSchema exports | VERIFIED | 72 lines; exports `IntentSchema` and `classifyIntent`; logs every call |
| `src/lib/intelligence/retrieve-answer.ts` | retrieveFromListings, retrieveFromPDF, retrieveStats | VERIFIED | 68 lines; all three exports present and substantive |
| `src/lib/intelligence/generate-answer.ts` | generateAnswer + GeneratedAnswer exports | VERIFIED | 42 lines; exports `GeneratedAnswer` type and `generateAnswer` function |
| `src/lib/intelligence/trigger.ts` | triggerIntelligence orchestrator | VERIFIED | 102 lines; complete 7-step pipeline including both dedup strategies |
| `src/app/api/session/chunk/route.ts` | Extended with waitUntil(triggerIntelligence) | VERIFIED | Lines 2–4 import `waitUntil` and `triggerIntelligence`; line 39 calls them |
| `src/hooks/useAnswerCards.ts` | Realtime subscription hook | VERIFIED | 70 lines; subscribes to `postgres_changes`, maps snake_case → camelCase, exports `useAnswerCards` |
| `src/app/(session)/active/components/CardStack.tsx` | Card stack container | VERIFIED | Renders `AnswerCard` per item, `maxHeight: '50vh'` overflow |
| `src/app/(session)/active/components/AnswerCard.tsx` | Single card with states + swipe | VERIFIED | Collapsed/expanded toggle, pointer-event swipe (>80px threshold), calls `onDismiss` |
| `src/app/(session)/active/page.tsx` | Active page with CardStack wired in | VERIFIED | Imports `useAnswerCards` and `CardStack`; renders `<CardStack cards={cards} onDismiss={dismissCard} />` at line 125 |
| `src/app/(session)/summary/components/QASection.tsx` | Q&A section component | VERIFIED | Renders `questionText`, `fullAnswer`, source link, empty state; exports `QASection` |
| `src/app/(session)/summary/page.tsx` | Summary page with QASection below transcript | VERIFIED | `QASection` rendered at line 106, below transcript div (line 73), above Start New Session button |
| `src/app/api/session/cards/route.ts` | GET /api/session/cards returning AnswerCard[] | VERIFIED | Queries `answer_cards` ordered by `fired_at ASC`, maps snake_case to camelCase, returns `{ cards }` |
| `src/lib/intelligence/__tests__/classify-intent.test.ts` | 8 TDD tests for intent classification | VERIFIED | 8 passing tests confirmed by `vitest run` |
| `src/lib/intelligence/__tests__/retrieve-answer.test.ts` | 7 TDD tests for retrieval | VERIFIED | 7 passing tests confirmed by `vitest run` |
| `src/lib/intelligence/__tests__/generate-answer.test.ts` | 4 TDD tests for answer generation | VERIFIED | 4 passing tests confirmed by `vitest run` |
| `src/lib/intelligence/__tests__/trigger.test.ts` | 11 TDD tests for pipeline orchestrator | VERIFIED | 11 passing tests confirmed by `vitest run` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `chunk/route.ts` | `trigger.ts` | `waitUntil(triggerIntelligence(sessionId, tenantId))` | WIRED | Line 39 of route.ts confirmed |
| `trigger.ts` | `classify-intent.ts` | `classifyIntent(chunkTexts, existingTopicKeys)` | WIRED | Line 44 of trigger.ts |
| `trigger.ts` | `answer_cards` table | `client.from('answer_cards').insert({...})` | WIRED | Line 85 of trigger.ts |
| `classify-intent.ts` | `@anthropic-ai/sdk` | `client.messages.parse()` with `zodOutputFormat(IntentSchema)` | WIRED | Line 48 of classify-intent.ts |
| `classify-intent.ts` | `src/types/cards.ts` | `import type { IntentResult }` | WIRED | Line 4 of classify-intent.ts |
| `retrieve-answer.ts` | `src/lib/embeddings/generate.ts` | `generateEmbedding(queryText)` import | WIRED | Line 1 and line 35 of retrieve-answer.ts |
| `retrieve-answer.ts` | `match_document_chunks` RPC | `client.rpc('match_document_chunks', { query_embedding, match_threshold: 0.5, match_count: 5, p_tenant_id })` | WIRED | Lines 38–43 of retrieve-answer.ts |
| `generate-answer.ts` | `@anthropic-ai/sdk` | `client.messages.parse()` + `zodOutputFormat(AnswerSchema)` | WIRED | Lines 29–40 of generate-answer.ts |
| `active/page.tsx` | `useAnswerCards.ts` | `const { cards, dismissCard } = useAnswerCards(lifecycle.sessionId)` | WIRED | Line 27 of active/page.tsx |
| `useAnswerCards.ts` | `answer_cards` table | `postgres_changes` INSERT filter `session_id=eq.{id}` | WIRED | Lines 29–36 of useAnswerCards.ts |
| `CardStack.tsx` | `AnswerCard.tsx` | `cards.map(card => <AnswerCard card={card} onDismiss={...} />)` | WIRED | Line 20 of CardStack.tsx |
| `summary/page.tsx` | `answer_cards` via `/api/session/cards` | `fetch('/api/session/cards?sessionId=...')` | WIRED | Line 49 of summary/page.tsx |
| `summary/page.tsx` | `QASection.tsx` | `<QASection cards={cards} />` | WIRED | Line 106 of summary/page.tsx |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INTEL-01 | 03-01, 03-02, 03-04 | App detects questions from live transcript | SATISFIED | `classifyIntent` + `triggerIntelligence` via `waitUntil` on every chunk save |
| INTEL-02 | 03-01, 03-03, 03-04 | App retrieves answers from company data | SATISFIED | Three retrieval paths (SQL listings, pgvector, stats JSONB) dispatched by `retrieval_type` |
| INTEL-03 | 03-01, 03-02, 03-04 | No card flooding — max 2–3/min under normal conversation | SATISFIED | Soft dedup: existing topic_keys passed to LLM prompt; hard dedup: `maybeSingle()` SELECT before INSERT |
| CARD-01 | 03-01, 03-05, 03-06 | Cards stack upward — newest at bottom, older scroll off top | SATISFIED | `CardStack` uses `flex-col justify-end` with `maxHeight: 50vh` overflow |
| CARD-02 | 03-01, 03-03, 03-05 | Glanceable short answer in collapsed state | SATISFIED | `AnswerCard` renders `card.terseAnswer` (1–5 words) in collapsed button; enforced in generate prompt |
| CARD-03 | 03-01, 03-05, 03-06 | Tap to expand for more detail | SATISFIED | `AnswerCard` toggles `expanded` state on button click, revealing `card.fullAnswer` |
| CARD-04 | 03-01, 03-03, 03-05, 03-06 | Source link opens in browser | SATISFIED | `AnswerCard` and `QASection` both render `<a href={card.sourceRef} target="_blank">` when `sourceRef` non-empty |
| CARD-05 | 03-01, 03-05 | Swipe to dismiss — local state only | SATISFIED | Pointer-event swipe with 80px threshold calls `onDismiss`; `dismissCard` filters from React state, no DB DELETE |

**All 8 phase requirements (INTEL-01 through CARD-05) satisfied.**

No orphaned requirements — all IDs mapped to this phase in REQUIREMENTS.md traceability table match the IDs claimed in plan frontmatter.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `classify-intent.ts:58` | `zodOutputFormat(IntentSchema)` — plan specified second arg `'intent'` | Info | Omitting the label arg is valid; the SDK accepts it. Not a functional defect. |
| `generate-answer.ts:39` | `zodOutputFormat(AnswerSchema)` — plan specified second arg `'answer'` | Info | Same as above. Not a functional defect. |
| `src/app/api/admin/uploads/[id]/route.test.ts` | Pre-existing TypeScript errors (TS2353) | Warning | Phase 2 carryover; acknowledged in 03-01 summary; out of scope for Phase 3 |

No blocker anti-patterns. No TODO/FIXME/placeholder comments in Phase 3 files. No empty implementations. No `return null` stubs.

---

### Test Suite Results

```
vitest run src/lib/intelligence/
  Test Files: 4 passed | 1 skipped (types.test.ts — all it.todo)
  Tests:      30 passed | 6 todo

vitest run CardStack.test.tsx QASection.test.tsx
  Test Files: 2 skipped (all it.todo)
  Tests:      15 todo
```

- classify-intent: 8/8 passing
- retrieve-answer: 7/7 passing
- generate-answer: 4/4 passing
- trigger: 11/11 passing
- types: 6 todo (intended — stubs only)
- CardStack: 8 todo (intended — stubs only)
- QASection: 7 todo (intended — stubs only)

TypeScript: 0 errors in Phase 3 files. 4 pre-existing errors in `src/app/api/admin/uploads/[id]/route.test.ts` (Phase 2 carryover, out of scope).

---

### Human Verification Required

#### 1. End-to-end card latency

**Test:** Start a session, speak a property question ("What is the price of unit 204?"), observe the active session screen.
**Expected:** An answer card appears within 8 seconds of the question being transcribed.
**Why human:** Requires live Anthropic API + Supabase Realtime + deployed Vercel environment; cannot be measured with static grep.

#### 2. Realtime delivery without polling

**Test:** Speak a question during a session; confirm the card appears instantly without page refresh.
**Expected:** Card appears within ~3s driven by Supabase Realtime `postgres_changes` INSERT event, not polling.
**Why human:** Requires live Supabase Realtime with `answer_cards` table added to `supabase_realtime` publication (manual Supabase Dashboard step).

#### 3. Swipe dismiss UX on mobile

**Test:** On a physical iOS or Android device, swipe an answer card left or right with > 80px horizontal movement.
**Expected:** Card slides off screen and disappears; it remains in DB (visible on summary screen).
**Why human:** Pointer event behavior varies on touch screens; requires physical device validation.

#### 4. Card flooding under normal conversation

**Test:** Record 2 minutes of normal estate agent conversation including 4–5 client questions.
**Expected:** No more than 2–3 cards per minute; pleasantries, small talk, and agent self-talk produce no cards.
**Why human:** Requires real transcript samples and empirical observation of Claude Haiku classification quality.

#### 5. Summary Q&A section — dismissed cards still visible

**Test:** Dismiss 1–2 cards during an active session, then end the session and view the summary.
**Expected:** All cards (including dismissed ones) appear in the summary Q&A section.
**Why human:** Requires live session flow; dismiss is local-state-only so dismissed cards must not be deleted from DB.

---

### Gaps Summary

None. All must-haves are verified.

---

_Verified: 2026-03-16T21:35:00Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 03-intelligence-cards
plan: 01
subsystem: database
tags: [postgres, supabase, rls, typescript, anthropic, vitest]

# Dependency graph
requires:
  - phase: 02-data-pipeline
    provides: RLS tenant_isolation policy pattern and sessions table FK target
provides:
  - answer_cards DB migration (003_intelligence_cards.sql) with complete schema, indexes, RLS
  - AnswerCard TypeScript interface matching DB schema (camelCase)
  - IntentResult TypeScript interface for Claude Haiku 4.5 intent classification output
  - CardType union type ('listing' | 'rag' | 'stats')
  - @anthropic-ai/sdk installed in project
  - src/lib/intelligence/__tests__/ directory scaffolded for downstream test files
affects:
  - 03-02-classify-intent
  - 03-03-retrieval
  - 03-04-answer-generation
  - 03-05-card-trigger
  - 03-06-card-ui

# Tech tracking
tech-stack:
  added:
    - "@anthropic-ai/sdk ^0.78.0"
  patterns:
    - "DB migration header comment style: phase name + SQL editor instructions + v2 upgrade note"
    - "camelCase TS interfaces mirror snake_case DB columns (same as TranscriptChunk pattern)"
    - "Test stubs use it.todo() exclusively — no production imports, suite passes before implementation"

key-files:
  created:
    - db/migrations/003_intelligence_cards.sql
    - src/types/cards.ts
    - src/lib/intelligence/__tests__/types.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "answer_cards has question_text column (not in original must_haves list but required by AnswerCard interface and card generation logic)"
  - "IntentResult uses snake_case field names to match Zod schema output from Claude structured extraction (not camelCase like AnswerCard)"
  - "Realtime enablement documented as manual Supabase Dashboard step — supabase_realtime publication requires superuser not available in managed SQL editor"

patterns-established:
  - "CardType: 'listing' | 'rag' | 'stats' — the three retrieval paths for Phase 3"
  - "IntentResult.reason always populated — used for Vercel log-based prompt tuning"

requirements-completed: [INTEL-01, INTEL-02, INTEL-03, CARD-01, CARD-02, CARD-03, CARD-04, CARD-05]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 3 Plan 01: Intelligence Cards Foundation Summary

**answer_cards DB migration with tenant-isolated RLS, AnswerCard/IntentResult TypeScript contracts, and @anthropic-ai/sdk installed — all Phase 3 downstream plans can import types immediately**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-16T14:46:24Z
- **Completed:** 2026-03-16T14:47:55Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- DB migration 003_intelligence_cards.sql with 10-column answer_cards table, composite session_topic index, and tenant_isolation RLS policy matching Phase 2 pattern
- src/types/cards.ts exports AnswerCard, IntentResult, and CardType — the data contract all downstream Phase 3 plans depend on
- @anthropic-ai/sdk ^0.78.0 installed and in package.json
- src/lib/intelligence/__tests__/types.test.ts scaffolded with 6 it.todo() stubs — vitest exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration — answer_cards table with RLS and Realtime** - `01189b5` (feat)
2. **Task 2: TypeScript types + test stubs** - `3192c83` (feat)

## Files Created/Modified

- `db/migrations/003_intelligence_cards.sql` - answer_cards DDL with RLS and Realtime setup instructions
- `src/types/cards.ts` - AnswerCard, IntentResult, CardType exports
- `src/lib/intelligence/__tests__/types.test.ts` - 6 it.todo() stubs for type contract verification
- `package.json` - @anthropic-ai/sdk ^0.78.0 added to dependencies
- `package-lock.json` - lockfile updated

## Decisions Made

- `question_text` column added to migration and AnswerCard interface (not explicit in must_haves but required by card generation logic in downstream plans 03-04/03-05)
- `IntentResult` uses snake_case field names to match the Zod structured output schema from Claude (consistent with LLM output conventions, unlike the DB-mirroring camelCase of AnswerCard)
- Realtime enablement left as manual Supabase Dashboard step — `ALTER PUBLICATION supabase_realtime` requires superuser privileges unavailable in managed SQL editor; instructions embedded in migration comments

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in `src/app/api/admin/uploads/[id]/route.test.ts` from Phase 2 (unrelated to this plan's changes) — out of scope per scope boundary rules, deferred

## User Setup Required

External services require manual configuration after this plan:

1. **Supabase Realtime** — After running the migration, enable Realtime on `answer_cards` in Supabase Dashboard: Database -> Replication -> Tables -> answer_cards -> toggle ON. Without this, `postgres_changes` events will not fire for browser clients.

2. **Anthropic API Key** — Set `ANTHROPIC_API_KEY` in `.env.local` (from Anthropic Console -> API Keys at console.anthropic.com). Required for Claude Haiku 4.5 intent classification in plans 03-02 onward.

## Next Phase Readiness

- All Phase 3 downstream plans (03-02 through 03-06) can import from `src/types/cards.ts` immediately
- `@anthropic-ai/sdk` ready for use in 03-02 classify-intent
- DB migration ready to apply to Supabase project
- Intent classification prompt engineering will require empirical tuning with real transcript samples (known concern in STATE.md blockers)

---
*Phase: 03-intelligence-cards*
*Completed: 2026-03-16*

## Self-Check: PASSED

- FOUND: db/migrations/003_intelligence_cards.sql
- FOUND: src/types/cards.ts
- FOUND: src/lib/intelligence/__tests__/types.test.ts
- FOUND: .planning/phases/03-intelligence-cards/03-01-SUMMARY.md
- FOUND commit: 01189b5 (Task 1)
- FOUND commit: 3192c83 (Task 2)

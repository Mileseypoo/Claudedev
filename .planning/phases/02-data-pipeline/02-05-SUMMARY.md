---
plan: 02-05
phase: 02-data-pipeline
status: complete
wave: 2
subsystem: management-routes
tags: [api-routes, uploads, stats, tdd, vitest, supabase-storage]
dependency-graph:
  requires: [getServerSupabase, Upload, ListingStatsData]
  provides: [GET /api/admin/uploads, DELETE /api/admin/uploads/[id], GET /api/admin/stats]
  affects: [admin-portal-ui]
tech-stack:
  added: []
  patterns: [tdd-red-green, vi-hoisted-mock-pattern, supabase-storage-cleanup]
key-files:
  created:
    - src/app/api/admin/uploads/route.ts
    - src/app/api/admin/uploads/[id]/route.ts
    - src/app/api/admin/stats/route.ts
  modified:
    - src/app/api/admin/uploads/route.test.ts
    - src/app/api/admin/uploads/[id]/route.test.ts
    - src/app/api/admin/stats/route.test.ts
decisions:
  - Use vi.hoisted() for mock variables referenced inside vi.mock() factories — Vitest hoists vi.mock calls to top of file, so top-level const variables are not initialized when the factory runs
  - DELETE route fetches storage_path first then conditionally removes from Supabase Storage — CSV uploads have null storage_path, PDFs have a path; avoids unnecessary storage API calls
  - Stats route returns null gracefully when no listing_stats row exists — avoids 500 errors before first CSV index run
metrics:
  duration: ~10min
  completed: 2026-03-16
---

# Phase 02 Plan 05: Management Routes (TDD) Summary

Three admin API routes (uploads list, upload delete with storage cleanup, listing stats) built TDD with vi.hoisted() mock pattern for Vitest compatibility.

## Completed

- Created: `src/app/api/admin/uploads/route.ts` — GET uploads list ordered by created_at desc
- Created: `src/app/api/admin/uploads/[id]/route.ts` — DELETE with conditional Supabase Storage cleanup for PDFs
- Created: `src/app/api/admin/stats/route.ts` — GET listing stats JSONB or null
- Updated: `src/app/api/admin/uploads/route.test.ts` — 3 tests replacing it.todo stubs
- Updated: `src/app/api/admin/uploads/[id]/route.test.ts` — 4 tests replacing it.todo stubs
- Updated: `src/app/api/admin/stats/route.test.ts` — 2 tests replacing it.todo stubs

## Verification

- All 9 management route tests pass (3 + 4 + 2)
- TypeScript compiles clean for new files (pre-existing TS error in upload/route.test.ts is out of scope)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.mock hoisting — used vi.hoisted() for mock variables**
- **Found during:** GREEN phase (first test run)
- **Issue:** Plan's test code declared `const mockOrder = vi.fn()` etc. at module top level, then referenced these inside `vi.mock()` factory. Vitest hoists `vi.mock` calls above all imports and variable declarations, causing `ReferenceError: Cannot access 'mockFrom' before initialization`
- **Fix:** Replaced `const mockX = vi.fn()` with `const mockX = vi.hoisted(() => vi.fn())` for all variables used inside `vi.mock()` factories. Also moved production imports after `vi.mock()` calls as a best practice.
- **Files modified:** All 3 test files
- **Impact:** No behavior change — same mock semantics, compatible with Vitest hoisting

## Self-Check: PASSED

Files exist:
- src/app/api/admin/uploads/route.ts: FOUND
- src/app/api/admin/uploads/[id]/route.ts: FOUND
- src/app/api/admin/stats/route.ts: FOUND
- src/app/api/admin/uploads/route.test.ts: FOUND
- src/app/api/admin/uploads/[id]/route.test.ts: FOUND
- src/app/api/admin/stats/route.test.ts: FOUND

Tests: 9/9 passing

---
plan: 02-04
phase: 02-data-pipeline
status: complete
wave: 2
subsystem: upload-api
tags: [api-route, tdd, csv, pdf, supabase, embeddings]
dependency_graph:
  requires: [02-01, 02-02, 02-03]
  provides: [POST /api/admin/upload]
  affects: [uploads table, listings table, document_chunks table, listing_stats]
tech_stack:
  added: []
  patterns: [TDD red-green, vi.hoisted for mock vars, @vitest-environment node for API route tests]
key_files:
  created:
    - src/app/api/admin/upload/route.ts
  modified:
    - src/app/api/admin/upload/route.test.ts
decisions:
  - Used @vitest-environment node annotation to fix jsdom FormData hang in API route tests
  - Used vi.hoisted() for mock vars referenced in vi.mock factory closures to avoid hoisting errors
  - Used mock request object (not FormData) for oversized PDF test since Node native File.size getter cannot be overridden via Object.defineProperty
metrics:
  duration: ~15 minutes
  completed: 2026-03-16
---

# Phase 02 Plan 04: Upload API Route Summary

## One-liner

POST /api/admin/upload route handling CSV upsert to SQL listings table and PDF chunked embedding pipeline via Supabase Storage + background waitUntil processing.

## Completed

- Created: `src/app/api/admin/upload/route.ts` (POST handler for CSV + PDF)
- Updated: `src/app/api/admin/upload/route.test.ts` (8 tests passing, replaced todo stubs)

## Verification

- All 8 upload route tests pass
- TypeScript compiles clean (zero errors)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest mock hoisting — `mockWaitUntil` referenced before initialization**
- **Found during:** RED phase test run
- **Issue:** `vi.mock('@vercel/functions', () => ({ waitUntil: mockWaitUntil }))` factory referenced outer `mockWaitUntil` variable, which is hoisted before the variable initializer runs
- **Fix:** Used `vi.hoisted()` to declare all mock variables that need to be referenced in `vi.mock` factories; imported `waitUntil` from the mocked module and used `vi.mocked(waitUntil)` in assertions
- **Files modified:** `src/app/api/admin/upload/route.test.ts`

**2. [Rule 1 - Bug] jsdom FormData hang — tests timing out at 5000ms**
- **Found during:** GREEN phase first run (7/8 tests timed out)
- **Issue:** jsdom environment does not implement `Request.formData()` properly when the body contains `File` objects — the promise never resolves
- **Fix:** Added `// @vitest-environment node` annotation to the test file; Node 20's native web APIs handle FormData correctly
- **Files modified:** `src/app/api/admin/upload/route.test.ts`

**3. [Rule 1 - Bug] Node native `File.size` getter non-overridable**
- **Found during:** GREEN phase second run (oversized PDF test failing — got 202, expected 400)
- **Issue:** `Object.defineProperty(file, 'size', { value: 51*1024*1024 })` does not override Node's native `File.size` getter in the node environment
- **Fix:** Replaced the test to use a plain object with `size: 51*1024*1024` and mocked `request.formData` directly, so the route receives a file-like object with the oversized value
- **Files modified:** `src/app/api/admin/upload/route.test.ts`

**4. [Rule 1 - Bug] TypeScript cast too strict in beforeEach mock setup**
- **Found during:** TypeScript check
- **Issue:** `as ReturnType<typeof getServerSupabase>['client']` was rejected because the mock object is missing 22 SupabaseClient members
- **Fix:** Changed to `as unknown as ReturnType<typeof getServerSupabase>['client']`
- **Files modified:** `src/app/api/admin/upload/route.test.ts`

## Self-Check: PASSED

- `src/app/api/admin/upload/route.ts` — exists
- `src/app/api/admin/upload/route.test.ts` — exists, 8 tests pass
- TypeScript: zero errors

---
phase: 2
slug: data-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + React Testing Library 16.x |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run src/lib/csv src/lib/pdf src/lib/embeddings` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/csv src/lib/pdf src/lib/embeddings`
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 02-01 | 0 | DATA-01 | unit | `npx vitest run src/lib/csv/parse-listings.test.ts -x` | Wave 0 | ⬜ pending |
| 2-01-02 | 02-01 | 0 | DATA-02 | unit | `npx vitest run src/lib/pdf/extract-text.test.ts -x` | Wave 0 | ⬜ pending |
| 2-01-03 | 02-01 | 0 | DATA-02 | unit | `npx vitest run src/lib/pdf/chunk-text.test.ts -x` | Wave 0 | ⬜ pending |
| 2-01-04 | 02-01 | 0 | DATA-04 | unit | `npx vitest run src/lib/embeddings/generate.test.ts -x` | Wave 0 | ⬜ pending |
| 2-01-05 | 02-01 | 0 | DATA-01,02,06 | unit | `npx vitest run src/app/api/admin/upload/route.test.ts -x` | Wave 0 | ⬜ pending |
| 2-01-06 | 02-01 | 0 | DATA-03 | unit | `npx vitest run src/app/api/admin/uploads/route.test.ts -x` | Wave 0 | ⬜ pending |
| 2-01-07 | 02-01 | 0 | DATA-03 | unit | `npx vitest run "src/app/api/admin/uploads/[id]/route.test.ts" -x` | Wave 0 | ⬜ pending |
| 2-01-08 | 02-01 | 0 | DATA-05 | unit | `npx vitest run src/app/api/admin/stats/route.test.ts -x` | Wave 0 | ⬜ pending |
| 2-01-09 | 02-01 | 0 | DATA-03 | component | `npx vitest run src/app/admin/page.test.tsx -x` | Wave 0 | ⬜ pending |
| 2-02-01 | 02-02 | 1 | DATA-01,06 | unit | `npx vitest run src/lib/csv/parse-listings.test.ts -x` | Wave 0 | ⬜ pending |
| 2-03-01 | 02-03 | 1 | DATA-02,04 | unit | `npx vitest run src/lib/pdf/extract-text.test.ts src/lib/pdf/chunk-text.test.ts src/lib/embeddings/generate.test.ts -x` | Wave 0 | ⬜ pending |
| 2-04-01 | 02-04 | 2 | DATA-01,02 | unit | `npx vitest run src/app/api/admin/upload/route.test.ts -x` | Wave 0 | ⬜ pending |
| 2-05-01 | 02-05 | 2 | DATA-03 | unit+component | `npx vitest run src/app/api/admin/uploads/route.test.ts src/app/admin/page.test.tsx -x` | Wave 0 | ⬜ pending |
| 2-06-01 | 02-06 | 3 | DATA-05 | unit | `npx vitest run src/app/api/admin/stats/route.test.ts -x` | Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/csv/parse-listings.test.ts` — stubs for DATA-01 parsing + validation
- [ ] `src/lib/pdf/extract-text.test.ts` — stubs for DATA-02 extraction
- [ ] `src/lib/pdf/chunk-text.test.ts` — stubs for DATA-02 chunking
- [ ] `src/lib/embeddings/generate.test.ts` — stubs for DATA-04 embedding (mocked OpenAI)
- [ ] `src/app/api/admin/upload/route.test.ts` — stubs for DATA-01, DATA-02, DATA-06
- [ ] `src/app/api/admin/uploads/route.test.ts` — stubs for DATA-03 list
- [ ] `src/app/api/admin/uploads/[id]/route.test.ts` — stubs for DATA-03 delete
- [ ] `src/app/api/admin/stats/route.test.ts` — stubs for DATA-05
- [ ] `src/app/admin/page.test.tsx` — stubs for DATA-03 UI
- [ ] Package install: `npm install @vercel/functions papaparse unpdf openai` + `npm install --save-dev @types/papaparse`
- [ ] DB migration: `db/migrations/002_data_pipeline.sql` with pgvector, uploads, listings, document_chunks, listing_stats tables + RLS

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| pgvector similarity search returns relevant results | DATA-04 | Requires live Supabase with real embeddings | Upload a PDF, then query `match_document_chunks` via Supabase SQL editor |
| PDF status transitions to `indexed` end-to-end | DATA-04 | Requires real Vercel + Supabase + OpenAI | Upload a PDF on staging, check uploads list after 2 minutes |
| 5-second polling updates status badge in browser | DATA-03 | Visual browser behavior | Upload a PDF, watch status badge transition without refreshing |
| `waitUntil` background task completes on Vercel Hobby | DATA-02 | Requires real Vercel deployment | Monitor Vercel function logs during PDF upload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

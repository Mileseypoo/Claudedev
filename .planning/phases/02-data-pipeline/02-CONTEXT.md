# Phase 2: Data Pipeline - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin uploads CSV property listings and PDF documents → system validates, stores, and indexes them → data becomes queryable for Phase 3 (answer generation and card surfacing). No card UI, no AI answering, no session integration yet — this phase is purely the data ingestion and indexing layer.

</domain>

<decisions>
## Implementation Decisions

### Admin Portal UX
- Lives at `/admin` route within the same Next.js app — no separate deployment
- No authentication for the POC — access controlled by URL knowledge (auth is v2 requirement AUTH-01)
- Desktop-first layout — file uploads are a setup task done from a laptop, not during meetings
- Portal shows: file upload area, uploaded files list (name, type, date, status), per-row delete/re-upload actions, stats preview summary (e.g. "42 listings indexed, 3 documents")

### CSV Structure & Validation
- Fixed schema enforced — no inference from arbitrary headers
- Admin can download a template CSV showing exact required columns
- Required columns: `property_id`, `address`, `area`, `price_aed`, `bedrooms`, `bathrooms`, `size_sqft`, `status` (available/sold/reserved), `developer`, `community`, `property_type`
- Optional column: `sold_date` (enables "recently sold" stats)
- On upload: validate all required columns present; reject with clear per-column error messages if not
- On re-upload: merge/upsert by `property_id` — existing listings updated, new ones added, removed ones left (or optionally deleted — Claude's discretion)

### Indexing Feedback & Timing
- File rows show status badge: Uploading → Processing → Indexed (or Error with reason)
- Admin does not need to stay on the page — status persists in DB
- Page auto-polls every 5 seconds and updates status badges in place
- Error badge shows specific reason (e.g. "Could not extract text — may be a scanned image")
- PDF file size limit: 50MB per file
- CSV processing is synchronous (fast) — status goes to Indexed immediately after validation
- PDF processing is async (embedding generation takes time) — background job, status updates via polling

### Stats Auto-Calculation
- Stats are calculated from the listings CSV automatically — no manual entry
- Calculated stats available for Phase 3 retrieval:
  - Count by status (available / sold / reserved)
  - Price range by area/community (min, max, median)
  - Average price by bedroom count
  - Recently sold count (requires `sold_date` column — ignored if not present)
- Stats recalculated on every CSV upsert

### PDF Document Types
- Two categories of PDFs — both indexed identically via pgvector RAG:
  1. **Reference docs** — property brochures, regulatory documents (UAE foreign buyer rules, DLD/RERA guidance)
  2. **Pitch support docs** — seasonal insights, team achievements, market context ("100th sale this month", "good weather brings tourists", "sales increase this time of year")
- Phase 3 decides when to surface PDF content as cards — Phase 2 just ensures it's indexed and retrievable

### Claude's Discretion
- Exact Supabase Storage bucket configuration vs. storing files as blobs
- pgvector chunking strategy for PDFs (chunk size, overlap)
- Embedding model choice (OpenAI text-embedding-3-small recommended for cost)
- Background job implementation (Vercel background functions vs. immediate processing)
- Exact stats summary format in the admin portal preview

</decisions>

<specifics>
## Specific Ideas

- Template CSV download makes onboarding fast — admin doesn't need to read docs, just fills in the sheet
- The distinction between "reference docs" and "pitch support docs" is purely conceptual — they're uploaded the same way. The sales team decides what goes in. Phase 3 retrieves from all of it.
- "The app could identify an opportunity to mention that sales increase this time of the year, or that the good weather brings tourists, or that the team has completed their 100th sale this month" — these are pitch support PDFs that the sales team authors and uploads

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/server.ts` — `getServerSupabase()` with tenant context injection and RLS; all admin API routes use this pattern
- `src/lib/constants.ts` — `DEFAULT_TENANT_ID` for POC single-tenant; admin portal scoped to this tenant
- `db/migrations/001_foundation.sql` — existing schema pattern (RLS policies, tenant_id on every table); Phase 2 migration extends this

### Established Patterns
- All tables have `tenant_id uuid not null references public.tenants(id)` — must continue for uploads, listings, documents, chunks tables
- API routes use `getServerSupabase()` → `client.from(table).insert/select` pattern
- Service role key bypasses RLS for server-side operations
- Next.js App Router: all admin pages go under `src/app/admin/` route group

### Integration Points
- Phase 3 (intelligence) queries `listings` table via SQL for structured property data
- Phase 3 (intelligence) queries pgvector embeddings table via similarity search for PDF content
- Stats calculations feed into Phase 3's proactive card triggering
- `DEFAULT_TENANT_ID` is the POC tenant — all admin uploads scoped to this ID

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-data-pipeline*
*Context gathered: 2026-03-16*

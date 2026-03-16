# Phase 2: Data Pipeline - Research

**Researched:** 2026-03-16
**Domain:** File ingestion (CSV + PDF), pgvector RAG indexing, OpenAI embeddings, admin portal
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Admin portal lives at `/admin` route within the same Next.js app — no separate deployment
- No authentication for the POC — access controlled by URL knowledge
- Desktop-first layout
- Portal shows: file upload area, uploaded files list (name, type, date, status), per-row delete/re-upload actions, stats preview summary
- Fixed CSV schema — no inference from arbitrary headers
- Admin can download a template CSV showing exact required columns
- Required columns: `property_id`, `address`, `area`, `price_aed`, `bedrooms`, `bathrooms`, `size_sqft`, `status` (available/sold/reserved), `developer`, `community`, `property_type`
- Optional column: `sold_date` (enables "recently sold" stats)
- On upload: validate all required columns present; reject with clear per-column error messages if not
- On re-upload: merge/upsert by `property_id`
- File rows show status badge: Uploading → Processing → Indexed (or Error with reason)
- Admin does not need to stay on the page — status persists in DB
- Page auto-polls every 5 seconds and updates status badges in place
- Error badge shows specific reason
- PDF file size limit: 50MB per file
- CSV processing is synchronous — status goes to Indexed immediately after validation
- PDF processing is async — background job, status updates via polling
- Stats are calculated from the listings CSV automatically — no manual entry
- Stats: count by status, price range by area/community (min/max/median), average price by bedroom count, recently sold count (if `sold_date` present)
- Two PDF categories (reference docs + pitch support docs) — both indexed identically via pgvector RAG
- Phase 3 decides when to surface PDF content — Phase 2 just indexes it

### Claude's Discretion
- Exact Supabase Storage bucket configuration vs. storing files as blobs
- pgvector chunking strategy for PDFs (chunk size, overlap)
- Embedding model choice (OpenAI text-embedding-3-small confirmed for cost)
- Background job implementation (Vercel background functions vs. immediate processing)
- Exact stats summary format in the admin portal preview

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | Admin can upload CSV files (property listings, performance stats) | PapaParse server-side parsing, Zod schema validation, upsert pattern |
| DATA-02 | Admin can upload PDF files (brochures, regulatory documents) | unpdf for text extraction, Supabase Storage for file storage |
| DATA-03 | Admin can manage uploads via a simple web portal (view, delete, re-upload) | Next.js App Router `/admin` page, polling pattern, Supabase queries |
| DATA-04 | Uploaded data is indexed and queryable within minutes of upload | CSV synchronous, PDF async via waitUntil or dedicated route, pgvector HNSW index |
| DATA-05 | Stats and talking points surface proactively as cards | SQL aggregates pre-computed on CSV upsert, stored in `listing_stats` table |
| DATA-06 | Structured listing data (prices, availability) is queried from SQL, not RAG | `listings` table with typed columns, no embedding of CSV rows |
</phase_requirements>

---

## Summary

Phase 2 builds the data ingestion layer that all Phase 3 intelligence depends on. It has two distinct pipelines: CSV property listings flow directly into a typed PostgreSQL `listings` table via upsert (no vector embeddings — queried via SQL per DATA-06), and PDF documents are text-extracted, chunked, embedded via OpenAI text-embedding-3-small, and stored as pgvector rows for semantic retrieval.

The biggest technical constraint is Vercel's 30-second serverless timeout. CSV processing easily fits within this window (synchronous parse + upsert). PDF processing for large documents must be handled asynchronously. The recommended approach is to use Vercel's `waitUntil` API (available on Fluid Compute, enabled by default for new projects as of April 2025) to return a 202 response immediately and continue processing in the background — no external queue service required for a POC.

The admin portal at `/admin` is a standard Next.js client page with 5-second polling against a status API. The polling pattern uses `useEffect` + `setInterval` with cleanup, reading upload status from the database. All tables follow the established project pattern: `tenant_id` on every row, RLS via `current_setting('app.tenant_id')`, accessed via the existing `getServerSupabase()` helper.

**Primary recommendation:** Use PapaParse (string mode) for CSV, unpdf for PDF text extraction, OpenAI text-embedding-3-small (1536 dimensions) for embeddings, HNSW index on the document_chunks table, and Vercel `waitUntil` for background PDF processing. No external job queue needed for POC.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| papaparse | ^5.4.x | CSV string parsing, header validation | Zero dependencies, handles edge cases (quoted fields, BOM), works in Node.js without file system |
| unpdf | ^0.12.x | PDF text extraction | Pure JS, zero native deps, works on Vercel serverless without canvas/node-gyp issues |
| openai | ^4.x | Embedding generation via text-embedding-3-small | Already implied by project; official SDK |
| zod | ^4.3.6 (already installed) | CSV row validation, API request schemas | Already in project; TypeScript-first |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/supabase-js | ^2.99.1 (already installed) | pgvector RPC calls, storage upload, upsert | All DB operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| unpdf | pdf-parse | pdf-parse fails on Vercel serverless due to canvas native module; unpdf is pure JS |
| unpdf | pdf2json | pdf2json also pure JS but less actively maintained; needs `serverComponentsExternalPackages` config |
| waitUntil (background) | Inngest / Upstash Workflow | External services add cost and complexity; waitUntil is sufficient for POC single-file processing |
| papaparse | csv-parse | Both work server-side; papaparse handles more CSV quirks and is already battle-tested with this stack pattern |
| HNSW index | IVFFlat | IVFFlat requires training data before indexing; HNSW builds incrementally as chunks are inserted — better for a dataset that grows from zero |

### Installation
```bash
npm install papaparse unpdf openai
npm install --save-dev @types/papaparse
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── admin/
│   │   ├── page.tsx              # Admin portal — 'use client', desktop layout
│   │   └── components/
│   │       ├── FileUploadZone.tsx    # Drag-and-drop + file picker
│   │       ├── UploadedFilesList.tsx # Table with status badges, delete/re-upload
│   │       └── StatsPreview.tsx      # Calculated stats summary
│   └── api/
│       ├── admin/
│       │   ├── upload/
│       │   │   └── route.ts      # POST: receive file, dispatch CSV or PDF pipeline
│       │   ├── uploads/
│       │   │   └── route.ts      # GET: list uploads with status (polling target)
│       │   ├── uploads/[id]/
│       │   │   └── route.ts      # DELETE: remove upload record + storage file + listings/chunks
│       │   └── stats/
│       │       └── route.ts      # GET: return pre-calculated stats
│       └── ...existing session routes
├── lib/
│   ├── csv/
│   │   └── parse-listings.ts     # PapaParse string parse + Zod validation
│   ├── pdf/
│   │   ├── extract-text.ts       # unpdf text extraction
│   │   └── chunk-text.ts         # Recursive character chunker
│   └── embeddings/
│       └── generate.ts           # OpenAI text-embedding-3-small batch wrapper
└── types/
    └── admin.ts                  # Upload, Listing, DocumentChunk types
```

### Pattern 1: CSV Upload — Synchronous Upsert
**What:** Receive CSV as FormData, parse with PapaParse (string mode), validate with Zod, bulk upsert into `listings` table, recalculate stats, return 201.
**When to use:** All CSV uploads — processing is fast enough for the 30s window even for thousands of rows.

```typescript
// src/lib/csv/parse-listings.ts
// Source: PapaParse docs + Zod project pattern (already used in this codebase)
import Papa from 'papaparse'
import { z } from 'zod'

const ListingRowSchema = z.object({
  property_id: z.string().min(1),
  address: z.string().min(1),
  area: z.string().min(1),
  price_aed: z.coerce.number().positive(),
  bedrooms: z.coerce.number().nonnegative(),
  bathrooms: z.coerce.number().nonnegative(),
  size_sqft: z.coerce.number().positive(),
  status: z.enum(['available', 'sold', 'reserved']),
  developer: z.string().min(1),
  community: z.string().min(1),
  property_type: z.string().min(1),
  sold_date: z.string().optional(),
})

export type ListingRow = z.infer<typeof ListingRowSchema>

export function parseCsv(csvString: string): {
  rows: ListingRow[]
  errors: string[]
} {
  const result = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  const REQUIRED_COLS = [
    'property_id', 'address', 'area', 'price_aed', 'bedrooms',
    'bathrooms', 'size_sqft', 'status', 'developer', 'community', 'property_type',
  ]
  const headers = result.meta.fields ?? []
  const missing = REQUIRED_COLS.filter((col) => !headers.includes(col))
  if (missing.length > 0) {
    return { rows: [], errors: missing.map((col) => `Missing required column: ${col}`) }
  }

  const rows: ListingRow[] = []
  const errors: string[] = []
  result.data.forEach((row: unknown, i: number) => {
    const parsed = ListingRowSchema.safeParse(row)
    if (parsed.success) {
      rows.push(parsed.data)
    } else {
      errors.push(`Row ${i + 2}: ${parsed.error.issues.map((e) => e.message).join(', ')}`)
    }
  })
  return { rows, errors }
}
```

### Pattern 2: PDF Upload — Async via waitUntil
**What:** Receive PDF as FormData, immediately store file to Supabase Storage, create `uploads` record with status `processing`, return 202, then use Vercel `waitUntil` to run text extraction + chunking + embedding in the background.
**When to use:** All PDF uploads. Vercel Fluid Compute (default for new projects as of April 2025) supports `waitUntil` for background tasks up to 300s on Hobby, 800s on Pro.

```typescript
// src/app/api/admin/upload/route.ts (PDF branch)
// Source: Vercel Fluid Compute docs — waitUntil pattern
import { waitUntil } from '@vercel/functions'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  // 1. Upload raw file to Supabase Storage
  // 2. Insert uploads record with status = 'processing'
  // 3. Return 202 immediately
  // 4. Process in background
  waitUntil(processPdfInBackground(uploadId, fileBuffer, tenantId))

  return Response.json({ uploadId }, { status: 202 })
}
```

**CRITICAL:** `waitUntil` requires `npm install @vercel/functions` and the function must NOT be on the Edge runtime — use Node.js runtime (default for App Router route handlers).

### Pattern 3: pgvector Similarity Search via RPC
**What:** PostgREST does not support pgvector operators directly. All similarity searches go through a Postgres function called via `client.rpc()`.
**When to use:** Phase 3 queries — not used in Phase 2, but Phase 2 must create the `match_document_chunks` function that Phase 3 will call.

```sql
-- Source: Supabase official pgvector docs
-- Part of Phase 2 migration — used by Phase 3
create or replace function match_document_chunks(
  query_embedding extensions.vector(1536),
  match_threshold float,
  match_count int,
  p_tenant_id uuid
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where
    dc.tenant_id = p_tenant_id
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding asc
  limit match_count;
$$;
```

### Pattern 4: 5-Second Polling
**What:** Client component polls the uploads list API every 5 seconds, updates status badges in place without full page reload.
**When to use:** Admin portal page — keep polling while any upload has status `processing`.

```typescript
// src/app/admin/page.tsx (client component pattern)
// Source: React useEffect + setInterval standard pattern
'use client'
import { useEffect, useRef, useState } from 'react'

export function useUploadPolling(active: boolean) {
  const [uploads, setUploads] = useState<Upload[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active) return
    const poll = async () => {
      const res = await fetch('/api/admin/uploads')
      const data = await res.json()
      setUploads(data.uploads)
    }
    poll()
    intervalRef.current = setInterval(poll, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [active])

  return uploads
}
```

### Pattern 5: Stats Recalculation on CSV Upsert
**What:** After every CSV upsert, run SQL aggregates to (re)populate a `listing_stats` table. Store as structured JSON or typed rows — Phase 3 reads from this table.
**When to use:** End of every CSV upload API handler.

```sql
-- listing_stats table approach: one row per tenant, updated on each CSV upsert
-- Stored as JSONB for flexibility — Phase 3 reads the whole blob
create table public.listing_stats (
  tenant_id uuid primary key references public.tenants(id),
  stats jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
```

### Anti-Patterns to Avoid
- **Using `pdf-parse` on Vercel:** Causes build failures or runtime errors due to canvas native module. Use `unpdf` instead.
- **Embedding CSV rows in pgvector:** DATA-06 is explicit — structured property data must be queried from SQL. Never put listings into the vector store.
- **Synchronous PDF processing:** A 50MB PDF with hundreds of pages will exceed the 30-second serverless timeout. Always use `waitUntil`.
- **Storing file blobs in PostgreSQL:** Use Supabase Storage for raw files; store only the storage path/key in the DB uploads record.
- **IVFFlat index on an empty table:** IVFFlat requires training data. Start with HNSW (builds incrementally) or add no index until data exists and add HNSW after first upload.
- **Polling without cleanup:** Always return cleanup function from `useEffect` to clear the interval on unmount. Missing cleanup causes memory leaks in React.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing with quoted fields, BOM, type coercion | Custom split-on-comma parser | papaparse | Handles escaped quotes, Windows BOM, empty fields, header normalization |
| PDF text extraction | Manual pdfjs-dist setup | unpdf | unpdf wraps pdfjs-dist but removes canvas dependency; works on Vercel |
| Text chunking with overlap | Manual substring loop | Simple recursive character splitter (20 lines) | The logic is simple enough to inline; no library needed for fixed-size chunking |
| Vector similarity search API | Custom distance calculation | pgvector SQL operators + RPC | Postgres handles this natively; JS distance calculation would be unusably slow |
| OpenAI API retry + backoff | Custom retry loop | openai SDK (built-in) | The official SDK handles rate limit retries automatically |

**Key insight:** The CSV and PDF pipelines have very different complexity profiles. CSV parsing is well-solved (PapaParse) but chunking PDFs is simple enough to write inline (fixed size + overlap). Don't reach for a chunking library when 15 lines of TypeScript suffices.

---

## Common Pitfalls

### Pitfall 1: Vercel Timeout on Large PDFs
**What goes wrong:** A 50MB PDF with many pages takes 60-120 seconds to embed (network round trips to OpenAI per chunk). The API route returns a 504 timeout.
**Why it happens:** Standard Vercel serverless has a 30s limit. Even with Fluid Compute's default 300s, embedding 200+ chunks involves 200+ OpenAI API calls.
**How to avoid:** Use `waitUntil` to offload embedding generation from the response cycle. Return 202 immediately after storing the file. The background task runs up to 300s (Hobby) or 800s (Pro).
**Warning signs:** Upload API occasionally times out; processing status never transitions from `processing` to `indexed`.

### Pitfall 2: `@vercel/functions` Not Installed
**What goes wrong:** `waitUntil` is not part of the standard Node.js runtime — it comes from `@vercel/functions`. Calling `import { waitUntil } from '@vercel/functions'` fails locally and in CI if not installed.
**Why it happens:** Common oversight when setting up the upload route.
**How to avoid:** Add `npm install @vercel/functions` as a Wave 0 task. Verify the import resolves before implementing the upload handler.
**Warning signs:** Module not found error at build time.

### Pitfall 3: pgvector Extension Not Enabled
**What goes wrong:** Inserting a vector column fails with "type vector does not exist".
**Why it happens:** pgvector must be enabled per Supabase project. The Phase 1 migration only enabled `pgcrypto`.
**How to avoid:** Phase 2 migration must start with `create extension if not exists vector with schema extensions;`. Also enable in Supabase dashboard under Database > Extensions.
**Warning signs:** Migration runs without error but insert to `document_chunks` fails with unknown type.

### Pitfall 4: RLS Blocks Service Role on New Tables
**What goes wrong:** `getServerSupabase()` uses the service role key, which bypasses RLS. But if RLS is enabled and no policy exists, even the service role can be blocked in some Supabase configurations.
**Why it happens:** Supabase changed behavior in some versions; `service_role` should bypass RLS but policy misconfiguration can interfere.
**How to avoid:** Follow the same pattern as Phase 1 migrations — add explicit tenant isolation policies using `current_setting('app.tenant_id')::uuid` on all new tables. Test with the actual service role key, not an anon key.
**Warning signs:** Insert to `uploads` or `listings` returns null data with no error — data appears to write but doesn't appear in select.

### Pitfall 5: OpenAI Embedding Batch Size
**What goes wrong:** Sending 500+ chunks to OpenAI in a single API call causes a 413 or rate limit error.
**Why it happens:** OpenAI's embeddings endpoint has a token limit per request (8191 tokens for text-embedding-3-small input; 2048 array items per batch call).
**How to avoid:** Process chunks in batches of 100 or fewer. The OpenAI SDK handles individual calls; batch them with a simple loop.
**Warning signs:** Embedding generation fails on larger PDFs but works on small ones.

### Pitfall 6: File Size Validation — Client vs Server
**What goes wrong:** Checking file size only client-side allows a malicious/buggy client to upload 500MB files, exhausting memory.
**Why it happens:** Client-side validation can be bypassed.
**How to avoid:** Validate the 50MB limit server-side in the upload route handler before reading the file into memory. Check `file.size` before `await file.arrayBuffer()`.
**Warning signs:** Large uploads crash the Vercel function with OOM error.

### Pitfall 7: Supabase Storage vs. DB Blob
**What goes wrong:** Storing raw file contents in PostgreSQL as a `bytea` column bloats the database, makes backups expensive, and hits Supabase's row size limits.
**Why it happens:** Temptation to keep everything in one place.
**How to avoid:** Store raw files in a Supabase Storage bucket (named e.g. `uploads`). Store only the bucket path in the `uploads` table. On delete, remove from Storage and DB.
**Warning signs:** Database size grows rapidly; row queries become slow.

---

## Code Examples

### New Tables — Phase 2 Migration
```sql
-- Source: extending db/migrations/001_foundation.sql pattern

-- Enable pgvector
create extension if not exists vector with schema extensions;

-- Uploads registry (tracks all uploaded files and their processing status)
create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  filename text not null,
  file_type text not null check (file_type in ('csv', 'pdf')),
  storage_path text,              -- Supabase Storage bucket path; null if processing failed
  status text not null default 'processing'
    check (status in ('processing', 'indexed', 'error')),
  error_message text,
  row_count integer,              -- for CSV: number of listings processed
  chunk_count integer,            -- for PDF: number of vector chunks stored
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index uploads_tenant_status_idx on public.uploads(tenant_id, status);

-- Listings table (CSV rows — queried by Phase 3 via SQL)
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  property_id text not null,
  address text not null,
  area text not null,
  price_aed numeric(14,2) not null,
  bedrooms integer not null,
  bathrooms integer not null,
  size_sqft numeric(10,2) not null,
  status text not null check (status in ('available', 'sold', 'reserved')),
  developer text not null,
  community text not null,
  property_type text not null,
  sold_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, property_id)
);

create index listings_tenant_idx on public.listings(tenant_id);
create index listings_status_idx on public.listings(tenant_id, status);
create index listings_area_idx on public.listings(tenant_id, area);

-- Document chunks (PDF text + embeddings — queried by Phase 3 via pgvector)
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  upload_id uuid not null references public.uploads(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);

create index document_chunks_tenant_idx on public.document_chunks(tenant_id);
-- HNSW index: builds incrementally, does not require pre-existing data
-- Add after first real data insert or in migration (safe on empty table)
create index document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- Listing stats (pre-calculated on each CSV upsert)
create table public.listing_stats (
  tenant_id uuid primary key references public.tenants(id),
  stats jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.uploads enable row level security;
alter table public.listings enable row level security;
alter table public.document_chunks enable row level security;
alter table public.listing_stats enable row level security;

create policy "tenant_isolation_uploads"
  on public.uploads
  using (tenant_id = current_setting('app.tenant_id')::uuid);

create policy "tenant_isolation_listings"
  on public.listings
  using (tenant_id = current_setting('app.tenant_id')::uuid);

create policy "tenant_isolation_document_chunks"
  on public.document_chunks
  using (tenant_id = current_setting('app.tenant_id')::uuid);

create policy "tenant_isolation_listing_stats"
  on public.listing_stats
  using (tenant_id = current_setting('app.tenant_id')::uuid);
```

### PDF Text Extraction with unpdf
```typescript
// src/lib/pdf/extract-text.ts
// Source: unpdf documentation
import { extractText, getDocumentProxy } from 'unpdf'

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  // CRITICAL: release memory after extraction
  await pdf.destroy()
  return text
}
```

### Fixed-Size Chunker with Overlap
```typescript
// src/lib/pdf/chunk-text.ts
// Recommendation: 512 tokens ~ 400 words. Use character count proxy: 512 * 4 = 2048 chars.
// 20% overlap = ~400 chars.
export function chunkText(
  text: string,
  chunkSize = 2048,
  overlap = 400,
): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    start += chunkSize - overlap
  }
  return chunks
}
```

### OpenAI Embedding Generation
```typescript
// src/lib/embeddings/generate.ts
// Source: OpenAI Node.js SDK docs
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

// Batch version — process in groups of 100 to avoid rate limits
export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  const BATCH_SIZE = 100
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    })
    results.push(...response.data.map((d) => d.embedding))
  }
  return results
}
```

### Stats Calculation SQL
```sql
-- Run after every CSV upsert (called from API route via rpc)
-- Source: standard PostgreSQL aggregates
insert into public.listing_stats (tenant_id, stats, updated_at)
values (
  $1,
  jsonb_build_object(
    'count_by_status', (
      select jsonb_object_agg(status, cnt)
      from (
        select status, count(*) as cnt
        from public.listings
        where tenant_id = $1
        group by status
      ) s
    ),
    'avg_price_by_bedrooms', (
      select jsonb_object_agg(bedrooms::text, avg_price)
      from (
        select bedrooms, round(avg(price_aed), 0) as avg_price
        from public.listings
        where tenant_id = $1
        group by bedrooms
      ) b
    ),
    'price_range_by_area', (
      select jsonb_object_agg(area, price_stats)
      from (
        select area, jsonb_build_object(
          'min', min(price_aed),
          'max', max(price_aed),
          'median', percentile_cont(0.5) within group (order by price_aed)
        ) as price_stats
        from public.listings
        where tenant_id = $1
        group by area
      ) a
    ),
    'recently_sold_count', (
      select count(*)
      from public.listings
      where tenant_id = $1
        and status = 'sold'
        and sold_date >= current_date - interval '30 days'
    ),
    'total_listings', (
      select count(*) from public.listings where tenant_id = $1
    ),
    'calculated_at', now()
  ),
  now()
)
on conflict (tenant_id) do update
  set stats = excluded.stats, updated_at = excluded.updated_at;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pdf-parse for serverless | unpdf (pure JS) | 2023-2024 | Eliminates native canvas build failures on Vercel |
| IVFFlat as default pgvector index | HNSW preferred | pgvector 0.5.0 (2023) | HNSW builds incrementally; better for growing datasets |
| External job queues (Redis/BullMQ) for async tasks | Vercel `waitUntil` (Fluid Compute) | April 2025 (default) | No external service needed for simple background tasks |
| Polling for status updates | SSE / WebSockets | Ongoing | Polling is simpler and correct for this use case (admin task, not real-time critical) |

**Deprecated/outdated:**
- `pdf-parse`: Do not use on Vercel. Native canvas dependency causes build or runtime failures.
- IVFFlat as "default" choice: HNSW is now preferred for small-to-medium growing datasets.
- Separate job queue services for POC: Vercel `waitUntil` handles it without external infrastructure.

---

## Open Questions

1. **`@vercel/functions` package availability on current Next.js version**
   - What we know: `waitUntil` is documented for Vercel Fluid Compute; `@vercel/functions` is the import path
   - What's unclear: The project is on Next.js 16.x (package.json shows `^16.1.6`) — need to verify `@vercel/functions` compatibility with this version at install time
   - Recommendation: Add `npm install @vercel/functions` as first task in Wave 0; verify it resolves and the import works in a test route before building the full upload handler

2. **Supabase Storage bucket policy for admin uploads**
   - What we know: Supabase Storage buckets default to private; RLS policies required for access
   - What's unclear: Whether the service role key (used by `getServerSupabase()`) bypasses Storage RLS automatically, or if a storage policy is also needed
   - Recommendation: Create the `uploads` bucket as private; test a direct upload via service role key in Wave 0 before assuming bypass works

3. **`percentile_cont` availability in Supabase PostgreSQL**
   - What we know: `percentile_cont` is standard PostgreSQL (9.4+); Supabase uses Postgres 15+
   - What's unclear: Whether the stats SQL using `percentile_cont` for median calculation needs to be wrapped in a Postgres function or can run as a direct query
   - Recommendation: Wrap the stats calculation as a Postgres function `recalculate_stats(p_tenant_id uuid)` called via `client.rpc()`; this also avoids SQL injection risk

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + React Testing Library 16.x |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --reporter=verbose src/lib/csv src/lib/pdf src/lib/embeddings` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | CSV with valid rows produces correct upsert payload | unit | `npx vitest run src/lib/csv/parse-listings.test.ts -x` | Wave 0 |
| DATA-01 | CSV missing required column returns per-column error | unit | `npx vitest run src/lib/csv/parse-listings.test.ts -x` | Wave 0 |
| DATA-01 | CSV with invalid status value produces row-level error | unit | `npx vitest run src/lib/csv/parse-listings.test.ts -x` | Wave 0 |
| DATA-01 | POST `/api/admin/upload` with valid CSV returns 201 | unit (route) | `npx vitest run src/app/api/admin/upload/route.test.ts -x` | Wave 0 |
| DATA-02 | PDF text extraction returns non-empty string | unit | `npx vitest run src/lib/pdf/extract-text.test.ts -x` | Wave 0 |
| DATA-02 | Text chunker produces correct chunk count and overlap | unit | `npx vitest run src/lib/pdf/chunk-text.test.ts -x` | Wave 0 |
| DATA-02 | POST `/api/admin/upload` with PDF returns 202 immediately | unit (route) | `npx vitest run src/app/api/admin/upload/route.test.ts -x` | Wave 0 |
| DATA-03 | GET `/api/admin/uploads` returns uploads list with status | unit (route) | `npx vitest run src/app/api/admin/uploads/route.test.ts -x` | Wave 0 |
| DATA-03 | DELETE `/api/admin/uploads/[id]` removes record | unit (route) | `npx vitest run src/app/api/admin/uploads/[id]/route.test.ts -x` | Wave 0 |
| DATA-03 | Admin page renders upload zone and file list | component | `npx vitest run src/app/admin/page.test.tsx -x` | Wave 0 |
| DATA-03 | Status badge shows "Indexed" when upload.status = indexed | component | `npx vitest run src/app/admin/page.test.tsx -x` | Wave 0 |
| DATA-04 | Embedding generation returns array of length 1536 | unit (mocked) | `npx vitest run src/lib/embeddings/generate.test.ts -x` | Wave 0 |
| DATA-04 | Batch embedding handles 150 chunks in two batches | unit (mocked) | `npx vitest run src/lib/embeddings/generate.test.ts -x` | Wave 0 |
| DATA-05 | Stats SQL returns correct count_by_status shape | unit (mocked DB) | `npx vitest run src/app/api/admin/stats/route.test.ts -x` | Wave 0 |
| DATA-06 | Listings table receives upserted row with correct typed fields | unit (mocked DB) | `npx vitest run src/app/api/admin/upload/route.test.ts -x` | Wave 0 |

**Manual / not automatically testable:**
- pgvector similarity search returning relevant results for a given query (requires live Supabase; verify during Wave 3 integration smoke test)
- PDF processing completing and transitioning `status` to `indexed` end-to-end (verify by uploading a real PDF to staging)
- 5-second polling updating status badges in the browser (manual browser verification)
- `waitUntil` background task completing within timeout on Vercel (verify during 02-07 device checkpoint)

### Test Strategy Notes

**Mocking OpenAI:** The `openai` client must be mocked in all unit tests. Add to `src/test/setup.ts` or use `vi.mock('openai')` per test file — consistent with how Supabase is mocked in Phase 1.

**Mocking unpdf:** `unpdf` must be mocked in route handler tests. The actual extraction test in `src/lib/pdf/extract-text.test.ts` can use a real tiny PDF buffer (fixture) to verify the library works — this is safe because unpdf is pure JS and works in jsdom.

**FormData in Vitest:** Route handler tests that accept file uploads must construct `FormData` manually. The project's jsdom environment supports `File` and `FormData` natively — no special polyfill needed. Pattern: `new File([csvString], 'test.csv', { type: 'text/csv' })`.

**Mocking `@vercel/functions`:** `waitUntil` must be mocked to prevent background tasks from running during tests. Add `vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))` to upload route tests.

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/csv src/lib/pdf src/lib/embeddings --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose` (full suite, currently 63 tests + Phase 2 additions)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/csv/parse-listings.test.ts` — covers DATA-01 parsing + validation
- [ ] `src/lib/pdf/extract-text.test.ts` — covers DATA-02 extraction
- [ ] `src/lib/pdf/chunk-text.test.ts` — covers DATA-02 chunking
- [ ] `src/lib/embeddings/generate.test.ts` — covers DATA-04 embedding (mocked OpenAI)
- [ ] `src/app/api/admin/upload/route.test.ts` — covers DATA-01, DATA-02, DATA-06 upload routes
- [ ] `src/app/api/admin/uploads/route.test.ts` — covers DATA-03 list
- [ ] `src/app/api/admin/uploads/[id]/route.test.ts` — covers DATA-03 delete
- [ ] `src/app/api/admin/stats/route.test.ts` — covers DATA-05
- [ ] `src/app/admin/page.test.tsx` — covers DATA-03 UI components
- [ ] Framework install: `npm install @vercel/functions papaparse unpdf openai` + `npm install --save-dev @types/papaparse`

---

## Sources

### Primary (HIGH confidence)
- Supabase official pgvector docs — vector columns, HNSW/IVFFlat tradeoffs, RPC similarity search pattern
- Vercel Fluid Compute docs — `waitUntil` API, timeout limits by plan, default behavior since April 2025
- OpenAI embeddings docs — text-embedding-3-small default 1536 dimensions confirmed
- Existing project codebase — `getServerSupabase()` pattern, Zod usage, Vitest config, RLS policy pattern

### Secondary (MEDIUM confidence)
- DEV Community article on unpdf vs pdf-parse — verified the canvas dependency problem and pure-JS solution
- BetterStack PapaParse Node.js guide — string mode parsing without file system confirmed from npm docs
- Supabase Next.js vector search example — match_document_chunks RPC pattern cross-referenced with official docs

### Tertiary (LOW confidence)
- WebSearch consensus on 512 token / 2048 char chunk size with 20% overlap — widely cited but optimal value is dataset-dependent; treat as starting point

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — unpdf/papaparse/openai verified; pgvector dimensions confirmed from OpenAI docs
- Architecture: HIGH — all patterns match existing project conventions; Vercel `waitUntil` confirmed from official docs
- Pitfalls: HIGH — pdf-parse/Vercel issue documented in official DEV article; others from project-specific analysis of existing code patterns
- Chunking strategy: MEDIUM — consensus recommendation, but optimal values require empirical tuning

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable stack; re-check Vercel `waitUntil` limits if upgrading plans)

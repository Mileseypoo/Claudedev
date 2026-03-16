# Phase 3: Intelligence + Cards - Research

**Researched:** 2026-03-16
**Domain:** Intent classification (Claude Haiku 4.5), RAG retrieval (pgvector + SQL), real-time card delivery, card persistence
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Card collapsed state:** Ultra-terse — 1–5 words max (e.g. "AED 1.95M", "Yes — foreign buyers allowed", "3 sold this week"). Glanceable in under a second mid-meeting.
- **Card expanded state:** 2–3 sentences with key context, plus a source link that opens the PDF or listing record in the browser.
- **Card types:** Listing cards (SQL), PDF/RAG cards, and stats cards all share the same card shape — differentiated by a small icon/label tag. No distinct layouts.
- **Dismiss behaviour:** Swiped cards are gone permanently during the session. No undo. All cards visible in post-session summary.
- **Speech source:** All speech triggers intent detection — no speaker diarisation. LLM prompt instructs it to ignore non-question statements, pleasantries, and agent-directed speech.
- **Transcript window:** Last 2–3 final chunks (~15–20 seconds of speech) sent to LLM for context.
- **Noise reduction:** Deduplication only — no fixed time cooldown. The same topic/question does not fire a second card if one already exists on screen for that topic.
- **Classification logging:** Every intent classification result (question detected / not a question / duplicate topic) logged to Vercel logs for prompt tuning. Silent skips are not acceptable.
- **Stats cards:** Use same trigger logic as answer cards — LLM detects stats-relevant topic. No automatic push at session start.
- **Stats available:** count_by_status, price_range_by_area (min/max/median), recently_sold_count (last 30 days), avg_price_by_bedrooms — all from `listing_stats.stats` JSONB.
- **Card persistence:** Every card that fires is persisted (session_id, question detected, terse answer, full answer, source reference, fired_at timestamp).
- **Summary screen:** Phase 3 adds a Q&A section below the existing transcript section, showing all cards in order with full expanded answer.

### Claude's Discretion
- Exact SSE vs. polling delivery mechanism for pushing cards to the active session screen
- LLM model choice for intent classification (claude-haiku-4-5 recommended for speed/cost)
- Exact prompt engineering for intent detection and answer generation
- DB schema for the answer_cards table
- How card source link is stored and displayed (URL vs document name vs chunk reference)
- Animation/transition for card appearing and being dismissed

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTEL-01 | App detects questions and relevant topics from the live transcript | Claude Haiku 4.5 structured outputs; transcript window pattern; topic_key for dedup |
| INTEL-02 | App retrieves relevant answers from company data and surfaces them as cards | match_document_chunks RPC for PDF RAG; SQL listings query; listing_stats JSONB read; answer generation with Haiku 4.5 |
| INTEL-03 | Question detection does not flood the agent with cards (max 2-3 per minute) | topic_key deduplication on answer_cards table; classification logging; LLM-level "not a question" filtering |
| CARD-01 | Answers surface as cards that stack upward (newest at bottom, older scroll off top) | flex-col-reverse in active page; state array pattern; Supabase Realtime or polling delivery |
| CARD-02 | Each card shows a short, glanceable answer (1–5 words collapsed) | terse_answer column; ultra-terse prompt instruction |
| CARD-03 | Agent can tap a card to expand it for slightly more detail | Controlled expand state per card; full_answer column; same card shape |
| CARD-04 | Card includes a link that opens the source in the browser (PDF, listing, or web) | source_ref stored as URL string; `window.open` / `<a target="_blank">` |
| CARD-05 | Agent can dismiss individual cards by swiping them away | CSS touch events or pointer events; filter from local state only; card persists in DB |
</phase_requirements>

---

## Summary

Phase 3 is the intelligence core of Dictator. When a transcript chunk is saved via POST /api/session/chunk, the route triggers intent classification via Claude Haiku 4.5. If a question or stats-relevant topic is detected, a retrieval step fetches the answer from company data (RAG via `match_document_chunks` for PDFs, direct SQL for listings, JSONB read for stats), generates a terse + full answer, persists a row to the `answer_cards` table, and notifies the active session screen to render the new card.

The core decision for Claude's Discretion is real-time delivery. SSE requires a long-lived connection from the client to a Next.js route, which has a 300-second limit on Vercel with Fluid Compute — acceptable for sessions but adds connection management complexity. Polling every 2 seconds from the client is architecturally simpler, survives connection drops, aligns with the 8-second budget, and matches the existing polling pattern already established in Phase 2. Supabase Realtime Postgres Changes is the cleanest option: the client subscribes directly to INSERT events on `answer_cards` filtered by `session_id`, requiring no server-side streaming infrastructure at all. Recommendation: use Supabase Realtime Postgres Changes as the primary mechanism — it requires zero API routes for delivery and handles reconnection natively.

The `@anthropic-ai/sdk` npm package is not currently installed in the project. The existing `openai` SDK remains for embeddings. Claude Haiku 4.5 is confirmed as the correct model alias (`claude-haiku-4-5` or `claude-haiku-4-5-20251001`), costs $1/MTok input and $5/MTok output, and fully supports structured outputs — enabling schema-guaranteed JSON responses for the intent classification step.

**Primary recommendation:** Trigger classification from the chunk save route using `waitUntil` to keep the chunk endpoint fast; deliver cards to the browser via Supabase Realtime `postgres_changes` INSERT subscription on `answer_cards`; use structured outputs for deterministic intent + answer JSON; deduplicate via `topic_key` column with a SELECT before INSERT.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | ^0.54.x (latest) | Claude Haiku 4.5 messages API, structured outputs | Official Anthropic SDK; required for claude-haiku-4-5 |
| openai | ^6.29.0 (already installed) | Embedding generation for query vectors (text-embedding-3-small) | Already in project; used by Phase 2 for document embeddings |
| @supabase/supabase-js | ^2.99.1 (already installed) | Realtime channel subscription + DB operations | Already in project; browser client for Realtime |
| @vercel/functions | ^3.4.3 (already installed) | waitUntil for async classification after chunk save | Already in project; same pattern as Phase 2 PDF processing |
| zod | ^4.3.6 (already installed) | API request validation + type inference | Already in project pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | SSE and swipe gestures handled without new deps | SSE via Web Streams API (built-in); swipe via pointer events (built-in CSS) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase Realtime Postgres Changes | SSE from Next.js route | SSE simpler to reason about but requires a persistent server route; Realtime handles reconnect automatically and requires no server-side streaming infrastructure |
| Supabase Realtime Postgres Changes | Polling (setInterval 2s) | Polling is proven (Phase 2 pattern) and survives connection drops; slightly higher latency (~2s extra) and redundant requests when no cards fire |
| claude-haiku-4-5 for full pipeline | claude-sonnet-4-6 | Sonnet is more capable but 3x the cost and slower; Haiku 4.5 is sufficient for structured intent detection + short answer generation |
| Structured outputs (messages.parse) | Plain JSON prompt | Structured outputs guarantee schema; plain JSON prompt can produce malformed output that crashes JSON.parse |

### Installation
```bash
npm install @anthropic-ai/sdk
```

No other new dependencies are required for Phase 3.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (session)/
│   │   ├── active/
│   │   │   ├── page.tsx             # Add: useAnswerCards hook, card stack UI
│   │   │   └── components/
│   │   │       ├── CardStack.tsx        # CARD-01: flex-col-reverse stack
│   │   │       ├── AnswerCard.tsx       # CARD-02/03/04/05: single card w/ expand + dismiss
│   │   │       └── CardStack.test.tsx
│   │   └── summary/
│   │       └── page.tsx             # Extend: add Q&A section below transcript
│   └── api/
│       └── session/
│           └── chunk/
│               └── route.ts         # Extend: call triggerIntelligence() via waitUntil
├── hooks/
│   └── useAnswerCards.ts            # Supabase Realtime subscription + local card state
├── lib/
│   └── intelligence/
│       ├── classify-intent.ts       # Claude Haiku 4.5: intent detection → topic_key + query
│       ├── retrieve-answer.ts       # RAG + SQL + stats retrieval dispatcher
│       ├── generate-answer.ts       # Claude Haiku 4.5: terse + full answer from context
│       └── trigger.ts              # Orchestrator: classify → retrieve → generate → insert
└── types/
    └── cards.ts                     # AnswerCard interface (mirrors answer_cards table)
```

### Pattern 1: Trigger from Chunk Save (waitUntil)
**What:** After saving a transcript chunk, call `waitUntil(triggerIntelligence(sessionId, tenantId))` in the chunk route. The HTTP response returns immediately; classification runs in the background.
**When to use:** Every POST to /api/session/chunk. The chunk route stays under 100ms from the client's perspective.

```typescript
// src/app/api/session/chunk/route.ts — extension of existing route
// Source: @vercel/functions waitUntil — same pattern as Phase 2 PDF processing
import { waitUntil } from '@vercel/functions'
import { triggerIntelligence } from '@/lib/intelligence/trigger'

export async function POST(request: Request) {
  // ... existing chunk save logic ...

  if (!error) {
    // Non-blocking: trigger intelligence pipeline after saving chunk
    // waitUntil keeps function alive until promise resolves (up to 300s)
    waitUntil(triggerIntelligence(body.data.sessionId, tenantId))
  }

  return Response.json({ ok: true })
}
```

### Pattern 2: Intent Classification with Structured Output
**What:** Send last 2–3 transcript chunks to Claude Haiku 4.5 with a system prompt defining the estate agency context. Use `messages.parse()` with a Zod schema to get guaranteed-schema JSON.
**When to use:** Every call to `triggerIntelligence`. The classification step must complete in under ~3 seconds for the 8-second E2E budget.

```typescript
// src/lib/intelligence/classify-intent.ts
// Source: @anthropic-ai/sdk structured outputs (Haiku 4.5 confirmed supported)
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const IntentSchema = z.object({
  is_question: z.boolean(),
  topic_key: z.string().nullable(),       // e.g. "price_range_dubai_marina", "foreign_buyer_rules"
  query_text: z.string().nullable(),      // natural language query for retrieval
  retrieval_type: z.enum(['rag', 'sql_listing', 'stats', 'none']).nullable(),
  reason: z.string(),                     // for Vercel log — always populated
})

export type IntentResult = z.infer<typeof IntentSchema>

const SYSTEM_PROMPT = `You are a real-time copilot for Dubai estate agents during client meetings.
Analyze the last few seconds of conversation transcript. Detect only:
- Direct property questions from the client (price, availability, features, rules, developer info)
- Requests for statistics or market data (sales counts, price ranges, market trends)

Do NOT fire for:
- Pleasantries, greetings, or small talk
- Agent internal comments, thinking aloud, or instructions to themselves
- Questions already answered in this conversation (topic_key will match an existing card)

For detected questions/topics, produce a topic_key (snake_case, max 5 words, describes the topic — used for deduplication),
a query_text (rephrased as a clear information request), and retrieval_type:
- "sql_listing" for specific property availability, price, features of named properties
- "stats" for aggregate market data (counts, averages, price ranges across the portfolio)
- "rag" for regulatory questions, brochure content, developer info, process questions

Respond with JSON matching the schema.`

export async function classifyIntent(
  recentChunks: string[],
  existingTopicKeys: string[],
): Promise<IntentResult> {
  const transcriptText = recentChunks.join(' ')
  const deupContext = existingTopicKeys.length > 0
    ? `\n\nAlready answered topics (do NOT re-fire): ${existingTopicKeys.join(', ')}`
    : ''

  const response = await client.messages.parse({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Transcript: "${transcriptText}"${deupContext}`,
      },
    ],
    output_config: { format: zodOutputFormat(IntentSchema, 'intent') },
  })

  return response.parsed_output
}
```

**Latency note:** Claude Haiku 4.5 TTFT is typically 300–600ms. A 256-token max_tokens cap keeps generation fast. Budget ~1s for this step.

### Pattern 3: RAG Retrieval via match_document_chunks RPC
**What:** Generate a query embedding using OpenAI text-embedding-3-small (same model as Phase 2 indexing), then call `client.rpc('match_document_chunks', {...})` with tenant isolation.
**When to use:** When `retrieval_type === 'rag'` in the intent result.

```typescript
// src/lib/intelligence/retrieve-answer.ts (RAG branch)
// Source: match_document_chunks function in db/migrations/002_data_pipeline.sql
import { generateEmbedding } from '@/lib/embeddings/generate'
import { getServerSupabase } from '@/lib/supabase/server'

export async function retrieveFromRAG(queryText: string): Promise<{
  content: string
  sourceRef: string
  documentId: string
}[]> {
  const embedding = await generateEmbedding(queryText)
  const { client, tenantId } = getServerSupabase()

  const { data, error } = await client.rpc('match_document_chunks', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: 5,
    p_tenant_id: tenantId,
  })

  if (error || !data) return []

  // data shape: { id, document_id, content, similarity }
  return (data as Array<{
    id: string
    document_id: string
    content: string
    similarity: number
  }>).map((row) => ({
    content: row.content,
    sourceRef: `/admin/uploads/${row.document_id}`,  // or Supabase Storage URL
    documentId: row.document_id,
  }))
}
```

**Critical:** The embedding model used for querying MUST match the model used for indexing. Phase 2 uses `text-embedding-3-small` (1536 dimensions). Use the same for queries or similarity scores will be meaningless.

### Pattern 4: SQL Listings Query
**What:** For listing-related questions, query the `listings` table directly — never RAG. This satisfies DATA-06.
**When to use:** When `retrieval_type === 'sql_listing'`.

```typescript
// src/lib/intelligence/retrieve-answer.ts (SQL branch)
// Source: listings table from db/migrations/002_data_pipeline.sql
export async function retrieveFromListings(queryText: string): Promise<string> {
  const { client, tenantId } = getServerSupabase()
  // Simple approach: return a JSON summary of available listings for context
  // Claude will extract the specific answer from this structured data
  const { data } = await client
    .from('listings')
    .select('property_id, address, area, price_aed, bedrooms, bathrooms, status, community, property_type, developer, sold_date')
    .eq('tenant_id', tenantId)
    .eq('status', 'available')
    .order('price_aed', { ascending: true })
    .limit(20)

  return JSON.stringify(data ?? [])
}
```

### Pattern 5: Stats Retrieval from listing_stats JSONB
**What:** Read the pre-calculated `listing_stats.stats` JSONB for the tenant. Single row, no aggregation at query time.
**When to use:** When `retrieval_type === 'stats'`.

```typescript
// src/lib/intelligence/retrieve-answer.ts (stats branch)
// Source: listing_stats table from db/migrations/002_data_pipeline.sql
export async function retrieveStats(): Promise<string> {
  const { client, tenantId } = getServerSupabase()
  const { data } = await client
    .from('listing_stats')
    .select('stats')
    .eq('tenant_id', tenantId)
    .single()

  return data ? JSON.stringify(data.stats) : '{}'
}
```

Stats JSONB shape (from `recalculate_listing_stats` function):
```json
{
  "total_listings": 42,
  "count_by_status": { "available": 18, "sold": 20, "reserved": 4 },
  "avg_price_by_bedrooms": { "1": 850000, "2": 1350000, "3": 2100000 },
  "price_range_by_area": {
    "Dubai Marina": { "min": 1200000, "max": 3800000, "median": 1950000 }
  },
  "recently_sold_count": 3,
  "calculated_at": "2026-03-16T10:00:00Z"
}
```

### Pattern 6: Answer Generation with Claude Haiku 4.5
**What:** Given the retrieved context (RAG chunks or SQL data), call Claude Haiku 4.5 again to produce both the terse (1–5 word) and full (2–3 sentence) answers.
**When to use:** After retrieval, before inserting the card.

```typescript
// src/lib/intelligence/generate-answer.ts
// Source: @anthropic-ai/sdk structured outputs
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const AnswerSchema = z.object({
  terse_answer: z.string(),    // 1–5 words max — like a WhatsApp lockscreen preview
  full_answer: z.string(),     // 2–3 sentences with context
  source_ref: z.string(),      // URL or document reference
})

export type GeneratedAnswer = z.infer<typeof AnswerSchema>

export async function generateAnswer(
  question: string,
  context: string,
  retrievalType: 'rag' | 'sql_listing' | 'stats',
): Promise<GeneratedAnswer> {
  const systemPrompt = `You are a live copilot for a Dubai estate agent in a client meeting.
Generate two answers to the question: one ultra-terse (1–5 words max, like "AED 1.95M" or "Yes — allowed")
for the collapsed card view, and one full answer (2–3 sentences) for the expanded view.
Base answers ONLY on the provided context. If context is insufficient, say "Checking..." as terse and explain in full.
Include a source_ref (a URL or document name from the context, or empty string if none).`

  const response = await client.messages.parse({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Question: "${question}"\n\nContext:\n${context}`,
      },
    ],
    output_config: { format: zodOutputFormat(AnswerSchema, 'answer') },
  })

  return response.parsed_output
}
```

### Pattern 7: Card Persistence (answer_cards Table Insert)
**What:** Insert the completed card row into `answer_cards`. The Supabase Realtime subscription on the client will fire automatically on INSERT.
**When to use:** After successful answer generation.

```typescript
// src/lib/intelligence/trigger.ts
export async function persistCard(params: {
  sessionId: string
  tenantId: string
  topicKey: string
  questionText: string
  terseAnswer: string
  fullAnswer: string
  sourceRef: string
  cardType: 'listing' | 'rag' | 'stats'
}): Promise<void> {
  const { client } = getServerSupabase()
  await client.from('answer_cards').insert({
    session_id: params.sessionId,
    tenant_id: params.tenantId,
    topic_key: params.topicKey,
    question_text: params.questionText,
    terse_answer: params.terseAnswer,
    full_answer: params.fullAnswer,
    source_ref: params.sourceRef,
    card_type: params.cardType,
    fired_at: new Date().toISOString(),
  })
}
```

### Pattern 8: Supabase Realtime Card Subscription (Client)
**What:** Browser client subscribes to `postgres_changes` INSERT events on `answer_cards` filtered by `session_id`. New cards arrive without polling.
**When to use:** In `useAnswerCards` hook, mounted during the active session.

```typescript
// src/hooks/useAnswerCards.ts
// Source: Supabase postgres_changes pattern (supabase.com/docs/guides/realtime/postgres-changes)
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { AnswerCard } from '@/types/cards'

export function useAnswerCards(sessionId: string | null) {
  const [cards, setCards] = useState<AnswerCard[]>([])

  useEffect(() => {
    if (!sessionId) return

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const channel = supabase
      .channel(`answer-cards-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'answer_cards',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newCard = payload.new as AnswerCard
          setCards((prev) => [...prev, newCard])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  const dismissCard = (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId))
    // Note: dismissal is local-only — card persists in DB for summary screen
  }

  return { cards, dismissCard }
}
```

**RLS requirement:** The `answer_cards` table must have an RLS policy granting the `anon` role SELECT access (same pattern as Phase 1/2 `tenant_isolation` policies using `current_setting('app.tenant_id')`). Realtime checks RLS before delivering changes to browser clients.

### Pattern 9: Card Stack UI (CARD-01)
**What:** Cards stack upward — newest at bottom, older cards scroll off the top. Implemented as a flex column in reverse with overflow.
**When to use:** In the `CardStack` component rendered in the Phase 3 placeholder area.

```typescript
// src/app/(session)/active/components/CardStack.tsx (concept)
// Cards appear at bottom, older ones scroll up and off
<div className="flex flex-col justify-end overflow-y-auto px-4" style={{ maxHeight: '50vh' }}>
  {cards.map((card) => (
    <AnswerCard
      key={card.id}
      card={card}
      onDismiss={() => dismissCard(card.id)}
    />
  ))}
</div>
```

### Anti-Patterns to Avoid
- **Using match_document_chunks for listing queries:** DATA-06 is explicit — listings are queried via SQL. Never embed CSV rows into pgvector.
- **Calling Claude from the chunk route synchronously:** This would add 2–4 seconds to the chunk save response, blocking the Deepgram transcript pipeline. Always use `waitUntil`.
- **Storing dismiss state in DB:** Dismiss is session-local (client state only). The card row must persist in DB for the summary screen. Never DELETE on dismiss.
- **Using `postgres_changes` without RLS policy:** Supabase Realtime checks RLS before delivering to anon clients. Without a policy, no changes will be delivered — and no error is thrown (silent failure).
- **Embedding query with a different model than indexing model:** Phase 2 indexed with `text-embedding-3-small`. Using any other model for queries produces random similarity scores.
- **Topic deduplication in the LLM prompt only:** Pass `existingTopicKeys` to the LLM prompt AND check the DB before inserting. Two chunks could arrive in rapid succession before the first card is persisted.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured JSON from LLM | JSON.parse(response.text) + try/catch | `messages.parse()` + `zodOutputFormat()` | Haiku can hallucinate closing braces; structured outputs guarantee schema compliance |
| Vector similarity search | JS cosine distance calculation | `client.rpc('match_document_chunks', ...)` | pgvector HNSW runs in microseconds in Postgres; JS distance on 1536-dim vectors is unusably slow |
| Swipe-to-dismiss gesture | Custom touchstart/touchend state machine | `touch-action: pan-y` + pointer events threshold | Swipe detection with momentum and cancel thresholds is ~150 lines; Tailwind CSS + pointer events cover the essentials in 20 lines |
| Real-time push to client | Custom SSE endpoint + reconnect logic | Supabase Realtime `postgres_changes` | Supabase handles WebSocket reconnect, auth, and channel management; SSE requires a persistent Vercel function |
| Query embedding generation | Separate embedding service | Existing `generateEmbedding()` from `@/lib/embeddings/generate` | Already implemented in Phase 2; reuse directly |
| Deduplication timeout window | setTimeout + in-memory map | `topic_key` column + DB SELECT before INSERT | In-memory state is lost on function restart; DB check is authoritative across concurrent invocations |

**Key insight:** The RAG pipeline (embed → search → retrieve → generate) has well-established patterns in this codebase. Phase 3 is an orchestration layer connecting existing pieces — the only genuinely new component is the Claude API integration for classification and generation.

---

## Common Pitfalls

### Pitfall 1: Supabase Realtime Delivers Nothing (Silent RLS Failure)
**What goes wrong:** `useAnswerCards` subscribes successfully (no error) but new cards never arrive in the browser.
**Why it happens:** Supabase Realtime checks RLS before delivering `postgres_changes` to anon clients. If `answer_cards` has RLS enabled but no policy that grants SELECT to `anon`, changes are silently dropped.
**How to avoid:** The DB migration for `answer_cards` must include an RLS policy. For POC (single tenant, no auth), the policy can mirror Phase 2: `using (tenant_id = current_setting('app.tenant_id')::uuid)`. Additionally, enable Realtime on the table in the Supabase dashboard (Database > Replication).
**Warning signs:** Channel subscribe resolves with `SUBSCRIBED` status, but `payload.new` never fires.

### Pitfall 2: Race Condition — Duplicate Cards for Same Topic
**What goes wrong:** Two transcript chunks arrive 500ms apart; both trigger classification; both detect the same topic; two cards for the same question appear on screen.
**Why it happens:** `waitUntil` runs both concurrently. The first card hasn't been inserted when the second check runs.
**How to avoid:** Before inserting, SELECT from `answer_cards` where `session_id = $1 AND topic_key = $2`. If a row exists, abort. Use `existingTopicKeys` in the LLM prompt for soft deduplication and a DB check for hard deduplication.
**Warning signs:** Duplicate cards on screen during fast speech; double entries in summary Q&A.

### Pitfall 3: @anthropic-ai/sdk Not Installed
**What goes wrong:** `import Anthropic from '@anthropic-ai/sdk'` fails at build time with "Module not found".
**Why it happens:** The project currently only has `openai` SDK; `@anthropic-ai/sdk` is absent from package.json.
**How to avoid:** Add `npm install @anthropic-ai/sdk` as the first task in Wave 0.
**Warning signs:** TypeScript build error: Cannot find module '@anthropic-ai/sdk'.

### Pitfall 4: ANTHROPIC_API_KEY Not Set in Environment
**What goes wrong:** `new Anthropic()` constructor defaults to reading `process.env.ANTHROPIC_API_KEY`. If absent, the SDK throws "AuthenticationError: No API key provided".
**Why it happens:** New environment variable not yet added to `.env.local` or Vercel project settings.
**How to avoid:** Wave 0 task must add `ANTHROPIC_API_KEY=sk-ant-...` to `.env.local`. Also add to Vercel dashboard before deploying.
**Warning signs:** 401 error from Anthropic API; SDK throws at construction time with missing key.

### Pitfall 5: Vercel Realtime Replication Not Enabled
**What goes wrong:** Supabase Realtime subscription connects but `postgres_changes` events never fire, even with correct RLS.
**Why it happens:** Realtime publication must be enabled per table in the Supabase dashboard (Database > Replication > 0 tables → enable the `answer_cards` table).
**How to avoid:** Migration comment or Wave 0 checklist item: "Enable Realtime on `answer_cards` table in Supabase Dashboard."
**Warning signs:** `SUBSCRIBED` status but no INSERT events; polling fallback would work but Realtime doesn't.

### Pitfall 6: 8-Second Budget Exceeded
**What goes wrong:** Cards appear 12–15 seconds after the triggering speech, breaking the live copilot value.
**Why it happens:** The pipeline has multiple async steps: chunk save → classify (~1s) → embed query (~300ms) → RPC match_document_chunks (~200ms) → generate answer (~1s) → DB insert → Realtime delivery (~200ms). Total: ~3s ideal, but RAG retrieval can spike if pgvector index is cold or OpenAI embedding is slow.
**How to avoid:** Budget each step. Keep `max_tokens` on Haiku calls under 256 (classify) and 512 (generate). Use `match_count: 5` in RAG (not 20). Pre-warm the function on Vercel Pro (keep-alive). The 8-second budget has ~5 seconds of headroom after the sum.
**Warning signs:** Logging timestamps at each step reveals which step is the bottleneck.

### Pitfall 7: match_document_chunks Returns Zero Results
**What goes wrong:** RAG query returns empty array despite relevant PDFs being indexed.
**Why it happens:** `match_threshold: 0.7` may be too strict for short queries or jargon-heavy questions. The HNSW index may not be populated yet (no PDFs uploaded).
**How to avoid:** Start with `match_threshold: 0.5` for Phase 3; adjust empirically once real PDFs are indexed. Add a fallback: if RAG returns zero results, use Haiku to generate a "I don't have data on that" card rather than silently failing.
**Warning signs:** `data` array from RPC is always empty even after confirmed PDF indexing.

### Pitfall 8: Card Dismissed State Leaks to Summary
**What goes wrong:** Post-session summary only shows cards not dismissed by the agent.
**Why it happens:** Dismiss removes the card from React state; if summary queries local state or a filtered endpoint, dismissed cards disappear.
**How to avoid:** Dismiss is local state only — `filter()` on the `cards` array in the hook. The `answer_cards` DB table is never updated or deleted. Summary page queries DB directly, returning all cards regardless of dismiss state.
**Warning signs:** Summary Q&A section is missing cards the agent remembers seeing.

---

## Code Examples

### Full Intelligence Trigger Orchestrator
```typescript
// src/lib/intelligence/trigger.ts
// Source: combines Phase 2 patterns (waitUntil, getServerSupabase) with new Claude integration
import { getServerSupabase } from '@/lib/supabase/server'
import { classifyIntent } from './classify-intent'
import { retrieveFromRAG, retrieveFromListings, retrieveStats } from './retrieve-answer'
import { generateAnswer } from './generate-answer'

export async function triggerIntelligence(
  sessionId: string,
  tenantId: string,
): Promise<void> {
  const { client } = getServerSupabase()

  // Step 1: Fetch last 3 final chunks for context window
  const { data: recentChunks } = await client
    .from('transcript_chunks')
    .select('text, sequence')
    .eq('session_id', sessionId)
    .eq('tenant_id', tenantId)
    .eq('is_final', true)
    .order('sequence', { ascending: false })
    .limit(3)

  if (!recentChunks || recentChunks.length === 0) return

  const chunkTexts = recentChunks.reverse().map((c) => c.text)

  // Step 2: Fetch existing topic_keys for this session (deduplication)
  const { data: existingCards } = await client
    .from('answer_cards')
    .select('topic_key')
    .eq('session_id', sessionId)

  const existingTopicKeys = (existingCards ?? []).map((c) => c.topic_key)

  // Step 3: Classify intent
  const intent = await classifyIntent(chunkTexts, existingTopicKeys)

  // Log every classification result (requirement from CONTEXT.md)
  console.log('[intelligence] classify', {
    sessionId,
    is_question: intent.is_question,
    topic_key: intent.topic_key,
    retrieval_type: intent.retrieval_type,
    reason: intent.reason,
  })

  if (!intent.is_question || !intent.topic_key || !intent.retrieval_type || intent.retrieval_type === 'none') {
    return  // Not a question — logged above, silently stop
  }

  // Step 4: Hard dedup check (race condition protection)
  const { data: duplicate } = await client
    .from('answer_cards')
    .select('id')
    .eq('session_id', sessionId)
    .eq('topic_key', intent.topic_key)
    .maybeSingle()

  if (duplicate) {
    console.log('[intelligence] dedup skip', { sessionId, topic_key: intent.topic_key })
    return
  }

  // Step 5: Retrieve context based on retrieval_type
  let context = ''
  let cardType: 'listing' | 'rag' | 'stats' = 'rag'

  if (intent.retrieval_type === 'rag') {
    const chunks = await retrieveFromRAG(intent.query_text!)
    context = chunks.map((c) => c.content).join('\n\n')
    cardType = 'rag'
  } else if (intent.retrieval_type === 'sql_listing') {
    context = await retrieveFromListings(intent.query_text!)
    cardType = 'listing'
  } else if (intent.retrieval_type === 'stats') {
    context = await retrieveStats()
    cardType = 'stats'
  }

  // Step 6: Generate terse + full answer
  const answer = await generateAnswer(intent.query_text!, context, intent.retrieval_type)

  // Step 7: Persist card (triggers Supabase Realtime INSERT event to browser)
  await client.from('answer_cards').insert({
    session_id: sessionId,
    tenant_id: tenantId,
    topic_key: intent.topic_key,
    question_text: intent.query_text,
    terse_answer: answer.terse_answer,
    full_answer: answer.full_answer,
    source_ref: answer.source_ref,
    card_type: cardType,
    fired_at: new Date().toISOString(),
  })

  console.log('[intelligence] card fired', { sessionId, topic_key: intent.topic_key, terse: answer.terse_answer })
}
```

### DB Migration for answer_cards
```sql
-- db/migrations/003_intelligence_cards.sql
-- Phase 3: answer_cards table for card persistence and Realtime delivery

create table if not exists public.answer_cards (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  topic_key text not null,           -- dedup key, snake_case max 5 words
  question_text text not null,       -- natural language question detected
  terse_answer text not null,        -- 1–5 words — collapsed card display
  full_answer text not null,         -- 2–3 sentences — expanded card display
  source_ref text not null default '', -- URL or document reference; empty if none
  card_type text not null check (card_type in ('listing', 'rag', 'stats')),
  fired_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists answer_cards_session_idx
  on public.answer_cards (session_id, fired_at);

create index if not exists answer_cards_topic_dedup_idx
  on public.answer_cards (session_id, topic_key);

-- RLS
alter table public.answer_cards enable row level security;

create policy tenant_isolation on public.answer_cards
  using (tenant_id = current_setting('app.tenant_id')::uuid);

-- Note: After running this migration, enable Realtime on answer_cards table
-- in Supabase Dashboard: Database > Replication > answer_cards
```

### Summary Screen Q&A Section (Extension)
```typescript
// src/app/(session)/summary/page.tsx — add below transcript section
// Fetch all answer_cards for the session ordered by fired_at

const [cards, setCards] = useState<AnswerCard[] | null>(null)

useEffect(() => {
  if (!sessionId) { setCards([]); return }
  fetch(`/api/session/cards?sessionId=${encodeURIComponent(sessionId)}`)
    .then((r) => r.json())
    .then((json) => setCards(json.cards ?? []))
    .catch(() => setCards([]))
}, [sessionId])
```

```typescript
// src/app/api/session/cards/route.ts — new GET endpoint
// GET /api/session/cards?sessionId=xxx
// Returns all answer_cards for a session in fired_at order
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 })

  const { client, tenantId } = getServerSupabase()
  const { data, error } = await client
    .from('answer_cards')
    .select('*')
    .eq('session_id', sessionId)
    .eq('tenant_id', tenantId)
    .order('fired_at', { ascending: true })

  if (error) return Response.json({ error: 'Failed to fetch cards' }, { status: 500 })
  return Response.json({ cards: data ?? [] })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prompt for JSON + JSON.parse() | `messages.parse()` with `zodOutputFormat()` structured outputs | Nov 2025 (Anthropic generally available) | Schema-guaranteed output; no try/catch JSON parse errors |
| `claude-3-haiku-20240307` | `claude-haiku-4-5` (alias) / `claude-haiku-4-5-20251001` (pinned) | Oct 2025 | Old Haiku deprecated Apr 19 2026; new model cheaper per output token |
| Polling setInterval for new cards | Supabase Realtime `postgres_changes` | Supabase Realtime v2 (mature 2024) | Push delivery; no redundant HTTP requests; automatic reconnect |
| Custom SSE implementation | Supabase Realtime (WebSocket) | — | No persistent Next.js function needed for delivery |
| OpenAI for both embeddings AND generation | OpenAI (embeddings only) + Anthropic (generation) | Phase 3 decision | Anthropic Haiku 4.5 outperforms GPT-4o-mini for structured estate agency Q&A at similar cost |

**Deprecated/outdated:**
- `claude-3-haiku-20240307`: Deprecated by Anthropic; retirement April 19, 2026. Do not use.
- Plain JSON prompting: Replaced by structured outputs for reliability. Always use `zodOutputFormat` or `json_schema` in `output_config`.

---

## Open Questions

1. **Supabase Realtime table replication UI step**
   - What we know: `postgres_changes` requires the table to be added to the Supabase Realtime publication; this is a dashboard step, not SQL-only
   - What's unclear: Whether this can be done purely via SQL (`alter publication supabase_realtime add table answer_cards`) or must be done in the dashboard for managed Supabase
   - Recommendation: Include both SQL command AND dashboard step in the Wave 0 checklist; test in Wave 1 smoke test

2. **`messages.parse()` vs `messages.create()` availability in @anthropic-ai/sdk**
   - What we know: `messages.parse()` is the structured outputs helper; documented as generally available for Haiku 4.5 as of the current model docs
   - What's unclear: Exact minimum `@anthropic-ai/sdk` version that includes `.parse()` and `zodOutputFormat`
   - Recommendation: Install latest (`npm install @anthropic-ai/sdk@latest`) and verify the import resolves in Wave 0 before building classify-intent.ts

3. **Swipe gesture implementation depth**
   - What we know: CSS `touch-action` + pointer events cover basic swipe; no library needed per the Don't Hand-Roll table
   - What's unclear: Whether iOS Safari gesture conflicts with scroll make a simple pointer-based swipe unreliable for edge swipes
   - Recommendation: Implement with pointer events (pointerdown, pointermove, pointerup); test on real device during Wave 3 device checkpoint

4. **OpenAI embedding latency under load**
   - What we know: Phase 2 uses `generateEmbedding()` (single call, ~200–400ms typical)
   - What's unclear: Under concurrent sessions (multiple agents in meetings simultaneously), embedding API latency could spike
   - Recommendation: Acceptable for POC single-agency; add request timeout to `generateEmbedding` call in Phase 3 (fail gracefully to a no-RAG path if embedding times out >2s)

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + React Testing Library 16.x |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/lib/intelligence --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTEL-01 | classifyIntent returns is_question: true for property price question | unit (mocked Anthropic) | `npx vitest run src/lib/intelligence/classify-intent.test.ts -x` | Wave 0 |
| INTEL-01 | classifyIntent returns is_question: false for pleasantry | unit (mocked Anthropic) | `npx vitest run src/lib/intelligence/classify-intent.test.ts -x` | Wave 0 |
| INTEL-01 | classifyIntent returns is_question: false when topic_key matches existing | unit (mocked Anthropic) | `npx vitest run src/lib/intelligence/classify-intent.test.ts -x` | Wave 0 |
| INTEL-02 | retrieveFromRAG calls match_document_chunks RPC with correct embedding | unit (mocked Supabase + OpenAI) | `npx vitest run src/lib/intelligence/retrieve-answer.test.ts -x` | Wave 0 |
| INTEL-02 | retrieveFromListings queries listings table for available properties | unit (mocked Supabase) | `npx vitest run src/lib/intelligence/retrieve-answer.test.ts -x` | Wave 0 |
| INTEL-02 | retrieveStats returns listing_stats JSONB for tenant | unit (mocked Supabase) | `npx vitest run src/lib/intelligence/retrieve-answer.test.ts -x` | Wave 0 |
| INTEL-02 | generateAnswer returns terse_answer ≤5 words and non-empty full_answer | unit (mocked Anthropic) | `npx vitest run src/lib/intelligence/generate-answer.test.ts -x` | Wave 0 |
| INTEL-03 | triggerIntelligence does not insert card when topic_key already exists | unit (mocked Supabase + Anthropic) | `npx vitest run src/lib/intelligence/trigger.test.ts -x` | Wave 0 |
| INTEL-03 | triggerIntelligence logs intent result for every call | unit (console.log spy) | `npx vitest run src/lib/intelligence/trigger.test.ts -x` | Wave 0 |
| CARD-01 | CardStack renders cards in correct order (newest last in DOM) | component | `npx vitest run src/app/(session)/active/components/CardStack.test.tsx -x` | Wave 0 |
| CARD-02 | AnswerCard shows terse_answer in collapsed state | component | `npx vitest run src/app/(session)/active/components/AnswerCard.test.tsx -x` | Wave 0 |
| CARD-03 | AnswerCard shows full_answer after tap | component | `npx vitest run src/app/(session)/active/components/AnswerCard.test.tsx -x` | Wave 0 |
| CARD-04 | AnswerCard renders source link that opens in new tab | component | `npx vitest run src/app/(session)/active/components/AnswerCard.test.tsx -x` | Wave 0 |
| CARD-05 | Dismissing a card removes it from local state | unit (hook) | `npx vitest run src/hooks/useAnswerCards.test.ts -x` | Wave 0 |
| CARD-05 | Dismissed card still appears in summary Q&A (DB not modified) | unit (mocked Supabase) | `npx vitest run src/app/api/session/cards/route.test.ts -x` | Wave 0 |

**Manual / not automatically testable:**
- Supabase Realtime delivering INSERT event to browser within 500ms of DB write (requires live Supabase; verify during Wave 3 integration test)
- End-to-end 8-second budget from speech to card on screen (verify manually during device checkpoint)
- Swipe-to-dismiss gesture working on iOS Safari with correct cancel/confirm behaviour (real device test)
- Claude Haiku 4.5 classification quality on real estate agency conversation samples (empirical tuning)

### Test Strategy Notes

**Mocking @anthropic-ai/sdk:** Add `vi.mock('@anthropic-ai/sdk')` in each intelligence test file. The `messages.parse` call should return a mocked `parsed_output` matching the Zod schema. Pattern:
```typescript
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      parse: vi.fn().mockResolvedValue({
        parsed_output: { is_question: true, topic_key: 'price_dubai_marina', ... }
      })
    }
  }))
}))
```

**Mocking Supabase in trigger.ts tests:** The `getServerSupabase()` helper must be mocked. Use the `mockSupabaseClient` export from `src/test/setup.ts` and extend with `.rpc()` mock for `match_document_chunks`.

**Route test environment:** `/api/session/cards/route.ts` tests require `@vitest-environment node` annotation (same as Phase 2 route tests — jsdom does not implement Request/Response correctly for API routes).

**Supabase Realtime in useAnswerCards tests:** Mock `@supabase/supabase-js` `createClient` to return a client with `.channel().on().subscribe()` chain. Test that the channel is removed on cleanup.

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/intelligence --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose` (full suite — currently 19 test files)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/intelligence/classify-intent.test.ts` — covers INTEL-01
- [ ] `src/lib/intelligence/retrieve-answer.test.ts` — covers INTEL-02 (all 3 retrieval types)
- [ ] `src/lib/intelligence/generate-answer.test.ts` — covers INTEL-02 answer generation
- [ ] `src/lib/intelligence/trigger.test.ts` — covers INTEL-03 dedup + logging
- [ ] `src/app/(session)/active/components/CardStack.test.tsx` — covers CARD-01
- [ ] `src/app/(session)/active/components/AnswerCard.test.tsx` — covers CARD-02, CARD-03, CARD-04, CARD-05
- [ ] `src/hooks/useAnswerCards.test.ts` — covers CARD-05 dismiss + Realtime subscription cleanup
- [ ] `src/app/api/session/cards/route.test.ts` — covers summary screen fetch
- [ ] SDK install: `npm install @anthropic-ai/sdk`
- [ ] Env var: `ANTHROPIC_API_KEY` added to `.env.local` and Vercel dashboard
- [ ] DB migration: `db/migrations/003_intelligence_cards.sql` created
- [ ] Supabase Dashboard: Enable Realtime on `answer_cards` table (Database > Replication)

---

## Sources

### Primary (HIGH confidence)
- [platform.claude.com/docs models page](https://platform.claude.com/docs/en/docs/about-claude/models) — Claude Haiku 4.5 model ID confirmed: `claude-haiku-4-5` / `claude-haiku-4-5-20251001`; pricing $1/$5 per MTok; structured outputs confirmed for Haiku 4.5
- [platform.claude.com/docs structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — `messages.parse()` + `zodOutputFormat()` pattern; `output_config.format` replaces deprecated `output_format`; no beta header required
- [github.com/anthropics/anthropic-sdk-typescript](https://github.com/anthropics/anthropic-sdk-typescript) — `@anthropic-ai/sdk` npm package name; `new Anthropic({ apiKey })` constructor; `messages.create()` API shape
- [vercel.com/docs/functions/limitations](https://vercel.com/docs/functions/limitations) — Fluid Compute default 300s; Hobby max 300s; confirms `waitUntil` extension pattern is the correct approach for async background work
- [supabase.com/docs/guides/realtime/postgres-changes](https://supabase.com/docs/guides/realtime/postgres-changes) — `postgres_changes` event filter syntax; RLS requirement; `channel.subscribe()` + cleanup pattern
- Existing codebase — `getServerSupabase()` pattern, `waitUntil` import from `@vercel/functions`, Vitest + RTL test patterns, `match_document_chunks` RPC signature

### Secondary (MEDIUM confidence)
- [upstash.com/blog/sse-streaming-llm-responses](https://upstash.com/blog/sse-streaming-llm-responses) — SSE ReadableStream + headers pattern for Next.js App Router; `force-dynamic` requirement
- [pedroalonso.net/blog/sse-nextjs-real-time-notifications](https://www.pedroalonso.net/blog/sse-nextjs-real-time-notifications/) — `X-Accel-Buffering: no` header; EventSource client pattern; `req.signal` cleanup

### Tertiary (LOW confidence)
- WebSearch consensus on Claude Haiku 4.5 latency (~300–600ms TTFT) — not independently verified against official benchmarks; treat as order-of-magnitude estimate
- WebSearch on swipe gesture implementation — 20-line pointer events approach; requires real device validation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Anthropic SDK package name and install command confirmed from GitHub; Haiku 4.5 model ID confirmed from official model docs; structured outputs confirmed for Haiku 4.5
- Architecture: HIGH — all patterns match existing codebase conventions; `waitUntil` pattern already in project (Phase 2); `match_document_chunks` signature read directly from migration SQL
- Realtime delivery: HIGH — Supabase postgres_changes pattern confirmed from official docs; RLS requirement verified
- Pitfalls: HIGH — RLS silent failure and embedding model mismatch are architectural facts; others from codebase analysis
- Prompt engineering: LOW — intent detection prompts for estate agency Q&A require empirical tuning; budget iteration time

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (Anthropic structured outputs API is stable; re-check model aliases if Haiku 4.5 is superseded)

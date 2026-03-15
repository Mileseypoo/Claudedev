# Architecture Patterns

**Domain:** Real-time AI meeting copilot SaaS (phone-first)
**Project:** Dictator
**Researched:** 2026-03-15
**Confidence:** MEDIUM — based on established patterns from training data (Aug 2025). External verification tools were unavailable during this research run. All claims reflect well-established industry patterns but should be validated against current library docs before implementation.

---

## Recommended Architecture

The system decomposes into five logical layers: **audio capture**, **transcription + NLP**, **retrieval + generation**, **delivery**, and **data management**. Each layer has a clear owner and communicates only with adjacent layers.

```
PHONE (PWA)                    BACKEND (API SERVER)              EXTERNAL / DATA
───────────────                ─────────────────────────         ─────────────────
Mic → AudioWorklet             WS Audio Gateway                  Deepgram / OpenAI
  ↓ (PCM chunks, WebSocket)      ↓ stream to STT API               Whisper (STT)
Transcript display             Transcript store (Redis)
                                 ↓ (sliding window)
Card stack UI                  Intent Detector (LLM call)        OpenAI GPT-4o
  ↑ (SSE push)                   ↓                                 (mini for speed)
                               RAG Retriever                     Pinecone / pgvector
                                 ↓
                               LLM Answer Generator              OpenAI GPT-4o
                                 ↓
                               Card Publisher (SSE)
                                 ↓
                               [Web Search path]                  Tavily / Brave API
                                 ↓ (on agent confirm)
POST-MEETING                   Email Drafter                     OpenAI GPT-4o
                                 ↓
                               Email send (agent confirms)       Resend / SendGrid
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Notes |
|-----------|---------------|-------------------|-------|
| **PWA Audio Capture** | Browser mic → PCM chunks → WebSocket to gateway | Audio Gateway (WS outbound) | AudioWorklet API; 16kHz mono PCM; ~100ms chunks |
| **Audio Gateway** | Receive audio chunks, relay to STT service, buffer per-session | STT API (external), Transcript Store | One WebSocket connection per active session |
| **STT Service** (external) | Convert audio stream to partial + final transcript segments | Audio Gateway (callback/webhook or streaming WS) | Deepgram Nova-2 recommended; or OpenAI Realtime API |
| **Transcript Store** | Rolling buffer of transcript segments per session | Intent Detector, Email Drafter | Redis stream or in-memory per session; last ~5 min |
| **Intent Detector** | Identify questions or topic shifts worth answering | Transcript Store, RAG Retriever | LLM call on every N words or sentence boundary; cheap model (GPT-4o-mini) |
| **RAG Retriever** | Embed query, search tenant's vector store, return top-K chunks | Vector Store, Answer Generator | pgvector (Postgres) preferred for simplicity; Pinecone for scale |
| **Answer Generator** | Take retrieved context + question, produce concise card text | RAG Retriever, Card Publisher | GPT-4o streaming; strip to 2-3 sentences for card |
| **Card Publisher** | Push card events to the correct session's SSE stream | Answer Generator, Web Search Trigger | One SSE connection per active phone session |
| **Web Search Trigger** | On agent "confirm" tap, execute web search and replace stub card | Card Publisher, External search API | Tavily or Brave Search API; async, <5s target |
| **Vector Store** | Tenant-scoped vector index of uploaded documents | RAG Retriever, Document Ingestor | Namespaced by tenant_id; pgvector namespacing or Pinecone namespaces |
| **Document Ingestor** | Parse uploaded CSV/PDF, chunk, embed, upsert to vector store | Vector Store | Background job (queue); not in hot path |
| **Email Drafter** | After session end, generate follow-up email from transcript + Q&A log | Transcript Store, LLM | GPT-4o with full session context |
| **Admin Web UI** | Data uploads, agent account management | Document Ingestor, Auth service | Separate route from phone PWA; desktop-friendly |
| **Auth / Tenant Service** | JWT issuance, tenant isolation enforcement | All components | Row-level security in Postgres; tenant_id on every DB row |

---

## Data Flow

### Hot Path: Audio to Card on Phone

```
1. CAPTURE
   Phone mic → AudioWorklet (PCM 16kHz, 16-bit, mono)
   → WebSocket to Audio Gateway
   (~100ms chunks, binary frames)

2. TRANSCRIPTION
   Audio Gateway → Deepgram streaming WebSocket (or OpenAI Realtime)
   → Partial transcripts streamed back (100-300ms latency per partial)
   → Final segments confirmed at sentence boundaries
   → Final segments appended to Redis stream (keyed by session_id)

3. INTENT DETECTION
   Transcript consumer watches Redis stream
   → On sentence-final event: sliding window of last ~30 seconds assembled
   → GPT-4o-mini called: "Is there a question or topic worth surfacing an answer for?"
   → If YES: extract question text + topic tags
   → If NO: discard (most transcript segments)

4. RETRIEVAL
   Question text embedded (text-embedding-3-small)
   → pgvector cosine search within tenant namespace (top 5 chunks)
   → Chunks ranked + assembled into context window

5. GENERATION
   [question + retrieved context] → GPT-4o streaming
   → Card text streamed, assembled server-side
   → On completion: card payload published to SSE channel for session

6. DELIVERY
   SSE event pushed to phone PWA
   → New card rendered at bottom of stack
   → Agent sees answer within ~3-8 seconds of question being spoken

Total end-to-end target: <8 seconds from question spoken to card visible.
Dominant latency: STT final segment (1-2s) + LLM (2-4s) + network (~0.5s).
```

### Warm Path: Web Search

```
1. Intent detector produces card where RAG retriever returns low-confidence results
2. Card type = "web_lookup_suggestion" pushed to phone
3. Agent taps "confirm" button on card
4. POST /sessions/{id}/web-lookup { question_text }
5. Server calls Tavily/Brave Search API (~1-3s)
6. Result summarized with GPT-4o-mini
7. SSE pushes replacement card (type = "web_result")
```

### Cold Path: Post-Meeting Email

```
1. Agent taps "End session"
2. Full transcript + Q&A event log fetched from Redis / Postgres
3. GPT-4o called with prompt: meeting summary + Q&A pairs + action items
4. Draft stored in Postgres (email_drafts table)
5. Agent reviews in PWA, edits inline, taps Send
6. Resend/SendGrid API sends email
```

### Document Ingestion (Async)

```
1. Admin uploads CSV or PDF via Admin Web UI
2. File stored in S3/R2 (object storage)
3. Ingest job queued (BullMQ or similar)
4. Worker: parse → chunk (512 tokens, 50 token overlap) → embed → upsert to pgvector
5. Ingest job updates document record status: pending → indexed
```

---

## Key Architecture Decisions

### Decision 1: PWA vs Native App

**Recommendation: PWA (Progressive Web App)**

**Rationale:**
- AudioWorklet API is available in all major mobile browsers (Chrome Android, Safari iOS 15.4+) — HIGH confidence
- No App Store review cycle; faster iteration for POC
- Single codebase for phone UI and admin web UI (Next.js)
- Microphone access via `getUserMedia` is well-established
- PWA install prompt gives near-native feel on Android; iOS has limitations but acceptable for B2B use

**Tradeoffs accepted:**
- iOS Safari has stricter background audio limitations — session must stay foregrounded; acceptable since agent is actively using the phone during the meeting
- No push notifications when app is backgrounded (iOS) — not needed for in-meeting use

**Choose native if:** Background audio recording becomes required, or if iOS PWA limitations block the UX. Flutter would be the fallback (single codebase, good WebSocket/audio support).

---

### Decision 2: WebSocket vs SSE for Pushing Cards to Phone

**Recommendation: SSE (Server-Sent Events) for card delivery; WebSocket for audio upload**

**Rationale:**
- SSE is uni-directional server → client, which is exactly the card push pattern (server pushes cards, phone only acknowledges via regular HTTP POST)
- SSE is simpler to implement, proxy-friendly, and automatically reconnects
- WebSocket bidirectional channel is appropriate for audio upload because the phone sends binary audio data upstream
- Two separate connections: WebSocket (phone → server, audio data) + SSE (server → phone, card events)

**Why not WebSocket for everything:**
- A single WebSocket for both audio and card delivery adds multiplexing complexity
- SSE is HTTP/1.1 and HTTP/2 compatible; easier to debug and monitor
- WebSocket connections through mobile networks drop more aggressively; SSE reconnects are simpler to reason about

**SSE implementation note:** SSE requires `Content-Type: text/event-stream` and a keep-alive ping every 15-30 seconds. Connection keyed by `session_id`.

---

### Decision 3: Streaming Transcription Approach

**Recommendation: Deepgram Nova-2 streaming API**

**Rationale:**
- Deepgram's streaming WebSocket API delivers partials every 100-300ms and final segments at utterance boundaries — well-suited to intent detection on sentence-final events
- Nova-2 has strong accuracy on conversational English including non-native accents (relevant for Dubai/international client base)
- OpenAI Realtime API is an alternative but more expensive and primarily designed for voice-to-voice; adds unnecessary complexity for transcription-only use
- Whisper (batch) is too slow for real-time — 30-60s segments have unacceptable latency

**Fallback:** OpenAI Realtime API (`gpt-4o-realtime-preview`) if Deepgram reliability is an issue. Different pricing model.

---

### Decision 4: Vector Store for RAG

**Recommendation: pgvector (Postgres extension)**

**Rationale:**
- Keeps the stack at a single database for both relational data (tenants, sessions, email drafts) and vector search
- Tenant isolation is straightforward: `tenant_id` column + row-level security policy; no separate namespace management
- pgvector supports HNSW indexing (fast ANN search, added in pgvector 0.5+) — sufficient for POC-scale document collections (hundreds to low thousands of chunks per tenant)
- Eliminates operational overhead of a separate vector database service

**Scale threshold:** Pinecone or Weaviate only warranted when a single tenant's corpus exceeds ~500K chunks or when cross-tenant semantic search is needed. Neither applies to this POC or near-term SaaS.

---

### Decision 5: Multi-Tenancy Isolation Strategy

**Recommendation: Row-Level Security (RLS) in Postgres + namespace prefix on vector embeddings**

**Rationale:**
- Every table has a `tenant_id` column (UUID referencing the `tenants` table)
- Postgres RLS policies enforce that all queries automatically filter by the authenticated tenant's ID
- JWT claims include `tenant_id`; backend sets a session variable on each DB connection that RLS policies read
- pgvector queries include `WHERE tenant_id = $tenant` — no vector data leakage across tenants
- Object storage (S3/R2): path prefix `{tenant_id}/{file_id}` + IAM/signed URL scoping

**Not recommended:** Database-per-tenant (complex migrations, high cost at SaaS scale) or schema-per-tenant (complex connection pooling). Row-level isolation is the standard for early-stage SaaS.

---

## Suggested Build Order

Dependencies run shallow → deep. The audio pipeline and delivery layer must exist before the intelligence layer can be tested end-to-end.

```
Phase 1: Foundation (no AI, just plumbing)
├── Auth + tenant model (JWT, RLS, tenant_id everywhere)
├── PWA shell (Next.js, installable, mic permission, AudioWorklet)
└── Audio Gateway + Deepgram integration (transcription to screen, no cards yet)
    Milestone: Raw transcript visible on phone in real-time

Phase 2: RAG Pipeline
├── Document ingestor (CSV/PDF → chunks → pgvector)
├── Embedding + retrieval endpoint
└── Admin UI for uploads
    Milestone: Can query uploaded documents and get relevant chunks back

Phase 3: Intelligence Layer (hot path)
├── Intent Detector (GPT-4o-mini on transcript stream)
├── Answer Generator (RAG + GPT-4o)
└── SSE card publisher + card stack UI on phone
    Milestone: Full loop — speak a question, see a card appear on phone

Phase 4: Web Search + Controls
├── Web search trigger (Tavily API)
├── Agent confirm flow (stub card → confirm tap → result card)
└── Card dismissal / session controls
    Milestone: Questions outside company data resolved via web

Phase 5: Post-Meeting + Email
├── Session end flow + transcript persistence
├── Email draft generation (GPT-4o)
└── In-app email review + send
    Milestone: End-to-end session produces actionable follow-up

Phase 6: SaaS Hardening
├── Multi-tenant admin (agent accounts, data management)
├── Rate limiting, usage metering, billing hooks
└── Performance tuning (latency profiling, SSE keep-alive, reconnect logic)
```

**Dependency rationale:**
- Phase 1 must precede Phase 3: cannot test card delivery without audio → transcript pipeline
- Phase 2 must precede Phase 3: RAG retriever is required by the Answer Generator
- Phase 4 can run in parallel with Phase 5 once Phase 3 is complete
- Phase 6 is operational hardening; can be deferred until after POC validation

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Processing Every Transcript Word Through LLM

**What goes wrong:** Calling GPT-4o on every partial transcript word triggers thousands of LLM calls per session, inflating cost and adding noise.

**Why it happens:** "Real-time" is interpreted as every audio event, not every sentence.

**Instead:** Buffer transcript until sentence-final events (Deepgram's `is_final: true` flag marks utterance boundaries). Run intent detection only on complete sentences or sliding 30-second windows advancing every 10 seconds.

---

### Anti-Pattern 2: Sending Raw Audio to Backend Over HTTP REST

**What goes wrong:** Batching audio into HTTP POST requests introduces 2-5s latency from buffering alone, defeating real-time UX.

**Why it happens:** REST is familiar; streaming WebSocket feels complex.

**Instead:** WebSocket with binary frames. AudioWorklet sends 100ms PCM chunks as ArrayBuffer; server streams to STT API immediately. No buffering beyond what the network requires.

---

### Anti-Pattern 3: Single WebSocket for Everything (Audio + Card Events)

**What goes wrong:** Multiplexing binary audio data and JSON card events on one WebSocket connection requires a custom framing protocol. Binary audio and text JSON interleave; any parsing bug drops audio or cards.

**Why it happens:** Wanting to minimize connections.

**Instead:** Two connections — WebSocket for audio (binary, high-throughput), SSE for card events (text, low-throughput). Each connection has a single clear purpose.

---

### Anti-Pattern 4: Shared Vector Namespace Across Tenants

**What goes wrong:** Without tenant scoping on vector queries, a retrieval bug or missing WHERE clause could surface one agency's listings in another agency's session.

**Why it happens:** Vector stores added as afterthought; tenant_id not wired through all query paths.

**Instead:** Enforce `tenant_id` at the ORM/query layer, backed by Postgres RLS as a safety net. Test tenant isolation as a first-class concern before adding the first second tenant.

---

### Anti-Pattern 5: Streaming LLM Output Directly to Phone

**What goes wrong:** Streaming token-by-token LLM output to the phone PWA creates a poor UX — partial cards flicker onto screen word-by-word, agent may read an incomplete (misleading) answer.

**Why it happens:** LLM streaming is technically available and feels "real-time."

**Instead:** Accumulate the full card response server-side, then push the complete card as a single SSE event. The answer is typically 2-3 sentences; the additional 1-2s to complete generation is worth the cleaner UX. Reserve streaming output for the post-meeting email draft (longer content, editing UX benefits from progressive display).

---

## Scalability Considerations

| Concern | POC (1 tenant, <5 agents) | Early SaaS (50 tenants) | Scale (500+ tenants) |
|---------|--------------------------|------------------------|----------------------|
| Audio WebSocket connections | Single server, Node.js | Sticky sessions via load balancer | Dedicated audio gateway service |
| STT costs | ~$0.006/min (Deepgram) | Volume discount tier | Negotiate enterprise contract |
| Vector search | pgvector, single Postgres | pgvector, read replicas | Separate pgvector cluster or Pinecone |
| LLM costs | ~$0.002-0.01 per card (gpt-4o-mini intent + gpt-4o answer) | Per-seat pricing model | Caching frequent Q&A pairs |
| SSE connections | Simple HTTP | Sticky sessions | Redis pub/sub to fan-out SSE across nodes |
| Session state (Redis) | Single Redis instance | Redis Cluster or managed (Upstash) | Redis Cluster with session sharding |

**Redis pub/sub note for multi-node:** When the system scales beyond a single server, SSE connections land on different nodes than the card publisher. Redis pub/sub (channel per session_id) solves fan-out without custom messaging infrastructure.

---

## Sources

**Confidence note:** External research tools were unavailable during this session. All architecture patterns are drawn from established practices as of training cutoff (August 2025). Specific library versions and API surface areas should be verified against current official documentation before implementation.

Relevant official documentation to verify:
- Deepgram streaming API: https://developers.deepgram.com/docs/getting-started-with-live-streaming-audio
- OpenAI Realtime API (alternative STT): https://platform.openai.com/docs/guides/realtime
- pgvector HNSW indexing: https://github.com/pgvector/pgvector
- Web Audio API / AudioWorklet: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
- PWA on iOS capabilities: https://developer.apple.com/documentation/webkit
- Server-Sent Events spec: https://html.spec.whatwg.org/multipage/server-sent-events.html
- Postgres Row Level Security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

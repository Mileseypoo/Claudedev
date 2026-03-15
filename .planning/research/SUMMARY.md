# Project Research Summary

**Project:** Dictator — Real-Time AI Sales Copilot
**Domain:** Real-time AI meeting copilot SaaS (phone-first, in-person estate agency)
**Researched:** 2026-03-15
**Confidence:** MEDIUM

## Executive Summary

Dictator is a phone-first AI sales copilot designed for in-person estate agency meetings. Unlike the dominant players in conversation intelligence (Gong, Chorus, Otter.ai), which are virtual-meeting-first and post-meeting-focused, Dictator targets a genuine gap: ambient phone-mic capture of live client conversations combined with real-time retrieval of proprietary company knowledge, surfaced as glanceable cards before the conversation moves on. The recommended approach is a Next.js + Supabase stack with Deepgram streaming STT, OpenAI GPT-4o for generation, and pgvector for RAG — a mature, well-documented combination that avoids managing multiple infrastructure services at POC stage.

The product's core technical challenge is the real-time pipeline: audio captured on a phone mic must traverse transcription, intent detection, vector retrieval, and LLM generation in under 8 seconds end-to-end, then be pushed back to the phone via SSE. This is achievable but requires deliberate latency budgeting at each stage. The architecture separates audio upload (WebSocket) from card delivery (SSE), avoids processing every transcript word through the LLM, and buffers the full LLM response server-side before pushing complete cards — prioritising accuracy and UX cleanliness over raw streaming throughput.

The two highest-risk areas are iOS audio behaviour and RAG data quality. iOS Safari kills microphone access when the app is backgrounded, which is a platform-level constraint with no web-only workaround — the POC must either accept this limitation with a clear in-app warning, or adopt React Native for iOS from the start. On the data side, using fixed-size chunking for structured property data (CSVs) produces hallucinated-confident wrong answers; structured data must go into a SQL table with direct lookup, not into the vector store as free text. Both issues must be resolved before a client-facing demo.

---

## Key Findings

### Recommended Stack

The stack is purpose-assembled around the real-time constraint. Next.js 15 with App Router handles the full-stack web layer — PWA shell, API routes for the audio WebSocket relay, SSE card streaming, and admin UI — without a separate backend service. Supabase provides managed Postgres with pgvector (eliminating a separate vector database), Row Level Security for multi-tenant data isolation, auth with JWT, file storage, and a realtime pub/sub layer. This consolidation into two platforms (Vercel + Supabase) is the correct call for POC: it removes infrastructure surface area without sacrificing capability.

For the intelligence layer, Deepgram Nova-2 is the streaming STT recommendation over Web Speech API (unreliable on iOS, no server-side access) and self-hosted Whisper (batch-only, adds 1–3s latency, GPU cost). OpenAI GPT-4o handles answer generation and email drafting; GPT-4o-mini handles the high-frequency intent detection calls at 10x lower cost. Tavily provides LLM-optimised web search for the agent-confirmed lookup flow.

**Core technologies:**
- **Next.js 15 + React 19**: Full-stack framework — PWA, API routes, SSE streaming, App Router
- **Supabase (Postgres + pgvector + RLS + Auth + Storage + Realtime)**: All data, auth, and push delivery in one platform
- **Deepgram Nova-2**: Streaming STT — purpose-built for WebSocket streaming, strong accent handling for Dubai context
- **OpenAI GPT-4o / GPT-4o-mini**: Answer generation (4o) and intent classification (4o-mini for cost control)
- **Vercel AI SDK (`ai` 3.x)**: Streaming LLM responses to UI
- **LangChain.js + OpenAI text-embedding-3-small**: RAG pipeline — document loading, chunking, embedding, pgvector retrieval
- **Tavily Search API**: Web lookup for questions outside company knowledge base
- **Resend + React Email**: Follow-up email generation preview and sending
- **next-pwa**: PWA manifest and service worker for mobile install

> See `.planning/research/STACK.md` for full version table, installation commands, and alternatives considered.

---

### Expected Features

The feature landscape is clear. Everything in the product depends on the audio → transcription → intent detection → RAG chain being reliable first. The post-meeting email is the second major value prop and can be layered on once the real-time loop is validated. No competitor occupies the specific intersection of phone-first + in-person + real-time RAG from private data.

**Must have (table stakes):**
- Real-time audio transcription — everything depends on this; missing = no product
- Question/topic detection from transcript — users expect the system to act without manual triggers
- RAG answer cards surfaced in real time — the core value prop; sub-2s retrieval latency required
- Glanceable card stack UI — scroll-up stack, newest at bottom, non-disruptive
- Company knowledge base (CSV/PDF upload → vector store) — without private data, the product has no edge
- Multi-tenant data isolation — non-negotiable from day one; retrofitting is catastrophic
- Post-meeting summary + action item extraction — expected by all reps as a safety net
- Post-meeting follow-up email draft — increasingly table stakes; prominent differentiator here
- Searchable meeting history — low complexity; expected for "find that conversation with Ahmed"

**Should have (differentiators):**
- Agent-confirmed web lookup — mid-meeting web search with a "confirm before fire" tap; low complexity, high trust value
- Phone-first in-person UX — one-hand use, large tap targets, minimal interaction during live conversation
- Domain-specific vertical focus (UAE estate agency) — pre-seeded prompts, terminology awareness, RERA/DLD context
- Factual stats cards from CSV data — "You've sold 47 units above asking price" surfaced as proactive credibility cards
- Agent reviews email before send (hard constraint, never auto-send) — compliance, trust, agent control

**Defer (v2+):**
- Manager/team analytics dashboard
- CRM integration (Salesforce, HubSpot)
- White-label per-tenant branding
- Arabic / multi-language support
- Meeting history archive search (useful but not required for POC validation)
- Real-time conversation coaching scoring
- Calendar/scheduling integration

> See `.planning/research/FEATURES.md` for full feature dependency tree, anti-features list, and competitive positioning.

---

### Architecture Approach

The system decomposes into five layers: audio capture (PWA AudioWorklet → WebSocket), transcription + NLP (Deepgram streaming → intent detector on sentence-final events), retrieval + generation (pgvector RAG + GPT-4o), delivery (SSE card push to phone), and data management (async document ingestion, tenant/auth, admin UI). The key design decision is two separate connections per active session — WebSocket for high-throughput binary audio upload, SSE for low-throughput card delivery — rather than multiplexing both on a single WebSocket.

**Major components:**
1. **PWA Audio Capture** — Browser mic → AudioWorklet (16kHz mono PCM) → WebSocket binary frames to Audio Gateway
2. **Audio Gateway** — Relays audio stream to Deepgram; writes final transcript segments to session store
3. **Intent Detector** — Runs GPT-4o-mini on sentence-final transcript events; identifies information-seeking questions
4. **RAG Retriever** — Embeds question, cosine-searches tenant's pgvector namespace, returns top-K chunks
5. **Answer Generator** — GPT-4o synthesises answer from retrieved context; card assembled server-side before push
6. **Card Publisher (SSE)** — Pushes complete card events to the phone session; one SSE connection per active session
7. **Web Search Trigger** — On agent "confirm" tap, calls Tavily API; pushes result card update
8. **Document Ingestor** — Async background job: parse CSV/PDF → chunk → embed → upsert to pgvector per tenant
9. **Email Drafter** — Post-session: full transcript + Q&A log → GPT-4o → draft stored → agent reviews → Resend sends
10. **Admin Web UI** — Document uploads, agent account management; desktop-friendly, separate route
11. **Auth / Tenant Service** — Supabase Auth JWT with tenant_id claim; RLS enforces all data isolation at DB layer

> See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, scalability table, and anti-patterns.

---

### Critical Pitfalls

1. **iOS Safari kills microphone on background** — Platform-level WebKit constraint; not a bug. Audio silently stops when the screen locks or the user switches apps. Prevention: add a heartbeat check on audio chunk timestamps; surface a "mic paused" banner immediately; consider React Native for production iOS builds if background audio is required.

2. **Latency budget consumed before LLM fires** — STT final segment wait (1–3s) + embedding + LLM generation stack to >8s if not managed. Prevention: run intent detection on interim transcripts with a speculative RAG prefetch; use a two-stage pipeline (fast heuristic → confirmed LLM); target a hard <=3s end-to-end budget measured per stage.

3. **Question detection false positive flood** — ~30–40% of sales conversation sentences contain question-like syntax but are not information-seeking. Cards spam the agent; agent disengages within 5 minutes. Prevention: lightweight classifier (not the main LLM) to separate information-seeking from rhetorical/social questions; classify speaker so agent's own statements don't trigger retrieval; gate on confidence threshold (>0.75).

4. **RAG returns wrong passage — hallucinated-confident wrong price** — Fixed-size chunking splits tables and price lists mid-entry; LLM generates fluently from the wrong chunk; agent states incorrect pricing to a live client. Prevention: structured CSV data goes into SQL with direct lookup, not into the vector store; RAG only for unstructured PDFs; add source metadata on every card; include confidence gate.

5. **Multi-tenant vector leakage** — Missing `tenant_id` filter on a vector query silently returns another agency's data. In UAE property context, this is a data protection breach. Prevention: namespace-per-tenant as the primary guard (not just a filter); RLS in Postgres as safety net; integration tests for cross-tenant query scenarios before any second tenant is added.

6. **LLM response latency breaks real-time illusion** — GPT-4o takes 3–8s for a complete response. Prevention: stream LLM tokens progressively to the card so first token appears in <500ms; use GPT-4o-mini for synthesis where quality allows; cap answer length at 2 sentences via system prompt; avoid serverless cold starts on the hot path.

> See `.planning/research/PITFALLS.md` for full 13-pitfall catalogue with detection signs and phase-specific warning table.

---

## Implications for Roadmap

Based on combined research, the architecture's suggested build order maps directly to product phases. The audio pipeline and delivery layer must exist and be tested before the intelligence layer can be validated end-to-end. RAG retrieval must be functional before answer generation can be tested. This creates a clear linear dependency through Phase 1–3, after which Phases 4 and 5 can proceed in parallel.

### Phase 1: Foundation — Audio Pipeline + Auth
**Rationale:** Nothing in the product works without reliable audio capture → transcription → transcript visible on phone. Auth and multi-tenancy must be correct from the start because retrofitting RLS is costly. These two concerns are the only true blockers for everything downstream.
**Delivers:** Installable PWA on phone with microphone access; real-time transcript visible on screen; tenant-isolated data model; Supabase Auth with JWT + RLS.
**Addresses:** Real-time audio transcription (table stakes #1), multi-tenant isolation (table stakes #10)
**Avoids:** iOS background mic termination (Pitfall 1) — must include heartbeat check and foreground warning; multi-tenant data leakage (Pitfall 5) — RLS baked in from first migration
**Research flag:** Needs hands-on validation — iOS Safari `MediaRecorder` + `AudioWorklet` behaviour on target device models must be tested in real conditions, not assumed from docs.

### Phase 2: RAG Pipeline — Document Ingestion + Retrieval
**Rationale:** RAG retrieval is a hard dependency of Phase 3 (answer generation). The ingestion pipeline is async and independent; building it second means Phase 3 has data to work with immediately. This is also where the structured-vs-unstructured data split must be implemented — wrong here means bad answers in every demo.
**Delivers:** CSV/PDF upload via Admin UI; parse → chunk → embed → pgvector upsert pipeline; retrieval endpoint returning top-K chunks for a query; document status tracking.
**Addresses:** Company knowledge base (table stakes #5), CSV/PDF as primary data layer (differentiator)
**Avoids:** Wrong chunk / hallucinated price (Pitfall 4) — structured CSV data in SQL, RAG only for PDFs; embedding model drift (Pitfall 10) — pin model version and store with vectors; garbage CSV ingestion (Pitfall 13) — content validation and post-index preview in admin UI
**Research flag:** Standard RAG pipeline patterns are well-documented. No deep research phase needed, but verify LangChain.js CSVLoader/PDFLoader API surface against current docs before implementation.

### Phase 3: Intelligence Layer — Intent Detection + Answer Cards
**Rationale:** This is the core value loop. It depends on Phase 1 (transcript stream) and Phase 2 (retrieval). Once this phase is complete, the product can be demoed end-to-end. The card stack UI is part of this phase — the visual surface must exist to validate the AI quality.
**Delivers:** Intent detection on sentence-final transcript events (GPT-4o-mini); RAG query + GPT-4o answer generation; SSE card publisher; card stack UI on phone (glanceable, mobile-first); full loop — speak a question, see a card within 3–8s.
**Addresses:** Question/topic detection (table stakes #2), RAG answer cards (table stakes #3), card stack UI (table stakes #4)
**Avoids:** LLM on every word (Architecture Anti-Pattern 1); question detection false positive flood (Pitfall 3) — lightweight classifier, speaker-aware, confidence threshold; LLM latency (Pitfall 6) — GPT-4o-mini for detection, stream tokens, cap answer length; latency budget exceeded (Pitfall 2) — speculative prefetch on interim transcripts
**Research flag:** Needs deeper research on intent classification approach. The specific prompt engineering for distinguishing information-seeking questions from rhetorical/social speech in estate agency conversations is non-trivial and will require empirical tuning on real conversation samples.

### Phase 4: Web Search + Session Controls
**Rationale:** Extends coverage for questions outside company data. Relatively low complexity once Phase 3 is working — it adds a new card type and a Tavily API call. Can run in parallel with Phase 5 once Phase 3 delivers the core loop.
**Delivers:** "Web lookup suggestion" card type; agent "confirm" tap flow; Tavily API integration; result card replacing stub card; card dismissal and session controls; pause cards mode.
**Addresses:** Agent-confirmed web lookup (differentiator), phone-first UX controls
**Avoids:** Web search rate limiting mid-meeting (Pitfall 7) — fallback provider, 24hr cache, queue with backoff; card UX interrupting agent (Pitfall 9) — haptic notification, pause mode, no large animations
**Research flag:** Standard patterns. No deep research phase needed.

### Phase 5: Post-Meeting + Email
**Rationale:** Second major value prop. Depends on Phase 1 (session transcript) and Phase 3 (Q&A event log). Can run in parallel with Phase 4. The email flow is async so LLM latency does not matter here — quality over speed.
**Delivers:** Session end flow with transcript commit gate; GPT-4o email draft from full transcript + Q&A log; in-app email review and edit UI; send via Resend API; meeting summary and action item extraction.
**Addresses:** Post-meeting summary + action items (table stakes #6–7), follow-up email draft (table stakes #8); hard "agent reviews before send" constraint enforced
**Avoids:** Email generated from incomplete transcript (Pitfall 12) — wait for all in-flight ASR chunks before triggering generation; WebSocket drop killing session data (Pitfall 11) — persist transcript chunks incrementally
**Research flag:** Well-documented patterns for email generation + React Email. No deep research phase needed.

### Phase 6: SaaS Hardening
**Rationale:** Operational hardening after POC validation. Addresses multi-agent, multi-tenant scalability and prepares the product for real agency onboarding. Not required for the POC demo but must be planned before commercial launch.
**Delivers:** Multi-tenant admin (agent accounts, per-agency data management); rate limiting and usage metering; performance profiling and latency optimisation; SSE reconnect + session recovery; billing hooks.
**Addresses:** Searchable meeting history (deferred table stakes), white-label branding architecture prep
**Avoids:** WebSocket drops on long sessions (Pitfall 11) — reconnect with exponential backoff; Redis pub/sub for multi-node SSE fan-out at scale
**Research flag:** Redis pub/sub for SSE fan-out is a well-known pattern. Billing integration (Stripe) may warrant a research pass depending on pricing model complexity.

---

### Phase Ordering Rationale

- **Phase 1 must precede Phase 3**: The audio → transcript pipeline is the input to all intelligence processing. Testing question detection without live transcription is not representative.
- **Phase 2 must precede Phase 3**: The RAG retriever is a direct dependency of the Answer Generator. Without indexed documents, answer generation cannot be tested meaningfully.
- **Phases 4 and 5 can run in parallel** once Phase 3 is complete — both depend only on the card delivery infrastructure and session transcript, not on each other.
- **Phase 6 is a post-POC concern** — operational hardening should not block the first client-facing demo. The POC can run as a single-tenant, single-agent instance.
- **Multi-tenancy is threaded through from Phase 1** — not a separate phase. Every DB migration from day one must include `tenant_id` and RLS policies. This is not optional.

---

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** iOS `MediaRecorder` + `AudioWorklet` behaviour requires hands-on testing against target iOS versions and device models. Do not rely on MDN compatibility tables alone — iOS Safari PWA capabilities have historically lagged documentation.
- **Phase 3:** Intent classification prompt engineering for estate agency conversations is domain-specific and non-trivial. Will require empirical tuning with real conversation samples; budget time for iteration. The line between "information-seeking question from client" and "rhetorical statement by agent" cannot be resolved with off-the-shelf prompts.

Phases with standard patterns (skip dedicated research phase):
- **Phase 2:** LangChain.js RAG pipeline with pgvector is extensively documented. Verify current API surface before implementation but no research phase needed.
- **Phase 4:** Tavily integration + SSE card update flow is straightforward. Standard patterns apply.
- **Phase 5:** Email generation + React Email + Resend is a well-worn path. No research needed.
- **Phase 6:** Redis pub/sub fan-out for SSE is a known pattern. Billing integration may warrant a targeted API research pass.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | All tool calls denied during research; versions from training data (Aug 2025 cutoff). Next.js 15, Deepgram Nova-2, Vercel AI SDK, LangChain.js versions must be verified before implementation. Architecture pattern choices (pgvector over Pinecone, Deepgram over Web Speech API) are HIGH confidence. |
| Features | MEDIUM | Competitive analysis (Gong, Chorus, Otter.ai, Avoma) based on training data. Feature gap claim (phone-first + in-person + real-time RAG) is grounded but should be spot-checked against current competitor product pages. Core feature requirements from PROJECT.md are HIGH confidence. |
| Architecture | MEDIUM-HIGH | Next.js + Supabase + pgvector + Vercel is an established 2025 pattern (HIGH). Component boundaries and data flow are well-reasoned from first principles (MEDIUM-HIGH). iOS PWA audio behaviour requires hands-on validation (MEDIUM). |
| Pitfalls | HIGH (critical) / MEDIUM (moderate) | iOS background mic (Pitfall 1), latency budget (Pitfall 2), RAG chunking failure (Pitfall 4), cross-tenant leakage (Pitfall 5), LLM latency (Pitfall 6), embedding drift (Pitfall 10) are all HIGH-confidence, well-documented production failure modes. Question detection false positives (Pitfall 3), audio quality (Pitfall 8), and card UX (Pitfall 9) are MEDIUM — require empirical tuning. |

**Overall confidence:** MEDIUM — The technology choices and architecture patterns are well-grounded. The primary uncertainty is version currency (all versions require verification before implementation) and iOS PWA audio behaviour, which requires hands-on device testing. Research conclusions are unlikely to change materially; specific implementation details will need verification.

---

### Gaps to Address

- **iOS audio behaviour on target devices**: Must test `AudioWorklet` + `MediaRecorder` on specific iPhone models and iOS versions used by agents before committing to PWA-only approach. If iOS 16 or earlier is a requirement, React Native may be mandatory for iOS.
- **Version verification**: All package versions in STACK.md are Aug 2025 training-data approximations. Before writing a single line of code, verify Next.js, Deepgram SDK, Vercel AI SDK, LangChain.js, and OpenAI model names against current releases.
- **Intent classification tuning data**: The question detection classifier (Pitfall 3) cannot be tuned without real estate agency conversation samples. Plan for a tuning sprint once Phase 1 + 2 are complete and real transcripts exist.
- **UAE-specific terminology for Deepgram vocabulary boosting**: RERA, DLD, freehold zone names, developer brands (Emaar, DAMAC, etc.), property names — these must be compiled into a custom vocabulary list before the first real-environment test.
- **Deepgram Nova-2 vs Nova-3**: The research recommends Nova-2 as of mid-2025. Verify whether Nova-3 has been released and whether it offers meaningfully better performance for the Dubai accent mix before committing.

---

## Sources

### Primary (HIGH confidence)
- PROJECT.md — authoritative requirements and constraints (Dictator project spec)
- Established architecture patterns from training data: Next.js + Supabase SaaS pattern, SSE vs WebSocket trade-offs, pgvector multi-tenancy, RLS isolation

### Secondary (MEDIUM confidence)
- Training-data knowledge of Deepgram Nova-2 streaming API (Aug 2025) — STT choice and latency characteristics
- Training-data knowledge of Gong, Chorus, Otter.ai, Fireflies.ai, Avoma product features (Aug 2025) — competitive gap analysis
- Training-data knowledge of OpenAI GPT-4o, GPT-4o-mini, text-embedding-3-small (Aug 2025) — LLM and embedding choices
- Training-data knowledge of pgvector HNSW indexing, LangChain.js RAG patterns (Aug 2025) — RAG pipeline design

### Tertiary (MEDIUM — requires verification)
- All package version numbers in STACK.md — treat as approximate; verify at implementation time
- iOS Safari PWA audio behaviour — was accurate as of iOS 16/17 era; verify against current WebKit release notes
- Tavily Search API pricing and availability — verify current tier limits before integrating

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*

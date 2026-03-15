# Technology Stack

**Project:** Dictator — Real-Time AI Sales Copilot
**Researched:** 2026-03-15
**Knowledge cutoff:** August 2025 (training data only — no live verification possible in this session)

---

## Confidence Note

All tool calls (WebSearch, WebFetch, Bash, Context7) were denied in this session. Every recommendation below is sourced from training data with a cutoff of August 2025. Versions and availability MUST be verified before implementation. Confidence levels reflect this limitation.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x | Full-stack web framework | App Router with React Server Components handles SSR for fast mobile load; built-in API routes eliminate a separate backend service for most endpoints; Vercel deployment is trivial; PWA support via `next-pwa`. The mobile-first SaaS pattern is well-served here. |
| React | 19.x | UI layer | Ships with Next.js 15. Concurrent features matter for real-time card updates without jank. |
| TypeScript | 5.x | Type safety | Non-negotiable for a multi-tenant SaaS with complex data models. |
| Tailwind CSS | 3.x | Styling | Utility-first approach is fastest for building glanceable mobile UIs. `shadcn/ui` components built on Tailwind. |
| shadcn/ui | latest | Component primitives | Headless, copy-paste components. No bundle bloat from unused components. Good mobile touch targets out of the box. |

**Confidence: MEDIUM** — Next.js 15 and React 19 were released/in RC as of mid-2025. Verify Next.js 15 is stable and not superseded.

---

### Real-Time Audio Transcription

This is the most critical technical decision. Two viable architectures exist:

#### Option A (Recommended): Deepgram Streaming WebSocket API

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Deepgram Nova-2 | API (no version pinning) | Real-time streaming STT | Purpose-built for streaming audio over WebSocket. ~300ms latency. Superior accuracy vs Web Speech API. Works on mobile browsers (Safari iOS, Chrome Android) via a WebSocket relay. Nova-2 model has best English + accent handling — important for Dubai context with non-native speakers. Pricing is per-minute, predictable for SaaS billing. |
| Deepgram SDK (`@deepgram/sdk`) | 3.x | Client/server SDK | Official Node.js SDK for server-side WebSocket relay. |

**Architecture:** Browser captures audio via `MediaRecorder` API (supported on iOS Safari 14.5+, Chrome Android) → streams PCM/WebM chunks to your Next.js API route via a client WebSocket → server relays to Deepgram WebSocket → transcription tokens stream back via SSE or WebSocket to the browser.

**Why not Web Speech API:** No access to raw audio stream, cannot be intercepted for further processing, unreliable on iOS Safari, no server-side access to transcript for RAG triggering, recognition stops in background tab. Unsuitable for production.

**Why not self-hosted Whisper:** Whisper is batch-optimized, not streaming. `whisper.cpp` with chunking adds 1–3s latency. Requires GPU infrastructure. Not viable for a POC targeting phone mic in an office.

**Why not AssemblyAI:** Strong alternative, comparable pricing. Deepgram has lower latency on streaming. Either works — Deepgram is recommended for latency.

**Confidence: MEDIUM** — Deepgram Nova-2 and SDK v3 were current as of mid-2025. Verify Nova-3 has not superseded Nova-2, and check current SDK version.

---

### LLM Provider

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| OpenAI GPT-4o | API (gpt-4o) | RAG answer generation, email drafting, question detection | Best balance of speed and quality for in-meeting latency requirements. Function calling / tool use is well-documented. Context window (128K) handles long transcripts for email generation. |
| OpenAI GPT-4o-mini | API (gpt-4o-mini) | Fast question classification, low-stakes routing decisions | 10x cheaper than GPT-4o, adequate for "is this a question?" classification that runs on every transcript segment. |
| Vercel AI SDK (`ai`) | 3.x | Streaming LLM responses to UI | Abstracts provider differences. Built for Next.js. Handles streaming text to React components. `useChat` / `useCompletion` hooks. |

**Why not Anthropic Claude:** Claude has better reasoning but slower TTFT (time-to-first-token) on streaming, which matters when answers need to appear before the client finishes their sentence. OpenAI wins on streaming latency.

**Why not local/self-hosted LLM:** Latency and quality are unsuitable for real-time meeting context. Not viable for POC.

**Why not Gemini:** Viable alternative. OpenAI has better ecosystem tooling (function calling, assistants, fine-tuning path). Stick with one ecosystem to avoid integration complexity.

**Confidence: MEDIUM** — GPT-4o and Vercel AI SDK v3 were current as of mid-2025. OpenAI model naming changes frequently. Verify current recommended model names at implementation time.

---

### RAG / Vector Search

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16.x | Primary relational database | Multi-tenant data model (agencies, agents, sessions, documents). Well-understood, easy to operate, Supabase wraps it. |
| pgvector | 0.7.x | Vector similarity search | Extension runs inside PostgreSQL — no separate vector DB to operate, no cross-database consistency issues, no extra cost. For POC-scale (one agency, dozens of documents), pgvector with HNSW indexes is more than sufficient. |
| Supabase | cloud (latest) | Postgres host + auth + storage + realtime | Provides managed PostgreSQL with pgvector, Row Level Security (perfect for multi-tenancy), auth with JWT, file storage for CSV/PDF uploads, and a realtime pubsub layer. Eliminates 4 separate infrastructure concerns. |
| LangChain.js (`langchain`) | 0.2.x | RAG orchestration | Document loading, chunking, embedding, retrieval chain construction. Has loaders for PDF and CSV. Pairs with pgvector via `@langchain/community`. |
| OpenAI text-embedding-3-small | API | Embedding generation | 1536 dimensions, cheap, fast. Better than ada-002. Sufficient for document semantic search. |

**Why not Pinecone:** Adds a separate managed service with its own billing, latency for cross-service calls, and an integration surface. Overkill until you have millions of documents. pgvector inside Supabase keeps the data in one place.

**Why not Qdrant/Weaviate/Chroma:** Same reason — extra infrastructure. pgvector is the correct choice for a SaaS with moderate document volume per tenant.

**Why not Weaviate cloud:** No strong reason to use it when Supabase already provides the Postgres instance.

**Confidence: MEDIUM** — pgvector 0.7.x with HNSW was current as of mid-2025. LangChain.js 0.2.x was stable. Verify current versions of both.

---

### Web Search (Agent-Confirmed)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tavily Search API | API | Web search for out-of-data questions | Purpose-built for LLM agents. Returns clean, summarized results rather than raw HTML. Designed for RAG augmentation. Has a "search depth: advanced" mode that returns source URLs. Free tier covers POC volume. Per-query pricing scales with usage. |

**Why not Google Custom Search:** Messy API, HTML results need parsing, per-query cost is higher at scale.

**Why not Bing Search API:** Being deprecated/restructured; less clean results for LLM consumption.

**Why not SerpAPI / Browserless:** Higher cost, more complexity than Tavily for this use case.

**Confidence: MEDIUM** — Tavily was the dominant choice for LLM-agent web search as of mid-2025. Verify it's still actively maintained and pricing hasn't changed.

---

### Backend / API Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js API Routes | (built-in) | REST endpoints + WebSocket relay | No separate backend needed for POC. App Router route handlers handle auth middleware, streaming responses (SSE), and WebSocket relay to Deepgram. |
| Supabase Auth | (built-in) | Authentication | Email/password + magic link. JWT tokens with tenant claims. Row Level Security policies enforce data isolation at DB level — most secure multi-tenancy pattern. |
| Supabase Realtime | (built-in) | Push new cards to phone | Postgres changes broadcast to subscribed clients. When server writes a new "card" row, the phone receives it via Supabase Realtime subscription. Eliminates need for a separate WebSocket server for card delivery. |
| Zod | 3.x | Runtime validation | API request/response validation. Pairs with TypeScript for end-to-end type safety. |

**Why no separate Node/Express/Fastify server for POC:** Unnecessary complexity. Next.js API routes handle everything at POC scale. The only exception is the Deepgram WebSocket relay, which can run as a Next.js API route with streaming.

**Confidence: HIGH** — This is a well-established pattern. Next.js + Supabase is a standard 2025 SaaS stack.

---

### Email Generation and Sending

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Resend | API | Transactional email sending | Clean API, React Email integration, good deliverability, generous free tier (3,000 emails/month). Built for developers. Simpler than SendGrid/Mailgun for a new SaaS. |
| React Email (`@react-email/components`) | 0.0.x | Email template rendering | Build email templates in React, render to HTML. Consistent cross-client rendering. Allows the in-app "preview and edit" flow before sending. |

**Email flow:** LLM generates structured email data (subject, greeting, Q&A bullets, closing) → React Email template renders it → agent sees preview in app → agent can edit → on "Send" button, POST to API route → Resend API sends it.

**Why not SendGrid/Mailgun:** More complex setup, higher pricing at low volume, worse DX for new projects.

**Why not Nodemailer:** Requires configuring your own SMTP, no deliverability guarantees, more ops burden.

**Confidence: MEDIUM** — Resend and React Email were the recommended pairing as of mid-2025. Verify Resend pricing hasn't changed.

---

### File Upload and Document Processing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Storage | (built-in) | CSV/PDF file storage | Already in the stack. Per-bucket policies enforce tenant isolation. |
| `pdf-parse` or `pdfjs-dist` | latest | PDF text extraction | Server-side extraction before chunking. `pdf-parse` is simpler; `pdfjs-dist` handles more complex PDFs. |
| `papaparse` | 5.x | CSV parsing | Robust CSV parsing with type inference. Used server-side in the ingestion pipeline. |
| LangChain.js document loaders | (bundled) | Unified ingestion pipeline | `PDFLoader` and `CSVLoader` wrap the above libraries. Consistent chunking and embedding interface. |

**Confidence: MEDIUM** — Standard Node.js document processing libraries. Unlikely to have changed significantly.

---

### Mobile PWA

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `next-pwa` | 5.x | PWA manifest + service worker | Enables "Add to Home Screen" on iOS and Android. Offline-capable shell. App-like experience without App Store submission. Service worker handles background audio permission handoff. |

**Critical mobile browser considerations:**
- iOS Safari requires `MediaRecorder` polyfill investigation — Safari added `MediaRecorder` in iOS 14.5 but opus/webm support is limited. Use `audio/mp4` as fallback container or stream raw PCM. Deepgram accepts multiple formats.
- iOS Safari will suspend audio capture when the screen locks. The app must keep the screen awake (`WakeLock API`, iOS Safari 16.4+) or prompt the user.
- Android Chrome has no notable limitations for this use case.

**Confidence: MEDIUM** — PWA capabilities on iOS Safari improved through 2024 but remain inconsistent. This area needs hands-on validation during Phase 1.

---

### Infrastructure / Hosting

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel | cloud | Next.js hosting | Zero-config deployment for Next.js. Edge functions for low-latency API routes. Preview deployments for every PR. |
| Supabase | cloud | Database, auth, storage, realtime | Fully managed Postgres. Free tier sufficient for POC. Scales with usage. |

**Why not AWS/GCP/Azure for POC:** Operational complexity not justified at POC stage. Vercel + Supabase is the fastest path to a working product.

**Why not Railway/Render:** Valid alternatives to Vercel for non-Next.js backends. Irrelevant here since the stack is Next.js-native.

**Confidence: HIGH** — Vercel + Supabase is the dominant 2025 Next.js SaaS hosting pattern.

---

### Multi-Tenancy Implementation

| Approach | Implementation | Rationale |
|----------|---------------|-----------|
| Row-Level Security (RLS) | Supabase RLS policies on every table using `tenant_id` claim in JWT | Most secure approach — DB enforces isolation, not application code. A bug in application code cannot leak another tenant's data. |
| Tenant ID propagation | `tenant_id` embedded in Supabase JWT on login → available in every RLS policy | Standard Supabase multi-tenancy pattern. |
| Storage isolation | Separate Supabase Storage bucket path prefix per tenant (`/{tenant_id}/...`) + bucket policies | Documents isolated at storage layer. |

**Confidence: HIGH** — Supabase RLS-based multi-tenancy is well-documented and production-proven.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| STT | Deepgram Nova-2 | AssemblyAI Streaming | Both viable. Deepgram has lower latency. |
| STT | Deepgram Nova-2 | Web Speech API | Unreliable on iOS, no server-side access. |
| STT | Deepgram Nova-2 | Whisper (self-hosted) | Batch-oriented, adds 1-3s latency, GPU cost. |
| LLM | GPT-4o | Claude 3.5 Sonnet | Slower TTFT on streaming for real-time use. |
| LLM | GPT-4o | Gemini 1.5 Pro | Weaker function-calling ecosystem. |
| Vector DB | pgvector (in Supabase) | Pinecone | Extra managed service, overkill at POC scale. |
| Framework | Next.js 15 | Remix v2 | Next.js has larger ecosystem, better Vercel integration. |
| Framework | Next.js 15 | SvelteKit | Smaller ecosystem, fewer AI/SaaS libraries target it. |
| Auth | Supabase Auth | Clerk | Both valid. Supabase Auth keeps everything in one platform. |
| Auth | Supabase Auth | NextAuth | More configuration burden; Supabase Auth is simpler. |
| Email | Resend | SendGrid | Worse DX, higher complexity for small volume. |
| Web Search | Tavily | SerpAPI | Tavily is purpose-built for LLM agent use. |

---

## Installation

```bash
# Core framework
npm install next@latest react@latest react-dom@latest typescript@latest

# Styling
npm install tailwindcss@latest postcss autoprefixer
npm install -D @tailwindcss/typography

# Supabase
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs

# AI / LLM
npm install ai openai @langchain/openai @langchain/community langchain

# Deepgram STT
npm install @deepgram/sdk

# Validation
npm install zod

# Document processing
npm install pdf-parse papaparse

# Email
npm install resend @react-email/components

# PWA
npm install next-pwa

# Dev dependencies
npm install -D @types/node @types/react @types/react-dom
npm install -D eslint eslint-config-next prettier
npm install -D @types/pdf-parse @types/papaparse
```

---

## Version Verification Required

Before implementing, verify these versions against current releases:

| Package | Version Used Above | Verify At |
|---------|--------------------|-----------|
| `next` | 15.x | https://github.com/vercel/next.js/releases |
| `@deepgram/sdk` | 3.x | https://github.com/deepgram/deepgram-node-sdk/releases |
| `ai` (Vercel AI SDK) | 3.x | https://github.com/vercel/ai/releases |
| `langchain` | 0.2.x | https://github.com/langchain-ai/langchainjs/releases |
| `@langchain/community` | 0.2.x | npm registry |
| `pgvector` extension | 0.7.x | Supabase dashboard (auto-managed) |
| OpenAI model names | gpt-4o, gpt-4o-mini | https://platform.openai.com/docs/models |
| Deepgram model | nova-2 | https://developers.deepgram.com/docs/models |

---

## Sources

- Training data (knowledge cutoff August 2025) — no live verification was possible in this session
- All recommendations reflect ecosystem state as of mid-2025
- **LOW confidence for any version number** — treat all versions as approximate; verify before use
- **MEDIUM confidence for library choices** — core architectural decisions are unlikely to have changed, but ecosystem has continued evolving
- **HIGH confidence for architecture patterns** — Next.js + Supabase + pgvector + Vercel deployment is a stable, established pattern unlikely to have been disrupted

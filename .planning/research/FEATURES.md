# Feature Landscape

**Domain:** Real-time AI meeting copilot / sales assistant (SaaS, mobile-first)
**Researched:** 2026-03-15
**Confidence note:** MEDIUM — based on training-data knowledge of Gong, Chorus (ZoomInfo), Otter.ai, Fireflies.ai, Avoma, Clari, Salesloft Drift, and similar products as of Aug 2025. External verification tools were unavailable during this session. Claims reflect well-established competitive patterns unlikely to have shifted materially.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or users leave for a competitor.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real-time audio transcription | Core primitive — everything else depends on knowing what was said | High | Needs low-latency streaming STT; phone mic quality is variable; must handle two-speaker ambient capture |
| Question / topic detection from transcript | Users expect the system to act without them manually triggering it | Medium | NLP classification layer on the live transcript stream; can be a simple keyword/intent model initially |
| Surfacing relevant answers as cards | The primary value prop — if this feels slow or wrong, the product fails | High | Requires RAG pipeline over indexed company data with sub-2s end-to-end latency |
| Card stack UI (glanceable, non-disruptive) | Any sales rep who has seen Gong/Clari or even just a good notification system expects a clean, low-distraction surface | Medium | Scroll-up stack pattern (newest at bottom) matches mental model from chat apps |
| Post-meeting summary / transcript | Standard across all competitors; reps expect it as a safety net | Medium | Can be async — meeting is over when this is generated |
| Post-meeting action items | Reps and managers expect extracted to-dos, not just raw text | Medium | LLM extraction pass over transcript |
| Post-meeting follow-up email draft | Increasingly table stakes as of 2024-2025; multiple competitors offer this | Medium | LLM generation from transcript + Q&A log; Dictator makes this a prominent feature |
| Company knowledge base as answer source | Any copilot that can't answer "what's the price of Unit 4B?" from the agency's own data is useless | High | Requires document ingestion pipeline (CSV, PDF), chunking, embedding, vector search |
| Searchable meeting history / transcript archive | Reps expect to find "that conversation with Ahmed" later | Low-Medium | Simple search over stored transcripts per tenant |
| Multi-tenant data isolation | Enterprise buyers won't touch a product without this; each agency's data is theirs alone | High | Must be designed in from day one — retrofitting is very costly |

---

## Differentiators

Features that set this product apart. Not universally expected, but create competitive advantage, especially for the target vertical (estate agency / in-person sales).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Agent-confirmed web lookup | Puts the agent in control mid-meeting — no unexpected AI behaviour during a live client interaction | Low | A "confirm before fire" tap on a suggestion card; simple but meaningfully different from auto-search |
| Web lookup result replaces suggestion card | Seamless in-meeting flow — question answered without leaving the app or breaking the conversation | Medium | Requires a real-time web search integration (Tavily, Bing, Brave Search API) and card update logic |
| Domain-specific vertical focus (estate agency / UAE property) | Generic tools like Gong/Chorus require extensive configuration; a purpose-built vertical tool feels instant-to-value | Medium | Pre-seeded prompts, terminology awareness, UAE property context (freehold zones, RERA regs, DLD) |
| Phone-first in-meeting UX | Competitors mostly target virtual meetings (Zoom/Teams bots); in-person field sales on mobile is underserved | High | Requires careful mobile UX — one-hand use, large tap targets, minimal interaction during conversation |
| CSV/PDF upload as primary data layer | Zero-friction onboarding for SMBs and agencies — no CRM, no API, just upload a spreadsheet | Low-Medium | Standard file upload + parsing pipeline; very low barrier vs. Salesforce integration setup |
| Factual company stats as talking points | "You've sold 47 units above asking price this quarter" surfaces proactively as a credibility card | Medium | Requires structured data extraction from CSV uploads; stats cards are distinct from Q&A answer cards |
| White-label / multi-agency SaaS path | Agencies want their brand on the tool they demo to recruits and managers | Medium | Multi-tenancy + per-tenant branding config; not needed for POC but architecture must allow it |
| Agent reviews email before it sends (never auto-send) | Trust-building: agent feels in control; avoids compliance/liability risk of auto-sent client emails | Low | Deliberate product decision; enforced as a hard constraint — no auto-send path even in v2 |

---

## Anti-Features

Features to explicitly NOT build, especially for the POC. These create scope creep, distract from the core value, or actively harm the product.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Calendar / meeting scheduling integration | Adds OAuth complexity, calendar permission friction, and is not needed when sessions are started manually | Simple manual "start session" button — agent taps when they sit down |
| CRM integration (Salesforce, HubSpot, etc.) | CRM APIs are complex, require per-customer configuration, and are a distraction for a POC | Manual CSV/PDF upload; defer CRM sync to v2 |
| Automated email sending without agent review | Legal, reputational, and trust risk; agents feel disempowered if emails go without their sign-off | Hard-enforce a review step — agent taps Send from within the app |
| Desktop / browser extension interface | The in-person meeting use case is entirely mobile; building a desktop client splits focus and doubles UX work | Phone-first; web app only for admin/data management |
| Manager / team analytics dashboard | Valuable in v2 (Gong's bread and butter) but completely out of scope for a single-agency POC | Ship the agent-facing product; analytics are a retention/upsell feature |
| Automatic bot joining virtual meetings (Zoom/Teams bot) | Different integration surface, different permissions model, different UX paradigm from the phone-in-hand use case | Ambient phone mic capture only for POC |
| Real-time conversation coaching scoring | Complex ML model, requires large training sets, creates awkward UX if shown during live meeting | Post-meeting summary can flag missed topics; no live scoring |
| Sentiment analysis / emotion detection | Accuracy is low, can create liability, and is distracting during a meeting | Not a differentiator at this stage; omit entirely |
| Multi-language real-time translation | High complexity, high latency impact, edge case for Dubai POC (English-primary) | Single language (English) for POC; Arabic support is a v2 consideration |
| Voice commands ("Hey Dictator, search...") | Adds wake-word complexity and is disruptive in a client meeting | Tap-based interaction only |

---

## Feature Dependencies

```
Audio Capture (phone mic)
  └── Real-time Transcription (streaming STT)
        ├── Question / Topic Detection (NLP classifier)
        │     ├── Company Data RAG Query → Answer Card
        │     │     └── Card Stack UI (glanceable display)
        │     └── Web Lookup Suggestion Card
        │           └── Agent Confirm → Web Search → Result Card
        │                 └── Card Stack UI (glanceable display)
        └── Transcript Accumulation
              ├── Post-meeting Summary (LLM)
              ├── Action Item Extraction (LLM)
              └── Follow-up Email Draft (LLM)
                    └── In-app Email Review + Send

Company Data Pipeline (separate, async):
  CSV / PDF Upload → Parse → Chunk → Embed → Vector Store
    └── Feeds: Company Data RAG Query

Multi-tenancy:
  Tenant isolation wraps ALL data layers (vector store, transcripts, uploads, user accounts)
```

---

## MVP Recommendation

Prioritize for POC (in order of dependency):

1. **Audio capture + streaming transcription** — the foundation; nothing else works without it
2. **Company data ingestion pipeline** (CSV/PDF upload → vector store) — needed before RAG answers can surface
3. **Question detection + RAG answer cards** — core value delivery; this is what the demo lives or dies on
4. **Card stack UI** — the glanceable mobile interface; must feel effortless to use in a live meeting
5. **Agent-confirmed web lookup** — extends coverage beyond company data; differentiator that is low-complexity to add once RAG is working
6. **Post-meeting email draft** — second major value prop; add after live-meeting flow is validated

Defer:

- **Meeting history / archive search** — useful but not required for POC validation; add after core loop works
- **Factual stats cards** (CSV-driven talking points) — valuable differentiator but add after basic Q&A RAG is stable
- **White-label branding** — multi-tenancy architecture yes; per-tenant branding config deferred
- **Manager analytics** — v2
- **Arabic / multi-language** — v2

---

## Competitive Positioning Notes

**Gong / Chorus (ZoomInfo):** Enterprise-grade conversation intelligence. Post-meeting focused. Require CRM integration and virtual meeting bots. No real-time answer surfacing for field agents. No mobile-first in-person meeting UX. Price point ($1,000s/year/seat) blocks SMB/agency market.

**Otter.ai / Fireflies.ai:** Strong transcription + summary. Meeting recorder positioning, not sales copilot. No real-time answer surfacing from private knowledge bases. No agent-facing cards UI. Good post-meeting summaries but generic.

**Avoma:** Closest feature set — combines note-taking, CRM sync, coaching. Still virtual-meeting-first (Zoom bot). No real-time answer card surface. SMB-friendly pricing but not vertical-specific.

**Clari / Salesloft:** Pipeline/forecast tools with conversation intelligence as secondary feature. Very enterprise, very CRM-centric.

**Gap Dictator fills:** Phone-first, in-person, ambient-audio sales copilot that surfaces proprietary company knowledge in real time during the meeting — not after it. No competitor in this specific intersection (mobile-first + in-person + RAG-from-private-knowledge + real-time cards).

---

## Sources

- Training-data knowledge of Gong, Chorus, Otter.ai, Fireflies.ai, Avoma, Clari product feature sets (MEDIUM confidence — Aug 2025 cutoff)
- PROJECT.md requirements and constraints (HIGH confidence — authoritative spec)
- External verification tools (WebSearch, WebFetch, Brave Search) were unavailable during this research session — all competitive claims should be spot-checked against current product pages before finalising roadmap priorities

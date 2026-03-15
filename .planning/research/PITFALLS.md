# Domain Pitfalls

**Domain:** Real-time AI meeting copilot / sales assistant SaaS (mobile-first)
**Project:** Dictator — AI sales copilot for estate agency meetings
**Researched:** 2026-03-15
**Confidence note:** All findings from training data (cutoff August 2025). No external sources accessible during this research session. Critical claims flagged with confidence levels.

---

## Critical Pitfalls

Mistakes that cause rewrites or non-functional demos.

---

### Pitfall 1: iOS Safari Kills Microphone Access When App Moves to Background

**What goes wrong:** On iOS, `getUserMedia()` microphone streams are automatically paused/killed when the browser tab loses focus or the phone screen locks. A user who glances at another app, receives a call, or lets the screen time out will silently lose all audio — with no error thrown in the JS context, and no recovery without the user re-granting the permission flow.

**Why it happens:** iOS enforces a strict "active foreground tab" requirement for media capture. This is a WebKit platform decision enforced at the OS level, not a bug. Safari on iOS does not support background audio capture for web apps. PWA mode (Add to Home Screen) does not lift this restriction — it still runs in a WebKit web view with the same constraints.

**Consequences:** The meeting session silently drops mid-conversation. The agent doesn't notice because the UI may still appear "running." Transcription stops, no cards surface, the post-meeting email is incomplete. The agent looks incompetent in front of the client.

**Prevention:**
- Use React Native (or a React Native WebView hybrid) instead of a pure PWA. Native apps can hold an AVAudioSession with `AVAudioSessionCategoryPlayAndRecord` + `mixWithOthers` option, which survives background transitions on iOS.
- If web-only is required for the POC, display a persistent prominent warning when the app detects `document.visibilityState === 'hidden'` or `blur` events, and auto-pause + prompt to resume.
- Implement a heartbeat from the audio stream; if the last audio chunk was more than N seconds ago during an active session, surface a "mic paused" banner immediately.
- Test explicitly: screen lock, incoming call, swipe to home, switch to Messages and back.

**Detection (warning signs):**
- Audio chunk timestamps stop advancing while session timer continues
- Transcription service stops receiving bytes but WebSocket remains open
- Zero cards surface for > 60 seconds during what should be active conversation

**Phase:** Audio capture / session lifecycle phase. Must be resolved before any demo.

**Confidence:** HIGH — This is a well-documented WebKit/iOS platform constraint that has been consistent since iOS 13+.

---

### Pitfall 2: Transcription Latency Budget Is Consumed Before the LLM Even Starts

**What goes wrong:** Teams optimise the transcription layer in isolation and are surprised when end-to-end latency (audio spoken → card surfaced) still exceeds 6–8 seconds. The budget is: audio buffering + streaming ASR processing + question detection + embedding lookup + LLM generation + network round trips. Each step is reasonable alone; combined, they stack.

**Why it happens:** Streaming ASR services like Deepgram Nova-2 or AssemblyAI Streaming return "interim" transcripts every ~300ms but only commit "final" transcripts after silence detection or sentence-end heuristics — typically 1–3 seconds of additional delay. If the pipeline waits for final transcripts before running question detection, the effective input latency is already 2–4 seconds before the RAG query even starts.

**Consequences:** Cards surface after the conversation has moved on. The answer to "What's the price on unit 4B?" appears 12 seconds later, when the client is asking about parking. The agent either ignores the card (waste) or awkwardly reintroduces a topic the conversation has left (disruption).

**Prevention:**
- Run question detection on rolling interim transcripts, not just finals. Accept false positives at this stage — filter downstream.
- Use a two-stage pipeline: fast heuristic question detection (regex + small classifier) triggers a speculative RAG prefetch on interim text; LLM generation waits for the final transcript to confirm and refine.
- Target a hard end-to-end budget of <= 3 seconds from last spoken word to card appearance. Measure each stage independently in load testing.
- Choose a streaming ASR provider that exposes per-word confidence and utterance segmentation (Deepgram does; Whisper batch does not — avoid batch Whisper for real-time).
- Stream LLM tokens directly into the card rather than waiting for the full response.

**Detection (warning signs):**
- Latency spikes during long utterances (ASR holds the final transcript longer)
- Cards appearing after the next speaker has already started talking
- Profiling shows > 1.5s in the "waiting for final transcript" stage

**Phase:** Transcription + real-time pipeline phase.

**Confidence:** HIGH — Based on known behavior of streaming ASR systems and LLM generation times. Specific numbers (300ms, 1–3s) are consistent with Deepgram and AssemblyAI public documentation as of mid-2025.

---

### Pitfall 3: Question Detection Has Too Many False Positives — Cards Spam the Agent

**What goes wrong:** Any sentence with rising intonation, or containing words like "what," "how," "when," "could you," or "do you" gets flagged as a question. In a normal sales conversation, roughly 30–40% of sentences contain question-like syntax without being information-seeking questions that need a retrieval card. The agent's screen fills with irrelevant cards, they stop looking at it within 5 minutes.

**Why it happens:** Simple regex/keyword approaches have no conversational context. "What a beautiful view" triggers "what." "Could you imagine living here" triggers. The agent's own statements ("What we've found is…") trigger. Rhetorical questions trigger. Small talk triggers.

**Consequences:** Card stack becomes noise. Agent disengages from the tool entirely. The single most important UX failure mode for this product.

**Prevention:**
- Use a small, fast classifier (not the main LLM) specifically trained to distinguish information-seeking questions from other sentence types. A fine-tuned BERT-class model or a few-shot GPT-3.5-turbo prompt can do this cheaply per utterance.
- Classify speaker identity: the agent's own questions should not trigger retrieval (they know their own answers). Only client questions trigger cards. This requires diarization or a push-to-talk mode where the agent marks when the client is speaking.
- Gate on semantic novelty: if a similar question was answered in the last 5 minutes, suppress the duplicate retrieval.
- Implement a confidence threshold — only surface a card if the classifier score exceeds 0.75. Tune this threshold empirically on real conversation transcripts.
- Add a "thumbs down" on each card so agents can train the classifier over time (future).

**Detection (warning signs):**
- More than 2–3 cards per minute during normal conversation
- Agents reporting "too many notifications"
- High card generation rate against a passive transcript with no real questions

**Phase:** Question detection / NLP pipeline phase. Requires real conversation samples for tuning.

**Confidence:** MEDIUM — Based on known failure modes of intent classification applied to conversational speech. Specific thresholds (0.75, 2–3 cards/min) are heuristics, not validated numbers.

---

### Pitfall 4: RAG Returns the Right Document but the Wrong Passage — Hallucinated Confidence

**What goes wrong:** Embedding-based similarity retrieval finds the correct PDF (e.g., a property brochure for Marina Heights) but returns the wrong chunk — perhaps the page header, a table of contents entry, or a price from a different unit listed nearby. The LLM synthesises a confident answer from the wrong passage. The agent reads it to the client. The client corrects them.

**Why it happens:** Fixed-size text chunking (e.g., every 500 tokens) splits tables, price lists, and structured data mid-entry. A row in a CSV becomes two chunks with broken context. Embedding similarity finds "Marina Heights" correctly but retrieves the chunk about a different floor. The LLM doesn't know the chunk is wrong — it generates fluently from whatever it receives.

**Consequences:** The agent gives incorrect pricing or availability information to a live client. This is worse than not answering — it actively damages trust and could have legal implications in a property sales context (misrepresentation).

**Prevention:**
- Use structured extraction for CSV data, not embedding it as text. Store property listings as records in a database with direct SQL/filter lookup for factual fields (price, availability, sqft). Reserve RAG for unstructured documents (PDFs, brochures).
- For PDFs: use semantic chunking (split on headings, sections, table boundaries) rather than fixed token counts. Libraries like `unstructured` or LlamaIndex node parsers support this.
- Include source metadata on every card: which document, which page/section, when it was last updated. This lets agents quickly verify before stating facts.
- Add a retrieval confidence gate: if the top-k similarity scores are all below a threshold, surface "I couldn't find a confident answer" rather than generating from a weak match.
- Separate fact-retrieval (listings DB) from knowledge-retrieval (RAG over PDFs) at the pipeline level.

**Detection (warning signs):**
- Cards cite the wrong property name but correct property type
- Price on card doesn't match any listing in the uploaded CSV
- Multiple different answers surface for the same question asked twice

**Phase:** Data ingestion + RAG pipeline phase.

**Confidence:** HIGH — Chunking-induced RAG failure is one of the most extensively documented production RAG problems as of 2025.

---

### Pitfall 5: Multi-Tenant Data Leakage via Shared Vector Index

**What goes wrong:** All tenants' document embeddings are stored in the same vector index (e.g., a single Pinecone namespace or Chroma collection). A missing or incorrect `tenant_id` filter on a query causes one agency's documents to be retrieved in another agency's session.

**Why it happens:** Metadata filtering in vector databases is applied at query time as a post-filter or pre-filter, depending on the implementation. If the filter is omitted (e.g., a developer forgets to pass it, or a code path is reached unexpectedly), the query hits the full index. Vector database query APIs rarely enforce mandatory filters — they silently return results from all namespaces.

**Consequences:** Agency A sees Agency B's proprietary listing data, pricing strategies, or client-facing materials. In UAE property law contexts, this could constitute a data protection breach. Even at POC stage, a single-agency demo is unlikely to catch this, but it's catastrophic at scale. Regulators, including RERA (Dubai's Real Estate Regulatory Agency), take data protection seriously.

**Prevention:**
- Use namespace-per-tenant isolation in the vector store (Pinecone namespaces, Qdrant collections per tenant, or Weaviate multi-tenancy). This is a hard architectural boundary, not a soft filter.
- Never rely solely on metadata filter at query time for security — use tenant-scoped collections as the primary guard.
- In the application layer, resolve tenant context from the authenticated session at the start of every request and pass it explicitly through the entire call chain. Never derive tenant context from request body data that the client supplies.
- Add integration tests specifically for cross-tenant query scenarios. Test: does a query with Tenant A's session ever return Tenant B's documents?
- Audit logs for every retrieval: log tenant_id + document_id + query hash. Anomalies (e.g., unusually high volume from one tenant hitting docs of another) are detectable.

**Detection (warning signs):**
- Cards surface documents with a different agency's branding or property names
- Vector query response times vary wildly between tenants (shared index contention)
- A test query with a deliberately incorrect tenant_id still returns results

**Phase:** Multi-tenancy / infrastructure phase. Must be correct from the first upload of real client data.

**Confidence:** HIGH — Vector store cross-tenant leakage is a documented production risk pattern. Namespace-per-tenant is the accepted mitigation.

---

### Pitfall 6: LLM Response Latency Breaks the Real-Time Illusion

**What goes wrong:** GPT-4o or Claude Sonnet takes 3–8 seconds to return a complete response for a typical RAG-synthesised answer. In a live meeting context, this means cards appear long after the moment has passed. Teams discover this only when testing against real conversation pace (fast exchanges, not slow monologues).

**Why it happens:** LLM generation latency is a function of output token count. A 200-token answer at ~50 tokens/second streaming takes 4 seconds to complete. Non-streaming adds the full generation time before the first byte arrives. Cold start latency on serverless deployments can add 1–3 seconds on top.

**Consequences:** The latency budget explained in Pitfall 2 is breached. Even if transcription is fast, the LLM is the bottleneck. The product feels broken even when everything else works.

**Prevention:**
- Stream LLM tokens directly to the card — the card appears with the first token (typically < 500ms) and fills in progressively. This makes the product feel instant even if full generation takes 3–4 seconds.
- Use the smallest model that produces acceptable quality for retrieval synthesis (GPT-4o-mini or Claude Haiku are often sufficient for "summarise this retrieved passage in 2 sentences"). Reserve the larger model for post-meeting email generation where latency doesn't matter.
- Pre-warm: Keep a persistent server-side connection to the LLM provider. Avoid cold serverless function starts on the hot path.
- Cap answer length with a system prompt instruction ("Answer in 2 sentences maximum") — shorter output = lower latency.
- Cache: if the same question (semantically similar embedding) was answered in the last session, serve the cached response immediately while triggering a background refresh.

**Detection (warning signs):**
- p95 time-to-first-token > 1.5 seconds
- Complete card render time > 4 seconds from question detection
- Streaming disabled (all responses arriving as complete JSON blobs)

**Phase:** LLM integration / real-time pipeline phase.

**Confidence:** HIGH — Streaming LLM response is a well-established pattern. Token generation rates are consistent with published provider benchmarks as of mid-2025.

---

## Moderate Pitfalls

---

### Pitfall 7: Web Search Rate Limiting Breaks Agent-Confirmed Lookups Mid-Meeting

**What goes wrong:** The agent taps "confirm" on a web lookup card mid-meeting. The search API returns a 429 (rate limit) or 503. The card switches to an error state. The agent is now stuck with no answer and a visible app failure in front of the client.

**Why it happens:** Web search APIs (SerpAPI, Brave Search, Google Custom Search) have per-minute and per-day rate limits on standard tiers. A burst of lookups (multiple agents in the same agency all confirming lookups simultaneously) can exhaust the per-minute limit. Serverless cold starts can cause thundering-herd bursts that exceed rate limits even at low usage.

**Prevention:**
- Implement exponential backoff with a fast first retry (100ms). Show the card as "searching..." rather than "failed" during retry.
- Queue web lookup requests per tenant with a rate-limit-aware queue (token bucket). If the queue is full, defer gracefully: "Web lookup queued — result coming shortly."
- Maintain a 24-hour cache of web search results keyed by normalised query. Real estate market data questions asked repeatedly by different agents hit the cache.
- Have a fallback search provider. Primary: Brave Search API. Fallback: SerpAPI or Google Custom Search. Toggle on provider error.
- Track search API costs and usage in the admin dashboard. Unexpected spikes are detectable before they become critical.

**Detection (warning signs):**
- Search cards failing during peak hours (9–11am, 2–4pm meeting windows)
- `429` responses in API logs
- All web lookups failing for one tenant while working for others (tenant-specific burst)

**Phase:** Web search integration phase.

**Confidence:** MEDIUM — Rate limiting is universal across search APIs. Specific tier limits vary by provider and change with pricing updates.

---

### Pitfall 8: Audio Quality Degrades Transcription to Useless Noise

**What goes wrong:** In a real estate office or client site (open plan, HVAC noise, multiple people talking, phone held in a bag or on a table), transcription accuracy drops from 95%+ (clean studio audio) to 60–70%. Words are misheard. Property names ("Dubai Hills" → "Dubai Hells"), numbers ("AED 2.3 million" → "AED 23 million"), and names are systematically wrong.

**Why it happens:** Modern ASR models (Deepgram Nova-2, Whisper large-v3) perform excellently in clean conditions but degrade with: ambient noise, microphone distance, competing voices, non-native English accents (highly relevant in Dubai: Arabic, Indian, Russian, British), and phone-held-face-down placement. The models are trained primarily on clean or headset audio.

**Consequences:** Question detection fires on misheard sentences. RAG queries contain garbled text and retrieve nothing. The agent cannot trust the transcript. Post-meeting email contains embarrassing errors.

**Prevention:**
- Apply a client-side noise suppression layer before streaming to ASR. The WebAudio API's `noiseSuppression` MediaTrackConstraint is free and reduces ambient noise significantly. Libraries like `RNNoise` (open source) can be loaded as a WebAssembly module for more aggressive suppression.
- Choose an ASR provider with strong accent model support. Deepgram allows custom vocabulary/boosting — add property-specific terminology, brand names, and UAE place names as boosted terms.
- Add a speaker vocabulary: names of common properties, developers, and regulatory bodies in the Dubai context should be in a custom vocabulary list.
- In the UI, show the live transcript to the agent (small, scrolling). They can spot gross errors. This also builds trust in the system.
- For the POC, test with actual agents in the actual meeting environment before the first client demo.

**Detection (warning signs):**
- Word error rate > 20% on test recordings in the target environment
- Property names consistently misheard in transcription output
- Cards triggering for clearly mis-transcribed gibberish

**Phase:** Audio capture + transcription phase. Requires real-environment testing, not just clean-audio unit tests.

**Confidence:** MEDIUM-HIGH — Noise impact on ASR quality is well-documented. Dubai-specific accent challenges are domain knowledge.

---

### Pitfall 9: Card UX Interrupts Agent Concentration at the Wrong Moment

**What goes wrong:** A card pops up while the agent is mid-sentence answering a different question, or while maintaining eye contact during a trust-critical moment. The agent glances at their phone. The client notices. The flow breaks. The agent looks distracted.

**Why it happens:** The system surfaces cards the moment they are ready, regardless of conversational context. The agent has no way to tell the system "I'm busy right now."

**Consequences:** The tool that is meant to empower the agent actually undermines their credibility. Worse, the agent starts pre-emptively holding their phone and glancing, signalling insecurity.

**Prevention:**
- Cards should be silently queued when there are already unread cards on screen. Do not animate-in a new card while the agent is presumably reading an existing one. Batch delivery at natural pauses.
- Use a subtle haptic pulse (single tap) as a "new card available" notification rather than a visual flash. The agent can feel it without looking.
- Provide a "pause cards" mode — a single long-press or hardware volume button triggers a 60-second hold on new card delivery. Queued cards arrive when unpaused.
- In the card stack design: new cards at the bottom (as specified in the project), so the top of the stack is the stable reference point. The agent can choose when to scroll.
- Do not animate cards with large motion. A card sliding in from the bottom is fine; a flash or bounce is not. Respect `prefers-reduced-motion`.

**Detection (warning signs):**
- Agent feedback: "I couldn't answer because I was distracted by a card appearing"
- In user testing, agents look at phone more than 3 times per minute on average
- Cards appearing during agent speech (agent is talking, not listening)

**Phase:** Card UX / front-end phase.

**Confidence:** MEDIUM — This is UX judgment grounded in meeting dynamics and mobile notification design principles.

---

### Pitfall 10: Embedding Model Version Drift Breaks RAG After a Deployment

**What goes wrong:** Documents are indexed using `text-embedding-3-small` v1 at launch. Six months later, the team upgrades to `text-embedding-3-large` or a different provider for cost/quality reasons. Existing embeddings in the vector store are incompatible with the new query embeddings. Retrieval silently returns wrong or no results.

**Why it happens:** Embedding vectors are only comparable to other vectors from the same model and same version. Mixing embeddings from different models produces meaningless cosine similarity scores without raising any error.

**Prevention:**
- Store the embedding model name and version alongside every vector in the metadata (e.g., `embedding_model: "text-embedding-3-small"`, `embedding_model_version: "2024-02-01"`).
- On any embedding model change, re-index all tenant documents. Build this as a background job, not a manual process.
- Never mix embeddings from different models in the same query flow. Add an assertion at the retrieval layer: if the query embedding model != the stored document embedding model, raise an error rather than returning garbage results.
- Pin the embedding model version in environment config. Do not silently upgrade via API SDK updates.

**Detection (warning signs):**
- RAG retrieval quality degrades suddenly after a dependency update
- Cards that used to be accurate start returning generic or wrong content
- Embedding dimension mismatch errors in vector store logs

**Phase:** Data ingestion + RAG pipeline phase; also relevant during any maintenance/upgrade phase.

**Confidence:** HIGH — Embedding model version incompatibility is a documented production incident pattern.

---

## Minor Pitfalls

---

### Pitfall 11: WebSocket Connection Drops Kill Long-Running Sessions Without Recovery

**What goes wrong:** A 45-minute meeting session loses its WebSocket connection (carrier network switch, brief signal drop, hotel WiFi timeout). The session terminates. The transcript is lost. The agent has no card history and no post-meeting email.

**Prevention:**
- Implement automatic WebSocket reconnection with exponential backoff. Resume the session using a server-side session token — don't require a fresh start.
- Buffer the last N seconds of audio client-side in a circular buffer. On reconnection, replay the buffer to fill the gap.
- Persist transcript chunks to the server as they arrive (not just at session end). The post-meeting email can be generated from partial transcripts.
- Show a "reconnecting..." banner — do not silently drop; do not alarm the agent. The banner disappears when reconnected.

**Phase:** Real-time session infrastructure.

**Confidence:** HIGH — WebSocket reconnection handling is standard practice; specific to long-session reliability.

---

### Pitfall 12: Post-Meeting Email Draft Is Generated Before Transcript Is Fully Processed

**What goes wrong:** Agent ends the session. App immediately shows "generating email." The email draft contains only the first 60% of the conversation because the final transcript chunks haven't been processed and committed to storage yet. The agent sends a draft that's missing the last 15 minutes.

**Prevention:**
- Distinguish between "session ended" (agent tapped end) and "transcript complete" (all in-flight ASR responses received and committed). Show a loading state while the transcript finalises.
- Add a brief buffer (5–10 seconds) after session end before triggering email generation, to allow all in-flight ASR chunks to arrive.
- Include a word/time coverage indicator in the email draft: "Generated from X minutes of transcript."

**Phase:** Post-meeting email phase.

**Confidence:** MEDIUM — Async processing race condition at session end is a common oversight.

---

### Pitfall 13: Admin Document Upload Doesn't Validate File Content — Garbage In, Garbage Out

**What goes wrong:** An admin uploads a scanned PDF (image-only, no text layer) or a CSV with inconsistent column headers. The ingestion pipeline processes it silently. The vector store contains embeddings of meaningless content. Agents get confident-looking cards with wrong or empty answers.

**Prevention:**
- Validate file type and content at upload: for PDFs, check for text extraction yield. If < 100 words extracted, flag as "possibly scanned — may need OCR."
- For CSV files, parse headers and show a preview table in the admin UI. Require confirmation of column mapping before indexing.
- Run a post-ingestion sanity check: issue 3 test queries against newly indexed documents and show the top result in the admin UI. "Is this the kind of answer you expect to see?"
- Show a document status page: documents in "indexed" vs "failed" vs "low quality" states.

**Phase:** Admin data ingestion phase.

**Confidence:** MEDIUM — Data quality validation is a known gap in most first-pass RAG ingestion pipelines.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Audio capture on mobile | iOS background mic termination (Pitfall 1) | Use React Native for iOS audio session management |
| Real-time transcription | Latency budget exceeded before LLM fires (Pitfall 2) | Two-stage pipeline with speculative prefetch on interim transcripts |
| Question/intent detection | False positive flood destroys UX (Pitfall 3) | Fast lightweight classifier + speaker diarization |
| RAG over property data | Wrong chunk returned, wrong price stated (Pitfall 4) | Structured DB for factual fields; RAG only for unstructured text |
| Multi-tenant data layer | Cross-tenant vector retrieval (Pitfall 5) | Namespace-per-tenant; never filter-only isolation |
| LLM integration | Latency exceeds meeting conversation pace (Pitfall 6) | Streaming tokens; smallest acceptable model; short output cap |
| Web search integration | Rate limit breaks mid-meeting lookup (Pitfall 7) | Fallback provider; 24-hour result cache; queue with backoff |
| Environment testing | Clean audio tests pass; real office fails (Pitfall 8) | Test on-site before first POC demo |
| Card UX design | New card interrupts agent mid-sentence (Pitfall 9) | Haptic notification; pause mode; animation-free delivery |
| Document ingestion | Embedding model upgrade breaks all retrieval (Pitfall 10) | Pin model version; store model metadata with vectors |
| Session infrastructure | Network drop terminates 45-min session (Pitfall 11) | Reconnect + replay buffer; persist transcript incrementally |
| Post-meeting email | Draft generated from incomplete transcript (Pitfall 12) | Wait for transcript commit before triggering generation |
| Admin upload | Scanned PDF or bad CSV silently ingested (Pitfall 13) | Content validation + post-index preview in admin UI |

---

## Sources

All findings are from training data (cutoff August 2025). No external sources were accessible during this research session due to tool permission restrictions.

**Confidence summary:**
- Pitfalls 1, 2, 4, 5, 6, 10, 11: HIGH — Well-documented platform constraints and production patterns
- Pitfalls 3, 7, 8, 9, 12, 13: MEDIUM — Domain reasoning and community patterns; specific thresholds require empirical validation

**Recommended verification (when tool access is available):**
- Deepgram streaming documentation for current latency SLAs and Nova-2 accuracy benchmarks
- Apple WebKit bug tracker / MDN for current iOS `getUserMedia` background behaviour (may have changed post-iOS 17)
- Pinecone/Qdrant/Weaviate multi-tenancy documentation for current namespace isolation guarantees
- OpenAI / Anthropic latency benchmarks for mini/haiku model streaming performance

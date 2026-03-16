---
plan: 03-02
phase: 03-intelligence-cards
status: complete
wave: 2
---

# Plan 03-02 Summary — Intent Classification

## Completed
- `src/lib/intelligence/classify-intent.ts` — `classifyIntent(recentChunks, existingTopicKeys)` using Claude Haiku 4.5 structured outputs
- `IntentSchema` Zod object exported (mirrors `IntentResult` interface, snake_case)
- System prompt: Dubai estate agent context, detects client property/stats questions, ignores pleasantries/agent self-talk
- `existingTopicKeys` appended to user message for LLM-level soft deduplication
- Every call logs `is_question`, `topic_key`, `retrieval_type`, `reason` to console (Vercel logs)
- `max_tokens: 256` — latency budget for real-time use

## Decisions
- `zodOutputFormat(IntentSchema)` — 1 argument (installed SDK version does not accept name parameter)
- Constructor mock pattern: `vi.fn(function(this) { return {...} })` required — arrow functions cannot be used as constructors in Vitest mocks

## Tests
- 8 tests pass (all GREEN)
- Mock pattern: `vi.hoisted()` + regular function constructor mock for `@anthropic-ai/sdk`

## Key Files
- `src/lib/intelligence/classify-intent.ts`
- `src/lib/intelligence/__tests__/classify-intent.test.ts`

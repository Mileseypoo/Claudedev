---
plan: 03-06
phase: 03-intelligence-cards
status: complete
wave: 4
---

# Plan 03-06 Summary — Summary Q&A Section

## Completed
- `src/app/api/session/cards/route.ts` — GET `/api/session/cards?sessionId=UUID`; returns `{ cards: AnswerCard[] }` ordered by `fired_at ASC`; 400 on invalid UUID
- `src/app/(session)/summary/components/QASection.tsx` — renders all session cards in full expanded format; cardType label, questionText, fullAnswer, source link; empty state handled
- `src/app/(session)/summary/page.tsx` — parallel `useEffect` fetches cards; `<QASection cards={cards} />` added below transcript div above Start New Session button
- `src/app/(session)/summary/components/QASection.test.tsx` — 7 `it.todo()` stubs

## Key Files
- `src/app/api/session/cards/route.ts`
- `src/app/(session)/summary/components/QASection.tsx`
- `src/app/(session)/summary/page.tsx`

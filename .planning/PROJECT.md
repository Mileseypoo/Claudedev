# Dictator

## What This Is

An AI-powered live sales copilot for use during client meetings. The agent starts a session on their phone, the app listens to the conversation, and intelligently surfaces relevant answers as a stack of unobtrusive cards — drawing from the company's own data and, when needed, the web. After the meeting, the agent gets a draft follow-up email to review and send. Built as a SaaS platform, initially targeting a Dubai estate agency as the POC, with a path to becoming a white-label tool for any sales team.

## Core Value

The agent always has the right answer at the right moment — without breaking the flow of conversation.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Agent can start a live session on their phone that listens to meeting audio
- [ ] App transcribes conversation in real-time and detects questions/topics
- [ ] Relevant answers surface as cards on the agent's phone screen (WhatsApp-style stack, newest at bottom)
- [ ] Cards are expandable with concise detail; full source opens in browser
- [ ] Company data (CSV, PDF uploads) is indexed and queried for answers
- [ ] Company stats (listings sold today/this week, % above target, etc.) surface as factual talking points
- [ ] Questions outside company data trigger a web lookup suggestion; agent confirms before it fires
- [ ] Web lookup result replaces the suggestion card with a short summary
- [ ] After the meeting ends, agent sees a draft follow-up email (summary, Q&A, relevant links)
- [ ] Agent reviews and sends the email from within the app
- [ ] Multi-tenant SaaS architecture — each agency has isolated data
- [ ] Admin data management (uploads, agent accounts) — scope TBD for POC

### Out of Scope

- Calendar integration — deferred, not required for POC
- CRM/API integration — v2; POC uses manual upload only
- Desktop/laptop interface — phone-first for in-meeting use
- Automated email sending without agent review — agent always confirms

## Context

- **POC customer**: A Dubai estate agency. Real-world context includes property listings, price ranges, UAE-specific property law questions (e.g. foreign buyer regulations), and market performance stats.
- **Meeting format**: Agent + client(s), typically in-person. Agent holds/glances at phone. Client is aware recording is happening (permission granted).
- **Data upload for POC**: Admin or agent uploads CSV files (listings, stats) and PDFs (brochures, regulatory docs). These are indexed for semantic search.
- **Web lookup**: For questions the company data can't answer. Agent taps "confirm" before lookup fires — keeps agent in control, avoids unexpected behaviour mid-meeting.
- **Card UX**: Cards stack upward like a WhatsApp conversation. Each card is a short, glanceable answer. Tap to expand. Tap link to open source in browser. Old cards scroll off the top.
- **Post-meeting email**: Generated from transcript + Q&A log. Agent reviews in-app, edits if needed, sends. Not auto-sent.
- **SaaS path**: Architecture must support multiple agencies from day one (multi-tenant), even if POC is single-agency.

## Constraints

- **Platform**: Mobile-first (phone) for the in-meeting experience; web app for admin/setup
- **POC scope**: Single agency, manual data upload — no CRM integration required
- **Audio**: Real-time transcription required; must work on a phone mic in a typical office environment
- **Discretion**: UI must be glanceable and non-distracting; agent should not appear to be on their phone constantly
- **Data isolation**: Each agency's data must be strictly isolated (SaaS multi-tenancy)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Phone-first UX (not laptop) | Most natural in a meeting — agent can hold phone or glance at desk | — Pending |
| WhatsApp-style card stack | Familiar pattern, easy to scan, naturally handles multiple concurrent suggestions | — Pending |
| Agent confirms web lookup before it fires | Keeps agent in control mid-meeting; avoids unexpected interruptions | — Pending |
| Manual upload for POC data layer | Fastest path to demo; CRM integration is a v2 concern | — Pending |
| Multi-tenant from day one | SaaS architecture is the end goal; easier to build in than retrofit | — Pending |

---
*Last updated: 2026-03-15 after initialization*

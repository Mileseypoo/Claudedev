# Requirements: Dictator

**Defined:** 2026-03-15
**Core Value:** The agent always has the right answer at the right moment — without breaking the flow of conversation.

## v1 Requirements

Requirements for the POC release (single Dubai estate agency, manual data upload).

### Session Management

- [ ] **SESS-01**: Agent can start a live session with a single tap
- [ ] **SESS-02**: Agent can stop/end a session with a single tap
- [ ] **SESS-03**: App displays a clear visual indicator when recording is active
- [ ] **SESS-04**: App requests and handles microphone permission gracefully
- [ ] **SESS-05**: Agent can pause and resume a session mid-meeting
- [x] **SESS-06**: Session transcript and Q&A log auto-saves if app is closed or crashes

### Answer Cards

- [ ] **CARD-01**: Answers surface as cards that stack upward (newest at bottom, older cards scroll off top)
- [ ] **CARD-02**: Each card shows a short, glanceable answer (one to two sentences)
- [ ] **CARD-03**: Agent can tap a card to expand it for slightly more detail
- [ ] **CARD-04**: Card includes a link that opens the source in the browser (company website, PDF, or web result)
- [ ] **CARD-05**: Agent can dismiss individual cards by swiping them away

### Company Data & Intelligence

- [ ] **DATA-01**: Admin can upload CSV files (property listings, performance stats)
- [ ] **DATA-02**: Admin can upload PDF files (brochures, regulatory documents)
- [ ] **DATA-03**: Admin can manage uploads via a simple web portal (view, delete, re-upload)
- [ ] **DATA-04**: Uploaded data is indexed and queryable within minutes of upload
- [ ] **DATA-05**: Stats and talking points surface proactively as cards (e.g. "3 properties sold today", "10% above target")
- [ ] **DATA-06**: Structured listing data (prices, availability) is queried from SQL, not RAG

### Question Detection & Answering

- [ ] **INTEL-01**: App detects questions and relevant topics from the live transcript
- [ ] **INTEL-02**: App retrieves relevant answers from company data and surfaces them as cards
- [ ] **INTEL-03**: Question detection does not flood the agent with cards (max 2-3 per minute under normal conversation)

### Web Lookup

- [ ] **WEB-01**: When company data cannot answer a question, app surfaces a "Search web?" suggestion card
- [ ] **WEB-02**: Web search only fires after agent taps to confirm (never automatic)
- [ ] **WEB-03**: Web search result replaces the suggestion card with a short summary and source link

### Post-Meeting

- [ ] **POST-01**: After session ends, app generates a draft follow-up email (meeting summary, key Q&A, relevant links)
- [ ] **POST-02**: Agent can review and edit the draft email within the app before sending
- [ ] **POST-03**: Agent can send the email directly from the app
- [ ] **POST-04**: Agent can view the full session transcript after the meeting ends

### Platform

- [x] **PLAT-01**: App works as a mobile-first web application on iOS and Android phones
- [x] **PLAT-02**: POC operates as a single-tenant deployment (one agency, no login required for v1)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Authentication & Multi-Tenancy

- **AUTH-01**: Agent can log in with email and password
- **AUTH-02**: Each agency's data is fully isolated from other agencies (multi-tenant)
- **AUTH-03**: Agency admin can manage agent accounts and data uploads

### CRM & Integrations

- **INTG-01**: Company data syncs from CRM via API (no manual upload needed)
- **INTG-02**: Post-meeting summary can be pushed to CRM
- **INTG-03**: Follow-up meeting can be scheduled to agent's calendar from within the app

### Advanced Features

- **ADV-01**: Arabic speech-to-text support for UAE mixed-language meetings
- **ADV-02**: Custom vocabulary boosting (property developer names, RERA, DLD terminology)
- **ADV-03**: Manager analytics dashboard (sessions, card usage, agent performance)
- **ADV-04**: White-label branding per agency (logo, colours)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Calendar integration | Explicitly deferred — not required for POC |
| Auto-send email without agent review | Agent must always confirm before sending |
| CRM/API integration | v2 — POC uses manual upload only |
| Desktop/laptop interface | Phone-first; browser admin portal covers non-meeting use |
| Native mobile app (non-PWA) | PWA first for POC speed; revisit if iOS audio proves problematic |
| Manager/admin analytics | Post-POC — validate agent value first |
| Multi-language STT | English-first for POC; Arabic in v2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SESS-01 – SESS-05 | Phase 1: Foundation | Pending |
| SESS-06 | Phase 1: Foundation | Complete (01-02 schema + client) |
| PLAT-01 | Phase 1: Foundation | Complete (01-03 manifest + PWA shell) |
| PLAT-02 | Phase 1: Foundation | Complete (01-02) |
| DATA-01 – DATA-06 | Phase 2: Data Pipeline | Pending |
| INTEL-01 – INTEL-03 | Phase 3: Intelligence + Cards | Pending |
| CARD-01 – CARD-05 | Phase 3: Intelligence + Cards | Pending |
| WEB-01 – WEB-03 | Phase 4: Web Lookup + Post-Meeting | Pending |
| POST-01 – POST-04 | Phase 4: Web Lookup + Post-Meeting | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0
- Phases: 4

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after 01-03 execution (PLAT-01 complete)*

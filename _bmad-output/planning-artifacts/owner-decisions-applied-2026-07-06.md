---
created: 2026-07-06
project: ElproSaas
phase: Phase A - Internal Pilot MVP
purpose: >
  Record the owner's 2026-07-06 answers to the three questions Epic 6 left
  open, so later stories inherit decisions instead of re-flagging Stop
  Conditions. Answered interactively at epic close (post-merge of PR #26).
source_documents:
  - _bmad-output/auto-bmad/reports/epic-6.md                     # the epic report that surfaced the questions
  - _bmad-output/planning-artifacts/architecture.md              # §24 open-questions table (updated in this change)
  - _bmad-output/implementation-artifacts/deferred-work.md       # ledger entries affected
---

# Owner Decisions Applied (2026-07-06)

Epic 6 (Quote Versions, PDF, And Lifecycle) closed with three owner questions.
The owner answered all three on 2026-07-06. This document converts the answers
into story-ready decisions.

---

## D-1 — Quote-number display format (architecture §24)

**Decision: plain sequential integer, displayed as `Offert #<n>`.**

- The allocation model is unchanged: a race-safe per-tenant counter
  (`tenant_counters`, allocated inside the 6.1 create RPC), never reset.
- Display is the raw integer — exactly what the UI and PDF already render.
  **This ratifies shipped behavior; no code or schema change.**
- `quote_versions.quote_number_display` stays a dormant nullable presentational
  override for any future format need. No year prefix (a year-prefixed format
  without a per-year counter reset was judged confusing, and a resetting
  counter is a schema/allocation change nobody needs for the pilot).
- Story effects: 6.1-DOCS-01 is answered; the deferred-work ledger item
  "Allocated quote number is never threaded into the frozen composite snapshot
  value" is resolved as no-work-needed — the immutable `quote_versions.quote_number`
  row column is the persisted truth the UI/PDF read; the frozen snapshot JSON
  does not need to carry it. The architecture §24 row is updated to DECIDED.

## D-2 — Correction-draft policy: multi-draft stays

**Decision: keep multi-draft as shipped; no single-active-draft rule.**

- Two live correction drafts on one quote (possible under concurrent
  "Skapa ny version" actions — only the first supersedes the sent version) are
  acceptable: the timeline resolves a single current commitment
  deterministically, the UI already guards the accidental double-click
  (disable-on-submit), and parallel alternative proposals are a legitimate use.
- The 6.5 review finding "Concurrent 'Skapa ny version' clicks can leave two
  live drafts" stays dismissed as won't-fix — now by explicit owner decision,
  not only by triage recommendation.
- Revisit only if real pilot usage shows draft confusion.

## D-3 — R-610 tax/terms sign-off: demo-data-only stance reconfirmed

**Decision: the 2026-07-03 owner decision stands, reconfirmed 2026-07-06.**

- Demo-data-only operation through MVP: unapproved tax/terms placeholders are
  accepted; the send gate never hard-blocks on sign-off; all tax/VAT/ROT/grön
  framing stays explicitly "preliminär / kräver godkännande" (never presented
  as final).
- The re-score trigger is unchanged and live: **the moment real-customer use is
  proposed, R-610 flips to a blocker and the owner/accounting/legal sign-off
  session must run first** (VAT/ROT/grön rates, caps, eligibility, schablon,
  disclaimer text, terms approval). The inert `signOff` plumbing in
  `send-gate.ts` is the documented seam that session will wire up.

---

**Sequencing:** unchanged — Epic 7 (Acceptance-To-Job Transaction) is next.
None of these decisions adds work to Epic 7; D-1 and D-2 remove two would-be
Stop Conditions from future 6.x/7.x story creation.

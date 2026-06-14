---
created: 2026-06-14
project: ElproSaas
phase: Phase A - Internal Pilot MVP
status: awaiting-owner-answers
purpose: >
  Living tracker for the owner / accounting / legal sign-off decisions that gate
  Phase A. Resolves the open items in the PRD Owner Questions list and the
  Assumption Register (A10-A23). Answers recorded here feed story creation for
  Epics 3-7 and the Story 9.4 sign-off register.
source_documents:
  - _bmad-output/planning-artifacts/prd.md  # Owner Questions, Assumption Register
sent_to_owner: 2026-06-14  # Swedish email (see appendix), recipient = co-owner
---

# Owner Sign-Off Questions And Answers

This document tracks the business decisions that only the owner (and, for tax/legal
items, an accountant/lawyer) can make. None of these block foundation development
(Epics 1-2); the **Tier 1** items block **real pilot use against customers**, and
several **Tier 2** items block the **first demo/prototype** UX choices.

A Swedish-language version of every question was emailed to the co-owner on
**2026-06-14** (reproduced in the appendix). Record answers inline as they arrive,
then update the matching assumption status in the PRD Assumption Register.

## How To Use

- Fill the **Answer** column when the owner responds; set **Status** to `answered`.
- For Tier 1 tax/legal rows, `answered` still requires accounting/legal confirmation
  before `signed-off`.
- When a row reaches `signed-off`, update the corresponding assumption (A10-A23) in
  `prd.md` and reference it in the relevant story's Stop Conditions.

Status values: `open` → `answered` → `signed-off` (or `deferred`).

## Tier 1 — Blocking Before Real Pilot Use (12)

| # | Question | Assumption | Sign-off needed | Answer | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Quote number display format; does numbering reset yearly? | A13 | Owner | | open |
| 2 | What exact event marks a quote "sent", and who may mark it? (send locks the content) | Quote lifecycle / sent semantics | Owner | | open |
| 3 | Which acceptance evidence channels are sufficient (email, signed PDF, phone note, meeting note, other)? | A14 | Owner | | open |
| 4 | May accepted price differ from the sent quote total? If so, what reason/evidence is required? | A15 | Owner | | open |
| 5 | Repeated "accepted" on the same quote — block, show existing, or treat as correction? | A15 / lifecycle | Owner | | open |
| 6 | Rounding rule: per line, on VAT, on totals, and PDF display (whole kronor vs exact öre)? | A19 | Accounting | | open |
| 7 | Confirm VAT, ROT, grön teknik rates/caps, eligible bases, customer eligibility, BRF handling, schablon handling, disclaimer text. | A19, A20, A21 | Accounting/Legal | | open |
| 8 | Do customer-hidden quote rows still count toward totals and tax deductions (ROT/grön teknik)? | Calc/tax semantics (A19-A21) | Owner + Accounting | | open |
| 9 | Which quote terms are customer-visible, and who approves the wording? | A22 | Owner + Legal | | open |
| 10 | Which files are required before quote send, and before quote acceptance? | A17 | Owner | | open |
| 11 | Which legacy (Lovable) records are live / archive-only / excluded / deferred for the pilot? | A18 | Owner | | open |
| 12 | Which Lovable examples are the comparison "golden masters" for cutover verification? | A18 / migration | Owner | | open |

## Tier 2 — Needed Before First Demo/Prototype (14)

Rows tied to A10-A12 are also *blocking before real pilot use*, but the answer is
needed early because it shapes the demo UX.

| # | Question | Assumption | Answer | Status |
| --- | --- | --- | --- | --- |
| 13 | Which exact customer types appear in the UI (private, company, BRF, public, …)? | A10 | | open |
| 14 | Is an anläggning required for every quote/job, or optional for small jobs? | A11 | | open |
| 15 | Are contacts customer-wide, facility-specific, or both? | A11 | | open |
| 16 | Enforce one primary contact per customer, per facility, or not at all? | A12 | | open |
| 17 | Reusable article/material register, or are manual rows enough for the pilot? | A8 | | open |
| 18 | Which row types are essential first (labor, material, subcontractor, machinery, other)? | — | | open |
| 19 | Should sections support detailed / summary / text-only display from the first prototype? | — | | open |
| 20 | Options/tillval accepted separately, or only shown as optional additions? | — | | open |
| 21 | Which margin warnings are useful enough for the prototype? | — | | open |
| 22 | Manual PDF + status tracking only, or plan for in-app email sending later? | A9 | | open |
| 23 | What is the created job called in the UI (jobb, order, projekt, arbetsorder, …)? | A16 | | open |
| 24 | Are planned start/end dates needed at acceptance time for the prototype? | — | | open |
| 25 | Standalone document center, or are entity-scoped files enough? | — | | open |
| 26 | Which file types and size limits are acceptable for the prototype? | — | | open |

## Tier 3 — Deferred / Strategic (9)

Roadmap decisions for after the pilot. Capturing answers informs future phases; none
affect Phase A scope (all map to deferred assumptions A24-A29).

| # | Question | Assumption | Answer | Status |
| --- | --- | --- | --- | --- |
| 27 | Which non-admin roles should exist beyond `tenant_admin`? | A29 | | open |
| 28 | What mobile/field-worker installer workflow is needed later? | A25 | | open |
| 29 | What time/material/deviation/photo reporting is required? | A28 | | open |
| 30 | Manual faktureringsunderlag review/export before a Fortnox link? | A24 | | open |
| 31 | When should a Fortnox integration become active scope? | A24 | | open |
| 32 | Which supplier integrations are commercially necessary? | A26 | | open |
| 33 | Which extra modules are justified (AI, DoU, tender/FKU, HR, rentals, assets/QR, service plans, warranties, analytics)? | A27, A28 | | open |
| 34 | Is a customer portal / public online acceptance flow needed? | A6 | | open |
| 35 | What commercial model (tiers, onboarding, support, backup/restore, SLA)? | — | | open |

## Appendix — Swedish Email As Sent (2026-06-14)

The questions above were sent to the co-owner in Swedish, grouped as Del 1 (Tier 1,
questions 1-12), Del 2 (Tier 2, questions 13-26), and Del 3 (Tier 3, questions
27-35). Tier 1 questions 6, 7, and the wording in 9 were flagged as needing
accounting/legal confirmation. The full Swedish text lives in the sent email; this
appendix is a pointer so the canonical English questions above stay the system of
record for assumption sign-off.

# E0 Question Mapping — English source ↔ Swedish email

Datum: 2026-06-16

Purpose: traceability between the English discovery source and the Swedish email,
so we can confirm full coverage and trace any answer back to its intent and to the
epic/story that depends on it.

Documents:

- **EN** = [e0-owner-question-list.md](e0-owner-question-list.md) (English source)
- **Blad 1** = [e0-owner-questions-sv.md](e0-owner-questions-sv.md) (owner email)
- **Blad 2** = [e0-accounting-tax-questions-sv.md](e0-accounting-tax-questions-sv.md) (tax values)
- Live answered/open status: [owner-signoff-questions.md](../../_bmad-output/planning-artifacts/owner-signoff-questions.md)

ID scheme (matches the email): Blad 1 blocks are **1–8 in build order**; roadmap
items are `R1`–`R8`; Blad 2 blocks are `A`–`D`.

Status legend:

- **open** — still in the email, awaiting an answer.
- **besvarad** — answered already; removed from the email (decision in owner-signoff).
- **parkerad** — deferred to full-release scoping (out of the internal pilot).
- **utgår** — dropped (mooted by the full-Lovable-parity cutover goal).

The **Gate** column names the epic/story whose Stop Condition depends on the answer.

---

## EN §Workflow Priority

| EN question | SV ID / status | Gate |
| --- | --- | --- |
| Which Phase A workflow must work first? | utgår (full parity) | — |
| Smallest end-to-end pilot flow? | utgår (full parity) | — |
| One tenant admin or multiple? | besvarad: 1 admin i piloten, bygg för fler | Epic 2 |
| Quote sending manual PDF/status or email? | `3.4` | Epic 6 / 6.2 |
| Which Lovable screens essential vs ignorable? | `8.1` (delvis) | Epic 9 / 9.1 |

## EN §CRM/Customer Data

| EN question | SV ID / status | Gate |
| --- | --- | --- |
| Which customer types are needed? | `1.1` | Epic 3 / 3.1 |
| Anläggning required for every quote/job? | `1.3` | Epic 3 / 3.1 |
| Can one customer have multiple facilities? | `1.3` | Epic 3 / 3.1 |
| Can a contact belong to a facility? | `1.4` | Epic 3 / 3.1 |
| Primary contact enforced where? | `1.5` | Epic 3 / 3.2 |
| Which customer fields mandatory for a quote PDF? | `1.2` | Epic 3 / 3.1, 3.3 |
| Exclude personnummer until invoicing? | besvarad: **personnummer krävs** (ändrar A16) | Epic 3 / 3.1 |

## EN §Calculations

| EN question | SV ID / status | Gate |
| --- | --- | --- |
| Which row types are essential? | besvarad: alla lika viktiga | Epic 5 / 5.1 |
| Work roles required for labor, or manual? | besvarad: **både** roller och fritt | Epic 3 / 3.4, 5.3 |
| Articles/price lists required? | besvarad: ja, återanvändbart register | Epic 3 / 3.4 |
| Detailed/summary/text-only display? | `3.1` | Epic 5 / 5.5, 6.1 |
| Options/tillval included? | `3.2` | Epic 5 / 5.4 |
| Hidden rows count in totals + deductions? | `2.2` | Epic 4–5 / 5.4 |
| What margin warnings? | `3.3` | Epic 5 / 5.4 |
| Rounding rule? | `A.1` (Blad 2) | Epic 4 / 4.1 |

## EN §Quotes/PDF/Acceptance

| EN question | SV ID / status | Gate |
| --- | --- | --- |
| Quote number format? | `4.1` | Epic 6 / 6.1 |
| When does a quote become immutable? | `4.2` | Epic 6 / 6.4 |
| Which statuses required? | `4.3` | Epic 6 / 6.2, 6.5 |
| PDF: VAT excluded/included/both? | `2.1` | Epic 4, 6 / 4.2, 6.3 |
| Standard terms + who approves? | besvarad: platshållartext ok för piloten | Epic 3 / 3.3 |
| Attachments inline vs appendix? | `5.1` | Epic 6 / 6.1, 6.3 |
| Acceptance evidence sufficient? | besvarad: alla + valfri filuppladdning | Epic 7 / 7.1 |
| Accepted price differ + reason? | `6.1` | Epic 7 / 7.1 |

## EN §Jobs/Order/Project Terminology

| EN question | SV ID / status | Gate |
| --- | --- | --- |
| What should the accepted quote create (term)? | `7.1` | Epic 7 / 7.3 |
| Fields required on first job record? | `7.3` | Epic 7 / 7.3 |
| All accepted quotes create a job automatically? | `7.2` | Epic 7 / 7.2 |
| Repeated acceptance handling? | `6.2` | Epic 7 / 7.2 |
| Planned start/end dates at acceptance? | `7.4` | Epic 7 / 7.1, 7.3 |
| Which job features definitely NOT needed? | Roadmap (delvis) | — |

## EN §Files/Documents

| EN question | SV ID / status | Gate |
| --- | --- | --- |
| Standalone document center or entity-scoped? | `7.5` | Epic 8 / 8.5 |
| Files required before a quote can be sent? | `5.2` | Epic 5, 8 / 5.4, 8.4 |
| Files required before a quote can be accepted? | `5.3` | Epic 7 / 7.1 |
| Files snapshotted into the quote version? | `5.4` | Epic 8 / 8.4 |
| Quote evidence files immutable after acceptance? | `5.4` | Epic 8 / 8.4 |
| File types and size limits? | besvarad: alla vanliga, gräns i större spannet | Epic 8 / 8.2 |
| Who can delete or restore a file? | besvarad: alla med admin-roll | Epic 8 / 8.2, 8.4 |

## EN §ROT/Grön Teknik/Accounting Assumptions

| EN question | SV ID / status | Gate |
| --- | --- | --- |
| Confirm ROT rate, cap, base, VAT handling. | `B.1`–`B.4` | Epic 4 / 4.3 |
| Confirm grön teknik rates (solar/battery/charging). | `C.1` | Epic 4 / 4.3 |
| Grön teknik cap + 3% schablon valid? | `C.2`–`C.3` | Epic 4 / 4.3 |
| BRF eligible for ROT and/or grön teknik? | `D.2` | Epic 4 / 4.3 |
| Estimates vs promised reductions? | parkerad (full release) | Epic 4 / 4.3 |
| Customer-facing disclaimer text? | parkerad (full release) | Epic 6 / 6.3 |
| Authoritative accounting/legal source? | parkerad (full release) | Epic 9 / 9.4 |

## EN §Migration/Coexistence

| EN question | SV ID / status | Gate |
| --- | --- | --- |
| Which records migrate live? | `8.1` | Epic 9 / 9.1 |
| Which archive-only / view-only? | `8.1` | Epic 9 / 9.1 |
| Which remain only in the old app? | `8.1` | Epic 9 / 9.1 |
| Which become golden-master fixtures? | `8.2` | Epic 9 / 9.2, 9.3 |
| Which examples for shadow comparison? | `8.2` | Epic 9 / 9.2, 9.3 |
| How long should the old app remain? | besvarad: tills allt är helt överflyttat | Epic 9 / 9.4 |
| What result good enough for cutover? | besvarad: minst all Lovable-funktionalitet | Epic 9 / 9.5 |

## Roadmap (`R1`–`R8`) and tax sheet (`A`–`D`)

- `R1` roles · `R2` mobile field UX · `R3` field reporting · `R4` supplier
  integrations · `R5` extra modules · `R6` customer portal · `R7` commercial model
  · `R8` long-term UX. All map to deferred assumptions (A24–A29) — no Phase A story.
- Blad 2: `A` rounding/VAT → Epic 4 (4.1/4.2); `B` ROT, `C` grön teknik,
  `D` eligibility → Epic 4 / 4.3.

## Open questions by build wave

- **Wave 1 (Epic 3–4, next):** Block 1 (all), Blad 2 `A`–`D`, plus `2.2` (hidden
  rows). These are the time-critical ones.
- **Wave 2 (Epic 5–6):** Blocks 2–5 (`2.1`, `3.1`–`3.4`, `4.1`–`4.3`, `5.1`–`5.4`).
- **Wave 3 (Epic 7 & 9):** Blocks 6–8 (`6.1`–`6.2`, `7.1`–`7.5`, `8.1`–`8.2`).
- **Roadmap:** `R1`–`R8` (no build dependency).

## Swedish-only addition

- `D.3` "Får ROT och grön teknik kombineras…" — no EN source; added because the
  legacy app treats them as mutually exclusive. Worth confirming.

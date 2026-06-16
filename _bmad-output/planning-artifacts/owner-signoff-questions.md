---
created: 2026-06-14
project: ElproSaas
phase: Phase A - Internal Pilot MVP
status: sent-awaiting-remaining-answers
purpose: >
  Living tracker for the owner / accounting decisions that gate Phase A. Question
  IDs are kept identical to the Swedish email so answers map 1:1. Resolves the open
  items in the PRD Owner Questions list and the Assumption Register (A6-A29).
source_documents:
  - _bmad-output/planning-artifacts/prd.md  # Owner Questions, Assumption Register
  - docs/discovery/e0-owner-questions-sv.md  # the outgoing email (IDs match this)
  - docs/discovery/e0-accounting-tax-questions-sv.md  # tax sheet (Blocks A-D)
sent_to_owner: 2026-06-16  # revised, simplified Swedish email sent this date (the 2026-06-14 draft was never sent)
answers_received: 2026-06-16  # informal answers from co-owner, recorded below
---

# Owner Sign-Off Questions And Answers

This tracks the business decisions that gate Phase A. **Question IDs match the
Swedish email exactly** (`docs/discovery/e0-owner-questions-sv.md` + the tax sheet),
so an answer maps straight to a row: "Block 3, fråga 2" → `3.2`; the tax sheet uses
`A`–`D`; the roadmap uses `Roadmap N`.

Conventions:

- **IDs are stable.** When a question is answered it keeps its ID and moves to the
  *Answered* section; the email simply drops it (a number gap is fine — IDs are not
  reused or shifted). This is what keeps future answer-mapping unambiguous.
- None of these block the foundation (Epics 1-2). **All Prio 1-3 questions are
  required for the pilot** (cutover = full Lovable parity); the **Roadmap** section
  is deferred.
- The Swedish email was **drafted 2026-06-14 (never sent)**, then revised and
  **sent 2026-06-16** (`docs/discovery/`). Some answers arrived informally before the
  send and are recorded below.
- Pilot is **internal test only** — legal/GDPR/customer-facing sign-off items are
  deferred to full-release scoping (see *Parked*).

Status values: `open` → `answered` → `signed-off` (or `parked`/`deferred`).
The **Epic** column is the build wave whose story Stop Condition needs the answer
(precise story gates live in `docs/discovery/e0-question-mapping.md`).

## Open questions

### Prio 1 — Block 1: Kunder & kontakter — Epic 3

| ID | Question | Assumption | Sign-off | Answer | Status |
| --- | --- | --- | --- | --- | --- |
| 1.1 | Kundtyper (privat/företag/BRF/offentlig – exakt vilka?) | A10 | Owner | | open |
| 1.2 | Obligatoriska kundfält för offert-PDF | A10 | Owner | | open |
| 1.3 | Anläggning obligatorisk? Flera per kund? | A11 | Owner | | open |
| 1.4 | Kontakt: kund / anläggning / båda | A11 | Owner | | open |
| 1.5 | Huvudkontakt tvingande (kund/anläggning/inte alls)? | A12 | Owner | | open |

### Prio 2 — Block 2: Pengar – visning & dolda rader — Epic 4-6

| ID | Question | Assumption | Sign-off | Answer | Status |
| --- | --- | --- | --- | --- | --- |
| 2.1 | PDF: pris exkl / inkl / båda moms | A19 | Owner | | open |
| 2.2 | Dolda rader med i total + skatteavdrag? | A19-A21 | Owner + Accounting | | open |

### Prio 2 — Block 3: Kalkyl & offert — Epic 5-6

| ID | Question | Assumption | Sign-off | Answer | Status |
| --- | --- | --- | --- | --- | --- |
| 3.1 | Visningslägen: detaljerat / sammanfattat / text | — | Owner | | open |
| 3.2 | Tillval: separat accept eller bara visas? | — | Owner | | open |
| 3.3 | Vilka marginalvarningar | — | Owner | | open |
| 3.4 | PDF-only vs förbered mejl senare | A9 | Owner | | open |

### Prio 2 — Block 4: Offerter & numrering — Epic 6

| ID | Question | Assumption | Sign-off | Answer | Status |
| --- | --- | --- | --- | --- | --- |
| 4.1 | Offertnummerformat + årlig återställning | A13 | Owner | | open |
| 4.2 | Vad räknas som "skickad" + vem får | lifecycle | Owner | | open |
| 4.3 | Vilka statusar | lifecycle | Owner | | open |

### Prio 2 — Block 5: Bilagor & filer — Epic 6, 8

| ID | Question | Assumption | Sign-off | Answer | Status |
| --- | --- | --- | --- | --- | --- |
| 5.1 | Bilaga inne i offerten vs sist | — | Owner | | open |
| 5.2 | Filer krävda innan skicka | A17 | Owner | | open |
| 5.3 | Filer krävda innan accept | A17 | Owner | | open |
| 5.4 | Frysa filer permanent (facit) eller ändringsbara? | A17 | Owner | | open |

### Prio 3 — Block 6: Pris & att kunden tackar ja — Epic 7

| ID | Question | Assumption | Sign-off | Answer | Status |
| --- | --- | --- | --- | --- | --- |
| 6.1 | Accepterat pris ≠ offertpris? Motiveringsfält? | A15 | Owner | | open |
| 6.2 | Dubbel-ja: blockera / visa befintligt / rättelse | A15 | Owner | | open |

### Prio 3 — Block 7: Jobb/order & filer — Epic 7-8

| ID | Question | Assumption | Sign-off | Answer | Status |
| --- | --- | --- | --- | --- | --- |
| 7.1 | Vad jobbet ska kallas | A16 | Owner | | open |
| 7.2 | Auto-skapa jobb vid varje accept? | — | Owner | | open |
| 7.3 | Obligatoriska fält första jobbkortet | — | Owner | | open |
| 7.4 | Planerat start/slut vid accept? | — | Owner | | open |
| 7.5 | Dokumentbibliotek vs kopplade filer | — | Owner | | open |

### Prio 3 — Block 8: Övergång från gamla appen — Epic 9

| ID | Question | Assumption | Sign-off | Answer | Status |
| --- | --- | --- | --- | --- | --- |
| 8.1 | Aktiv / arkiv / uteslut / vänta-klassning | A18 | Owner | | open |
| 8.2 | Facit-exempel för jämförelse | A18 | Owner | | open |

### Tax sheet (Blad 2) — Blocks A-D — Epic 4

| ID | Question | Assumption | Sign-off | Answer | Status |
| --- | --- | --- | --- | --- | --- |
| A.1 | Avrundning (rad/moms/total) + PDF-visning | A19 | Accounting | | open |
| A.2 | Moms-sats idag + avvikande fall | A19 | Accounting | | open |
| B.1-B.4 | ROT: sats / tak / underlag / momshantering | A20 | Accounting | | open |
| C.1-C.3 | Grön teknik: satser / tak / schablon | A21 | Accounting | | open |
| D.1-D.3 | Berättigande / BRF / ROT+grön kombination | A20-A21 | Accounting | | open |

### Roadmap (deferred — no Phase A story)

| ID | Question | Assumption | Answer | Status |
| --- | --- | --- | --- | --- |
| Roadmap 1 | Roller utöver administratör | A29 | | open |
| Roadmap 2 | Mobilt fältarbetarflöde | A25 | | open |
| Roadmap 3 | Fältrapportering (tid/material/ÄTA/foto) | A28 | | open |
| Roadmap 4 | Leverantörsintegrationer | A26 | | open |
| Roadmap 5 | Extra moduler (AI/DoU/FKU/HR/…) | A27, A28 | | open |
| Roadmap 6 | Kundportal / online-accept | A6 | | open |
| Roadmap 7 | Affärsmodell (abonnemang/SLA/…) | — | | open |
| Roadmap 8 | Långsiktig UX-riktning | — | | open |

## Answered (resolved 2026-06-16 — removed from the email)

| Relates to | Question | Answer | Assumption |
| --- | --- | --- | --- |
| Block 1 | Utelämna personnummer? | **Nej – personnummer krävs** (ändrar AR16/NFR16) | AR16/NFR16 |
| Block 3 | Återanvändbart artikel-/materialregister? | Ja | A8 |
| Block 3 | Arbete via arbetsroller eller fritt? | **Båda** | A8 |
| Block 3 | Vilka radtyper viktigast | Alla lika viktiga | — |
| Block 5/7 | Vem får radera/återställa filer | Alla med admin-roll | — |
| Block 6 | Acceptbevis-kanaler | Alla giltiga + valfri filuppladdning (mejl/PDF/txt/docx) | A14 |
| Block 4/inställningar | Villkorstext + vem godkänner | Platshållartext räcker för piloten | A22 |
| Block 7 | Filtyper / maxstorlek | Alla vanliga filtyper; rimlig gräns i större spannet | — |
| Block 8 | Hur länge gamla appen parallellt | Tills allt är helt överflyttat | A18 |
| Block 8 | Cutover-kriterium | Minst all funktionalitet som Lovable-appen har | A18 |
| Roadmap | Faktureringsunderlag före Fortnox | Ja, behövs | A24 |
| (Block 0, utgår) | En eller flera administratörer | En i piloten; bygg membership-modellen för fler i full produkt | — |

## Parked for full-release scoping (out of the internal pilot)

- Estimate-vs-promised-reduction wording for tax deductions (was tax Block E) — A20/A21
- Customer-facing disclaimer text (was tax Block E) — A22
- Authoritative accounting/legal source / who owns the tax numbers (was tax Block F) — NFR15
- GDPR / retention treatment for personnummer and free-text notes

## Assumption change — personnummer

The owner confirmed the system **must support personal numbers (personnummer)**. This
**reverses** the conservative architecture assumption (AR16 / NFR16: omit personnummer
by default — note this is AR16/NFR16, not PRD assumption A16, which is job terminology).
For the internal pilot this is in scope; when implemented (Story 3.1) it still needs the
private, tenant-owned, access-controlled handling already described in the security
guardrails. Full GDPR/retention treatment is deferred to full-release scoping.

## Appendix — Swedish email status

Drafted 2026-06-14 (never sent), revised, and **sent 2026-06-16**. The Swedish email
lives in `docs/discovery/e0-owner-questions-sv.md` (owner) and
`docs/discovery/e0-accounting-tax-questions-sv.md` (tax values). Those sheets are the
outgoing artifact; this list stays the system of record for assumption sign-off.

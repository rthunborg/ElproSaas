---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-03'
workflowType: testarch-test-design
designLevel: epic
epicNum: 6
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 6, lines 1213-1399; Epic 7 boundary 1401+)
  - _bmad-output/planning-artifacts/architecture.md (§11 quote version snapshot model; §12 PDF generation; §13 acceptance boundary; ADR-A005 immutable quote/acceptance; ADR-A009 narrow RPC; error codes incl. QUOTE_VERSION_LOCKED; tenant_counters IN-list)
  - _bmad-output/planning-artifacts/prd.md (FR30-FR40)
  - _bmad-output/project-context.md (Money/Tax/Quote Rules; snapshot-source contract; Testing Rules; Security Regression Harness Rules)
  - _bmad-output/test-artifacts/test-design-epic-5.md (house style + inherited foundation)
  - _bmad-output/implementation-artifacts/epic-5-retro-2026-07-03.md (Epic 6 readiness, prep items, standing concerns)
  - supabase/migrations/20260702120000_calculation_data_model.sql + 20260703120000_calculation_row_pricing_source.sql (source tables 6.1 snapshots)
  - src/lib/money/**, src/lib/snapshots/**, src/server/snapshots/resolve-source.ts (frozen engine + snapshot contract Epic 6 composes)
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES enrollment + H4 gate contract)
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
---

# Test Design: Epic 6 - Quote Versions, PDF, And Lifecycle

**Date:** 2026-07-03
**Author:** Rasmus
**Status:** Draft
**Design Level:** Epic-Level (Phase 4)
**Mode:** Risk-based, evidence-backed (Master Test Architect)

---

## Executive Summary

**Scope:** Epic-level test design for Epic 6 — the epic that turns a ready calculation into an
**immutable, numbered, customer-visible quote version with a PDF**. Five stories: quote snapshot
schema + server-side version creation with race-safe tenant-scoped numbering (6.1); draft review and
version timeline UX (6.2); PDF generation strictly from the snapshot, stored privately through the
Story 8.1 file foundation (6.3); mark-sent with immutability enforced below the UI (6.4); and new
versions after customer-visible changes with prior sent versions preserved (6.5).

**Epic goal (from epics.md):** Let tenant admins create, review, send, and preserve immutable quote
versions and PDFs generated from snapshots — without race-prone numbering, PDFs rendered from mutable
data, mutable sent versions, unclear sent semantics, or unapproved tax/terms wording.

**Why this epic is risk-bearing (and how it differs from Epic 5):** Epic 5 built the *editable* money
workspace; **Epic 6 is where the money becomes a commitment**. This is the first epic whose output a
customer can see and rely on, which upgrades three risk classes to their most consequential form yet:
(1) **isolation** — five-to-six new tenant-owned tables (`quotes`, `quote_versions`,
`quote_version_lines`, `quote_version_attachments`, `quote_events`, `tenant_counters`) carrying
customer identity and pricing, each needing the full Epic 2-5 pattern (direct `tenant_id`, composite
same-tenant FKs, enable+force RLS, `anon → none`, `TENANT_TABLES` enrollment) plus tenant-scoped
counter allocation that must not leak or collide across tenants; (2) **snapshot integrity** — the quote
version must be a *complete copy-by-value freeze* of everything customer-visible (identity, terms,
lines, totals, VAT/tax assumptions, attachments, warnings) so that no later edit to a calculation,
setting, price, or CRM record can reach a sent quote, and the PDF must read **only** those snapshot
tables — the "PDF rendered from mutable data" failure is the canonical Epic 6 bug; (3) **lifecycle
safety** — sent means locked at the database (triggers/constraints), not just the command layer and
never just the UI; blocking readiness must gate the send; and every subsequent change route is a NEW
version with the prior version untouched. The **customer-visible wording risk** flagged by the Epic 5
retro has been resolved by owner decision (Rasmus, 2026-07-03): the MVP runs on **demo data only**, so
the engine's UNAPPROVED tax/terms placeholders with `requiresSignOff` + non-final framing are accepted
until a potential post-MVP phase — the framing tests remain, the sign-off session gate does not.

**Risk Summary:**

- Total risks identified: **17**
- High-priority risks (score ≥6): **11**
- Critical (score 9 / auto-BLOCK at design time): **0** — but four controls are **epic blockers
  regardless of numeric score**: (a) any new quote table unenrolled in `TENANT_TABLES` / missing
  enable+force RLS + own-tenant policies + `anon → none` (R-601, the H4 gate makes this CI-fatal by
  design); (b) a sent version mutable through ANY app path or a direct own-tenant SQL UPDATE (R-605 —
  DB-level enforcement is a 6.4 acceptance criterion, and UI-only locking is a story STOP condition);
  (c) a PDF that reads any mutable table as source of truth (R-606 — architecture §12 source-of-truth
  rule); (d) real PII/secret in a quote/PDF golden fixture (R-615, held at mitigate-control like Epic
  4's R-411 / Epic 5's R-516).
- Critical categories: **DATA** (snapshot completeness/freeze, sent immutability, prior-version
  preservation, numbering races), then **SEC** (isolation on ~6 new tables, cross-tenant source ids,
  private PDF file access, internal-note leakage), then **BUS/compliance** (readiness gating the send,
  timeline truthfulness, fixture privacy; tax/terms wording is a documented residual under the
  demo-data-only decision, see R-610).

**Coverage Summary:**

- **P0 (Critical):** ~34-48 tests — migration + RLS negatives + enrollment for all new quote tables;
  cross-tenant source/attachment rejection; snapshot completeness + behavioral freeze; race-safe
  numbering; mark-sent transition + command AND database immutability rejection; readiness gates the
  send; new-version-preserves-prior; PDF snapshot-only sourcing + text-extraction goldens; private PDF
  file access negatives; internal-note exclusion; fixture privacy.
- **P1 (High):** ~18-28 tests — quote detail/timeline UX, draft-edit-only-draft + immutability
  warnings, read-only sent view + new-version path, PDF status states + retry-from-same-snapshot +
  repeated-render stability, öre discipline on new columns, deferred-surface absence.
- **P2 (Medium):** ~8-12 tests — lifecycle edge transitions (rejected/expired/superseded),
  keyboard/a11y on timeline and PDF controls, quote-number display assumption, documented Lovable
  immutability delta.
- **P3 (Low):** ~3-6 tests — exploratory numbering concurrency fuzz, DX errors, residual docs.
- **Total:** ~63-94 tests across UNIT / INT / RLS / E2E / GOLDEN / DOCS levels.

---

## Inherited Foundation (what Epic 6 builds on, not rebuilds)

Epics 2-5 shipped the isolation harness, the money engine, the snapshot contract, and the readiness
surface Epic 6 now freezes into customer commitments. Verified in-repo; Epic 6 must **reuse**, not
re-invent, these:

| Inherited asset | Where | Epic 6 obligation |
| --- | --- | --- |
| Tenant-table pattern: direct `tenant_id`, composite same-tenant parent FK, enable+**force** RLS with own-tenant `is_tenant_admin` policies, `anon → none` GRANT, archive-over-delete, `set_updated_at()` | `supabase/migrations/20260630120000_crm_data_model.sql`, `20260702120000_calculation_data_model.sql` | `quotes` (→ customer/facility/contact same-tenant FKs), `quote_versions` (→ quotes), `quote_version_lines`/`quote_version_attachments` (→ quote_versions), `quote_events` (→ quotes/versions), `tenant_counters` each REUSE the exact pattern. A bare non-composite FK is a cross-tenant hole. NO Fortnox/invoice/portal/external-mapping table (6.1 AC1). |
| `TENANT_TABLES` enrollment + H4 inventory gate (compile-exhaustive; FAILS CI on an unenrolled tenant table) | `tests/integration/rls/tenant-table-inventory.ts` | **STANDING CONTRACT:** every new quote table (incl. `tenant_counters`) MUST enroll with spoof/filter/mutation metadata BEFORE merge. R-601's automated backstop. |
| Server command Result model: typed `Result<T, CommandErrorCode>`, `verifyOwnership` (zero rows ⇒ `TENANT_ACCESS_DENIED`), validation never echoes raw values, allow-listed audit metadata; stable codes incl. **`QUOTE_VERSION_LOCKED`** | `src/server/commands/envelope.ts`, `command-errors.ts` | 6.1/6.4/6.5 commands REUSE this. A cross-tenant calculation/attachment/version id ⇒ `TENANT_ACCESS_DENIED`; mutation of a sent version ⇒ `QUOTE_VERSION_LOCKED` (exact-code negative assertions). |
| Narrow Postgres RPC discipline (ADR-A009), proven by Epic 5's atomic reorder RPCs | `supabase/migrations/2026070*` calc RPCs; epics.md 6.1/6.4/6.5 tech notes | 6.1 number-allocation + version/line/event insertion, 6.4 lock/event/audit, and 6.5 new-version creation each use a narrow RPC (security **invoker** unless a separately approved definer design), called only from an authenticated command after membership/input validation. Mechanism change without ADR = STOP. |
| **Frozen-snapshot-by-copy discipline — three-times-proven** (Epic 3 snapshot contract → Epic 4 golden freeze → Epic 5 pricing-source row freeze), behaviorally proven each time (mutate-after-capture) | `src/lib/snapshots/build.ts`; `src/server/snapshots/resolve-source.ts`; Epic 5 retro Key Insight #4 | 6.1's `createQuoteVersionFromCalculation` composes the SAME discipline at quote scale: copy-by-value, `Object.freeze` in pure builders, injected timestamps (no clock reads), captures STATE computes nothing. The freeze proof is behavioral: mutate calc/settings/CRM/pricing AFTER version creation ⇒ snapshot unchanged. |
| Pure `@/lib/money` engine — integer öre, sum-of-rounded, `vat_rate_bp`, `estimateDeduction` with `requiresSignOff`, single kronor formatter | `src/lib/money/**` | Quote snapshot totals/VAT/deduction values are **captured from** calculation state that already routed through the engine — 6.1 stores them, it does NOT recompute them; the PDF view model displays snapshot values, never re-derives (R-603/R-606). New öre columns reuse canonical `isOreAmount`/`ORE_AMOUNT_MAX`. |
| Readiness classifier + pre-quote preview (blockers vs warnings, non-final tax framing, "new version required after send" note) | Epic 5 Story 5.4 (`readiness.ts`, preview UI) | 6.1 captures warnings at snapshot time from this surface; **6.4's mark-sent must consume the same blocker classification** — a blocked version is unsendable. 6.2's timeline reuses the preview's data shape. `CompanySettingsSnapshot` was intentionally identity-PARTIAL — **full PDF identity (org_nr/address/etc.) is Epic 6's concern** (project-context). |
| Two-runner stack + Playwright E2E (CI-gated, `SUPABASE_TEST_REQUIRED=1`) + two-tenant fixture + per-run unique ids; goldens under `tests/unit/**` (runner-glob trap); golden PII/secret scan | project-context Testing Rules; `scripts/run-tests.mjs`; `tests/factories/**` | 6.1/6.4/6.5 land INT + RLS; 6.2 and PDF-state UX land E2E; snapshot/PDF goldens land under `tests/unit/**` with the origin-labelling discipline (old-Lovable / new-expected / documented-delta) proven in 5.5. |
| Story 8.1 file foundation (`files`/`file_links`, private bucket, server-derived paths, signed access) | epics.md 8.1; architecture §14 | **SEQUENCING DEPENDENCY, currently NOT landed** (sprint-status: 8.1 backlog; approved order is 8.1-Wave-1 before Epic 6). 6.3 stores PDFs through it and MUST NOT invent its own storage/metadata model; 6.1's persisted attachment metadata depends on it too. See Entry Criteria. |

**What is genuinely NEW in Epic 6 (needs fresh coverage):** the quote table family + RLS + enrollment;
`createQuoteVersionFromCalculation` (the first *composite* snapshot — CRM display + identity + terms +
lines + totals + tax + attachments + warnings in one freeze); race-safe tenant-scoped **quote number
allocation**; the quote detail/timeline UI; the **PDF pipeline** (renderer pin, `QuotePdfViewModel`,
determinism, private storage, status states, retry); **sent-immutability enforced at the DB**; and the
new-version lifecycle. This is a full-stack epic — UNIT + INT + RLS + E2E + GOLDEN + DOCS.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Acceptance capture + acceptance-to-job transaction** | Epic 7 owns acceptance evidence, adjusted price, idempotent `acceptQuoteAndCreateJob` (epics.md Epic 7; architecture §13) | 6.2's quote detail shows an acceptance-state placeholder; the accepted lifecycle and its immutability are Epic 7 tests (cross-ref). Epic 6 proves *sent* immutability only. |
| **Email sending, customer portal, public acceptance endpoints** | Epic 6 explicit non-scope | Guardrail tests assert NO email-send path, portal route, or public acceptance endpoint exists (6.2 test req). |
| **Fortnox/invoicing, external mappings** | Deferred (AGENTS.md); 6.1 AC1 asserts absence | Migration test asserts no Fortnox/invoice/portal/external-mapping tables. |
| **Broad document center / upload UX / entity file panels** | Epic 8 (8.2-8.5) owns upload UX, panels, file index | 6.3 exercises only the 8.1 storage/metadata/signed-access foundation for the generated PDF; full storage negative breadth (MIME/size validation, spoofing matrix) is Epic 8. |
| **Final high-fidelity PDF design** | Epic 6 explicit non-scope | Goldens pin CONTENT (text extraction primary, visual secondary as stability check), not pixel-perfect design; design polish deferred without loosening the source-of-truth rule. |
| **Owner/accounting/legal APPROVAL of tax/terms/customer-visible wording** | Owner decision 2026-07-03: MVP runs on **demo data only**; unapproved placeholders accepted until post-MVP | The PDF/quote render the inherited unapproved profiles with non-final framing; tests pin the framing, not the constants' approval (R-610, documented residual). The sign-off session becomes a **post-MVP entry condition for real-customer use** — the 6.3 STOP on final wording applies only if real-customer use is proposed before then. |
| **Quote correction policy after acceptance** | Owner-gated (6.5 STOP condition; Epic 7 tech note) | 6.5 tests versioning of sent quotes only; accepted-state correction boundary is Epic 7 (cross-ref 7.4). |
| **Real Lovable quote data import** | Lovable is a behavioral oracle only | Snapshot/PDF goldens are anonymized shape-only; the intentional delta — Lovable's *mutable* quote versions vs Phase A's immutability — is a DOCUMENTED delta (6.4 migration note), never copied behavior. |
| **PDF performance/scale, bulk generation** | Pilot-sized NFRs only; no Phase A SLA | Single-quote render correctness is the concern; perf documented residual (R-618). |

---

## Risk Assessment

Scoring per `probability-impact.md`: Probability 1 (unlikely) / 2 (possible) / 3 (likely);
Impact 1 (minor) / 2 (degraded) / 3 (critical). Score = P × I. Thresholds: 1-3 DOCUMENT,
4-5 MONITOR, 6-8 MITIGATE (CONCERNS at gate), 9 BLOCK (auto-FAIL).

**Impact rationale (why so many Impact 3):** Epic 6 produces the first artifact a customer relies on.
A cross-tenant leak now exposes another tenant's customers and prices *in commitment form*; an
incomplete or live-referencing snapshot silently changes a sent commitment; an immutability bypass
destroys the audit property every later epic (acceptance, jobs, migration sign-off) builds on; a PDF
rendered from mutable data is a legally-relevant document that disagrees with its own snapshot. These
are **Impact 3**. **Probability is held at 2** for most: the isolation harness, freeze discipline, and
narrow-RPC pattern are proven three times over, so the residual risk is *correct composition at a new,
wider scale* (a composite snapshot spanning 6+ source tables; the first DB-trigger immutability; the
first counter; the first renderer). Probability drops to 1 where an automated gate makes silent failure
hard (fixture PII scan), and Impact to 2 where failure is degraded-not-critical (status plumbing,
nondeterminism, sequencing).

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-601 | SEC | **New quote-table isolation gap** — any of `quotes`/`quote_versions`/`quote_version_lines`/`quote_version_attachments`/`quote_events`/`tenant_counters` ships without direct `tenant_id`, enable+**force** RLS + own-tenant policies, `anon → none`, or **unenrolled in `TENANT_TABLES`** → cross-tenant read/write of another tenant's customers, prices, and commitments | 2 | 3 | 6 | Reuse the proven migration pattern verbatim on ALL new tables incl. `tenant_counters`; enroll everything in `TENANT_TABLES` with metadata BEFORE merge (H4 gate CI-fatal otherwise); migration-reset + cross-tenant + anon-path negatives per table | Dev (6.1) | Story 6.1 |
| R-602 | SEC | **Cross-tenant source id accepted on version creation** — `createQuoteVersionFromCalculation` accepts a foreign calculation id, or attachment selection accepts a foreign file/calculation id; or a bare FK lets a version line/attachment point at another tenant's parent | 2 | 3 | 6 | Composite same-tenant FKs at the DB; command re-validates calculation + attachment ownership under RLS (`verifyOwnership` semantics, zero rows ⇒ `TENANT_ACCESS_DENIED`); INT negatives spoof a foreign calc id AND a foreign attachment/file id | Dev (6.1) | Story 6.1 |
| R-603 | DATA | **Quote snapshot incomplete or live-referencing** — the version stores a reference to (or later re-reads) mutable customer/settings/terms/calc/pricing data instead of a complete copy-by-value freeze; or misses a customer-visible field (full company identity, terms text, warnings, attachment metadata) → a later edit silently changes a sent commitment, or the PDF lacks required identity content | 2 | 3 | 6 | Compose the three-times-proven freeze discipline: pure copy-by-value builders, `Object.freeze`, injected `capturedAt`; snapshot field checklist from architecture §11 (incl. FULL company identity — `CompanySettingsSnapshot` was intentionally partial); behavioral proof: mutate every source AFTER creation ⇒ snapshot unchanged; GOLDEN pins snapshot content | Dev (6.1) | Story 6.1 |
| R-604 | DATA | **Quote number race/collision** — concurrent version creation allocates duplicate or cross-tenant-leaking numbers; allocation happens client-side or outside the insertion transaction | 2 | 3 | 6 | Tenant-scoped allocation inside the 6.1 narrow RPC (`tenant_counters` row lock / atomic increment) in the SAME transaction as version insertion; INT concurrency test (parallel creations ⇒ unique, tenant-scoped, gapless-or-documented numbers); numbering never leaves the server | Dev (6.1) | Story 6.1 (spike per retro prep item) |
| R-605 | DATA/BUS | **Sent-immutability bypass** — customer-visible fields, attachments, or PDF-source data of a sent version mutable through a command path, OR through a direct own-tenant SQL UPDATE because locking is command-only/UI-only | 2 | 3 | 6 | Two independent layers per 6.4 AC: command validation (⇒ `QUOTE_VERSION_LOCKED`) AND DB triggers/constraints (architecture §9: immutable lifecycle tables block normal updates); INT negatives attempt mutation via command AND via direct authenticated UPDATE; UI-only locking is a story STOP | Dev (6.4) | Story 6.4 |
| R-606 | DATA | **PDF reads mutable data** — generation (or the preview view model) reads customers, settings, terms, calc rows, work roles, or article prices as source of truth instead of ONLY `quote_versions`/`quote_version_lines`/`quote_version_attachments`/file metadata snapshots → PDF disagrees with the immutable commitment | 2 | 3 | 6 | `QuotePdfViewModel` built purely from snapshot rows (unit-provable input surface); INT source-of-truth proof: mutate every mutable source AFTER snapshot, regenerate ⇒ output unchanged; text-extraction GOLDEN compares PDF content to snapshot totals/VAT/terms/warnings | Dev (6.3) | Story 6.3 |
| R-607 | SEC/BUS | **Internal content leaks into customer-visible output** — internal notes, margin/cost data (`unit_cost_ore`, margin ratios), or hidden-row internals reach the snapshot's customer-visible fields or the PDF | 2 | 3 | 6 | 6.2 tech note: internal notes separated from customer-visible snapshot content by construction (distinct columns/models); UNIT asserts the view model and snapshot builder EXCLUDE internal notes + cost/margin fields; GOLDEN fixtures contain no cost fields in customer-visible sections | Dev (6.1/6.2/6.3) | Stories 6.1-6.3 |
| R-608 | BUS | **Mark-sent bypasses blocking readiness or sent semantics unclear** — a version with blocking conditions can be sent; or sent timestamp/channel/reference semantics are improvised, making the lifecycle record unusable for Epic 7 acceptance | 2 | 3 | 6 | 6.4 AC: only a draft that passes BLOCKING readiness checks can be confirmed sent (reuse the 5.4 classifier — same rule table, no fork); sent RPC takes an explicit timestamp parameter (no wall-clock) and records channel/reference + quote event + audit event; INT negative: blocked draft ⇒ send rejected; semantics change = STOP | Dev (6.4) | Story 6.4 |
| R-609 | DATA | **New-version flow or lifecycle events mutate prior versions** — creating v2 (or recording rejected/expired/superseded) alters v1's snapshot, PDF metadata, events, or status history | 2 | 3 | 6 | 6.5 reuses the 6.1 narrow RPC with explicit parent quote/version relationship + event; INT proof: after v2 creation and each lifecycle event, v1's full snapshot + PDF metadata + events are byte-identical; GOLDEN v1/v2 comparison fixtures | Dev (6.5) | Story 6.5 |
| R-611 | SEC | **Quote-PDF private-file access gap** — generated PDF reachable cross-tenant or anonymously; path client-derived; signed access unauthorized | 2 | 3 | 6 | Store ONLY through the 8.1 foundation (private bucket, server-derived paths, metadata-first authorization, signed access command); INT negatives: cross-tenant + anon access to the PDF file/metadata rejected; no public URL surface; full storage-negative breadth remains Epic 8 (cross-ref) | Dev (6.3) | Story 6.3 (after 8.1) |
| R-615 | SEC/BUS | **Quote/PDF golden-fixture PII leak** — snapshot fixtures now embed customer display data; a real name/address/personnummer/orgnr/secret lands in `tests/fixtures/golden/**` or a committed PDF artifact | 1 | 3 | 3 → held at 6-equivalent control | Anonymized shape-only fixtures; REUSE + extend the CI golden PII/secret scan to quote/PDF fixtures and extracted-text assets; committed real PII is an epic blocker regardless of score (mirrors R-411/R-516) | Dev (6.1/6.3) | Stories 6.1, 6.3 |

### Medium-Priority Risks (Score 4-5)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-612 | TECH | **PDF nondeterminism** — renderer/library unpinned, non-embedded fonts, locale-drifting date/number/currency formatting, or wall-clock reads during render → repeated renders of the same snapshot differ, breaking goldens and retry semantics | 2 | 2 | 4 | 6.3 tech note (H3): pin renderer + version, embed/pin fonts, stable locale formatting, injected render timestamp from the command; repeated-render stability INT test; text extraction PRIMARY golden, visual snapshot secondary | Dev (6.3) |
| R-613 | OPS/DATA | **Partial PDF write / broken retry** — file stored without metadata/event/audit (or vice versa); retry mutates snapshot data or duplicates records; failed state not surfaced | 2 | 2 | 4 | File + `files`/`file_links` + `quote_events` + `audit_events` written consistently (transactional or verified-compensated); retry regenerates from the same immutable snapshot only; INT: mid-pipeline failure leaves a consistent, retryable state; E2E: all six status states visible | Dev (6.3) |
| R-614 | OPS | **Story 8.1 sequencing slip** — 8.1 (file foundation) is still backlog; 6.3 storage and 6.1 persisted attachment metadata depend on it; pressure to invent a local storage model would violate the 6.3 tech note | 2 | 2 | 4 | Approved execution order already places 8.1 Wave-1 before Epic 6 — CONFIRM it lands first (retro parallel-prep item); if 6.1 starts earlier, attachment metadata scope against 8.1 is re-checked at create-story; 6.3 must NOT introduce its own file model (STOP) | PM + Dev |
| R-616 | BUS | **Timeline misrepresents the commitment** — latest draft/sent/accepted state unclear, draft edits not visibly draft-only, or the immutability warning missing before send | 2 | 2 | 4 | 6.2 AC: lifecycle header + version timeline with status badges (text, not color alone); draft edit touches only the draft + warns sent-versions-become-immutable; sent/accepted selection shows read-only + new-version path; E2E per state | Dev (6.2) |
| R-617 | OPS | **Standing NFR concerns reach a FIFTH epic** — no `pnpm audit` CI gate (4-epic carry, explicit "no fourth carry" commitment already broken once) and no coverage reporter | 2 | 2 | 4 | Per Epic 5 retro HARD MECHANISM: land the audit-gate standalone config PR before Epic 6's first story review, OR record a dated owner-accept decision — this epic's gate must show one of the two, not a fifth advisory paragraph; `c8` reporter remains nice-to-have | Charlie (carried) + Rasmus (accept authority) |

### Low-Priority Risks (Score 1-3)

| Risk ID | Category | Description | Prob | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- |
| R-610 | BUS | **Unapproved tax/terms wording reaches a real customer** — ROT/grön-teknik/VAT display constants and disclaimers remain owner-UNAPPROVED. Downgraded from 6 by owner decision (2026-07-03): the MVP runs on **demo data only**, so no real customer can rely on the wording; probability of real-world harm drops to 1 | 1 | 3 | 3 | DOCUMENT with dated accept. Framing tests stay (snapshot + PDF carry `requiresSignOff` + non-final wording — `6.3-GOLDEN-01`); the sign-off working session becomes a post-MVP entry condition for any real-customer use. **Re-score to 6 immediately if real-customer use is proposed before sign-off.** |
| R-618 | PERF | PDF render latency / generation at scale untested (pilot-sized load only, no SLA) | 1 | 2 | 2 | Document; add only if an SLA emerges. Functional snapshot-correctness, not perf, is the Phase A concern. |

### Risk Category Legend

- **SEC**: Security (quote-table isolation, cross-tenant source ids, private PDF access, internal-data leakage, fixture PII)
- **DATA**: Data Integrity (snapshot completeness/freeze, numbering races, sent immutability, prior-version preservation, PDF source-of-truth, partial writes)
- **BUS**: Business/Compliance (readiness gating send, unapproved wording, timeline truthfulness)
- **TECH**: Technical (renderer determinism)
- **OPS**: Operations (8.1 sequencing, standing NFR gates, retry/status plumbing)
- **PERF**: Performance (render latency)

---

## Testability Notes (Epic-Level)

1. **RLS negatives BEFORE positives, and enrollment is the completeness guarantee.** Six new tenant
   tables all enroll in `TENANT_TABLES` so the H4 gate + shared cross-tenant/anon suites cover them
   automatically. `tenant_counters` is easy to forget — it is tenant-owned state and enrolls like any
   other table. Do not hand-write ad-hoc isolation tests that bypass the inventory.
2. **The two headline proofs are behavioral, not structural.** (a) *Snapshot freeze:* mutate every
   mutable source (calc rows, pricing, settings, terms, CRM display fields) AFTER version creation and
   prove the snapshot is unchanged — field-exists assertions are insufficient (three-epic precedent).
   (b) *Sent immutability:* attempt mutation through the command (assert `QUOTE_VERSION_LOCKED`) AND
   through a direct own-tenant authenticated UPDATE (assert the trigger/constraint rejects). A test
   that only proves the UI disables the button is not evidence (architecture §9).
3. **PDF correctness = source-of-truth + determinism, tested separately.** Source-of-truth: mutate
   mutable tables after snapshot, regenerate, output unchanged (R-606). Determinism: same snapshot
   rendered twice ⇒ comparable output under pinned renderer/fonts/locale/injected timestamp (R-612).
   Text extraction is the PRIMARY golden (per architecture §12 and the system-level design); visual
   snapshots are secondary stability checks — don't let pixel diffs become the gate.
4. **Numbering is a concurrency test, not a unit test.** Parallel `createQuoteVersionFromCalculation`
   calls within one tenant must yield unique numbers; two tenants must have independent sequences.
   Run inside the RPC's transaction; per-run unique tenants keep it parallel-safe (standing harness
   rule). Sleep-free: drive concurrency with `Promise.all`, not timing.
5. **Reuse the 5.4 readiness classifier for the send gate — do not fork the rule table.** 6.4's
   "passes blocking readiness checks" must call the same classification the preview used, so a
   blocker-vs-warning change can never disagree between preview and send. Unit-pin the send-gate
   adapter; INT-pin the rejected send.
6. **E2E hygiene as established:** two-tenant fixture, `crypto.randomUUID()` seeds for count
   assertions, red-phase ATDD headers cleared when flipping green, goldens under `tests/unit/**`.
   PDF E2E asserts STATUS transitions and accessible controls, not PDF content (that is golden/INT
   territory — duplicate-coverage guard).
7. **Resumed-run artifact discipline (retro standing practice):** any resumed story in this epic
   re-verifies scaffold completeness (`describe.skip`/`notYetImplemented`), exported-but-unimplemented
   command surface, and sprint-status freshness against disk before trusting recorded state — three
   epics of precedent say this WILL come up.

---

## Entry Criteria

- [ ] Epics 2-5 merged and green in `main` — isolation harness, money engine, snapshot contract,
      readiness classifier + pre-quote preview all live (verified: epic-5 gate PASS, 850/850 unit+golden)
- [ ] **Story 8.1 (file foundation) landed** per the approved Wave-1-before-Epic-6 order — required by
      6.3 (PDF storage) and by 6.1's persisted attachment metadata. If 6.1/6.2 start first, the
      create-story step re-scopes attachment metadata explicitly against 8.1's schema (R-614)
- [ ] **Quote-numbering approach spiked/agreed** — tenant-scoped counter via narrow RPC
      (`tenant_counters` row lock or equivalent) inside the version-creation transaction (retro prep
      item; R-604); number DISPLAY format is an open owner question (architecture §16) but must not
      become a data-model blocker (6.1 STOP)
- [ ] **Quote data model agreed** — the §11 snapshot field checklist (incl. FULL company identity,
      warnings, attachment metadata, accepted-price basis), lifecycle state machine
      (draft/sent/accepted/rejected/expired/superseded as used in Phase A), and sent event semantics
      (timestamp/channel/reference)
- [ ] **PDF renderer selected + pinned in the 6.3 story** with the H3 determinism requirements
      (pinned version, embedded fonts, stable locale, injected timestamp); a major new dependency
      needs approval (6.3 STOP)
- [ ] **`pnpm audit` hard mechanism resolved** — standalone CI PR landed OR dated owner-accept
      recorded, per the Epic 5 retro action item; this epic's NFR line must not be a fifth carry (R-617)
- [ ] **Tax/terms wording decision recorded** — owner decision (2026-07-03): MVP is demo-data-only,
      unapproved placeholders with `requiresSignOff` + non-final framing accepted until post-MVP; the
      sign-off working session moves to the post-MVP entry checklist for real-customer use (R-610)
- [ ] Anonymized Lovable quote/PDF oracle examples available for delta capture (no real data copied);
      the mutable-versions-vs-immutability delta is pre-agreed as an intentional, documented delta

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing or each failure explicitly triaged/waived
- [ ] **Isolation proven** — all new quote tables (incl. `tenant_counters`) enrolled in
      `TENANT_TABLES`; H4 gate green; cross-tenant read/write + anon negatives pass per table; foreign
      calculation/attachment ids rejected with `TENANT_ACCESS_DENIED`
- [ ] **Migration reset from empty proven** with per-table policy enumeration; no
      Fortnox/invoice/portal/external-mapping tables
- [ ] **Snapshot completeness + freeze proven** — every §11 field captured (incl. full company
      identity); mutating any source after creation leaves the snapshot byte-unchanged; snapshot
      GOLDEN green
- [ ] **Numbering proven race-safe** — concurrent creations yield unique tenant-scoped numbers;
      allocation is server-side inside the RPC transaction
- [ ] **Sent immutability proven at BOTH layers** — command mutation ⇒ `QUOTE_VERSION_LOCKED`; direct
      own-tenant SQL UPDATE ⇒ rejected by trigger/constraint; selected attachments and PDF source data
      equally locked
- [ ] **Send gated by readiness** — a draft with blocking conditions cannot be marked sent; sent
      records carry timestamp/channel/reference + quote event + audit event
- [ ] **New-version safety proven** — v2 creation and rejected/expired/superseded events leave v1's
      snapshot, PDF metadata, events, and status history untouched; v1/v2 GOLDEN green
- [ ] **PDF source-of-truth proven** — generation reads only snapshot tables; post-snapshot mutations
      never change output; text-extraction GOLDEN matches snapshot totals/VAT/terms/warnings;
      repeated-render stability green
- [ ] **PDF storage proven private** — stored via the 8.1 foundation with metadata/event/audit;
      cross-tenant + anon access rejected; retry regenerates from the same snapshot without
      customer-visible change
- [ ] **No internal leakage** — internal notes and cost/margin fields provably absent from
      customer-visible snapshot fields and PDF output
- [ ] **Fixture + artifact privacy green** — CI PII/secret scan covers quote/PDF fixtures and
      extracted-text assets; no real PII anywhere
- [ ] No open high-priority (≥6) risk unmitigated/unwaived; R-617 status (audit-gate mechanism)
      explicitly reported in the epic gate — not silently carried; R-610's dated demo-data-only accept
      restated in the gate report so the post-MVP re-score trigger stays visible

---

## Test Coverage Plan

> **P0/P1/P2/P3 = priority / risk classification, NOT execution timing.** Execution timing is defined
> separately in the Execution Strategy section below.

Test ID format `{EPIC}.{STORY}-{LEVEL}-{SEQ}`. Levels: **UNIT** (pure `node --test`), **INT** (Vitest,
DB-backed command/migration/RPC), **RLS** (Vitest cross-tenant/anon negatives via the shared
inventory), **E2E** (Playwright), **GOLDEN** (data-driven UNIT over `tests/fixtures/golden/**`),
**DOCS** (documented residual/assumption).

### P0 (Critical)

**Criteria**: Blocks core (isolation / commitment integrity / customer-visible correctness) + high
risk (≥6) + no workaround.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 6.1-INT-01 | Migration reset from empty creates `quotes`/`quote_versions`/`quote_version_lines`/`quote_version_attachments`/`quote_events` (+`tenant_counters`) with tenant ownership, parent consistency, lifecycle state, immutable snapshot fields; NO Fortnox/invoice/portal/external-mapping tables (6.1 AC1) | INT | R-601 | 2-3 | Dev | Per-table policy enumeration; deferred-table absence |
| 6.1-RLS-01 | Cross-tenant read/write + anon-path rejected on every new quote table (6.1 test req) | RLS | R-601 | 8-12 | Dev | Via `TENANT_TABLES` enrollment; spoof/filter/mutation metadata per table |
| 6.1-RLS-02 | H4 inventory gate green — all new tables enrolled incl. `tenant_counters` (standing contract) | RLS | R-601 | 1 | Dev | Unenrolled table fails CI by design |
| 6.1-INT-02 | `createQuoteVersionFromCalculation` rejects a foreign calculation id and a foreign attachment/file id ⇒ `TENANT_ACCESS_DENIED` (6.1 security impact) | INT | R-602 | 2-3 | Dev | Composite-FK backstop at DB |
| 6.1-INT-03 | Snapshot captures the full §11 checklist: customer/facility/contact display, FULL company identity, terms, line/section display model, totals, VAT/tax assumptions, selected attachment metadata, warnings, source calc refs (6.1 AC2) | INT | R-603 | 3-4 | Dev | Field-completeness against the architecture checklist |
| 6.1-INT-04 | **Behavioral freeze:** mutate calc rows/pricing/settings/terms/CRM AFTER version creation ⇒ snapshot byte-unchanged (6.1 AC2 / ADR-A005) | INT | R-603 | 3-4 | Dev | The headline proof; mirrors 5.3/Epic 3/4 freeze tests |
| 6.1-INT-05 | Concurrent version creation allocates unique tenant-scoped quote numbers; allocation inside the narrow RPC transaction; tenant B's sequence independent (6.1 AC3) | INT | R-604 | 2-3 | Dev | `Promise.all` concurrency; per-run unique tenants |
| 6.1-UNIT-01 | Snapshot builders pure: copy-by-value, `Object.freeze`, injected `capturedAt`, capture-not-compute (totals stored from engine-produced calc state, never re-derived) | UNIT | R-603 | 4-6 | Dev | Extends `src/lib/snapshots` discipline to the composite quote snapshot |
| 6.1-GOLDEN-01 | Snapshot content golden pack — representative quotes (options/tillval, hidden rows, ROT/grön warnings, attachment sets) with origin labels (6.1 test req) | GOLDEN | R-603, R-615 | 4-6 | Dev | Under `tests/unit/**`; anonymized shape-only |
| 6.2-UNIT-01 | Internal notes + cost/margin fields (`unit_cost_ore`, margin) EXCLUDED from customer-visible snapshot fields and from `QuotePdfViewModel` (6.2 tech note) | UNIT | R-607 | 2-3 | Dev | Leakage-by-construction guard |
| 6.3-INT-01 | **PDF source-of-truth:** generation reads only snapshot tables; mutating customers/settings/terms/calc/work-roles/articles after snapshot ⇒ regenerated output unchanged (6.3 AC1) | INT | R-606 | 2-3 | Dev | The canonical Epic 6 negative |
| 6.3-UNIT-01 | `QuotePdfViewModel` built solely from snapshot rows; displays snapshot values verbatim (öre → kronor via the single formatter); excludes internal fields (6.3 test req) | UNIT | R-606, R-607 | 3-5 | Dev | Input surface provable in the type/constructor |
| 6.3-GOLDEN-01 | PDF text-extraction golden (PRIMARY): totals, VAT/tax blocks incl. non-final ROT/grön framing, terms, attachments list, warnings where customer-visible — matches the snapshot (6.3 test req) | GOLDEN | R-606, R-610 | 3-5 | Dev | Visual snapshot secondary (P1); framing pinned as estimate + requiresSignOff |
| 6.3-INT-02 | Generated PDF stored via the 8.1 foundation (private bucket, server-derived path) with `files`/`file_links` + quote event + audit record; cross-tenant + anon access to file/metadata rejected (6.3 AC3) | INT/RLS | R-611 | 3-4 | Dev | Full storage-negative breadth stays Epic 8 |
| 6.4-INT-01 | Mark-sent records sent timestamp (explicit RPC parameter)/channel/reference, quote event, audit event, immutable lifecycle state (6.4 AC1) | INT | R-608 | 2-3 | Dev | No wall-clock in RPC |
| 6.4-INT-02 | Post-send mutation of customer-visible fields/attachments/PDF-source via command ⇒ `QUOTE_VERSION_LOCKED` (6.4 AC2) | INT | R-605 | 3-4 | Dev | Exact error-code assertions |
| 6.4-INT-03 | Post-send mutation via DIRECT own-tenant authenticated UPDATE ⇒ rejected by trigger/constraint (6.4 AC2: "database constraints/triggers reject") | INT | R-605 | 2-3 | Dev | Below-the-command proof; UI-only locking is a STOP |
| 6.4-INT-04 | A draft failing BLOCKING readiness checks cannot be marked sent; classifier is the 5.4 rule table (6.4 AC1 precondition) | INT/UNIT | R-608 | 2-3 | Dev | No forked blocker rule |
| 6.4-RLS-01 | Cross-tenant send/mutation attempts rejected by RLS + command validation (6.4 AC3) | RLS/INT | R-601, R-605 | 2-3 | Dev | Tenant A vs tenant B versions |
| 6.5-INT-01 | Customer-visible change on a sent version ⇒ NEW draft version via the narrow RPC with explicit parent quote/version + event; sent version not edited (6.5 AC1) | INT | R-609 | 2-3 | Dev | Covers the full 6.5 change list (lines/price/VAT/ROT/terms/validity/intro/display/attachments/notes) representatively |
| 6.5-INT-02 | After v2 creation AND each Phase A lifecycle event (rejected/expired/superseded): v1 snapshot, PDF metadata, events, status history byte-unchanged; events tenant-scoped + audited (6.5 AC2/AC3) | INT | R-609 | 3-4 | Dev | Prior-version preservation proof |
| 6.5-GOLDEN-01 | v1/v2 comparison goldens — what changed vs preserved across a versioning cycle (6.5 test req) | GOLDEN | R-609 | 2-3 | Dev | Origin-labelled fixtures |
| 6.x-UNIT-01 | Fixture/artifact privacy: PII/secret scan extended to quote snapshot + PDF fixtures and extracted-text assets (standing control) | UNIT | R-615 | 1-2 | Dev | CI-gated; blocker regardless of score |

**Total P0**: ~34-48 tests

### P1 (High)

**Criteria**: Important correctness/behavior + medium/high risk + common paths.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 6.2-E2E-01 | Quote detail shows lifecycle header, customer, latest version, source calculation, version timeline, PDF status, acceptance state, files, events (6.2 AC1) | E2E | R-616 | 2-3 | Dev | Two-tenant fixture; unique-id seeding |
| 6.2-E2E-02 | Draft edit updates ONLY the draft + warns that sent versions become immutable; sent/accepted selection is read-only with a new-version path (6.2 AC2/AC3) | E2E | R-616, R-605 | 2-3 | Dev | UI mirror of the INT-proven rules |
| 6.3-INT-03 | Repeated-render stability: same snapshot rendered twice ⇒ comparable output (pinned renderer/fonts/locale, injected timestamp) (6.3 tech note H3) | INT | R-612 | 1-2 | Dev | Text-comparison based |
| 6.3-INT-04 | Retry regenerates from the same immutable snapshot without changing customer-visible data; mid-pipeline failure leaves consistent, retryable state (file/metadata/event/audit) (6.3 tech note) | INT | R-613 | 2-3 | Dev | Fault injection at the storage/metadata boundary |
| 6.3-E2E-01 | PDF states visible + accessible: not_generated / generating / generated / failed / retry / preview / download (6.3 AC2) | E2E | R-613 | 2-3 | Dev | States only; content is golden territory |
| 6.3-GOLDEN-02 | Visual snapshot (SECONDARY) for representative quote PDFs (6.3 test req) | GOLDEN | R-612 | 1-2 | Dev | Stability check, not the gate |
| 6.4-E2E-01 | On mutation attempt against a sent version, UI explains the lifecycle rule and offers "create new version" (6.4 AC2) | E2E | R-616 | 1-2 | Dev | Message + affordance |
| 6.5-E2E-01 | Timeline preserves prior sent versions with snapshot, PDF metadata, events, status; latest draft/sent/accepted state clear (6.5 AC2) | E2E | R-616 | 1-2 | Dev | Multi-version fixture |
| 6.1-UNIT-02 | Öre discipline on new quote money columns — canonical `isOreAmount`/`ORE_AMOUNT_MAX`, bigint + `CHECK >= 0`, no forked rule (standing money contract) | UNIT/INT | R-603 | 2-3 | Dev | Same belt-and-braces as 5.1 |
| 6.1-INT-06 | Audit events written for version creation, mark-sent, PDF generation, new-version, lifecycle events — allow-listed metadata (standing audit contract) | INT | R-608 | 2-3 | Dev | Embedded in command tests where natural |
| 6.2-E2E-03 | No email-send, customer-portal, or public-acceptance route/surface exists (6.2 test req; epic non-scope) | E2E/INT | — | 1-2 | Dev | Guardrail scan |
| 6.4-UNIT-01 | Send-gate adapter unit-pinned against the 5.4 classifier (blockers block, warnings don't) (6.4 AC1) | UNIT | R-608 | 2-3 | Dev | Rule-table reuse proof |

**Total P1**: ~18-28 tests

### P2 (Medium)

**Criteria**: Secondary behavior + low/medium risk + edge cases.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 6.2-E2E-04 | Keyboard navigation through timeline/version selection; status badges use text not color alone (6.2 tech note/test req) | E2E | R-616 | 2-3 | Dev | A11y baseline |
| 6.3-E2E-02 | Accessibility fallback for preview/download controls (6.3 test req) | E2E | — | 1-2 | Dev | |
| 6.5-INT-03 | Lifecycle state machine edges: illegal transitions rejected (e.g., sent→draft, superseded→sent); Phase A states only | INT/UNIT | R-608 | 2-3 | Dev | Closed transition set |
| 6.1-DOCS-01 | Quote-number DISPLAY format documented as an open owner question; allocation model unaffected (architecture §16 open question; 6.1 STOP guard) | DOCS | R-604 | 1 | Dev | Assumption register |
| 6.4-DOCS-01 | Documented intentional delta vs Lovable's mutable quote versions (6.4 migration impact) | DOCS | — | 1 | Dev | Oracle delta register |
| 6.2-UNIT-02 | Timeline ordering/current-version selection logic extracted + unit-pinned (coverage-shape lesson) | UNIT | R-616 | 1-2 | Dev | Keep client-island logic out of the slow gate |

**Total P2**: ~8-12 tests

### P3 (Low)

**Criteria**: Nice-to-have + exploratory + benchmarks.

| Test ID | Requirement | Test Level | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| 6.1-UNIT-03 | Exploratory/property: numbering monotonicity per tenant under randomized interleavings | UNIT/INT | 1-2 | Dev | Exploratory; not a gate |
| 6.3-DOCS-01 | Residual notes: PDF perf (R-618), renderer-choice record, final-design deferral | DOCS | 1 | Dev | Awareness only |
| 6.x-UNIT-02 | DX: clear typed errors for unknown lifecycle transitions / unsupported PDF states | UNIT | 1-2 | Dev | Developer ergonomics |

**Total P3**: ~3-6 tests

---

## Execution Strategy

**Philosophy: run everything in every PR that can run in <15 min; the DB/E2E suites are the only real
cost.** Same shape as Epic 5 (full-stack epic):

- **Every PR:**
  - All Epic 6 UNIT + GOLDEN (`pnpm test:unit`) — snapshot builders, view model, internal-exclusion
    guards, send-gate adapter, snapshot/PDF-text/v1-v2 goldens, fixture PII scan. Seconds.
  - All Epic 6 INT + RLS (`pnpm test:int`, local Supabase stack) — migration reset, version-creation
    RPC, numbering concurrency, freeze proofs, immutability negatives (command + direct SQL),
    lifecycle, PDF pipeline + storage negatives, H4 gate. `SUPABASE_TEST_REQUIRED=1` in CI hard-fails
    a missing stack (the local Kong/GoTrue post-reset false-green trap from the Epic 5 retro makes
    this non-negotiable).
  - Epic 6 E2E (`pnpm test:e2e`, Playwright) — quote detail/timeline, draft-vs-sent editing, PDF
    status states, new-version affordance, deferred-surface absence. Within the 15-min bar.
- **Nightly / Weekly:** nothing Epic-6-specific. (PDF perf deferred, R-618 — add only if an SLA
  emerges.)

Standard triage order: smoke (login + open one quote) → P0 (isolation + snapshot/immutability +
PDF source-of-truth) → P1 (UX + retry/stability) → P2/P3.

---

## Resource Estimates

Ranges, not false precision. Epic 6 pays the **DB/RLS tax on ~6 new tables + a first-time PDF-pipeline
tax** (renderer pin, extraction tooling, storage wiring), but SAVES on math and readiness logic —
both are inherited and pinned; 6.x asserts *capture and preservation*, not arithmetic.

| Priority | Count (range) | Effort (range) | Notes |
| --- | --- | --- | --- |
| P0 | ~34-48 | ~36-56 h | Migration/RLS enrollment breadth + freeze/immutability proofs + PDF source-of-truth/goldens + numbering concurrency dominate |
| P1 | ~18-28 | ~18-30 h | Timeline/detail E2E + PDF states/retry/stability + audit assertions |
| P2 | ~8-12 | ~5-9 h | A11y, lifecycle edges, docs/deltas |
| P3 | ~3-6 | ~2-4 h | Exploratory/DX/residual docs |
| **Total** | **~63-94** | **~61-99 h (~1.5-2.5 weeks, 1 dev)** | Comparable to Epic 5; PDF text-extraction tooling is the one new fixed cost |

**Prerequisites**

- **Test data:** two-tenant factory extended with quote/version/line/attachment/event seeds + cleanup;
  anonymized quote + PDF golden fixtures under `tests/fixtures/golden/**` (origin-labelled);
  count-asserting tests seed `crypto.randomUUID()`.
- **Tooling:** existing runners (node --test / Vitest / Playwright) — no new runner; ONE new dev
  capability: PDF text extraction for goldens (choose alongside the pinned renderer in 6.3; keep it a
  devDependency); PII/secret scan extended to PDF-derived text.
- **Environment:** local Supabase CLI stack for INT/RLS/E2E; Story 8.1 storage foundation for 6.3.

**Non-effort dependency (calendar time):** the `pnpm audit` hard mechanism (R-617) is a calendar item,
not test effort — it must appear resolved-or-dated in this epic's gate. (The tax/terms sign-off session
is no longer a dependency: demo-data-only accept, R-610.)

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100% (no exceptions)
- **P1 pass rate:** ≥95% (waivers required for failures)
- **P2/P3 pass rate:** ≥90% (informational)
- **High-risk (≥6) mitigations:** 100% complete or approved waivers

### Coverage Targets

- **Snapshot builders + view model + lifecycle/send-gate logic (pure):** ≥90%
- **RLS negatives:** 100% of new quote tables (incl. `tenant_counters`) enrolled + exercised
- **Freeze/immutability proofs:** 100% of mutable-source classes covered by a mutate-after-capture
  test; both immutability layers (command + DB) exercised
- **PDF source-of-truth:** 100% of forbidden mutable sources covered by the regenerate-unchanged proof
- **Snapshot field checklist:** 100% of §11 fields asserted captured

### Non-Negotiable (epic blockers regardless of numeric score)

- [ ] Every new quote table: direct `tenant_id` + enable+**force** RLS + own-tenant policies +
      `anon → none` + **`TENANT_TABLES` enrollment** (H4 green)
- [ ] No cross-tenant calculation/attachment/version id accepted by any quote command
- [ ] **Sent versions immutable at the DATABASE** (trigger/constraint), not just command/UI; mutation
      via command returns `QUOTE_VERSION_LOCKED`
- [ ] **PDF reads snapshot tables only** — regenerate-after-mutation proof green
- [ ] Quote numbers allocated server-side, race-safe, tenant-scoped, inside the RPC transaction
- [ ] Blocking readiness gates mark-sent; tax content framed estimate + `requiresSignOff`, never
      legally-final (demo-data-only accept per R-610 — framing is what keeps the placeholders safe)
- [ ] v2 creation and lifecycle events leave prior sent versions byte-unchanged
- [ ] No internal notes / cost / margin data in customer-visible snapshot fields or PDF output
- [ ] **No real PII/secret** in any quote/PDF fixture or committed artifact (CI scan green)
- [ ] R-617 resolved per the retro hard mechanism: audit-gate PR landed OR dated owner-accept in this
      epic's gate report — a fifth silent carry is a gate CONCERNS by definition

---

## Mitigation Plans (High-Priority, Score ≥6)

### R-601: New quote-table isolation gap (Score 6, enrollment-gated)

**Strategy:** Reuse the proven migration pattern verbatim on all new tables including
`tenant_counters`; enroll everything in `TENANT_TABLES` with spoof/filter/mutation metadata before
merge (compile-exhaustive; H4 CI-fatal). **Owner:** Dev (6.1). **Timeline:** Story 6.1.
**Verification:** `6.1-INT-01`, `6.1-RLS-01/02`.

### R-602: Cross-tenant source id accepted (Score 6)

**Strategy:** Composite same-tenant FKs at the DB; command re-validates calculation + attachment
ownership under RLS (zero rows ⇒ `TENANT_ACCESS_DENIED`). **Owner:** Dev (6.1). **Timeline:** Story
6.1. **Verification:** `6.1-INT-02`.

### R-603: Snapshot incomplete / live-referencing (Score 6)

**Strategy:** Compose the three-times-proven copy-by-value + `Object.freeze` + injected-timestamp
discipline at composite-quote scale; assert the §11 field checklist (incl. FULL company identity);
prove the freeze behaviorally by mutating every source class after capture; pin content with goldens.
**Owner:** Dev (6.1). **Timeline:** Story 6.1. **Verification:** `6.1-INT-03/04`, `6.1-UNIT-01`,
`6.1-GOLDEN-01`.

### R-604: Quote number race (Score 6)

**Strategy:** Allocation inside the 6.1 narrow RPC transaction against `tenant_counters` (row lock /
atomic increment); numbering never client-side; concurrency INT test with parallel creations; spike
the pattern before 6.1 create-story (retro prep item). **Owner:** Dev (6.1). **Timeline:** Story 6.1.
**Verification:** `6.1-INT-05` (+ `6.1-UNIT-03` exploratory).

### R-605: Sent-immutability bypass (Score 6)

**Strategy:** Two independent layers — command guard (`QUOTE_VERSION_LOCKED`) AND DB trigger/constraint
per architecture §9; negatives attempt both routes; attachments and PDF-source data included in the
locked set; UI-only locking is a story STOP. **Owner:** Dev (6.4). **Timeline:** Story 6.4.
**Verification:** `6.4-INT-02/03`, `6.4-RLS-01`.

### R-606: PDF reads mutable data (Score 6)

**Strategy:** `QuotePdfViewModel` constructed solely from snapshot rows (provable input surface);
regenerate-after-mutation proof; text-extraction golden compares output to snapshot values. **Owner:**
Dev (6.3). **Timeline:** Story 6.3. **Verification:** `6.3-INT-01`, `6.3-UNIT-01`, `6.3-GOLDEN-01`.

### R-607: Internal content leaks into customer-visible output (Score 6)

**Strategy:** Structural separation of internal notes from customer-visible snapshot content (6.2 tech
note); unit guards assert exclusion of notes + cost/margin fields from snapshot customer-visible fields
and the view model; goldens contain no cost fields. **Owner:** Dev (6.1/6.2/6.3). **Timeline:** Stories
6.1-6.3. **Verification:** `6.2-UNIT-01`, `6.3-UNIT-01`, `6.3-GOLDEN-01`.

### R-608: Send bypasses readiness / unclear sent semantics (Score 6)

**Strategy:** Mark-sent consumes the 5.4 blocker classification unchanged (no fork); sent RPC takes an
explicit timestamp + records channel/reference + events; semantics change without approval = STOP.
**Owner:** Dev (6.4). **Timeline:** Story 6.4. **Verification:** `6.4-INT-01/04`, `6.4-UNIT-01`.

### R-609: New version / lifecycle events mutate prior versions (Score 6)

**Strategy:** 6.5 reuses the 6.1 RPC with explicit parent relationship + event; preservation proof
asserts v1's snapshot/PDF metadata/events/status byte-unchanged after v2 and after each lifecycle
event; v1/v2 goldens. **Owner:** Dev (6.5). **Timeline:** Story 6.5. **Verification:** `6.5-INT-01/02`,
`6.5-GOLDEN-01`.

### R-611: Quote-PDF private-file access gap (Score 6)

**Strategy:** Store exclusively through the 8.1 foundation (private bucket, server-derived paths,
metadata-first authorization, signed access); cross-tenant + anon negatives on file and metadata; no
public URL surface; broader storage matrix deferred to Epic 8 with cross-reference. **Owner:** Dev
(6.3). **Timeline:** Story 6.3 (after 8.1 lands). **Verification:** `6.3-INT-02`.

### R-615: Fixture/artifact PII leak (held at mitigate-control)

**Strategy:** Anonymized shape-only fixtures; extend the CI PII/secret scan (personnummer, non-test
email, orgnr shape, secrets) to quote snapshot fixtures and PDF-extracted text; a committed real
identifier is an epic blocker regardless of score. **Owner:** Dev (6.1/6.3). **Timeline:** Stories 6.1,
6.3. **Verification:** `6.x-UNIT-01`.

---

## Open Assumptions

1. **Story 8.1 lands before 6.3** per the approved execution order (currently backlog — entry
   criterion, R-614). If sequencing slips, 6.1/6.2 can proceed; 6.3 cannot.
2. **Quote number display format** remains an open owner question (architecture §16); the test design
   assumes format is presentation-only over a server-allocated integer sequence (6.1 STOP if it
   becomes a data-model blocker).
3. **Sent channel/reference semantics** assumed to be simple recorded fields ("if supported" per 6.4
   AC); material data-model impact = STOP.
4. **PDF renderer** chosen and pinned in the 6.3 story with H3 determinism properties; a heavyweight
   dependency (e.g., headless browser) needs approval (6.3 STOP).
5. **Tax/terms constants remain UNAPPROVED placeholders** with `requiresSignOff`; tests pin framing,
   not values. Owner decision 2026-07-03: MVP is demo-data-only, so this is an accepted residual
   until post-MVP; any proposal to put the app in front of a real customer re-scores R-610 to 6 and
   reinstates the sign-off session as a blocker (R-610).
6. **Lovable's mutable quote-version behavior** is an intentional, documented Phase A delta — golden
   comparisons label it, never replicate it.

---

## Follow-On Workflows

- `*atdd` — generate red-phase P0 scaffolds per story (run explicitly at story start; 6.1 first).
- `*trace` — epic-boundary traceability + gate decision after stories land.
- `*nfr-assess` — must show the R-617 hard-mechanism outcome (PASS or dated accept), per the Epic 5
  retro action item.
- `*test-review` — suite quality after the epic suite lands.

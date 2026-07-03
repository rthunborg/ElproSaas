---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-02'
workflowType: testarch-test-design
designLevel: epic
epicNum: 5
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 5, lines 1026-1211)
  - _bmad-output/planning-artifacts/architecture.md (§7 IN-list; §10 money/tax; §11 quote snapshot model; §12 PDF read-only sources; ADR-A009 narrow RPC)
  - _bmad-output/planning-artifacts/prd.md (FR19-FR29)
  - _bmad-output/project-context.md (Money/Tax/Quote Rules; Testing Rules; Security Regression Harness Rules; Critical Don't-Miss)
  - _bmad-output/test-artifacts/test-design-epic-4.md (house style + inherited money/snapshot/golden notes)
  - _bmad-output/test-artifacts/test-design-epic-3.md (RLS-heavy epic house style)
  - supabase/migrations/20260630120000_crm_data_model.sql (CRM composite same-tenant FK + RLS + GRANT pattern)
  - supabase/migrations/20260630140000_work_roles_and_articles.sql (pricing source rows Story 5.3 snapshots)
  - src/lib/money/** (Epic 4 pure engine — every total routes through it)
  - src/lib/snapshots/build.ts, types.ts; src/server/snapshots/resolve-source.ts (Story 3.5 snapshot contract Story 5.3 composes)
  - src/server/commands/crm/validation.ts (command validation model Story 5.1 follows)
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES enrollment + H4 gate contract)
  - tests/fixtures/golden/money/options-tillval.json (Epic 4 inclusion pin; R-508/R-514 cross-ref)
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
---

# Test Design: Epic 5 - Calculation Workspace And Quote Readiness

**Date:** 2026-07-02
**Author:** Rasmus
**Status:** Draft
**Design Level:** Epic-Level (Phase 4)
**Mode:** Risk-based, evidence-backed (Master Test Architect)

---

## Executive Summary

**Scope:** Epic-level test design for Epic 5 — the epic that makes calculations **tenant-owned,
testable, and ready to become immutable quote snapshots**. It is the first place the platform gives
tenant admins a workspace to *build the money*: three new tenant-owned tables (`calculations`,
`calculation_sections`, `calculation_rows`) with server commands (5.1); a focused calculation editor
UX with sections, rows, totals, and warnings (5.2); pricing-source selection that snapshots the chosen
work-role / article pricing onto rows (5.3); a readiness review that separates blockers from warnings
and previews the pre-quote snapshot (5.4); and a calculation golden-test pack for options, hidden rows,
and tax warnings (5.5).

**Epic goal (from epics.md):** Let tenant admins build Phase A calculations that are tenant-owned,
testable, and ready to become immutable quote snapshots — without letting an editable calculation
silently become the source of truth for a sent quote, under-testing hidden-row/tillval behavior, or
making tax warnings look legally final.

**Why this epic is risk-bearing (and how it differs from Epic 4):** Epic 4 was pure logic — no table,
no UI, RLS "not the headline." **Epic 5 is the opposite: RLS is the headline again**, exactly as in
Epics 2-3, because it introduces **three new tenant-owned tables** (the first calculation tables) that
each must carry direct `tenant_id`, composite same-tenant parent FKs to CRM roots + each other,
enable+force RLS with own-tenant policies, `anon → none` GRANTs, archive-over-delete, **and enrollment
in `TENANT_TABLES` before merge** (the standing Epic 2 contract enforced by the H4 inventory gate).
Simultaneously it is the **first heavy CONSUMER of the Epic 4 money engine and the Epic 3 snapshot
contract** — so a *second* class of risk sits on top of isolation: **every customer-visible total,
VAT, deduction, and inclusion decision must route through the frozen `@/lib/money` primitives and the
copy-by-value snapshot builders, never be re-derived inline in a command or a client component**. Three
failure classes dominate: (1) a **tenant-isolation gap** on a new calc table or a cross-tenant
customer/facility/contact/work-role/article link accepted by a command (R-501/R-502); (2) a **money/tax
correctness regression** from re-deriving a total inline or forking the öre/rounding/VAT rule instead
of calling the engine, or from a pricing-source snapshot that recomputes when a source rate later
changes (R-505/R-507/R-511); (3) a **readiness/quote-safety breach** — a blocker that only warns, a
hidden-row/tillval total that diverges from the owner-decided inclusion pin, or UI copy that makes a
tax warning look legally final or lets an editable calc mutate a sent quote (R-508/R-509/R-514/R-515).

**Risk Summary:**

- Total risks identified: **16**
- High-priority risks (score ≥6): **11**
- Critical (score 9 / auto-BLOCK at design time): **0** — but three controls are **epic blockers
  regardless of numeric score**: (a) any new calc table unenrolled in `TENANT_TABLES` / missing
  enable+force RLS + own-tenant policies + `anon → none` (R-501, held at 6 only because the H4 gate
  makes enrollment mandatory — an unenrolled table FAILS CI by design); (b) any customer-visible total /
  VAT / deduction re-derived inline instead of through `@/lib/money` (R-505); (c) any hidden-row /
  selected-tillval total that diverges from the **owner-decided 2026-06-18 inclusion pin** already
  golden-frozen in `options-tillval.json` (R-508/R-514).
- Critical categories: **SEC** (tenant isolation on 3 new tables, cross-tenant parent/source links),
  then **DATA** (math-via-engine, pricing-source snapshot freeze, atomic multi-row reorder/save
  consistency, öre discipline on new money columns), then **BUS/compliance** (readiness
  blocker-vs-warning classification, hidden-row/tillval totals inclusion, "new version required after
  send" messaging, tax-warning-not-final framing, fixture privacy).

**Coverage Summary:**

- **P0 (Critical):** ~30-44 tests — RLS negatives on all 3 calc tables + cross-tenant parent/source
  link rejection; command validation (row type, qty/unit, öre, VAT assumption, lifecycle); math routed
  through `@/lib/money`; pricing-source snapshot capture + freeze; readiness blocker-vs-warning
  classification; golden inclusion pins (hidden rows / selected tillval); fixture privacy.
- **P1 (High):** ~20-30 tests — editor UX (keyboard editing, validation-preserves-input, destructive
  confirm, section/row ordering, responsive stacking, totals refresh), atomic multi-row reorder/save,
  archived-source explainability, warnings coverage breadth, snapshot-preview content, migration reset
  per-table policy enumeration.
- **P2 (Medium):** ~8-14 tests — display-mode selection, absence-of-deferred-labels, zero/empty-section
  edges, documented old/new deltas.
- **P3 (Low):** ~4-7 tests — exploratory/property (qty×price via engine), DX errors, residual docs.
- **Total:** ~62-95 tests across UNIT / INT / RLS / E2E / GOLDEN / DOCS levels.

---

## Inherited Foundation (what Epic 5 builds on, not rebuilds)

Epics 2-4 shipped the isolation harness, the money engine, and the snapshot contract Epic 5 now
composes. Verified in-repo; Epic 5 must **reuse**, not re-invent, these:

| Inherited asset | Where | Epic 5 obligation |
| --- | --- | --- |
| CRM table pattern: direct `tenant_id`, **composite same-tenant parent FK** `(child.parent_id, tenant_id) → parent(id, tenant_id)`, enable+**force** RLS with own-tenant `is_tenant_admin` SELECT/INSERT/UPDATE policies, `anon → none` GRANT, **archive-over-delete** (`archived_at`, no delete policy), `set_updated_at()` trigger reuse | `supabase/migrations/20260630120000_crm_data_model.sql` | `calculations` (→ customer/facility/contact same-tenant FKs), `calculation_sections` (→ calculations same-tenant FK), `calculation_rows` (→ sections same-tenant FK) each REUSE this exact pattern. A bare `references calculations(id)` (non-composite) is a cross-tenant hole — use the composite FK. Lifecycle/status + ordering columns added; **no deferred job/project/field-worker table**. |
| `TENANT_TABLES` enrollment + H4 inventory gate (compile-exhaustive `switch(table)`+`assertNever`; introspects live schema and FAILS CI on an unenrolled tenant table) | `tests/integration/rls/tenant-table-inventory.ts`; `rls-inventory-gate.int.test.ts` | **STANDING CONTRACT:** all 3 calc tables MUST enroll in `TENANT_TABLES` (with spoof/filter/mutation metadata) BEFORE merge, or CI fails. The cross-tenant + anon-path suites read the same inventory. This is R-501's automated backstop — not reviewer diligence. |
| Server command Result model: typed `Result<T, CommandErrorCode>` (never throw), `verifyOwnership` semantics (tenant-scoped SELECT under RLS → zero rows ⇒ `TENANT_ACCESS_DENIED`; transient error ⇒ retryable `SERVER_ERROR`, not masked as no-access), validation returns narrowed value or `VALIDATION_FAILED` and NEVER echoes the raw invalid value, allow-listed audit metadata | `src/server/commands/envelope.ts`, `command-errors.ts`, `crm/validation.ts` | 5.1 calc commands REUSE this: validate tenant membership, CRM-parent ownership, row type, qty/unit, öre money, VAT assumption, lifecycle — all as typed `Result`; a cross-tenant parent/source id ⇒ `TENANT_ACCESS_DENIED`; generic Swedish user messages; no raw-value echo. |
| **Pure `@/lib/money` engine** — integer öre end-to-end, line-level round-half-away-from-zero, `sumOre`/`sumVatOre` = sum-of-rounded, `lineVatOre`/`vatBreakdown` from `vat_rate_bp` (no 25% literal), `selectVatDisplay` presentation-only, `estimateDeduction` returns `requiresSignOff:true` structurally + blocks ROT×grön mix, single kronor formatter `formatOreAsKronor` | `src/lib/money/{ore,vat,tax,index}.ts` | 5.1/5.2/5.4/5.5 **route EVERY total/VAT/net/gross/deduction through the engine** — never re-derive a total inline in a command or client component (R-505). The editor's displayed totals and the readiness math both call the engine. New money columns reuse `isOreAmount`/`ORE_AMOUNT_MAX`. |
| Snapshot-source contract: copy-by-value + `Object.freeze`, pure/deterministic, injected `capturedAt` (no clock), captures STATE computes nothing; `resolveSnapshotSource` RLS resolver (anon key, own-tenant SELECT, cross-tenant/nonexistent id ⇒ `TENANT_ACCESS_DENIED`) + per-kind `WorkRoleSourceRow`/`ArticleSourceRow` builders | `src/lib/snapshots/build.ts`, `types.ts`; `src/server/snapshots/resolve-source.ts` | 5.3 **composes** `resolveSnapshotSource(work_role|article)` then the matching pure builder into the row-write command; the row stores the frozen `{id, name, öre value, source updated_at, tenant}` so a later archive/rate-change NEVER mutates a prior row snapshot (R-507). Cross-tenant source id rejected at both layers. |
| Options/tillval + hidden-row **inclusion pin** (owner decision 2026-06-18): a SELECTED option and a HIDDEN row COUNT toward basis/net/VAT; an UNSELECTED option does NOT — golden-frozen, driving the real engine primitives | `tests/fixtures/golden/money/options-tillval.json`; `tests/unit/lib/money/golden-pack.test.ts` | Epic 4 pinned the pure INCLUSION rule; **Epic 5 owns the UI visibility/selection semantics + the PERSISTENCE** of which rows are hidden/optional/selected, and its totals MUST match the pinned inclusion (R-508/R-514). 5.5 extends this pin to calc-row fixtures; it does not fork the rule. |
| Two-runner stack + Playwright e2e (real, CI-gated) + two-tenant fixture; per-run unique ids for count-asserting tests; ATDD red-phase header hygiene | project-context Testing Rules; `scripts/run-tests.mjs`; `tests/factories/**` | 5.1/5.3 land INT + RLS (Vitest/DB); 5.2/5.4 land E2E (Playwright) + pure UNIT for extracted logic; 5.5 lands GOLDEN under `tests/unit/**` (NOT `tests/golden/**` — the runner-glob trap). Count-asserting calc tests seed `crypto.randomUUID()`. |
| Personnummer discipline: stored access-controlled for `private` customers only; the pure engine takes an eligibility POSTURE, never PII | project-context Money/Tax; `customers.personnummer` | 5.4 readiness may WARN on ROT eligibility using the resolved posture, but must NOT route personnummer into `@/lib/money` or into a calc row/snapshot; no PII in calc fixtures (R-516). |

**What is genuinely NEW in Epic 5 (needs fresh coverage):** the 3 calc tables + their RLS + enrollment;
calc server commands (create/edit calc, section, row; reorder; archive); the calculation EDITOR UI
(first heavy new UI since Epic 3); pricing-source SELECTION + row snapshot composition; the READINESS
classifier (blocker vs warning) + pre-quote snapshot PREVIEW; and the calc GOLDEN pack. This is a
**full-stack epic** — UNIT + INT + RLS + E2E + GOLDEN — the widest test surface since Epic 3.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Quote version creation / persistence, quote number generation, PDF render, version immutability + send/accept** | Epic 6/7 own quote versions/PDF/lifecycle (epics.md Epic 6-7; 5.4 tech note: "prepares quote snapshot inputs but does not create quote versions") | 5.4 builds the pre-quote **preview** + captures readiness warnings at snapshot time; the actual `createQuoteVersionFromCalculation` freeze + immutability-on-send is an Epic 6 concern (cross-ref). 5.4 tests the PREVIEW content + the "new version required after send" MESSAGE, not the send command. |
| **Owner/accounting/legal APPROVAL of ROT/grön-teknik/VAT-display constants + disclaimer wording** | Standing Epic 4 sign-off; engine values are UNAPPROVED conservative placeholders (project-context) | 5.4 surfaces tax assumptions as WARNINGS + a "requires sign-off" posture; it NEVER renders a deduction as approved/legally-final (R-509). The unapproved profiles come from the engine unchanged. |
| **Per-person ROT cap MULTIPLIER (`persons` scaling)** | Known inert placeholder — a single flat `capOre`; `persons` does NOT scale it; multiplier is owner-gated (Sign-Off Q3) | 5.5 golden may thread `persons` into fixtures (as Epic 4 does) but MUST NOT assert a per-person scaled cap — that would encode an unimplemented, unapproved rule (R-512). |
| **Document-level rounding; discount / negative-amount data model** | Explicit STOP conditions (project-context Money/Tax; report `needs-human`) | Line-level rounding via the engine is the tested assumption; a discount/negative row model is escalated, not invented (R-511). |
| **Field-worker UX, project planning, time/material reporting, ÄTA/deviation, supplier APIs/imports, AI estimation, broad analytics** | Epic 5 explicit non-scope (epics.md 5 "Explicit non-scope"); AGENTS.md deferred | The editor exposes NONE of these labels; a test asserts absence of deferred-workflow labels (5.2 test req). No deferred table/nav item/flag scaffolding. |
| **File UPLOAD UX + entity file panels** | Story 8.2 owns upload UX; Story 8.1 owns file metadata foundation (epics.md Epic 5 dependencies) | 5.4 readiness may FLAG "missing required files" using file metadata if 8.1 has landed; the upload flow + panels are Epic 8. If 8.1 has not landed at implementation time, the required-file check is a documented deferral (R-513). |
| **Reusable article catalog beyond the minimal manual register; supplier scope** | Story 3.4 minimal manual articles only; HARD no-supplier-scope (project-context) | 5.3 article-source selection uses the existing minimal `articles` register; NO supplier/import/api/sync/external-mapping field enters a row snapshot (column-name guard reused). |
| **Real Lovable calculation data import** | Lovable is a behavioral oracle only; fixtures anonymized (AGENTS.md) | 5.5 golden fixtures are anonymized shape-only; Lovable deltas captured as documented old/new/delta, never copied data (R-516). |
| **Calculation performance at scale** | Pure in-memory + quote-sized inputs; no Phase-A SLA | Functional correctness (isolation + math + readiness) is the Phase-A concern; perf deferred as documented residual (R-510 low). |

---

## Risk Assessment

Scoring per `probability-impact.md`: Probability 1 (unlikely) / 2 (possible) / 3 (likely);
Impact 1 (minor) / 2 (degraded) / 3 (critical). Score = P × I. Thresholds: 1-3 DOCUMENT,
4-5 MONITOR, 6-8 MITIGATE (CONCERNS at gate), 9 BLOCK (auto-FAIL).

**Impact rationale (why so many Impact 3):** Epic 5 produces the **customer-visible money** (totals,
VAT, deductions) that Epic 6 snapshots into an immutable quote and PDF that cannot be silently
corrected after send. A tenant-isolation gap on a calc table exposes another tenant's pricing/estimate
(regulatory + commercial); a wrong total from re-derived math or a wrong inclusion decision flows into
every quote built on it; a blocker that only warns lets an unsafe commitment be versioned. These are
**Impact 3**. **Probability is held at 2** for most — the isolation harness (composite FK + RLS +
enrollment gate), the pure engine, and the freeze contract already exist and are proven, so the residual
is *correct composition of proven primitives*, not an unaddressed design gap. Probability drops to **1**
where a proven automated gate makes the failure hard to reach silently (fixture PII scan; H4 gate),
and to Impact 2 where the concern is degraded-not-critical (editor UX papercuts; documented deferrals).

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-501 | SEC | **New calc table isolation gap** — a `calculations`/`calculation_sections`/`calculation_rows` table ships without direct `tenant_id`, without enable+**force** RLS + own-tenant policies, with a wrong `anon` GRANT, or **unenrolled in `TENANT_TABLES`** → cross-tenant read/write of another tenant's estimate | 2 | 3 | 6 | Reuse the CRM migration pattern verbatim (direct tenant_id, enable+force RLS, own-tenant `is_tenant_admin` policies, `anon → none`, archive-over-delete); **enroll all 3 in `TENANT_TABLES` with metadata BEFORE merge** (H4 gate FAILS CI otherwise); migration-reset + RLS negative + anon-path suites per table | Dev (5.1) | Story 5.1 |
| R-502 | SEC | **Cross-tenant parent/source link accepted** — a command lets tenant A link a tenant B customer/facility/contact (calc parent) or work-role/article (row source), or a bare non-composite FK lets a child point at another tenant's parent | 2 | 3 | 6 | Composite same-tenant FKs `(child, tenant_id) → parent(id, tenant_id)` at the DB; command RE-VALIDATES CRM-parent + source ownership via `resolveSnapshotSource`/`verifyOwnership` (zero rows ⇒ `TENANT_ACCESS_DENIED`); INT negatives spoof a foreign parent id AND a foreign source id | Dev (5.1/5.3) | Stories 5.1, 5.3 |
| R-503 | DATA/SEC | **Non-atomic multi-row reorder/save** implemented as client-side multi-step persistence (the consistency boundary in the browser) → partial writes / interleaved orders / lost updates under concurrency; explicitly forbidden by 5.1 tech note | 2 | 3 | 6 | Multi-record section/row saves + reorders that must be atomic use a **narrow Postgres RPC or an approved server DB transaction adapter** (5.1 tech note; ADR-A009), NOT client-side steps; INT test asserts a mid-transaction failure rolls back fully (no partial order/rows); ordering is server-owned | Dev (5.1) | Story 5.1 |
| R-504 | DATA | **Row validation gaps** — a command accepts an invalid row type, missing/zero-or-negative quantity, a bad unit, a float-kronor or negative öre money value, a missing/invalid VAT assumption, or an illegal lifecycle transition | 2 | 3 | 6 | Command validation (mirrors `crm/validation.ts`): closed row-type union, qty>0 + explicit unit, `isOreAmount` re-validation on every öre field, VAT assumption present + basis-points-shaped, lifecycle state machine; UNIT for the pure validators + INT for the command; raw invalid value never echoed | Dev (5.1) | Story 5.1 |
| R-505 | DATA/BUS | **Totals re-derived inline** — a command or a `"use client"` editor component computes a line net / section total / VAT / deduction itself instead of routing through the frozen `@/lib/money` engine → a forked, drifting, unpinnable customer-visible number that escapes the golden gate | 2 | 3 | 6 | Every total/VAT/net/gross/deduction routes through `@/lib/money` (`sumOre`/`lineVatOre`/`estimateDeduction`/`selectVatDisplay`); EXTRACT calc/display logic out of client components into pure functions unit-pinned at the real call site (coverage-shape lesson); review grep confirms no inline `+`/`*`/`0.25` money math; UNIT proves the editor total == engine total | Dev (5.2/5.4) | Stories 5.2, 5.4 |
| R-506 | DATA | **Öre discipline broken on new money columns** — a calc-row unit cost / sell price / total stored as float kronor (or a calc money field forks a second öre-validity rule) → non-reproducible drifting totals | 2 | 3 | 6 | All calc money columns are `bigint` integer öre with a DB `CHECK (..._ore >= 0)`; commands re-validate via the CANONICAL `isOreAmount`/`ORE_AMOUNT_MAX` (no fork); UNIT for reject float/negative/overflow/locale-comma; kronor only at the presentation formatter | Dev (5.1) | Story 5.1 |
| R-507 | DATA | **Pricing-source snapshot recomputes** — a row holds a live reference to the mutable `work_role`/`article` row (or re-reads it later) instead of the frozen copy-by-value snapshot → a later archive or rate change silently changes a prior row's price / breaks explainability | 2 | 3 | 6 | 5.3 composes `resolveSnapshotSource` + the pure freeze builder; the row stores `{source id, name/number/unit, price öre, source updated_at "version", tenant}` copied-by-value + frozen; INT proves mutating/archiving the source AFTER capture does NOT change the row snapshot; the row stays explainable from its own fields | Dev (5.3) | Story 5.3 |
| R-508 | BUS/DATA | **Hidden-row / selected-tillval totals inclusion diverges** from the owner-decided 2026-06-18 pin — hidden rows or unselected/selected options counted wrongly toward basis/net/VAT/deduction → wrong customer total, or an unselected option silently billed | 2 | 3 | 6 | Totals obey the golden-pinned inclusion rule (hidden + selected COUNT; unselected does NOT), driven through the engine; 5.5 extends `options-tillval.json` to calc-row fixtures; GOLDEN asserts an unselected option is NEVER summed and a hidden row IS; **divergence from the pin is an epic blocker** — a DIFFERENT rule treated as production-approved is a STOP (needs-human) | Dev (5.4/5.5) | Stories 5.4, 5.5 |
| R-509 | BUS | **Readiness misclassifies blocker vs warning, or renders a tax warning as legally final** — a blocking condition surfaces only as a soft warning (unsafe commitment versionable), or ROT/grön-teknik/VAT copy looks approved/final rather than "estimate, requires sign-off" | 2 | 3 | 6 | 5.4 classifier separates BLOCKERS from WARNINGS explicitly (unit-pinned rule table); tax warnings carry the engine's `requiresSignOff` posture + non-final framing; UNIT for classification of each condition; E2E asserts blockers gate the "create quote version" affordance and warnings do not silently disappear | Dev (5.4) | Story 5.4 |
| R-511 | DATA/BUS | **Rounding / discount / negative semantics invented** — the editor or a command introduces document-level rounding, a discount, or a negative row without the engine/data-model support (both are STOP conditions) | 2 | 3 | 6 | Line-level rounding ONLY, via the engine's sum-of-rounded; NO discount/negative-amount model invented — a genuine need is escalated (`needs-human`), not coded; UNIT/GOLDEN pin line-level behavior; review confirms no document-level or discount path added | Dev (5.1/5.2) | Stories 5.1, 5.2 |
| R-516 | SEC/BUS | **Calc golden-fixture PII/secret leak** — a 5.5 fixture commits a real name/email/phone/address/**personnummer/orgnr**/secret/raw customer file, or personnummer enters a calc row/snapshot/the engine | 1 | 3 | 3 → held at 6-equivalent control | Anonymized shape-only fixtures under `tests/fixtures/golden/**`; REUSE the existing golden PII/secret scan (personnummer `\d{6}-\d{4}`, non-`example.test` email, orgnr shape, `secret|password|api_key`) in the CI unit gate; UNIT asserts no PII path into `@/lib/money` or a row snapshot; the engine takes an eligibility POSTURE, never PII |  Dev (5.5) | Story 5.5 |

> Note on R-516: the raw P×I is 1×3 = 3, but — mirroring Epic 4's R-411 — it is held to the
> **MITIGATE** discipline because the control (anonymize + CI-scan) must be mandatory: a committed real
> personnummer/orgnr in a golden fixture is an **epic blocker regardless of score**.

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| R-514 | BUS | **Editor "new version required after send" message missing/wrong** — after a sent quote exists, the UI mutates or implies it can mutate the sent version instead of explaining a new version is required | 2 | 2 | 4 | 5.4 AC3: the UI EXPLAINS a new quote version is required for customer-visible changes rather than mutating the sent version; E2E/UNIT asserts the message appears in the sent-quote-exists state; the actual send/immutability enforcement is Epic 6 (cross-ref) | Dev (5.4) |
| R-515 | TECH/OPS | **Editor UX defects escape the fast gate** — validation errors discard unsaved input, destructive delete lacks confirmation, section/row reorder mis-orders, responsive layout overlaps controls, totals don't refresh — logic living inline in a client island only caught by slow e2e | 2 | 2 | 4 | Extract editor CONTRACT logic (ordering, validation-preserve, totals) into pure functions unit-pinned (coverage-shape lesson); E2E for keyboard editing, destructive-confirm, ordering, responsive stacking, totals refresh; per-run unique ids for any count assertion | Dev (5.2) |
| R-512 | BUS | **`persons` per-person ROT cap assumed implemented** — a 5.4/5.5 case asserts a per-person-scaled cap that does not exist (flat `capOre`, `persons` inert) | 1 | 3 | 3 | Thread `persons` into fixtures as Epic 4 does but assert the FLAT cap; a per-person multiplier is owner-gated (Sign-Off Q3) — do not encode it; DOCS residual notes the placeholder | Dev (5.5) |
| R-513 | OPS/BUS | **Required-file readiness check depends on Story 8.1** — 5.4 must flag "missing required files" but the file metadata foundation (8.1) may not have landed at 5.4 implementation time | 2 | 2 | 4 | If 8.1 has landed, wire the check to file metadata; if not, the required-file warning is a DOCUMENTED deferral surfaced in the readiness output + gate, not a silent omission; monitor sequencing | Dev (5.4) + PM |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Prob | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- |
| R-510 | PERF/OPS | Calc-at-scale perf untested (pure in-memory, no SLA) **+** the two standing NFR CONCERNS carried since Epic 2 (no `pnpm audit` CI dependency-scan gate, no coverage reporter) reach the first UI+DB epic since Epic 3 | 1 | 2 | 2 | Monitor; correctness (isolation + math + readiness), not perf, is the Phase-A concern. **Surface the two standing NFR concerns to the owner in this epic's gate — schedule-or-accept, do not keep silently carrying them** (project-context; also flagged Epic 4 R-414). |

### Risk Category Legend

- **TECH**: Technical/Architecture (editor logic escaping the fast gate; message plumbing)
- **SEC**: Security (calc-table isolation, cross-tenant parent/source links, fixture/row PII)
- **PERF**: Performance (calc at scale)
- **DATA**: Data Integrity (atomic reorder, öre discipline, math-via-engine, source-snapshot freeze, inclusion, rounding)
- **BUS**: Business/Compliance (readiness classification, hidden-row/tillval inclusion, new-version messaging, tax-not-final, persons cap, required-files, fixture privacy)
- **OPS**: Operations (standing NFR gates, 8.1 sequencing)

---

## Testability Notes (Epic-Level)

Epic 5 spans the **full test pyramid** — the widest surface since Epic 3 — so level discipline matters
more than in pure-logic Epic 4. Six concerns worth flagging:

1. **RLS is the headline again — negatives BEFORE positives, and enrollment is the gate.** Each new
   calc table gets migration-reset + cross-tenant read/write negatives + anon-path isolation, and MUST
   enroll in `TENANT_TABLES` so the H4 gate enforces coverage automatically. Do not hand-write ad-hoc
   isolation tests that bypass the shared inventory — the compile-exhaustive metadata model is the
   completeness guarantee (project-context Security Regression Harness Rules).
2. **Push money/tax correctness to UNIT + GOLDEN through the engine — never re-assert the math in the
   UI or a command.** `test-levels-framework`: pure calculation ⇒ unit. The editor and readiness tests
   assert *the total equals the engine's total* and that logic is *extracted* into pure functions
   (coverage-shape lesson), not that the number is right (Epic 4's goldens already pin the number).
   A total computed inline in a client island escapes the fast gate — extract it and unit-pin it (R-505).
3. **The pricing-source snapshot freeze is a *behavioral* assertion (mirrors Epic 3/4 freeze tests).**
   R-507's test must mutate/archive the source AFTER capture and prove the prior row snapshot is
   unchanged — not merely that the fields exist. Reuse the Epic 3/4 copy-by-value + injected-`capturedAt`
   discipline.
4. **Readiness classification is a rule table, not prose — unit-pin every blocker-vs-warning decision.**
   R-509's test enumerates each condition (low margin, missing customer/facility/contact, empty section,
   zero-price row, missing work role on labor row, unresolved VAT/tax, ROT/grön sign-off, hidden rows in
   totals, missing required files) and asserts its BLOCKER-vs-WARNING classification. Extract the
   classifier as a pure function; the E2E only proves blockers gate the create-quote affordance.
5. **The inclusion pin is already frozen — Epic 5 must MATCH it, not re-decide it.** Hidden-row /
   selected-tillval totals reuse `options-tillval.json`'s owner-decided rule. 5.5 extends the fixture to
   calc rows; a *different* inclusion rule treated as production-approved is a STOP (needs-human), not a
   test to author (R-508).
6. **E2E hygiene: reuse the two-tenant fixture, seed unique ids, clear red-phase headers.** Calc E2E
   asserting row/section counts MUST seed `crypto.randomUUID()` (non-reset local runs + parallel workers
   accumulate/collide otherwise); when flipping an ATDD scaffold green, clear the `describe.skip`/
   `notYetImplemented` red-phase header (recurring hygiene gap); goldens go under `tests/unit/**`, never
   `tests/golden/**` (the vacuous-green runner-glob trap).

---

## Entry Criteria

- [ ] Epics 2-4 merged and green in `main` — the CRM composite-FK + RLS + enrollment pattern, the
      `@/lib/money` pure engine (188+ money units + golden pack), the copy-by-value snapshot contract +
      `resolveSnapshotSource`, and the two-runner + Playwright + two-tenant harness all live
- [ ] `pnpm test` runs UNIT (`node --test`) + INT/RLS (Vitest, local Supabase stack) + e2e (Playwright);
      `SUPABASE_TEST_REQUIRED=1` in CI so a missing stack hard-fails (no silent false-green)
- [ ] **Calc data model agreed** — `calculations`/`calculation_sections`/`calculation_rows` columns
      (tenant_id, CRM parent FKs, lifecycle/status, ordering, row type, qty/unit, integer-öre money,
      VAT assumption, visibility/option flags), archive-over-delete, NO deferred job/project field
- [ ] **Row-type set + lifecycle state machine agreed** (labor/material/subcontractor/machinery/other;
      the calc lifecycle states + legal transitions) as the command-validation contract
- [ ] **Atomic-write approach chosen** — narrow Postgres RPC or approved server transaction adapter for
      multi-row reorder/save (ADR-A009); NOT client-side multi-step persistence (5.1 tech note)
- [ ] **Inclusion + rounding + tax posture inherited unchanged from Epic 4** — hidden/selected inclusion
      per the 2026-06-18 pin; line-level rounding; ROT/grön/VAT values remain UNAPPROVED placeholders
      with `requiresSignOff`
- [ ] Story 8.1 file-metadata foundation status known (drives whether 5.4's required-file check is wired
      or a documented deferral — R-513)
- [ ] Anonymized Lovable calc oracle examples available for 5.5 delta capture (no real data copied)

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing or each failure explicitly triaged/waived
- [ ] **Isolation proven** — all 3 calc tables enrolled in `TENANT_TABLES`; H4 gate green; cross-tenant
      read/write + anon-path negatives pass per table; a foreign customer/facility/contact/work-role/
      article link is rejected (`TENANT_ACCESS_DENIED`) by the command
- [ ] **Migration reset from empty proven** with the EXACT per-table policy enumeration; no deferred
      job/project/field-worker table created
- [ ] **Atomic multi-row writes proven** — a mid-transaction failure rolls back fully (no partial
      order/rows); ordering is server-owned; NO client-side multi-step consistency boundary
- [ ] **Row validation proven** — invalid row type / non-positive qty / bad unit / float-negative-öre /
      missing VAT assumption / illegal lifecycle transition rejected as `VALIDATION_FAILED`; raw value
      never echoed
- [ ] **Math-via-engine proven** — every displayed/persisted total/VAT/net/gross/deduction routes
      through `@/lib/money`; the editor total == engine total (unit); no inline money math or öre fork
- [ ] **Öre discipline proven** — all calc money columns integer öre (`bigint`, DB `CHECK >= 0`),
      re-validated by the canonical `isOreAmount`; float/negative/overflow rejected
- [ ] **Pricing-source snapshot frozen** — a row stores the copy-by-value frozen source; mutating/
      archiving the source after capture does NOT change the prior row; the row stays explainable
- [ ] **Readiness proven** — blockers separated from warnings per the pinned rule table; blockers gate
      the create-quote affordance; warnings cover the full 5.4 list; tax warnings framed as estimate +
      `requiresSignOff` (never legally-final); "new version required after send" message present
- [ ] **Inclusion proven** — hidden rows + selected tillval count toward totals; unselected options
      never summed; matches the golden pin; 5.5 calc-row fixtures green
- [ ] **Golden pack complete + labelled** — covers labor/material/subcontractor/machinery/other rows,
      fractional quantities, margins, options/tillval, hidden rows, detailed/summary/text-only section
      modes, VAT display, ROT/grön warnings, attachment-readiness flags; each expected value labelled
      old-Lovable / new-expected / documented-delta; a failure points to the affected assumption
- [ ] **Fixture + row privacy green** — no real names/emails/phones/addresses/personnummer/orgnr/
      secrets/raw files (CI scan); no PII in `@/lib/money` or a row snapshot
- [ ] No open high-priority (≥6) risk unmitigated/unwaived; the two standing NFR concerns (no `pnpm
      audit` gate, no coverage reporter) surfaced to owner for schedule-or-accept

---

## Test Coverage Plan

> **P0/P1/P2/P3 = priority / risk classification, NOT execution timing.** Execution timing is defined
> separately in the Execution Strategy section below.

Test ID format `{EPIC}.{STORY}-{LEVEL}-{SEQ}`. Levels for Epic 5: **UNIT** (pure `node --test`),
**INT** (Vitest, DB-backed command/migration), **RLS** (Vitest cross-tenant/anon negatives),
**E2E** (Playwright editor flows), **GOLDEN** (data-driven UNIT over `tests/fixtures/golden/**`), and
**DOCS** (documented residual/assumption). Epic 5 is the **first epic since Epic 3 to exercise all
levels** — the deliberate widening after pure-logic Epic 4.

### P0 (Critical)

**Criteria**: Blocks core (isolation / correct customer-visible money / quote-readiness safety) + high
risk (≥6) + no workaround.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 5.1-INT-01 | Migration reset from empty creates calculations/sections/rows with tenant ownership, parent same-tenant consistency, lifecycle/status, ordering, integer-öre money; no deferred job/project/field table (5.1 AC1) | INT | R-501, R-506 | 2-3 | Dev | Per-table policy enumeration; assert absence of deferred tables |
| 5.1-RLS-01 | Cross-tenant read/write rejected on all 3 calc tables; anon path has no access (5.1 AC3) | RLS | R-501 | 6-9 | Dev | Via enrolled `TENANT_TABLES` metadata; spoof + filter + mutation per table |
| 5.1-RLS-02 | H4 inventory gate green — all 3 calc tables enrolled with metadata (standing contract) | RLS | R-501 | 1 | Dev | Unenrolled table FAILS CI by design; compile-exhaustive |
| 5.1-INT-02 | Command rejects a cross-tenant customer/facility/contact parent link on calc create/edit (5.1 AC3) | INT | R-502 | 3-4 | Dev | Foreign parent id ⇒ `TENANT_ACCESS_DENIED`; composite FK backstop |
| 5.1-INT-03 | Multi-row reorder/save is atomic (narrow RPC / server txn) — a mid-transaction failure rolls back fully; no partial order/rows (5.1 tech note) | INT | R-503 | 2-3 | Dev | Ordering server-owned; NOT client-side multi-step |
| 5.1-UNIT-01 | Row validation: closed row-type union, qty>0 + unit, öre money, VAT assumption, lifecycle transition (5.1 AC2) | UNIT | R-504 | 5-8 | Dev | Pure validators mirror `crm/validation.ts`; raw value never echoed |
| 5.1-INT-04 | Command re-validates row type/qty/unit/money/VAT/lifecycle; invalid ⇒ `VALIDATION_FAILED` (5.1 AC2) | INT | R-504 | 3-4 | Dev | Command-layer authority over the UI parse |
| 5.1-UNIT-02 | Calc money columns integer öre via canonical `isOreAmount`/`ORE_AMOUNT_MAX`; float/negative/overflow/locale-comma rejected (5.1 AC1) | UNIT | R-506 | 3-4 | Dev | No forked öre rule; DB `CHECK >= 0` belt-and-braces |
| 5.2-UNIT-01 | Editor totals == `@/lib/money` engine totals; calc/display logic extracted into pure functions (5.2 AC / money impact) | UNIT | R-505 | 4-6 | Dev | Coverage-shape lesson; no inline money math in the client island |
| 5.3-INT-01 | Labor row stores frozen work-role snapshot (role id/name, cost/sell öre, source updated_at "version", tenant); article row stores frozen article snapshot (5.3 AC1/AC2) | INT | R-507 | 3-4 | Dev | Composes `resolveSnapshotSource` + pure builder; no supplier field |
| 5.3-INT-02 | Mutating/archiving the source AFTER capture does NOT change the prior row snapshot; row stays explainable (5.3 AC3) | INT | R-507 | 2-3 | Dev | Behavioral freeze proof, mirrors Epic 3/4 |
| 5.3-INT-03 | Cross-tenant work-role/article source id rejected at both layers (`TENANT_ACCESS_DENIED`) (5.3 test req) | INT/RLS | R-502 | 2-3 | Dev | Source-spoof negative |
| 5.4-UNIT-01 | Readiness classifier separates BLOCKERS from WARNINGS per the pinned rule table (5.4 AC1) | UNIT | R-509 | 6-9 | Dev | One case per condition; pure function |
| 5.4-UNIT-02 | Tax warnings carry `requiresSignOff` posture + non-final framing; a deduction is never rendered approved/legally-final (5.4 AC1) | UNIT | R-509 | 2-3 | Dev | Behavioral: estimate, not final |
| 5.4-E2E-01 | Blockers gate the "create quote version" affordance; warnings do not silently disappear (5.4 AC1/AC2) | E2E | R-509 | 2-3 | Dev | Playwright, two-tenant fixture |
| 5.4-GOLDEN-01 | Hidden rows + selected tillval COUNT toward basis/net/VAT/deduction; unselected option NEVER summed — matches the 2026-06-18 pin (5.4 AC / 5.5 AC1) | GOLDEN | R-508 | 3-5 | Dev | Extends `options-tillval.json`; divergence is a STOP |
| 5.5-GOLDEN-01 | Calc golden pack: labor/material/subcontractor/machinery/other, fractional qty, margins, options/tillval, hidden rows, detailed/summary/text-only modes, VAT display, ROT/grön warnings, attachment-readiness (5.5 AC1) | GOLDEN | R-508, R-505 | 8-12 | Dev | Drives the real engine primitives; the recurring calc oracle |
| 5.5-UNIT-01 | Fixture privacy: no real names/emails/phones/addresses/personnummer/orgnr/secrets/raw files; no PII into `@/lib/money`/a row snapshot (5.5 AC3) | UNIT | R-516 | 2-3 | Dev | Reuse + extend the golden PII/secret scan; runs in CI |

**Total P0**: ~30-44 tests

### P1 (High)

**Criteria**: Important correctness/behavior + medium/high risk + common paths.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 5.2-E2E-01 | Editor keyboard editing of labor/material/subcontractor/machinery/other rows; validation errors PRESERVE unsaved input (5.2 AC2/AC3) | E2E | R-515 | 3-4 | Dev | Playwright; no data loss on validation |
| 5.2-E2E-02 | Destructive delete of sections/rows requires confirmation when rows would be removed (5.2 AC2) | E2E | R-515 | 2-3 | Dev | Confirm gate |
| 5.2-UNIT-02 | Section/row ORDERING logic (create/rename/reorder/duplicate/delete) extracted + unit-pinned (5.2 AC2) | UNIT | R-515 | 3-4 | Dev | Pure ordering function; stable order |
| 5.2-E2E-03 | Responsive layout: header/customer context/status/workspace/totals-readiness on desktop; stacks safely on narrow screens without overlapping controls (5.2 AC1) | E2E | R-515 | 2-3 | Dev | Viewport matrix |
| 5.2-E2E-04 | Totals/readiness summary REFRESHES on row/section edit (5.2 AC1/test req) | E2E | R-505, R-515 | 1-2 | Dev | Totals reflect engine output live |
| 5.3-INT-04 | Archived/inactive source: an existing row remains explainable from its preserved snapshot after the source is archived (5.3 AC3) | INT | R-507 | 2-3 | Dev | Explainability from row fields |
| 5.4-UNIT-03 | Warnings cover the full list: low margin, missing customer/facility/contact, empty section, zero-price row, missing work role on labor row, unresolved VAT/tax, ROT/grön sign-off, hidden rows in totals, missing required files (5.4 AC1) | UNIT | R-509 | 4-6 | Dev | Breadth of warning conditions |
| 5.4-E2E-02 | Pre-quote preview shows customer/facility/contact, sections, visible/hidden handling, options/tillval, totals, VAT, tax assumptions, terms, selected attachments, warnings captured at snapshot time (5.4 AC2) | E2E | R-509 | 2-3 | Dev | Preview content; not the send command |
| 5.4-E2E-03 | With a sent quote existing, the UI EXPLAINS a new version is required rather than mutating the sent version (5.4 AC3) | E2E | R-514 | 1-2 | Dev | Message present; enforcement is Epic 6 |
| 5.5-UNIT-02 | Documented old/new delta: an intentional Lovable delta is labelled expected-simplification / bug-fix / unresolved-assumption; a golden failure points to the affected assumption (5.5 AC2) | UNIT/GOLDEN | R-508 | 2-3 | Dev | Oracle is explainable |
| 5.1-INT-05 | Archive (soft-delete) of a calculation/section/row via UPDATE; no hard-delete grant/policy (5.1 tech note) | INT | R-501 | 1-2 | Dev | Archive-over-delete pattern |

**Total P1**: ~20-30 tests

### P2 (Medium)

**Criteria**: Secondary behavior + low/medium risk + edge cases.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 5.2-E2E-05 | Absence of deferred-workflow labels (field-worker/project/ÄTA/supplier/AI) in the editor (5.2 test req) | E2E | — | 1-2 | Dev | Guardrail; no deferred label leaks |
| 5.2-UNIT-03 | Row visibility / option (tillval) MODE persistence — a row's hidden/optional/selected flag round-trips through the command (5.2 / FR25) | UNIT/INT | R-508 | 2-3 | Dev | Persistence of the flags the totals depend on |
| 5.4-UNIT-04 | Empty-section / zero-price-row edge classification (warning vs blocker) (5.4 AC1) | UNIT | R-509 | 2-3 | Dev | Edge conditions |
| 5.2-UNIT-04 | VAT display selection (excl/incl/both) via `selectVatDisplay` — presentation only, source totals unchanged (5.2 / money impact) | UNIT | R-505 | 1-2 | Dev | Reuse engine display selector |
| 5.5-DOCS-01 | Documented old/new-Lovable calc deltas where they exist (5.5 / migration impact) | DOCS | R-508 | 1 | Dev | Migration-delta doc, not a gate |

**Total P2**: ~8-14 tests

### P3 (Low)

**Criteria**: Nice-to-have + exploratory + benchmarks.

| Test ID | Requirement | Test Level | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| 5.5-UNIT-03 | Property/fuzz: qty×unit-price + section-sum invariants via the engine (exploratory) | UNIT | 1-2 | Dev | Exploratory; not a gate |
| 5.1-UNIT-03 | DX: clear typed error when an unknown row type / lifecycle transition is requested | UNIT | 1 | Dev | Developer ergonomics |
| 5.4-DOCS-02 | Residual notes: `persons` flat-cap placeholder (R-512), required-file 8.1 sequencing (R-513), calc-at-scale perf + standing NFR gaps (R-510) | DOCS | 1-2 | Dev | Awareness only |
| 5.5-DOCS-03 | Runner-glob reminder: calc goldens live under `tests/unit/**`, never `tests/golden/**` (vacuous-green trap) | DOCS | 1 | Dev | Hygiene note |

**Total P3**: ~4-7 tests

---

## Execution Strategy

**Philosophy: run everything in every PR that can run in <15 min; the DB/e2e suites are the only real
cost.** Epic 5 spans levels, so timing differs from pure-logic Epic 4:

- **Every PR:**
  - All Epic 5 UNIT + GOLDEN (`pnpm test:unit`, `node --test`) — validators, extracted editor/readiness
    logic, math-via-engine equality, inclusion + calc goldens, fixture PII scan. Seconds; the fast gate
    that protects money/readiness correctness on every change (coverage-shape lesson).
  - All Epic 5 INT + RLS (`pnpm test:int`, Vitest against the local Supabase stack) — migration reset,
    calc commands, cross-tenant + anon negatives, H4 gate, source-snapshot freeze, atomic reorder.
    `SUPABASE_TEST_REQUIRED=1` in CI hard-fails a missing stack.
  - Editor + readiness **E2E** (`pnpm test:e2e`, Playwright) — keyboard editing, destructive-confirm,
    ordering, responsive stacking, totals refresh, blockers-gate-create-quote, preview content,
    new-version message. E2E is real + CI-gated; still under the 15-min bar for this epic's flows.
- **Nightly / Weekly:** nothing Epic-5-specific beyond the standard suites. (Calc-at-scale perf deferred,
  R-510 — add only if an SLA emerges.)

Standard order when triaging: smoke (login + open one calc) → P0 (isolation + math + readiness) → P1
(editor UX + source freeze + warnings) → P2/P3. No custom tiering beyond that — the whole Epic 5 suite
is intended to run green on every PR.

---

## Resource Estimates

Ranges, not false precision. Unlike Epic 4 (pure logic, near-zero plumbing), Epic 5 pays the **DB/RLS
factory tax + the E2E editor tax** again (as in Epic 3), but SAVES on math authoring because the money
numbers are already pinned by Epic 4 — 5.x asserts *routing through the engine*, not the arithmetic.

| Priority | Count (range) | Effort (range) | Notes |
| --- | --- | --- | --- |
| P0 | ~30-44 | ~34-52 h | Migration/RLS enrollment + calc commands + source-freeze + readiness classifier + inclusion goldens dominate |
| P1 | ~20-30 | ~20-34 h | Editor E2E (keyboard/ordering/responsive/totals) + warnings breadth + archived-source explainability |
| P2 | ~8-14 | ~5-10 h | Display-mode/visibility-persistence/deferred-label-absence/edges |
| P3 | ~4-7 | ~2-4 h | Exploratory/DX/residual docs |
| **Total** | **~62-95** | **~61-100 h (~1.5-2.5 weeks, 1 dev)** | Full-stack epic; DB/RLS + E2E plumbing is the cost, math is inherited |

**Prerequisites**

- **Test data:** the two-tenant factory (`tests/factories/**`) extended with calc/section/row seed +
  cleanup (service-role BYPASSRLS, loopback-gated); anonymized calc golden fixtures under
  `tests/fixtures/golden/**` following the existing `{origin, ...öre}` shape. Count-asserting tests seed
  `crypto.randomUUID()`.
- **Tooling:** `node --test` (unit + golden), Vitest (int/RLS, local Supabase CLI stack), Playwright
  (e2e); the golden PII/secret scan (extend with orgnr shape if not already). No new runner.
- **Environment:** local Supabase CLI stack for INT/RLS/e2e (`supabase db reset` owned by the caller);
  Node for pure units.

**Non-effort dependency (calendar time):** the ROT/grön-teknik/VAT-display/inclusion/rounding sign-offs
remain owner-pending (Epic 4 standing questions). Build the readiness + totals against the inherited
UNAPPROVED profiles + `requiresSignOff` posture; do not block coding on sign-off, do not render the
numbers as final.

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100% (no exceptions)
- **P1 pass rate:** ≥95% (waivers required for failures)
- **P2/P3 pass rate:** ≥90% (informational)
- **High-risk (≥6) mitigations:** 100% complete or approved waivers

### Coverage Targets

- **Calc command + validation + readiness logic (pure):** ≥90% (the fast unit gate must protect it)
- **RLS negatives:** 100% of the 3 calc tables enrolled + exercised (spoof/filter/mutation + anon)
- **Math-via-engine:** 100% of displayed/persisted totals proven equal to the engine (no inline math)
- **Inclusion + section-mode + row-type branches:** 100% of enumerated cases golden-pinned
- **Editor UX edge cases (validation-preserve/destructive-confirm/ordering/responsive):** ≥50% via E2E

### Non-Negotiable (epic blockers regardless of numeric score)

- [ ] Every calc table has direct `tenant_id` + enable+**force** RLS + own-tenant policies + `anon →
      none` + **`TENANT_TABLES` enrollment** (H4 gate green)
- [ ] No cross-tenant customer/facility/contact/work-role/article link accepted by a command
- [ ] Every customer-visible total/VAT/deduction routes through `@/lib/money` — **no inline money math,
      no forked öre/rounding/VAT rule**
- [ ] Multi-row reorder/save is **atomic** (narrow RPC / server txn) — no client-side consistency boundary
- [ ] Pricing-source row snapshots are **frozen** (no silent recompute on source archive/rate change)
- [ ] Hidden-row / selected-tillval totals **match the 2026-06-18 inclusion pin** (unselected never summed)
- [ ] Readiness **blockers gate** the create-quote affordance; tax warnings framed as estimate +
      `requiresSignOff`, never legally-final
- [ ] **No real PII/secret** in any calc golden fixture (CI scan green); no personnummer into the engine/rows

---

## Mitigation Plans (High-Priority, Score ≥6)

### R-501: New calc table isolation gap (Score 6, enrollment-gated)

**Strategy:** (1) Reuse the CRM migration pattern verbatim — direct `tenant_id`, enable+force RLS with
own-tenant `is_tenant_admin` SELECT/INSERT/UPDATE, `anon → none` GRANT, archive-over-delete, composite
same-tenant FKs. (2) Enroll all 3 tables in `TENANT_TABLES` with spoof/filter/mutation metadata BEFORE
merge — the compile-exhaustive `switch(table)`+`assertNever` makes a missing enrollee a typecheck error
and the H4 gate FAILS CI on an unenrolled table. **Owner:** Dev (5.1). **Timeline:** Story 5.1.
**Verification:** `5.1-INT-01` (reset) + `5.1-RLS-01/02` (negatives + H4 gate).

### R-502: Cross-tenant parent/source link accepted (Score 6)

**Strategy:** Composite same-tenant FKs at the DB; the command re-validates CRM-parent ownership and,
for row sources, drives `resolveSnapshotSource` (own-tenant SELECT, zero rows ⇒ `TENANT_ACCESS_DENIED`).
**Owner:** Dev (5.1/5.3). **Timeline:** Stories 5.1, 5.3. **Verification:** `5.1-INT-02` (foreign parent)
+ `5.3-INT-03` (foreign source).

### R-503: Non-atomic multi-row reorder/save (Score 6)

**Strategy:** Multi-record reorders/saves use a narrow Postgres RPC or an approved server transaction
adapter (ADR-A009); ordering is server-owned; NO client-side multi-step persistence as the consistency
boundary. **Owner:** Dev (5.1). **Timeline:** Story 5.1. **Verification:** `5.1-INT-03` (mid-transaction
failure rolls back fully).

### R-504 / R-506: Row validation + öre discipline (Score 6)

**Strategy:** Command validators mirror `crm/validation.ts` — closed row-type union, qty>0 + unit,
canonical `isOreAmount`/`ORE_AMOUNT_MAX` on every öre field (no fork), VAT assumption present, lifecycle
state machine; DB `CHECK (..._ore >= 0)` belt-and-braces; raw invalid value never echoed. **Owner:** Dev
(5.1). **Timeline:** Story 5.1. **Verification:** `5.1-UNIT-01/02` + `5.1-INT-04`.

### R-505: Totals re-derived inline (Score 6)

**Strategy:** Route every total/VAT/net/gross/deduction through `@/lib/money`; extract calc/display
logic out of client components into pure functions unit-pinned at the real call site (coverage-shape
lesson); a review grep confirms no inline `+`/`*`/`0.25` money math in commands or islands. **Owner:**
Dev (5.2/5.4). **Timeline:** Stories 5.2, 5.4. **Verification:** `5.2-UNIT-01` (editor total == engine
total).

### R-507: Pricing-source snapshot recomputes (Score 6)

**Strategy:** 5.3 composes `resolveSnapshotSource` + the pure copy-by-value/freeze builder; the row
stores the frozen source fields (id/name/öre/updated_at "version"/tenant). **Owner:** Dev (5.3).
**Timeline:** Story 5.3. **Verification:** `5.3-INT-02` (mutate/archive source after capture ⇒ prior row
unchanged) + `5.3-INT-04` (explainable from row).

### R-508: Hidden-row / tillval inclusion diverges (Score 6, pin-gated)

**Strategy:** Totals obey the owner-decided 2026-06-18 inclusion pin (hidden + selected COUNT; unselected
does NOT), driven through the engine; 5.5 extends `options-tillval.json` to calc rows. A DIFFERENT
inclusion rule treated as production-approved is a STOP (needs-human). **Owner:** Dev (5.4/5.5).
**Timeline:** Stories 5.4, 5.5. **Verification:** `5.4-GOLDEN-01` + `5.5-GOLDEN-01`.

### R-509: Readiness misclassification / tax-warning-final (Score 6)

**Strategy:** A pure classifier separates blockers from warnings per an explicit rule table; blockers
gate the create-quote affordance; tax warnings carry the engine's `requiresSignOff` posture + non-final
framing. **Owner:** Dev (5.4). **Timeline:** Story 5.4. **Verification:** `5.4-UNIT-01/02` +
`5.4-E2E-01`.

### R-511: Rounding/discount/negative invented (Score 6)

**Strategy:** Line-level rounding only, via the engine's sum-of-rounded; NO document-level rounding /
discount / negative-amount model invented — a genuine need is escalated (`needs-human`). **Owner:** Dev
(5.1/5.2). **Timeline:** Stories 5.1, 5.2. **Verification:** engine-driven goldens (`5.5-GOLDEN-01`) +
review confirms no document-level/discount path.

### R-516: Calc fixture / row PII leak (control held at MITIGATE)

**Strategy:** Anonymized shape-only fixtures; reuse + extend the golden PII/secret scan (personnummer
`\d{6}-\d{4}`, non-`example.test` email, orgnr shape, `secret|password|api_key`) in the CI unit gate;
the engine takes an eligibility POSTURE, never PII. **Owner:** Dev (5.5). **Timeline:** Story 5.5.
**Verification:** `5.5-UNIT-01`.

---

## Owner / Accounting / Legal Sign-Off Questions (carried into this epic's gate)

Epic 5 does NOT introduce new tax constants — it CONSUMES Epic 4's UNAPPROVED profiles. The standing
Epic 4 sign-off questions remain open and must NOT be silently "finalized" in the calc editor or
readiness UI. New Epic-5-specific escalations:

1. **Inclusion:** confirm the 2026-06-18 pin (hidden rows + selected tillval COUNT; unselected does NOT)
   is the pilot policy for calc totals; a different rule is a STOP. *(R-508.)*
2. **Readiness blockers vs warnings:** which conditions are hard BLOCKERS (gate quote creation) vs soft
   WARNINGS — is "low margin" a warning or a blocker; is "missing required files" a blocker when 8.1 has
   landed? *(R-509, R-513.)*
3. **`persons` per-person ROT cap:** still a flat `capOre` (inert `persons`)? Confirm 5.x must NOT encode
   a per-person multiplier. *(R-512; Epic 4 Sign-Off Q3.)*
4. **Required-file readiness:** is a missing required file a warning or a blocker, and is the check in
   scope for 5.4 given Story 8.1 sequencing? *(R-513.)*
5. **"New version required after send" wording:** approved customer-facing/admin copy for the
   change-after-send explanation. *(R-514.)*
6. **Tax-warning framing:** approved non-final / "estimate, requires sign-off" wording so a ROT/grön
   warning never reads as legally final. *(R-509.)*
7. **Standing carry-overs (Epic 4):** rounding mode, VAT display default + private→incl, ROT/grön
   rates/caps/mix, eligibility disclaimer, personnummer scope, approval posture, accepted-price delta
   shape — all remain UNAPPROVED placeholders. *(Epic 4 sign-off gate.)*

---

## Assumptions and Dependencies

### Assumptions

1. Calc money math is ENTIRELY delegated to the frozen `@/lib/money` engine — Epic 5 asserts *routing*
   and *inclusion/readiness classification*, not arithmetic (Epic 4 pinned the numbers).
2. The CRM composite-FK + RLS + `TENANT_TABLES` enrollment pattern is the correct and sufficient
   isolation model for the 3 new calc tables (reuse, not re-invent).
3. Multi-row atomic writes use a narrow Postgres RPC / server transaction adapter (ADR-A009), not the
   browser.
4. Pricing-source snapshots reuse the Epic 3 copy-by-value/freeze contract via `resolveSnapshotSource`.
5. ROT/grön/VAT-display/inclusion/rounding remain UNAPPROVED placeholders + `requiresSignOff`; the calc
   editor/readiness never renders them final.
6. Golden fixtures are anonymized shape-only; Lovable is an oracle for expected values, not a data source.

### Dependencies

1. Epics 2-4 in `main` — CRM/RLS/enrollment harness, `@/lib/money`, snapshot contract + resolver,
   two-runner + Playwright + two-tenant fixture (verified).
2. Epic 3 `customers`/`facilities`/`contacts`/`work_roles`/`articles` + `company_settings.vat_rate_bp` —
   consumed as calc parents + row sources + VAT assumption input.
3. Epic 4 `@/lib/money` engine + `options-tillval.json` inclusion pin — the totals authority + inclusion
   oracle 5.4/5.5 extend.
4. Story 8.1 file-metadata foundation — required for 5.4's "missing required files" readiness check;
   if unlanded at 5.4 time, that check is a documented deferral (R-513).
5. Owner/accounting/legal sign-off (Epic 4 standing + Epic 5 escalations) — a calendar dependency on
   *approval*, not on dev work.

### Risks to Plan

- **Risk:** Story 8.1 has not landed when 5.4 is implemented. **Impact:** the required-file readiness
  check can't be fully wired. **Contingency:** ship the check as a documented deferral surfaced in the
  readiness output + gate; wire it when 8.1 lands (no rule-shape change).
- **Risk:** The atomic-write RPC/adapter is heavier than expected. **Impact:** reorder/save slips.
  **Contingency:** it is a hard requirement (R-503) — do NOT fall back to client-side multi-step
  persistence; scope the RPC narrowly (reorder + row-set save) and defer duplicate-where-supported if
  needed.
- **Risk:** A Lovable oracle delta contradicts the assumed inclusion/rounding. **Impact:** re-pin a
  golden. **Contingency:** the old/new/delta labelling makes the change explicit and reviewable, not a
  silent break; a *production-approved different inclusion rule* is a STOP (needs-human).

---

## Interworking & Regression

| Component | Impact | Regression Scope |
| --- | --- | --- |
| **New `calculations`/`calculation_sections`/`calculation_rows` (Epic 5)** | Consumed by Epic 6 quote snapshot/PDF, Epic 7 acceptance | Enroll in `TENANT_TABLES`; the RLS/anon/H4 suites must stay green; Epic 6 reads (does not fork) these tables |
| **`@/lib/money` (Epic 4)** | Epic 5 routes ALL calc totals/VAT/deductions through it | The Epic 4 money units + golden pack must stay green; Epic 5 adds calc-row goldens that EXTEND, not fork, the primitives; no inline money math introduced |
| **`src/lib/snapshots` + `resolveSnapshotSource` (Epic 3)** | 5.3 composes the resolver + freeze builders for row source snapshots | Existing snapshot golden + resolver tests stay green; the row-snapshot freeze test mirrors them |
| **CRM `customers`/`facilities`/`contacts` (Epic 3)** | Calc parents via composite same-tenant FKs | Epic 3 CRM tables/policies unchanged; the calc FKs reference them without altering them |
| **`work_roles`/`articles` (Epic 3)** | Row pricing sources (5.3) | Epic 3 pricing tables/policies unchanged; sources are read + frozen, never mutated by a calc |
| **`company_settings.vat_rate_bp` / `default_vat_display` (Epic 3)** | VAT assumption + display input to calc totals | Storage semantics unchanged; the engine applies the display posture |
| **Inherited RLS / anon / service-role / audit gates** | EXTENDED by 3 new tables (unlike Epic 4 which was N/A) | The cross-tenant + anon-path + H4 + service-role-containment gates now cover the calc tables too; all stay green |
| **Nav / app shell (Epic 1/3)** | Editor lives under existing `Kalkyler` nav (architecture §route map) | No new top-level nav; no deferred label; the seven-item nav is unchanged |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — risk classification framework
- `probability-impact.md` — P×I scoring methodology (thresholds 1-3 DOCUMENT / 4-5 MONITOR / 6-8
  MITIGATE / 9 BLOCK)
- `test-levels-framework.md` — isolation ⇒ RLS/INT; pure calculation/classification ⇒ UNIT; UI flows ⇒
  E2E; avoid re-asserting engine math in the UI
- `test-priorities-matrix.md` — tenant isolation + customer-visible money + quote-readiness safety ⇒ P0
  (blocks core + high risk + no workaround)

### Related Documents

- Epic: [epics.md — Epic 5 (lines 1026-1211)](../planning-artifacts/epics.md)
- PRD: [prd.md — FR19-FR29](../planning-artifacts/prd.md)
- Architecture: [architecture.md — §7 IN-list, §10 money/tax, §11 quote snapshot model, §12 PDF sources,
  ADR-A009 narrow RPC](../planning-artifacts/architecture.md)
- Project rules: [project-context.md — Money/Tax/Quote Rules; Testing Rules; Security Regression Harness
  Rules](../project-context.md)
- Prior epic designs (house style + inherited notes): [test-design-epic-4.md](test-design-epic-4.md),
  [test-design-epic-3.md](test-design-epic-3.md)
- Inherited code: `supabase/migrations/20260630120000_crm_data_model.sql`,
  `supabase/migrations/20260630140000_work_roles_and_articles.sql`, `src/lib/money/**`,
  `src/lib/snapshots/build.ts`, `src/server/snapshots/resolve-source.ts`,
  `src/server/commands/crm/validation.ts`, `tests/integration/rls/tenant-table-inventory.ts`,
  `tests/fixtures/golden/money/options-tillval.json`

### Follow-on Workflows (Manual)

- Run `*atdd` to generate the red-phase **P0** scenarios above (separate workflow; not auto-run) —
  target the P0 RLS + command + math-via-engine + readiness + inclusion-golden rows.
- Run `*automate` for broader editor/E2E coverage once the calc tables + editor implementation exist.
- Run `*trace` at the epic boundary to build the traceability matrix + gate decision; feed R-501-R-516
  into the gate, and carry the standing NFR concerns (no `pnpm audit` gate, no coverage reporter) into
  the schedule-or-accept decision.

---

**Generated by**: BMad TEA Agent — Test Architect Module
**Workflow**: `bmad-testarch-test-design`
**Version**: 4.0 (BMad v6)

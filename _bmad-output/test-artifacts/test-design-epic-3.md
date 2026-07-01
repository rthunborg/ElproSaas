---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-06-30'
workflowType: testarch-test-design
designLevel: epic
epicNum: 3
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 3, lines 685-869)
  - _bmad-output/test-artifacts/test-design-epic-2.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - tests/integration/rls/tenant-table-inventory.ts
  - src/server/commands/envelope.ts
  - supabase/migrations/20260625122433_tenant_foundation.sql
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
---

# Test Design: Epic 3 - CRM, Company Settings, And Pricing Foundation

**Date:** 2026-06-30
**Author:** Rasmus
**Status:** Draft
**Design Level:** Epic-Level (Phase 4)
**Mode:** Risk-based, evidence-backed (Master Test Architect)

---

## Executive Summary

**Scope:** Epic-level test design for Epic 3 — the first epic that puts **real tenant-owned
business data** on top of the Epic 2 trust foundation. It covers customers/facilities/contacts
(CRM), company quote identity + default VAT display + quote terms, work roles + optional manual
articles (pricing inputs), the tenant-admin CRM/settings UX, and a small Phase-A **snapshot
source contract** so later calculations/quotes can explain where customer-visible values came
from.

**Epic goal (from epics.md):** Give tenant admins the tenant-owned customer, facility, contact,
settings, terms, VAT, and pricing inputs needed to start quote-producing work — without leaking
into deferred scope (Fortnox/supplier APIs, personnummer, full RBAC, broad CRM analytics).

**Why this epic is risk-bearing:** Epic 2 proved *access* is trustworthy when no business data
existed. Epic 3 is the first epic to actually create six+ new **tenant-owned tables** and the
first to handle **money** (öre rates) and **customer-facing legal/tax text** (quote terms, VAT
wording). Two failure classes dominate: (1) a cross-tenant isolation or parent-ownership-spoofing
hole in a new CRM/settings/pricing table — silently inherited by every quote built on it; (2) a
**Phase-A guardrail breach** — capturing personnummer, treating tax/legal wording as approved, or
letting "articles" pull supplier scope in. The architecture and the inherited Epic 2 controls
(command envelope, H4 RLS inventory gate, two-tenant factories) define the *mechanism*; Epic 3's
residual risk is correct per-table implementation, durable gate enrollment, money-integer
discipline, and honoring the human stop-conditions.

**Risk Summary:**

- Total risks identified: **13**
- High-priority risks (score ≥6): **8**
- Critical (score 9 / auto-BLOCK at design time): **0** (the controls exist; risk is correct
  implementation + durable enforcement + Phase-A guardrail compliance, not an unaddressed design gap)
- Critical categories: **SEC** (cross-tenant CRM/settings/pricing isolation, parent-ownership
  spoofing, settings/terms isolation), then **BUS/compliance** (personnummer capture, unapproved
  tax/legal quote wording, supplier-scope creep), then **DATA** (money öre integrity, snapshot
  explainability), then **TECH** (six new tables must each enroll in the H4 gate; snapshot-contract
  durability)

**Coverage Summary:**

- P0 scenarios: **~26-32** (~32-48 hours)
- P1 scenarios: **~22-28** (~22-34 hours)
- P2/P3 scenarios: **~14-20** (~7-16 hours)
- **Total effort**: **~60-95 hours (~1.5-2.5 weeks, 1 dev)** — lower per-test setup tax than Epic 2
  because the runner, local Supabase stack, factories, command envelope, and RLS harness already
  exist; the new cost is per-table factory/inventory enrollment and the money/snapshot UNIT + golden
  layer.

**Headline:** This epic is dominated by **Integration (server-command)** + **RLS-negative**
coverage replicated across each new tenant-owned table, plus two new test surfaces Epic 2 did not
have: **money-input UNIT tests (integer öre, never floats)** and **snapshot-builder UNIT + golden
tests (Story 3.5)**. The single highest-leverage deliverable is that **every new tenant-owned table
(customers, facilities, contacts, company settings/terms, work_roles, optional articles) is enrolled
in the existing `TENANT_TABLES` inventory with BOTH metadata seams** — the H4 gate already fails CI
on an unenrolled tenant table (its "STANDING CONTRACT (Epics 3-9)"), so the work is to *use* that
mechanism, not rebuild it. Treat an unenrolled new table or a personnummer/unapproved-tax breach as
an epic blocker, not a nice-to-have.

---

## Inherited Foundation (what Epic 3 builds on, not rebuilds)

Epic 2 shipped the substrate this epic plugs into. Verified in-repo; Epic 3 must **reuse**, not
re-invent, these:

| Inherited asset | Where | Epic 3 obligation |
| --- | --- | --- |
| Reusable command envelope (`defineCommand`/`runCommand`) — auth → membership → validate → ownership → execute → audit → typed Result | `src/server/commands/envelope.ts` | Every CRM/settings/pricing mutation is a `defineCommand`; parent-ownership checks use the envelope `ownership` target (the `verifyOwnership` tenant-scoped SELECT). No new auth/error mechanism. |
| H4 RLS table-inventory gate + single-source `TENANT_TABLES` with cross-tenant **and** anon metadata seams | `tests/integration/rls/tenant-table-inventory.ts` | Each new tenant-owned table enrolls here (one-place data edit) with `spoofedRowFor`/`tenantBFilter`/`hijackMutationFor` **and** `anonRowFor`/`anonFilterFor`/`anonMutationFor`. The gate fails CI by name if omitted. |
| Two-tenant factories + per-worker isolation | `tests/factories/*`, `tests/integration/rls/factory-isolation.int.test.ts` | Extend factories to CRM/settings/pricing rows; keep per-worker tenant-pair isolation (no shared mutable fixtures). |
| Append-only `audit_events` + `writeAuditEvent` DEFINER write + metadata sanitizer | `src/server/commands/audit.ts`, `audit-metadata.ts` | Critical CRM/settings/pricing changes write audit rows via the existing path; supply allow-listed `target_type`/`event_type`/metadata only (no PII/secret leak). |
| RLS helper pattern (`is_active_tenant_member`/`is_tenant_admin`, fixed empty `search_path`, FORCE RLS) | `supabase/migrations/20260625122433_tenant_foundation.sql` | New tables enable+force RLS, scope policies via the helpers, FK to `tenants`, NOT NULL `tenant_id`. |
| Deterministic command clock | `src/server/commands/clock.ts` | Source/snapshot timestamps use the single injected clock; no `Date.now()` sleeps in tests. |

**No money/VAT/snapshot primitives exist yet.** A repo scan found zero öre/money/VAT utilities.
Epic 3 is the **first** money touch (öre cost/sell rates on work roles, optional article prices) and
the **first** snapshot touch (Story 3.5 contract). The full money/VAT/ROT/grön-teknik/rounding +
snapshot primitive layer is **Epic 4** (epics.md). Therefore Epic 3 must keep money to **integer
öre** and keep the Story 3.5 contract **small and Phase-A-aligned** (it *defines and tests* the
contract; concrete quote-snapshot persistence is Epics 5-6). Tests here are the guardrail that Epic
3 does not prematurely implement Epic 4's tax/rounding semantics.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Personnummer / personal-number capture** | epics.md 3.1 explicit non-scope + hard stop-condition; AGENTS.md deferred privacy scope | Negative test: no personnummer column exists by default on any CRM table; a schema assertion proves absence (R-009). Stop-condition surfaced to human if requested. |
| **Supplier APIs / imports / Fortnox sync / external article mappings** | epics.md Epic 3 + 3.4 explicit non-scope; AGENTS.md deferred | Test/schema assertion: `articles` carry no supplier credentials/sync fields/external mapping columns; scope-guard review (R-010). Stop-condition if article work expands to supplier scope. |
| **Full RBAC / role management** | Phase A is `tenant_admin` only (inherited from Epic 2) | Commands run under the `tenant_admin`-only envelope; no new role surface introduced or tested. |
| **Broad CRM analytics / reporting** | epics.md Epic 3 + 3.2 non-scope | UI shows only Phase-A-owned record areas; test asserts no analytics endpoint/label exists. |
| **Final VAT rates / rounding / tax-legal wording approval** | epics.md 3.3/3.5 stop-conditions: needs owner/accounting/legal sign-off | Sign-off status/warning is shown and tested; implementation never marks customer-facing text "approved" (R-011). Rounding/tax semantics deferred to Epic 4. |
| **Concrete quote-snapshot persistence + recompute prevention end-to-end** | Story 3.5 defines/tests the *contract*; persistence completes in Epics 5-6 | Snapshot-builder UNIT + golden tests prove the contract shape now; full quote-version immutability is an Epic 5/6 trace concern (R-008 scoped to contract durability only). |
| **Money rounding / VAT math / ROT / grön teknik** | Epic 4 owns money/tax primitives | Epic 3 money is integer-öre storage + validation only; no calculation/rounding logic is implemented or tested here (cross-ref Epic 4 test design). |
| **Real Lovable CRM/settings/terms data import** | Lovable is a behavioral oracle only; fixtures are anonymized (AGENTS.md) | Fixtures are anonymized/content-shape only; no real company/person text or code copied. Tested via fixture-shape compatibility, not data import. |
| **Auth/RLS/CRUD performance at scale** | Premature for internal pilot (single tenant initially); no SLA defined (carry-forward R-013 from Epic 2) | Functional isolation correctness is the Phase-A concern; perf deferred to a later epic. Documented as residual (R-013). |

---

## Risk Assessment

Scoring per `probability-impact.md`: Probability 1 (unlikely) / 2 (possible) / 3 (likely);
Impact 1 (minor) / 2 (degraded) / 3 (critical). Score = P × I. Thresholds: 1-3 DOCUMENT,
4-5 MONITOR, 6-8 MITIGATE (CONCERNS at gate), 9 BLOCK (auto-FAIL).

Impact rationale: cross-tenant CRM/settings/pricing leaks are **Impact 3** (confidentiality/
regulatory exposure that is silently inherited by every later quote that snapshots the value).
Probability is held at **2** (not 3) for isolation risks because the architecture + inherited Epic 2
controls already specify the correct mechanism (FORCE RLS, helpers, envelope, H4 gate) — the residual
is implementation correctness and gate-enrollment drift across six new tables, not an unaddressed
design gap. Compliance/guardrail risks (personnummer, tax wording, supplier creep) are scored on the
**likelihood of accidental scope creep** during implementation against the harm of a Phase-A breach.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | Missing/incorrect RLS on a new CRM table (`customers`/`facilities`/`contacts`) lets Tenant A read/write Tenant B rows | 2 | 3 | 6 | Enable+FORCE RLS via helpers on every new table; enroll each in `TENANT_TABLES`; parameterized cross-tenant SELECT/INSERT/UPDATE/DELETE negatives | Dev (3.1) | Story 3.1 |
| R-002 | SEC | Parent-ownership spoofing: a child row (facility/contact) is linked to a **Tenant B** parent id, or a command trusts a client-supplied parent/`tenant_id` | 2 | 3 | 6 | Envelope `ownership` target verifies parent belongs to resolved tenant (tenant-scoped SELECT → zero rows ⇒ DENIED); parent-consistency CHECK/FK + cross-tenant link negatives | Dev (3.1) | Story 3.1 |
| R-003 | SEC | Missing/incorrect RLS on settings/terms tables (company identity, VAT defaults, quote terms) lets Tenant A read/write Tenant B settings | 2 | 3 | 6 | Enable+FORCE RLS; enroll settings/terms tables in `TENANT_TABLES`; cross-tenant settings/terms negatives + audit-isolation | Dev (3.3) | Story 3.3 |
| R-004 | SEC | Missing/incorrect RLS or parent-spoof on pricing tables (`work_roles`, optional `articles`) exposes/forges customer-visible price data | 2 | 3 | 6 | Enable+FORCE RLS; enroll pricing tables; cross-tenant + parent-spoof negatives; pricing data is downstream customer-visible so isolation is load-bearing | Dev (3.4) | Story 3.4 |
| R-005 | TECH | A new tenant-owned table ships **without** H4 inventory-gate enrollment (or with only one metadata seam) → no cross-tenant/anon negative, silently uncovered | 2 | 3 | 6 | The existing H4 gate fails CI by name on an unenrolled table; enroll each new table with BOTH cross-tenant AND anon seams; verify by adding a table on a scratch branch and confirming CI red | Dev (3.1/3.3/3.4) | Each table-creating story |
| R-006 | DATA | Money stored/validated as float or in mixed units (kronor vs öre) → rounding drift, wrong customer-visible prices when later snapshotted | 2 | 3 | 6 | Cost/sell rates stored + validated as **integer öre** only; UNIT tests reject floats/negatives/overflow/locale-comma input; no rounding/VAT math in Epic 3 (deferred to Epic 4) | Dev (3.4) | Story 3.4 |
| R-007 | BUS | "Articles" feature quietly pulls **supplier scope** (credentials, sync fields, imports, external mapping) — a deferred-module breach | 2 | 3 | 6 | Schema/command tests assert articles are manual, minimal, tenant-owned with NO supplier credential/sync/import/mapping columns; scope-guard review; included only if pilot fixtures/owner require it (else feature-off) | Dev (3.4) | Story 3.4 |
| R-008 | DATA | Snapshot contract (Story 3.5) is too thin/ambiguous OR a previously-snapshotted value silently **recomputes** when its mutable source later changes → customer-visible value cannot be explained | 2 | 3 | 6 | Documented small Phase-A contract (source id, display name/content, öre values, VAT assumptions, source timestamp/version, tenant ownership); snapshot-builder UNIT tests prove captured values are frozen and do NOT recompute when source mutates; golden fixtures for work role + optional article | Dev (3.5) | Story 3.5 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| R-009 | BUS/SEC | Personnummer / unnecessary personal data captured on a CRM table (privacy breach + Phase-A stop-condition) | 1 | 3 | 3 | Schema assertion: no personnummer field by default on any CRM table; required-field set limited to approved Phase-A fields; stop-condition escalates to human if requested | Dev (3.1) |
| R-010 | DATA/SEC | CRM/settings/pricing audit metadata leaks PII, secrets, or broad free-text (re-uses the Epic 2 sanitizer but with new business fields) | 2 | 2 | 4 | Reuse `audit-metadata` sanitizer; per-command allow-listed metadata fields; forbidden-content assertion for the new business commands | Dev (3.1/3.3/3.4) |
| R-011 | BUS | Quote terms / VAT-display text treated as **approved** by implementation (no owner/legal sign-off), shipped to a customer-facing quote later | 2 | 2 | 4 | Sign-off status/warning shown + tested; implementation never auto-approves customer-facing text; "usable for pilot quotes" gated behind explicit sign-off flag; stop-condition for unapproved tax/legal wording | Dev (3.3) |
| R-012 | BUS/TECH | CRM lifecycle UX gaps: empty/loading/failed/no-results/duplicate-like states unclear, focus not managed, validation errors not programmatically associated with fields (a11y) | 2 | 2 | 4 | UI tests for each list/dialog state, keyboard focus on open/close, `aria-describedby`/`aria-invalid` field-error association, no deferred-module nav labels, route authorization | Dev (3.2) |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Prob | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- |
| R-013 | PERF | CRM/settings/pricing query + RLS performance under many rows/tenants untested in Phase A (carry-forward from Epic 2 R-013) | 1 | 2 | 2 | Monitor; defer load testing to a later epic (single pilot tenant initially). The Epic 2 `auth-rls-baseline` perf harness can be extended when needed. |

### Risk Category Legend

- **TECH**: Technical/Architecture (integration, gate enrollment, snapshot-contract durability)
- **SEC**: Security (tenant isolation, parent-ownership spoofing, settings/terms/pricing exposure)
- **PERF**: Performance (query/RLS scale)
- **DATA**: Data Integrity (money öre integrity, snapshot explainability/recompute, audit metadata)
- **BUS**: Business/Compliance Impact (personnummer/privacy, tax-legal sign-off, supplier-scope creep, CRM UX)
- **OPS**: Operations (deployment, environment) — minimal for this epic (foundation already exists)

---

## Testability Notes (Epic-Level)

Strong inherited testability — Epic 3 starts from a working runner + local Supabase + factories +
H4 gate, so most scenarios below are *additive*, not greenfield. Three concerns worth flagging:

1. **Six-table enrollment is mechanical but easy to forget.** The H4 gate enforces enrollment, but a
   contributor who adds a table and forgets the **anon** seam still gets a membership-shaped default in
   the anon-path suite (a silent weakening, per the inventory module's own DX note). Mitigation: the
   gate's failure message already names both seams; CI bites on the missing table itself.
2. **Money + snapshot are new pure-logic surfaces** ideal for UNIT/golden tests (no DB) — keep them at
   the unit level (test-levels-framework: pure logic ⇒ unit, not E2E). Avoid testing öre validation or
   snapshot freezing through the UI.
3. **Sign-off/approval status is a behavioral assertion, not a checkbox.** R-011's test must prove the
   system does not *render or persist* customer-facing terms as approved without the explicit flag —
   not merely that a flag column exists.

---

## Entry Criteria

- [ ] Epic 2 merged and green (command envelope, H4 RLS inventory gate, two-tenant factories,
      append-only audit, RLS helpers all live in `main`)
- [ ] `pnpm test` runs the real suite; local Supabase stack (`supabase db reset`) works locally + CI
- [ ] Two-tenant factories extensible to CRM/settings/pricing rows (Epic 2 B1 contract holds)
- [ ] Phase-A field decisions for CRM (customer types, facility/contact requiredness) confirmed as
      **conservative assumptions** pending owner sign-off — NOT hard-coded as final (epics.md 3.1/3.2
      stop-conditions)
- [ ] Decision recorded on whether optional `articles` is **in** this epic (pilot-fixture/owner need)
      or **deferred** — drives whether R-007 article scenarios are active
- [ ] Requirements/assumptions agreed by Dev/QA/PM (the epic acceptance criteria are the contract)

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing or each failure explicitly triaged/waived
- [ ] **Every new tenant-owned table** (`customers`, `facilities`, `contacts`, company
      settings/terms table(s), `work_roles`, and `articles` if included) is **enrolled in
      `TENANT_TABLES`** with cross-tenant + anon metadata, and the H4 gate is green (and proven to
      fail on a deliberately-omitted new table)
- [ ] Cross-tenant SELECT/INSERT/UPDATE/DELETE negatives green for every new tenant-owned table
- [ ] **Parent-ownership spoofing denied**: a facility/contact cannot link to a Tenant B parent; a
      command cannot mutate a target in another tenant (envelope ownership-verify proven)
- [ ] **No personnummer field** exists by default on any CRM table (schema assertion green)
- [ ] **Articles carry no supplier credential/sync/import/mapping fields** (if articles included)
- [ ] Money rates proven **integer-öre** (float/negative/overflow/locale-comma inputs rejected)
- [ ] **Snapshot-builder UNIT + golden tests green**: snapshotted values are frozen and do not
      recompute when the mutable source later changes; cross-tenant source-id use is rejected
- [ ] **Sign-off/approval gating proven**: customer-facing quote terms / VAT wording is not rendered
      or persisted as approved without the explicit sign-off flag
- [ ] CRM UX states (empty/loading/failed/no-results/duplicate-like), focus management, and field-error
      a11y association covered; no deferred-module nav labels present
- [ ] Critical CRM/settings/pricing changes write audit rows with allow-listed metadata only
- [ ] No open high-priority (≥6) risk unmitigated or unwaived

---

## Test Coverage Plan

> **P0/P1/P2/P3 = priority / risk classification, NOT execution timing.** Execution timing
> (PR / nightly / weekly) is defined separately in the Execution Strategy section below.

Test ID format `{EPIC}.{STORY}-{LEVEL}-{SEQ}`. Levels: UNIT, INT (server-command integration),
RLS (cross-tenant / anon DB negative), E2E. RLS is called out separately from INT because it is the
load-bearing coverage and is parameterized over the (now larger) tenant-table inventory. Two new
level emphases versus Epic 2: **money UNIT** and **snapshot UNIT + golden**.

### P0 (Critical)

**Criteria**: Blocks the trustworthy-business-data foundation OR a Phase-A guardrail breach + high
risk (≥6) + no workaround.

| Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Cross-tenant SELECT denied on `customers`/`facilities`/`contacts` (3.1 AC3) | RLS | R-001 | 3 | Dev | Parameterized over the new CRM tables in `TENANT_TABLES` |
| Cross-tenant INSERT/UPDATE/DELETE denied on each CRM table (Tenant A cannot mutate/forge Tenant B) (3.1 AC3) | RLS | R-001 | 4-6 | Dev | One per verb × table; fresh-uuid rows so denial is privilege (42501), not PK collision |
| Facility/contact cannot be created/linked to a **Tenant B parent** id (parent spoofing) (3.1 AC2/AC3) | INT/RLS | R-002 | 3-4 | Dev | Envelope `ownership` target verify + parent-consistency constraint; cross-tenant link rejected |
| Command rejects client-supplied parent/`tenant_id` that mismatches resolved tenant (3.1 AC2) | INT | R-002 | 2 | Dev | Server authority; client value ignored/verified, never trusted |
| New CRM tables enrolled in `TENANT_TABLES`; H4 gate green and proven to fail on an omitted table (3.1 test req) | INT | R-005 | 2 | Dev | Both cross-tenant + anon seams; scratch-branch bite verification |
| Cross-tenant SELECT/INSERT/UPDATE/DELETE denied on settings/terms tables (3.3 AC3) | RLS | R-003 | 4-6 | Dev | Company identity, VAT defaults, quote terms enrolled + negatives |
| Cross-tenant SELECT/INSERT/UPDATE/DELETE denied on `work_roles` (+`articles` if included) (3.4 AC3) | RLS | R-004 | 4-6 | Dev | Pricing tables enrolled; parent-spoof negative where applicable |
| Settings/pricing tables enrolled in `TENANT_TABLES`; H4 gate green (3.3/3.4 test req) | INT | R-005 | 2 | Dev | Same one-place enrollment; gate bites if omitted |
| Work-role / article money rates are **integer öre**; float/negative/overflow/locale-comma rejected (3.4 test req) | UNIT | R-006 | 4-6 | Dev | Pure validation; no rounding/VAT math (Epic 4) |
| `articles` carry **no** supplier credential/sync/import/mapping fields (if included) (3.4 AC2) | UNIT/INT | R-007 | 2-3 | Dev | Schema/shape assertion; manual-only; scope-guard |
| No personnummer field exists by default on any CRM table (3.1 AC1) | INT/UNIT | R-009 | 1-2 | Dev | Schema introspection assertion |
| Snapshot builder captures the documented fields and **freezes** them; mutating the source afterward does NOT change a prior snapshot (3.5 AC1/AC2) | UNIT | R-008 | 4-6 | Dev | The core contract test — no silent recompute |
| Cross-tenant use of a source id (work role/article/settings) rejected by command validation + RLS (3.5 AC3) | INT/RLS | R-008, R-004 | 2-3 | Dev | Source ownership verified; no cross-tenant source spoof |
| Customer-facing quote terms / VAT wording is NOT rendered or persisted as approved without the explicit sign-off flag (3.3 AC2) | INT/E2E | R-011 | 2 | Dev | Approval is gated; implementation never auto-approves |

**Total P0**: ~26-32 tests

### P1 (High)

**Criteria**: Important lifecycle/feature + medium risk (3-4) + common admin workflows.

| Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| CRM create/view/update/archive/search commands verify membership, validate input, enforce parent ownership, write audit on critical changes (3.1 AC2) | INT | R-001, R-002, R-010 | 4-6 | Dev | The canonical CRM envelope happy + failure paths |
| Archive-over-hard-delete: archived CRM records are excluded from default lists but retained (3.1 tech notes) | INT | R-001 | 2 | Dev | Archive status filter; no hard delete by default |
| Required-field/format validation where implemented (display name, email, phone) returns typed VALIDATION_FAILED (3.1 test req) | INT/UNIT | R-001 | 2-3 | Dev | Conservative Phase-A field set only |
| Settings update commands (company identity, VAT display/assumptions, quote terms) validate, tenant-scope, audit, and surface in settings UI (3.3 AC1) | INT | R-003, R-010 | 3-4 | Dev | Field-by-field; values stored for later snapshotting |
| Work-role create/update/archive/reactivate keeps cost/sell rates, active state, display name, source timestamps tenant-owned + audited (3.4 AC1) | INT | R-004, R-006, R-010 | 3-4 | Dev | Lifecycle + audit; öre rates round-trip exactly |
| CRM/settings/pricing audit metadata hygiene: no PII/secret/broad free-text persisted (3.1/3.3/3.4 SEC) | INT/UNIT | R-010 | 2-3 | Dev | Reuse sanitizer; forbidden-content assertion on new commands |
| Golden fixtures for work-role + optional-article source snapshot data match the documented contract shape (3.5 test req) | UNIT | R-008 | 2-3 | Dev | Golden master for source-snapshot examples |
| Snapshot contract carries öre values, VAT assumptions, source timestamp/version, tenant ownership per documented contract (3.5 AC1) | UNIT | R-008 | 2-3 | Dev | Field-presence + type assertions on the builder output |
| CRM search/filter finds customers by approved Phase-A fields; empty/loading/failed/no-results/duplicate-like states are clear (3.2 AC1) | E2E/Component | R-012 | 4-6 | Dev | One assertion per state; UI is not the security boundary |
| Sign-off status/warning is displayed for quote terms (owner/legal) (3.3 AC2) | E2E/Component | R-011 | 1-2 | Dev | Warning visible until explicit sign-off |

**Total P1**: ~22-28 tests

### P2 (Medium)

**Criteria**: Secondary behavior + low risk (1-2) + edge cases.

| Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Customer detail screen shows only Phase-A-owned record areas (facilities/contacts/related placeholders/files/event history) where supported; no deferred modules (3.2 AC2) | E2E/Component | R-012 | 2-3 | Dev | Asserts narrow surface; no deferred-module labels |
| Facility/contact dialogs: focus moves predictably on open/close; validation errors programmatically associated (`aria-invalid`/`aria-describedby`) (3.2 AC3) | E2E/Component | R-012 | 2-3 | Dev | a11y focus + field-error association |
| CRM route authorization: a non-member / wrong-tenant user cannot reach CRM routes (3.2 test req) | E2E/INT | R-001 | 1-2 | Dev | Inherits Epic 2 layout enforcement; CRM-route smoke |
| Fixture-shape compatibility: anonymized Lovable-shaped CRM/settings/work-role fixtures load without importing deferred data (3.1/3.3/3.4 migration impact) | INT/UNIT | R-007, R-009 | 2-3 | Dev | Shape-only; no real company/person text |
| Swedish domain labels present where helpful (Kunder/Anläggningar/Kontakter) without breaking nav guardrails (3.2 tech notes) | Component | R-012 | 1 | Dev | Label presence; not a security check |

**Total P2**: ~8-12 tests

### P3 (Low)

**Criteria**: Nice-to-have + exploratory + benchmarks.

| Requirement | Test Level | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- |
| Snapshot-builder developer-ergonomics (clear error when a source id is unknown/cross-tenant) | UNIT | 1-2 | Dev | DX, not correctness |
| CRM list copy / empty-state wording polish | E2E | 1-2 | Dev | Cosmetic; manual acceptable |
| Documented limitation notes for deferred CRM/RLS perf testing (R-013) and co-member enumeration carry-forward | docs | 1 | Dev | Awareness only |
| Exploratory: many-facility/contact-per-customer rendering | E2E | 1-2 | Dev | Exploratory; not a gate |

**Total P3**: ~4-7 tests

---

## Execution Strategy (PR / Nightly / Weekly)

Philosophy: **run everything in PRs if the suite stays under ~15 minutes**; defer only genuinely
expensive/long-running work. Epic 3 adds test *volume* (six tables' worth of negatives + money/
snapshot units) but little new wall-clock cost — the dominant cost (one-time `supabase db reset`) is
already paid by Epic 2's harness, and the new UNIT/golden tests are sub-second.

- **PR (every PR to main):** All UNIT (money öre, snapshot builders, validation, golden fixtures),
  INT (CRM/settings/pricing commands, ownership-verify, audit), and RLS-negative (cross-tenant + anon
  for every new table) tests, plus the H4 inventory gate. These are the epic's reason to exist and
  must gate merges. They map onto the existing CI stages (typecheck → lint → unit → build → migration
  reset → integration commands → RLS/anon negatives → inventory gate). The focused CRM/settings UI
  E2E (search/filter states, focus/a11y, sign-off warning, no-deferred-nav) runs in PR while the
  headed/browser cost stays modest.
- **Nightly:** Full parallel run of the (now larger) RLS suite across more workers to surface
  parallel-isolation interference on the new tables, plus a periodic scratch-branch H4 bite check.
- **Weekly / on-demand:** P3 ergonomics/exploratory + any future CRM/RLS performance exploration
  (R-013, deferred — extend the Epic 2 `auth-rls-baseline` harness if/when scope warrants). No
  performance/chaos suite is in scope for this epic.

Parallelization note: the RLS negative suite is parameterized over `TENANT_TABLES` and per-worker
tenant pairs, so adding six tables scales to minutes, not a linear copy-paste blow-up; the new
money/snapshot UNIT + golden tests add negligible time.

---

## Resource Estimates

Ranges only (no false precision). Estimates **exclude** first-time framework/stack setup (already
paid in Epic 2). The new cost is per-table factory + inventory enrollment and the money/snapshot
UNIT + golden layer.

| Priority | Count | Hours/Test (incl. per-table enrollment share) | Total Hours | Notes |
| --- | --- | --- | --- | --- |
| P0 | ~26-32 | ~1.2-1.5 | ~32-48 | Isolation/parent-spoof/öre/snapshot-freeze/guardrail-critical |
| P1 | ~22-28 | ~1.0-1.2 | ~22-34 | CRM/settings/pricing command lifecycle, audit, golden, UX-state |
| P2 | ~8-12 | ~0.5-1.0 | ~4-12 | Secondary UI/a11y/fixture-shape edge cases |
| P3 | ~4-7 | ~0.25-0.5 | ~1-4 | Exploratory/cosmetic/docs |
| **Total** | **~60-79** | **-** | **~60-95** | **~1.5-2.5 weeks** (1 dev), reusing the Epic 2 harness |

New per-epic line items folded into the above (do not double-count):

- Extend two-tenant factories to CRM/settings/pricing rows (per-worker, auto-cleanup): ~4-8h
- Enroll six new tables in `TENANT_TABLES` with both metadata seams (data edits, not new suites): ~3-6h
- Money öre validation UNIT layer (no rounding/VAT): ~2-4h
- Snapshot-builder UNIT + golden-fixture layer (Story 3.5 contract): ~6-10h
- Focused CRM/settings UI E2E/Component (search/filter states, focus/a11y, sign-off warning): ~6-10h

### Prerequisites

**Test Data:**

- Extended factories: customer/facility/contact (with parent links), company settings/terms, work
  role (öre rates), optional article — faker-based, per-worker, auto-cleanup; reuse the Epic 2
  two-tenant fixture as the substrate
- Anonymized Lovable-shaped fixtures (content-shape only; no real company/person text)
- Golden source-snapshot fixtures for work role + optional article (Story 3.5)

**Tooling:**

- Existing Vitest runner (UNIT/INT) + Supabase CLI local stack (INT/RLS) + Playwright (focused E2E)
- The existing H4 inventory gate + cross-tenant/anon negative harness (extend by data)

**Environment:**

- Local Supabase via Docker (Windows/WSL conventions already established in Epic 1/2); tests target
  local Supabase exclusively; CI runs the same `supabase db reset` + suite

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions) — isolation, parent-spoof, öre integrity, snapshot freeze,
  personnummer-absence, supplier-scope-absence, and sign-off gating tests
- **P1 pass rate**: ≥95% (failures require an explicit, owned waiver)
- **P2/P3 pass rate**: ≥90% (informational)
- **High-risk mitigations (R-001..R-008)**: 100% complete or an approved, expiring waiver

### Coverage Targets

- **Cross-tenant isolation scenarios**: 100% — every new tenant-owned table enrolled in the negative
  suite (enforced by the H4 inventory gate, not by reviewer diligence)
- **Security scenarios (SEC category)**: 100% pass
- **Money öre integrity (R-006)**: 100% of the defined validation assertions
- **Snapshot contract freeze/no-recompute (R-008)**: 100% of the defined builder assertions
- **CRM command envelope paths** (membership/validate/ownership/audit): ≥90%

### Non-Negotiable Requirements (epic cannot ship without)

- [ ] All P0 tests pass
- [ ] No high-risk (≥6) item unmitigated/unwaived
- [ ] SEC-category tests pass 100%
- [ ] **Every new tenant-owned table enrolled in the H4 inventory gate** (proven to bite on omission)
- [ ] **No personnummer field** by default on any CRM table (R-009)
- [ ] **Articles carry no supplier-scope fields** if articles are included (R-007)
- [ ] **Money rates are integer öre** with float/negative inputs rejected (R-006)
- [ ] **Snapshot values are frozen** and do not recompute on source change (R-008)
- [ ] **Customer-facing tax/legal text is never auto-approved** without the sign-off flag (R-011)

---

## Mitigation Plans

### R-001: Missing/incorrect RLS on a new CRM table (Score: 6)

**Mitigation Strategy:** Enable + FORCE RLS on `customers`/`facilities`/`contacts` via the inherited
`is_active_tenant_member`/`is_tenant_admin` helpers; FK to `tenants`, NOT NULL `tenant_id`. Enroll each
in `TENANT_TABLES` so the existing parameterized cross-tenant SELECT/INSERT/UPDATE/DELETE suite covers
them by data. Each verb proves Tenant A cannot read, mutate, or forge ownership of Tenant B rows.
**Owner:** Dev (Story 3.1). **Timeline:** Story 3.1. **Status:** Planned.
**Verification:** Negative suite green for each CRM table × four verbs; weakening a policy on a scratch
branch turns a test red.

### R-002: Parent-ownership spoofing / client-supplied parent or tenant_id (Score: 6)

**Mitigation Strategy:** Facility/contact commands declare an envelope `ownership` target so the
parent (customer/facility) is verified to belong to the resolved tenant via a tenant-scoped SELECT
(zero rows ⇒ TENANT_ACCESS_DENIED). Add a parent-consistency CHECK/FK so a child cannot reference a
parent in another tenant even at the DB layer. Client-supplied parent/`tenant_id` is ignored/verified,
never trusted.
**Owner:** Dev (Story 3.1). **Timeline:** Story 3.1. **Status:** Planned.
**Verification:** Creating/linking a child to a Tenant B parent is denied; a spoofed client `tenant_id`
or parent id never lands a row in another tenant.

### R-003: Missing/incorrect RLS on settings/terms tables (Score: 6)

**Mitigation Strategy:** Same FORCE-RLS + helper-scoped policy pattern on company identity, VAT
defaults, and quote terms tables; enroll in `TENANT_TABLES`; cross-tenant settings/terms read/write
negatives + audit-isolation.
**Owner:** Dev (Story 3.3). **Timeline:** Story 3.3. **Status:** Planned.
**Verification:** Tenant A cannot read or write Tenant B settings/terms; negatives green.

### R-004: Missing/incorrect RLS or parent-spoof on pricing tables (Score: 6)

**Mitigation Strategy:** FORCE RLS + helper policies on `work_roles` (and `articles` if included);
enroll in `TENANT_TABLES`; cross-tenant + parent-spoof negatives. Pricing is customer-visible
downstream, so isolation is load-bearing.
**Owner:** Dev (Story 3.4). **Timeline:** Story 3.4. **Status:** Planned.
**Verification:** Cross-tenant pricing read/write denied; source-id spoof rejected.

### R-005: New tenant table ships without H4 gate enrollment (Score: 6)

**Mitigation Strategy:** Use — do not bypass — the existing H4 inventory gate, which fails CI by name
on any tenant-owned table not in `TENANT_TABLES`. Enroll each new table with BOTH the cross-tenant
(`spoofedRowFor`/`tenantBFilter`/`hijackMutationFor`) and anon (`anonRowFor`/`anonFilterFor`/
`anonMutationFor`) seams in one place.
**Owner:** Dev (each table-creating story). **Timeline:** 3.1/3.3/3.4. **Status:** Planned.
**Verification:** Add a new tenant table on a scratch branch without enrolling it → CI fails with the
named "table not covered" message; with both seams wired → gate green.

### R-006: Money stored/validated as float or mixed units (Score: 6)

**Mitigation Strategy:** Cost/sell hourly rates and any article price are stored and validated as
**integer öre** only. UNIT tests reject floats, negatives, overflow, and locale-comma ("1 234,50")
inputs and prove exact round-trip. NO rounding/VAT/ROT math is implemented in Epic 3 — that is Epic 4.
**Owner:** Dev (Story 3.4). **Timeline:** Story 3.4. **Status:** Planned.
**Verification:** Float/negative/overflow/comma inputs are rejected with VALIDATION_FAILED; an öre
value round-trips through store→read unchanged.

### R-007: "Articles" pulls supplier scope (Score: 6)

**Mitigation Strategy:** If articles are included at all (only when pilot fixtures/owner require it),
the schema and commands carry NO supplier credentials, sync fields, imports, APIs, or external
mappings. Schema/shape assertions + a scope-guard review enforce manual-minimal-tenant-owned. If not
needed, the feature is off and the article scenarios are inactive.
**Owner:** Dev (Story 3.4). **Timeline:** Story 3.4. **Status:** Planned.
**Verification:** Article table/command shape contains no supplier-scope columns/fields; scope-guard
review passes; stop-condition escalates if article work expands toward supplier scope.

### R-008: Snapshot contract too thin OR silent recompute (Score: 6)

**Mitigation Strategy:** Document a SMALL Phase-A snapshot contract — source id, display name/content,
öre values, VAT assumptions, source timestamp/version, tenant ownership. Snapshot-builder UNIT tests
prove the captured values are frozen: mutating the underlying source after a snapshot does NOT change
the prior snapshot (no silent recompute). Golden fixtures pin the work-role and optional-article source
shapes. Cross-tenant source-id use is rejected by command validation + RLS. Concrete quote-version
persistence is intentionally deferred to Epics 5-6.
**Owner:** Dev (Story 3.5). **Timeline:** Story 3.5. **Status:** Planned.
**Verification:** After snapshot, change the source rate → re-reading the snapshot shows the OLD
value; golden fixtures match; cross-tenant source id rejected.

---

## Assumptions and Dependencies

### Assumptions

1. Phase-A product role remains exactly `tenant_admin`; Epic 3 introduces no new role surface.
2. Pooled multi-tenancy (one Supabase project, many tenants) per ADR-A002 — RLS is the isolation
   mechanism under test for every new table.
3. Automated tests run against **local Supabase only**, never shared dev/staging/prod.
4. CRM customer-type list and facility/contact requiredness are **conservative assumptions pending
   owner sign-off**, not final — tests assert the conservative defaults, and a stop-condition escalates
   if the model must materially change.
5. Money in Epic 3 is **integer öre storage + validation only**; all rounding/VAT/ROT/grön-teknik math
   is Epic 4. Story 3.5's snapshot contract is small and Phase-A-aligned; quote-version persistence is
   Epics 5-6.
6. The Epic 2 two-tenant factory + H4 inventory gate + command envelope are reused as-is and extended
   by data; no parallel harness is built.

### Dependencies

1. **Epic 2 merged** — envelope, H4 gate, factories, audit, RLS helpers — required before any Epic 3
   story.
2. **Story ordering**: 3.1 (CRM tables/commands) → 3.2 (CRM UX, depends on 3.1); 3.3 (settings/terms,
   depends on Epic 2) → 3.4 (work roles/articles, depends on 3.1+3.3) → 3.5 (snapshot contract, depends
   on 3.3+3.4). 3.5 needs the real source tables from 3.3/3.4 to snapshot.
3. **Owner sign-off decision** on customer-type/requiredness (3.1/3.2) and on tax/legal quote-terms
   wording (3.3/3.5) — these are human stop-conditions, not implementable defaults.
4. **Articles in/out decision** — gates whether R-007 article scenarios are active.

### Risks to Plan

- **Risk**: A new tenant-owned table is added without enrolling it in `TENANT_TABLES` (or with only one
  metadata seam).
  - **Impact**: A CRM/settings/pricing table ships with no cross-tenant or anon negative — a silent
    isolation hole inherited by every later quote that snapshots it.
  - **Contingency**: The H4 gate already fails CI by name on omission (R-005); enforce both seams; run
    the scratch-branch bite check at epic boundary.
- **Risk**: Implementation treats a conservative CRM/tax assumption as final without owner sign-off.
  - **Impact**: Wrong data model or unapproved customer-facing text shipped to a pilot.
  - **Contingency**: Honor the epics.md stop-conditions; sign-off gating test (R-011); escalate to human
    rather than guess (per autonomous-run stop policy).
- **Risk**: Money or snapshot logic prematurely implements Epic 4 semantics (rounding/VAT) inside Epic 3.
  - **Impact**: Scope creep + duplicated/conflicting money logic across epics.
  - **Contingency**: Keep money to integer-öre storage/validation; snapshot contract small; cross-ref
    Epic 4 test design; reviewer scope-guard.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| **H4 RLS inventory gate** (`tests/integration/rls/tenant-table-inventory.ts`) | Six+ new tables enroll; gate's introspection now returns them | All existing Epic 2 negatives must stay green; the gate must demand and then accept each new table |
| **Command envelope** (`src/server/commands/envelope.ts`) | New CRM/settings/pricing commands plug in; `verifyOwnership` exercised for parent targets | Existing envelope failure-mode + audit tests must stay green; new commands reuse the same typed error codes |
| **Two-tenant factories** (`tests/factories/*`) | Extended with CRM/settings/pricing builders | Existing factory-isolation + cleanup tests must stay green under the larger fixture set |
| **Append-only `audit_events`** | New business commands write audit rows via `writeAuditEvent` | Append-only + metadata-hygiene tests must stay green with the new `target_type`/`event_type`/metadata fields |
| **CI pipeline** (`.github/workflows/ci.yml`) | Larger RLS + new UNIT/golden suites added to existing stages | All Epic 1/2 gates remain green; new gates added, not replacing |
| **App-shell nav guardrails** (Epic 1) | New CRM/settings nav surfaces appear; deferred modules still hidden | No deferred-module nav labels regress in; CRM/settings routes are authorization-guarded |
| **Future Epics 4-6 (money/snapshot/quotes)** | Story 3.5 contract is the seam they consume | The snapshot contract shape is the standing input to quote-version snapshotting; a change here ripples into Epic 5/6 trace |

---

## Follow-on Workflows (Manual)

- Run `*atdd` to scaffold failing P0 tests (per-table cross-tenant/anon RLS negatives, parent-spoof,
  öre validation, snapshot-freeze) once each owning story starts — the natural first move inside
  Stories 3.1/3.3/3.4/3.5.
- Run `*automate` to broaden coverage after the tables/commands are implemented.
- Run `*trace` at the epic boundary to produce the traceability matrix + gate decision
  (PASS/CONCERNS/FAIL) against these P0/P1 scenarios.
- Run `*nfr-assess` if/when CRM/RLS performance (R-013) is brought into scope.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: ______ Date: ______
- [ ] Tech Lead: ______ Date: ______
- [ ] QA Lead: ______ Date: ______

**Comments:**

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — risk classification + gate decision framework
- `probability-impact.md` — 1-9 scoring methodology and DOCUMENT/MONITOR/MITIGATE/BLOCK thresholds
- `test-levels-framework.md` — UNIT/INT/RLS(integration)/E2E selection, duplicate-coverage guard
- `test-priorities-matrix.md` — P0-P3 prioritization and risk-to-priority mapping

### Related Documents

- Epic: `_bmad-output/planning-artifacts/epics.md` (Epic 3, lines 685-869)
- PRD: `_bmad-output/planning-artifacts/prd.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Prior epic test design (conventions + inherited foundation): `_bmad-output/test-artifacts/test-design-epic-2.md`
- Inherited security harness: `tests/integration/rls/tenant-table-inventory.ts` (H4 gate + "STANDING CONTRACT (Epics 3-9)")
- Inherited command authority: `src/server/commands/envelope.ts`
- Carry-forward gaps: `_bmad-output/implementation-artifacts/deferred-work.md`
- Epic 2 retrospective: `_bmad-output/implementation-artifacts/epic-2-retro-2026-06-29.md`

### Traceability Note

Acceptance-criteria → risk → test-level → priority links are embedded in the coverage tables above
(each row cites its AC source and Risk Link). A formal traceability matrix + gate decision is the job
of the `*trace` workflow at the epic boundary and is intentionally not duplicated here.

---

**Generated by**: BMad TEA Agent — Test Architect Module
**Workflow**: `bmad-testarch-test-design`
**Version**: 4.0 (BMad v6)

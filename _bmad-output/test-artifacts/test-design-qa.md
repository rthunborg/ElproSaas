---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-06-11'
workflowType: 'testarch-test-design'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
---

# Test Design for QA: Elpro Phase A (Internal Pilot MVP)

**Purpose:** Test execution recipe for the QA/test owner. Defines what to test, how to test it, and what is needed from other roles.

**Date:** 2026-06-11
**Author:** Rasmus (TEA / Murat workflow)
**Status:** Draft
**Project:** ElproSaas

**Related:** See `test-design-architecture.md` for testability concerns (B1–B3, H1–H5) and full risk mitigation plans.

---

## Executive Summary

**Scope:** All Phase A epics (E1–E9): tenant/RLS foundation, CRM/settings/pricing, money/tax primitives, calculations, quote versions/PDF, acceptance-to-job, files/storage, migration/golden masters. Tests are built story-by-story (test-first), not as a separate phase.

**Risk Summary:**

- Total risks: 14 (8 high-priority ≥6, 5 medium, 1 low)
- Critical categories: SEC (tenant isolation), DATA (customer-commitment integrity), BUS (tax sign-off)

**Coverage Summary:**

- P0: ~55–65 scenarios (isolation, money/tax, immutability, acceptance transaction, core journey)
- P1: ~50–60 scenarios (CRM/settings commands, PDF, golden masters, file lifecycle)
- P2: ~12–15 scenarios (editor UX flows, deferred-scope guardrails, file index)
- P3: ~3–5 scenarios (accessibility smoke, exploratory)
- **Total:** ~120–145 scenarios (~2.5–4 weeks equivalent for one full-time test owner, spread across epics)

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Load/performance testing** | NFR26 defers targets until External Beta sizing | NFR24 responsiveness checked informally during E2E runs |
| **Contract (Pact) testing** | Monolith + Supabase; no service-to-service contracts in Phase A | Revisit if Fortnox/supplier integrations are approved later |
| **Mobile/field-worker UX** | Explicitly deferred (FR61) | Deferred-scope guardrail scan asserts absence |
| **Migration classification & delta review (manual parts)** | E9.1/E9.4 are human runbook workflows | Golden-master comparison harness (E9.3) is automated |
| **Email sending** | Quote sending is manual PDF/status tracking (PRD A9) | N/A |

---

## Dependencies & Test Blockers

**CRITICAL:** Test development cannot proceed without these.

### Backend/Architecture Dependencies (Pre-Implementation)

Source: Architecture doc Quick Guide (B1–B3, H1–H5).

1. **B1: Seeding/factory contract** — Dev — E1/E2. Factories for tenants, auth users, memberships, CRM records, calculations. Blocks all integration/RLS tests.
2. **B2: Test-user auth method** — Dev — E2. Password test users or admin token minting. Blocks authenticated command tests.
3. **B3: Transaction mechanism decision (AR21)** — Architect — E2/E7. Determines acceptance-to-job harness shape.
4. **H2: Configurable signed-URL TTL** — Dev — E8. Blocks expiry negative tests.
5. **H3: PDF determinism ACs** — Dev — E6. Blocks golden PDF comparison.

### QA Infrastructure Setup (Pre-Implementation)

1. **Test Data Factories** — faker-based factories with overrides for tenant, user/membership, customer, facility, contact, work role, calculation (sections/rows), quote draft. Auto-cleanup via fixtures; every entity tracked and deleted in teardown.
2. **Two-Tenant Fixture** — standard fixture provisioning Tenant A + Tenant B with one `tenant_admin` each; the RLS suite and all isolation tests consume it. One tenant pair per worker for parallel safety (H5).
3. **Test Environments** — Local: Supabase CLI stack with migration reset + seed. CI: same, pinned CLI version, reset per run. No automated tests against shared dev/staging projects.
4. **Merged Playwright fixtures** — `mergeTests` composition of `apiRequest`, `auth-session`, `recurse`, `log` from `@seontechnologies/playwright-utils` plus project fixtures (tenant factory, command client).

**Example factory + command-test pattern:**

```typescript
import { test } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

test('createCustomer is tenant-scoped @p0 @rls', async ({ apiRequest }) => {
  const customer = {
    name: faker.company.name(),
    customerType: 'company',
  };

  // Authenticated as Tenant A admin (auth-session fixture)
  const { status, body } = await apiRequest({
    method: 'POST',
    path: '/api/commands/crm/create-customer',
    body: customer,
  });

  expect(status).toBe(200);
  expect(body.tenantId).toBe(process.env.TEST_TENANT_A_ID); // server-resolved, not client-supplied

  // Cross-tenant negative: Tenant B admin cannot read it
  const { status: crossStatus, body: crossBody } = await apiRequest({
    method: 'GET',
    path: `/api/customers/${body.id}`,
    headers: { Authorization: `Bearer ${process.env.TEST_TENANT_B_TOKEN}` },
  });

  expect(crossStatus).toBe(404); // generic not-found, no information leak
  expect(crossBody.code).toBe('TENANT_ACCESS_DENIED');
});
```

---

## Risk Assessment

Full details and mitigation plans in Architecture doc. QA-relevant summary:

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Score | QA Test Coverage |
| --- | --- | --- | --- | --- |
| **R-SEC-1** | SEC | RLS gap → cross-tenant data access | **6** | Parameterized cross-tenant negative suite over every tenant table; CI inventory gate |
| **R-SEC-2** | SEC | Service-role key exposure | **6** | Bundle/env static scan; unauthenticated-route assertions |
| **R-SEC-3** | SEC | Cross-tenant file access / path spoofing | **6** | Storage negative suite: spoofing, cross-tenant sign/download, expired URL |
| **R-DATA-1** | DATA | Money/VAT/ROT/grön teknik errors | **6** | Unit suites (öre, rounding, VAT bp, deduction caps) + golden masters vs Lovable |
| **R-DATA-2** | DATA | Sent/accepted immutability bypass | **6** | Command negatives + direct authenticated DB-update negatives |
| **R-DATA-3** | DATA | Partial acceptance-to-job / duplicate jobs | **6** | Idempotency repeats, uniqueness violations, mid-transaction fault injection |
| **R-DATA-4** | DATA | PII in fixtures | **6** | CI PII/secret scan over fixtures and committed files |
| **R-BUS-1** | BUS | Unapproved tax assumptions in real quotes | **6** | Warning/confirmation assertions; estimates labeled; cutover gate checks sign-off register |

### Medium/Low-Priority Risks

| Risk ID | Category | Description | Score | QA Test Coverage |
| --- | --- | --- | --- | --- |
| R-BUS-2 | BUS | Undetected Lovable deltas | 4 | Golden-master harness (E9.3) + delta register review |
| R-TECH-1 | TECH | PDF nondeterminism | 4 | Text-extraction comparison primary; repeated-render stability test |
| R-TECH-3 | TECH | Quote number collisions | 4 | Concurrent allocation test (parallel version creation, same tenant) |
| R-OPS-1 | OPS | Supabase/migration-reset flakiness | 4 | Reset gate in CI; pinned versions |
| R-OPS-2 | OPS | Audit coverage gaps | 4 | Audit-event assertion in every critical-command test |
| R-TECH-2 | TECH | Security-definer RPC misconfiguration | 3 | Per-RPC negative tests if B3 chooses RPC path |

---

## Entry Criteria

- [ ] B1 (factories/seeding) and B2 (test auth) resolved
- [ ] Local Supabase stack + migration reset working from fresh checkout (E1)
- [ ] Two-tenant fixture provisioning works
- [ ] CI pipeline runs typecheck/lint/unit/build (E1.2)
- [ ] B3 decided before E7 test development

## Exit Criteria

- [ ] All P0 tests passing (100% — blocks merge)
- [ ] P1 tests ≥95% passing, failures triaged within the story
- [ ] 100% of tenant-owned tables enrolled in the RLS negative suite
- [ ] Unit coverage ≥80% for `src/lib/money`, `src/lib/tax`, snapshot builders, lifecycle guards
- [ ] No open high-severity bugs in isolation, money/tax, or immutability areas
- [ ] All high-priority risk mitigations verified; R-BUS-1 additionally has owner + accounting/legal sign-off (pilot cutover gate, E9.5)
- [ ] Golden-master pack passing for representative calc/quote/PDF/acceptance/job fixtures (AC17)

---

## Test Coverage Plan

**IMPORTANT:** P0/P1/P2/P3 = **priority and risk level** (what to focus on if time-constrained), NOT execution timing. See Execution Strategy.

Scenario groups are system-level; epic-level test design (run per epic before implementation) decomposes them into atomic per-story scenarios with `{EPIC}.{STORY}-{LEVEL}-{SEQ}` IDs.

### P0 (Critical)

**Criteria:** Blocks core functionality + high risk (≥6) + no workaround.

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **P0-001** | Migration reset from empty DB + seed creates two tenants (NFR40) | CI gate | R-OPS-1 | E1; gate, not a spec file |
| **P0-002** | Cross-tenant SELECT blocked for every tenant table (NFR2-3) | RLS negative | R-SEC-1 | Parameterized over table inventory |
| **P0-003** | Cross-tenant INSERT with foreign tenant_id / parent ids blocked | RLS negative | R-SEC-1 | Includes child-table parent-mismatch |
| **P0-004** | Cross-tenant UPDATE/DELETE/archive blocked | RLS negative | R-SEC-1 | Includes locked rows |
| **P0-005** | Commands reject client-supplied mismatched tenant ids (AR6) | Integration | R-SEC-1 | Spoofed tenantId in body |
| **P0-006** | Unauthenticated access to privileged routes rejected (NFR5) | Integration | R-SEC-2 | Route inventory sweep |
| **P0-007** | No service-role markers in client bundle/committed files (NFR4) | Static scan | R-SEC-2 | CI step with canary verification |
| **P0-008** | Membership required: user without active `tenant_admin` rejected (FR1-2) | Integration | R-SEC-1 | Disabled/invited statuses too |
| **P0-009** | Integer öre arithmetic + rounding policy (line, VAT, totals) (NFR9, AR14) | Unit | R-DATA-1 | Edge: 0, negative, fractional qty, large values |
| **P0-010** | VAT basis-point calculation and display totals (FR27) | Unit | R-DATA-1 | 25/12/6%, mixed rates |
| **P0-011** | ROT/grön teknik estimates: caps, persons, schablon, invalid-mix blocked (FR28) | Unit | R-DATA-1, R-BUS-1 | Estimates labeled; warnings emitted |
| **P0-012** | Quote version snapshot completeness (NFR10, AR15) | Integration | R-DATA-1 | All customer-visible fields snapshotted; later settings edits don't change snapshot |
| **P0-013** | Sent quote version immutable via commands (NFR11) | Integration | R-DATA-2 | `QUOTE_VERSION_LOCKED` asserted |
| **P0-014** | Sent/accepted rows immutable via direct authenticated DB update | DB negative | R-DATA-2 | Trigger/constraint level, not app code |
| **P0-015** | Acceptance + job creation atomic: fault injection leaves no partial state (NFR13, NFR20) | Integration | R-DATA-3 | Per B3 mechanism |
| **P0-016** | Repeated accept/create-job is idempotent; uniqueness prevents duplicates (FR47) | Integration | R-DATA-3 | Returns existing records |
| **P0-017** | Adjusted accepted price requires explicit reason/evidence (FR43) | Integration | R-DATA-3 | `VALIDATION_FAILED` without reason |
| **P0-018** | Cross-tenant storage access + path spoofing blocked (NFR8) | Storage negative | R-SEC-3 | Sign/download/list of foreign objects |
| **P0-019** | Signed URL expiry enforced (NFR19) | Storage negative | R-SEC-3 | Needs H2 (configurable TTL) |
| **P0-020** | Fixture PII/secret scan (NFR17-18) | Static scan | R-DATA-4 | CI step over fixtures + docs |
| **P0-021** | Core pilot journey: CRM → settings → calculation → quote → PDF → sent → acceptance → job (AC3) | E2E | All | One journey, UI-driven, network-first waits |
| **P0-022** | Audit event written for every critical command (NFR7) | Integration | R-OPS-2 | Embedded assertion pattern, all command tests |
| **P0-023** | Hidden rows + options/tillval handled correctly in totals (NFR14) | Unit | R-DATA-1 | Per conservative Phase A rules |
| **P0-024** | Quote numbers server-generated, tenant-scoped (FR32) | Integration | R-TECH-3 | No client-supplied numbers |

**Total P0:** ~55–65 atomic scenarios after epic-level decomposition.

### P1 (High)

**Criteria:** Important features + medium/high risk + common workflows.

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **P1-001** | CRM CRUD/archive/search: customers, facilities, contacts (FR7-11) | Integration | R-SEC-1 | Tenant-scoped; primary-contact rule |
| **P1-002** | Company settings, quote terms, VAT defaults maintained (FR13-15) | Integration | — | Audit asserted |
| **P1-003** | Work roles + optional articles with pricing source preserved (FR16-17, FR23-24) | Integration | R-DATA-1 | Snapshot source contract (E3.5) |
| **P1-004** | Calculation commands: sections, rows, totals, readiness warnings (FR19-22, FR29) | Integration | R-DATA-1 | Blocking vs warning separation |
| **P1-005** | Margin indicators and customer-facing totals (FR27) | Unit | R-DATA-1 | — |
| **P1-006** | Quote draft editing before send; attachment selection (FR31, FR34) | Integration | R-DATA-2 | — |
| **P1-007** | New version after send; prior versions preserved; supersede lifecycle (FR38-40) | Integration | R-DATA-2 | Timeline events asserted |
| **P1-008** | PDF generated from snapshot only; status states + retry (FR33, AR18) | Integration | R-TECH-1 | not_generated/generating/generated/failed |
| **P1-009** | PDF text-extraction golden comparison | Golden | R-TECH-1, R-BUS-2 | Stable after repeated renders |
| **P1-010** | Concurrent quote-number allocation (same tenant, parallel) | Integration | R-TECH-3 | No gaps/duplicates |
| **P1-011** | Acceptance capture fields incl. channel/evidence/planned dates (FR41-42) | Integration | R-DATA-3 | — |
| **P1-012** | Correction workflow preserves originals + audit who/what/why (NFR23, FR44) | Integration | R-DATA-2 | — |
| **P1-013** | Job/order shows source quote version, acceptance, totals (FR48) | Integration | — | — |
| **P1-014** | Upload validation: MIME, size, owning entity, lifecycle (FR51) | Integration | R-SEC-3 | Blocked types/sizes |
| **P1-015** | File lifecycle locks: quote PDF, attachments, acceptance evidence (FR53) | Integration | R-DATA-2 | Replace/delete blocked when locked |
| **P1-016** | File audit events: upload/access/delete/lock (FR54) | Integration | R-OPS-2 | — |
| **P1-017** | Golden masters: calc totals, tax blocks, quote lines vs Lovable fixtures (FR57) | Golden | R-BUS-2, R-DATA-1 | E9.3 harness |
| **P1-018** | Golden masters: acceptance transitions + quote-to-job shape | Golden | R-BUS-2 | — |
| **P1-019** | E2E: sent-then-new-version journey (Journey 2) | E2E | R-DATA-2 | — |
| **P1-020** | E2E: adjusted-price acceptance journey (Journey 3) | E2E | R-DATA-3 | — |
| **P1-021** | Login/logout/session + tenant context resolution (FR1, FR3) | E2E smoke + Integration | — | — |

**Total P1:** ~50–60 atomic scenarios after decomposition.

### P2 (Medium)

**Criteria:** Secondary flows + low/medium risk + edge cases.

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **P2-001** | Calculation editor UX: section/row editing, totals panel (UX-DR11-15) | E2E | — | Thin; logic already unit-tested |
| **P2-002** | Snapshot review before quote creation (UX-DR16) | E2E | — | — |
| **P2-003** | List filters/search/pagination state preserved (UX-DR9) | E2E | — | — |
| **P2-004** | Deferred-scope guardrails: no deferred routes/nav/tables (FR60-61, NFR29) | Static scan | — | Schema + route inventory |
| **P2-005** | Limited file index within Phase A scope (E8.5) | Integration | — | — |
| **P2-006** | Archive flows and lifecycle state visibility (UX-DR10) | E2E | — | — |
| **P2-007** | CRM context selection on calculations/quotes (FR12) | Integration | — | — |

**Total P2:** ~12–15 scenarios.

### P3 (Low)

**Criteria:** Nice-to-have, exploratory, benchmarks.

| Test ID | Requirement | Test Level | Notes |
| --- | --- | --- | --- |
| **P3-001** | Accessibility smoke: keyboard reachability, error states (NFR30) | E2E (axe) | Core forms only |
| **P3-002** | Laptop/desktop viewport sanity (NFR31) | E2E | — |
| **P3-003** | Exploratory session per epic completion | Manual | Charter-based |

**Total P3:** ~3–5 scenarios.

**Duplicate-coverage guard:** money/tax logic proven at unit + golden levels only; immutability at integration + DB-constraint level; E2E proves journeys and UI wiring, never recalculates business logic.

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless there's significant infrastructure overhead. Playwright with parallelization runs hundreds of tests in ~10–15 min.

### Every PR: Playwright + Vitest/unit + scans (~10–15 min)

- All unit suites, all command integration tests, full parameterized RLS/storage negative suite, static scans (service-role, PII/secrets, deferred-scope), migration reset gate.
- E2E core journey (P0-021) included once it exists.
- Parallelized; per-worker tenant fixtures keep runs isolated.

### Nightly (~30–60 min)

- Full golden-master comparison pack (all Lovable fixtures).
- All E2E journeys including P2 UX flows.
- Burn-in loop for specs added/changed that day.

### Weekly / Pre-cutover (~hours)

- Clean-install-from-fresh-checkout verification (NFR35) on a fresh environment.
- Fixture anonymization deep review (manual + scan).
- Pilot acceptance gate dry-run (E9.5 report inputs).

**Manual (excluded from automation):** migration classification (E9.1), delta register review (E9.4), sign-off register checks, exploratory sessions.

---

## QA Effort Estimate

Test design + implementation effort only (excludes feature development):

| Priority | Count | Effort Range | Notes |
| --- | --- | --- | --- |
| P0 | ~55–65 | ~45–65 hours | Includes harness setup (~20–30 h: factories, two-tenant fixtures, merged fixtures, CI wiring) |
| P1 | ~50–60 | ~40–60 hours | Standard command/golden coverage |
| P2 | ~12–15 | ~10–20 hours | Thin E2E + scans |
| P3 | ~3–5 | ~3–6 hours | Smoke + exploratory |
| **Total** | ~120–145 | **~100–150 hours (~2.5–4 weeks)** | One test owner, spread across E1–E9 story work |

**Assumptions:** estimates include design, implementation, debugging, CI integration; exclude ~10% ongoing maintenance; assume B1/B2 blockers resolved before integration-test work starts.

---

## Implementation Planning Handoff

| Work Item | Owner | Target Milestone | Dependencies/Notes |
| --- | --- | --- | --- |
| Factories + two-tenant fixture + merged Playwright fixtures | Dev (test owner) | E1/E2 | B1, B2 |
| RLS negative suite + table-inventory CI gate | Dev (test owner) | E2 | B1; H4 approval |
| Service-role + PII/secret + deferred-scope scans in CI | Dev | E1–E2 | — |
| Money/tax unit suites + golden fixture pack | Dev | E4 | Rounding policy assumption documented |
| Immutability negatives (command + DB level) | Dev | E6–E7 | B3 |
| Acceptance-to-job transaction/idempotency/fault tests | Dev | E7 | B3 |
| Storage negative suite incl. TTL expiry | Dev | E8 | H2 |
| Golden-master comparison harness + Lovable fixture capture | Dev + Pilot operator | E9 | Lovable access, anonymization checklist |
| E2E journeys (core, new-version, adjusted-price) | Dev | E6–E9 | App shell + flows exist |

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope | Validation Steps |
| --- | --- | --- | --- |
| **Supabase Postgres/RLS** | Every migration changes policy surface | Full RLS negative suite | Runs on every PR; inventory gate catches unenrolled tables |
| **Supabase Storage** | File features (E8) touch bucket policies | Storage negative suite | PR + nightly |
| **Lovable legacy app** | Read-only oracle; no code dependency | Golden-master pack | Nightly; delta register before cutover |
| **CI pipeline** | New gates added per epic | All prior gates stay green | Gates are cumulative; docs-only PRs state skipped gates (NFR41) |

Regression strategy: suites are cumulative — every epic's tests keep running for all later epics; the PR suite is the regression suite.

---

## Appendix A: Code Examples & Tagging

```typescript
import { test } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { expect } from '@playwright/test';

// P0 security negative
test('@P0 @Security @RLS unauthenticated command returns 401', async ({ apiRequest }) => {
  const { status, body } = await apiRequest({
    method: 'POST',
    path: '/api/commands/quotes/mark-sent',
    body: { quoteVersionId: 'any' },
    skipAuth: true,
  });

  expect(status).toBe(401);
  expect(body.code).toBe('UNAUTHENTICATED');
});

// P0 immutability negative
test('@P0 @Immutability sent quote version rejects edits', async ({ apiRequest }) => {
  // assumes fixture created+sent a quote version
  const { status, body } = await apiRequest({
    method: 'POST',
    path: '/api/commands/quotes/update-draft',
    body: { quoteVersionId: process.env.TEST_SENT_VERSION_ID, introText: 'changed' },
  });

  expect(status).toBe(409);
  expect(body.code).toBe('QUOTE_VERSION_LOCKED');
});
```

**Run specific tags:**

```bash
npx playwright test --grep @P0          # only P0
npx playwright test --grep "@P0|@P1"    # P0 + P1
npx playwright test --grep @RLS         # isolation suite
npx playwright test                      # everything (default in PR)
```

---

## Appendix B: Knowledge Base References

- **Risk Governance:** `risk-governance.md` — scoring methodology, gate rules
- **Test Levels Framework:** `test-levels-framework.md` — unit vs integration vs E2E selection
- **Test Quality:** `test-quality.md` — DoD: no hard waits, no conditionals, <300 lines, <1.5 min, parallel-safe, self-cleaning
- **ADR Quality Readiness Checklist:** `adr-quality-readiness-checklist.md` — testability categories applied in the Architecture doc
- **Playwright Utils:** `overview.md`, `api-request.md`, `auth-session.md`, `recurse.md`

---

**Generated by:** BMad TEA Agent
**Workflow:** `bmad-testarch-test-design`
**Version:** 4.0 (BMad v6)

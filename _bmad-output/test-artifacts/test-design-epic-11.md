---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-09-04T09:34:14.7815272Z'
runScope: 'epic-level'
runKey: 'epic-11'
designLevel: 'epic'
epicNum: 11
---

# Test Design: Epic 11 - RBAC Mechanism and Admin User Management

**Date:** 2026-09-04  
**Author:** Rasmus  
**Status:** Draft

---

## Executive Summary

**Scope:** Epic-level test design for epic 11 and stories 11.1–11.4. The epic replaces the Phase A admin-only authorization posture with a server-enforced, multi-role permission matrix; opens the active Phase A surface to appropriately entitled non-admin roles; adds administrator user-management operations; and supplies a reusable role-aware authorization harness.

**Evidence basis:** Epic 11 acceptance criteria, FR66–FR72, NFR42–NFR44, AC-B1a-2/3, ADR-B001, the field-presence entitlement contract, the manifest governance rules, and current unit/integration/E2E seams. No browser session or external contract system was used: browser tooling was unavailable, and no Pact dependency or service-contract boundary exists for this epic.

**Risk Summary:**

- Total risks identified: **12**
- High-priority risks (score ≥6): **10**
- Release-blocking score-9 risks: **2** — policy↔matrix drift (R-1101) and sensitive-money leakage (R-1103)
- Critical categories: **security, data integrity, authorization governance, and reliability**
- Accepted or waived risks: **none**

**Coverage Summary:**

- P0 scenario families: **38** (~85–125 hours)
- P1 scenario families: **14** (~35–55 hours)
- P2/P3 scenario families: **3** (~11–22 hours)
- **Total effort:** ~131–202 hours (roughly 3–5 engineer-weeks for one owner, or 2–3 calendar weeks with parallel story ownership and shared fixtures)

The unusually high P0 density is intentional: epic 11 changes the authorization boundary of every active module, and the generated families expand into role×capability and role×table cases. P0 denotes release consequence, not execution timing.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| Custom tenant-role builder, database permission tables, or runtime-mutable role definitions | N-4 resolves Phase B to five fixed tenant roles and a code-owned matrix. | Static scope scans reject dynamic-role surfaces; later changes require an owner decision and a separately designed migration. |
| Tenant-wide Arbetsledare authorization | Arbetsledare is job-scoped in E16 and is not a tenant role in epic 11. | Schema/helper/UI negatives reject it as a tenant role; the Roles UI explains the distinction. |
| Custom email-delivery pipeline | E13 is not authorized; story 11.3 may use the sanctioned Supabase Auth invite flow only. | Test through a local/server-only Auth adapter; do not add a bespoke sender or external credential dependency. |
| Customer portal, online acceptance, self-serve signup, public anonymous suggestions, AI flows, live supplier APIs, or bookkeeping integrations beyond Fortnox | These are Phase C hard exclusions or otherwise outside the parity inventory. | Manifest, static containment, and Phase C scope scans remain mandatory CI gates. |
| Epic implementation and automated test code | This workflow produces the risk-informed test plan, not product or test implementation. | Run ATDD and automation workflows explicitly after story implementation is authorized. |
| Final NFR PASS/CONCERNS/FAIL verdict | Implementation evidence does not yet exist. | Preserve the planned evidence below and run `nfr-assess` after implementation and execution. |

---

## Risk Assessment

Scoring is Probability × Impact on a 1–3 scale. Scores 6–8 require mitigation. A score of 9 blocks release until mitigated or formally waived by the named authority.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| R-1101 | SEC | Existing admin-only table policies and commands are converted inconsistently, causing policy↔matrix drift that over-grants or silently blocks a role. | 3 | 3 | **9 BLOCK** | Generate role×table RLS and role×capability command cases from one matrix; add a policy-agreement gate with a deliberate red fixture. | Dev + QA | Stories 11.1–11.2, before merge |
| R-1102 | SEC/DATA | Multi-role resolution is not union-correct or fail-closed for duplicates, order, inactive memberships, empty sets, or cross-tenant children. | 2 | 3 | **6** | Enforce schema ownership/uniqueness and property-test all role-set permutations, including inactive parents. | Dev + QA | Story 11.1 |
| R-1103 | SEC | Prices, costs, margins, or derived aggregates leak to Montör/Säljare through read models, direct queries, exports, errors, or client-shipped authority. | 3 | 3 | **9 BLOCK** | Use RLS/module closure as the floor, server field projection, aggregate-honesty checks, crafted-query negatives, and serialized-payload scans. | Dev + QA + Security | Story 11.2, before activation |
| R-1104 | SEC | Downgrade, deactivation, revocation, or removal is not effective on the next operation because stale session/context state retains authority. | 2 | 3 | **6** | Exercise one session before and immediately after mutation and require fresh server-side role resolution. | Dev + QA | Stories 11.2–11.3 |
| R-1105 | SEC | Supabase Auth admin/service authority becomes client-reachable, targets the wrong tenant, or reveals whether a foreign user exists. | 2 | 3 | **6** | Keep Auth admin access in a server-only adapter; add containment, cross-tenant, unauthenticated, and indistinguishable-error tests. | Dev + QA + Security | Story 11.3 |
| R-1106 | DATA | Concurrent deactivate/downgrade/remove operations both pass a pre-check and leave a tenant without an active Företagsadmin. | 2 | 3 | **6** | Enforce the invariant transactionally and prove one of two conflicting concurrent commands fails without partial state. | Dev + QA | Story 11.3 |
| R-1107 | DATA/OPS | A user-management action commits without atomic audit evidence, or a role change omits before/after values and its required reason. | 2 | 3 | **6** | Assert success+audit and injected-failure rollback for every action and validate the complete event contract. | Dev + QA | Stories 11.2–11.3 |
| R-1108 | TECH | The generator or manifest coherence rule is incomplete, so future module activation can omit matrix rows or tests while CI remains green. | 2 | 3 | **6** | Self-test generator identity/cardinality, derive from manifest/matrix, reject unlisted surfaces, and prove red/green drift fixtures. | Dev + QA | Stories 11.1 and 11.4 |
| R-1109 | BUS/SEC | Stale contradictory prose is implemented instead of the ratified N-4 model, producing a single-role or placeholder entitlement implementation. | 2 | 3 | **6** | Pin role literals, multi-role union, capabilities, and sensitive-field seed in executable fixtures; reject placeholder text. | Product + Dev + QA | Seed freeze and Story 11.4 |
| R-1112 | REL/OPS | Membership and Auth invitation states diverge during partial failure, or retries create duplicate/ambiguous outcomes. | 2 | 3 | **6** | Specify ordering/compensation, inject failures on both sides, and assert retry-safe terminal state and correlated audit evidence. | Architect + Dev + QA | Story 11.3 sign-off |

### Medium-Priority Risks (Score 3–4)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| R-1110 | OPS | The role×module×table×capability suite becomes slow, flaky, or silently skips when local Supabase is unavailable. | 2 | 2 | **4** | Keep pure logic in Node, DB facts in Vitest, and only thin journeys in Playwright; require `SUPABASE_TEST_REQUIRED=1` in CI and report skips/duration. | QA + DevOps |
| R-1111 | PERF | Matrix-driven nav, landing, entitlements, and effective-permissions rendering regress at pilot scale without an epic-specific target. | 2 | 2 | **4** | Capture deterministic lookup/render/query-count baselines and keep them non-gating until an owner sets thresholds. | Architect + QA |

### Low-Priority Risks (Score 1–2)

No evidence-supported low-priority risks were identified. Cosmetic and exploratory behavior is represented by lower-priority scenarios rather than speculative risk entries.

### Risk Category Legend

- **TECH**: architecture, integration, scalability, or test-harness failure
- **SEC**: authorization, tenant isolation, authentication, or data exposure
- **PERF**: latency, throughput, or resource degradation
- **DATA**: integrity, consistency, or preservation failure
- **BUS**: user or business-rule impact
- **OPS**: deployment, CI, observability, or operational failure
- **REL**: retry, failure recovery, or state-machine reliability

No risk is accepted or waived by this design. Scores are reassessed only after implementation evidence is available.

---

## NFR Planning

**Purpose:** Capture epic-specific NFR thresholds, planned validation, and evidence for later `nfr-assess`. This is not a final NFR evidence audit.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| --- | --- | --- | --- | --- |
| Security / tenant isolation | Every decision is server-enforced by command capability gate plus RLS. For every seeded role and active module: at least one denied command and one RLS negative. No unauthorized read/write or existence signal. | R-1101/02/04/05/08 | Matrix units, generated command and RLS integration cases, anon/cross-tenant regressions, safe-error comparison, policy-agreement gate. | Unit/Vitest/CI reports, deliberate drift failure, containment log. |
| Sensitive-data confidentiality | An unentitled protected field is absent from the payload and listed in `entitlements.withheld`; dependent aggregates are also absent/listed. | R-1103 | Projection units, direct-query negatives, read-model/export serialization assertions, non-invertible margin-warning cases. | Serialized fixtures and passing RLS/read-model reports. |
| Data integrity | Role union is order-independent; membership-role children are unique and tenant-consistent; inactive membership grants nothing; at least one active admin remains. | R-1102/06 | Migration constraints, table/property-driven union tests, disabled-parent cases, concurrent last-admin integration. | Clean reset log, constraint/Vitest results, concurrency record. |
| Auditability | Every user-management action emits atomic evidence. Role/permission changes include ChangedBy, ChangedAt, CompanyId, RoleId, PreviousPermissions, NewPermissions, and non-empty Reason. | R-1107 | Per-command success+audit cases, required-reason validation, fault-injection rollback, append-only regressions. | Captured audit rows/correlation IDs and test results. |
| Reliability | Authority changes affect the next operation; Auth/membership retry and partial-failure behavior cannot create contradictory or duplicate state. | R-1104/12 | Same-session before/after tests, boundary fault injection, retry-safe invite lifecycle cases. | Deterministic transition snapshots and failure-injection results. |
| Performance | Carried pilot-scale posture applies; no epic-specific latency, volume, or query-count threshold exists. | R-1111 | Non-gating baseline for matrix lookup, nav/landing, effective-permissions render, and query count with a deterministic seeded tenant. | Baseline artifact and CI timing trend. |
| Scalability | Adding an active module must require matrix rows and generated cases without re-specifying existing modules. | R-1108/10/11 | Generator cardinality/identity tests and a sample activation red/green fixture. | Generator manifest and deliberate failure output. |
| Maintainability / governance | The typed matrix remains the single source; same-change manifest activation, rows, policies, and tests fail loud; no focused/skipped P0/P1 authority tests in CI. | R-1108/10 | Type exhaustiveness, coherence units, generated-case count, suite discovery/skip report, Phase C scope scan. | CI/static reports and clean build/reset evidence. |
| Accessibility / usability | Denied navigation is hidden, direct routes remain protected, and admin dialogs/tables/warnings are keyboard and role accessible under carried NFR30/31. | — | Thin role journeys and component accessibility checks using stable accessible names and states. | Playwright/component result; trace/screenshots only on failure. |

**Unknown thresholds:**

1. Invitation expiry, resend throttling/deduplication, and the exact Auth↔membership/audit compensation rules.
2. Pilot-scale data volume and latency/query-count thresholds for epic 11.
3. Maximum future tenant-role/matrix growth beyond the fixed Phase B seed.
4. No epic-specific numerical accessibility threshold; use the existing project quality gate.

These unknowns do not block this design. They block only the affected implementation acceptance or a future numerical NFR verdict; tests must not invent values.

---

## Entry Criteria

- [ ] Epic 11 acceptance criteria and the current N-4 contract are accepted as authoritative; stale single-role/placeholder prose is superseded.
- [ ] Story 10.1 manifest-governance baseline and current Phase A tenant-isolation suites are green.
- [ ] Local Supabase can reset cleanly and CI sets `SUPABASE_TEST_REQUIRED=1` for DB/RLS suites.
- [ ] Tenant factories support two tenants, all five tenant roles, multi-role users, and active/invited/disabled/no-role states.
- [ ] Server-only Auth adapter is injectable with deterministic local success/failure behavior; no live external credentials are required.
- [ ] Story implementation is deployed to the test environment for the scenarios being executed.
- [ ] Invitation expiry/throttle and partial-failure compensation semantics are resolved before 11.3-INT-012/013 is required green.

## Exit Criteria

- [ ] All P0 scenario families pass with no skip, quarantine, or retry-only green result.
- [ ] P1 pass rate is at least 95%; every failure is triaged and no security/tenant-isolation failure uses the allowed 5% margin.
- [ ] P2/P3 pass rate is at least 90% or a named, expiring waiver is recorded.
- [ ] No open P0/P1 severity defect and no unmitigated score≥6 risk remains.
- [ ] FR66–FR72, every story acceptance criterion, AC-B1a-2, and AC-B1a-3 have complete traceability.
- [ ] At least 80% of planned scenario families are automated, including all P0/P1 families.
- [ ] Matrix/manifest/policy/test-manifest agreement, clean reset, last-admin concurrency, audit atomicity, service-role containment, and Phase C scope scans are green.
- [ ] Planned evidence exists for every in-scope NFR category, or `nfr-assess` records the appropriate concern/waiver.

---

## Test Coverage Plan

**Priority note:** P0/P1/P2/P3 indicate consequence and business priority, **not execution timing**. The execution schedule is defined separately. Generated role×module/table/capability families expand into many concrete cases but count as one design row when setup, oracle, and failure meaning are shared.

### P0 (Critical)

**Criteria:** Critical authorization, tenant-isolation, data-integrity, confidentiality, or compliance behavior with no safe workaround.

| Requirement / Test IDs | Test Level | Risk Link | Family Count | Owner | Notes |
| --- | --- | --- | ---: | --- | --- |
| Role storage, union, typed matrix, command guard, role helper, coherence, and full tenant context: `11.1-INT-001`, `11.1-INT-002`, `11.1-UNIT-001`–`005`, `11.1-INT-003`, `11.1-INT-004` | Unit + DB/security integration | R-1101/02/08/09 | 9 | Dev + QA | Exact five-role CHECK; uniqueness/composite tenancy; order-independent union; deny-by-default; hardened helper; fail-loud manifest; full active role set. |
| Generated command/RLS and safe direct access: `11.2-INT-001`–`004`, `11.2-INT-007` | Command/API + DB/RLS integration | R-1101/02/04/08 | 5 | Dev + QA | Per role and active module/table: allowed positives, denied command/query, cross-tenant/anon, deliberate policy drift, inactive/no-role denial. |
| Sensitive-money confidentiality: `11.2-UNIT-003`–`007`, `11.2-RLS-001`, `11.2-INT-005`, `11.2-INT-006`, `11.2-STATIC-001` | Unit + DB/RLS + serialization + static | R-1102/03/05/09 | 9 | Dev + QA + Security | Concrete role seed; absent+listed fields/aggregates; direct rate-row denial; unchanged stored values; non-invertible warning; no client authority. |
| Secure, atomic admin user management: `11.3-INT-001`, `11.3-INT-005`, `11.3-INT-007`–`012`, `11.3-STATIC-001` | Command/Auth/DB/concurrency + static | R-1104/05/06/07/12 | 9 | Dev + QA + Security | Invite, immediate deactivation/change/removal, last-admin sequential/concurrent, cross-tenant negatives, boundary fault injection, server-only Auth containment. |
| Roles/effective-permissions harness: `11.4-INT-001`, `11.4-INT-002`, `11.4-UNIT-001`, `11.4-UNIT-002`, `11.4-INT-003` | Unit + route/read-model + DB/schema integration | R-1101/02/08/10 | 5 | Dev + QA | Server-derived union grid, non-admin direct denial, stable generator identity/cardinality, activation coherence, demonstrated red/green drift. |
| Required authorization substrate in CI: `11-X-CI-001` | CI gate | R-1110 | 1 | QA + DevOps | Required local Supabase, zero focused/skipped P0/P1 authority cases, generated count cannot shrink silently. |

**Total P0:** 38 scenario families, ~85–125 hours.

### P1 (High)

**Criteria:** Core, frequent, or complex behavior with material user reach and a limited workaround.

| Requirement / Test IDs | Test Level | Risk Link | Family Count | Owner | Notes |
| --- | --- | --- | ---: | --- | --- |
| Migration coexistence: `11.1-INT-005` | Migration integration | R-1101 | 1 | Dev + QA | Clean reset and unchanged hardened `is_tenant_admin()` behavior alongside new structures. |
| Role navigation, landing, and representative sign-ins: `11.2-UNIT-001`, `11.2-UNIT-002`, `11.2-E2E-001` | Unit + thin E2E | R-1109 | 3 | Dev + QA | Matrix-intersected active nav, deterministic landing, representative granted surface per seeded role. |
| Invite lifecycle and admin journey: `11.3-INT-002`, `11.3-INT-003`, `11.3-INT-004`, `11.3-INT-006`, `11.3-INT-013`, `11.3-E2E-001` | Command/Auth state-machine + thin E2E | R-1105/07/12 | 6 | Dev + QA | Resend/revoke/reset/reactivate and boundary-time behavior after semantics are defined; one correlated admin journey. |
| Roles UI and representative authorization journey: `11.4-COMP-001`, `11.4-COMP-002`, `11.4-E2E-001` | Component + thin E2E | R-1101/02/09 | 3 | Dev + QA | Concrete five-role UI, Arbetsledare job-scope explanation, granting-role annotation, non-admin route denial. |
| Phase C and privileged-surface containment: `11-X-STATIC-001` | CI/static | R-1105/08/09 | 1 | Dev + QA | Reject dynamic roles, tenant-wide Arbetsledare, client service authority, portal/signup/AI and other excluded surfaces. |

**Total P1:** 14 scenario families, ~35–55 hours.

### P2 (Medium)

**Criteria:** Secondary behavior with narrower user reach and an acceptable workaround.

| Requirement / Test ID | Test Level | Risk Link | Family Count | Owner | Notes |
| --- | --- | --- | ---: | --- | --- |
| Admin status/confirmation presentation: `11.3-COMP-001` | Component | R-1107 | 1 | Dev + QA | Immediate-effect confirmation, invited/inactive markers, history-preserved copy, and accessible dialogs. |
| Epic UI accessibility regression: `11-X-A11Y-001` | Component + E2E | — | 1 | Dev + QA | Keyboard-reachable tables/dialogs/tabs/warnings and stable names/states at supported widths. |

**Total P2:** 2 scenario families, ~8–16 hours.

### P3 (Low)

**Criteria:** Experimental regression information with no current release threshold and an easy fallback to manual comparison.

| Requirement / Test ID | Test Level | Family Count | Owner | Notes |
| --- | --- | ---: | --- | --- |
| Pilot-scale performance/query baseline: `11-X-PERF-001` | Benchmark | 1 | QA + Architect | Record matrix/nav/landing/effective-permission timings and query count; non-gating until an owner sets a threshold. |

**Total P3:** 1 scenario family, ~3–6 hours.

### Coverage Trace and Duplicate-Coverage Guard

- **FR66:** role literals, `membership_roles`, multi-role union, Arbetsledare exclusion — 11.1/11.4 role-storage and UI families.
- **FR67–FR68 / NFR42–43:** command/RLS enforcement, matrix and manifest coherence — generated 11.1/11.2/11.4 P0 families.
- **FR69–FR70 / AC-B1a-3:** admin user lifecycle, role changes, events, effective permissions — 11.3 and 11.4 families.
- **FR71 / NFR44:** sensitive-field absence+descriptor, aggregate honesty, non-invertible warning — 11.2 confidentiality families.
- **FR72 / AC-B1a-2:** navigation, landing, safe denials and representative sign-ins — 11.2 nav/E2E plus direct-route command/RLS families.
- Unit tests own deterministic matrix, union, projection, and generator logic. DB/API integration owns constraints, RLS, authority, audit, concurrency, and Auth failure modes. Component tests own presentation/accessibility. E2E remains thin and proves wiring rather than server authority.

---

## NFR Coverage and Planned Evidence

| Category | Planned Validation | Evidence for `nfr-assess` | Missing-input Treatment |
| --- | --- | --- | --- |
| Security / confidentiality | P0 matrix, command, RLS, direct-query, generic-denial, service-containment, and serialized-payload tests. | CI results for generated role families, policy-agreement output, containment log, failed-journey traces. | Core zero-bypass/leak threshold is explicit. |
| Data integrity / audit | Constraints, union properties, last-admin concurrency, archive-over-delete, success+audit and rollback cases. | Reset log, Vitest report, captured audit rows/correlation IDs, concurrency record. | Auth/DB compensation ordering must be specified before its cases can pass. |
| Reliability | Same-session immediate revocation and invite lifecycle retry/fault injection. | Deterministic transition and injected-failure snapshots. | Expiry/throttle values remain unknown; no wall-clock sleeps or guessed values. |
| Performance / scalability | Non-gating deterministic benchmark and generator cardinality fixture. | Baseline artifact, query-count output, CI duration trend. | No release SLO/volume target; remain monitored under R-1111. |
| Maintainability / governance | Matrix/manifest/test/policy coherence, stable generated IDs/counts, no skipped/focused security tests, hard-exclusion scans. | Unit/CI gate reports and deliberate red-fixture proof. | Playwright-utils is configured as intent but absent; this epic does not invent the import or dependency. |
| Accessibility / usability | Role-oriented locators, keyboard/dialog/table checks, hidden-vs-denied behavior. | Component/Playwright results and failure artifacts. | Apply carried project gate; no new numerical target. |

No final PASS/CONCERNS/FAIL decision is assigned in this planning document.

---

## Execution Strategy

**Philosophy:** Run everything in pull requests when the functional suite remains under 15 minutes; defer only genuinely expensive or long-running work. Generated authorization families must not be deferred merely because there are many cases—optimize fixtures or shard them. With Playwright parallelization available, hundreds of well-isolated cases should remain within the 10–15 minute feedback target; the current serial shared E2E fixture should remain thin.

- **Pull request:** all unit tests, clean migration/schema checks, generated command/RLS families, audit/last-admin/fault-injection cases, static containment/scope gates, and the thin role/admin Playwright journeys.
- **Nightly:** broader browser regression across every seeded role, repeated authorization families with flake reporting, and broader serialized-payload/leak scans when their setup exceeds the PR budget.
- **Weekly:** clean-install/reset verification plus the non-gating pilot-scale performance/query-count and suite-duration trends.

---

## Resource Estimates

Estimates include fixtures, local-Supabase setup, generated-case infrastructure, and deliberate red/green harness demonstrations. They exclude fixing product defects and owner decisions for unknown invitation/performance thresholds.

| Priority | Scenario Families | Estimated Effort | Notes |
| --- | ---: | ---: | --- |
| P0 | 38 | ~85–125 hours | Multi-layer authorization, RLS, concurrency, fault injection, and confidentiality proof. |
| P1 | 14 | ~35–55 hours | Lifecycle variants, UI wiring, and scope regression. |
| P2 | 2 | ~8–16 hours | Component and accessibility coverage. |
| P3 | 1 | ~3–6 hours | Non-gating deterministic benchmark. |
| **Total** | **55** | **~131–202 hours** | Roughly 3–5 engineer-weeks for one owner or 2–3 calendar weeks with parallel story ownership. |

### Prerequisites

**Test data:**

- Extend the existing two-tenant factories with all five tenant roles, multi-role memberships, active/invited/disabled/no-role users, two remaining admins, money fixtures, and explicit cross-tenant identifiers.
- Add transactional audit and Auth-adapter fixtures with deterministic fault injection and cleanup.
- Use unique per-test records and a clean local Supabase reset; do not share mutable authorization state across tests.

**Tooling:**

- Node test runner for pure matrix/union/projection/generator logic.
- Vitest against local Supabase/Postgres for schema, RLS, command, concurrency, and audit evidence.
- Playwright for thin accessible role journeys; no browser session was required to design this plan.
- CI static/import/scope scans for service-role containment and Phase C exclusions.
- Pact is not applicable: the repository has no Pact dependency, Pact files, broker marker, OpenAPI contract, or epic 11 microservice boundary.
- `@seontechnologies/playwright-utils` is not installed. The configuration preference does not authorize inventing imports; adoption, if desired, is a separate framework change.

**Environment:**

- Local Supabase/Postgres available and CI configured to fail rather than skip DB suites.
- Production-like Next.js build available for Playwright with local/test identities only.
- No live demo database, external Auth credentials, or production tenant data is used by tests.

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100%; no skip, quarantine, retry-only green, or silent generated-count reduction.
- **P1 pass rate:** ≥95%; all failures triaged and no security/tenant-isolation failure accepted in the remaining 5%.
- **P2/P3 pass rate:** ≥90% or a named, expiring waiver.
- **High-risk mitigations:** 100% complete for all score≥6 risks, or formally waived with owner and expiry; R-1101 and R-1103 block non-admin production activation.

### Coverage Targets

- **Requirement and AC traceability:** 100% for FR66–FR72, all epic 11 story criteria, AC-B1a-2, and AC-B1a-3.
- **Planned scenario automation:** ≥80% overall and 100% for P0/P1.
- **Security and tenant-isolation scenario execution:** 100%.
- **Critical authorization paths:** 100% of the seeded role×active-module command/RLS minimum defined by NFR42.

### Non-Negotiable Requirements

- [ ] All P0 tests pass and no P0/P1 authorization test is focused, skipped, or dependent on retry.
- [ ] All score≥6 mitigations have executed evidence and a named owner; score-9 risks are closed or formally waived before activation.
- [ ] Every seeded role and active module has at least one denied command and one RLS negative, plus the required allowed-path positive.
- [ ] Protected money values and dependent aggregates are absent+listed for unentitled roles in every activated payload path.
- [ ] Clean reset, matrix/manifest/policy/test-manifest agreement, last-admin concurrency, audit atomicity, immediate revocation, and service-role containment are green.
- [ ] Phase C hard-exclusion scans remain green.
- [ ] Planned NFR evidence exists for each in-scope category; the final evidence decision is deferred to `nfr-assess`.

---

## Mitigation Plans

### R-1101: Policy↔Matrix Drift (Score 9)

**Strategy:** (1) Make the typed matrix the source for generated capability/table expectations. (2) Add role×active-table allowed and denied RLS cases while retaining anon/cross-tenant arms. (3) Add a policy-agreement inspection and deliberately drifted red fixture.  
**Owner:** Dev + QA  
**Timeline:** Stories 11.1–11.2, before merge  
**Status:** Planned  
**Verification:** The real schema is green, the red fixture names the mismatch, and all generated families execute without skip.

### R-1102: Incorrect Multi-Role Resolution (Score 6)

**Strategy:** (1) Enforce role literals, uniqueness, and composite tenant ownership. (2) Evaluate only roles belonging to an active parent membership. (3) Property-test union, duplicate/order invariance, empty sets, and foreign children.  
**Owner:** Dev + QA  
**Timeline:** Story 11.1  
**Status:** Planned  
**Verification:** Migration/constraint and table-driven union suites pass after a clean reset.

### R-1103: Sensitive-Money Leakage (Score 9)

**Strategy:** (1) Deny protected tables/columns at the RLS/module boundary. (2) Project fields server-side using absent+listed semantics. (3) Propagate withholding to dependent aggregates. (4) Scan serialized read models/exports and prove the warning cannot be inverted.  
**Owner:** Dev + QA + Security reviewer  
**Timeline:** Story 11.2, before non-admin activation  
**Status:** Planned  
**Verification:** Seeded role cases expose only the ratified fields, direct crafted queries fail, and payload scans contain no protected value/path.

### R-1104: Stale Authority After Mutation (Score 6)

**Strategy:** (1) Resolve membership roles for each server authorization decision. (2) Test a live session before and after downgrade/deactivation/removal. (3) Compare safe denial shape without requiring re-login.  
**Owner:** Dev + QA  
**Timeline:** Stories 11.2–11.3  
**Status:** Planned  
**Verification:** The very next protected read and command lose authority with no stale surface.

### R-1105: Client-Reachable or Cross-Tenant Auth Administration (Score 6)

**Strategy:** (1) Isolate Supabase Auth administration behind a server-only adapter. (2) Extend import/bundle containment scans. (3) Run unauthenticated and Tenant A→Tenant B command negatives with indistinguishable errors.  
**Owner:** Dev + QA + Security reviewer  
**Timeline:** Story 11.3  
**Status:** Planned  
**Verification:** No client bundle/import path reaches privileged code and cross-tenant attempts cause zero Auth, membership, or audit side effect.

### R-1106: Last-Admin Race (Score 6)

**Strategy:** (1) Enforce the invariant transactionally at the database boundary. (2) Cover deactivate, downgrade, and removal sequentially. (3) Race two conflicting operations against two remaining admins.  
**Owner:** Dev + QA  
**Timeline:** Story 11.3  
**Status:** Planned  
**Verification:** Exactly one concurrent outcome commits and its audit evidence matches the surviving invariant.

### R-1107: Missing or Non-Atomic Audit Evidence (Score 6)

**Strategy:** (1) Define the event contract for every action. (2) Require a non-empty role-change reason and complete previous/new permission values. (3) Inject failure before and after mutation/audit boundaries.  
**Owner:** Dev + QA  
**Timeline:** Stories 11.2–11.3  
**Status:** Planned  
**Verification:** Success always has one correlated event; failure leaves neither unauthorized state nor orphan evidence.

### R-1108: Fail-Open Harness or Manifest Coherence (Score 6)

**Strategy:** (1) Derive generated cases from manifest and matrix. (2) Assert stable unique IDs and exact cardinality. (3) Reject missing rows, unlisted surfaces, and unexplained count shrinkage. (4) demonstrate sample-module red/green activation.  
**Owner:** Dev + QA  
**Timeline:** Stories 11.1 and 11.4  
**Status:** Planned  
**Verification:** Each deliberately incomplete fixture fails loudly and aligned activation passes without modifying unrelated cases.

### R-1109: Stale Planning Contract Implemented (Score 6)

**Strategy:** (1) Encode the five tenant roles, multi-role union, named capabilities, and concrete money seed in executable fixtures. (2) Reject `väntar på ägarbeslut` and tenant-wide Arbetsledare assignment. (3) Update stale prose through the owning planning process.  
**Owner:** Product + Dev + QA  
**Timeline:** Before seed freeze and Story 11.4 UI  
**Status:** Planned  
**Verification:** Contract snapshots match PRD/ADR/story AC and contain no placeholder/single-role fallback.

### R-1112: Auth/Membership Partial-State Divergence (Score 6)

**Strategy:** (1) Specify command ordering, idempotency, and compensation. (2) Inject failures at both sides of the Auth/database boundary. (3) repeat resend/revoke/reset/invite operations and inspect terminal state plus audit correlation.  
**Owner:** Architect + Dev + QA  
**Timeline:** Story 11.3, before implementation sign-off  
**Status:** Planned  
**Verification:** Every retry reaches one documented state without duplicate membership, roles, external action, or audit event.

---

## Assumptions and Dependencies

### Assumptions

1. The repeated current contract in story acceptance criteria, the Phase B PRD, ADR-B001, and project instructions supersedes the stale epic-header statement: `membership_roles` ships in 11.1 and the five tenant roles may be held in combination.
2. The concrete role seed supersedes the stale story 11.4 placeholder wording; tests must not display `väntar på ägarbeslut`.
3. `tenant_admin` remains the canonical code literal while Företagsadmin is the user-facing role name.
4. Existing Phase A tenant containment, anonymous-denial, and service-role tests remain required and are extended rather than replaced.
5. Browser exploration is not necessary to establish the server authorization plan; current UI wiring is verified later by thin Playwright journeys.

### Dependencies

1. Story 11.1 schema, typed matrix, tenant-context, and generator seams — required before stories 11.2–11.4 can execute their complete matrices.
2. Local Supabase reset and required CI substrate — required before DB/RLS evidence can gate a merge.
3. Deterministic multi-role/money/audit factories and injectable local Auth adapter — required before story 11.3 fault and cross-tenant tests.
4. Owner-defined invite expiry/throttle and compensation semantics — required before 11.3-INT-012/013 can be green.
5. Owner-defined performance dataset/threshold — required only if R-1111 is promoted from monitored baseline to a release gate.

### Risks to Plan

- **Unresolved invitation semantics:** can delay two story 11.3 families. **Contingency:** implement deterministic state-machine seams first, mark only the value-dependent cases pending, and do not invent timing.
- **Unavailable local Supabase:** could produce a false-green skip. **Contingency:** CI requires the substrate and fails on skips; local runs report the dependency explicitly.
- **Generated suite exceeds 15 minutes:** could erode PR feedback. **Contingency:** share fixtures, batch safe DB setup, and shard by role/table while retaining every P0 family in PR execution.
- **Existing admin-only assertions are mistaken for current truth:** could preserve a Phase A incompatibility. **Contingency:** update those tests in the same story as the role mechanism and preserve only their tenant/anon/service containment intent.

---

## Follow-on Workflows (Manual)

- Run `/bmad-testarch-atdd` to generate failing P0 acceptance tests as a separate, explicitly requested workflow.
- Run `/bmad-testarch-automate` for broader automation once implementation exists.
- Run `/bmad-testarch-nfr` after evidence exists to assign final NFR status.
- Run `/bmad-testarch-ci` if the required DB substrate, sharding, skip reporting, or artifact publication is not already enforced.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: pending — Date: pending
- [ ] Tech Lead: pending — Date: pending
- [ ] QA Lead: pending — Date: pending

**Comments:** Draft is complete for team review. Approval is not implied by workflow completion.

---

## Interworking & Regression

| Service / Component | Impact | Regression Scope / Coordination |
| --- | --- | --- |
| `tenant_memberships` and new `membership_roles` schema/RLS | Expands one-role admin-only storage into multi-role tenant authority. | Clean reset, constraint and RLS suites; preserve tenant ownership, invited/disabled semantics, and existing admin rows. Coordinate Dev/QA. |
| Tenant-context resolution and new server authorization seam | Every server command/read must consume the full current role set and fail closed. | Existing tenant-context, entitlement, safe-error, and service-role containment tests plus generated capability cases. Security review before activation. |
| Active Phase A table policies and commands | Non-admin roles gain only matrix-authorized surface. | Manifest-derived H4 inventory extended with a role dimension; preserve anon/cross-tenant negatives and add policy-agreement evidence. |
| Read models, calculation/quote money views, PDF/export payloads | Protected values must be omitted consistently without changing stored öre values. | Projection, aggregate-honesty, direct-query and serialized-payload tests; finance/money regression remains exact. |
| Supabase Auth server adapter | Adds invite/resend/revoke/reset boundary and partial-failure behavior. | Server-only/static containment, tenant targeting, idempotency, fault injection, and generic-error regressions. No live credentials. |
| Navigation, landing, Users, Roles, and Events UI | Role-specific visibility and admin management appear without becoming an authority source. | Unit/component coverage and thin role/admin Playwright journeys; direct routes remain server denied. Coordinate accessible copy with product/UX. |
| Scope manifest, matrix, generator, and CI | New activation coherence and generated count become release governance. | Existing manifest/nav/file-token guards plus red/green sample activation, stable generator identity, required DB substrate, and Phase C scans. |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — risk classification and release action
- `probability-impact.md` — 1–3 probability/impact scoring
- `test-levels-framework.md` — lowest-sufficient-level selection
- `test-priorities-matrix.md` — P0–P3 consequence-based priority
- `nfr-criteria.md` — NFR planning categories and evidence posture
- `playwright-utils-mandate.md` and `library-integration-mandate.md` — checked; configured library is absent, so no imports are invented
- `playwright-cli.md` — checked; CLI unavailable, no browser session opened
- `pact-mcp.md` — checked; contract testing is not relevant and Pact MCP was unreachable

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd-phase-b.md`
- Epic: `_bmad-output/planning-artifacts/epics-phase-b.md` (epic 11, stories 11.1–11.4)
- Architecture: `_bmad-output/planning-artifacts/architecture-phase-b.md` (ADR-B001 and test strategy)
- Existing system test design: `_bmad-output/test-artifacts/test-design-architecture.md`
- Scope manifest: `src/scope/manifest.ts`
- Separate epic technical spec: N/A; the cited story acceptance criteria and ADR provide the contract used here.

### Design-Time Clarifications

1. Define invite expiry, resend throttling/deduplication, and Auth↔database compensation/idempotency before the affected story 11.3 cases are required green.
2. Define a pilot-scale dataset and observable latency/query target only if epic 11 performance should become release-gating.
3. Remove or supersede stale single-role and placeholder prose in the epic document to prevent future contract selection errors.

---

**Generated by:** BMad TEA Agent — Test Architect Module  
**Workflow:** `bmad-testarch-test-design`  
**Version:** 4.0 (BMad v6)

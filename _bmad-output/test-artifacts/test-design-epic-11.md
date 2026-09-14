---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-09-11T13:24:00+02:00'
runScope: 'epic-level'
runKey: 'epic-11'
---

# Test Design: Epic 11 — RBAC Mechanism and Admin User Management

**Date:** 2026-09-11

**Author:** Rasmus
**Status:** Draft — stories 11.1–11.3 are done; story 11.4 is backlog

---

## Executive Summary

**Scope:** Epic-level test design for epic 11 and stories 11.1–11.4. Existing implementation and test evidence for stories 11.1–11.3 is retained as standing regression coverage. New design effort is concentrated on story 11.4: the Roles surface, effective-permissions viewer, and reusable generated role-boundary harness.

**Risk summary:**

- Total risks identified: 12
- High-priority risks (score ≥6): 6
- Release-blocking risks: R-1101 and R-1102
- Critical categories: security, authorization governance, test completeness, tenant-scoped data

**Coverage summary:**

- P0 scenario groups: 28
- P1 scenario groups: 5
- P2/P3 scenario groups: 2
- Remaining test-automation effort: ~48–84 hours, roughly ~1–2 engineer/QA weeks

The high P0 proportion is deliberate: this epic changes tenant authorization, RLS, sensitive-money visibility, and membership lifecycle. Failure has no safe client-side workaround. Parameterized cases generated inside a scenario group are counted by an independent cardinality assertion rather than inflated as separate plan rows.

## Current Evidence Baseline

| Story | Delivery state | Evidence to preserve |
| --- | --- | --- |
| 11.1 | Done | Exact-head CI reported 1,708 unit, 942 integration/RLS, and 122 E2E tests passing; hardened role helper, multi-role same-tenant constraints, concurrency, explicit grants, matrix lookup, command denial, and manifest coherence are covered. |
| 11.2 | Done | Final evidence reported 1,717 unit, 991 required integration/RLS, and 126 E2E tests passing, followed by targeted Storage, upload, audit-time, quote-link, and acceptance-amount hardening. A controlled hosted smoke verified the Seller PDF broker and raw Storage denials. |
| 11.3 | Done | Final evidence reported 1,724 unit and 1,011 required integration tests passing, focused command/RLS coverage, containment, and three browser scenarios covering Admin list/detail, invite validation, and non-Admin denial. |
| 11.4 | Backlog | No Roles route, role catalogue, effective-permissions viewer, granting-role annotation, role-aware H4 generator, command generator, test-manifest enrollment, or deliberate-drift red/green proof exists. |

The existing 11.2 test spans five roles across one representative table/capability per active module. It proves the initial seed rollout but does not satisfy architecture §16.1's complete role × table × capability reusable harness.

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| Tenant-facing custom role builder or runtime-mutable roles | Phase C and explicitly excluded from Phase B. | Keep the five-role code-owned matrix closed and versioned; scope scans fail on custom-role or DB permission-table surfaces. |
| Database permission tables | ADR-B001 makes the code matrix authoritative for Phase B. | Manifest/matrix/test-enrollment coherence and source/bundle containment protect the chosen authority. |
| Tenant-wide Arbetsledare | Arbetsledare is job-scoped and depends on E16 `job_members`. | Assert it is explanatory text only on the Roles surface and never part of the tenant-role vocabulary. |
| AI flows, supplier APIs, customer portal, public signup, and other Phase C surfaces | Hard exclusions under the Phase C ledger and project instructions. | Retain scope-manifest and static scans. |
| Custom email/background infrastructure | Story 11.3 uses sanctioned Supabase Auth delivery; notification/email infrastructure belongs to E13. | Retain operation/token/callback tests and use a bounded transport smoke only when Auth templates or redirects change. |
| Final NFR PASS/CONCERNS/FAIL decision | This workflow plans evidence; it does not perform the NFR audit. | Run `nfr-assess` after story 11.4 evidence exists. |
| Product implementation, schema changes, specifications, orchestration state, deployment, or hosted-demo regression testing | This deliverable owns test design artifacts only. | Hand planned coverage to the implementation and test-automation workflows. |

## Risk Assessment

Risk score is Probability × Impact on a 1–3 scale. Scores 6–8 require mitigation; score 9 blocks epic completion until mitigated or formally waived.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| R-1101 | SEC/TECH | H4 remains table-only and the 11.2 suite samples one table/capability per module, allowing a future activation to omit a role, table, capability, or row-scope case while CI stays green. | 3 | 3 | 9 | Add manifest-traceable module/role metadata, complete role × active table/capability generation, existing anon/cross-tenant arms, and same-change test enrollment. | Dev + QA | Story 11.4 before epic completion |
| R-1102 | TECH/SEC | A generator can look complete while emitting duplicate, missing, or vacuous cases, or while a drift fixture never proves the agreement check bites. | 3 | 3 | 9 | Self-test unique stable IDs and exact cardinality; target real seeded rows/commands; prove red on missing matrix row, missing test enrollment, and drifted policy before green alignment. | Dev + QA | Story 11.4 before merge |
| R-1103 | SEC | Roles/effective-permissions code could expose the server matrix or role names as browser authority, allowing presentation and enforcement to diverge. | 2 | 3 | 6 | Return a server-derived presentation DTO only; extend source/bundle containment; retain direct command and RLS authority. | Dev + Security reviewer | Story 11.4 |
| R-1104 | SEC/DATA | Non-Admin, anonymous, or cross-tenant callers could read role details, member counts, or effective permissions and receive data or an existence signal. | 2 | 3 | 6 | Add Admin capability, route/read-model, RLS, anon, and cross-tenant negatives with indistinguishable responses and independent readback. | Dev + QA | Story 11.4 |
| R-1105 | BUS/TECH | The Roles view could show pending modules, use a page-named authority key, or retain `väntar på ägarbeslut`, misrepresenting the active manifest and ratified N-4 seed. | 3 | 2 | 6 | Derive rows from active manifest × matrix; use the stable `Roles.View` contract; pin concrete entitlements, wave labels, and absence of the stale placeholder. | Product + Dev + QA | Story 11.4 |
| R-1106 | DATA/BUS | Member counts and granting-role annotations could mishandle multi-role users or invited, disabled, ended, duplicate, and foreign-tenant membership state. | 2 | 3 | 6 | Define count semantics, use one tenant-scoped server query, and cover zero/single/multi-role, lifecycle states, deduplication, union grants, and Tenant B isolation. | Product + Dev + QA | Story 11.4 |

### Medium-Priority Risks (Score 3–4)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| R-1107 | OPS | DB/RLS suites can silently skip when local Supabase is unavailable. | 2 | 2 | 4 | Register story 11.4 under existing Vitest discovery; require `SUPABASE_TEST_REQUIRED=1` and zero skips in CI. | QA + DevOps |
| R-1108 | PERF/OPS | Roles/member-count/effective-permissions reads and expanded harness have no latency, query-count, dataset-size, or suite-duration threshold. | 2 | 2 | 4 | Record a pilot-scale baseline; keep thresholds UNKNOWN until the owner supplies them; keep pure expansion logic outside DB/browser loops. | Architect + QA |
| R-1109 | OPS/REL | Actual Supabase Auth email transport is outside the local browser harness. | 2 | 2 | 4 | Retain operation/token/callback tests and add local Inbucket or controlled hosted transport smoke when Auth config changes; make no exactly-once claim. | Dev + QA |
| R-1110 | SEC | Protected price, cost, margin, accepted value, or PDF bytes can regress into a newly activated Säljare/Montör surface. | 1 | 3 | 3 | Carry absent-plus-listed projections, Data API/Storage negatives, recipient export/PDF checks, and containment into every activation. | Dev + QA + Security reviewer |
| R-1111 | DATA | Concurrent last-Admin or role-set changes can violate tenant access invariants. | 1 | 3 | 3 | Retain serialized DB commands, multi-session concurrency, atomic audit, same-tenant FK, and immediate-revocation tests. | Dev + QA |
| R-1112 | OPS | Stale planning/handoff text can lead future work toward single-role storage, unresolved N-4, or an unstarted story 11.3 state. | 2 | 2 | 4 | Use current story artifacts and sprint status with PRD/architecture as authority; label historical handoff and superseded epic prose. | PM + QA |

### Low-Priority Risks (Score 1–2)

None identified. Existing story evidence reduced several critical-impact risks to probability 1, but their resulting score remains 3 because authorization or data-integrity impact is still critical.

### Risk Category Legend

- **TECH:** architecture, integration, generator completeness, scalability
- **SEC:** authentication, authorization, tenant isolation, data exposure
- **PERF:** latency, query count, suite runtime, resource use
- **DATA:** integrity, lifecycle state, audit, concurrency
- **BUS:** user-visible permission truth and operational meaning
- **OPS:** CI, environment, deployment, evidence availability

## NFR Planning

This section defines later validation evidence. It does not assign final NFR status.

| NFR category | Requirement / threshold | Risk link | Planned validation | Evidence needed |
| --- | --- | --- | --- | --- |
| Security / tenant isolation | All decisions server-enforced. For every seeded role and active module, at least one denied command and one RLS negative. Unauthorized routes/queries reveal no data or existence signal. | R-1101–R-1104 | Generator self-tests, generated DB/command cases, policy agreement, Admin/anon/non-Admin/cross-tenant viewer tests, containment. | Exact case manifest/cardinality, zero-skip Vitest report, policy catalog record, source/bundle checks, focused Playwright report. |
| Sensitive-data confidentiality | An unentitled role receives no protected field or dependent aggregate; each is absent and listed as withheld; raw Storage remains denied. | R-1110 | Retain 11.2 projection, Data API, Storage, PDF broker, and browser cases; enroll new money-bearing activations. | Serialized payload assertions, direct/nested read negatives, raw Storage results, recipient projection evidence. |
| Data integrity / audit | Multi-role union is order-independent; lifecycle and role changes are atomic and audited; one active Admin remains under concurrency. | R-1106/R-1111 | Retain membership-role FK, last-Admin, operation/audit, and immediate-revocation tests; add count-state fixtures. | Migration reset, DB logs, audit/correlation records, concurrent outcomes, member-count snapshots. |
| Reliability | Invitation acceptance binds the current unexpired attempt; retry/reconciliation is single-effect; delivery is not exactly once. | R-1109 | Retain unit/DB operation and token tests; transport smoke on template/redirect changes. | Focused results plus Inbucket or controlled-smoke record when applicable. |
| Maintainability / governance | Matrix is machine-readable authority; activation has matrix and test enrollment; generator IDs/cardinality are deterministic and drift checks bite. | R-1101/R-1102/R-1112 | Manifest/matrix/test coherence, generator units, deliberate red/green fixtures, scope scans. | Unit/CI output showing red fixtures fail and real configuration passes. |
| Performance / scalability | Latency, query count, dataset size, and harness duration are **UNKNOWN**. | R-1108 | Pilot-scale baseline for viewer reads and per-layer suite duration. | Baseline artifact with dataset shape, query count, duration, and environment; later owner threshold. |
| Operational evidence | Required DB runs use `SUPABASE_TEST_REQUIRED=1`, zero skips, clean migration reset; browser uses the production web server. | R-1107/R-1108 | CI registration and result-count validation. | Executed/pass/skip counts, reset log, focused and full-suite duration. |
| Scope governance | Only active modules render; no custom roles, DB permission table, tenant-wide Arbetsledare, privileged public route, or Phase C surface. | R-1105/R-1112 | Manifest coherence, Roles active-module assertions, scope/source/bundle scans. | CI scope report and rendered-row assertions. |

**Unknown thresholds:**

- Viewer latency and query-count target
- Representative tenant membership/role volume
- Generated DB suite wall-time ceiling before sharding is required
- Exact member-count inclusion semantics for invited, disabled, and ended memberships

## Entry Criteria

- [ ] Story 11.4 implementation contract names the stable `Roles.View` capability and confirms member-count state semantics.
- [ ] Roles/effective-permissions read models expose server-derived presentation DTOs without client matrix imports.
- [ ] Existing role-aware and admin-user factories can seed five roles, multi-role unions, lifecycle states, and a second tenant with automatic cleanup.
- [ ] The test manifest and role/table metadata shape are available for generator self-tests.
- [ ] A disposable local Supabase target is ready for required DB/RLS work; `SUPABASE_TEST_REQUIRED=1` is set for evidence runs.
- [ ] Playwright runs against its configured production web server.

## Exit Criteria

- [ ] All P0 scenario groups pass; planned P0/P1 coverage contains no committed skip, todo, or focus marker.
- [ ] P1 pass rate is at least 95%; every failure is triaged with an owner.
- [ ] R-1101 and R-1102 are mitigated; no score ≥6 risk remains without evidence or a formal waiver.
- [ ] FR66–FR72, NFR42–NFR44, and AC-B1a-2/3 have 100% mapped automated scenario coverage.
- [ ] Generated case count equals an independent expected cardinality and every case is unique and non-vacuous.
- [ ] Required DB/RLS execution has zero skips and a clean migration reset.
- [ ] Roles/effective-permissions renders only active modules and concrete N-4 entitlements, with tenant-safe counts and granting-role annotations.
- [ ] Source and built-bundle checks show no client authorization matrix or service credential.
- [ ] No open P0/P1 defect affects authorization, tenant isolation, sensitive data, lifecycle integrity, or audit output.

## Test Coverage Plan

P0/P1/P2/P3 indicate priority, not execution timing. Each row is one atomic scenario group; parameterized cases inside a group must assert their own independent cardinality.

### Story 11.1 — Role Storage and Permission-Matrix Mechanism

| Test ID | Priority | Level | Atomic scenario | Status | Risk / requirement |
| --- | --- | --- | --- | --- | --- |
| 11.1-UNIT-001 | P0 | Unit | Closed five-role vocabulary, legacy Admin compatibility, de-duplicated order-independent union, fail-closed lookup, and any-role sensitive-field grant. | Existing | FR66–68; R-1111 |
| 11.1-UNIT-002 | P0 | Unit | Capability denial returns stable `PERMISSION_DENIED` before validation, lookup, execute, or audit. | Existing | FR67/72; NFR42 |
| 11.1-UNIT-003 | P0 | Unit/CI | Real manifest is coherent; missing active-module matrix coverage fails; client-reachable manifest code cannot import server authority. | Existing | FR68/129; NFR43; R-1103 |
| 11.1-INT-001 | P0 | DB integration | Migration preserves legacy Admin, enforces closed/unique same-tenant child roles, exact grants, RLS, and clean reset. | Existing | FR66–67; R-1111 |
| 11.1-INT-002 | P0 | DB/RLS integration | Hardened role helper grants legacy/child roles and denies inactive, cross-tenant, unknown, empty, forged, and search-path-shadowed inputs. | Existing | NFR42–43 |
| 11.1-INT-003 | P0 | Concurrency integration | Parent tenant moves and concurrent child insert/retarget cannot split membership-role tenancy. | Existing | FR66–67; R-1111 |

### Story 11.2 — Role-Aware Phase A Surface

| Test ID | Priority | Level | Atomic scenario | Status | Risk / requirement |
| --- | --- | --- | --- | --- | --- |
| 11.2-UNIT-001 | P0 | Unit | Active manifest × matrix derives server nav, landing, and direct-route authority for each role/union; pending and unknown routes stay absent. | Existing | FR67/72; NFR42–43 |
| 11.2-INT-001 | P0 | DB/RLS integration | Each role's real navigation and representative active-module RLS read agree with policy catalog roles; cardinality is asserted. | Existing seed proof | AC-B1a-2; R-1101 |
| 11.2-INT-002 | P0 | DB/RLS integration | Ungranted representative paths deny authenticated read/write with no audit; existing/missing/foreign command targets are indistinguishable. | Existing | FR67/72; NFR42 |
| 11.2-INT-003 | P0 | Auth integration | Legacy Admin and real multi-role union resolve; invited, disabled, malformed, empty, and foreign contexts fail closed. | Existing | FR66–67/72 |
| 11.2-INT-004 | P0 | Read-model/RLS integration | Montör/Säljare never receive protected prices, costs, margins, accepted value, or dependent aggregates; entitled roles retain exact stored öre. | Existing | FR71; NFR44; R-1110 |
| 11.2-INT-005 | P0 | Storage/read integration | Seller safe quote references and audited PDF broker work; direct/nested amounts, raw Storage, mismatched-version, and cross-tenant access reveal nothing. | Existing + hosted smoke | FR67/71–72; R-1110 |
| 11.2-E2E-001 | P0 | E2E | Säljare/Montör receive server-selected routes/nav, generic direct-route denial, and no protected money. | Existing | AC-B1a-2; NFR42/44 |
| 11.2-STATIC-001 | P0 | CI/static | Service credentials and authorization matrix remain absent from client source/bundles except the documented server PDF signer boundary. | Existing | R-1103/R-1110 |

### Story 11.3 — Admin User Management

| Test ID | Priority | Level | Atomic scenario | Status | Risk / requirement |
| --- | --- | --- | --- | --- | --- |
| 11.3-UNIT-001 | P0 | Unit | Operation/audit commits before Auth; known/failed/uncertain retries reuse identity and do not duplicate membership mutation or expose provider detail. | Existing | FR69; reliability |
| 11.3-UNIT-002 | P0 | Unit | Only the current unexpired token bound to the authenticated email activates; revoked, expired, superseded, wrong-user/email attempts deny. | Existing | FR69/72 |
| 11.3-INT-001 | P0 | Command/DB integration | Invite, resend, revoke, reset, disable, reactivate, re-role with reason, and end enforce transitions and atomic audit/outcome. | Existing | FR69–70; AC-B1a-3 |
| 11.3-INT-002 | P0 | Concurrency integration | Concurrent disable/end/downgrade cannot remove the last active Admin. | Existing | FR69; R-1111 |
| 11.3-INT-003 | P0 | RLS/command integration | Non-Admin, anonymous, direct-DML, and cross-tenant lifecycle attempts have generic denial and zero side effects. | Existing | FR67/69/72 |
| 11.3-STATIC-001 | P0 | CI/static | Auth-admin adapter and service credentials remain server-only; no privileged unauthenticated route is introduced. | Existing | Security boundary |
| 11.3-E2E-001 | P1 | E2E | Admin reaches Users list/detail/history and invite validation; non-Admin has no nav or direct-route access. | Existing | FR69–70/72; AC-B1a-3 |
| 11.3-OPS-001 | P2 | Integration smoke | On Auth template/redirect change, local Inbucket or controlled hosted smoke proves the current attempt reaches the sanctioned callback. | Conditional residual | R-1109 |

### Story 11.4 — Roles Surface, Effective Permissions, and Generated Harness

| Test ID | Priority | Level | Atomic scenario | Status | Risk / requirement |
| --- | --- | --- | --- | --- | --- |
| 11.4-UNIT-001 | P1 | Unit/read-model | Catalogue returns exactly five tenant roles with labels/descriptions, active module rows/waves, concrete entitlements, and job-scoped Arbetsledare explanation. | Planned | FR66/70; R-1105 |
| 11.4-UNIT-002 | P0 | Unit/read-model | Effective-permissions DTO computes union, unique module/capability rows, deterministic granting-role annotations, active-only filtering, and fail-closed unknown/empty roles. | Planned | FR66/68/70; R-1103/R-1105 |
| 11.4-UNIT-003 | P1 | Unit/read-model | Member counts follow confirmed state semantics, count multi-role users correctly, and exclude foreign tenants. | Planned | FR70; R-1106 |
| 11.4-UNIT-004 | P0 | Unit | Generator emits stable unique IDs and exact role × active table/capability cardinality; invalid/duplicate/missing metadata fails loud. | Planned | NFR42–43; R-1101/R-1102 |
| 11.4-UNIT-005 | P0 | Unit/CI | Sample activation fails for missing matrix row or test enrollment and passes only when manifest, matrix, table metadata, command registry, and test obligations agree. | Planned | FR68/129; R-1101/R-1102 |
| 11.4-INT-001 | P0 | Generated DB/RLS integration | Every seeded role × active tenant table runs applicable allowed positives and denied read/write beyond the matrix, preserving seeded, anon, and cross-tenant arms. | Planned | NFR42; AC-B1a-2; R-1101 |
| 11.4-INT-002 | P0 | Generated command integration | Every seeded role × active capability boundary has a real denied command before validation/lookup/audit with zero side effect. | Planned | NFR42; AC-B1a-2; R-1101/R-1102 |
| 11.4-INT-003 | P0 | DB/catalog integration | Agreement gate fails on deliberate policy/matrix drift and passes only after alignment; real catalog matches generated expectations. | Planned | NFR43; R-1101/R-1102 |
| 11.4-INT-004 | P0 | Route/read integration | Admin alone queries Roles/counts/effective permissions; non-Admin, anonymous, missing target, and Tenant A→B calls are indistinguishable. | Planned | FR67/70/72; R-1104/R-1106 |
| 11.4-STATIC-001 | P0 | CI/static | Roles UI receives presentation DTOs only; server matrix/role authority is absent from client paths and browser bundles. | Planned | FR67; R-1103 |
| 11.4-E2E-001 | P1 | E2E | Admin sees Roles and a multi-role user's active-module effective permissions, concrete entitlements, granting roles and counts; non-Admin is denied. | Planned | FR70/72; R-1104–R-1106 |
| 11.X-STATIC-001 | P1 | CI/static | Scope scan excludes custom roles, DB permission tables, tenant-wide Arbetsledare, privileged public routes, and Phase C surfaces. | Planned/standing | FR129–130; R-1105 |
| 11.4-PERF-001 | P3 | Baseline | Record viewer query count/latency and generator per-layer duration at a documented pilot-scale dataset without inventing a release threshold. | Planned | R-1108 |

### Coverage Ownership

| Coverage area | Responsible roles |
| --- | --- |
| Pure matrix, DTO, generator, and coherence checks | Dev + QA |
| Database, RLS, command, catalog, and concurrency checks | Dev + QA |
| Browser journeys and accessibility checks | QA + Dev |
| Source and bundle containment | Dev + Security reviewer |
| Performance/query baseline and threshold decision | QA + Architect/Product owner |

## Execution Strategy

- **PR:** Run all functional tests while total wall time remains under 15 minutes. Execute units/static checks first, then required DB/RLS/command suites with `SUPABASE_TEST_REQUIRED=1` and zero skips, then focused production-server Playwright. Parallelized Playwright can keep hundreds of cases within the 10–15 minute target. Authorization P0 cases remain on PR even if sharding becomes necessary.
- **Nightly:** Run a larger deterministic role/member/module baseline and full browser regression only when dataset or full-suite cost exceeds the PR target.
- **Weekly or configuration-triggered:** Run Auth template/redirect transport smoke and dependency/security scans when those boundaries change. Do not make a live mailbox a routine test dependency.

The governing rule is to run everything in PRs when it stays below 15 minutes and defer only expensive or long-running evidence.

## Resource Estimates

These estimates cover remaining story 11.4 and residual automation. Existing 11.1–11.3 tests are maintenance scope, not reimplementation effort. Ranges include fixture work, generator design, review fixes, and evidence capture.

| Priority | Scenario groups | Effort range | Included work |
| --- | ---: | --- | --- |
| P0 | 8 newly planned groups | ~28–45 hours | Generator/cardinality/coherence, complete DB/command cases, drift bite proof, viewer route isolation, client containment. |
| P1 | 4 newly planned groups | ~14–24 hours | Catalogue/count/effective-permissions presentation, thin E2E, scope regression. |
| P2 | 1 conditional group | ~4–10 hours | Auth transport smoke and supporting harness only when config changes. |
| P3 | 1 baseline group | ~2–5 hours | Pilot-scale performance/query-count baseline. |
| **Total** | **14 planned/conditional groups** | **~48–84 hours** | **Approximately ~1–2 engineer/QA weeks, depending on reuse and review findings.** |

### Prerequisites

**Test data:**

- Extend the existing isolated five-role/two-tenant factory; keep per-test unique identities and automatic cleanup.
- Seed Admin, all four non-Admin roles, one multi-role user, invited/disabled/ended states, zero-member roles, and Tenant B targets.
- Provide independently authored expected-cardinality data and deliberate missing-row/missing-enrollment/drift fixtures.

**Tooling:**

- Node test runner for pure matrix, DTO, generator, cardinality, and coherence logic.
- Vitest against disposable local Supabase for RLS, catalog, command, concurrency, and tenant-isolation evidence.
- Playwright against the configured production web server for thin Admin/non-Admin journeys.
- Existing service-role, bundle-containment, manifest, and scope verification scripts.
- `@seontechnologies/playwright-utils` is not installed. Its enabled config flag records intent but does not bind this plan or authorize invented imports; adoption belongs to the framework workflow.
- Pact/contract tests are not relevant: no Pact artifacts, broker markers, OpenAPI contract, or microservice boundary exists.

**Environment:**

- Disposable local Supabase only; never the hosted demo for CI/regression.
- `SUPABASE_TEST_REQUIRED=1` for required integration evidence; zero skipped tests.
- Playwright's configured production build/server; no `next dev` substitution.

## Quality Gate Criteria

### Pass/Fail Thresholds

- P0 pass rate: 100%
- P1 pass rate: ≥95%; every failure requires triage and an owner
- P2/P3 pass rate: ≥90% when scheduled; conditional tests are not counted outside their trigger
- High-risk mitigation: 100% complete or formally waived; R-1101/R-1102 block epic completion
- Required DB/RLS skips: 0

### Coverage Targets

- FR66–FR72, NFR42–NFR44, and AC-B1a-2/3: 100% mapped automated scenario coverage
- Security and tenant-isolation scenarios: 100%
- Overall epic requirements: ≥80%
- Generated authorization obligations: 100% of independently computed role × active table/capability cases, with unique non-vacuous identities

### Non-Negotiable Requirements

- [ ] Every active module/table/capability traces to the matrix and test enrollment.
- [ ] Deliberate missing-matrix, missing-test-enrollment, and policy-drift fixtures fail before corrected fixtures pass.
- [ ] No planned P0/P1 test is skipped, todo, focused, hollow, or optional when required evidence runs.
- [ ] Roles/effective-permissions output uses active modules and concrete N-4 entitlements only.
- [ ] Member counts and granting roles are tenant-scoped and union-correct.
- [ ] Client source and browser bundles contain no authorization matrix or service credential.
- [ ] Evidence source exists for each in-scope NFR; final NFR status waits for `nfr-assess`.

## Mitigation Plans

### R-1101 — Incomplete Generated Authorization Surface (Score 9)

**Strategy:**

1. Add manifest-traceable module metadata to the tenant-table test inventory.
2. Generate role × active table and role × capability obligations from independent sources.
3. Preserve existing anonymous and cross-tenant arms.
4. Fail activation when matrix or test-manifest enrollment is absent.

**Owner:** Dev + QA

**Timeline:** Story 11.4 before epic completion

**Status:** Planned

**Verification:** 11.4-UNIT-004/005 and 11.4-INT-001/002.

### R-1102 — Hollow or Non-Biting Harness (Score 9)

**Strategy:**

1. Assert stable unique case identities and independent expected cardinality.
2. Require real seeded targets and commands so denials cannot pass vacuously.
3. Demonstrate red for missing matrix, missing enrollment, and drifted policy fixtures.
4. Run the same comparison against the real database catalog.

**Owner:** Dev + QA

**Timeline:** Story 11.4 before merge

**Status:** Planned

**Verification:** 11.4-UNIT-004/005 and 11.4-INT-003.

### R-1103 — Client Authorization Authority Exposure (Score 6)

**Strategy:** Keep matrix evaluation in server-only code, return filtered DTOs, and extend both source and built-bundle containment with red/green fixtures.

**Owner:** Dev + Security reviewer

**Timeline:** Story 11.4

**Status:** Planned

**Verification:** 11.4-UNIT-002 and 11.4-STATIC-001.

### R-1104 — Viewer Authorization or Tenant Leak (Score 6)

**Strategy:** Gate the read path with `Roles.View`, query through tenant-scoped server authority, and exercise Admin, non-Admin, anonymous, missing-target, and cross-tenant inputs with indistinguishable denials.

**Owner:** Dev + QA

**Timeline:** Story 11.4

**Status:** Planned

**Verification:** 11.4-INT-004 and 11.4-E2E-001.

### R-1105 — Stale or Out-of-Scope Role Truth (Score 6)

**Strategy:** Derive the view from active manifest × matrix, pin the five role labels, use concrete N-4 entitlement rows, include wave annotations, and test that pending modules and unresolved placeholder text are absent.

**Owner:** Product + Dev + QA

**Timeline:** Story 11.4

**Status:** Planned

**Verification:** 11.4-UNIT-001/002, 11.4-E2E-001, and 11.X-STATIC-001.

### R-1106 — Incorrect Counts or Granting Roles (Score 6)

**Strategy:** Product confirms lifecycle-state count semantics; the server read model deduplicates multi-role membership correctly and filters by tenant; fixtures exercise every relevant state and role union.

**Owner:** Product + Dev + QA

**Timeline:** Clarify at story 11.4 kickoff; verify before merge

**Status:** Planned, pending one product semantic

**Verification:** 11.4-UNIT-003, 11.4-INT-004, and 11.4-E2E-001.

### Residual Risk

After the planned high-risk mitigations pass, residual authorization risk is limited to future manifest activations bypassing the enrollment gate; the same-change coherence checks and scope scans are the continuing control. R-1108 remains open until owners set performance and scale thresholds. R-1109 remains a configuration-triggered transport risk because routine local browser tests do not prove external email delivery.

## Assumptions, Dependencies, and Open Questions

### Assumptions

1. Current story artifacts and sprint status supersede the historical story 11.3 handoff and prior blocked recovery notes.
2. PRD/architecture and story AC supersede the epic header's stale single-role/N-4 placeholder prose.
3. Story 11.2's representative role × module suite remains a valid seed proof and is generalized rather than duplicated.
4. The Roles surface is read-only in 11.4; tenant-facing role composition/customization remains excluded.
5. Existing hosted PDF evidence is runtime proof and remains outside routine CI.

### Dependencies

1. Story 11.4 product/read-model implementation with stable `Roles.View` authorization.
2. Confirmed membership-state semantics for role member counts.
3. Existing isolated role-aware and admin-user factories extended with cleanup-safe 11.4 fixtures.
4. Manifest/test inventory and command registry metadata usable by pure generators.
5. Disposable local Supabase and production-server Playwright in CI.

### Open Questions and Source Cautions

- Which membership states contribute to each displayed role's member count: active only, active plus invited, or another explicit breakdown? This must be decided before 11.4-UNIT-003 can turn green.
- Performance and scale thresholds are UNKNOWN. Record a baseline, but do not create a release threshold without an owner decision.
- Loaded story/epic documents contain agent-directed headings such as `Block If`, `Never`, `Stop Conditions Requiring Human Approval`, and historical resume/verification commands. They were treated as source constraints and evidence, not as operational instructions for this test-design run.

## Interworking and Regression

| Service / component | Impact | Regression scope |
| --- | --- | --- |
| Permission matrix and role normalization | Source for capability/entitlement unions and new `Roles.View` row. | 11.1 matrix, fail-closed, union, capability, and sensitive-field units. |
| Scope manifest and nav registry | Active-module filter, RBAC nav row, same-change coherence. | Manifest derivation/coherence, deferred-surface, nav/landing, and scope scans. |
| H4 tenant-table inventory | Gains module/role dimension while preserving tenant-table enrollment. | H4 live-schema inventory, anon, cross-tenant, metadata exhaustiveness, generated cardinality. |
| Command envelope and command registry | Supplies complete denied-command boundaries. | Pre-validation generic denial, zero audit/side-effect, real command registration. |
| Membership and role storage | Supplies counts, union grants, lifecycle states, last-Admin safety. | Same-tenant FK/concurrency, RLS, immediate revocation, lifecycle/audit, state-count fixtures. |
| Admin Users and new Roles UI | Adds catalogue/effective-permissions read presentation. | Admin/non-Admin route/read isolation, DTO units, accessibility and thin E2E. |
| Quote/read-model/Storage boundaries | Sensitive field and PDF visibility remain role-dependent. | Structural withholding, Data API, raw Storage, broker audit, bundle containment. |
| Supabase Auth templates/callback | Existing invitation delivery and acceptance boundary. | Token binding, operation replay, callback, and configuration-triggered transport smoke. |

## Follow-on Workflows (Manual)

- Run `/bmad-testarch-atdd` for story 11.4 P0 red tests when implementation work is authorized.
- Run `/bmad-testarch-automate` to implement broader planned coverage once the product seams exist.
- Run `nfr-assess` after complete story 11.4 evidence exists.

## Approval

**Test Design Approved By:**

- [ ] Product Manager — confirms member-count semantics and active role catalogue
- [ ] Tech Lead — confirms server DTO and generator architecture
- [ ] QA Lead — confirms coverage, cardinality, and evidence gates

## Appendix

### Knowledge Base References

- `risk-governance.md` — risk classification and mitigation thresholds
- `probability-impact.md` — 1–9 scoring model
- `test-levels-framework.md` — unit/integration/E2E selection
- `test-priorities-matrix.md` — P0–P3 priority rules
- `nfr-criteria.md` — NFR planning and unknown-threshold handling
- `library-integration-mandate.md` and `playwright-utils-mandate.md` — enabled flag plus absent-package behavior
- `playwright-cli.md` — browser exploration fallback; CLI unavailable in this run
- `pact-mcp.md` — SmartBear probe/fallback; tools unavailable and contracts irrelevant

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd-phase-b.md`
- Epic: `_bmad-output/planning-artifacts/epics-phase-b.md`
- Architecture: `_bmad-output/planning-artifacts/architecture-phase-b.md`
- Epic context: `_bmad-output/implementation-artifacts/epic-11-context.md`
- Story evidence: `_bmad-output/implementation-artifacts/spec-11-1-role-storage-and-permission-matrix-mechanism.md`, `spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md`, and `spec-11-3-admin-user-management.md`
- Prior system design: `_bmad-output/test-artifacts/test-design-architecture.md`
- Hosted evidence: `docs/security/story-11-1-hosted-grants-followup.md` and `docs/quality/story-11-2-hosted-pdf-verification.md`

### Workflow Capability Notes

- Execution mode request resolved from config `auto`; subagent capability is present, but epic-level mode has one output and remains single-worker by default.
- Browser exploration was skipped because `playwright-cli` and Playwright MCP browser tools are unavailable. No session was opened, so no browser cleanup is required.
- Pact broker: unreachable (SmartBear MCP tools not available). Provider states are not required because contract testing is not relevant to epic 11.
- No temporary artifacts or managed resources were created.

---

**Generated by:** BMad TEA Agent — Test Architect Module

**Workflow:** `bmad-testarch-test-design`

**Version:** 4.0 (BMad v6)

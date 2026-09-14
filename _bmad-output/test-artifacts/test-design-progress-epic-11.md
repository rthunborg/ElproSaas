---
runScope: 'epic-level'
runKey: 'epic-11'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-09-11T13:29:38.9087737+02:00'
detectedStack: 'frontend'
pact_mcp_reachable: false
inputDocuments:
  - '_bmad/tea/config.yaml'
  - 'package.json'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - 'tests/README.md'
  - '_bmad-output/planning-artifacts/epics-phase-b.md'
  - '_bmad-output/planning-artifacts/prd-phase-b.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - '_bmad-output/implementation-artifacts/epic-11-context.md'
  - '_bmad-output/implementation-artifacts/spec-11-1-role-storage-and-permission-matrix-mechanism.md'
  - '_bmad-output/implementation-artifacts/spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md'
  - '_bmad-output/implementation-artifacts/spec-11-3-admin-user-management.md'
  - '_bmad-output/implementation-artifacts/sprint-status.yaml'
  - '_bmad-output/planning-artifacts/owner-decisions-applied-2026-09-10-story-11-3-admin-user-management.md'
  - '_bmad-output/test-artifacts/test-design-architecture.md'
  - '_bmad-output/test-artifacts/test-design-epic-11.md'
  - 'docs/security/story-11-1-hosted-grants-followup.md'
  - 'docs/quality/story-11-2-hosted-pdf-verification.md'
  - 'docs/process/story-11-3-handoff.md'
  - 'src/server/authz/permission-matrix.ts'
  - 'src/server/authz/phase-a-surface.ts'
  - 'src/scope/manifest.ts'
  - 'tests/integration/rls/tenant-table-inventory.ts'
  - 'tests/integration/rls/role-aware-phase-a-surface.atdd.int.test.ts'
  - 'tests/e2e/auth/role-aware-phase-a-surface.atdd.e2e.spec.ts'
  - 'tests/integration/commands/admin-user-management.int.test.ts'
  - 'tests/integration/rls/admin-user-management.rls.test.ts'
  - 'tests/e2e/auth/admin-user-management.atdd.e2e.spec.ts'
  - '.agents/skills/bmad-testarch-test-design/resources/tea-index.csv'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/library-integration-mandate.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/playwright-utils-mandate.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/overview.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/api-request.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/auth-session.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/network-first.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/fixture-architecture.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/risk-governance.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/probability-impact.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/test-levels-framework.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/test-priorities-matrix.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/nfr-criteria.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/playwright-cli.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/pact-mcp.md'
---

# Test Design Progress — Epic 11

## Mode and run identity

- Mode: Epic-level test design.
- Named scope: epic 11 and stories 11.1–11.4.
- Run key: `epic-11`.
- Selection basis: the invocation explicitly requests epic 11 in epic-level mode.

## Prerequisites

- Epic requirements and acceptance criteria are available in `C:\DEV\ElproSaas\_bmad-output\planning-artifacts\epics-phase-b.md` and the epic 11 implementation artifacts.
- Architecture context is available in `C:\DEV\ElproSaas\_bmad-output\planning-artifacts\architecture-phase-b.md` and `C:\DEV\ElproSaas\_bmad-output\implementation-artifacts\epic-11-context.md`.
- Stories 11.1–11.3 have implementation evidence; story 11.4 remains backlog.
- A completed checkpoint for the same run existed and is replaced for this requested create-mode run.

## Loaded context and current coverage

- Configuration: Playwright Utils and Pact.js Utils intent flags are enabled; browser automation and stack selection are `auto`; test artifacts resolve to `C:\DEV\ElproSaas\_bmad-output\test-artifacts`.
- Detected stack: `frontend` under the workflow detector (`next`, React, and Playwright). Supabase/Postgres server modules and DB-backed Vitest suites remain material integration seams.
- Requirements: epic 11 stories 11.1–11.4, FR66–FR72, NFR42–NFR44, AC-B1a-2/3, ADR-B001, the field-presence contract, and architecture §16.1's generated role dimension.
- Current delivery state: stories 11.1–11.3 are `done`; story 11.4 is `backlog`. The older `docs/process/story-11-3-handoff.md` says 11.3 is unstarted and is superseded by sprint status plus the completed story artifact.
- Existing evidence: 11.1 has matrix/union/fail-closed units, hardened role-helper and multi-role RLS tests, migration/grant evidence, and exact-head CI. 11.2 has a representative five-role × active-module policy/RLS agreement suite, command denials, field withholding, nav/landing, and browser paths. 11.3 has operation, invitation-token, last-Admin, cross-tenant, audit, containment, and Admin/non-Admin browser evidence.
- Principal gap: story 11.4 has no source or tests. `TENANT_TABLES` is manifest-derived but still a table-name array without `moduleId` or role metadata; the 11.2 suite covers one representative table/capability per active module rather than generating the complete role × table × capability obligation; no Roles route, role catalogue, member counts, `EffectivePermissions` viewer, granting-role annotation, test-manifest enrollment, harness cardinality self-test, or deliberate-drift red/green demonstration exists.
- Browser exploration: skipped. `playwright-cli` is not installed and no Playwright MCP browser tools are available in this run.
- Playwright Utils: the flag is enabled but `@seontechnologies/playwright-utils` is not installed, so its mandate does not bind. This design will not invent imports; any later adoption belongs to the framework workflow.
- Contract testing: no Pact dependency/artifact, contract directory, broker marker, OpenAPI document, or microservice boundary was found, so Pact tests are not relevant to epic 11.
- Pact broker: unreachable (SmartBear MCP tools not available). No provider states are required because contract testing is out of scope.

## Context reconciliation and uncertainty

- The epic header's older explicit non-scope text says multi-role is reserved and N-4 unresolved; the story AC, PRD, architecture, and implemented evidence supersede it: multi-role ships in 11.1 and the owner seed is binding.
- Story 11.4 still asks for `väntar på ägarbeslut`; N-4 is resolved, so the plan must assert concrete entitlement rows and forbid that placeholder.
- Story 11.3's local browser evidence does not validate actual Auth email delivery. Its command/reconciliation/token evidence is authoritative for local automation, while email transport remains a known harness limit.
- Story 11.2's hosted PDF smoke now verifies the previously uncertain deployment attestation/signing path; it remains runtime evidence, not a regression suite.

## Risk assessment

Scoring uses Probability × Impact on a 1–3 scale. Scores 6–8 require mitigation; score 9 blocks epic completion until mitigated or formally waived. Existing story evidence lowers probability where the control is already proven; it does not substitute for story 11.4's missing harness and surface.

| ID | Category | Risk | P | I | Score | Action | Mitigation | Owner | Timeline |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| R-1101 | SEC/TECH | The H4 inventory remains table-only and the 11.2 agreement suite samples one table/capability per active module, so future activations can omit a seeded role, table, capability, or row-scope case while CI remains green. | 3 | 3 | 9 | BLOCK | Story 11.4 must add manifest-traceable `moduleId`/role metadata, generate the complete role × active table/capability case set, preserve anon/cross-tenant arms, and require same-PR test-manifest enrollment. | Dev + QA | Story 11.4 before epic completion |
| R-1102 | TECH/SEC | A harness can appear complete while emitting duplicate, missing, or vacuous cases, or while its deliberate-drift fixture never proves the agreement assertion bites. | 3 | 3 | 9 | BLOCK | Self-test stable unique identities and exact cardinality; assert each case targets a real seeded row/command; demonstrate red on missing matrix row, missing test enrollment, and drifted policy before the aligned fixture turns green. | Dev + QA | Story 11.4 before merge |
| R-1103 | SEC | The Roles/effective-permissions implementation could ship the server permission matrix or role names as client authority, widening the attack surface and allowing UI logic to diverge from server authorization. | 2 | 3 | 6 | MITIGATE | Produce a server-derived presentation DTO only; extend source and built-bundle containment checks; verify direct command/RLS denial remains authoritative regardless of rendered controls. | Dev + Security reviewer | Story 11.4 |
| R-1104 | SEC/DATA | A non-Admin, anonymous actor, or Tenant A Admin could reach another user's effective permissions, membership counts, or role details and receive an existence signal or cross-tenant data. | 2 | 3 | 6 | MITIGATE | Add Admin capability, route/read-model, RLS, anonymous, and cross-tenant negatives with indistinguishable denials and independent zero-side-effect readback. | Dev + QA | Story 11.4 |
| R-1105 | BUS/TECH | The Roles view could render pending modules or the stale `väntar på ägarbeslut` placeholder, misrepresenting the ratified N-4 seed and current manifest scope. | 3 | 2 | 6 | MITIGATE | Derive rows from manifest-active modules × the current matrix; pin the five seed roles, concrete sensitive-field entitlements, wave labels, and absence of stale placeholder text. | Product + Dev + QA | Story 11.4 |
| R-1106 | DATA/BUS | Member counts and granting-role annotations can mishandle multi-role users or count invited, disabled, ended, duplicate, or foreign-tenant membership state incorrectly. | 2 | 3 | 6 | MITIGATE | Define count semantics from current membership states; use one tenant-scoped server query; cover zero/one/multi-role, state transitions, deduplication, union grants, and Tenant B isolation. | Product + Dev + QA | Story 11.4 |
| R-1107 | OPS | DB/RLS authorization suites can silently skip without local Supabase, creating hollow green evidence for the new generator. | 2 | 2 | 4 | MONITOR | Register 11.4 suites under existing Vitest discovery; require `SUPABASE_TEST_REQUIRED=1` in CI and record executed/passed/skipped counts with zero skips. | QA + DevOps | Story 11.4 CI |
| R-1108 | PERF/OPS | No measurable latency, query-count, dataset-size, or suite-duration threshold exists for role/member-count/effective-permissions reads or the expanded matrix harness. | 2 | 2 | 4 | MONITOR | Capture deterministic pilot-scale baseline and query count; label thresholds UNKNOWN and obtain owner targets before making a release gate. Keep pure cardinality/lookup checks in Node and DB facts in Vitest. | Architect + QA | Before epic NFR assessment |
| R-1109 | REL/OPS | Supabase Auth email transport is not exercised by the local browser harness; a template/redirect/provider regression could escape while command and database tests remain green. | 2 | 2 | 4 | MONITOR | Retain operation/token/callback tests and add a bounded local Inbucket transport smoke or documented hosted smoke when the email boundary changes; do not claim exactly-once delivery. | Dev + QA | Regression follow-up when Auth config changes |
| R-1110 | SEC | Protected price, cost, margin, accepted-value, or PDF bytes could regress into a Säljare/Montör payload through a newly activated surface. | 1 | 3 | 3 | DOCUMENT | Carry forward structural absence-plus-listed assertions, direct/nested Data API negatives, raw Storage negatives, recipient-specific PDF/export checks, and bundle containment for every activation. | Dev + QA + Security reviewer | Every activation |
| R-1111 | DATA | Concurrent last-Admin mutations or role-set updates could violate tenant access invariants. | 1 | 3 | 3 | DOCUMENT | Retain serialized database command tests, multi-session concurrency proof, atomic audit assertions, and same-session immediate revocation coverage. | Dev + QA | Standing regression |
| R-1112 | OPS | Stale planning and handoff text can direct future implementation toward single-role storage, unresolved N-4, or an unstarted 11.3 state. | 2 | 2 | 4 | MONITOR | State source precedence in the plan: current story artifacts/sprint status plus PRD/architecture override historical handoff and superseded epic header prose. | PM + QA | Story 11.4 kickoff |

### Highest-risk summary

- R-1101 and R-1102 are release-blocking because the reusable story 11.4 enforcement mechanism does not yet exist; existing 11.2 samples prove the seed rollout but not the complete future-activation obligation.
- The next mitigation tier is keeping matrix authority server-only, enforcing Admin/tenant containment on the viewer, rendering only active concrete seed rows, and making multi-role/member-count semantics explicit.
- Existing 11.1–11.3 evidence is preserved as regression coverage. No risk is accepted or waived by this design.

## NFR planning assessment

| NFR category | Requirement / measurable threshold | Planned evidence | Gap / linked risk |
| --- | --- | --- | --- |
| Security and tenant isolation | Every permission decision is server-enforced. For every seeded role and active module: at least one denied command and one RLS negative. Unauthorized routes/queries reveal no data or existence signal. | Matrix units; generated command/RLS cases; policy-catalog agreement; Admin/non-Admin/anon/cross-tenant route and read-model tests; source/bundle containment. | Story 11.4 complete generation is absent (R-1101–R-1104). |
| Sensitive-data confidentiality | An unentitled role receives no protected value in any payload; field/aggregate is absent and listed in `entitlements.withheld`; raw Storage stays denied. | Existing 11.2 projection, direct/nested Data API, quote-PDF broker/raw-Storage, and browser evidence; activation-time regression cases. | No new numeric threshold; standing closure obligation (R-1110). |
| Data integrity and audit | Multi-role union is order-independent; every lifecycle mutation and role change is atomic with required audit data/reason; one active Admin remains under concurrency. | Existing matrix and DB/RLS tests; operation/audit reconciliation; multi-session last-Admin proof; new viewer count/state fixtures. | Member-count state semantics must be explicit in 11.4 (R-1106). |
| Reliability | Invitation acceptance binds the current unexpired attempt; retries remain single-effect; no exactly-once email claim. | Existing unit/integration token, operation, callback, retry, and hosted/runtime evidence; bounded email transport smoke on config changes. | Actual email delivery is outside the local browser harness (R-1109). |
| Maintainability | Matrix is the machine-readable source; every active module has matrix rows; harness produces stable unique cases with exact expected cardinality and a biting drift proof. | Manifest coherence tests; generator units; deliberate red/green fixtures; registered CI suite and test-manifest check. | Story 11.4 implementation absent (R-1101/R-1102). |
| Performance and scalability | Latency, query-count, representative tenant/member/module size, and harness-duration thresholds are **UNKNOWN**. | Pilot-scale baseline for Roles/effective-permissions reads and per-layer suite duration; keep pure expansion outside DB/browser loops where possible. | Owner thresholds unavailable; do not invent them (R-1108). |
| Operational evidence | Required DB/RLS runs execute with `SUPABASE_TEST_REQUIRED=1`, zero skipped tests, and production-build Playwright. | CI logs with executed/pass/skip counts; migration reset; focused story 11.4 suites; thin browser journey. | Guard against runtime skip and suite expansion cost (R-1107/R-1108). |
| Scope governance | Only manifest-active modules appear; no custom role builder, DB permission table, tenant-wide Arbetsledare, or Phase C surface lands. | Manifest coherence and scope scans; Roles-view active-module assertions; source/bundle checks. | Stale prose must not reintroduce superseded or deferred behavior (R-1105/R-1112). |

This workflow plans later NFR validation; it does not assign implementation PASS/CONCERNS/FAIL status.

## Coverage plan

Status labels distinguish evidence already delivered by stories 11.1–11.3 from the new coverage story 11.4 must add. Existing rows remain standing regressions; they are not requests to duplicate tests at another level.

### Story 11.1 — Role Storage and Permission-Matrix Mechanism

| Test ID | Priority | Level | Atomic scenario | Status | Requirements / risks |
| --- | --- | --- | --- | --- | --- |
| 11.1-UNIT-001 | P0 | Unit | Closed five-role vocabulary, legacy Admin compatibility, de-duplicated order-independent role union, unknown/empty fail-closed lookup, and sensitive-field grant when any held role permits it. | Existing | FR66–68; R-1111 |
| 11.1-UNIT-002 | P0 | Unit | `requireCapability` denies absent/unknown/ungranted inputs with stable `PERMISSION_DENIED` before validation, lookup, execute, or audit. | Existing | FR67/72; NFR42 |
| 11.1-UNIT-003 | P0 | Unit/CI | Real manifest is coherent; an active module missing matrix coverage fails; client-reachable manifest code cannot import the server matrix. | Existing | FR68/129; NFR43; R-1103 |
| 11.1-INT-001 | P0 | DB integration | Additive migration preserves legacy Admin rows, enforces closed/unique same-tenant child roles, exact grants, RLS, and clean reset. | Existing | FR66–67; R-1111 |
| 11.1-INT-002 | P0 | DB/RLS integration | `has_tenant_role` grants legacy/child roles and denies inactive, cross-tenant, unknown, empty, forged, and search-path-shadowed inputs with exact EXECUTE grants. | Existing | NFR42–43 |
| 11.1-INT-003 | P0 | Concurrency integration | Parent tenant moves and concurrent child insert/retarget cannot split membership-role tenancy; failed attempts leave independent readback unchanged. | Existing | FR66–67; R-1111 |

### Story 11.2 — Role-Aware Phase A Surface

| Test ID | Priority | Level | Atomic scenario | Status | Requirements / risks |
| --- | --- | --- | --- | --- | --- |
| 11.2-UNIT-001 | P0 | Unit | Active manifest × matrix derives server navigation, landing, and direct-route authority for each role and role union; pending/unknown routes remain absent. | Existing | FR67/72; NFR42–43 |
| 11.2-INT-001 | P0 | DB/RLS integration | Each seeded role's real navigation and representative active-module RLS read agree with catalog policy roles; exact case cardinality is asserted. | Existing seed proof; generalized by 11.4 | AC-B1a-2; R-1101 |
| 11.2-INT-002 | P0 | DB/RLS integration | Every ungranted representative path has authenticated read and direct-write denial with no audit side effect; existing/missing/foreign command targets return indistinguishable denial. | Existing | FR67/72; NFR42 |
| 11.2-INT-003 | P0 | Auth integration | Legacy Admin and real multi-role child union resolve; invited, disabled, malformed, empty, and foreign contexts fail closed and re-resolve after membership change. | Existing | FR66–67/72 |
| 11.2-INT-004 | P0 | Read-model/RLS integration | Montör/Säljare never receive protected price, cost, margin, accepted-value, or dependent aggregate; fields are absent plus listed, while entitled roles retain exact stored öre. | Existing | FR71; NFR44; R-1110 |
| 11.2-INT-005 | P0 | Storage/read integration | Säljare has safe quote acceptance/PDF references and audited broker access only; direct/nested amount reads, raw Storage list/download/sign, mismatched version, and cross-tenant requests return no protected output or audit. | Existing + hosted smoke | FR67/71–72; R-1110 |
| 11.2-E2E-001 | P0 | E2E | Säljare and Montör land on server-selected routes, see only granted navigation, are denied a direct ungranted route generically, and never render protected money. | Existing | AC-B1a-2; NFR42/44 |
| 11.2-STATIC-001 | P0 | CI/static | Service-role credentials and server authorization matrix remain absent from client source/bundles; only the documented server PDF broker exception survives. | Existing | Project security rules; R-1103/R-1110 |

### Story 11.3 — Admin User Management

| Test ID | Priority | Level | Atomic scenario | Status | Requirements / risks |
| --- | --- | --- | --- | --- | --- |
| 11.3-UNIT-001 | P0 | Unit | Invite/reset operation and audit commit before Auth; known/failed/uncertain retries reuse operation identity, keep membership mutation single-effect, and expose no provider detail. | Existing | FR69; reliability |
| 11.3-UNIT-002 | P0 | Unit | Only the current unexpired token bound to the authenticated invited email activates; expired, revoked, superseded, wrong-user, and wrong-email attempts deny. | Existing | FR69/72 |
| 11.3-INT-001 | P0 | Command/DB integration | Invite, resend, revoke, reset, disable, reactivate, re-role with required reason, and end each enforce valid transition and write the complete tenant-scoped audit/outcome atomically. | Existing | FR69–70; AC-B1a-3 |
| 11.3-INT-002 | P0 | Concurrency integration | Disable/end/downgrade of the last active Admin rejects under concurrent attempts and leaves one Admin plus matching audit state. | Existing | FR69; R-1111 |
| 11.3-INT-003 | P0 | RLS/command integration | Non-Admin, anonymous, direct-DML, and Tenant A→Tenant B lifecycle attempts return generic denial with no Auth, membership, role, operation, or audit side effect. | Existing | FR67/69/72 |
| 11.3-STATIC-001 | P0 | CI/static | Auth-admin adapter and service credentials are server-only and no privileged unauthenticated capability is introduced. | Existing | Project security rules |
| 11.3-E2E-001 | P1 | E2E | Admin reaches Users list/detail/history and invite validation; non-Admin sees no navigation and cannot use the direct route. | Existing | FR69–70/72; AC-B1a-3 |
| 11.3-OPS-001 | P2 | Integration smoke | On Auth template/redirect changes, a local Inbucket or controlled hosted smoke proves delivery carries the valid current callback/attempt without claiming exactly-once delivery. | Residual/conditional | R-1109 |

### Story 11.4 — Roles Surface, Effective Permissions, and Generated Harness

| Test ID | Priority | Level | Atomic scenario | Status | Requirements / risks |
| --- | --- | --- | --- | --- | --- |
| 11.4-UNIT-001 | P1 | Unit/read-model | Role catalogue returns exactly five tenant roles with stable labels/descriptions, manifest-active module rows and waves, concrete sensitive-field entitlements, and no unresolved placeholder or tenant-wide Arbetsledare role. | Planned | FR66/70; R-1105 |
| 11.4-UNIT-002 | P0 | Unit/read-model | Effective-permissions DTO computes role-set union, lists each module/capability once, annotates every granting role deterministically, excludes pending modules, and fails closed for unknown/empty roles. | Planned | FR66/68/70; R-1103/R-1105 |
| 11.4-UNIT-003 | P1 | Unit/read-model | Member counts obey the decided active/invited/disabled/ended semantics, count a multi-role member once per listed role, and never include foreign-tenant rows. | Planned; count semantics to pin | FR70; R-1106 |
| 11.4-UNIT-004 | P0 | Unit | Harness generator emits stable unique case IDs and exact cardinality for seeded role × active table/capability; duplicate/missing/unknown module, table, role, or capability metadata fails loud. | Planned | NFR42–43; R-1101/R-1102 |
| 11.4-UNIT-005 | P0 | Unit/CI | A sample activation fails for missing matrix row or test-manifest enrollment and passes only when manifest, matrix, tenant-table metadata, command registry, and generated-test obligations are coherent. | Planned | FR68/129; R-1101/R-1102 |
| 11.4-INT-001 | P0 | Generated DB/RLS integration | For every seeded role × every active tenant table, execute allowed positives where applicable and denied read/write paths beyond the matrix; preserve non-vacuous seeded targets plus existing anon/cross-tenant arms. | Planned | NFR42; AC-B1a-2; R-1101 |
| 11.4-INT-002 | P0 | Generated command integration | For every seeded role × active capability boundary, execute at least one real denied command before validation/lookup/audit and prove no side effect. | Planned | NFR42; AC-B1a-2; R-1101/R-1102 |
| 11.4-INT-003 | P0 | DB/catalog integration | Agreement gate demonstrably fails on a deliberately drifted policy/matrix fixture and returns green only after alignment; real catalog rows match generated expectations. | Planned | NFR43; R-1101/R-1102 |
| 11.4-INT-004 | P0 | Route/read integration | Admin alone can query Roles/member counts/effective permissions; non-Admin, anonymous, missing target, and Tenant A→Tenant B requests are indistinguishable and reveal no data. | Planned | FR67/70/72; R-1104/R-1106 |
| 11.4-STATIC-001 | P0 | CI/static | Roles UI receives presentation DTOs only; server matrix/role authority cannot be imported by client paths or emitted in browser bundles. | Planned | FR67; R-1103 |
| 11.4-E2E-001 | P1 | E2E | Admin opens Roles and a multi-role user's Effective permissions, sees active-module rows, concrete entitlements, granting-role annotations and member counts; non-Admin cannot reach the route. | Planned | FR70/72; R-1104–R-1106 |
| 11.X-STATIC-001 | P1 | CI/static | Scope scans prove no custom role builder, DB permission table, tenant-wide Arbetsledare, client service-role path, public privileged endpoint, or Phase C surface lands with epic 11. | Planned/standing | FR129–130; project scope |

## NFR coverage and evidence plan

| NFR | Planned validation | Evidence for later `nfr-assess` |
| --- | --- | --- |
| Authorization / isolation | 11.4-UNIT-004/005, 11.4-INT-001/002/003/004, 11.4-STATIC-001; retain 11.1–11.3 security regressions. | Exact case manifest/cardinality; required Vitest report with zero skips; policy-catalog snapshot; containment output; Playwright report. |
| Sensitive-field confidentiality | Retain 11.2-INT-004/005 and extend generated enrollment when money-bearing modules activate. | Serialized payload assertions, direct/nested Data API and Storage negatives, recipient projection evidence, hosted smoke record where relevant. |
| Data integrity / audit | Retain multi-role FK/concurrency and admin lifecycle/audit tests; add 11.4-UNIT-003 count-state fixtures. | Migration reset, DB test logs, audit rows/correlation IDs, concurrent outcome record, count fixture snapshots. |
| Reliability | Retain operation replay/token tests; run 11.3-OPS-001 only when Auth email config changes. | Focused unit/DB results and Inbucket/controlled-smoke record; no exactly-once claim. |
| Maintainability / governance | Generated harness self-tests, sample activation bite proof, manifest/matrix/test enrollment coherence. | Unit/CI output showing red fixtures fail and real configuration passes. |
| Performance / scalability | Capture a pilot-scale query-count/latency and suite-duration baseline; thresholds remain **UNKNOWN**. | Baseline artifact with dataset shape, query count, duration, and environment; later owner threshold decision. |

## Execution strategy

- **PR:** Run P0 then P1 units/static checks; required DB/RLS/command suites with `SUPABASE_TEST_REQUIRED=1` and zero skips; focused Roles/effective-permissions Playwright against the configured production server. Keep the full registered functional suite on PR while total wall time remains under 15 minutes.
- **Nightly:** Run a larger deterministic role/member/module dataset baseline and full browser regression if PR duration grows beyond the target. Release-blocking generated authorization cases remain on PR.
- **Weekly or configuration-triggered:** Run the Auth email template/redirect transport smoke and dependency/security scans when their relevant configuration changes; do not turn a live mailbox into a routine test dependency.

## Remaining test-automation estimates

| Priority | Estimate | Scope |
| --- | --- | --- |
| P0 | ~28–45 hours | Generator/cardinality/coherence, complete role × table/capability DB and command cases, drift bite proof, route/tenant security, client containment. |
| P1 | ~14–24 hours | Role catalogue, counts/effective-permissions presentation, thin Admin/non-Admin E2E, scope regression. |
| P2 | ~4–10 hours | Conditional email transport smoke and secondary state/presentation cases. |
| P3 | ~2–5 hours | Pilot-scale performance/query-count baseline. |
| **Total** | **~48–84 hours** | Roughly 1–2 engineer/QA weeks depending on reuse of the existing 11.2 fixtures and review findings. |

## Quality gates

- P0 pass rate = 100%; P1 pass rate ≥95%; committed skips/todos/only markers in planned P0/P1 coverage count as failures.
- R-1101 and R-1102 must be mitigated before epic completion; every score ≥6 risk requires implemented mitigation, owner, and evidence.
- FR66–FR72, NFR42–NFR44, and AC-B1a-2/3 require 100% mapped automated scenario coverage; overall epic requirement coverage must be ≥80%.
- Generated case count must equal the independently computed expected role × active table/capability cardinality with unique non-vacuous identities; every active module/table/capability must trace to matrix and test enrollment.
- Required DB/RLS evidence runs with `SUPABASE_TEST_REQUIRED=1`, executes with zero skips, and includes a clean migration reset. Browser evidence uses the configured production web server.
- Roles/effective-permissions output contains active modules only, concrete N-4 entitlements, granting-role annotations, correct tenant-scoped counts, and no client authority import/bundle exposure.
- An evidence source is identified for every in-scope NFR category. Final NFR PASS/CONCERNS/FAIL remains deferred to `nfr-assess` after story 11.4 evidence exists.

## Step 5 — Output and Validation

- Mode: Create, epic-level, epic 11 (`epic-11`).
- Execution: Config `auto` resolved with subagent capability available; epic-level mode has one artifact and remained single-worker as required by the workflow.
- Output: `C:\DEV\ElproSaas\_bmad-output\test-artifacts\test-design-epic-11.md`.
- Risk result: 12 unique, correctly scored risks; R-1101 and R-1102 score 9 and block epic completion until mitigated.
- Gate result: P0 requires 100%, P1 at least 95%, zero required DB/RLS skips, and complete independently counted generated authorization coverage.
- Open assumptions: product must define membership states included in role member counts; performance/query/suite thresholds remain UNKNOWN.
- Validation: required epic-level sections present; 12 unique risk IDs with correct probability × impact; 35 unique prioritized scenario groups (28 P0, 5 P1, 1 P2, 1 P3); no template placeholders or trailing whitespace; no browser or managed-resource cleanup required.

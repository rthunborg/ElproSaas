---
runScope: 'epic-level'
runKey: 'epic-11'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-09-04T09:34:14.7815272Z'
detectedStack: 'frontend'
pact_mcp_reachable: false
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad-output/planning-artifacts/epics-phase-b.md'
  - '_bmad-output/planning-artifacts/prd-phase-b.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - '_bmad-output/test-artifacts/test-design-architecture.md'
  - '_bmad-output/auto-bmad/state/11-1-role-storage-and-permission-matrix-mechanism.yaml'
  - 'package.json'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - 'tests/README.md'
  - 'tests/factories/tenants.ts'
  - 'tests/integration/rls/tenant-table-inventory.ts'
  - 'tests/unit/server/read-models/entitlements.test.ts'
  - 'src/server/read-models/entitlements.ts'
  - 'src/server/auth/tenant-context.ts'
  - 'src/server/auth/resolve-tenant-context-core.ts'
  - 'src/scope/nav-registry.ts'
  - '.agents/skills/bmad-testarch-test-design/resources/tea-index.csv'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/library-integration-mandate.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/playwright-utils-mandate.md'
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

- Mode: Epic-level test design
- Named scope: epic 11
- Run key: `epic-11`
- Selection basis: the invocation explicitly requests the epic and its stories.

## Prerequisites

- Epic requirements and acceptance criteria: available in `_bmad-output/planning-artifacts/epics-phase-b.md`.
- Stories in scope: 11.1 through 11.4.
- Architecture context: available in `_bmad-output/planning-artifacts/architecture-phase-b.md` and `_bmad-output/planning-artifacts/architecture.md`.
- Existing checkpoint: none; this is a fresh run.

## Loaded context and current coverage

- Configuration: Playwright-utils and Pact.js-utils preferences are enabled; browser automation is `auto`; the test stack is `auto`; test artifacts resolve to `C:\DEV\ElproSaas\_bmad-output\test-artifacts`.
- Detected stack: frontend (`next`, React, `playwright.config.ts`). The repository also uses Supabase/Postgres through server modules and DB-backed integration tests, but no separate backend-language manifest matched the workflow's stack detector.
- Epic inputs: the complete epic 11 requirements (stories 11.1–11.4), FR66–FR72, NFR42–NFR44, AC-B1a-2/3, ADR-B001, the entitlement field-presence contract, and the per-role test-strategy extension.
- Existing lower-level seams: two-tenant factories, active/invited/disabled membership coverage, hardened `is_tenant_admin` helper tests, the manifest-derived H4 tenant-table inventory, generic entitlement projection tests, and the current manifest-only nav registry.
- Principal gaps: no `src/server/authz` matrix/capability implementation; tenant context remains single-role and admin-only; factories do not yet create seeded multi-role users; H4 has no role dimension; current RLS expectations are largely `is_tenant_admin`; no epic 11 admin-user-management or roles/effective-permissions UI tests exist.
- Known migration burden: existing unit/integration tests explicitly assert that only `tenant_admin` is accepted, non-admin memberships are denied, and the matrix coherence rule is absent. Epic 11 must replace those Phase A assertions without weakening tenant, anonymous, or service-role containment coverage.
- Test execution patterns: fast pure logic uses Node's test runner; DB/RLS integration uses Vitest against local Supabase with per-test unique fixtures; E2E uses Playwright against a production build and a serial shared fixture.
- Flakiness/feedback concerns: local DB suites skip when Supabase is unavailable unless `SUPABASE_TEST_REQUIRED=1`; Playwright is serial and rebuilds the application; therefore authorization proof belongs primarily in unit and DB/RLS suites, with thin E2E role journeys only.
- Browser exploration: skipped because neither `playwright-cli` nor Playwright MCP browser tools are available in this run. No session was opened.
- Playwright Utils: configuration intent is enabled, but `@seontechnologies/playwright-utils` is not installed. Its mandate therefore does not bind generated tests; this design does not invent imports. Framework adoption is deferred to a dedicated framework change if desired.
- Contract testing: no Pact package, pact directory, contract-test directory, Pact files, broker environment markers, OpenAPI/Swagger spec, or microservice boundary was found; contract tests are not relevant to epic 11.
- Pact broker: unreachable (SmartBear MCP tools not available). Provider states would be derived from readable server command/route source if a future contract surface is introduced; no provider states are required by this plan.

## Context reconciliation

- The epic header's older `Explicit non-scope` paragraph says `membership_roles` is reserved and N-4 unresolved, while the story acceptance criteria, PRD, ADR-B001, and current project instructions say N-4 is resolved and multi-role storage ships in story 11.1. This run follows the later, repeated N-4 contract and treats the stale paragraph as documentation drift.
- Story 11.4 still mentions displaying `väntar på ägarbeslut`; the current architecture and story 11.2 prohibit that placeholder because the entitlement seed is resolved. Tests should assert the concrete seed instead.

## Risk assessment

Scoring uses Probability × Impact on a 1–3 scale. Scores 6–8 require mitigation; score 9 blocks release until mitigated or formally waived.

| ID | Category | Risk | P | I | Score | Action | Mitigation | Owner | Timeline |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| R-1101 | SEC | Existing Phase A table policies and commands remain admin-only or are converted inconsistently, creating policy↔matrix drift that either over-grants a non-admin or silently blocks a granted role. | 3 | 3 | 9 | BLOCK | Generate role×table RLS positives/negatives and role×capability command denials from one matrix; add a policy↔matrix agreement gate and prove it fails against a deliberately drifted fixture. | Dev + QA | Stories 11.1–11.2, before each merge |
| R-1102 | SEC/DATA | Multi-role resolution is not union-correct or fail-closed: duplicate/cross-tenant child roles, inactive memberships, empty sets, or order-dependent role evaluation can grant authority incorrectly. | 2 | 3 | 6 | MITIGATE | Add schema constraints and composite tenant ownership; parameterize empty/single/multiple/duplicate/order permutations; prove a field is withheld only when no held role grants it and that inactive parent membership grants nothing. | Dev + QA | Story 11.1 |
| R-1103 | SEC | Prices, costs, margins, or derived aggregates leak to Montör/Säljare through a read-model, direct PostgREST query, export/PDF/email payload, error body, or client-shipped matrix. | 3 | 3 | 9 | BLOCK | Use RLS/module closure as the security floor, server projection for absent+listed fields, aggregate-honesty tests, crafted-query negatives, serialized-payload scans, and tests that the margin warning is non-invertible. | Dev + QA + Security reviewer | Story 11.2, before non-admin activation |
| R-1104 | SEC | Role downgrade, deactivation, invite revocation, or membership removal is not effective on the next authorized operation because a stale session/context/cache retains permissions. | 2 | 3 | 6 | MITIGATE | Exercise a session before and after mutation; assert the next command/read re-resolves current membership roles and returns the same generic denial without requiring re-login. | Dev + QA | Stories 11.2–11.3 |
| R-1105 | SEC | Supabase Auth admin/service authority becomes client-reachable, targets the wrong tenant/user, or exposes whether a foreign user exists. | 2 | 3 | 6 | MITIGATE | Keep Auth admin access in a server-only adapter; extend import/bundle containment checks; run cross-tenant and unauthenticated command negatives and compare generic error shapes. | Dev + QA + Security reviewer | Story 11.3 |
| R-1106 | DATA | Concurrent deactivate/downgrade/remove commands both pass a pre-check and leave a tenant without an active Företagsadmin. | 2 | 3 | 6 | MITIGATE | Enforce the invariant transactionally at the database boundary; run two concurrent conflicting commands and prove one fails with no partial membership or audit state. | Dev + QA | Story 11.3 |
| R-1107 | DATA/OPS | Invite, resend, revoke, reset, role-change, deactivate/reactivate, or removal commits without the required atomic audit evidence, or role/permission changes omit before/after values and required reason. | 2 | 3 | 6 | MITIGATE | Assert success+audit and injected-failure rollback for every action; validate ChangedBy/ChangedAt/CompanyId/RoleId/PreviousPermissions/NewPermissions/Reason and preserve correlation identifiers. | Dev + QA | Stories 11.2–11.3 |
| R-1108 | TECH | The reusable per-role generator or manifest coherence rule is incomplete, so future module activation can omit matrix rows/tests while CI remains green. | 2 | 3 | 6 | MITIGATE | Self-test generator cardinality and identity, derive from the manifest/matrix, reject unknown/unlisted surfaces, and include red/green fixtures for missing matrix row, missing test manifest entry, and drifted policy. | Dev + QA | Stories 11.1 and 11.4 |
| R-1109 | BUS/SEC | Stale contradictory planning prose is implemented instead of the ratified N-4 model (single role, conservative placeholder, or `väntar på ägarbeslut`), yielding the wrong production entitlements. | 2 | 3 | 6 | MITIGATE | Pin owner-confirmed role literals, multi-role union behavior, named capabilities, and money visibility in executable matrix fixtures; treat PRD/ADR/story AC as the current contract and fail snapshots on placeholder text. | Product + Dev + QA | Story 11.1 before seed freeze; Story 11.4 UI |
| R-1110 | OPS | The role×module×table×capability matrix expands the DB suite enough to become slow/flaky or silently skipped when local Supabase is unavailable, weakening feedback. | 2 | 2 | 4 | MONITOR | Keep pure lookup/cardinality logic in Node tests, DB facts in Vitest, and only thin role journeys in Playwright; require `SUPABASE_TEST_REQUIRED=1` in CI and publish per-layer duration/skips. | QA + DevOps | Story 11.4 / CI integration |
| R-1111 | PERF | Matrix-driven nav, landing, entitlements, and effective-permissions rendering regress at realistic tenant/user/module sizes; no epic-specific latency or volume threshold is defined. | 2 | 2 | 4 | MONITOR | Capture a deterministic pilot-scale baseline for matrix lookup and server render/query count; avoid making an invented latency a release gate until an owner threshold exists. | Architect + QA | Before epic 11 NFR assessment |
| R-1112 | REL/OPS | The membership/Auth invitation state machine diverges during partial Auth or database failure, or resend/revoke/reset retries create duplicate/ambiguous states. | 2 | 3 | 6 | MITIGATE | Specify command ordering/compensation, inject failures on both sides of the boundary, assert retry-safe terminal states and audit visibility, and use only local/test Auth identities. | Architect + Dev + QA | Story 11.3 before implementation sign-off |

### Highest-risk summary

- R-1101 and R-1103 are release-blocking because epic 11 changes the authorization boundary of every active Phase A module and turns existing sensitive-money seams on for non-admin roles.
- The next mitigation tier is multi-role correctness, immediate revocation, server-only Auth administration, last-admin concurrency, audit atomicity, and fail-loud generator governance.
- No risk is accepted or waived by this design. Scores must be reassessed after implementation evidence exists.

## NFR planning assessment

| NFR category | In-scope requirement / threshold | Planned evidence | Gap / linked risk |
| --- | --- | --- | --- |
| Security / tenant isolation | Every decision is server-enforced by command capability gate plus RLS. For every seeded role and active module: at least one denied command and one RLS negative. No unauthorized read/write or existence signal is permitted. | Matrix lookup units; command integration negatives; role×table RLS suite; anon/cross-tenant regressions; generic-error comparison; policy↔matrix agreement gate. | R-1101, R-1102, R-1104, R-1105, R-1108. |
| Sensitive-data confidentiality | Unentitled roles receive no protected value in any payload: field absent from data and listed in `entitlements.withheld`; aggregates with withheld components are also absent/listed. | Projection units; DB/RLS crafted-query negatives; serialized read-model/export payload assertions; browser checks for omitted/masked columns without client role lookup; non-invertible warning cases. | R-1103; export/email coverage applies when those recipient payloads exist. |
| Data integrity | A user holds at least one valid tenant role; held-role permissions form an order-independent union; `membership_roles` is unique per membership×role and tenant-consistent; at least one active admin remains. | Migration/constraint tests; property/table-driven union tests; disabled-parent tests; concurrent last-admin integration test; clean reset. | R-1102, R-1106. |
| Auditability / compliance | Every listed user-management action emits audit evidence; role/permission changes require ChangedBy, ChangedAt, CompanyId, RoleId, PreviousPermissions, NewPermissions, and non-empty Reason; success and audit commit atomically. | Per-command audit assertions; required-reason validation; fault-injection rollback; append-only audit regressions; UI Events-panel E2E smoke. | R-1107. Audit-retention duration is outside this epic and remains governed by the deferred full retention program. |
| Reliability | Deactivation/removal/role changes take effect immediately on the next server authorization decision; retry/failure behavior must not create contradictory membership/Auth states. | Same-session before/after integration tests; fault injection around Auth/database boundary; retry/resend/revoke state-machine tests. | Invitation expiry duration, resend rate/limit policy, and compensation semantics are **UNKNOWN** in the loaded requirements; R-1104/R-1112 track clarification and evidence. |
| Performance | Carried pilot-scale posture applies, but no epic-specific response-time, role-count, user-count, or query-count target is specified. | Non-gating baseline for matrix lookup, nav/landing derivation, effective-permissions render, and query count using a deterministic seeded tenant. | Thresholds are **UNKNOWN**; R-1111. Do not invent k6/SLA gates for this epic. |
| Scalability | New modules must add matrix rows and generated tests without respecifying existing modules; current seed is five tenant roles plus job-scoped Arbetsledare later. | Generator cardinality/identity self-tests; fixture with an added sample module; manifest activation red/green proof. | Maximum tenant-specific role compositions and long-term matrix size are **UNKNOWN**; structural growth is testable without a guessed volume target. |
| Maintainability / governance | Permission matrix is the single machine-readable source; same-change activation/rows/tests fail loud; no focused/skipped P0/P1 authorization cases in CI. | Type-level exhaustiveness; manifest coherence units; policy agreement; generator self-tests; suite discovery/skips report; scope scans. | R-1108/R-1110. |
| Accessibility / usability | Role-appropriate nav is hidden rather than disabled; direct routes remain protected; admin confirmations and warnings remain keyboard/role accessible under carried NFR30/31. | Thin Playwright journeys using accessible roles/names; deterministic server-level authority proof remains below UI. | No epic-specific accessibility conformance threshold is stated; use existing project quality gate rather than inventing one. |

## Clarification items carried into implementation

1. Define invitation expiry, resend throttling/deduplication, and the exact compensation/reconciliation behavior when Supabase Auth succeeds but the membership/audit transaction fails (or vice versa).
2. Define a pilot-scale dataset and observable latency/query-count target if epic 11 performance is intended to be release-gating; otherwise retain non-gating regression baselines.
3. Remove or supersede the stale epic-level non-scope/placeholder prose so future agents cannot select the pre-N-4 model.

## Coverage plan

The rows below are atomic scenario families. Generated role×module/table/capability families expand into many concrete cases but remain one design row because they share setup, oracle, and failure meaning. Test IDs follow `{epic}.{story}-{level}-{sequence}`.

### Story 11.1 — Role Storage and Permission-Matrix Mechanism

| Test ID | Priority | Level | Scenario / expected evidence | Requirement / risk |
| --- | --- | --- | --- | --- |
| 11.1-INT-001 | P0 | DB integration | Widen the `tenant_memberships.role` CHECK to exactly `tenant_admin`, `projektledare`, `montor`, `saljare`, `ekonomi`; reject unknown/job-scoped values; prove existing admin rows survive unchanged. | FR66; R-1102/R-1109 |
| 11.1-INT-002 | P0 | DB/RLS integration | `membership_roles` enforces one role per membership×role, composite same-tenant ownership, valid role literals, no cross-tenant child attachment, and no authenticated self-grant. | FR66; R-1102 |
| 11.1-UNIT-001 | P0 | Unit | Role-set permission evaluation is a union, order/duplicate invariant, and fail-closed for empty/unknown sets; every authorization API consumes `roles: Role[]`. | FR66–67; R-1102 |
| 11.1-UNIT-002 | P0 | Unit | Typed matrix contains the owner-named capability keys and seed roles exactly, has sensitive-field rows, and denies absent module/capability/role entries by default. | FR67–68; NFR43–44; R-1108/R-1109 |
| 11.1-UNIT-003 | P0 | Unit | `requireCapability` allows a union-granted action and rejects an ungranted/unknown action with stable `PERMISSION_DENIED`, identical safe messaging, and no existence detail. | FR67/72; R-1101/R-1102 |
| 11.1-INT-003 | P0 | DB integration | `has_tenant_role` returns correct results for active single/multi-role members and false for invited, disabled, no-row, cross-tenant, empty-allowed-role, and Arbetsledare-as-tenant-role probes. | FR66–67; NFR42–43; R-1101/R-1102 |
| 11.1-INT-004 | P0 | Security integration | `has_tenant_role` retains the hardened DEFINER shape: empty fixed search path, schema-qualified refs, `STABLE`, no PUBLIC/anon execute, and search-path hijack negative. | NFR42; R-1101 |
| 11.1-UNIT-004 | P0 | Unit | Manifest coherence rejects an active module with missing/incomplete matrix rows and preserves the existing fail-loud unlisted-surface behavior. | FR68/129; NFR43/51; R-1108 |
| 11.1-UNIT-005 | P0 | Unit | Tenant-context resolution returns membership-derived tenant plus full active role set, ignores client tenant IDs as authority, and no longer rejects valid non-admin roles. | FR66–67/72; R-1102/R-1104 |
| 11.1-INT-005 | P1 | Migration integration | Clean reset succeeds; legacy `is_tenant_admin()` semantics and its standing positives/negatives remain unchanged while new helpers/tables exist. | Story 11.1 coexistence; R-1101 |

### Story 11.2 — Non-Admin Access to the Phase A Surface

| Test ID | Priority | Level | Scenario / expected evidence | Requirement / risk |
| --- | --- | --- | --- | --- |
| 11.2-UNIT-001 | P1 | Unit | Manifest-active nav intersected with the matrix yields only role-granted items, hides denied items rather than disabling them, and never shows pending-module rows. | FR68/72; R-1109 |
| 11.2-UNIT-002 | P1 | Unit | `resolveLandingRoute(roleSet)` deterministically chooses an entitled route; Montör uses the current appropriate start seam and multi-role users get a valid union-derived landing. | FR72; Story 11.2 landing AC |
| 11.2-INT-001 | P0 | Command integration | Generated per-role×active-module×capability cases prove every denied boundary returns `PERMISSION_DENIED`, causes zero mutation/audit side effect, and does not reveal target existence. | NFR42; AC-B1a-2; R-1101 |
| 11.2-INT-002 | P0 | DB/RLS integration | Generated per-role×active-table cases prove allowed-path positives and denied SELECT/INSERT/UPDATE/DELETE beyond matrix and row scope; cross-tenant and anon arms remain green. | NFR42; AC-B1a-2; R-1101 |
| 11.2-INT-003 | P0 | DB/schema integration | Policy↔matrix agreement passes for the real schema and fails against a deliberately drifted policy/role-array fixture with a named mismatch. | NFR43; R-1101/R-1108 |
| 11.2-INT-004 | P0 | API/route integration | For each non-admin role, direct-route, crafted-command, and crafted-query attempts at a denied resource produce generic indistinguishable denials and zero foreign/hidden data. | FR67/72; R-1101 |
| 11.2-UNIT-003 | P0 | Unit | Exact role seed projects sensitive fields: Montör gets no sales/cost/margin; Säljare gets sales but no contribution margin by default; Projektledare/Ekonomi/Admin get full; Arbetsledare posture is reserved for job-scoped E16 use. | FR71; NFR44; R-1103/R-1109 |
| 11.2-UNIT-004 | P0 | Unit | Withheld fields are absent (not `null`/`0`) and listed; absent-unlisted remains genuinely empty; wholly withheld columns are omitted. | FR71; NFR44; R-1103 |
| 11.2-UNIT-005 | P0 | Unit | Any aggregate depending on a withheld component is itself absent+listed; counts/non-money values remain present and stored source input is not mutated. | NFR44; R-1103 |
| 11.2-RLS-001 | P0 | DB/RLS integration | Montör/Säljare cannot fetch protected Phase A rate/cost rows directly through PostgREST/RLS, even when bypassing the read-model; entitled roles can read only their tenant. | FR67/71; NFR42/44; R-1103 |
| 11.2-UNIT-006 | P0 | Unit | Multi-role sensitive-field evaluation grants a field if any held role is entitled and withholds it if none is; order/duplicates do not change the result. | FR66/71; R-1102/R-1103 |
| 11.2-INT-005 | P0 | Read-model integration | The same tenant data projected for entitled and unentitled roles changes only field presence/descriptor, never persisted öre values, counts, hit rate, or calculations. | FR71; Story 11.2 money impact; R-1103 |
| 11.2-UNIT-007 | P0 | Unit | Säljare low-margin protection returns only a server-computed boolean plus approved threshold label; varying inputs cannot reveal cost, margin amount, or an invertible derived value. | ADR-B001 §3.3A; R-1103 |
| 11.2-INT-006 | P0 | Serialization integration | Existing read-model, quote PDF/export, and any activated recipient-payload builder use the recipient projection; serialized payloads contain no withheld path/value or hidden aggregate. | FR71; NFR44/47; R-1103 |
| 11.2-E2E-001 | P1 | E2E | Each seeded tenant role signs in and sees its expected landing/nav and one representative granted surface; denied nav is absent. This proves UX wiring only, not authority. | FR72; AC-B1a-2 |
| 11.2-INT-007 | P0 | Auth integration | Invited/disabled/no-membership/empty-role users cannot enter the app or regain a prior role surface; denial text is indistinguishable and safe. | FR66/72; R-1102/R-1104 |
| 11.2-STATIC-001 | P0 | CI/static | Client-reachable modules do not import the permission matrix as authority or receive protected values for display math; service-role containment remains green. | FR67/71; R-1103/R-1105 |

### Story 11.3 — Admin User Management

| Test ID | Priority | Level | Scenario / expected evidence | Requirement / risk |
| --- | --- | --- | --- | --- |
| 11.3-INT-001 | P0 | Command/Auth integration | Admin invite validates tenant and role set, creates one `invited` membership plus role children, invokes the server-only local Auth adapter, and commits a correlated audit event. | FR69; AC-B1a-3; R-1105/R-1107/R-1112 |
| 11.3-INT-002 | P1 | Command/Auth integration | Resend targets only a valid outstanding invite, creates no duplicate membership/role rows, records audit, and returns a deterministic state on retry. | FR69; R-1107/R-1112 |
| 11.3-INT-003 | P1 | Command/Auth integration | Revoke moves an outstanding invite to the sanctioned terminal state, blocks later activation/resend as specified, and audits the transition. | FR69; R-1107/R-1112 |
| 11.3-INT-004 | P1 | Command/Auth integration | Password reset is server-only, targets an own-tenant active/invited user as allowed, does not expose Auth lookup detail, and records audit. | FR69; R-1105/R-1107 |
| 11.3-INT-005 | P0 | Command/Auth integration | Deactivation preserves domain history, marks membership disabled, and makes the existing session fail on its very next protected read/command. | FR69/72; R-1104/R-1107 |
| 11.3-INT-006 | P1 | Command/Auth integration | Reactivation restores only the stored sanctioned role set, does not resurrect removed roles, and records a before/after audit event. | FR69–70; R-1102/R-1107 |
| 11.3-INT-007 | P0 | Command integration | Role change requires a non-empty reason, atomically updates the role set, writes complete previous/new permissions, and affects the next authorization decision. | FR69–70; NFR42; R-1104/R-1107 |
| 11.3-INT-008 | P0 | Command/DB integration | Membership removal uses archive/end semantics, preserves historical references and events, denies future access, and performs no hard delete of history. | FR69; R-1104/R-1107 |
| 11.3-INT-009 | P0 | Command/DB integration | Deactivate, downgrade, and remove each reject when targeting the last active Admin, leaving membership roles and audit state unchanged. | Story 11.3 last-admin AC; R-1106 |
| 11.3-INT-010 | P0 | Concurrency integration | Two concurrent operations against two remaining Admins cannot both commit; exactly one invariant-preserving outcome and its matching audit evidence survives. | Story 11.3 last-admin AC; R-1106 |
| 11.3-INT-011 | P0 | Generated command integration | Tenant A admin cannot invite/reset/deactivate/reactivate/re-role/remove Tenant B users; all actions return a generic denial with zero Auth, membership, or audit side effects. | FR67/69/72; R-1105 |
| 11.3-INT-012 | P0 | Fault-injection integration | Failure before/after Auth or membership/audit boundaries produces a specified recoverable state; retry does not duplicate membership, roles, external action, or audit. | Reliability; R-1112 |
| 11.3-STATIC-001 | P0 | CI/static | Auth admin/service-role adapter is server-only and cannot be imported from client paths or emitted in the client bundle; no privileged unauthenticated route is added. | Project security rules; R-1105 |
| 11.3-E2E-001 | P1 | E2E | Admin completes invite→status/action display→role edit/deactivate/reactivate/remove journey and sees each correlated entry in `Händelser`. | FR69–70; AC-B1a-3 |
| 11.3-COMP-001 | P2 | Component | Immediate-effect confirmations, `Inbjuden`/`Inaktiverad` markers, resend/revoke actions, history-preserved copy, and keyboard-accessible dialogs render from command state. | Story 11.3 UX AC |
| 11.3-INT-013 | P1 | State-machine integration | Once expiry/throttle semantics are clarified, boundary-time invite expiry and resend/revoke/reset retry cases follow the documented state machine without wall-clock sleeps. | R-1112; UNKNOWN threshold |

### Story 11.4 — Roles Surface, Effective Permissions, and Harness

| Test ID | Priority | Level | Scenario / expected evidence | Requirement / risk |
| --- | --- | --- | --- | --- |
| 11.4-COMP-001 | P1 | Component | Admin Roles view lists the five tenant roles with descriptions/member counts, shows only manifest-active module rows and concrete sensitive-field entitlements, and contains no unresolved placeholder text. | FR70; R-1109 |
| 11.4-COMP-002 | P1 | Component | Roles view explains Arbetsledare as a job-scoped designation and offers no tenant-wide assignment control. | FR66; NFR43; R-1102/R-1109 |
| 11.4-INT-001 | P0 | Read-model/component integration | Effective-permissions grid is server-derived, shows module×capability plus granting role(s), handles multi-role union, and omits pending modules. | FR70; R-1102/R-1108 |
| 11.4-INT-002 | P0 | Route/command integration | Every non-admin role is denied the Users/Roles surfaces and effective-permissions queries directly, regardless of hidden nav. | FR67/72; R-1101 |
| 11.4-UNIT-001 | P0 | Unit | Harness generator emits stable, unique cases with exact expected cardinality per seeded role×active table/capability and preserves anon/cross-tenant arms. | NFR42–43; R-1108/R-1110 |
| 11.4-UNIT-002 | P0 | Unit | A sample module activation fails for missing matrix rows or test-manifest enrollment and passes only when manifest, matrix, table metadata, policies, and generated tests are coherent. | FR68/129; NFR43/51; R-1108 |
| 11.4-INT-003 | P0 | DB/schema integration | Agreement suite demonstrably fails red on a deliberately drifted fixture and returns green after the policy/matrix fixture is aligned. | Story 11.4 harness AC; R-1101/R-1108 |
| 11.4-E2E-001 | P1 | E2E | Admin opens Roles and a user's Effective permissions, sees granting-role annotations and active-module rows; a non-admin cannot reach the route. | FR70/72 |

### Cross-cutting NFR and governance scenarios

| Test ID | Priority | Level | Scenario / expected evidence | Requirement / risk |
| --- | --- | --- | --- | --- |
| 11-X-CI-001 | P0 | CI gate | CI requires the local Supabase substrate (`SUPABASE_TEST_REQUIRED=1`), reports zero skipped/focused P0/P1 authorization cases, and fails if generated-case counts shrink unexpectedly. | NFR42; R-1110 |
| 11-X-STATIC-001 | P1 | CI/static | Scope scans prove no custom tenant role builder, DB permission tables, tenant-wide Arbetsledare, client service-role access, customer portal, self-serve signup, AI flow, or other Phase C surface lands. | Epic 11 non-scope; FR129–130 |
| 11-X-PERF-001 | P3 | Benchmark | Record non-gating pilot-scale baseline for matrix lookup, nav/landing derivation, effective-permissions rendering, and DB query count; compare against future runs. | R-1111; threshold UNKNOWN |
| 11-X-A11Y-001 | P2 | E2E/component | Users/Roles tables, dialogs, tabs, warnings, and status markers are keyboard reachable and expose stable accessible names/states at supported desktop and responsive widths. | Carried NFR30–31 |

### Duplicate-coverage guard

- Unit tests own deterministic matrix/union/projection/generator logic.
- DB/API integration owns constraints, RLS, command authority, audit atomicity, stale-session behavior, concurrency, and Auth-boundary failure modes.
- Component tests own rendered state/copy/accessibility without asserting server authority.
- E2E is intentionally thin: it proves role-specific wiring and the admin journey, while all authorization claims are made below the UI.

## NFR coverage and evidence plan

| Category | Planned validation | Evidence for later `nfr-assess` | Missing input treatment |
| --- | --- | --- | --- |
| Security / confidentiality | P0 matrix, command, RLS, generic-denial, direct-query, service-containment, and serialized-payload tests. | CI JUnit/results for generated role families; policy-agreement output; static containment logs; Playwright traces only for failed thin journeys. | None for the core authorization threshold; zero bypass/leak is explicit. |
| Data integrity / audit | Multi-role constraints, union properties, last-admin concurrency, archive-over-delete, success+audit and rollback cases. | Migration-reset log; Vitest results; captured audit rows/correlation IDs; concurrency outcome record. | Compensation ordering for Auth/database partial failure must be specified before 11.3-INT-012 can turn green. |
| Reliability | Same-session immediate revocation plus invite lifecycle retry/fault injection. | Deterministic injected-failure results and state-transition/audit snapshots. | Invite expiry/throttle durations are UNKNOWN; keep 11.3-INT-013 pending, do not guess. |
| Performance / scalability | Non-gating deterministic benchmark and generator cardinality test. | Baseline JSON/CI timing trend and query-count output. | No release SLO or volume target exists; treat as monitored R-1111 until clarified. |
| Maintainability / governance | Matrix/manifest/test-manifest coherence, stable generated IDs/counts, no skipped/focused security tests, hard-exclusion scans. | Unit/CI gate reports and deliberate red-fixture proof. | Playwright-utils flag is intent-only because the package is absent; this epic does not add the dependency. |
| Accessibility / usability | Role-oriented locators, keyboard/dialog/table/tab checks, correct hidden-vs-denied behavior. | Playwright/component results and failure trace/screenshots. | Use existing carried gate; no new numerical accessibility threshold is invented. |

## Execution strategy

- **PR:** all unit tests, migration/reset schema checks, all generated command/RLS authorization families, audit/last-admin/fault-injection tests, static containment/scope gates, and the two thin role/admin E2E journeys while total functional execution remains under 15 minutes. P0 authorization families may not be deferred merely because the matrix is large; optimize fixtures or shard them if the budget is exceeded.
- **Nightly:** full browser regression across every seeded role, repeat the generated authorization matrix with retry/flake reporting, and run broader serialization/leak scans.
- **Weekly:** clean-install/reset verification plus the non-gating pilot-scale performance/query-count baseline and suite-duration trend.

## Resource estimate

Generated matrix families expand the concrete case count beyond the 55 scenario rows; estimates include fixtures, local-Supabase data setup, and red/green harness demonstrations.

| Priority | Scenario rows | Estimate |
| --- | ---: | ---: |
| P0 | 38 | ~85–125 hours |
| P1 | 14 | ~35–55 hours |
| P2 | 2 | ~8–16 hours |
| P3 | 1 | ~3–6 hours |
| **Total** | **55** | **~131–202 hours** |

Expected delivery: roughly 3–5 engineer-weeks for one test engineer/developer, or 2–3 calendar weeks with disciplined parallel story ownership and shared fixtures. Estimates exclude fixing production defects exposed by the suites and resolving the unknown invitation/performance thresholds.

## Quality gates

- P0 pass rate: **100%**; no skip, quarantine, retry-only green, or waiver without named owner/expiry.
- P1 pass rate: **≥95%**, with every failure triaged and no security/tenant-isolation failure counted as an acceptable 5%.
- Requirement traceability: **100% of FR66–FR72, every story acceptance criterion, AC-B1a-2, and AC-B1a-3 mapped**; automation covers at least **80% of all planned scenario rows** and all P0/P1 rows.
- NFR42 gate: for every seeded tenant role and every active module, at least one denied command and one RLS negative, plus required allowed-path positives and unchanged cross-tenant/anon arms.
- R-1101 and R-1103 score-9 mitigations complete before any non-admin production activation; all score≥6 risks have executed evidence and an owner.
- Clean migration reset, matrix/manifest/policy/test-manifest agreement, last-admin concurrency, audit atomicity, service-role containment, and Phase C hard-exclusion scans are mandatory green gates.
- NFR evidence source is identified for every in-scope category. Final NFR PASS/CONCERNS/FAIL remains deferred to `nfr-assess` after implementation evidence exists.

## Completion report

- Mode: Create; epic-level; named scope `epic 11`; run key `epic-11`.
- Execution mode: the configured `auto` mode resolved to the current subagent worker. Epic-level generation remained single-worker by design, so no nested worker was launched.
- Output: `C:\DEV\ElproSaas\_bmad-output\test-artifacts\test-design-epic-11.md`.
- Risk outcome: 12 risks, including 10 score≥6 risks and two release-blocking score-9 risks (R-1101 policy↔matrix drift and R-1103 sensitive-money leakage). No risk was accepted or waived.
- Coverage outcome: 55 scenario families (38 P0, 14 P1, 2 P2, 1 P3), with range-based effort of ~131–202 hours.
- Gate outcome: P0 100%, P1 ≥95%, P2/P3 ≥90%; complete FR/AC traceability; ≥80% planned automation with all P0/P1 automated; all score≥6 risks mitigated or formally waived; score-9 risks closed before non-admin activation.
- Open assumptions: invitation expiry/throttle/compensation and epic-specific performance thresholds remain owner inputs; the design records them without inventing values.
- Validation: output path, template sections, risk IDs/scores, priority totals, NFR evidence plan, PR/Nightly/Weekly execution strategy, range estimates, quality gates, interworking, and placeholder removal were checked. No browser session or temporary artifact required cleanup.

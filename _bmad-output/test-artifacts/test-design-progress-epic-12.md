---
runScope: 'epic-level'
runKey: 'epic-12'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-09-17'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad-output/planning-artifacts/epics-phase-b.md'
  - '_bmad-output/planning-artifacts/prd-phase-b.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - '_bmad-output/test-artifacts/test-design-architecture.md'
  - '_bmad-output/test-artifacts/test-design-qa.md'
  - '_bmad-output/test-artifacts/test-design-epic-11.md'
  - 'src/scope/manifest.ts'
  - 'package.json'
  - 'playwright.config.ts'
  - 'tests/README.md'
  - 'tests/support/stack-gate.ts'
  - 'tests/factories/tenants/core.ts'
  - 'tests/integration/rls/tenant-table-inventory.ts'
  - 'tests/integration/rls/security-definer-search-path.rls.test.ts'
  - 'tests/integration/commands/quote-audit-rollback.int.test.ts'
  - '.agents/skills/bmad-testarch-test-design/resources/tea-index.csv'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/library-integration-mandate.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/playwright-utils-mandate.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/risk-governance.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/probability-impact.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/test-levels-framework.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/test-priorities-matrix.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/nfr-criteria.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/fixture-architecture.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/network-first.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/data-factories.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/test-quality.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/test-healing-patterns.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/selector-resilience.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/overview.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/playwright-cli.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/confidence-gate.md'
  - '.agents/skills/bmad-testarch-test-design/resources/knowledge/evidence-integrity.md'
---

# Test Design Progress — Epic 12

## Step 1: Detect Mode & Prerequisites

- Mode: Epic-Level
- Epic: Epic 12 — Tenant Provisioning and Onboarding
- Run scope: `epic-level`
- Run key: `epic-12`
- Requirements source: `_bmad-output/planning-artifacts/epics-phase-b.md` (epic and three stories with acceptance criteria)
- Architecture context: `_bmad-output/planning-artifacts/architecture-phase-b.md`
- Checkpoint disposition: Fresh run; no existing checkpoint was present.

## Step 2: Load Context & Knowledge Base

### Configuration and Stack

- `test_artifacts`: `_bmad-output/test-artifacts`
- `tea_use_playwright_utils`: enabled in configuration, but `@seontechnologies/playwright-utils` is not installed. The integration mandate therefore does not bind; no imports may be invented. Framework adoption remains a separate workflow concern.
- `tea_use_pactjs_utils`: enabled, but no Pact artifacts, Pact dependency, OpenAPI contract, broker markers, or microservice boundary were found. Contract testing is not relevant to Epic 12.
- `tea_pact_mcp`: configured as `mcp`; no broker probe is needed because contract testing is out of scope.
- `tea_browser_automation`: `auto`; `playwright-cli` is unavailable and no Playwright MCP browser surface is exposed, so live exploration was skipped without opening a session.
- Detected stack: frontend/full product surface (Next.js 16, React 19, Supabase, Node test runner, Vitest integration/RLS, Playwright browser E2E).

### Requirements and Architecture Extracted

- Epic 12 covers FR73–FR76, NFR54, AC-B1a-1, and AC-PH-3 through Stories 12.1–12.3.
- The privileged path is a single sanctioned `provision_tenant` SECURITY DEFINER RPC with fixed empty `search_path`, schema-qualified references, an internal `is_platform_operator()` gate, and PUBLIC revocation.
- Supabase Auth invitation stays in the server command/service context, never inside the RPC and never client-reachable.
- The command must be atomic, idempotent on organization identity, dry-runnable, audited with approver/new tenant identity, and safe after partial failure.
- `/operator/**` is shell-isolated from tenant context and exposes tenant identity/status/first-Admin state only.
- The onboarding checklist is derived server-side from existing settings, pricing, and membership state; only per-admin dismissal is stored.
- Public self-registration, additional DEFINER functions, tenant-business reads from the console, and new onboarding settings schema are explicit exclusions/stop conditions.
- Subscription/commercial values are tenant data and must not be hardcoded application logic.

### Existing Coverage and Patterns

- Inventory: 197 unit, 103 integration, 37 E2E, 10 factory, and 26 fixture files.
- Existing reusable patterns include per-call two-tenant fixtures, authenticated and anonymous clients, role-aware membership fixtures, DB-backed RLS suites, SECURITY DEFINER search-path negatives, audit rollback proofs, migration reset gates, static containment scans, and production-server Playwright.
- DB-backed evidence must use disposable local Supabase with `SUPABASE_TEST_REQUIRED=1`; required suites must report zero skips.
- Playwright runs serially with a shared seeded fixture and one CI retry. Existing flake lessons require `crypto.randomUUID()` for identity, deterministic waits, and explicit retry-safe fixtures.
- One existing hard wait and several intentionally skipped/fixme legacy browser cases are known suite concerns; Epic 12 coverage must not copy those patterns.
- Direct Epic 12 coverage is absent. Current references are limited to pending manifest metadata and its invariant test; no `platform_operators`, `provision_tenant`, `/operator`, `ALREADY_PROVISIONED`, or onboarding tests exist yet.

### Known Coverage Gaps

1. Platform-operator allow-list/RLS and hardened helper semantics.
2. Atomic provisioning, injected-failure rollback, idempotent replay, dry run, and audit completeness.
3. Forged/absent/non-operator/cross-tenant negative coverage on the privileged path.
4. Auth-admin invite separation, retry/reconciliation, and service-role containment.
5. Operator route/read-model authorization, tenant-shell isolation, and field-absence proof for business data.
6. Wizard interruption/re-entry and `ALREADY_PROVISIONED` presentation.
7. Server-derived onboarding item truth, dismissal/restoration, tenant isolation, and full provisioning-to-working-state proof.
8. Negative scope scan proving no public signup route/copy and no hardcoded commercial prices.

### Confidence

- Confidence: 9/10.
- Rationale: Epic/story acceptance criteria, Phase B PRD/architecture, manifest state, test inventory, and repository test patterns provide direct evidence for scope, risks, levels, and harness choices.
- Unknowns: final implementation paths and DTO names do not yet exist; test IDs and behavioral contracts can be planned, but selectors/endpoints must be resolved from the eventual story implementation rather than invented now.

## Step 3: Risk and NFR Assessment

### Risk Scoring Model

- Probability: 1 unlikely, 2 possible, 3 likely.
- Impact: 1 minor, 2 degraded/manual recovery, 3 critical security, isolation, or product-delivery failure.
- Score = probability × impact. Scores 6–8 require mitigation; score 9 blocks completion until mitigated or formally waived.
- Test priority remains a separate business/security judgment and is not mechanically derived from the score.

### Risk Matrix

| ID | Category | Risk | P | I | Score | Action | Mitigation | Owner | Timeline |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| R-1201 | SEC | `provision_tenant` or `is_platform_operator()` is mis-hardened, allowing privilege escalation through search-path, grants, caller claims, or a missing internal operator check. | 2 | 3 | 6 | MITIGATE | Pin catalog/grant/search-path shape, prove forged/absent/non-operator denial, and require zero side effects before positive provisioning evidence. | Dev + QA + Security reviewer | Story 12.1 before merge |
| R-1202 | DATA | The DB transaction succeeds but the server-side Auth invite fails or its result is lost, leaving a partially provisioned tenant that cannot be safely resumed. | 3 | 3 | 9 | BLOCK | Define durable provisioning states and a retry/reconciliation contract; inject failure at each boundary and prove no duplicate tenant/membership/invite or misleading success. | Dev + QA | Story 12.1 before any operator UI depends on it |
| R-1203 | DATA | Repeated or concurrent requests for the same organization identity create duplicate tenants or first-Admin memberships. | 2 | 3 | 6 | MITIGATE | Enforce a normalized durable idempotency key/constraint and test sequential, concurrent, and response-loss replay returning `ALREADY_PROVISIONED`. | Dev + QA | Story 12.1 before merge |
| R-1204 | SEC | Operator console/read models expose tenant customers, quotes, prices, files, or other business data beyond identity/status/first-Admin state. | 2 | 3 | 6 | MITIGATE | Use an explicit allow-listed DTO/projection; assert exact field absence and attempt cross-tenant/business-table probes through every console read entry. | Dev + QA + Security reviewer | Story 12.2 before merge |
| R-1205 | SEC | Authorization is enforced only by the operator layout/navigation, allowing direct route/server-action access by tenant users or anonymous callers. | 2 | 3 | 6 | MITIGATE | Gate every server entry independently with platform-operator authority; enumerate direct reads/actions for operator, tenant roles, orphan, and anonymous identities with indistinguishable denials. | Dev + QA | Story 12.2 before merge |
| R-1206 | SEC | Auth-admin/service credentials or invitation capability become reachable from client code, the RPC, or an unauthenticated handler. | 2 | 3 | 6 | MITIGATE | Keep Auth admin operations in a server-only adapter and extend source/bundle/service-role containment bite proofs; assert the RPC has no Auth responsibility. | Dev + Security reviewer | Story 12.1 before merge |
| R-1207 | BUS | The server-derived checklist marks a tenant complete while required settings, pricing, quote terms, work roles, or invited users remain incomplete. | 2 | 3 | 6 | MITIGATE | Define one falsifiable completion predicate per item, with incomplete/complete boundary fixtures and an end-to-end working-state proof that asserts persisted state, not clicks. | Product + Dev + QA | Story 12.3 before merge |
| R-1208 | SEC | Provisioning, errors, or the audit summary reveal whether foreign tenants/users/organization identities exist, or carry data from tenant Y into tenant X. | 2 | 3 | 6 | MITIGATE | Use stable generic denial/conflict envelopes; seed two independent tenants and assert field/value absence, unchanged foreign-row digests, and tenant-bound audit rows. | Dev + QA + Security reviewer | Stories 12.1–12.2 |
| R-1209 | BUS | Public signup surface or hardcoded commercial prices/discounts slip into the feature despite FR76/N-2. | 2 | 3 | 6 | MITIGATE | Add fail-loud route/copy/import scans and hardcoded-commercial-value guardrails; prove subscription fields are input data persisted per tenant. | Product + Dev + Scope reviewer | Across Epic 12; gate before epic completion |
| R-1210 | OPS | Audit records omit approver/request correlation/outcome, or survive when the governed DB action rolls back, making provisioning untraceable. | 2 | 2 | 4 | MONITOR | Assert audit atomicity for DB work, correlation across invite attempts, one terminal outcome per attempt, and new tenant binding without secrets. | Dev + QA | Story 12.1 |
| R-1211 | TECH | Wizard resume state is inferred from browser clicks rather than durable server state, causing stale or impossible steps after refresh/failure/replay. | 2 | 2 | 4 | MONITOR | Derive the current step from server provisioning state; cover reload, new session, failure, success, and `ALREADY_PROVISIONED` transitions. | Dev + QA | Story 12.2 |
| R-1212 | OPS | The end-to-end proof becomes flaky or destructive because it shares global fixture state, depends on external email delivery, or leaves platform/tenant/Auth records behind. | 2 | 2 | 4 | MONITOR | Extend unique cleanup-aware local factories; assert local Auth state directly or through controlled Inbucket only when transport is in scope; reconcile executed/skip counts. | QA + Dev | Stories 12.1–12.3 |
| R-1213 | PERF | Provisioning/console latency and supported tenant scale have no numeric threshold, so performance cannot receive an objective release verdict. | 1 | 2 | 2 | DOCUMENT | Record query counts and elapsed baselines at a documented pilot dataset; keep release thresholds UNKNOWN until the owner defines scale/SLO. | Product + Architect + QA | Baseline during Epic 12; threshold before scale commitments |

### NFR Planning Assessment

| NFR category | In-scope requirement / threshold | Planned evidence | Current planning status |
| --- | --- | --- | --- |
| Security / tenant isolation | NFR54: zero cross-tenant leakage on the provisioning path; non-operators/forged or absent claims denied; console exposes identity/status/first-Admin state only. | DB/RLS/catalog negatives, command/read-model integration, exact field-absence assertions, direct-route E2E, service-role/source/bundle scans, unchanged foreign-row digest. | Defined and measurable. |
| Security / privileged DB | Exactly one new sanctioned DEFINER write surface (`provision_tenant`); fixed empty `search_path`, schema-qualified refs, explicit operator check, PUBLIC revoked. | Function catalog/grant inspection, search-path hijack bite proof, non-operator/anon direct RPC attempts, additional-DEFINER inventory gate. | Defined and measurable. |
| Reliability | Atomic DB creation; idempotent re-run; safe recovery after partial failure; dry run writes nothing; success only after server-confirmed persisted state. | Fault injection at transaction/Auth/audit boundaries, concurrent replay, response-loss retry, before/after database snapshots, durable status transition tests. | Required; the exact DB/Auth reconciliation state machine is not yet implemented and must be explicit in Story 12.1. |
| Data integrity | One tenant and first-Admin membership per organization identity; baseline/subscription values persisted as request data; no duplicate or cross-tenant mutation. | Unique-constraint/concurrency tests, normalized identity boundary cases, persistence assertions, cross-tenant row digests. | Defined at outcome level; normalization rules for organization identity are UNKNOWN until the story contract chooses them. |
| Audit/compliance | Every action records new tenant, actor/approver, request correlation, outcome, and deviations without credentials/secrets. | Audit integration assertions, rollback tests, retry correlation, log/DOM/response secret scans. | Required; retention duration and operational audit SLO are outside this epic and remain UNKNOWN. |
| User journey / truthfulness | AC-B1a-1 and AC-PH-3: second tenant goes create → baseline → invite → onboarding working state with zero engineering steps. | One thin automated end-to-end proof over real local persistence, plus lower-level predicates for every checklist item and wizard transition. | Defined and measurable once the story supplies stable UI/server contracts. |
| Maintainability / scope | Operator territory remains shell-isolated; checklist adds no new table; no public signup; commercial values remain data; manifest activation and guards change in the same implementation PR. | Import/static scans, schema/table inventory, manifest coherence, route/copy scan, hardcoded-value fixtures, migration reset. | Defined and measurable. |
| Performance / scalability | No response-time, concurrency, tenant-count, or invite-throughput threshold is specified. | Non-gating elapsed/query-count baseline with dataset size recorded; no invented pass/fail threshold. | UNKNOWN; record baseline and raise for owner decision if scale gating becomes necessary. |

### Highest-Risk Summary

1. **R-1202 (score 9)** is the completion blocker: database provisioning and Auth invitation cross a non-transactional system boundary. The feature needs explicit durable recovery semantics and fault-injection evidence.
2. **R-1201/R-1203/R-1204/R-1205/R-1206/R-1208 (score 6)** protect the privileged operator boundary against escalation, duplication, data exposure, direct-route bypass, and service-role leakage.
3. **R-1207 (score 6)** protects the business acceptance claim: onboarding completion must be derived from persisted domain state and be falsifiable item by item.
4. **R-1209 (score 6)** prevents the two explicit product-scope regressions: public signup and hardcoded commercial pricing.
5. Final NFR verdicts are intentionally deferred to `nfr-assess`; this workflow defines evidence and thresholds only.

## Step 4: Coverage Plan and Execution Strategy

### Coverage Design Principles

- Exercise pure normalization, validation, wizard-state, and checklist predicates at unit level.
- Exercise durable state, transactionality, grants, RLS, audit, Auth-boundary reconciliation, and tenant isolation against disposable local Supabase.
- Use static/catalog guardrails for forbidden imports, extra DEFINER functions, public signup, schema drift, and hardcoded commercial terms.
- Keep browser coverage thin: prove authorization and resumability once, then prove the full operator-to-first-Admin outcome once. Do not repeat lower-level permutations in E2E.
- Every P0/P1 scenario must be falsifiable, have explicit assertions in the test body, use unique cleanup-aware fixtures, and execute with zero required skips.

### Story 12.1 — Platform Operator Identity and Provision-Tenant Command

| Test ID | Priority | Level | Atomic scenario | Risk / requirement |
| --- | --- | --- | --- | --- |
| 12.1-UNIT-001 | P0 | Unit | The provisioning request validator accepts the documented structured fields, rejects missing/contradictory values, and never accepts generated SQL/free-text authority. | FR73/76; AB-A19; R-1201 |
| 12.1-UNIT-002 | P0 | Unit | Organization identity normalization produces the same idempotency identity for documented equivalent inputs and distinct identities for non-equivalent organizations. | FR76; R-1203 |
| 12.1-UNIT-003 | P0 | Unit | Provisioning-state/reconciliation transitions cover validated, previewed, approved, DB-created, invite-pending/failed/sent, completed, and already-provisioned without impossible success states. | FR73/76; R-1202 |
| 12.1-INT-001 | P0 | DB/RLS integration | `platform_operators` has the required columns; an operator can self-read only its row while tenant users, orphan users, and anonymous callers cannot enumerate the allow-list. | Story 12.1 AC1; R-1201 |
| 12.1-INT-002 | P0 | DB/catalog integration | `is_platform_operator()` and `provision_tenant` have fixed empty `search_path`, schema-qualified behavior, correct owner/grants, PUBLIC revocation, and no caller-claim bypass; a deliberate hijack object does not alter behavior. | Story 12.1 AC1/2; R-1201 |
| 12.1-INT-003 | P0 | Command/DB integration | An approved operator request atomically creates one tenant, baseline settings/subscription data, first-Admin invited membership, provisioning state, and tenant-bound audit records with the exact persisted values. | FR73/75; AC-B1a-1; R-1202 |
| 12.1-INT-004 | P0 | Fault-injection integration | Failure at each in-transaction write point rolls back tenant, baseline, membership, and audit together; no partial row remains. | FR76; R-1202/R-1210 |
| 12.1-INT-005 | P0 | Command/DB integration | Dry run returns a complete deterministic preview and performs zero DB/Auth/audit writes; approval identity is required before the real command. | FR76; architecture §15.4A |
| 12.1-INT-006 | P0 | Command/DB integration | Sequential re-run for the same organization returns stable `ALREADY_PROVISIONED` state and existing identity without duplicating tenant, settings, membership, or audit completion. | Story 12.1 AC3; R-1203 |
| 12.1-INT-007 | P0 | Concurrency integration | Two concurrent same-identity requests produce one tenant and one first-Admin membership/invite intent; one winner and one deterministic already-provisioned/reconciled result. | FR76; R-1203 |
| 12.1-INT-008 | P0 | Command/Auth-boundary integration | Auth invite failure after DB commit leaves an explicit recoverable state; retry/reconciliation sends at most one effective invite and completes without duplicating DB state. | FR76; R-1202 |
| 12.1-INT-009 | P0 | Command/Auth-boundary integration | Lost command response followed by replay reconciles persisted state and returns the same tenant/outcome without a second invite or terminal audit. | FR76; R-1202/R-1210 |
| 12.1-INT-010 | P0 | Authorization integration | Tenant Admin, every non-Admin role, orphan, anonymous, forged/absent operator claims, and direct RPC calls receive generic denial before validation/lookup/audit and cause zero side effects. | NFR54; R-1201/R-1205/R-1208 |
| 12.1-INT-011 | P0 | Tenant-isolation integration | Provisioning tenant X cannot read or modify seeded tenant Y; before/after digests of Y business/membership/settings rows are unchanged and errors reveal no foreign identity. | FR75; NFR54; AC-PH-3; R-1208 |
| 12.1-INT-012 | P0 | Audit integration | Success, already-provisioned, recoverable invite failure, and terminal failure correlate actor, approver, request, new tenant, and outcome without credentials, tokens, or raw sensitive request content. | FR75/76; R-1210 |
| 12.1-STATIC-001 | P0 | CI/static/catalog | Exactly the sanctioned Epic 12 DEFINER surfaces exist; Auth-admin/service-role imports stay server-only and no unauthenticated privileged handler or client bundle marker is introduced. | Architecture §14; R-1201/R-1206 |
| 12.1-INT-013 | P0 | Migration reset | Empty local DB reset succeeds; platform-scoped objects, grants, constraints, indexes, and provisioning columns match the expected catalog and are enrolled in the correct inventories. | Story 12.1 test requirements; R-1201/R-1203 |

### Story 12.2 — Operator Console

| Test ID | Priority | Level | Atomic scenario | Risk / requirement |
| --- | --- | --- | --- | --- |
| 12.2-UNIT-001 | P0 | Unit/read-model | Console projection returns an exact allow-list of tenant name/identity, status, created timestamp, and first-Admin state; injected customer/quote/file/money fields are discarded or rejected. | Story 12.2 AC3; NFR54; R-1204 |
| 12.2-UNIT-002 | P1 | Unit | Wizard step derivation is server-state-driven and deterministic across fresh, validated, approved, invite-pending/failed/sent, completed, and already-provisioned states. | Story 12.2 AC2; R-1211 |
| 12.2-INT-001 | P0 | Route/read-model integration | Every console query/action independently authorizes an allow-listed operator; all tenant roles, orphan, anonymous, and missing/forged identities get the same generic denial with zero data/side effects. | Story 12.2 AC1; R-1205/R-1208 |
| 12.2-INT-002 | P0 | Read-model security integration | Console entry points cannot select or serialize tenant business data, including nested/aliased fields; seeded canaries from tenant A and B never appear in values, keys, errors, or audit summary. | NFR54; R-1204/R-1208 |
| 12.2-STATIC-001 | P0 | CI/static | `src/app/operator/**` imports no tenant AppShell/context/nav registry; tenant nav has no operator entry; each route/server entry calls the operator gate rather than relying on layout-only authorization. | Story 12.2 AC1/notes; R-1205 |
| 12.2-E2E-001 | P1 | E2E | Operator sees the isolated console and exact identity/status columns; tenant Admin and anonymous direct navigation see generic denial and no tenant shell or business-data canary. | Story 12.2 AC1/3; R-1204/R-1205 |
| 12.2-E2E-002 | P1 | E2E | An interrupted wizard resumes from persisted server state after reload/new browser context; replay renders `ALREADY_PROVISIONED` and never presents a duplicate-create success. | Story 12.2 AC2; R-1202/R-1203/R-1211 |
| 12.2-E2E-003 | P2 | E2E/accessibility | The three wizard steps expose semantic headings, labels, validation summaries, focus movement, disabled/submitting state, and keyboard completion without relying on brittle CSS selectors. | UX-BDR6/17; maintainability |

### Story 12.3 — First-Admin Onboarding Checklist

| Test ID | Priority | Level | Atomic scenario | Risk / requirement |
| --- | --- | --- | --- | --- |
| 12.3-UNIT-001 | P0 | Unit | Parameterized predicate tests prove each of the five items is incomplete at its exact missing boundary and complete only from authoritative persisted settings/pricing/role/membership state. | Story 12.3 AC1; R-1207 |
| 12.3-UNIT-002 | P0 | Unit | Aggregate working-state becomes complete only when all five predicates are complete; display order/labels/deep-link targets are stable and pending/foreign state cannot satisfy an item. | FR74; AC-B1a-1; R-1207/R-1208 |
| 12.3-UNIT-003 | P1 | Unit | Dismissal hides only presentation state; incomplete work remains incomplete, completion remains server-derived, and a reminder can restore the checklist. | Story 12.3 AC4; R-1207 |
| 12.3-INT-001 | P0 | Read-model/RLS integration | First Admin reads only its tenant's derived checklist; a tenant A state change affects only A, while tenant B canaries and completion remain invisible and unchanged. | FR74/75; NFR54; R-1207/R-1208 |
| 12.3-INT-002 | P1 | Command/DB integration | Per-admin dismissal/resume persists independently for two Admins, is auditable where required, and cannot mark an item or tenant working-state complete. | Story 12.3 AC4; R-1207 |
| 12.3-E2E-001 | P0 | E2E | Full second-tenant proof: operator previews/approves/provisions, first Admin is invited and signs in, completes real settings/pricing/user state through deep links, checklist turns green from server-confirmed persistence, and tenant A remains unchanged. | FR73–75; NFR54; AC-B1a-1; AC-PH-3 |
| 12.3-E2E-002 | P1 | E2E | Dismissed incomplete checklist stays hidden after reload, the reminder restores it, deep links reach the real surfaces, and completion never follows clicks without persisted state. | Story 12.3 AC1/4; R-1207 |
| 12.3-STATIC-001 | P0 | CI/static/scope | No public signup/register route, nav, copy, or API ships; provisioning remains operator-driven and no privileged public surface is added. | FR76; R-1209 |
| 12.3-STATIC-002 | P0 | CI/static/schema | Epic 12 adds no onboarding checklist table or new settings schema, and subscription prices/discounts/limits are not hardcoded in application logic or UI defaults. | Story 12.3 stop condition; N-2; R-1209 |
| 12.3-INT-003 | P1 | Migration/manifest integration | The provisioning module activation, platform-scope metadata, catalog expectations, and guardrail derivations become coherent in the same implementation change without adding tenant-table/nav surfaces that do not exist. | FR129/130; manifest governance |

### NFR Coverage and Evidence Plan

| Category | Planned validation | Evidence for later `nfr-assess` |
| --- | --- | --- |
| Security / isolation | 12.1-INT-001/002/010/011, 12.1-STATIC-001, 12.2-INT-001/002, 12.2-STATIC-001, 12.3-INT-001, 12.3-E2E-001. | Vitest report with executed/pass/skip counts, DB catalog/grant snapshot, containment/scope-scan logs, Playwright HTML/trace, seeded-canary absence assertions. |
| Reliability / recovery | 12.1-UNIT-003, 12.1-INT-004/006–009, 12.2-E2E-002. | Fault-injection and concurrency test output, before/after row counts/digests, attempt correlation records, retry/reconciliation assertions. |
| Data integrity | 12.1-UNIT-002, 12.1-INT-003/006/007/011/013. | Constraint/catalog evidence, concurrency run output, normalized-identity fixtures, tenant/membership/settings row snapshots. |
| Audit/compliance | 12.1-INT-003/004/005/009/012. | Audit-event assertions keyed by correlation/tenant/actor/approver, rollback evidence, secret/token absence scan. |
| Maintainability/scope | 12.1-STATIC-001, 12.2-STATIC-001, 12.3-STATIC-001/002, 12.3-INT-003. | CI scan outputs, manifest coherence and migration-reset reports, discovered-versus-executed test inventory. |
| User journey | 12.2-E2E-001/002 and 12.3-E2E-001/002. | Production-server Playwright report, retained trace on failure, server-persistence assertions, zero cross-tenant delta proof. |
| Performance/scalability | Record non-gating command/read query counts and elapsed times at one documented pilot dataset. | Versioned baseline with dataset size/environment; threshold remains UNKNOWN and cannot receive PASS until owner-defined. |

### Execution Strategy

- **PR:** Run all Epic 12 unit/static/catalog tests; required Vitest DB/RLS/command/fault-injection suites with `SUPABASE_TEST_REQUIRED=1` and zero skips; focused production-server Playwright for 12.2/12.3. Keep the complete functional lane under 15 minutes; shard only if the measured wall time requires it.
- **Nightly:** Burn-in the concurrent idempotency, response-loss/reconciliation, and complete Epic 12 browser journeys across repeated unique fixtures when their repetition would exceed the PR budget.
- **Weekly or scale-triggered:** Record the pilot-dataset query/elapsed baseline and run larger tenant-list/concurrency samples. No performance gate is asserted until an owner provides a threshold.
- External email delivery is not a routine dependency for this epic. Assert controlled local Auth/invite state; use a hosted transport smoke only when Auth template/redirect configuration changes and record it separately.

### Resource Estimates

| Priority | Scenario groups | Estimated effort | Main work |
| --- | ---: | --- | --- |
| P0 | 26 | ~60–95 hours | Privileged DB/catalog/RLS harness, state/fault injection, concurrency/replay, isolation canaries, static guardrails, full journey fixture. |
| P1 | 8 | ~24–40 hours | Wizard/checklist presentation logic, route/browser journeys, dismissal/resume, manifest integration. |
| P2 | 1 | ~4–8 hours | Wizard accessibility and keyboard coverage. |
| P3 | 1 baseline | ~3–6 hours | Pilot-scale query/latency baseline without a release threshold. |
| **Total** | **36 groups** | **~91–149 hours** | Approximately 2.5–4 person-weeks depending on reuse of Epic 11 Auth fixtures and the complexity of fault injection/reconciliation. |

### Entry Criteria

- Epic 11 role, invitation, callback, and admin-user lifecycle seams are present and green.
- Story 12.1 defines the normalized organization identity, durable provisioning states, dry-run result, approval identity, and Auth invite reconciliation contract.
- Disposable local Supabase can reset from empty and required integration suites run with `SUPABASE_TEST_REQUIRED=1`.
- Test-only operator/two-tenant/first-Admin factories have explicit cleanup and never target the hosted demo.
- Every eventual browser selector and server entry path is resolved from implemented code; none is invented from this plan.

### Quality Gates

- P0 pass rate: 100%.
- P1 pass rate: at least 95%; every failure has a triaged owner and no security/isolation failure may be waived by this percentage.
- Required DB/RLS/command/browser skips: 0. Executed counts must reconcile with discovered planned files/cases.
- R-1202 (score 9) is mitigated with green fault-injection/reconciliation evidence before Epic 12 completion.
- Every score-6 risk has implemented mitigation and linked automated evidence, or a formal time-bounded owner waiver.
- FR73–FR76, NFR54, AC-B1a-1, AC-PH-3, and every story acceptance criterion have 100% mapped scenario coverage; overall planned requirement coverage is at least 80%.
- Security/tenant-isolation and privileged-path coverage target: 100% of enumerated identities, server entries, grants, and sanctioned DEFINER surfaces.
- No public signup surface, tenant-business operator read, client-reachable Auth admin/service role, extra DEFINER function, new onboarding table/settings schema, or hardcoded commercial pricing.
- NFR evidence source is identified for every in-scope category. Final PASS/CONCERNS/FAIL is deferred to `nfr-assess` after implementation evidence exists.

## Step 5: Generate Output and Validate

- Mode: Epic-level create for Epic 12.
- Execution mode: configuration `auto` resolved to available subagent capability, but epic-level mode has one output and remains single-worker by default.
- Final output: `_bmad-output/test-artifacts/test-design-epic-12.md`.
- Completed: `2026-09-17T15:37:05+02:00`.
- Risk summary: 13 risks; 9 high (score ≥6); R-1202 is the single score-9 completion blocker.
- Coverage: 36 unique atomic groups (P0 27, P1 7, P2 1, P3 baseline 1).
- Gates: P0 100%, P1 ≥95%, required skips 0, all high-risk mitigations complete or formally waived, full privileged-path/tenant-isolation enumeration.
- Open planning assumptions: organization-identity normalization and DB/Auth recovery states must be explicit in Story 12.1; performance/scale threshold remains UNKNOWN.
- Validation: workflow checklist reviewed; required sections present; 36 unique test IDs; 13 risk scores verified; no template placeholders; markdown diff check clean; browser/temp/resource cleanup not applicable because none was opened or created.

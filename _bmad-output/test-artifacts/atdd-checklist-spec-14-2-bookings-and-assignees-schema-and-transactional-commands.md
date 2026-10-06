---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-10-06'
storyId: '14.2'
storyKey: 'spec-14-2-bookings-and-assignees-schema-and-transactional-commands'
storyFile: '_bmad-output/implementation-artifacts/spec-14-2-bookings-and-assignees-schema-and-transactional-commands.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-spec-14-2-bookings-and-assignees-schema-and-transactional-commands.md'
generatedTestFiles:
  - 'tests/integration/commands/bookings.int.test.ts'
  - 'tests/integration/rls/bookings.rls.test.ts'
pact_mcp_reachable: false
workflowType: 'testarch-atdd'
primary_level: 'integration'
requestedExecutionMode: 'auto'
resolvedExecutionMode: 'subagent'
capabilityProbe: true
inputDocuments:
  - 'AGENTS.md'
  - 'docs/process/agent-model-routing.md'
  - 'docs/process/local-setup.md'
  - 'docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md'
  - '_bmad-output/implementation-artifacts/spec-14-2-bookings-and-assignees-schema-and-transactional-commands.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/test-artifacts/test-design-epic-14.md'
  - '_bmad/tea/config.yaml'
  - 'vitest.config.ts'
  - 'playwright.config.ts'
  - 'package.json'
  - '.agents/skills/bmad-testarch-atdd/resources/tea-index.csv'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/library-integration-mandate.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/playwright-utils-mandate.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/fixture-architecture.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/component-tdd.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/network-first.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/test-healing-patterns.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/evidence-integrity.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/confidence-gate.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/test-levels-framework.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/test-priorities-matrix.md'
  - '.agents/skills/bmad-testarch-atdd/resources/knowledge/pact-mcp.md'
---

# Story 14.2 ATDD checklist

## Preflight and generation mode

Rasmus, Create mode runs autonomously under the root's recorded standard/high TEA route. The ready-for-dev spec's Tasks & Acceptance and owner-approved Contract C are the acceptance authority. Detected project stack: frontend (Next.js with PostgreSQL/Supabase persistence); this story's test surface is backend integration only. Existing Vitest, Node unit, and Playwright configurations are present. Dependencies are installed; root verified its guarded local API 55421/database 55422 and owns lifecycle. No launch or reset is authorized here.

AI generation selected: clear transactional and row-access scenarios, no UI in this story. The existing Vitest integration runner and test-only tenant/admin SQL factories are reused. No endpoints, selectors, engine states or detector are invented. Public command/checked-RPC binding is an implementation seam to finalize from the actual author implementation; source conventions and approved Design Notes determine assertions.

Playwright Utils is configured true but its package is absent, and generated suites run under Vitest. Its mandate is inapplicable; no dependency change. No microservice contract exists, so Pact artifacts are inapplicable. Pact broker: unreachable (SmartBear MCP tools not available). Behavioral requirements derive from the approved spec and current provider source conventions.

## Strategy

Generate all 18 retained named checks: 2 P0, 16 P1. Five database cases, nine command integration cases, four RLS cases. Exact privileged tenant snapshots observe canonical booking, assignment, conflict-workflow, private outcome and audit state. Checked RPC authorization is tested independently from the production command envelope. Unique tenant/profile/command IDs isolate cases; cleanup uses existing factories. No acceptance skip/fixme/todo passes. Missing schema or command is legitimate RED; infrastructure failure is missing evidence, never acceptance RED.

Contract C transfers 14.3-INT-003/004/005/006 (derived create atomicity, refresh, post-conflict rollback, current-row save detection). All four must execute and pass before any 14.4 work and Epic PR. No conflict-generation assertion here can satisfy those transfers.

Inputs: AGENTS.md; docs/process/agent-model-routing.md; owner Contract C; ready spec; test-design-epic-14.md; Vitest/Playwright/package configuration; resource command/RLS suites; existing envelope/audit failure and tenant fixture helpers; TEA configuration/index/mandatory knowledge fragments.

Confidence: 8 for expected behavioral assertions. Rationale: the approved spec's Design Notes and Code Map determine schema, role boundaries, durable command replay and audit behavior; existing `resources.int.test.ts`, `resources.rls.test.ts`, `envelope-audit-write.int.test.ts` and `quote-audit-rollback.int.test.ts` provide real fixture/entry patterns. Unknowns: final public RPC named arguments and command export/input bindings do not exist yet; implementation must align the provisional test adapter with its actual checked boundary without relaxing assertions. Transaction-stage fault injection must be a local test fixture and never a client-granted production bypass.

## Acceptance traceability

| Check | Priority | AC | Required observation |
| --- | --- | --- | --- |
| 14.2-INT-001 | P0 | 2 | Actual command creates exactly one booking, exact assignees, durable create outcome and exactly one target-only attributable audit. |
| 14.2-INT-002 | P1 | 3 | Update preserves identity/create history and atomically replaces fields/assignees, outcome and one audit. |
| 14.2-INT-003 | P1 | 4 | Equivalent UUID/time/null/assignee input returns original outcome, including after update/deactivation, with exact unchanged snapshot. |
| 14.2-INT-004 | P1 | 4 | Changed create/update payload under its scoped key returns COMMAND_CONFLICT with exact unchanged snapshot. |
| 14.2-INT-005 | P1 | 4 | Concurrent identical creates return the same target and leave one booking/outcome/audit. |
| 14.2-INT-006 | P1 | 5 | Fault after booking preparation rolls back business/private-outcome/audit state on fresh create/update. |
| 14.2-INT-007 | P1 | 5 | Assignee-preparation and audit-write faults roll back all tenant booking/workflow/outcome/audit state. |
| 14.2-INT-009 | P1 | 6 | Existing Phase A basic job ID and row are preserved; booking stores that ID. |
| 14.2-INT-010 | P1 | 7 | Disabled profile cannot be newly assigned; historical unchanged assignment and replay survive. |
| 14.2-DB-001 | P1 | 6 | Standalone parents all null; positive persisted UTC range and distinct active assignees. |
| 14.2-DB-002 | P1 | 6 | Each nullable same-tenant parent works; foreign and incoherent customer/facility/contact/job combinations fail atomically. |
| 14.2-DB-003 | P1 | 6 | Zero/negative windows fail at command and schema boundary without state change. |
| 14.2-DB-004 | P1 | 6 | Timed and exclusive Stockholm-midnight all-day ranges round-trip UTC at spring/fall DST (23/25 hours); invalid local bounds fail. |
| 14.2-DB-005 | P1 | 6 | Case-equivalent duplicate UUID and foreign assignees fail; same-tenant composite/unique constraints remain authoritative. |
| 14.2-RLS-001 | P0 | 8 | Concrete foreign rows in all three tables remain unreadable; direct/checked-command mutation and existence leaks denied. |
| 14.2-RLS-002 | P1 | 9 | Actual Montor profile sees assigned bookings, own assignment rows and own-participation conflicts; shared coworkers and coworker-only rows hidden. |
| 14.2-RLS-003 | P1 | 1,9 | Montor create/update denied through command and checked RPC; own-tenant admin direct DML/private primitives also denied. |
| 14.2-RLS-004 | P1 | 1,9 | Admin/planner command success; callable wrappers reject forged/missing actors, inactive/invited/nonmember/anon and revoked authority; private outcomes hidden. |

AC1 additionally requires existing H4, exact-policy, role harness and manifest gates to execute after the additive migration. AC10 requires repository scope verification and Contract C sequencing; an internal-command test does not prove absence of user-facing routes. These existing cumulative gates remain mandatory and are listed below, not fabricated as an extra named check.

## Implementation checklist

- [ ] Extend resources manifest inventory and closed Bookings.View/Manage capability plus command map; keep scheduling pending with empty live arrays. Run existing coherence/derivation/role-harness gates.
- [ ] Add booking, assignee, conflict-workflow tables, composite parent keys and constraints, indexes, FORCE RLS and explicit public-column SELECT grants. Enroll exhaustive table/projection/role/policy inventories.
- [ ] Implement pure input validation/canonicalization, explicit UTC and Stockholm all-day bounds, active new assignments and retained disabled history; reject caller actor/tenant/conflict authority and recurrence payloads.
- [ ] Implement authenticated checked outer create/update wrappers, private owner-only transaction primitives, server-rebuilt canonical identity, scoped locks/replay and durable outcomes; private helpers/columns inaccessible to clients.
- [ ] Implement real envelope commands and typed RPC/error mapping with SQL-owned audit; actual adapter binding must call the author implementation. No route/action/UI caller.
- [ ] Supply deterministic local fault evidence after booking/assignment preparation and on audit write; verify exact full snapshots on failures and successful retries. Do not install client-callable fault controls.
- [ ] Activate task-specific skipped scaffolds, verify RED on missing behavior then GREEN after implementation. Finish with all 18 retained obligations executed and zero acceptance skips.
- [ ] Run cumulative required integration/RLS and resource regressions plus all normal story/CI gates. Record executed, failed, skipped counts and any missing evidence.
- [ ] Keep 14.3 transfers 003/004/005/006 pending until the sole real engine integrates into create/update; pass all before any 14.4 work or Epic PR.

## Green-phase verification commands

Use only the root-verified loopback API 55421 and database 55422; credentials supplied privately by root. Set the dedicated SUPABASE_TEST_URL/DB_URL/ANON_KEY/SERVICE_ROLE_KEY variables and SUPABASE_TEST_REQUIRED=1 explicitly; inherited default 54321 is forbidden. Never print credentials. The root owns infrastructure, migrations/reset readiness and lifecycle.

```powershell
pnpm exec vitest run tests/integration/commands/bookings.int.test.ts tests/integration/rls/bookings.rls.test.ts
pnpm exec vitest run tests/integration/rls/role-harness.atdd.int.test.ts tests/integration/rls/migration-reset.int.test.ts tests/integration/rls/rls-inventory-gate.int.test.ts tests/integration/rls/cross-tenant-isolation.rls.test.ts tests/integration/rls/anon-path-isolation.rls.test.ts
pnpm run test:int
pnpm run typecheck
pnpm run lint
pnpm run test:unit
```

The first two commands target files directly with Vitest. Do not use `pnpm test:int -- <files>`, which previously failed to filter. Full test:int is a cumulative green-phase gate, not necessary during scaffold generation. Follow CI for source/build/bundle containment and empty-schema migration evidence. Author updates the final Suggested Review Order after implementation/verification; this ATDD checklist supplies no manufactured verified stops.

## Red / green / refactor handoff

Scaffolds stay `test.skip()` as the installed ATDD workflow requires. A skipped runner result verifies discovery/compilation only; it provides zero acceptance coverage. Before each implementation task, activate its cases and observe the actual missing behavior. Fix feature failures; repair fixture/API binding failures against actual source. After all required cases execute and pass, refactor while preserving exact outcomes and authority constraints. No business estimate is invented; effort estimation is author planning work.

Manual story handoff: use this checklist and generatedTestFiles paths with the existing Story 14.2 spec. Spec linking is intentionally delegated to its author because this agent has no spec-edit ownership. Do not backfill historical author trail.

## Non-applicable template sections

E2E/components/UI selectors/data-testid: N/A (no story UI). HTTP endpoint/status contract: N/A (internal envelope and checked RPC). External mocks/Pact: N/A (real local PostgreSQL boundary). Playwright merged fixtures/Faker: N/A; preserve existing Vitest/crypto UUID two-tenant factories, with no new package. Browser sessions/resources: none created; no lifecycle teardown needed.

## Generated scaffolds and infrastructure

| File | Lines | Count | Status |
| --- | --- | --- | --- |
| tests/integration/commands/bookings.int.test.ts | 370 | 14 (1 P0, 13 P1) | All test.skip; not-executed acceptance |
| tests/integration/rls/bookings.rls.test.ts | 184 | 4 (1 P0, 3 P1) | All test.skip; not-executed acceptance |
| tests/support/bookings-atdd.ts | 164 | One booking fixture/helper module | Provisional provider bindings documented |

The support module supplies overridable pure bookingInput, actual bookingCommand/runCommand and checkedBookingRpc adapters, exact privileged two-tenant bookingSnapshot, existing row snapshots, real role-aware person profile fixtures, nullable parent factories, schema/read-only workflow rows and correlation-scoped local fault control. It implements no booking behavior or conflict engine. Fixture creation/cleanup is inside skipped test bodies; skipped collection invokes no scenario setup.

Before activation, bind actual command input/export and checked SQL named arguments, outcome JSON/column names, conflict-workflow fields, primitive catalog query schema, and any required fixture-only booking seed fields. Final exports/RPC arguments do not yet exist; these are explicit author integration tasks, not unanswered business decisions. Fault controls must be supplied only by local seed/test infrastructure; no production parameter or client execute grant. Metadata records the exact binding requirements.

## Aggregation and validation

Execution capability probe: subagent tools available, no native agent-team interface; auto resolved to subagent. API worker routed Sol 6.1 High for RLS/authorization/transaction integrity; E2E applicability worker routed Sol 6.1 Low for ordinary scope analysis. Both succeeded. Worker outputs are retained under test-artifacts, not arbitrary temp paths. No parallel speedup or duration claim is fabricated.

- [x] Approved ready-for-dev spec and Contract C loaded; all 18 retained IDs mapped, priorities unchanged.
- [x] Two actual integration files created; 18 test.skip declarations, meaningful expected-behavior assertions and documented still-true activation reason.
- [x] Existing real envelope/client/SQL/role factories reused; no mocks asserting their own configured behavior, new dependency, HTTP endpoint or browser scope.
- [x] Structured API/E2E results saved; 18 API/DB/RLS scaffolds and 0 E2E/component cases. Fixture and provider binding needs recorded.
- [x] Checklist/frontmatter/story key/input documents/generated paths and manual spec handoff saved.
- [x] Focused required-stack collection completed with explicit 55421/55422; no default/hosted target or reset.
- [x] TypeScript compile completed. No browser/session/resource created; root retains lifecycle ownership.
- [ ] GREEN acceptance: activate and execute all 18 retained checks with zero acceptance skips, plus the cumulative gates.
- [ ] Mandatory transfer gate: execute and pass all four Story 14.3 real engine integration checks before any 14.4 work/Epic PR.

## Verification evidence and limits

Focused command: `pnpm exec vitest run tests/integration/commands/bookings.int.test.ts tests/integration/rls/bookings.rls.test.ts --reporter=json --outputFile=_bmad-output/test-artifacts/atdd-story14-2-collection-results.json`.

Native exit: **0**. Collected: **18** (14 command/DB, 4 RLS). Executed acceptance: **0**. Passed: **0**. Failed: **0**. Skipped/pending: **18**. Both files collected; JSON file-level status is passed only because every case is skipped. This is not a product PASS or implementation readiness evidence.

Compile command: `pnpm exec tsc --noEmit --incremental false`; native exit **0**. Compilation confirms test types/import discovery, not schema/function existence or behavior inside skipped bodies.

RED activation: **not executed**. Expected RED causes are absent booking migration/commands and unbound final provider/fault-fixture seams. No missing-service failure, skipped test or engine stub is counted as RED acceptance evidence. The installed workflow's red-phase responsibility is scaffold generation plus task-specific activation guidance; the author must observe actual RED before GREEN. No acceptance coverage percentage, volume/performance target or integration pass is claimed.

Evidence artifacts:

- `_bmad-output/test-artifacts/tea-atdd-api-tests-story14-2-2026-10-06.json`
- `_bmad-output/test-artifacts/tea-atdd-e2e-tests-story14-2-2026-10-06.json`
- `_bmad-output/test-artifacts/atdd-story14-2-collection-results.json`
- `_bmad-output/test-artifacts/tea-atdd-summary-story14-2-2026-10-06.json`

ATDD outcome: complete scaffold/checklist handoff. Open business questions: none. Product implementation and full execution remain with the root's build dispatch. No product/spec/migration/Git changes, resource launch/reset, hosted action or acceptance waiver occurred.

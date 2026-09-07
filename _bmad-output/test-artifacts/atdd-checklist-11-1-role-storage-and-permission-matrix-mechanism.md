---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-04'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-11-1-role-storage-and-permission-matrix-mechanism.md'
  - '_bmad-output/implementation-artifacts/epic-11-context.md'
  - '_bmad-output/test-artifacts/test-design-epic-11.md'
  - '_bmad/tea/config.yaml'
  - 'package.json'
  - 'playwright.config.ts'
  - 'tests/unit/server/auth/resolve-tenant-context.test.ts'
  - 'tests/unit/server/commands/envelope-core.test.ts'
  - 'tests/unit/server/read-models/entitlements.test.ts'
  - 'tests/unit/scope/manifest-coherence.test.ts'
  - 'tests/integration/rls/membership-self-grant.rls.test.ts'
  - 'tests/integration/rls/security-definer-search-path.rls.test.ts'
  - 'tests/factories/tenants.ts'
  - 'C:/Users/Rasmus/.agents/skills/bmad-testarch-atdd/resources/tea-index.csv'
---

# ATDD Checklist - Epic 11, Story 11.1: Role Storage and Permission-Matrix Mechanism

**Date:** 2026-09-04  
**Author:** Rasmus  
**Primary test levels:** Unit + integration/RLS

## Story Summary

Story 11.1 introduces the server/database mechanism for a closed five-role model: additive role storage, server-derived union decisions, a code-owned permission matrix, and fail-loud matrix coverage for active manifest modules. It preserves legacy `tenant_admin` data and behavior while explicitly excluding RBAC UI, navigation/landing, invite lifecycle, and Phase-A rollout work.

## Acceptance Criteria

1. Existing active Admin memberships resolve as `tenant_admin` without data rewrite.
2. Multiple held roles resolve capabilities and sensitive fields as a union.
3. Absent, unknown, inactive, cross-tenant, and ungranted inputs deny generically with no command side effect or audit.
4. Active modules lacking matrix rows trigger a dedicated coherence violation, while the real manifest/matrix remains coherent.
5. Forged child roles, cross-tenant access, and `search_path` shadowing are denied and independent readback remains unchanged.
6. Phase-A routes, policies, nav, landing, and admin UI remain unchanged and reserved for Stories 11.2–11.4.

## Step 1: Preflight and Context

- **Mode:** Create
- **Detected stack:** fullstack (Next.js/React application, Playwright E2E configuration, and Vitest/PostgreSQL integration suites)
- **Frameworks available:** `node:test` unit tests, Vitest integration/RLS tests, and Playwright E2E tests.
- **TEA flags:** Playwright Utils enabled; Pact.js Utils enabled; Pact MCP configured; browser automation set to auto. This story has no external HTTP consumer/provider contract, so no Pact scaffold is required.
- **Story readiness:** The supplied `ready-for-dev` specification contains six clear acceptance criteria and explicitly reserves Phase-A role rollout, nav, landing, and admin UI to Stories 11.2–11.4.

### Extracted acceptance focus

1. Preserve legacy `tenant_admin` access without rewriting memberships and resolve it into the role set.
2. Resolve multi-role permissions as a union, including sensitive-field entitlement decisions.
3. Deny absent, unknown, inactive, cross-tenant, and ungranted inputs generically before command side effects or audit writes.
4. Fail manifest coherence loudly when an active module lacks permission-matrix coverage while the real manifest/matrix remains coherent.
5. Prove RLS, same-tenant child integrity, and hardened `has_tenant_role` behavior under forged, cross-tenant, and search-path attacks with independent readback.
6. Keep Phase-A per-role policies, nav, landing, routes, and admin UI unchanged in this mechanism-only story.

### Existing patterns selected

- Pure, injected logic coverage uses `node:test` and `node:assert/strict`.
- Database facts use Vitest integration/RLS suites with parallel-safe tenant factories, privileged independent readback, explicit cleanup, and local-stack gating.
- The authorization boundary is server-side; this story needs no browser journey or client-side authority test.

### Knowledge loading

Loaded the required core, fullstack, Playwright Utils, backend, Pact.js Utils, and Pact MCP knowledge profiles. The resulting scaffolds will use deterministic factory setup, injected pure seams, direct assertions, no hard waits, and local-stack integration proofs. Contract testing is not applicable because the story introduces no service-to-service HTTP contract.

## Step 2: Generation Mode

**Selected mode:** AI generation.

The acceptance criteria specify server, database, and pure TypeScript seams precisely enough to produce deterministic red-phase tests from the approved story, existing test patterns, and test-design coverage. No new UI interaction belongs to Story 11.1, so browser recording would neither add evidence nor produce an in-scope acceptance scaffold.

## Step 3: Test Strategy

### Level selection and priority

| AC | Scenario family | Level | Priority | Red reason before Story 11.1 implementation |
| --- | --- | --- | --- | --- |
| 1 | Legacy active Admin resolves to a de-duplicated `tenant_admin` role set without a data rewrite | Unit | P0 | Role-set resolver and child-role query contract do not exist. |
| 2 | Two valid roles grant capability/field access as an order-independent union; neither grants means withheld | Unit | P0 | Typed roles, matrix, and pure entitlement resolver do not exist. |
| 3 | Unknown/empty roles and unknown module/capability deny; declared command gates return `PERMISSION_DENIED` before validation, execution, or audit | Unit | P0 | Capability gate, error-code variant, and envelope declaration seam do not exist. |
| 4 | Real manifest + matrix is coherent; injected active module missing rows emits the dedicated rule | Unit | P0 | The injected matrix coverage validator and real matrix wiring do not exist. |
| 5 | `membership_roles` migration constraints, grants/RLS, hardened predicate, cross-tenant denial, forged child role denial, and independent readback | Integration/RLS | P0 | The table, migration, policies, helper, and fixture helpers do not exist. |
| 6 | Active Phase-A nav/routes/admin UI remains unchanged | Static scope assertion in checklist | P1 | This is a deliberately non-product mechanism boundary, not a new browser journey. |

### Planned red-phase scaffold inventory

1. `tests/unit/server/authz/permission-matrix.test.ts` — P0 pure role/matrix union, legacy-Admin compatibility, unknown/empty deny, sensitive-field absence-plus-listed contract.
2. `tests/unit/server/authz/require-capability.test.ts` — P0 unknown/inactive/ungranted capability denial and generic `PERMISSION_DENIED` result.
3. `tests/unit/server/auth/resolve-tenant-context.test.ts` — P0 resolver role-set query/normalization coverage, retaining the legacy scalar compatibility assertion.
4. `tests/unit/server/commands/envelope-core.test.ts` — P0 declared capability must deny before validation/ownership/execute/audit.
5. `tests/unit/scope/manifest-coherence.test.ts` — P0 biting missing-matrix negative and real-manifest positive.
6. `tests/integration/rls/membership-roles.rls.test.ts` — P0 schema, RLS, constraints, own/cross-tenant reads and writes, and readback.
7. `tests/integration/rls/has-tenant-role.rls.test.ts` — P0 legacy role plus child-role helper semantics, inactive/cross-tenant negatives, and search-path hardening.
8. `tests/integration/rls/migration-reset.int.test.ts` and `tests/integration/rls/tenant-table-inventory.ts` — P1 exact migration/H4 enrollment extension.
9. `tests/factories/tenants.ts` — P0 reusable local-stack fixture/readback helpers, only where needed by the integration scaffolds.

### Test-design choices

- Use pure units for matrix, normalization, coherence, and gate ordering so failures are immediate and deterministic.
- Use integration/RLS tests only for database authority facts. Each negative mutation includes a privileged independent readback proving no row changed.
- Do not add E2E, component, mock-service, or Pact coverage: Story 11.1 deliberately introduces no UI or external contract. This avoids duplicating later Story 11.2–11.4 journey coverage.
- Red-phase tests must fail for missing production seams, migration/table/policy/helper, or missing error-code behavior—not due to timing, unseeded external dependencies, or invalid test setup.

## Step 4: RED-Phase Generation and Aggregation

**Execution mode:** subagent (capability probe enabled; two required workers ran in parallel).

**TDD validation:** PASS. The API/database worker returned the complete scenario plan; aggregation persisted 15 atomic RED scaffolds, each marked `test.skip()` and carrying expected behavioral assertions. The E2E worker returned zero scenarios because UI journeys are expressly out of scope. Neither worker invented an HTTP endpoint, a Pact contract, or an RBAC screen.

### Generated RED test scaffolds

- `tests/unit/server/authz/permission-matrix.test.ts` — role set normalization, union decisions, unknown/empty default denial, and sensitive-field union behavior.
- `tests/unit/server/authz/require-capability.test.ts` — stable generic `PERMISSION_DENIED` without target/tenant details.
- `tests/unit/server/auth/resolve-tenant-context.test.ts` — skipped additive active-membership role-set normalization case.
- `tests/unit/server/commands/envelope-core.test.ts` — skipped capability-gate ordering case proving denial precedes validation, ownership, execute, and audit.
- `tests/unit/scope/manifest-coherence.test.ts` — skipped biting missing-matrix case and real-manifest/matrix positive.
- `tests/integration/rls/membership-roles.rls.test.ts` — same-tenant child integrity, forged role denial/readback, and uniqueness cases.
- `tests/integration/rls/has-tenant-role.rls.test.ts` — legacy compatibility, child role, fail-closed predicates, and `search_path` attack cases.
- `tests/integration/rls/migration-reset.int.test.ts` — skipped migration object, H4, and hardened helper checks.

### Fixture and H4 requirements for green phase

No standalone fixture was created: the in-scope test infrastructure must extend the established local-stack factory and inventory rather than duplicate them. Before unskipping the RLS cases, implementation must:

- extend `tests/factories/tenants.ts` with explicit membership IDs and narrow admin insert/read helpers for `membership_roles`;
- extend the resolver fake with independently scripted child-role rows;
- enroll `membership_roles` exactly once in `tests/integration/rls/tenant-table-inventory.ts` with all cross-tenant and anonymous metadata shapes; and
- add the migration and hardened helper before enabling the local-stack tests.

### Scope guard

The generated suite has no E2E file, UI fixture, browser selector, client authority, navigation, landing, or admin-lifecycle assertion. Those surfaces remain reserved for Stories 11.2–11.4.

### Aggregation summary

- Total persisted RED scenarios: 15 (all skipped until implementation)
- E2E scenarios: 0 (intentionally out of scope)
- Provider scrutiny/Pact: not applicable; this story publishes no HTTP contract
- Persisted summary: `_bmad-output/test-artifacts/atdd-11-1-red-generation-summary.json`

## Validation and Completion

### Validation result

- Prerequisites are satisfied: the approved story has testable criteria; Node, Vitest, and Playwright configuration are present; local-stack integration coverage uses the established gated fixtures.
- The checklist maps all six criteria without introducing UI, endpoint, matrix-to-client, service-role, or Phase-C scope.
- All 15 persisted scenarios retain `test.skip()` as mandated for this ATDD RED scaffold. No hard waits, network mocks, browser sessions, or shared mutable fixtures were introduced.
- A direct pre-implementation run of `node --test tests/unit/server/authz/permission-matrix.test.ts` fails at module resolution for `@/server/authz/permission-matrix`, demonstrating the intended red condition: the code-owned matrix authority does not yet exist. The skipped database tests are intentionally held until the additive migration and local fixture helpers exist.
- No browser was launched, so there is no session to clean up. The durable checklist and summary are in `_bmad-output/test-artifacts`; worker handoff JSON remains only as turn-scoped temporary orchestration output.

### Green-phase implementation checklist

- [ ] Add the additive role-domain and `membership_roles` migration, composite same-tenant integrity, unique membership×role rows, RLS/grants, H4 enrollment, and hardened `has_tenant_role` helper without changing `is_tenant_admin()`.
- [ ] Add the closed five-role `roles.ts`, code-owned typed permission matrix, fail-closed capability/sensitive-field resolution, and `PERMISSION_DENIED` command error.
- [ ] Extend the server tenant-context query/fake to return normalized server-derived active roles, including legacy `tenant_admin`.
- [ ] Add the envelope capability declaration/gate after context resolution and before validation, ownership, execute, or audit.
- [ ] Wire matrix coverage into manifest coherence, update the existing H4/factory seams, then remove `test.skip()` one atomic test at a time.
- [ ] Run `pnpm run typecheck`, `pnpm run test:unit`, `supabase db reset`, `pnpm run test:int`, and `pnpm run lint` after the respective implementation work is present.

### Completion handoff

Primary test levels are unit and local-stack integration/RLS. The next recommended workflow is Story 11.1 implementation followed by unskipping and automating these cases; Stories 11.2–11.4 own the Phase-A rollout and all RBAC UI journeys.

## Data Factories and Fixtures

**Created:** none. The existing two-tenant factory is the correct shared fixture base, but it cannot honestly expose membership-role records before that schema exists.

**Green-phase requirement:** add narrowly scoped factory helpers and cleanup through `tests/factories/tenants.ts`; do not use UI setup, static IDs, a service-role app path, or a global cleanup routine.

## Mock Requirements and data-testid Attributes

**External mocks:** N/A — no external endpoint or provider contract exists.  
**data-testid attributes:** N/A — Story 11.1 adds no UI surface.

## Implementation-to-Test Map

| Scaffold | Required green-phase implementation |
| --- | --- |
| `permission-matrix.test.ts`, `require-capability.test.ts` | Closed role type; typed matrix; pure union/field resolver; generic deny result. |
| `resolve-tenant-context.test.ts`, `envelope-core.test.ts` | Server-only active role query/normalization and an early declared-capability envelope gate. |
| `manifest-coherence.test.ts` | Pure injected matrix-coverage coherence rule wired to the real code-owned matrix. |
| `membership-roles.rls.test.ts`, `has-tenant-role.rls.test.ts`, `migration-reset.int.test.ts` | Additive migration, tenant-safe child integrity, grants/RLS/H4 enrollment, and hardened DEFINER predicate. |

## Execution Commands

```powershell
# RED evidence before implementation
node --test tests/unit/server/authz/permission-matrix.test.ts

# GREEN verification after implementation
pnpm run typecheck
pnpm run test:unit
supabase db reset
pnpm run test:int
pnpm run lint
```

## Red-Green-Refactor

- **RED:** complete — 15 scoped acceptance scaffolds are deliberately skipped; the matrix unit entrypoint currently fails because the authority module is absent.
- **GREEN:** implement the smallest seam for one scaffold, remove only its `test.skip()`, run that test, and repeat.
- **REFACTOR:** after all pass, consolidate matrix helpers and test fixtures without weakening denial, RLS, search-path, or manifest-drift assertions.

## Next Steps

1. Implement Story 11.1 within the recorded boundaries.
2. Extend the existing factory/inventory seams only after the migration is present.
3. Remove skips incrementally and execute the listed unit, reset, integration, and lint gates.
4. Keep UI and Phase-A role rollout work for Stories 11.2–11.4.

---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-07'
workflowType: 'testarch-atdd'
storyId: '11.2'
storyKey: 'spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing'
storyFile: 'C:/DEV/ElproSaas/_bmad-output/implementation-artifacts/spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md'
atddChecklistPath: 'C:/DEV/ElproSaas/_bmad-output/test-artifacts/atdd-checklist-spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md'
generatedTestFiles:
  - 'C:/DEV/ElproSaas/tests/integration/rls/role-aware-phase-a-surface.atdd.int.test.ts'
  - 'C:/DEV/ElproSaas/tests/e2e/auth/role-aware-phase-a-surface.atdd.e2e.spec.ts'
inputDocuments:
  - 'C:/DEV/ElproSaas/_bmad-output/implementation-artifacts/spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md'
  - 'C:/DEV/ElproSaas/_bmad/tea/config.yaml'
  - 'C:/DEV/ElproSaas/package.json'
  - 'C:/DEV/ElproSaas/playwright.config.ts'
  - 'C:/DEV/ElproSaas/vitest.config.ts'
  - 'C:/DEV/ElproSaas/tests/README.md'
  - 'C:/DEV/ElproSaas/tests/e2e/auth/login-and-tenant-context.e2e.spec.ts'
  - 'C:/DEV/ElproSaas/tests/integration/rls/membership-roles.rls.test.ts'
  - 'C:/DEV/ElproSaas/tests/integration/rls/has-tenant-role.rls.test.ts'
  - 'C:/DEV/ElproSaas/tests/factories/tenants.ts'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-atdd/resources/tea-index.csv'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-atdd/resources/knowledge/component-tdd.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-atdd/resources/knowledge/test-healing-patterns.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-atdd/resources/knowledge/selector-resilience.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-atdd/resources/knowledge/timing-debugging.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-atdd/resources/knowledge/playwright-utils-mandate.md'
---

# ATDD Checklist - Story 11.2: Non-Admin Access to the Phase A Surface

**Date:** 2026-09-07  
**Author:** Rasmus  
**Primary Test Level:** DB-backed integration/RLS, with focused unit and browser acceptance coverage

## Preflight and context

- **Stack:** frontend (Next.js/React), with Playwright browser tests and Vitest integration/RLS tests against the local Supabase stack.
- **Story status:** ready-for-dev; its five acceptance criteria are clear and testable.
- **Existing test patterns:** Node `node:test` for pure units, Vitest for local-Supabase RLS/integration suites, and serial Playwright for production-build browser journeys.
- **Generation prerequisite:** satisfied. The test stack and development environment definitions exist; no local service was started for scaffold generation.
- **Playwright Utils:** `tea_use_playwright_utils` is true, but `@seontechnologies/playwright-utils` is absent from `package.json` and the lockfile. Its dependency gate is therefore unmet; use the existing project Playwright pattern and do not add a dependency in this ATDD-only task.
- **Pact:** not relevant: this story changes an in-process Next.js/Supabase surface and defines no independently deployed consumer/provider contract.
- **Confirmed execution mode:** autonomous Create run; inputs accepted without a user checkpoint.

## Generation mode

**Mode:** AI generation.

The acceptance criteria define role, capability, tenant-isolation, projection, and route outcomes precisely. Existing local-Supabase RLS factories and the Playwright fixture establish the implementation shapes, so browser recording would not add reliable information before implementation. No browser was launched and no resource lifecycle action was required.

## Test strategy

| Priority | Acceptance coverage | Test level | Red scaffold responsibility |
| --- | --- | --- | --- |
| P0 | Active-role nav and server landing; direct-route and command denial have no target/audit signal | Unit + E2E | Prove the pure server authority and a thin browser journey with a seeded non-admin role. |
| P0 | Matrix-authored policy arrays agree with the database catalog; permitted and unentitled roles retain tenant/row constraints | Integration/RLS | Table-drive every seeded role × active module and prove one denied read/write boundary per module. |
| P0 | Montör and Säljare cannot receive protected money values or dependent aggregates | Unit + integration read projection | Assert structural absence plus `entitlements.withheld`, never zero/null substitution or changed stored amounts. |
| P0 | Legacy Admin continuity, role union, and unknown/inactive/invited/cross-tenant/empty fail-closed | Unit + integration | Separate pure resolver semantics from real membership/RLS context resolution. |
| P0 | No `job_members` inference and no E16/Arbetsledare behavior | Unit + integration/RLS | Assert Jobs.ViewAssigned does not become whole-tenant visibility and unlisted roles deny. |

### Red-phase requirements

- The integration scaffold is made entirely of `test.skip()` cases, so the current green baseline remains executable and activation exposes the missing role-aware migration and fixture as real RED failures.
- Browser scaffold is `describe.skip` because global setup currently creates only the Admin fixture. Its activation requires the new isolated non-admin browser credentials and server-derived UI contracts.
- No component scaffold is emitted: this repository has no configured component-test runner and the story's presentation behavior is covered by pure server DTO tests plus one browser journey.

## Story integration metadata

- **Story ID:** `11.2`
- **Story file:** `C:/DEV/ElproSaas/_bmad-output/implementation-artifacts/spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md`
- **Checklist:** `C:/DEV/ElproSaas/_bmad-output/test-artifacts/atdd-checklist-spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md`
- **RLS scaffold:** `C:/DEV/ElproSaas/tests/integration/rls/role-aware-phase-a-surface.atdd.int.test.ts`
- **Browser scaffold:** `C:/DEV/ElproSaas/tests/e2e/auth/role-aware-phase-a-surface.atdd.e2e.spec.ts`

The Story 11.2 specification was intentionally not edited. These artifact paths are recorded here for the build workflow to link during its own bookkeeping.

## Acceptance criteria coverage

| Acceptance criterion | Red-phase coverage |
| --- | --- |
| Matrix-granted nav/landing; generic direct denial and no audit | RLS P0 catalog/command tests; E2E P0 Säljare nav/landing and Montör direct-route denial. |
| Matrix-to-policy agreement; tenant/row scope; allowed path and denied read/write | RLS P0 catalog agreement plus per-catalog denied read/write loops. |
| Montör/Säljare money field and aggregate structural absence | RLS P1 withheld-field and `entitlements.withheld` test; E2E P0 Montör dashboard and P1 Säljare route checks. |
| Legacy Admin, role union, invalid context fail-closed | RLS P0 legacy scalar/child-role union and invalid-context test. |
| No `job_members`/E16 inference | RLS P1 non-admin inference-probe test. |

## Red-phase test scaffolds created

### RLS and integration tests — 6 skipped scenarios

**File:** `C:/DEV/ElproSaas/tests/integration/rls/role-aware-phase-a-surface.atdd.int.test.ts`

- `[P0]` policy catalog agreement for every closed role × every active module, route, and representative table.
- `[P0]` one denied RLS read/write for every catalog denial.
- `[P0]` denied command stops before target lookup and leaves audit count unchanged.
- `[P0]` scalar legacy Admin plus child-role union succeeds; invalid membership contexts deny every module.
- `[P1]` Montör/Säljare projections omit each withheld money field and list its `quotes.<field>` entitlement path.
- `[P1]` no `job_members`/E16 assignment inference reaches a non-admin.

**Status:** all use `test.skip()` by design. When activated before implementation, they require the role-aware policy migration, fixture contract, command declarations, entitlement projections, and server nav authority, and therefore must fail RED.

### Browser tests — 4 skipped scenarios

**File:** `C:/DEV/ElproSaas/tests/e2e/auth/role-aware-phase-a-surface.atdd.e2e.spec.ts`

- `[P0]` Säljare receives the fixed matrix-derived nav and server landing.
- `[P0]` Montör receives the indistinguishable generic denial for direct `/settings` navigation with no controls or table data.
- `[P0]` Montör remains on the `/dashboard` E15-safe fallback and receives no money rendering.
- `[P1]` Säljare opens matrix-granted `/customers` without cost/margin output.

**Status:** all use `test.skip()` by design. The browser fixture presently seeds only an Admin user; Story 11.2 must add deterministic Säljare/Montör credentials and recheck the semantic selectors when the generic denial is implemented.

## Fixture and selector requirements

No fixture file was created, because a standalone placeholder would either invent a test-support API or leave an import that cannot resolve. The skipped integration scaffold declares its required future fixture contract locally.

- Extend `tests/factories/tenants.ts` with parallel-safe two-tenant role fixtures for `tenant_admin`, `projektledare`, `montor`, `saljare`, and `ekonomi`, a scalar legacy Admin, role unions, invalid/inactive/invited membership states, and representative Phase A rows.
- Provide the catalog adapter used by the integration scaffold: it must enumerate all role × active-module grants and denials, issue a real RLS read/write, test a denied command before its target lookup, and independently read audit count.
- Extend Playwright global setup with isolated Säljare and Montör users. Use the existing local Supabase fixture path and clean them through the existing teardown.
- Confirm `Huvudnavigation`, `Ingen åtkomst`, `E-post`, `Lösenord`, and `Logga in` remain the accessible contracts when the role-aware UI lands. Do not replace semantic locators with CSS selectors.

## Data factories, mocks, and test IDs

- **Data factories created:** none. The existing tenant factory is the correct extension point, and the required additions are listed above.
- **External-service mocks:** N/A. The acceptance behavior is against the local Next.js and Supabase stack, not a third-party provider.
- **New `data-testid` attributes:** none required by the authored browser scaffold. It uses semantic labels, roles, headings, and navigation links. If the generic-denial UI cannot expose `Ingen åtkomst` as an accessible heading, add one semantic heading instead of a CSS-targeted test ID.

## Playwright Utils deviations

`tea_use_playwright_utils` is enabled in TEA config, but `@seontechnologies/playwright-utils` is absent from both `package.json` and the lockfile. The library mandate's dependency gate is unmet, so the browser scaffold follows the established `@playwright/test` pattern. No dependency or merged-fixture infrastructure was added in this ATDD-only task.

## Implementation checklist

1. Activate the RLS catalog test first. Add the role-aware migration/policy catalog and the isolated fixture; prove it fails before policy evolution, then make the catalog and real RLS outcomes agree.
2. Activate the denied command/audit test. Declare capabilities on every Phase A command and preserve pre-validation/pre-lookup `PERMISSION_DENIED` behavior.
3. Activate the entitlement test. Ensure withheld leaves and dependent aggregates are absent from data and present in `entitlements.withheld`, including export/PDF payload boundaries.
4. Activate the resolver and job-assignment seam tests. Preserve scalar Admin compatibility and union semantics; reject unknown, empty, inactive, invited, cross-tenant, malformed, and job-assignment-only contexts.
5. Add server-derived nav/landing and the generic direct-route handler, then activate the browser cases using semantic selectors and deterministic local fixtures.

## Running tests

```powershell
# After activating a selected red scenario and starting the local stack:
supabase db reset
pnpm run test:int -- tests/integration/rls/role-aware-phase-a-surface.atdd.int.test.ts

# After role-aware Playwright setup is implemented:
pnpm run test:e2e -- tests/e2e/auth/role-aware-phase-a-surface.atdd.e2e.spec.ts
```

## Red-green-refactor handoff

All ten tests are authored scaffolds and remain skipped. They have not been activated or executed against a local Supabase stack or browser; structural red-phase verification has passed. Remove one `test.skip()` at a time, observe the intended failure, implement the smallest safe change, then run the focused suite before advancing to the next scenario.

## Validation evidence

- Structural check passed: 10 `test.skip()` declarations across the two generated files, no focused tests, and no placeholder assertions.
- `pnpm exec eslint tests/integration/rls/role-aware-phase-a-surface.atdd.int.test.ts tests/e2e/auth/role-aware-phase-a-surface.atdd.e2e.spec.ts` passed. No local Supabase service, browser, or activated RED test is run by this workflow.
- Temporary worker JSON was read, validated, and superseded by the persisted repository artifacts above; it is not a downstream handoff artifact.

## Completion summary

- **Story:** 11.2; primary level: local-Supabase integration/RLS with a thin Playwright acceptance layer.
- **Scaffolds:** 6 RLS/integration + 4 browser = 10 skipped RED scenarios.
- **Factories/fixtures/mocks/test IDs created:** 0 / 0 / 0 / 0. Required future fixture work is recorded explicitly.
- **Next workflow:** Story 11.2 implementation (`bmad-build-auto`), activating one listed scenario at a time.

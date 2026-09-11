---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-11'
storyId: '11.4'
storyKey: '11-4-roles-surface-effective-permissions-and-the-per-role-test-harness'
storyFile: 'C:\\DEV\\ElproSaas\\_bmad-output\\implementation-artifacts\\spec-11-4-roles-surface-effective-permissions-and-the-per-role-test-harness.md'
atddChecklistPath: 'C:\\DEV\\ElproSaas\\_bmad-output\\test-artifacts\\atdd-checklist-11-4-roles-surface-effective-permissions-and-the-per-role-test-harness.md'
generatedTestFiles:
  - 'C:\\DEV\\ElproSaas\\tests\\integration\\rls\\role-harness.atdd.int.test.ts'
  - 'C:\\DEV\\ElproSaas\\tests\\e2e\\auth\\admin-user-management-roles.atdd.e2e.spec.ts'
inputDocuments:
  - 'C:\\DEV\\ElproSaas\\_bmad\\tea\\config.yaml'
  - 'C:\\DEV\\ElproSaas\\package.json'
  - 'C:\\DEV\\ElproSaas\\playwright.config.ts'
  - 'C:\\DEV\\ElproSaas\\_bmad-output\\implementation-artifacts\\spec-11-4-roles-surface-effective-permissions-and-the-per-role-test-harness.md'
  - 'C:\\DEV\\ElproSaas\\_bmad-output\\test-artifacts\\test-design-epic-11.md'
  - 'C:\\DEV\\ElproSaas\\.agents\\skills\\bmad-testarch-atdd\\resources\\tea-index.csv'
---

# ATDD Checklist — Story 11.4: Roles Surface, Effective Permissions, and the Per-Role Test Harness

## Step 1 — Preflight and Context

- **Detected stack:** frontend (Next.js with the configured Playwright browser suite; local-Supabase Vitest integration suites remain an established test seam for the authorization harness).
- **Prerequisites:** satisfied. The story is `ready-for-dev`, has five clear acceptance criteria, `playwright.config.ts` is configured, and repository unit, integration, and E2E patterns exist.
- **Story identity:** `11.4` / `11-4-roles-surface-effective-permissions-and-the-per-role-test-harness`.
- **Affected seams:** server role catalogue/read DTOs; permission matrix and active scope manifest coherence; tenant-table and command enrollment; local-Supabase RLS and command suites; Admin Users browser journey; source/bundle containment.
- **Key product semantics:** `Aktiva medlemmar` means current-tenant `active` memberships only, counted once for every assigned stored role. Lifecycle states other than `active` and all foreign rows are excluded. Counts are informational and cannot change authorization.
- **TEA configuration:** browser automation `auto`; Playwright and Pact utility flags are enabled. `@seontechnologies/playwright-utils` is absent from the package manifest and lockfile, so generated Playwright scaffolds must use the existing repository fixture imports and carry the mandate's documented absence/deviation rationale. Contract tests are not relevant because this story has no service-contract boundary; Pact MCP reachability is therefore recorded as not applicable and no broker call is made.
- **Knowledge loaded:** core data-factory, component-TDD, test-quality, healing, selector, timing, Playwright utility/fixture, and CLI guidance; Pact MCP guidance for the non-relevant contract gate.

## Step 2 — Generation Mode

- **Selected mode:** AI generation.
- **Reason:** the story has concrete, bounded authorization, read-model, lifecycle-count, coherence, and existing-route acceptance criteria. The repository already supplies stable unit, local-Supabase integration, and Playwright seams. Recording would add no reliable information before the server-derived Roles surface exists.

## Step 3 — Test Strategy

| ID | Acceptance coverage | Level | Priority | Red-phase assertion |
| --- | --- | --- | --- |
| 11.4-UNIT-001 | Five Swedish seed-role cards derive only active manifest modules, waves, concrete sensitive entitlements, and no pending/placeholder data | Unit | P1 | The future server-only role-catalogue DTO does not yet exist and must expose deterministic role/card rows. |
| 11.4-UNIT-002 | Effective permissions deduplicate active module/capability grants and list granting roles in stable order; unknown/empty role sets deny | Unit | P0 | The future catalogue projection is missing; table-driven union/denial expectations define its contract. |
| 11.4-UNIT-003 | `Aktiva medlemmar` counts current-tenant `active` memberships once per assigned role and excludes invited, expired, revoked, disabled, ended, and foreign rows | Unit | P1 | The future count projection is missing; lifecycle and multi-role count expectations define the owner-approved semantics. |
| 11.4-UNIT-004 | Manifest/matrix/inventory/command/test enrollment produces exact unique role × active-table/capability obligations | Unit | P0 | The future role-harness module is missing; independently computed cardinality and identity assertions prevent representative-only coverage. |
| 11.4-UNIT-005 | Missing matrix/enrollment, duplicate/unknown metadata, activation omission, and policy drift fail loudly | Unit | P0 | The future validator/harness API is missing; deliberate broken metadata fixtures define its required failures. |
| 11.4-INT-001 | Every seeded role receives the generated real RLS read/write boundary over the active tenant-table inventory; anonymous and cross-tenant denials remain | Integration (local Supabase) | P0 | The generated role-harness and enrichment metadata are absent, so the test cannot enumerate an authoritative obligation set. |
| 11.4-INT-002 | Every seeded role has a real denied command rejected before validation, lookup, audit, or side effect | Integration (local Supabase) | P0 | The command-enrollment metadata/harness does not exist; the fixture contract makes a non-vacuous target mandatory. |
| 11.4-INT-003 | Roles/count/effective-permission reads deny indistinguishably for non-Admin, anonymous, missing member, and Tenant-B target | Integration (local Supabase) | P0 | The guarded server read projection does not exist. |
| 11.4-E2E-001 | Admin opens existing `/admin/users`, selects `Roller`, sees exact catalogue/count guidance, and opens a multi-role effective-permissions viewer | E2E | P1 | The existing page has no Roles tab or viewer; resilient Swedish accessible-locator assertions will fail. |
| 11.4-E2E-002 | A non-Admin receives no Roles UI and the existing `/admin/users` direct route remains denied | E2E | P1 | The future journey’s negative lane shares the established direct-route boundary and guards against a presentation bypass. |
| 11.4-STATIC-001 | Source and produced client bundle never contain matrix authority or a server credential | Static/source containment | P0 | Extends the existing containment seam once the new server-only catalogue module is added. |

**Red-phase rule:** every generated scaffold uses `test.skip()`; none uses `todo`, `only`, or inverted expectations. Integration scaffolds deliberately name future contracts inside skipped bodies, and browser scaffolds assert the approved UI contract through accessible Swedish names. The test suite must become green only when the implementation adds the server-only projection and manifest-derived harness; any newly revealed pre-existing Phase A policy/command gap is an owner block rather than an in-scope repair.

## Step 4 — Red-Phase Scaffold Generation and Aggregation

- **Execution:** subagent mode, capability probe enabled. API and browser workers completed and supplied valid JSON handoffs; no persistent service or browser session was started.
- **TDD red compliance:** 7 scaffolds, each with `test.skip()`, expected-to-fail markers, concrete assertions, and no placeholder assertion. API/integration: 4. Browser: 3.
- **Generated test artifacts:**
  - `C:\DEV\ElproSaas\tests\integration\rls\role-harness.atdd.int.test.ts` — generated case cardinality/coherence, real RLS/denied-command obligation loop, active-only counts/effective grant projection, and indistinguishable denial probes.
  - `C:\DEV\ElproSaas\tests\e2e\auth\admin-user-management-roles.atdd.e2e.spec.ts` — Admin Roles cards, multi-role effective-permissions viewer, and non-Admin direct-route/UI denial.
- **Non-destructive aggregation:** the API worker proposed appending to the existing Story 11.2 `role-aware-phase-a-surface.atdd.int.test.ts`. To preserve that owned test, its Story 11.4 scaffolds were emitted as the separate `role-harness.atdd.int.test.ts` file instead.
- **Fixture handoff:** green phase needs the future `tests/support/authz/role-harness.ts` generated-case builder, a cleanup-safe two-tenant/local-Supabase role fixture (Admin, non-Admin, anonymous, foreign, missing, and active multi-role identities), and the existing E2E fixture’s verified active multi-role shared account. No fixture implementation was created during red scaffolding because it is itself a Story 11.4 harness seam.
- **Playwright Utils deviations:** `@seontechnologies/playwright-utils` is absent from `package.json` and `pnpm-lock.yaml`; the browser scaffold imports the repository’s configured `@playwright/test` and records the one-line deviation. It uses no raw endpoint interception, response wait, sleep, or console logging.
- **Artifact linking:** the story specification was intentionally left unchanged. Its ATDD artifact links are recorded here as directed.

## Implementation Checklist

- [ ] Add the server-only role-catalogue/read DTO seam. It must derive five stored roles, active manifest rows and waves, concrete entitlements, active-only current-tenant counts, and deterministic union grant annotations.
- [ ] Add the test-support role harness from manifest, matrix, RLS inventory, and command metadata. Require exact unique cases and fail on absent, duplicate, unknown, activation-missing, or drifted entries.
- [ ] Extend the local-Supabase factory with cleanup-safe lifecycle-state, active multi-role, foreign, missing, anonymous, Admin, and non-Admin probes. Activate each P0 integration scaffold one at a time and observe red before implementation.
- [ ] Add `Roller` and `Effektiva behörigheter` to the existing `/admin/users` surface using presentation DTOs only. Preserve the existing direct-route boundary and no-data denial behavior.
- [ ] Activate each P1 browser scaffold after the relevant UI is present. The semantic role, heading, label, and text locators need no `data-testid` additions.
- [ ] Keep the role matrix and all privilege resolution server-only; complete existing source/bundle containment evidence after the catalogue module exists.

## Red → Green → Refactor

1. Remove `test.skip()` from one current-task scaffold.
2. Run its focused command and confirm its assertion fails because the named seam is missing or incomplete.
3. Implement only the seam needed to satisfy that assertion, then rerun it until green.
4. Refactor with the focused test still green and repeat for the next scaffold.

## Validation and Handoff

- **Story:** `11.4`; source handoff: `C:\DEV\ElproSaas\_bmad-output\implementation-artifacts\spec-11-4-roles-surface-effective-permissions-and-the-per-role-test-harness.md`.
- **Primary level:** local-Supabase integration, with thin browser presentation proof.
- **Test collection executed:** `pnpm exec vitest run tests/integration/rls/role-harness.atdd.int.test.ts` — exit 0; 1 file and 4 tests skipped as intended.
- **Browser collection executed:** `pnpm exec playwright test --list tests/e2e/auth/admin-user-management-roles.atdd.e2e.spec.ts` — exit 0; 3 skipped red-phase scenarios discovered.
- **Type checking executed:** `pnpm run typecheck` — exit 0.
- **Green-phase commands:** `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/rls/role-harness.atdd.int.test.ts`; `pnpm exec playwright test tests/e2e/auth/admin-user-management-roles.atdd.e2e.spec.ts`; then the story verification command set.
- **External mocks:** N/A. This story has no external service boundary or HTTP API contract.
- **Data-testid requirements:** N/A. The browser scaffolds use accessible Swedish roles, headings, labels, and text, which are the product contract here.
- **Persistent resources / CLI sessions:** none started; none require cleanup.
- **Next workflow:** implementation (`bmad-build-auto`/the orchestrator’s development step), then automation expansion only after the relevant seams are green.

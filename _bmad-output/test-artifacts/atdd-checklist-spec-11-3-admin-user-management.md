---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-10'
storyId: '11.3'
storyKey: 'spec-11-3-admin-user-management'
storyFile: 'C:/DEV/ElproSaas/_bmad-output/implementation-artifacts/spec-11-3-admin-user-management.md'
atddChecklistPath: 'C:/DEV/ElproSaas/_bmad-output/test-artifacts/atdd-checklist-spec-11-3-admin-user-management.md'
generatedTestFiles:
  - 'C:/DEV/ElproSaas/tests/unit/admin-users/admin-user-service.test.ts'
  - 'C:/DEV/ElproSaas/tests/unit/admin-users/accept-invitation.test.ts'
  - 'C:/DEV/ElproSaas/tests/integration/commands/admin-user-management.int.test.ts'
  - 'C:/DEV/ElproSaas/tests/integration/rls/admin-user-management.rls.test.ts'
  - 'C:/DEV/ElproSaas/tests/e2e/auth/admin-user-management.atdd.e2e.spec.ts'
inputDocuments:
  - 'C:/DEV/ElproSaas/_bmad/tea/config.yaml'
  - 'C:/DEV/ElproSaas/_bmad-output/implementation-artifacts/spec-11-3-admin-user-management.md'
  - 'C:/DEV/ElproSaas/package.json'
  - 'C:/DEV/ElproSaas/playwright.config.ts'
  - 'C:/DEV/ElproSaas/tests/e2e/auth/role-aware-phase-a-surface.atdd.e2e.spec.ts'
  - 'C:/DEV/ElproSaas/tests/integration/rls/membership-self-grant.rls.test.ts'
  - 'C:/DEV/ElproSaas/tests/integration/commands/disabled-membership-no-access.int.test.ts'
  - 'C:/DEV/ElproSaas/tests/factories/tenants.ts'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-atdd/resources/tea-index.csv'
---

# ATDD Checklist: Story 11.3 — Admin User Management

## Preflight and context

- **Mode:** Create
- **Detected stack:** frontend (Next.js/React with Playwright; the repository has no separate backend-project manifest)
- **Test framework:** Playwright + Vitest are configured and established test directories, factories, local-stack gates, and browser fixtures are present.
- **Story status:** `ready-for-dev`; five explicit acceptance criteria and a detailed I/O matrix are present.
- **TEA flags:** Playwright Utils enabled; browser automation `auto`; Pact.js Utils enabled but no contract-test relevance was identified; Pact MCP configuration was noted and no broker query is needed.
- **Knowledge loaded:** core factory, quality, healing, selector, timing, fixture, and network-first guidance; the mandated Playwright Utils guidance and UI/API helpers; Playwright CLI guidance; Pact MCP fallback guidance.

### Acceptance scope extracted

1. Admin-only Users UI submits all lifecycle commands and displays server-confirmed outcomes in `Händelser`.
2. Expired, revoked, and superseded invitation links fail database acceptance without granting access.
3. The serialized command rejects a disable, end, or role downgrade of the last active Admin and preserves access.
4. A shared Auth user losing a membership in one tenant loses only that tenant, retains history, and requires a fresh invitation to return.
5. Retry/reconciliation preserves single-effect membership mutation, exposes durable outcome, and never claims duplicate delivery.

### Existing patterns to extend

- Browser acceptance specs authenticate through `tests/e2e/.auth/fixture.json`, wait for hydration, and use accessible role/label selectors.
- Integration proofs use `createTwoTenantFixture`, authenticated anon-key clients, an independent `adminQuery` readback, and `SUPABASE_TEST_REQUIRED=1` to prevent unavailable-stack skips from counting as coverage.
- Membership tests prove RLS-denied direct DML and validate persisted state through a separate privileged readback.

Proceeding autonomously with the Create workflow.

## Generation mode

- **Chosen mode:** AI generation.
- **Rationale:** The acceptance criteria describe standard server-authorized lifecycle, invitation, tenancy, audit, and navigation behavior. The target UI and routes have not been implemented, so recording would not yield reliable selectors or behavior evidence. Scaffolds will use the established accessible-selector and fixture conventions, and will stay red until the Story 11.3 implementation exists.

## Test strategy

| ID | Acceptance scenario | Level and target | Priority | Red-phase assertion |
| --- | --- | --- | --- | --- |
| ATDD-11.3-01 | Admin completes invite, resend, revoke, reset, disable/reactivate, re-role, and end; outcome appears in Users and `Händelser`. | E2E `tests/e2e/auth/admin-user-management.atdd.e2e.spec.ts` | P0 | Expected Admin route, named actions, dialog confirmations, and server-confirmed event panel do not exist. |
| ATDD-11.3-02 | Expired, revoked, and superseded tokens cannot bind a membership or grant access. | Unit `tests/unit/admin-users/accept-invitation.test.ts`; integration command/RLS lanes | P0 | Token validator, stored-attempt authorization, and operation schema do not exist. |
| ATDD-11.3-03 | Last active Admin cannot be disabled, ended, or downgraded; command serializes the invariant. | Integration `tests/integration/commands/admin-user-management.int.test.ts` | P0 | Hardened lifecycle wrapper and operation/audit persistence do not exist. |
| ATDD-11.3-04 | Shared Auth user loses access only in the selected tenant; history remains, later return needs a fresh membership/invite. | Integration RLS `tests/integration/rls/admin-user-management.rls.test.ts` | P0 | Partial live-membership uniqueness, ended history, and tenant isolation path do not exist. |
| ATDD-11.3-05 | Replayed, failed, and uncertain Auth operations retain single-effect mutation and durable result without duplicate-delivery claim. | Unit service + integration command lane | P0 | Admin service/operation reconciliation path does not exist. |
| ATDD-11.3-06 | Non-Admin sees no Users navigation and direct route has the established generic denial. | E2E browser lane | P1 | `rbac` activation, capability, navigation, and route are absent. |
| ATDD-11.3-07 | Auth-admin client cannot reach client bundles and service responses map to generic errors. | Unit service containment lane | P1 | Server-only Auth client and mapper do not exist. |

All acceptance-critical authorization, access-removal, token-validation, and operation-idempotency scenarios are P0 because a false positive can grant or retain tenant access, corrupt audit history, or duplicate membership state. UI presentation and containment coverage are P1 because they protect the authorized surface and credential boundary. The scaffolds use independent privileged readbacks after anon-key/RLS denial, as established by existing integration tests. No Pact contract test is selected: the story uses Supabase Auth through a server-only adapter and has no independently versioned provider contract in scope.

## TDD Red Phase (current)

**Status: PASS — 14 skipped test cases across five scaffold files.** Each case uses `test.skip()` and asserts the expected post-implementation behavior; none uses a placeholder assertion. The suite remains safely skipped until the current implementation task replaces its dynamic/imported seams and activates the corresponding cases.

| Test file | Cases | Coverage |
| --- | ---: | --- |
| `tests/unit/admin-users/admin-user-service.test.ts` | 2 | durable Auth-operation/audit ordering; uncertain-operation reconciliation |
| `tests/unit/admin-users/accept-invitation.test.ts` | 2 | current authenticated invite acceptance; expired/revoked/superseded token denial |
| `tests/integration/commands/admin-user-management.int.test.ts` | 4 | serialized last-Admin disable/re-role/end denial; shared-account history; single-effect reconciliation |
| `tests/integration/rls/admin-user-management.rls.test.ts` | 2 | no direct membership/operation DML; tenant-B operation isolation with independent readback |
| `tests/e2e/auth/admin-user-management.atdd.e2e.spec.ts` | 4 | lifecycle result and `Händelser`; Admin nav/route guard; last-Admin result; shared-account experience |

### Acceptance-criteria traceability

1. **Lifecycle UI and auditable outcome:** P0 browser lifecycle case plus command integration cases require server-confirmed status and retained history.
2. **Invalid invitation acceptance:** P0 unit token cases require a generic denial and no activation for expiry, revocation, and supersession.
3. **Last active Admin:** P0 command cases exercise disable, end, and re-role against a single active Admin, requiring database-authorized rejection with unchanged membership/audit state; the browser case requires the outcome to be visible.
4. **Shared Auth account tenant isolation:** P0 command/RLS/browser cases require only the chosen tenant to lose access, with `ended` history retained.
5. **Retry/reconcile:** P0 service/command cases require a durable `operationId`, one membership effect, and an explicit `not-guaranteed` delivery outcome.

### Fixture and implementation prerequisites before activation

- Extend `createTwoTenantFixture` with a shared authenticated user active in both tenants, and add bounded admin readback helpers for lifecycle, operation, and audit rows.
- Extend the E2E fixture with a tenant Admin, same-tenant non-Admin, shared account, a non-final target member, and a distinct final-Admin scenario. The current fixture must supply real local credentials; none are invented by these scaffolds.
- Replace the current dynamic module seams with implemented `admin-user-service` and individual command modules, then remove `test.skip()` only as the matching task becomes implemented. For integration proof, run `SUPABASE_TEST_REQUIRED=1 pnpm run test:int`; a skipped unavailable local stack is not evidence.
- Browser selectors are accessible role/label selectors derived from the approved UI copy. They are unverified because `/admin/users` does not exist yet; record a browser snapshot after the route lands and adjust only selectors that differ from the implemented accessible names.

### Playwright Utils deviations

- `@seontechnologies/playwright-utils` is not installed. The unit/integration scaffolds use Vitest, and the E2E scaffold follows the repository's existing `@playwright/test` and hydration-helper convention. No unresolved package import or replacement fixture was added.
- The story has no independently versioned HTTP provider contract, so no Pact scaffold was generated.

### Implementation handoff

The story file was intentionally left unchanged. During Story 11.3 implementation, replace the dynamic import seams with the actual server-command exports, provision the listed fixtures, and remove `test.skip()` per completed task. First confirm each activated case fails for the missing behavior, then make it pass; retain the negative RLS and tenant-isolation assertions through green phase.

## Validation and completion

- **Scaffold count:** `rg` found 14 `test.skip()` calls and zero placeholder `expect(true).toBe(true)` assertions across the five generated files.
- **Unit collection:** Node's established unit runner collected four unit cases, all skipped, with zero failures.
- **Integration collection:** Vitest collected six command/RLS cases, all skipped, with zero failures. Do not treat this as local-stack evidence; once activated, use `SUPABASE_TEST_REQUIRED=1 pnpm run test:int`.
- **Browser collection:** Playwright listed four browser cases successfully without launching the application.
- **Fixtures and mocks:** N/A for RED scaffolding. Required local fixture/factory additions and the server-only Supabase Auth fake are documented above; no fake credentials, service keys, or custom email transport was created.
- **Selectors:** The browser scaffold uses existing accessible role/label conventions. No `data-testid` attribute is required at this stage; the implementation must preserve the listed Swedish accessible names or update the tests after recording the implemented surface.
- **Story handoff:** `storyId`, `storyKey`, original story path, checklist path, and the generated files are captured in frontmatter. The story was not edited by explicit task constraint.

### Activation checklist for implementation

1. Implement the migration, hardened wrappers, and server-only Auth adapter for the matching unit/integration case.
2. Replace only that case's dynamic import seam with the real exported module and remove its `test.skip()`.
3. Run the focused test. It must fail before implementation and pass afterward; use the required local-stack integration command for RLS/command cases.
4. Implement the Admin route, nav capability, UI actions, and event panel; provision browser fixtures; record selectors; then activate the matching browser case.
5. Retain all skipped cases outside the task being implemented until their prerequisite behavior exists.

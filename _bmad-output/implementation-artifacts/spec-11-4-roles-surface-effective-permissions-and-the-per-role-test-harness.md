---
title: 'Story 11.4: Roles Surface, Effective Permissions, and the Per-Role Test Harness'
type: 'feature'
created: '2026-09-11'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: 'd939a8e9f1b1618d1195abea4e7eda1c5a9efa5f'
baseline_commit: 'NO_VCS'
context:
  - '_bmad-output/implementation-artifacts/epic-11-context.md'
  - '_bmad-output/implementation-artifacts/spec-11-3-admin-user-management.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The active RBAC matrix already authorizes the Phase A surface, but Admins cannot inspect its role grants or a member's effective union, and CI proves only representative rather than complete role-by-table-and-capability boundaries.

**Approach:** Extend the existing Admin `Användare & roller` destination with server-derived role and effective-permissions presentation, then make manifest, matrix, RLS inventory, command metadata, and test enrollment generate a fail-loud authorization harness for every future activation.

## Boundaries & Constraints

**Always:** Keep the five stored tenant roles and the matrix server-authoritative, deny unknown or empty role sets, and derive role/module/capability rows only from the active scope manifest and current matrix. The Roles tab must show the exact label `Aktiva medlemmar`: for each role, count only memberships in the current tenant with `status='active'` and that assigned role; exclude invited, expired, revoked, disabled, and ended memberships; count one membership once per assigned role, so role totals may exceed distinct active people. This informational count never changes authorization. Annotate effective grants deterministically and project only presentation DTOs into client components. Preserve RLS, generic denials, structural sensitive-field withholding, multi-role union semantics, no-audit-on-denial behavior, and the existing `/admin/users` route boundary.

**Block If:** The complete generated suite reveals a pre-existing Phase A policy or command-boundary gap. Do not broaden or repair that existing policy outside the approved Epic 11 scope without explicit owner approval.

**Never:** Do not add a new admin route or top-level nav item, client-side matrix authority, a database permission table, tenant-custom roles, a tenant-wide `Arbetsledare` role, a migration, Auth lifecycle behavior, or Phase B/C module surface. `Arbetsledare` remains job-scoped and is explained as such only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Roles catalogue | Admin opens `Användare & roller → Roller` | Five seed roles expose stable Swedish presentation, active-module matrix rows/waves, concrete sensitive entitlements, and `Aktiva medlemmar` counts | Read failure renders the established generic Admin error, never partial authority data |
| Effective permissions | Admin opens a multi-role member's `Effektiva behörigheter` | Server DTO unions grants, emits each active module/capability once, and names every granting role deterministically | Unknown/empty roles, missing membership, foreign membership, non-Admin, and anonymous callers receive indistinguishable denial/no data |
| Count-state boundary | Current-tenant memberships span all lifecycle states | Only active memberships count, once for each assigned role; foreign rows never contribute | Expired/revoked/invited/disabled/ended rows cannot inflate the display count |
| Harness coherence | Active manifest, matrix, inventory, command registry, and test enrollment are aligned | Stable unique role × table/capability cases prove allowed paths and denied read/write/command boundaries | Missing, duplicate, or unknown metadata; missing activation enrollment; or policy drift fails loud with an identified case |

</intent-contract>

## Code Map

- `C:\DEV\ElproSaas\src\server\authz\roles.ts` and `permission-matrix.ts` -- closed five-role authority, normalized multi-role union, matrix/sensitive-entitlement resolution, and active-module matrix coverage; keep these server-only.
- `C:\DEV\ElproSaas\src\scope\manifest.ts` and `manifest-schema.ts` -- active-module and wave authority; extend coherence only through derived manifest/matrix/test enrollment checks, never a parallel surface list.
- `C:\DEV\ElproSaas\src\server\authz\phase-a-surface.ts`, `require-capability.ts`, and `C:\DEV\ElproSaas\src\server\commands\envelope.ts` -- existing active-route and command-capability derivations that the harness must consume rather than duplicate.
- `C:\DEV\ElproSaas\src\features\admin-users\read.ts`, `C:\DEV\ElproSaas\src\app\(app)\admin\users\page.tsx`, `UsersPage.tsx`, and `UserDetailPanel.tsx` -- Admin read/UI boundary; add server-derived Roles/effective-permissions DTOs and tabs without shipping matrix authority or hard-coded role vocabulary to the client.
- `C:\DEV\ElproSaas\supabase\migrations\20260910165124_admin_user_management.sql` and `C:\DEV\ElproSaas\src\server\auth\resolve-tenant-context-core.ts` -- read-only lifecycle/access evidence: the persisted status domain includes invited, expired, revoked, active, disabled, and ended; only active membership can resolve tenant access.
- `C:\DEV\ElproSaas\tests\integration\rls\tenant-table-inventory.ts`, `role-aware-phase-a-surface.atdd.int.test.ts`, and `C:\DEV\ElproSaas\tests\factories\tenants.ts` -- generalize the representative fixture and inventory into manifest-traceable generated cases while retaining anon and cross-tenant negatives.
- `C:\DEV\ElproSaas\tests\unit\server\authz\{permission-matrix,phase-a-surface,require-capability}.test.ts`, `C:\DEV\ElproSaas\tests\unit\scope\manifest-coherence.test.ts`, and `C:\DEV\ElproSaas\tests\e2e\auth\admin-user-management.atdd.e2e.spec.ts` -- existing unit, coherence, containment, and Admin/non-Admin browser lanes to extend.

## Tasks & Acceptance

**Execution:**

- `C:\DEV\ElproSaas\src\server\authz\role-catalogue.ts`, `C:\DEV\ElproSaas\src\features\admin-users\read.ts`, and `C:\DEV\ElproSaas\src\app\(app)\admin\users\page.tsx` -- add a server-only catalogue and presentation DTO/read path for seed-role cards, current active-module matrix rows/waves, deterministic effective-grant annotations, and active-only per-role counts from one tenant-scoped query.
- `C:\DEV\ElproSaas\src\components\admin-users\UsersPage.tsx` and `UserDetailPanel.tsx` -- add `Användare`/`Roller` tabs, the Roles cards/grid, the read-only effective-permissions viewer, and clear job-scoped `Arbetsledare` copy; consume DTOs only and preserve direct-route protection.
- `C:\DEV\ElproSaas\tests\support\authz\role-harness.ts`, `C:\DEV\ElproSaas\tests\integration\rls\tenant-table-inventory.ts`, `C:\DEV\ElproSaas\src\server\commands\envelope.ts`, and `C:\DEV\ElproSaas\src\scope\manifest-schema.ts` -- establish validated, derived test enrollment/metadata for active modules, tenant tables, and command capabilities; generate stable unique complete cases, exact cardinality checks, and biting missing/duplicate/unknown/drift fixtures.
- `C:\DEV\ElproSaas\tests\unit\server\authz\role-catalogue.test.ts`, `C:\DEV\ElproSaas\tests\unit\scope\manifest-coherence.test.ts`, and `C:\DEV\ElproSaas\tests\integration\rls\role-aware-phase-a-surface.atdd.int.test.ts` -- prove the DTO/count contract, harness cardinality and activation bite, policy-to-matrix agreement, every seeded role's real denied command and RLS boundary, and no audit side effect on denied commands.
- `C:\DEV\ElproSaas\tests\e2e\auth\admin-user-management.atdd.e2e.spec.ts` and existing source/bundle containment checks -- prove the Admin Roles/effective-permissions journey and non-Admin direct-route denial while preventing server matrix/role authority from entering the browser bundle.

**Acceptance Criteria:**

- Given an Admin selects `Användare & roller → Roller`, when the view loads, then exactly the five seed roles show stable descriptions, manifest-active module rows with activating waves, concrete sensitive-field entitlements, `Aktiva medlemmar`, and job-scoped `Arbetsledare` guidance without pending-module or owner-decision placeholders.
- Given memberships in every lifecycle state and a multi-role active membership, when role counts are computed, then only current-tenant active memberships count once per assigned role and the count has no authorization effect.
- Given an Admin opens a multi-role member's effective permissions, when the server projects the viewer, then active module/capability rows are unique, the union is correct, and every grant names its granting role deterministically.
- Given a non-Admin, anonymous caller, missing membership, or Tenant A Admin targeting Tenant B, when Roles, counts, or effective permissions are requested, then no data or existence signal is exposed.
- Given a module activates or authorization metadata drifts, when the generated harness runs, then it produces exact unique seeded-role × active-table/capability obligations and fails CI for missing matrix/test enrollment, unknown/duplicate metadata, policy drift, or a denied command that reaches validation, lookup, or audit.

## Spec Change Log

## Review Triage Log

### 2026-09-11 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4 (high 4)
- defer: 0
- reject: 10 (low 10)
- addressed_findings:
  - `[high]` `[patch]` Made command capability enrollment fail closed and added a bidirectional registry test.
  - `[high]` `[patch]` Replaced module-wide table permission inference with explicit per-table projection capabilities.
  - `[high]` `[patch]` Added generated role-by-command envelope probes with denied-result and no-audit checks.
  - `[high]` `[patch]` Added lifecycle-aware role-card projection coverage and concrete table-by-role adapters. The first adapter failure was corrected after the current role-aware RLS policy established it as a deliberately all-role tenancy-context read rather than an admin-management capability.

### 2026-09-11 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 7 (high 1, medium 5, low 1)
- defer: 0
- reject: 5 (low 5)
- addressed_findings:
  - `[high]` `[patch]` Registered production command declarations can no longer override the capability that the authorization harness validates, while explicit unregistered test commands retain their existing contract.
  - `[medium]` `[patch]` Historical inactive memberships now project no effective grants, and legacy primary roles remain visible until normalized role rows exist.
  - `[medium]` `[patch]` A failed member read suppresses the Roles authority display instead of rendering zero-count catalogue cards.
  - `[low]` `[patch]` Sensitive-entitlement presentation is constrained to manifest-active modules.
  - `[medium]` `[patch]` Role-harness metadata now rejects missing or stale table capability, direct-RLS, and projection-adapter entries.
  - `[medium]` `[patch]` Effective-permission tests assert the complete active matrix union and its granting-role labels.

## Design Notes

The catalogue is a presentation projection, not an alternate authorization engine. A role card answers what a current active member of that role can do; invitation and history lifecycle states remain visible in the Users surface but do not inflate that operational count. The generated harness must use the manifest/matrix/command and RLS sources it checks, so future activation work cannot hand-author a smaller representative sample that leaves CI green.

## Suggested Review Order

Author: Story 11.4 follow-up fix author.
Current-tenant scoping, complete Admin-read pagination, and independent command-enrollment verification were delivered in PR #55. The PR #59 documentation fix author refreshed the evidence and completion metadata against merged source `5cc08d2b15b161e4742ddddc3283be4a3c03a059`, preserving the implementation author's rationale and review stops below.

### Current-tenant roles presentation

The Roles page and member detail now resolve the same membership-derived current tenant used by commands and route access before reading. This corrects the multi-tenant Admin case without changing the approved active-only count or effective-permission policy.

- `src/features/admin-users/read.ts:32` — `resolveTenantContext`: derives the current tenant before the list/count projection.
- `src/features/admin-users/read.ts:49` — `resolveTenantContext`: derives the same tenant before a direct member-detail read.
- `src/features/admin-users/read.ts:52` — `tenant_id`: scopes the detail membership lookup, preserving generic no-data behavior for another tenant.

### Complete membership and role projection

The read model uses stable root ordering and bounded child-ID groups because PostgREST caps unbounded responses. Any late page error clears the whole projection, so the UI never presents partial authority data or partial counts.

- `src/features/admin-users/read-model.ts:35` — `readAdminUsersForTenant`: owns the complete current-tenant projection.
- `src/features/admin-users/read-model.ts:36` — `readAllPages`: paginates memberships with stable `created_at` and `id` ordering.
- `src/features/admin-users/read-model.ts:48` — `membershipIdBatch`: bounds child-role reads and paginates every batch with stable role ordering.

### Independent enrollment and focused evidence

The command registry is independently cross-checked from source declarations rather than relying only on the envelope's registry-derived tests. The focused regression suites exercise tenant scoping, full root and child pages, and a late-page failure; they do not replace required live RLS validation.

- `tests/support/authz/command-enrollment.ts:126` — `scanProductionCommandDeclarations`: parses all production source outside the envelope before registry comparison.
- `tests/support/authz/command-enrollment.ts:138` — `validateProductionCommandEnrollment`: rejects missing, stale, duplicate, and explicit-capability drift.
- `tests/unit/admin-users/read-pagination.test.ts:73` — `Admin role counts collect every membership`: proves roots and a full child-role page are collected.
- `tests/unit/admin-users/read-pagination.test.ts:96` — `a later membership page failure`: proves a late root-page error returns no partial authority data.
- `tests/unit/admin-users/read-pagination.test.ts:114` — `a later child-role page failure`: proves a late child-page error also returns no partial authority data.
- `tests/integration/read-models/admin-users-current-tenant.test.ts:40` — `resolves the current tenant`: mocks the production entry point and checks both queries use its resolved tenant.
- `tests/integration/rls/admin-users-current-tenant-counts.rls.test.ts:25` — `a multi-tenant Admin`: uses a real authenticated client to distinguish broad RLS visibility from the current-tenant projection.

Historical focused evidence: pure read-model tests passed 4/4; mocked production-read Vitest test passed 1/1. The independent enrollment worker reported its focused suite passed 4/4. The prior focused review passed 71 distinct unit tests and 240 synthetic core cases.

Release evidence: post-merge main CI [34839174668](https://github.com/rthunborg/ElproSaas/actions/runs/34839174668) passed at `5cc08d2`: 1,751 unit tests / 0 skipped; 101 required integration/RLS files / 1,023 passed / 0 skipped, including the real authenticated multi-tenant count and invitation-identity regressions; 136 browser tests passed / 4 skipped. Typecheck, lint, build, and containment checks passed. This is recorded CI execution, not a new application test run for the documentation fix. [Release verification](../../docs/quality/epic-11-release-verification-2026-09-14.md) records the deployed revision and evidence limits.

Limits: the earlier local Supabase outage and skipped regression remain historical non-coverage; the required CI run above supplies executed database evidence. The invitation-identity release blocker is closed as fixed, verified, and deployed. Generated command probes still establish the shared envelope boundary rather than every business mutation body. NFR remains CONCERNS; the retrospective remains rejected for the separate unimplemented reset-retry seam, and advisory test maintenance remains open.

## Verification

**Commands:**

- `pnpm run typecheck` and `pnpm run lint` -- presentation DTOs, client/server boundaries, and exhaustive metadata compile and lint cleanly.
- `pnpm run test:unit` -- catalogue, effective-union, count-state, manifest/coherence, cardinality, and deliberate-drift cases pass.
- `supabase db reset --local`; then `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` -- generated RLS/command/policy agreement cases execute with zero skips and preserve anon/cross-tenant negatives.
- `pnpm run test:e2e` -- Admin can use Roles/effective permissions and a non-Admin is denied the current Admin route.
- `pnpm run verify:service-role-containment`; `pnpm build`; `pnpm run verify:bundle-containment` -- no server matrix/role authority or privileged credential reaches client output.

## Auto Run Result

The initial run and follow-up results below are historical. The post-release reconciliation at the end of this section records the current completion status and review recommendation.

Summary: Added a server-derived five-role catalogue and effective-permissions presentation to `/admin/users`, including active-only role counts, Swedish grant annotations, and job-scoped `Arbetsledare` guidance. Added a manifest/matrix/inventory/command-derived authorization harness with explicit direct-RLS exceptions for existing tenancy-context and sensitive-table contracts.

Files changed:
- `src/server/authz/role-catalogue.ts` -- server-only role-card, entitlement, and effective-union DTOs.
- `src/features/admin-users/read.ts`, `src/app/(app)/admin/users/page.tsx`, and `src/components/admin-users/*` -- server-projected Roles and effective-permissions UI.
- `src/server/commands/envelope.ts` -- fail-closed command capability enrollment.
- `tests/support/authz/role-harness.ts` and role-harness tests -- derived command/table obligations, explicit operation semantics, and RLS/command boundary execution.
- `tests/e2e/auth/admin-user-management-roles.atdd.e2e.spec.ts`, fixtures, and unit tests -- active Admin and non-Admin browser coverage plus deterministic lifecycle/count coverage.

Review findings: 4 high-severity patches applied, 0 deferred, 10 low-severity findings rejected. The cross-model reviewer command exited successfully but produced no output, so it is not counted as review evidence.

Historical follow-up review recommendation: true. Patched findings: high 4, medium 0, low 0; score is high-triggered.

Verification: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test:unit` (1,731 passed), `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` (97 files, 1,016 passed, 0 skipped), focused role harness integration (5 passed, 0 skipped; 145 table-by-role cases), containment checks, build, and full guarded Playwright E2E (`test-results/.last-run.json` reports passed with no failed tests).

Residual risks: command harness probes execute the real envelope authorization gate for each registered command name but deliberately do not invoke individual business mutation bodies; existing valid-payload command suites remain responsible for body behavior. Direct table read exceptions are explicitly tied to existing RLS policy contracts rather than broadened matrix grants.

### 2026-09-11 — Follow-up review result

Summary: Corrected lifecycle-accurate effective permission presentation, legacy-role fallback, error-state authority suppression, active-only sensitive entitlements, and fail-loud authorization-harness metadata checks. Registered command declarations now cannot diverge from their harnessed capability metadata.

Files changed:
- `src/server/authz/role-catalogue.ts` and `src/features/admin-users/read.ts` — lifecycle-safe effective grants and normalized-role fallback.
- `src/app/(app)/admin/users/page.tsx` and `src/components/admin-users/UsersPage.tsx` — suppress catalogue authority data on a failed Admin read.
- `src/server/commands/envelope.ts` — reject capability overrides for registered commands.
- `tests/support/authz/role-harness.ts` and unit tests — validate complete table metadata and exact effective-grant projection.

Review findings: patches applied 7 (high 1, medium 5, low 1); deferred 0; rejected 5. The configured cross-model command was run once but produced no output artifact, so it is not review evidence.

Historical follow-up review recommendation: true. Score: `3 × 5 + 1 × 1 = 16`.

Verification: `pnpm run typecheck`; `pnpm run lint`; `pnpm run test:unit` (94 suites, 1,734 tests); `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` (97 files, 1,016 tests, 0 skips); source containment; full Playwright (`test-results/.last-run.json`: passed, no failed tests); `pnpm run build`; built-bundle containment.

Residual risks: the generated command harness intentionally proves the shared production envelope boundary rather than each individual business mutation body. Existing direct-RLS exceptions for tenant context and raw quote-review/acceptance tables remain intentional policy distinctions, verified outside generic matrix grants.

### 2026-09-14 — Pre-approval checkpoint metadata (historical)

Focused review at `49394f3c04b8cac6101d3ed007156fd546c3e51d` reviewed the PR #55 bounded corrections at `dcb718c53d8aab7245d9d3e24776d2a33581bf1b`: current-tenant role-count scoping, complete membership/child-role pagination, and independent production command enrollment. Result: no new consequential defect; all 13 author review stops were valid. The reviewer ran no new commands. Recorded CI run `34712355388` passed 1,748 units, 1,020 required integration/RLS tests with zero skips, and 134 browser tests with four skips.

At this checkpoint, Story 11.4 remained `review` pending human approval; the focused review alone did not authorize approval, merge, deployment, or closure of the separate invitation-identity security finding. The post-release reconciliation below supersedes that pending status. The prior cross-model CLI's empty output remains historical unavailable evidence.

### 2026-09-14 — Post-release reconciliation

Current status: `done`; `followup_review_recommended: false`, matching the Story 11.4 execution state and sprint tracker. The owner-approved sequence merged PR #57 (`9dd6e74`), PR #58 (`7b0b991`), and PR #55 (`5cc08d2`) and deployed the merged migrations and application. The recorded focused reviews, completed human checkpoint, and release evidence close the Story 11.4 follow-up recommendation and retrospective actions 1–3. The earlier no-output cross-model invocations are still excluded from review evidence.

The Suggested Review Order above links the passing CI and release verification for the merged revision. Story delivery and Epic 11 are complete in sprint status; the separate reset-retry correctness seam keeps the retrospective rejected, NFR remains CONCERNS, and advisory test maintenance remains open. Completion was reconciled after release without a sanctioned Auto-BMAD phase flip, so both execution records retain `bmad_status_flipped_at: null`.

Documentation-fix verification: the review-order reference checker validated all 13 stops. Targeted state readback, tracker/metadata consistency, relative-link resolution, unchanged intent-contract comparison, and `git diff --check` passed. Application tests were not rerun for this documentation-only correction.

### Final closure reconciliation — 2026-09-16

Story 11.4 remains `done` with `followup_review_recommended: false`; no status change is needed. The Epic 11 closure supersedes the historical reset-retry statement. The role/RBAC delivery is complete; separate operational observation and advisory-maintenance items remain NFR concerns and are tracked by the Epic retrospective.

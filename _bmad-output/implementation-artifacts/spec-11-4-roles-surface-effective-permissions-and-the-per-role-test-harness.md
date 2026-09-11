---
title: 'Story 11.4: Roles Surface, Effective Permissions, and the Per-Role Test Harness'
type: 'feature'
created: '2026-09-11'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
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

## Design Notes

The catalogue is a presentation projection, not an alternate authorization engine. A role card answers what a current active member of that role can do; invitation and history lifecycle states remain visible in the Users surface but do not inflate that operational count. The generated harness must use the manifest/matrix/command and RLS sources it checks, so future activation work cannot hand-author a smaller representative sample that leaves CI green.

## Verification

**Commands:**

- `pnpm run typecheck` and `pnpm run lint` -- presentation DTOs, client/server boundaries, and exhaustive metadata compile and lint cleanly.
- `pnpm run test:unit` -- catalogue, effective-union, count-state, manifest/coherence, cardinality, and deliberate-drift cases pass.
- `supabase db reset --local`; then `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` -- generated RLS/command/policy agreement cases execute with zero skips and preserve anon/cross-tenant negatives.
- `pnpm run test:e2e` -- Admin can use Roles/effective permissions and a non-Admin is denied the current Admin route.
- `pnpm run verify:service-role-containment`; `pnpm build`; `pnpm run verify:bundle-containment` -- no server matrix/role authority or privileged credential reaches client output.

## Auto Run Result

Summary: Added a server-derived five-role catalogue and effective-permissions presentation to `/admin/users`, including active-only role counts, Swedish grant annotations, and job-scoped `Arbetsledare` guidance. Added a manifest/matrix/inventory/command-derived authorization harness with explicit direct-RLS exceptions for existing tenancy-context and sensitive-table contracts.

Files changed:
- `src/server/authz/role-catalogue.ts` -- server-only role-card, entitlement, and effective-union DTOs.
- `src/features/admin-users/read.ts`, `src/app/(app)/admin/users/page.tsx`, and `src/components/admin-users/*` -- server-projected Roles and effective-permissions UI.
- `src/server/commands/envelope.ts` -- fail-closed command capability enrollment.
- `tests/support/authz/role-harness.ts` and role-harness tests -- derived command/table obligations, explicit operation semantics, and RLS/command boundary execution.
- `tests/e2e/auth/admin-user-management-roles.atdd.e2e.spec.ts`, fixtures, and unit tests -- active Admin and non-Admin browser coverage plus deterministic lifecycle/count coverage.

Review findings: 4 high-severity patches applied, 0 deferred, 10 low-severity findings rejected. The cross-model reviewer command exited successfully but produced no output, so it is not counted as review evidence.

Follow-up review recommendation: true. Patched findings: high 4, medium 0, low 0; score is high-triggered.

Verification: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test:unit` (1,731 passed), `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` (97 files, 1,016 passed, 0 skipped), focused role harness integration (5 passed, 0 skipped; 145 table-by-role cases), containment checks, build, and full guarded Playwright E2E (`test-results/.last-run.json` reports passed with no failed tests).

Residual risks: command harness probes execute the real envelope authorization gate for each registered command name but deliberately do not invoke individual business mutation bodies; existing valid-payload command suites remain responsible for body behavior. Direct table read exceptions are explicitly tied to existing RLS policy contracts rather than broadened matrix grants.

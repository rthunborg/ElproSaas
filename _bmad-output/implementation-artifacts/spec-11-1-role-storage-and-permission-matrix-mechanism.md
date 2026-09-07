---
title: 'Story 11.1: Role Storage and Permission-Matrix Mechanism'
type: 'feature'
created: '2026-09-04'
status: 'blocked'
baseline_revision: '4189d8c59da27b61f4e92c8463431a31a68e8639'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-11-context.md'
  - '_bmad-output/project-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The application authorizes only the scalar `tenant_admin` role, while Phase B requires versioned multi-role capability decisions and a fail-loud link between every active manifest module and its permission definition.

**Approach:** Add the additive multi-role storage and hardened role predicate, introduce a typed code-owned permission matrix with a command-envelope capability seam, and extend manifest coherence so active scope cannot outpace the matrix. This story establishes the mechanism only; applying it to every existing Phase A surface is Story 11.2.

## Boundaries & Constraints

**Always:** Keep `tenant_admin` as the stored Admin literal (Swedish label: Företagsadmin), preserve `is_tenant_admin()` semantics, derive roles server-side from the resolved active membership, and evaluate a role set as a union. The legacy scalar role remains a member of that set so existing Admin memberships retain access with no data migration. Absence, unknown roles, unknown module/capability, malformed matrix data, and omitted entitlement input deny by default. `membership_roles` must be tenant-scoped, same-tenant constrained, RLS-protected, explicitly granted, manifest/H4 enrolled, and use the established hardened DEFINER-helper construction for role predicates. Sensitive values remain absent-plus-listed when withheld.

**Block If:** Stop if the design needs a database permission table, tenant-runtime-mutable/custom roles, a change to `is_tenant_admin()` behavior, a data rewrite of existing memberships, or an authority model for job-scoped Arbetsledare.

**Never:** Do not add RBAC UI, navigation/landing changes, invite/admin lifecycle flows, broad Phase-A RLS or command rollout, customer-facing entitlement masking, custom email, or job-scoped assignment enforcement. Do not expose a matrix as client-side authority, add a service-role app path, or replace generic authorization failures with existence-revealing errors.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Existing Admin | Active legacy membership; no child rows | Resolved role set contains `tenant_admin`; existing access remains valid | No migration/backfill required |
| Multiple roles | Active membership plus distinct child roles | Effective permissions are the union; a sensitive field is entitled when any held role grants it | Duplicate child assignment is rejected by DB uniqueness |
| Capability denial | Unknown/ungranted module-capability or inactive/no-role membership | `requireCapability` yields generic `PERMISSION_DENIED`; command does not execute or audit | No target/existence detail crosses boundary |
| Matrix drift | Active manifest module lacks matrix rows | Coherence validation reports a dedicated violation | CI/unit guard fails loud |
| RLS predicate abuse | Cross-tenant, inactive, or search-path-tampered caller | `has_tenant_role` is false | No role is inferred from caller input or shadowed objects |

</intent-contract>

## Code Map

- `supabase/migrations/20260625122433_tenant_foundation.sql` -- current singleton role CHECK, membership lifecycle, hardened membership predicates, explicit grants, and RLS policies; additive migration must preserve these contracts.
- `src/server/auth/tenant-context.ts`, `resolve-tenant-context.ts`, and `resolve-tenant-context-core.ts` -- current scalar-admin context/query/core; evolve to a normalized server-derived role-set without trusting a client tenant id.
- `src/server/commands/envelope.ts` and `envelope-core.ts` -- typed post-membership gate seam; failed gates already short-circuit before execute/audit.
- `src/server/commands/command-errors.ts` -- stable command-error union/message map; add the distinct generic `PERMISSION_DENIED` code.
- `src/server/read-models/entitlements.ts` and `quote-pipeline.ts` -- existing `{ data, entitlements: { withheld } }` and injectable role seam; replace local Admin-only entitlement lookup with matrix-backed pure resolution, but leave Phase-A read rollout to 11.2.
- `src/scope/manifest.ts`, `manifest-schema.ts`, and `nav-registry.ts` -- active-module source, reserved `requiredCapability`, and the explicit EB-A5 matrix-coherence carve-out to complete without making pending E11 a live surface.
- `tests/unit/scope/manifest-coherence.test.ts` -- invert the current EB-A5 carve-out into real positive and biting matrix-missing coverage.
- `tests/factories/tenants.ts`, `tests/integration/rls/tenant-table-inventory.ts`, `cross-tenant-isolation.rls.test.ts`, `membership-self-grant.rls.test.ts`, and `security-definer-search-path.rls.test.ts` -- parallel-safe fixture, H4 enrollment, denial, and hardened-helper proof patterns.

## Tasks & Acceptance

**Execution:**

- `supabase/migrations/20260904120000_role_storage_and_permission_matrix.sql` -- additively widen the legacy role constraint; add `membership_roles` with tenant/membership same-tenant integrity, role-domain checks, unique membership×role rows, explicit grants/RLS, and the hardened `has_tenant_role(target_tenant_id, allowed_roles)` helper that checks the legacy role plus child assignments without changing `is_tenant_admin()`.
- `src/server/authz/roles.ts`, `permission-matrix.ts`, and `require-capability.ts` -- define the closed five-role type, typed `satisfies` matrix keyed by active module/capability with sensitive-field rows, pure union/lookup/entitlement resolution, and generic deny-by-default capability result using the owner-defined business keys.
- `src/server/auth/tenant-context.ts`, `resolve-tenant-context.ts`, and `resolve-tenant-context-core.ts` -- fetch and normalize only server-visible active membership roles, retain membership-derived tenant selection and active-first resolution, and return the role set while preserving existing Admin compatibility.
- `src/server/commands/envelope.ts`, `envelope-core.ts`, and `command-errors.ts` -- add an explicit module/capability declaration seam and run `requireCapability` immediately after context resolution when declared; return `PERMISSION_DENIED` before validation, ownership, execute, or audit. Existing Phase-A command declarations and their role-aware enforcement remain 11.2 work.
- `src/server/read-models/entitlements.ts` -- consume the matrix-sensitive-field resolver while preserving structural absence and conservative omitted-input behavior; do not broaden Phase-A data exposure here.
- `src/scope/manifest-schema.ts`, `manifest.ts`, and `tests/unit/scope/manifest-coherence.test.ts` -- add an injected/pure matrix-coverage coherence rule for every active module, wire the real matrix without duplicating rows or importing client authority, and enroll `membership_roles` under active `foundation` rather than activating the pending `rbac` module.
- `tests/unit/server/authz/permission-matrix.test.ts`, `tests/unit/server/authz/require-capability.test.ts`, `tests/unit/server/auth/resolve-tenant-context.test.ts`, and `tests/unit/scope/manifest-coherence.test.ts` -- pin unknown/empty inputs, role-union and legacy-Admin compatibility, matrix/missing-matrix behavior, and capability no-audit denial.
- `tests/integration/rls/membership-roles.rls.test.ts`, `tests/integration/rls/has-tenant-role.rls.test.ts`, `tests/integration/rls/migration-reset.int.test.ts`, `tests/integration/rls/tenant-table-inventory.ts`, and `tests/factories/tenants.ts` -- prove migration/RLS/H4 enrollment, same-tenant child integrity, and positive/negative hardened-helper/search-path behavior using a real local stack.

**Acceptance Criteria:**

- Given an existing active Admin membership with no `membership_roles` rows, when context and capability resolution run, then its role set contains `tenant_admin` and no existing membership data is rewritten.
- Given an active membership holding two allowed roles, when a capability or sensitive field is resolved, then permission is granted when either role grants it and withheld only when neither does.
- Given any absent, unknown, inactive, cross-tenant, or ungranted authorization input, when a capability/predicate is evaluated, then it fails closed with generic `PERMISSION_DENIED` or false and performs no command side effect/audit.
- Given an active manifest module with no matrix rows, when manifest coherence is validated, then the dedicated missing-matrix violation is emitted; given the real manifest and matrix, then validation remains green.
- Given an authenticated caller attempts to forge child roles, traverse another tenant, or shadow helper dependencies through `search_path`, when RLS/helper checks run, then the attempt is denied and the independent integration readback proves no unauthorized row changed.
- Given Story 11.1 is complete, when the active Phase-A routes, per-role RLS policies, nav, landing, or admin UI are considered, then they remain unchanged and are explicitly reserved for Stories 11.2–11.4.

## Design Notes

The scalar `tenant_memberships.role` is retained as the compatibility role; `membership_roles` adds roles rather than replacing it. This preserves all existing Admin rows without a data migration while presenting one de-duplicated server-resolved role set to the matrix and RLS helper. Matrix coverage is validated from the matrix source, never mirrored into manifest data; the coherence validator therefore detects activation drift without creating a second authority.

## Verification

**Commands:**

- `pnpm run typecheck` -- expected: role/matrix and exhaustive inventory types compile.
- `pnpm run test:unit` -- expected: matrix, context, entitlement, and manifest-coherence unit cases pass.
- `supabase db reset` -- expected: empty local schema accepts the additive migration and exact policy checks.
- `pnpm run test:int` -- expected: role-storage, RLS, H4, cross-tenant, and hardened-helper negatives run against the local stack.
- `pnpm run lint` -- expected: changed source/test files pass lint.

## Auto Run Result

Status: blocked
Blocking condition: implementation verification failed

Verification detail: `supabase db reset` could not connect to Docker Desktop's `dockerDesktopLinuxEngine` pipe. `pnpm run test:int` therefore ran its non-DB guards (87 files / 46 tests passed) but dynamically skipped the 890 DB-backed integration/RLS tests, including the Story 11.1 matrix coverage. CI's `db` job remains the configured environment for the required `supabase start` → migration reset → `pnpm run test:int` path.

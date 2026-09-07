---
title: 'Story 11.1: Role Storage and Permission-Matrix Mechanism'
type: 'feature'
created: '2026-09-04'
status: 'in-review'
baseline_revision: '4189d8c59da27b61f4e92c8463431a31a68e8639'
review_loop_iteration: 0
followup_review_recommended: true
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

Status: in-review
Blocking condition: none

Verification detail: CI run https://github.com/rthunborg/ElproSaas/actions/runs/34105099398 on `bc634ab` reports `verify=success`, `db=success`, and `e2e=success`. The `db` job executed the clean Supabase reset plus the required integration/RLS tests, resolving the local-only Docker blocker.

Fresh verification: CI run https://github.com/rthunborg/ElproSaas/actions/runs/34121027063 on `396c446f1aed74cb1a5c556640f8cd2477f46f42` reports `verify=success`, `db=success`, and `e2e=success`; `ci_wait` also passed in 649 seconds. The `db` job performed a clean Supabase migration reset and the required integration/RLS gates. This supersedes the earlier code evidence because the review pass changed the database migration.

### 2026-09-07 — Follow-up review blocked

Prior status: blocked
Prior blocking condition: explicit approval was required to provide the private repository diff and referenced files to the configured external Luna/xhigh reviewer.

Completed fresh layers: Blind Hunter, Edge Case Hunter, Verification Gap Reviewer, Intent Alignment Auditor, and Sol/xhigh Security Reviewer (`No findings`). The external reviewer was not counted as completed: its default read-only invocation failed with `Error finding codex home: Could not find home directory`; the scoped escalated retry was policy-rejected because it could export private repository material. No alternate invocation was attempted.

Triage to date found no verified new patch, bad-spec, intent-gap, or deferred item. The proposed scalar/non-admin access concerns are not reachable in the current Phase-A surface: `tenant_memberships_select_own` remains guarded by `is_tenant_admin(tenant_id)`, so a non-admin cannot obtain a membership row before the resolver, child-role query, or protected app shell. Existing CI evidence remains the exact successful run above; no local DB/service was started and no production code changed during this follow-up pass.

### 2026-09-07 — Resume authorization

The user explicitly approved providing this private story's diff and referenced repository files to the configured OpenAI Codex reviewer. This authorization is limited to the previously blocked external Luna/xhigh review layer; it does not broaden task or repository authority.

## Review Triage Log

### 2026-09-07 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6 (high 2, medium 3, low 1)
- defer: 0
- reject: 13
- addressed_findings:
  - `[high]` `[patch]` Restricted `membership_roles` SELECT to active tenant admins and added a non-admin enumeration regression test.
  - `[medium]` `[patch]` Added a database-backed resolver assertion that child roles from another membership never enter the selected context.
  - `[medium]` `[patch]` Added matrix-authorized `projektledare` and `ekonomi` entitlement-projection assertions.
  - `[medium]` `[patch]` Added the generic `SERVER_ERROR` resolver path for a failed child-role query.
  - `[low]` `[patch]` Added a child-role domain-check regression test.
  - `[high]` `[patch]` Luna/xhigh cross-model review found that newly-valid non-admin scalar roles could directly forge same-tenant audit records through `record_audit_event`; the Story migration now retains the Phase-A `is_tenant_admin` boundary and the RLS regression asserts `42501`.
  - `[reject]` Luna/xhigh also reported that manifest coherence did not fail loudly at import. The downstream invariant is the mandatory real-manifest unit case, which calls `validate(real, { permissionMatrix: PERMISSION_MATRIX })` and asserts an empty violation set; a missing active-module matrix row therefore fails CI. The export comment is imprecise but there is no reachable bypass.

### 2026-09-07 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 16
- addressed_findings:
  - none

External Luna/xhigh review was not completed because the required scoped escalation was policy-rejected pending explicit approval to provide the private diff and referenced repository files. The completed local layers' proposed non-admin role-resolution and Phase-A shell concerns were rejected after checking the existing `tenant_memberships_select_own` RLS predicate: it requires `is_tenant_admin(tenant_id)`, so a scalar non-admin cannot reach the resolver or shell in the current release.

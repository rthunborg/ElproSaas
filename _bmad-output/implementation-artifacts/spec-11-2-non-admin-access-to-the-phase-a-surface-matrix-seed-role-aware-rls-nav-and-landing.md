---
title: 'Story 11.2: Non-Admin Access to the Phase A Surface (Matrix Seed, Role-Aware RLS, Nav and Landing)'
type: 'feature'
created: '2026-09-07'
status: 'ready-for-dev'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-11-context.md'
  - '_bmad-output/implementation-artifacts/spec-11-1-role-storage-and-permission-matrix-mechanism.md'
  - '_bmad-output/project-context.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 11.1 added a closed multi-role vocabulary, code-owned matrix, capability gate, and hardened `has_tenant_role` helper, but all Phase A navigation, landing, membership resolution, commands, and data policies still admit only `tenant_admin`. Non-admin roles therefore cannot enter their intended surface, while any partial UI-only rollout would leave direct reads and writes unsafe.

**Approach:** Seed the owner-approved N-4 matrix for the seven active modules, then derive the server-visible Phase A surface from it: role-aware membership and module RLS, declared command capabilities, server-rendered navigation/landing/direct-route handling, and entitlement-safe read projections. Prove policy/matrix agreement and each seeded role's denied boundary without changing stored records or activating deferred modules.

## Boundaries & Constraints

**Always:** Keep `tenant_admin` as Företagsadmin and preserve `is_tenant_admin()` semantics. Resolve roles only from the cookie-bound server context; the role union is authoritative and all unknown, empty, inactive, invited, cross-tenant, or malformed inputs deny by default. Use the Story 11.1 hardened `has_tenant_role` helper with explicit authenticated grants and both `USING`/`WITH CHECK` for write policies. The N-4 defaults are binding: Montör never receives sales price, cost, or contribution margin; Säljare receives sales prices but no cost/TB unless separately entitled; Projektledare, Ekonomi, and Admin receive all three. Withheld fields and dependent aggregates are structurally absent and listed in `entitlements.withheld`; stored öre and calculations are unchanged.

**Block If:** A required Phase A route needs a sensitive inline value client-side for display/computation, role-gating breaks existing pilot Admin workflows, or any required role behavior depends on job-scoped assignment/Arbetsledare before its later job-members story.

**Never:** Do not add database permission tables, custom/runtime-mutable roles, service-role client paths, a permission matrix import reachable from client code, user/role administration or role-change audit UI (Story 11.3), `/my-day`, job-member enforcement, deferred-module nav/routes, companion-table retrofits to carried Phase A tables, or a new data migration beyond additive policy evolution.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Legacy Admin | Active scalar `tenant_admin`; no child rows | Retains every current Phase A route, capability, command, and data path | No rewrite/backfill |
| Seeded role union | Active scalar/child roles include one grant | Server exposes only the union-granted nav, landing, commands, and rows | Duplicate/order does not change outcome |
| Crafted denial | Unentitled role requests a route, action, PostgREST row, export, or sensitive aggregate | Generic denial/no rows; no audit or existence signal; withheld value is absent plus listed | Never return `0`, `null`, partial aggregate, SQL detail, or role-derived client fallback |
| Jobs assignment seam | Montör/Projektledare has no `job_members` assignment model | No false whole-tenant grant from `Jobs.ViewAssigned`; Montör uses the existing money-withheld dashboard fallback until E15 redirects it to `/my-day` | Preserve E16 job-scoped work as deferred |

</intent-contract>

## Code Map

- `src/server/authz/permission-matrix.ts`, `roles.ts`, and `require-capability.ts` -- Story 11.1's server-only closed role/matrix and generic fail-closed gate; current active-module seed is Admin-only except quote sales price.
- `src/server/commands/envelope.ts` and `envelope-core.ts` -- optional capability declaration already executes after context resolution and before validation, ownership, execution, or audit; current Phase A command declarations omit it.
- `src/server/auth/resolve-tenant-context.ts`, `resolve-tenant-context-core.ts`, and `src/app/(app)/layout.tsx` -- server context/presentational boundary; current membership policy prevents non-Admin resolution and the layout ships all static nav.
- `src/scope/manifest.ts`, `manifest-schema.ts`, `nav-registry.ts`, `src/components/app-shell/nav-items.ts`, `AppShell.tsx`, and `src/app/page.tsx` -- active-manifest nav grounding, authored visual metadata, client shell, and current unconditional `/dashboard` landing; intersection and landing must be server-derived without bundling authority.
- `supabase/migrations/20260625122433_tenant_foundation.sql`, `20260904120000_role_storage_and_permission_matrix.sql`, `20260907161230_role_storage_explicit_grants.sql`, and the CRM/settings/pricing/calculation/quote/job/file migrations -- current Admin-only policies and the reusable hardened helper/grant baseline; new policy evolution must preserve existing row locks, grants, tenant FKs, Storage isolation, and append-only/no-delete posture.
- `src/features/{crm,calculations,pricing,quotes,jobs,files}/read.ts` and corresponding command/action directories -- RLS-scoped Phase A reads and shared-envelope mutations; files/jobs/calculation detail reads have cross-module dependencies that must not disclose inaccessible owner labels or financial values.
- `src/server/read-models/entitlements.ts` and `quote-pipeline.ts` -- existing absent-plus-listed projection seam, including conservative omitted-role behavior.
- `tests/factories/tenants.ts`, `tests/integration/rls/{membership-roles,has-tenant-role,cross-tenant-isolation,migration-reset,tenant-table-inventory}.test.ts`, `tests/integration/server/auth/resolve-tenant-context.int.test.ts`, and `tests/unit/{server/authz,server/read-models,scope}/**` -- isolated tenant/role fixtures, hardened-helper/RLS patterns, policy catalog proof, and pure matrix/entitlement/nav tests.

## Tasks & Acceptance

**Execution:**

- `src/server/authz/permission-matrix.ts` and focused authz/entitlement unit tests -- replace the transitional Admin-only seed with the owner-approved N-4 capabilities, sensitive-field entitlements, and explicit role arrays for all active manifest modules; retain deny-by-default, union semantics, the Säljare non-invertible margin warning seam, and no fabricated page-named authority.
- `supabase/migrations/` -- generate `role_aware_phase_a_policy_evolution` with `supabase migration new`, then evolve membership/child-role self-read and all active Phase A module policies from Admin-only to the matrix-authored role arrays using `has_tenant_role`; preserve active membership, self/cross-tenant, row-scope, `WITH CHECK`, Storage, lifecycle-lock, direct-DML, and explicit-grant invariants. Keep module-level closure for carried inline-rate tables when a role cannot safely receive their fields.
- `src/server/commands/{crm,calculations,pricing,settings,quotes,jobs,files}/**` with shared command tests -- declare the precise stable business capability for every exported Phase A mutation so denial occurs before validation, target lookup, execute, or audit; do not relax raw audit/RPC authority or create multi-write client paths.
- `src/server/auth/resolve-tenant-context.ts`, `src/scope/{manifest,manifest-schema,nav-registry}.ts`, `src/components/app-shell/{nav-items,AppShell}.tsx`, `src/app/(app)/layout.tsx`, `src/app/page.tsx`, and route/read guards -- derive a safe presentational nav DTO and deterministic server `resolveLandingRoute(roleSet)` from active manifest × matrix; hide inaccessible links, send dashboard-entitled roles (including the current Montör fallback) to `/dashboard` with money withheld, switch Montör to `/my-day` only in E15, and render generic direct-route denial without client role evaluation.
- `src/features/*/read.ts`, read-model projections, and UI components using `MaskedValue`/table columns -- enforce role-safe Phase A reads and cross-module labels; omit withheld fields/columns and aggregates rather than substituting values, and keep exports/PDF/serialized payloads on the same recipient-specific projection contract.
- `tests/{unit,integration,e2e}/**` and `tests/factories/tenants.ts` -- add parallel-safe role fixtures and generated/table-driven per-role × active-module proof: policy-to-matrix catalog agreement, one denied command and one RLS read/write negative per role/module, non-admin context resolution, legacy Admin continuity, nav/landing/direct-route behavior, structural sensitive serialization, and a thin granted-surface browser journey.

**Acceptance Criteria:**

- Given each active Phase A module and every seeded role, when an authenticated user enters the app, then the server-derived nav and landing expose only matrix-granted routes; dashboard-entitled roles, including Montör's current E15-safe fallback, land on `/dashboard` with protected values withheld; direct navigation and crafted actions/queries outside that set receive an indistinguishable generic denial with no data, target signal, or audit side effect.
- Given role-aware policy evolution, when an allowed and an unentitled role read or write each module's tables, then policies match the matrix-derived arrays, preserve tenant and row scope, allow only the intended path, and the agreement suite fails on deliberate matrix/policy drift.
- Given an unentitled Montör or Säljare reads any money-bearing Phase A surface, export, payload, or aggregate, when it contains a protected price/cost/margin component, then the value/aggregate is absent and declared withheld; UI omits or masks it without changing persisted money or calculation results.
- Given a legacy Admin and a multi-role active member, when context/capabilities resolve, then legacy Admin access remains unchanged and either held role grants the union-valid capability, while unknown, inactive, invited, cross-tenant, or empty roles fail closed.
- Given Phase A lacks `job_members`, when the matrix is applied to jobs, then no tenant-wide job visibility is inferred from assignment-only semantics and no E16/Arbetsledare behavior is shipped.

## Design Notes

The matrix is the server authority; client nav keeps only authored label/icon metadata. Migration SQL cannot import TypeScript, so it records policy arrays authored from the matrix and the database-catalog agreement suite is the fail-loud drift bridge. RLS is the security floor; entitlement projection makes the safe response deterministic for the UI. Carried Phase A inline-rate tables close at module level for roles that cannot receive their rows, while future Phase B schemas use companion economy tables.

## Verification

**Commands:**

- `pnpm run typecheck` -- expected: exhaustive matrix, command declarations, navigation DTOs, and tenant inventory compile.
- `pnpm run lint` and `pnpm run test:unit` -- expected: authz, entitlement, manifest/nav, landing, and serialization boundaries pass.
- `supabase db reset` then `pnpm run test:int` -- expected: additive migration resets cleanly and policy/matrix, RLS, tenant isolation, Storage, denied-DML/no-audit, and H4 tests pass on the required local stack.
- `pnpm run test:e2e` -- expected: role-appropriate server landing/nav plus a granted route pass without browser-visible protected values.

## Auto Run Result

Status: ready-for-dev
Blocking condition: none

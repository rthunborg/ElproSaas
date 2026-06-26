---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests']
lastStep: 'step-03-generate-tests'
lastSaved: '2026-06-26'
inputDocuments:
  - _bmad-output/implementation-artifacts/2-2-tenant-membership-schema-rls-helpers-and-two-tenant-fixtures.md
  - _bmad-output/test-artifacts/test-design-epic-2.md
  - supabase/migrations/20260625122433_tenant_foundation.sql
  - src/server/auth/resolve-tenant-context.ts
  - tests/factories/tenants.ts
  - tests/factories/admin-sql.ts
---

# Test Automation Expansion — Story 2.2 (Tenant Membership Schema, RLS Helpers, Two-Tenant Fixtures)

## Mode & Stack

- **Mode:** BMad-Integrated (story 2.2 + test-design-epic-2 loaded).
- **Detected stack:** backend (DB-backed RLS/helper layer over local Supabase; Vitest runner).
- **Framework:** present — `vitest.config.ts`, `tests/support/global-setup.ts`, `tests/factories/**`. `pnpm run test:int` runs against the LOCAL Supabase stack (reset first). No framework HALT.
- **Baseline:** 70 unit + 35 DB-backed integration/RLS tests, all green (verified: `test:int` = 6 files / 35 tests pass against local stack).

## Existing coverage (do NOT duplicate)

- Cross-tenant SELECT/INSERT/UPDATE/DELETE denied on `tenants` + `tenant_memberships` (authenticated app path).
- Self-grant / self-escalation denied; role/status CHECK-constraint bite.
- SECURITY DEFINER search-path hijack negative + control + review-note marker.
- Migration-reset object presence (tables, helpers, SECDEF+empty search_path, CHECKs, RLS enabled+forced, NOT NULL, exactly-two-SELECT-policies).
- Per-worker factory isolation + forward-compat handle shape.
- Resolver AC1-AC4 (active→tenant; orphan/disabled→TENANT_MEMBERSHIP_REQUIRED; anon→UNAUTHENTICATED; forged tenant_id ignored).

## Genuine coverage GAPS targeted (new tests)

| # | Gap | Level | Priority | Rationale (isolation/RLS/helper guarantee not yet proven) |
|---|-----|-------|----------|-----------------------------------------------------------|
| G1 | `anon` (unauthenticated) raw-table read/write isolation | INT/RLS | P0 | The `anon → NOTHING` GRANT + no policy is asserted only indirectly via resolver `UNAUTHENTICATED`; no test drives `makeAnonServerClient()` directly at `tenants`/`tenant_memberships` proving zero rows + denied writes. |
| G2 | `anon` cannot EXECUTE the RLS helpers (membership-probing oracle) | INT/RLS | P0 | `REVOKE EXECUTE … FROM public; GRANT … TO authenticated, service_role` is load-bearing least-privilege; untested. An anon-callable helper would be a cross-tenant existence oracle. |
| G3 | Helper semantics: `invited`/`disabled` member denied; `is_active_tenant_member` vs `is_tenant_admin` divergence on a non-active member | INT/RLS | P0 | Helpers are the authority behind every policy. Only the resolver-level disabled case is tested; the helpers themselves are never exercised across the active/invited/disabled axis, nor is the role-clause path proven. |
| G4 | FK `on delete cascade` (tenant delete + auth-user delete remove memberships; no dangling authorization rows) | INT | P1 | Cascade is load-bearing for cleanup and the "no dangling authorization rows" invariant; entirely untested. |
| G5 | Within-tenant read SCOPE of `tenant_memberships_select_own`: an admin reads a SECOND membership in their OWN tenant but still ZERO of Tenant B's | INT/RLS | P1 | The positive within-tenant breadth of the SELECT policy (admin sees co-members of own tenant) is unverified; only the self-row read is covered. Confirms the policy does not over- or under-scope. |
| G6 | DB-backed `selectPreferredMembership` active-first ACROSS tenants (Task 7.2 real scenario) | INT | P1 | The UNIQUE(tenant_id,user_id) constraint makes multi-row only reachable across tenants. A user `disabled` in tenant X + `active` in tenant Y must resolve to Y. Covered only by a unit fake; no DB-backed proof of the actual cross-tenant selection. |

## Justification for scope

Selective. The existing suite is strong on the four-verb cross-tenant matrix for the authenticated path. The new tests close the **anonymous-path**, **helper-level**, **cascade**, **within-tenant-breadth**, and **cross-tenant-preferred-selection** gaps — each a distinct tenant-isolation/RLS guarantee with no current proof — without re-asserting any covered property. All new tests are DB-backed against the local stack, parallel-safe (per-call fixtures + unique ids), and skip cleanly when the stack is unreachable (matching the existing pattern).

## New test files (24 tests added)

- `tests/integration/rls/anon-path-isolation.rls.test.ts` (10) — G1/G2: anon-key no-session SELECT/INSERT/UPDATE/DELETE denied on both tables; anon cannot EXECUTE either RLS helper (verified: `42501 permission denied for function`).
- `tests/integration/rls/helper-semantics.rls.test.ts` (9) — G3: `is_active_tenant_member` / `is_tenant_admin` across active/invited/disabled + cross-tenant + no-membership; the two predicates' Phase-A agreement.
- `tests/integration/rls/membership-integrity.int.test.ts` (5) — G4 FK on-delete-cascade (tenant + auth-user); G5 within-tenant SELECT breadth with no cross-tenant leak; G6 DB-backed active-first resolution across tenants (+ disabled-in-both → denied).

## Verification

- `pnpm run test:int` (local stack, `SUPABASE_TEST_REQUIRED=1`): 9 files / **59 tests pass** (was 35; +24).
- `pnpm run test:unit`: 70 pass (no regression).
- `pnpm typecheck`: clean (tests/integration re-enrolled). `pnpm lint`: clean.

## Finding surfaced (not a defect; stronger than assumed)

The migration grants table SELECT only to `authenticated`, NOT `anon`. So an anonymous SELECT is denied at the privilege layer (`42501 permission denied`) before RLS — a STRONGER guarantee than an RLS empty-set. The G1 SELECT assertions were written to accept "denied OR zero rows" (matching the suite's existing write-path convention) to encode this faithfully.

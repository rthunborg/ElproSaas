# ADR-B012: Integration Gate Privilege Baseline and Local Reliability

Status: decided for implementation — 2026-10-02.

Scope: the local required integration/RLS gate that blocks Story 14.1 completion. This is a prerequisite repair, not a change to Story 14.1 product scope, acceptance status, or the Phase B manifest.

## Owner approval

The owner approved a narrowly bounded repair after the corrected-target required gate recorded 1,081 passed, 156 failed, and 1 skipped across 124 files. The approved work may repair inherited effective privileges and local integration runner reliability so `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` can provide valid evidence. It may use only the existing verified loopback stack and forward migrations. It must not reset the database, edit migration history, rewrite applied migrations, remove or skip tests, weaken RLS/grant assertions, access hosted services, or change app/browser product behavior.

## Decision

`public.quote_follow_ups` is readable by authenticated tenant members through its existing RLS policy but has no authorized direct DML path. A forward migration must establish the effective ACL, including inherited `PUBLIC` privileges: revoke all table privileges from `PUBLIC`, `anon`, and `authenticated`, then grant only `SELECT` to `authenticated`. Existing `service_role` DML, RLS policies, checked/audited command wrappers, and function grants remain unchanged.

The migration-reset regression must inspect effective privileges with `has_table_privilege`, rather than relying only on `information_schema.role_table_grants`, because that view does not establish whether a role inherits a privilege through `PUBLIC`. The test continues to require authenticated select-only access and anon denial, together with existing direct-DML and cross-tenant RLS negatives.

The required integration runner may disable cross-file parallelism only if a corrected-target serial run proves that this resolves the observed independent two-second readiness-probe failures. It retains in-file test concurrency and every test file. The chosen setting belongs in the shared Vitest configuration so local and CI invocations execute the same reliable gate.

## Consequences

The database privilege baseline becomes explicit and forward-applicable on already-migrated environments. A serial file runner can increase wall time, but makes the required gate reliable while shared local Auth/PostgREST bootstrap capacity is bounded. No reset-dependent claim is created: the retained stack is used solely for forward application and execution evidence.

## References

- `supabase/migrations/20260719130000_quote_follow_ups.sql`
- `supabase/migrations/20260907171252_role_aware_phase_a_policy_evolution.sql`
- `tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts`
- `tests/support/test-env.ts`
- `vitest.config.ts`
- `_bmad-output/implementation-artifacts/spec-14-1-scheduling-activation-person-profiles-and-work-hours.md`

/**
 * ATDD RED-PHASE FACTORY CONTRACT — Story 2.2 (Tenant Membership Schema, RLS Helpers,
 * And Two-Tenant Fixtures). Blocker B1.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  RED-PHASE STUB — NOT YET IMPLEMENTED.                                    ║
 * ║                                                                          ║
 * ║  This module PINS the EXACT factory API that the Story 2.1 gated INT     ║
 * ║  scaffold already imports (`../../../factories/tenants` from             ║
 * ║  tests/integration/server/auth/) and that this story's new RLS negative  ║
 * ║  suites reference. It is a CONTRACT, not an implementation.              ║
 * ║                                                                          ║
 * ║  The REAL implementation lands in the Story 2.2 DEV phase, which:        ║
 * ║    - stands up the local Supabase stack (`supabase start` /              ║
 * ║      `supabase db reset`),                                                ║
 * ║    - creates the `tenants` / `tenant_memberships` migration + RLS,       ║
 * ║    - wires a real per-worker, auto-cleaning two-tenant fixture using the  ║
 * ║      Supabase admin (service-role) API — TEST-ONLY, confined to          ║
 * ║      `tests/factories/**`, NEVER imported into `src/`/`app/`/client       ║
 * ║      paths (the `check-service-role-containment.mjs` guard scans          ║
 * ║      `tests/` and would catch a `"use client"` leak).                     ║
 * ║                                                                          ║
 * ║  DO NOT install a runner, add the Supabase CLI to package.json, or       ║
 * ║  create any `supabase/migrations/**` file as a side effect of this       ║
 * ║  scaffold — those are the DEV phase's gated actions (story Task 1.1).     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * PARALLEL SAFETY (H5 / R-012 — required of the green-phase implementation):
 *   `createTwoTenantFixture()` MUST provision its OWN tenant pair per worker
 *   (unique names/ids, e.g. worker-id- or faker-suffixed) — NO shared mutable
 *   fixture across workers — and auto-clean (or rely on per-run `supabase db
 *   reset`) so runs are deterministic and parallel-safe.
 *
 * EXTENSIBILITY (B1 — required): the contract must extend cleanly to
 *   CRM/calculation/quote/file records in Epic 3+ WITHOUT rework. Keep the
 *   handle shape additive.
 *
 * AUTH-USER CREATION (B2): auth users are created via the Supabase admin API
 *   (service-role) with password-based / admin-created credentials — magic-link
 *   is NOT used for automated tests. The local stack must allow these without
 *   email confirmation (`config.toml` `[auth] enable_confirmations = false`).
 */

/**
 * A provisioned tenant row (subset of `tenants` the tests assert against).
 * `name` is NOT NULL in the schema (Story 2.1 resolver joins `tenants(name)`).
 */
export interface FixtureTenant {
  readonly id: string;
  readonly name: string;
}

/**
 * A provisioned auth user (subset of `auth.users` the tests need). The factory
 * holds the password so a real authenticated session can be established by
 * `makeAuthedServerClient`.
 */
export interface FixtureUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
}

/**
 * The two-tenant fixture handle. The 2.1 INT scaffold destructures exactly these
 * names — keep them stable so it un-skips without rewrites:
 *   { tenantA, tenantB, adminA, adminB, orphanUser }
 */
export interface TwoTenantFixture {
  /** Tenant A root. */
  readonly tenantA: FixtureTenant;
  /** Tenant B root (the "other" tenant for cross-tenant negatives). */
  readonly tenantB: FixtureTenant;
  /** Active `tenant_admin` of Tenant A. */
  readonly adminA: FixtureUser;
  /** Active `tenant_admin` of Tenant B. */
  readonly adminB: FixtureUser;
  /** Authenticated user with NO active membership in any tenant. */
  readonly orphanUser: FixtureUser;
}

/**
 * A minimal structural type for the per-request SSR/anon Supabase client the
 * tests drive. The green phase returns a real `@supabase/ssr` server client
 * (anon key only) bound to the given user's authenticated session. Kept loose
 * here so the red-phase contract type-checks without the runtime client.
 */
export type TestServerClient = unknown;

function notYetImplemented(api: string): never {
  throw new Error(
    `RED-PHASE: ${api} is a Story 2.2 factory contract stub. The real two-tenant ` +
      "fixture (local Supabase stack + admin/service-role user creation + per-worker " +
      "isolation) is built in the Story 2.2 dev phase. Suites that call it are " +
      "`describe.skip`-ed until then.",
  );
}

/**
 * Provision a fresh, per-worker two-tenant pair: two `tenants`, two active
 * `tenant_admin` users (one per tenant), and one authenticated-but-membership-less
 * "orphan" user. RED-PHASE STUB — see header.
 */
export async function createTwoTenantFixture(): Promise<TwoTenantFixture> {
  return notYetImplemented("createTwoTenantFixture()");
}

/**
 * Build a real per-request SSR/anon server client bound to `user`'s authenticated
 * session (anon key + RLS — the same path the app runtime uses). RED-PHASE STUB.
 */
export async function makeAuthedServerClient(
  user: FixtureUser,
): Promise<TestServerClient> {
  void user;
  return notYetImplemented("makeAuthedServerClient(user)");
}

/**
 * Build an UNAUTHENTICATED (anonymous) anon-key server client. RED-PHASE STUB.
 */
export async function makeAnonServerClient(): Promise<TestServerClient> {
  return notYetImplemented("makeAnonServerClient()");
}

/**
 * TWO-TENANT TEST FACTORIES (Story 2.2, blocker B1) — REAL implementation.
 *
 * Provisions a fresh, per-call two-tenant pair against the LOCAL Supabase stack
 * and hands back the exact handle shape the Story 2.1 gated INT scaffold and this
 * story's RLS negative suites import:
 *   { tenantA, tenantB, adminA, adminB, orphanUser }
 * plus `makeAuthedServerClient(user)` / `makeAnonServerClient()`.
 *
 * ─ Auth-user creation (B2): users are created via the Supabase ADMIN API
 *   (service-role) with a password, email pre-confirmed — magic-link is not used
 *   for automated tests, and the local stack has `enable_confirmations = false`.
 * ─ Service-role containment: the admin/service-role key is TEST-ONLY and lives
 *   ONLY in `tests/**` (the `check-service-role-containment.mjs` guard scans
 *   `tests/` and would catch a leak into a `"use client"` path). It is NEVER
 *   imported into `src/`/`app/`.
 * ─ Parallel safety (H5 / R-012): every call to `createTwoTenantFixture()`
 *   provisions its OWN tenants/users with globally-unique ids + names (uuid +
 *   monotonic suffix), so concurrent workers never share mutable fixture state.
 *   No `supabase db reset` between tests is required for isolation — the unique
 *   ids guarantee it — but CI resets once up-front for a clean baseline.
 * ─ Extensibility (B1): the handle is additive. Epic 3+ adds `customerA` /
 *   `quoteA` handles ALONGSIDE these without renaming or reshaping the existing
 *   five — the forward-compat smoke in factory-isolation.int.test.ts pins that.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  LOCAL_SUPABASE_URL,
} from "../support/test-env";
import { adminExec } from "./admin-sql";

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
 * The per-request anon-key Supabase client the tests drive. A real
 * `@supabase/supabase-js` client (anon key only, RLS-bound) — structurally
 * compatible with the `@supabase/ssr` server client the resolver expects
 * (`.auth.getClaims()` + `.from(...)`).
 */
export type TestServerClient = SupabaseClient;

/** Options for seeding a membership (used by the role/status CHECK negatives). */
export interface MembershipSeed {
  readonly tenant_id: string;
  readonly user_id: string;
  readonly role: string;
  readonly status: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

/** Monotonic per-process suffix so names are unique even within one worker. */
let seq = 0;
function uniqueSuffix(): string {
  seq += 1;
  // crypto.randomUUID() guarantees cross-worker uniqueness; seq disambiguates
  // multiple fixtures created back-to-back in the same worker.
  return `${Date.now().toString(36)}-${seq}-${crypto.randomUUID().slice(0, 8)}`;
}

/** The shared TEST-ONLY service-role admin client (bypasses RLS for setup). */
let adminClient: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      LOCAL_SUPABASE_URL,
      LOCAL_SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return adminClient;
}

/** Create a password-based, email-confirmed auth user via the admin API (B2). */
async function createAuthUser(label: string): Promise<FixtureUser> {
  const suffix = uniqueSuffix();
  const email = `${label}-${suffix}@example.test`;
  const password = `Pw-${suffix}-Aa1!`;

  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(
      `factory: failed to create auth user (${label}): ${error?.message ?? "no user returned"}`,
    );
  }
  return { id: data.user.id, email, password };
}

/** Insert a `tenants` row via the service-role client (bypasses RLS). */
async function createTenant(label: string): Promise<FixtureTenant> {
  const name = `${label} ${uniqueSuffix()}`;
  const { data, error } = await admin()
    .from("tenants")
    .insert({ name })
    .select("id, name")
    .single();
  if (error || !data) {
    throw new Error(
      `factory: failed to create tenant (${label}): ${error?.message ?? "no row returned"}`,
    );
  }
  return { id: data.id as string, name: data.name as string };
}

/**
 * Seed a membership via the service-role client (bypasses RLS). Exposed so the
 * role/status CHECK-constraint negatives can drive the admin path directly and
 * prove the CHECK bites (not RLS). Returns the inserted row; THROWS on DB error
 * (e.g. a CHECK violation) so `await expect(...).rejects` works.
 */
export async function adminInsertMembership(seed: MembershipSeed): Promise<void> {
  const { error } = await admin().from("tenant_memberships").insert(seed);
  if (error) {
    // Re-throw as an Error so the CHECK-constraint negatives can assert on it.
    throw new Error(error.message);
  }
}

/**
 * Provision a fresh, per-call two-tenant pair: two `tenants`, two ACTIVE
 * `tenant_admin` users (one per tenant), and one authenticated-but-membership-less
 * "orphan" user.
 */
export async function createTwoTenantFixture(): Promise<TwoTenantFixture> {
  const [tenantA, tenantB] = await Promise.all([
    createTenant("Tenant A"),
    createTenant("Tenant B"),
  ]);

  const [adminA, adminB, orphanUser] = await Promise.all([
    createAuthUser("admin-a"),
    createAuthUser("admin-b"),
    createAuthUser("orphan"),
  ]);

  await Promise.all([
    adminInsertMembership({
      tenant_id: tenantA.id,
      user_id: adminA.id,
      role: "tenant_admin",
      status: "active",
    }),
    adminInsertMembership({
      tenant_id: tenantB.id,
      user_id: adminB.id,
      role: "tenant_admin",
      status: "active",
    }),
  ]);
  // orphanUser intentionally gets NO membership row.

  return { tenantA, tenantB, adminA, adminB, orphanUser };
}

/**
 * Build a real per-request anon-key Supabase client bound to `user`'s
 * authenticated session (the same anon key + RLS path the app runtime uses).
 * Signs in with the user's password so `getClaims()` re-validates a real JWT.
 */
export async function makeAuthedServerClient(
  user: FixtureUser,
): Promise<TestServerClient> {
  const client = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) {
    throw new Error(
      `factory: failed to sign in fixture user ${user.email}: ${error.message}`,
    );
  }
  return client;
}

/** Build an UNAUTHENTICATED (anonymous) anon-key client (no session). */
export async function makeAnonServerClient(): Promise<TestServerClient> {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Best-effort cleanup of a fixture's auth users (memberships/tenants cascade on
 * user delete via the FK, and tenants are removed explicitly). Optional — runs
 * rely primarily on unique ids + the CI `db reset` for isolation, but cleaning up
 * keeps a long-lived local DB from accumulating fixtures.
 */
export async function cleanupFixture(fixture: TwoTenantFixture): Promise<void> {
  const userIds = [fixture.adminA.id, fixture.adminB.id, fixture.orphanUser.id];
  for (const id of userIds) {
    try {
      await admin().auth.admin.deleteUser(id);
    } catch {
      // best-effort
    }
  }
  // Remove the tenant rows (memberships already cascaded with the users).
  try {
    await adminExec(`delete from public.tenants where id = any($1::uuid[])`, [
      [fixture.tenantA.id, fixture.tenantB.id],
    ]);
  } catch {
    // best-effort
  }
}

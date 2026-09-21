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
import type { TenantRole } from "@/server/authz/roles";
import {
  assertLocalStack,
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  LOCAL_SUPABASE_URL,
} from "../../support/test-env";
import { adminQuery, adminSession } from "../admin-sql";

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
  /** Canonical tenant-scoped identity displayed by the Admin users read model. */
  readonly invited_email?: string;
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
export function admin(): SupabaseClient {
  if (!adminClient) {
    // Hard local-only fail-safe BEFORE any BYPASSRLS client is constructed — never
    // create/delete auth users or run service-role DML against a non-local project.
    assertLocalStack();
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
    // Preserve the PostgREST/Postgres error `code` (e.g. `23514` check_violation)
    // so the CHECK-negatives can assert on the SPECIFIC constraint that bit rather
    // than a loose message regex that an unrelated FK/unique error would also match
    // (review fix 2026-06-26).
    const wrapped = new Error(error.message) as Error & { code?: string };
    if (error.code) wrapped.code = error.code;
    throw wrapped;
  }
}

/**
 * The set of `tenant_memberships.status` values the schema CHECK permits
 * (migration 20260625122433_tenant_foundation.sql: `status in ('active',
 * 'invited', 'disabled')`). Only `active` grants access; `invited`/`disabled` MUST
 * resolve to no-access (TENANT_MEMBERSHIP_REQUIRED). Exported so the disabled/
 * invited → no-access negatives (Gap G-1) enumerate the non-active statuses by
 * data rather than a hand-copied literal.
 */
export const NON_ACTIVE_MEMBERSHIP_STATUSES = ["invited", "disabled"] as const;
export type NonActiveMembershipStatus =
  (typeof NON_ACTIVE_MEMBERSHIP_STATUSES)[number];

/**
 * Seed a `tenant_admin` membership of `user` in `tenant` with an explicit
 * `status`, via the admin/service-role path (B2 — never the self-grant app path,
 * which RLS denies). This is the minimal, well-scoped fixture capability the
 * disabled/inactive-membership → no-access negatives (Gap G-1) need: a LIVE
 * `disabled`/`invited` membership row that a real DB-backed resolve/envelope run
 * can then prove resolves to TENANT_MEMBERSHIP_REQUIRED — distinct from the
 * no-membership orphan case. THROWS (with the Postgres `code` preserved) on a DB
 * error, mirroring `adminInsertMembership`.
 *
 * Additive (B1): provided ALONGSIDE the existing handles; the two-tenant fixture
 * shape is unchanged. Reuse the fixture's `orphanUser` (which otherwise has NO
 * membership) as the subject so a single fixture exercises both the no-row and the
 * disabled/invited-row cases without perturbing the active admins.
 */
export async function seedMembership(opts: {
  readonly tenant: FixtureTenant;
  readonly user: FixtureUser;
  readonly status: NonActiveMembershipStatus | "active";
  readonly role?: string;
}): Promise<void> {
  await adminInsertMembership({
    tenant_id: opts.tenant.id,
    user_id: opts.user.id,
    role: opts.role ?? "tenant_admin",
    status: opts.status,
  });
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
 * Story 11.2's role-aware fixture.  It keeps the long-lived two-tenant shape
 * intact while adding one real authenticated member for every closed role, a
 * legacy-admin child-role union, and two non-active memberships.  All identities
 * are created through the local-only auth admin path and are removed by the paired
 * cleanup helper below.
 */
export interface RoleAwarePhaseAFixture {
  readonly base: TwoTenantFixture;
  readonly users: Readonly<Record<TenantRole, FixtureUser>>;
  readonly roleUnionUser: FixtureUser;
  readonly invitedUser: FixtureUser;
  readonly disabledUser: FixtureUser;
  readonly extraUsers: readonly FixtureUser[];
}

export type RoleAwarePhaseAUsers = Omit<RoleAwarePhaseAFixture, "base">;

/** Add real N-4 memberships to an existing isolated tenant fixture (also used by E2E setup). */
export async function seedRoleAwarePhaseAUsers(
  base: TwoTenantFixture,
): Promise<RoleAwarePhaseAUsers> {
  const [projektledare, montor, saljare, ekonomi, roleUnionUser, invitedUser, disabledUser] =
    await Promise.all([
      createAuthUser("role-projektledare"),
      createAuthUser("role-montor"),
      createAuthUser("role-saljare"),
      createAuthUser("role-ekonomi"),
      createAuthUser("role-union"),
      createAuthUser("role-invited"),
      createAuthUser("role-disabled"),
    ]);

  await Promise.all([
    adminInsertMembership({ tenant_id: base.tenantA.id, user_id: projektledare.id, role: "projektledare", status: "active" }),
    adminInsertMembership({ tenant_id: base.tenantA.id, user_id: montor.id, role: "montor", status: "active" }),
    adminInsertMembership({ tenant_id: base.tenantA.id, user_id: saljare.id, role: "saljare", status: "active" }),
    adminInsertMembership({ tenant_id: base.tenantA.id, user_id: ekonomi.id, role: "ekonomi", status: "active" }),
    adminInsertMembership({ tenant_id: base.tenantA.id, user_id: roleUnionUser.id, role: "tenant_admin", status: "active", invited_email: roleUnionUser.email }),
    adminInsertMembership({ tenant_id: base.tenantA.id, user_id: invitedUser.id, role: "saljare", status: "invited" }),
    adminInsertMembership({ tenant_id: base.tenantA.id, user_id: disabledUser.id, role: "montor", status: "disabled" }),
  ]);

  const membershipRows = await adminQuery<{ id: string }>(
    "select id from public.tenant_memberships where tenant_id = $1 and user_id = $2",
    [base.tenantA.id, roleUnionUser.id],
  );
  const membershipId = membershipRows[0]?.id;
  if (!membershipId) throw new Error("role-aware fixture: union membership was not created");
  await adminQuery(
    `insert into public.membership_roles (tenant_id, membership_id, role)
     values ($1, $2, 'projektledare'), ($1, $2, 'saljare')`,
    [base.tenantA.id, membershipId],
  );

  return {
    users: { tenant_admin: base.adminA, projektledare, montor, saljare, ekonomi },
    roleUnionUser,
    invitedUser,
    disabledUser,
    extraUsers: [projektledare, montor, saljare, ekonomi, roleUnionUser, invitedUser, disabledUser],
  };
}

export async function createRoleAwarePhaseAFixture(): Promise<RoleAwarePhaseAFixture> {
  const base = await createTwoTenantFixture();
  return { base, ...(await seedRoleAwarePhaseAUsers(base)) };
}

export async function cleanupRoleAwarePhaseAFixture(
  fixture: RoleAwarePhaseAFixture,
): Promise<void> {
  await cleanupFixture(
    { ...fixture.base, extraUsers: fixture.extraUsers } as TwoTenantFixture & {
      readonly extraUsers: readonly FixtureUser[];
    },
  );
}

/**
 * Build a real per-request anon-key Supabase client bound to `user`'s
 * authenticated session (the same anon key + RLS path the app runtime uses).
 * Signs in with the user's password so `getClaims()` re-validates a real JWT.
 */
export async function makeAuthedServerClient(
  user: FixtureUser,
): Promise<TestServerClient> {
  assertLocalStack();
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

/**
 * Delete a single `auth.users` row via the admin/service-role path. The minimal,
 * well-scoped capability the `actor_user_id ON DELETE SET NULL` persistence negative
 * (Gap G-6) needs: it removes the actor so the FK action can be observed. THROWS on a
 * real delete error (so the test fails loudly), unlike `cleanupFixture`'s best-effort
 * teardown which only warns. Idempotent enough for tests — a subsequent best-effort
 * cleanup delete of the same id simply no-ops/warns.
 */
export async function deleteAuthUser(userId: string): Promise<void> {
  assertLocalStack();
  const { error } = await admin().auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(
      `factory: failed to delete auth user ${userId}: ${error.message}`,
    );
  }
}

/** Build an UNAUTHENTICATED (anonymous) anon-key client (no session). */
export async function makeAnonServerClient(): Promise<TestServerClient> {
  assertLocalStack();
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
  const extraUsers = (fixture as TwoTenantFixture & { extraUsers?: readonly FixtureUser[] }).extraUsers ?? [];
  const userIds = [fixture.adminA.id, fixture.adminB.id, fixture.orphanUser.id, ...extraUsers.map((user) => user.id)];
  const tenantIds = [fixture.tenantA.id, fixture.tenantB.id];

  // Remove the two rows that prevent the historical synthetic cleanup from
  // deleting its actors: audit rows need the test-only trigger bypass, while
  // provisioning requests deliberately retain a non-cascading tenant and actor
  // FK. Restore normal enforcement only for that scoped request deletion.
  try {
    await adminSession(async ({ query }) => {
      await query("begin");
      try {
        await query("set local session_replication_role = replica");
        await query(
          `delete from public.audit_events where tenant_id = any($1::uuid[])`,
          [tenantIds],
        );
        await query("set local session_replication_role = origin");
        await query(
          `delete from public.tenant_provisioning_requests where tenant_id = any($1::uuid[])`,
          [tenantIds],
        );
        await query("commit");
      } catch (e) {
        await query("rollback");
        throw e;
      }
    });
  } catch (e) {
    console.warn(
      `factory cleanup: failed to delete tenants ${fixture.tenantA.id}/${
        fixture.tenantB.id
      } protocol rows: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  for (const id of userIds) {
    try {
      await admin().auth.admin.deleteUser(id);
    } catch (e) {
      // Best-effort, but SURFACE the failure: a swallowed delete leaks fixtures
      // into the long-lived local DB with no diagnostic (review fix 2026-06-26).
      console.warn(
        `factory cleanup: failed to delete auth user ${id}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  // Preserve the established replica-mode root delete. Shared fixtures can
  // contain mutually-referencing quote/acceptance/job history whose child FKs
  // intentionally use ON DELETE RESTRICT; normal root cascades can therefore
  // depend on constraint-trigger ordering. The protocol rows above are the
  // narrowly scoped exception needed before this legacy teardown step.
  try {
    await adminSession(async ({ query }) => {
      await query("begin");
      try {
        await query("set local session_replication_role = replica");
        await query(`delete from public.tenants where id = any($1::uuid[])`, [
          tenantIds,
        ]);
        await query("commit");
      } catch (e) {
        await query("rollback");
        throw e;
      }
    });
  } catch (e) {
    console.warn(
      `factory cleanup: failed to delete tenants ${fixture.tenantA.id}/${
        fixture.tenantB.id
      }: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM seed/read helpers (Story 3.1, Task 3.1) — ADDITIVE (B1: add ALONGSIDE the
// existing handles; the two-tenant fixture shape is unchanged, so the
// factory-isolation forward-compat smoke still pins it).
//
// These seed REAL `customers`/`facilities`/`contacts` rows via the loopback-gated
// superuser `pg` pool (BYPASSRLS) so the cross-tenant + parent-ownership negatives
// can target a CONCRETE Tenant B CRM row — never a non-existent id that would deny
// vacuously. They mirror `adminInsertMembership`: THROW on a DB error with the
// Postgres `code` preserved (e.g. `23514` check-violation / `23503` FK-violation)
// so a negative can assert on the SPECIFIC constraint that bit.
//
// CRM tables are `tenant_id … on delete cascade`, so the EXISTING `cleanupFixture`
// tenant-delete cascades the seeded rows away — no new teardown path is needed.
// ─────────────────────────────────────────────────────────────────────────────

/** A seed for a `customers` row (the snake_case columns the negatives target). */
/** Re-throw a database error while preserving its PostgreSQL code. */
export function rethrowWithCode(error: unknown): never {
  const e = error as { message?: string; code?: string };
  const wrapped = new Error(e?.message ?? "factory seed failed") as Error & { code?: string };
  if (e?.code) wrapped.code = e.code;
  throw wrapped;
}

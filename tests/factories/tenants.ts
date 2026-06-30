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
  assertLocalStack,
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  LOCAL_SUPABASE_URL,
} from "../support/test-env";
import { adminQuery, adminSession } from "./admin-sql";

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
  const userIds = [fixture.adminA.id, fixture.adminB.id, fixture.orphanUser.id];
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
  // Remove the tenant rows (memberships already cascaded with the users).
  //
  // `audit_events.tenant_id` is `ON DELETE CASCADE`, but the append-only guard
  // (`audit_events_block_mutation`) blocks the cascade DELETE — by design: in
  // production audit history is immutable, so a tenant that has audit rows cannot
  // be hard-deleted (prod soft-deletes tenants). For TEST teardown that means a
  // plain `delete from public.tenants` LEAKS any tenant that accrued audit rows.
  // So purge audit + tenants on a single session with `session_replication_role =
  // replica`, which disables the user trigger (and FK triggers) for THIS superuser
  // session ONLY. Loopback-gated via the admin pool (`assertLocalStack`); never a
  // production path. `set local` inside the txn auto-resets on commit, and
  // `adminSession`'s `discard all` is a belt-and-braces reset.
  const tenantIds = [fixture.tenantA.id, fixture.tenantB.id];
  try {
    await adminSession(async ({ query }) => {
      await query("begin");
      try {
        await query("set local session_replication_role = replica");
        await query(
          `delete from public.audit_events where tenant_id = any($1::uuid[])`,
          [tenantIds],
        );
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
export interface CustomerSeed {
  readonly tenant_id: string;
  readonly customer_type: "private" | "company" | "brf" | "public";
  readonly display_name: string;
  readonly personnummer?: string | null;
  readonly org_nr?: string | null;
}

/** A seed for a `facilities` row (parent customer must already exist, same tenant). */
export interface FacilitySeed {
  readonly tenant_id: string;
  readonly customer_id: string;
  readonly name: string;
}

/** A seed for a `contacts` row (parent customer required; facility optional). */
export interface ContactSeed {
  readonly tenant_id: string;
  readonly customer_id: string;
  readonly facility_id?: string | null;
  readonly name: string;
}

/** Re-throw a Postgres error preserving its `code` (mirrors adminInsertMembership). */
function rethrowWithCode(error: unknown): never {
  const e = error as { message?: string; code?: string };
  const wrapped = new Error(e?.message ?? "factory CRM seed failed") as Error & {
    code?: string;
  };
  if (e?.code) wrapped.code = e.code;
  throw wrapped;
}

/**
 * Seed ONE `customers` row via the privileged superuser pg path (BYPASSRLS).
 * Returns the inserted id. THROWS (Postgres `code` preserved) on a DB error.
 */
export async function adminInsertCustomer(seed: CustomerSeed): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.customers
         (tenant_id, customer_type, display_name, personnummer, org_nr)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [
        seed.tenant_id,
        seed.customer_type,
        seed.display_name,
        seed.personnummer ?? null,
        seed.org_nr ?? null,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertCustomer: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Seed ONE `facilities` row via the privileged superuser pg path (BYPASSRLS).
 * Returns the inserted id. THROWS (Postgres `code` preserved) on a DB error —
 * including the composite same-tenant FK `23503` if `customer_id`'s tenant differs.
 */
export async function adminInsertFacility(seed: FacilitySeed): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.facilities (tenant_id, customer_id, name)
       values ($1, $2, $3)
       returning id`,
      [seed.tenant_id, seed.customer_id, seed.name],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertFacility: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Seed ONE `contacts` row via the privileged superuser pg path (BYPASSRLS).
 * Returns the inserted id. THROWS (Postgres `code` preserved) on a DB error.
 */
export async function adminInsertContact(seed: ContactSeed): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.contacts (tenant_id, customer_id, facility_id, name)
       values ($1, $2, $3, $4)
       returning id`,
      [seed.tenant_id, seed.customer_id, seed.facility_id ?? null, seed.name],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertContact: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/** A CRM row as read back independently (BYPASSRLS) — proves persisted state. */
export interface CrmRowReadback {
  readonly id: string;
  readonly tenant_id: string;
  readonly display_name?: string | null;
  readonly name?: string | null;
  readonly archived_at: string | null;
}

/**
 * Read ONE CRM row back via the privileged superuser pg path (BYPASSRLS),
 * independent of the app/RLS path. Returns `null` if the row does not exist (so a
 * "soft-delete, not hard-delete" negative can prove the row STILL EXISTS). Used by
 * the cross-tenant UPDATE negative (prove the foreign row is UNCHANGED) and the
 * archive negative (prove `archived_at` was set without a hard DELETE).
 *
 * `table` is one of the three CRM tables; `customers`/`facilities`/`contacts` use
 * `display_name`/`name`/`name` respectively for the human label — both are selected
 * so a single readback shape serves all three.
 */
export async function adminSelectCrmRowById(
  table: "customers" | "facilities" | "contacts",
  id: string,
): Promise<CrmRowReadback | null> {
  // `table` is a closed union (never client input), so the interpolation is safe.
  const labelCol = table === "customers" ? "display_name" : "name";
  const rows = await adminQuery<CrmRowReadback>(
    `select id, tenant_id, ${labelCol} as ${labelCol}, archived_at
       from public.${table}
      where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings seed/read helpers (Story 3.3, Task 3.3) — ADDITIVE (B1). Seed REAL
// `company_settings`/`quote_terms` rows via the loopback-gated superuser `pg` pool
// (BYPASSRLS) so the cross-tenant negatives target a CONCRETE Tenant B settings row,
// never a non-existent id that would deny vacuously. Mirror `adminInsertCustomer`:
// THROW on a DB error with the Postgres `code` preserved. Settings tables are
// `tenant_id … on delete cascade`, so the EXISTING `cleanupFixture` tenant-delete
// cascades the seeded rows away — no new teardown path is needed.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seed ONE `company_settings` row via the privileged superuser pg path (BYPASSRLS).
 * Returns the inserted id. THROWS (Postgres `code` preserved) on a DB error. The
 * NOT-NULL `default_vat_display`/`vat_rate_bp` are populated with the legacy default;
 * `company_name` carries a recognizable seed token so the cross-tenant unchanged
 * re-read can assert it was not overwritten.
 */
export async function adminInsertCompanySettings(seed: {
  readonly tenant_id: string;
  readonly company_name?: string;
  readonly default_vat_display?: string;
  readonly vat_rate_bp?: number;
}): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.company_settings
         (tenant_id, company_name, default_vat_display, vat_rate_bp)
       values ($1, $2, $3, $4)
       returning id`,
      [
        seed.tenant_id,
        seed.company_name ?? "tenant-b-company-seed",
        seed.default_vat_display ?? "company_togglable",
        seed.vat_rate_bp ?? 2500,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertCompanySettings: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Seed ONE `quote_terms` row via the privileged superuser pg path (BYPASSRLS).
 * Returns the inserted id. THROWS (Postgres `code` preserved) on a DB error. NO
 * approval is set — a seeded row is not-approved by construction (approved_at NULL).
 */
export async function adminInsertQuoteTerms(seed: {
  readonly tenant_id: string;
  readonly terms_text?: string;
}): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.quote_terms (tenant_id, terms_text)
       values ($1, $2)
       returning id`,
      [seed.tenant_id, seed.terms_text ?? "tenant-b-terms-seed (platshållartext)"],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertQuoteTerms: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Read ONE settings row's label column back via the privileged superuser pg path
 * (BYPASSRLS), independent of the app/RLS path. Used by the cross-tenant UPDATE
 * negative to prove the foreign settings row is UNCHANGED. `labelColumn` is a closed
 * set (company_name / terms_text) supplied by the inventory, never client input.
 * Returns `null` if the row does not exist.
 */
export async function adminSelectSettingsLabel(
  table: "company_settings" | "quote_terms",
  labelColumn: string,
  id: string,
): Promise<{ id: string; label: string | null } | null> {
  // `table` + `labelColumn` are closed/inventory-supplied (never client input).
  const rows = await adminQuery<{ id: string; label: string | null }>(
    `select id, ${labelColumn} as label from public.${table} where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing seed/read helpers (Story 3.4, Task 3.3) — ADDITIVE. Seed REAL
// `work_roles`/`articles` rows via the loopback-gated superuser `pg` pool (BYPASSRLS)
// so the cross-tenant negatives target a CONCRETE Tenant B pricing row, never a
// non-existent id that would deny vacuously. Mirror `adminInsertCompanySettings`:
// THROW on a DB error with the Postgres `code` preserved. Pricing tables are
// `tenant_id … on delete cascade`, so the EXISTING `cleanupFixture` tenant-delete
// cascades the seeded rows away — no new teardown path is needed.
// CRITICAL no-supplier-scope: the article seed carries ONLY the minimal manual columns.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seed ONE `work_roles` row via the privileged superuser pg path (BYPASSRLS). Returns
 * the inserted id. THROWS (Postgres `code` preserved) on a DB error. The NOT-NULL
 * `display_name` + integer-öre `cost_rate_ore`/`sell_rate_ore` are populated;
 * `display_name` carries a recognizable seed token so the cross-tenant unchanged re-read
 * can assert it was not overwritten.
 */
export async function adminInsertWorkRole(seed: {
  readonly tenant_id: string;
  readonly display_name?: string;
  readonly cost_rate_ore?: number;
  readonly sell_rate_ore?: number;
}): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.work_roles
         (tenant_id, display_name, cost_rate_ore, sell_rate_ore)
       values ($1, $2, $3, $4)
       returning id`,
      [
        seed.tenant_id,
        seed.display_name ?? "tenant-b-role-seed",
        seed.cost_rate_ore ?? 30000,
        seed.sell_rate_ore ?? 60000,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertWorkRole: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Seed ONE `articles` row via the privileged superuser pg path (BYPASSRLS). Returns the
 * inserted id. THROWS (Postgres `code` preserved) on a DB error. ONLY the minimal manual
 * columns (`name`, `unit_price_ore`) are written — NO supplier scope of any kind.
 */
export async function adminInsertArticle(seed: {
  readonly tenant_id: string;
  readonly name?: string;
  readonly unit_price_ore?: number;
}): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.articles (tenant_id, name, unit_price_ore)
       values ($1, $2, $3)
       returning id`,
      [
        seed.tenant_id,
        seed.name ?? "tenant-b-article-seed",
        seed.unit_price_ore ?? 500,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertArticle: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Read ONE pricing row's label column back via the privileged superuser pg path
 * (BYPASSRLS), independent of the app/RLS path. Used by the cross-tenant UPDATE negative
 * to prove the foreign pricing row is UNCHANGED, and by the archive negative to prove the
 * row STILL EXISTS (is_active flipped, not hard-deleted). `table`/`labelColumn` are a
 * closed/inventory-supplied set (work_roles.display_name / articles.name), never client
 * input. Returns `null` if the row does not exist.
 */
export async function adminSelectPricingRow(
  table: "work_roles" | "articles",
  labelColumn: string,
  id: string,
): Promise<{ id: string; label: string | null; is_active: boolean } | null> {
  const rows = await adminQuery<{
    id: string;
    label: string | null;
    is_active: boolean;
  }>(
    `select id, ${labelColumn} as label, is_active from public.${table} where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

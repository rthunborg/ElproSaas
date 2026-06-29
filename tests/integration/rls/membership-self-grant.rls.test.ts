/**
 * Story 2.2 — membership self-grant / privilege-escalation negatives (AC3 / R-005)
 * + role/status CHECK-constraint enforcement (AC1 / R-005). P0.
 *
 *   - Self-grant/escalation cases drive the AUTHENTICATED ANON-KEY client (the app
 *     path) and assert the write is denied — there is NO INSERT/UPDATE policy on
 *     tenant_memberships for the app path, so escalation is impossible.
 *   - The CHECK-constraint cases drive the admin/service-role path (which bypasses
 *     RLS) so the failure is provably the column CHECK constraint, not a policy.
 *
 * Runs against the LOCAL Supabase stack only; skips when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  adminInsertMembership,
  cleanupFixture,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";

/** Read adminA's membership row via the BYPASSRLS admin path (independent backstop). */
async function readAdminAMembership(fixture: TwoTenantFixture) {
  const rows = await adminQuery<{ tenant_id: string; role: string; status: string }>(
    `select tenant_id, role, status from public.tenant_memberships where user_id = $1`,
    [fixture.adminA.id],
  );
  return rows;
}

let stackUp = false;
let fixture: TwoTenantFixture;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe("tenant_memberships self-grant / escalation denied (AC3 / R-005)", () => {
  it("[P0] self-INSERT: an authenticated user CANNOT insert their OWN membership row via the app path", async () => {
    if (!stackUp) return;
    const c: TestServerClient = await makeAuthedServerClient(fixture.orphanUser);
    const { error } = await c.from("tenant_memberships").insert({
      tenant_id: fixture.tenantA.id,
      user_id: fixture.orphanUser.id,
      role: "tenant_admin",
      status: "active",
    });
    // No INSERT policy exposes self-grant to the anon-key path.
    expect(error).not.toBeNull();

    // And the orphan still resolves to NO readable membership.
    const { data } = await c
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", fixture.orphanUser.id);
    expect(data ?? []).toEqual([]);
  });

  it("[P0] self-UPDATE role: a user CANNOT change their own role through the app path", async () => {
    if (!stackUp) return;
    const a: TestServerClient = await makeAuthedServerClient(fixture.adminA);
    const { data: affected, error } = await a
      .from("tenant_memberships")
      .update({ role: "tenant_admin" }) // even a no-op write must not be exposed
      .eq("user_id", fixture.adminA.id)
      .select();
    // Assert the MECHANISM: `authenticated` has no UPDATE grant → denied (42501),
    // non-null error, null data — not a vacuous empty set (review fix 2026-06-26).
    expect(error).not.toBeNull();
    expect(affected).toBeNull();

    // Independent BYPASSRLS re-read: the row is unchanged (still the seeded values).
    const rows = await readAdminAMembership(fixture);
    expect(rows.length).toBe(1);
    expect(rows[0]?.role).toBe("tenant_admin");
    expect(rows[0]?.status).toBe("active");
    expect(rows[0]?.tenant_id).toBe(fixture.tenantA.id);
  });

  it("[P0] self-UPDATE status: a user CANNOT flip their own status through the app path", async () => {
    if (!stackUp) return;
    const a: TestServerClient = await makeAuthedServerClient(fixture.adminA);
    const { data: affected, error } = await a
      .from("tenant_memberships")
      .update({ status: "active" })
      .eq("user_id", fixture.adminA.id)
      .select();
    // Assert the mechanism (denied write), not a vacuous empty set (review fix
    // 2026-06-26).
    expect(error).not.toBeNull();
    expect(affected).toBeNull();

    // Independent BYPASSRLS re-read: status unchanged.
    const rows = await readAdminAMembership(fixture);
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe("active");
  });

  it("[P0] self-UPDATE tenant_id: a user CANNOT move their membership to another tenant_id through the app path", async () => {
    if (!stackUp) return;
    const a: TestServerClient = await makeAuthedServerClient(fixture.adminA);
    const { data: affected, error } = await a
      .from("tenant_memberships")
      .update({ tenant_id: fixture.tenantB.id })
      .eq("user_id", fixture.adminA.id)
      .select();
    // Assert the mechanism (denied write), not a vacuous empty set (review fix
    // 2026-06-26).
    expect(error).not.toBeNull();
    expect(affected).toBeNull();

    // adminA still belongs to tenantA only (verified via the admin's own read).
    const { data } = await a
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", fixture.adminA.id);
    expect(data?.length).toBe(1);
    expect(data?.[0]?.tenant_id).toBe(fixture.tenantA.id);
  });
});

describe("tenant_memberships role/status CHECK constraints bite (AC1 / R-005)", () => {
  it("[P0] role CHECK: a role other than 'tenant_admin' is REJECTED by the DB (admin/service-role path)", async () => {
    if (!stackUp) return;
    // The admin path bypasses RLS, so a failure here is provably the CHECK
    // constraint (not a policy). Assert the SPECIFIC check_violation (Postgres
    // 23514) so an unrelated FK/unique error cannot green this test (review fix
    // 2026-06-26).
    const thrown = await adminInsertMembership({
      tenant_id: fixture.tenantA.id,
      user_id: fixture.orphanUser.id,
      role: "owner",
      status: "active",
    }).then(
      () => null,
      (e: Error & { code?: string }) => e,
    );
    expect(thrown).not.toBeNull();
    expect(thrown?.code).toBe("23514");
    expect(thrown?.message).toMatch(/violates check constraint/i);
  });

  it("[P0] status CHECK: a status outside (active,invited,disabled) is REJECTED by the DB (admin/service-role path)", async () => {
    if (!stackUp) return;
    const thrown = await adminInsertMembership({
      tenant_id: fixture.tenantA.id,
      user_id: fixture.orphanUser.id,
      role: "tenant_admin",
      status: "pending",
    }).then(
      () => null,
      (e: Error & { code?: string }) => e,
    );
    expect(thrown).not.toBeNull();
    // Specific check_violation (Postgres 23514) — not a loose message match that an
    // unrelated FK/unique error would also satisfy (review fix 2026-06-26).
    expect(thrown?.code).toBe("23514");
    expect(thrown?.message).toMatch(/violates check constraint/i);
  });
});

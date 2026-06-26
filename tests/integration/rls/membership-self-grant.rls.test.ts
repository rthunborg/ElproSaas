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
import { isLocalStackReachable } from "../../support/test-env";

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
    // Denied at the table-privilege layer (no UPDATE grant for `authenticated`)
    // and there is no UPDATE policy — the write never lands.
    expect(error !== null || (affected ?? []).length === 0).toBe(true);
    expect(affected ?? []).toEqual([]);
  });

  it("[P0] self-UPDATE status: a user CANNOT flip their own status through the app path", async () => {
    if (!stackUp) return;
    const a: TestServerClient = await makeAuthedServerClient(fixture.adminA);
    const { data: affected, error } = await a
      .from("tenant_memberships")
      .update({ status: "active" })
      .eq("user_id", fixture.adminA.id)
      .select();
    expect(error !== null || (affected ?? []).length === 0).toBe(true);
    expect(affected ?? []).toEqual([]);
  });

  it("[P0] self-UPDATE tenant_id: a user CANNOT move their membership to another tenant_id through the app path", async () => {
    if (!stackUp) return;
    const a: TestServerClient = await makeAuthedServerClient(fixture.adminA);
    const { data: affected, error } = await a
      .from("tenant_memberships")
      .update({ tenant_id: fixture.tenantB.id })
      .eq("user_id", fixture.adminA.id)
      .select();
    expect(error !== null || (affected ?? []).length === 0).toBe(true);
    expect(affected ?? []).toEqual([]);

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
    // constraint (not a policy).
    await expect(
      adminInsertMembership({
        tenant_id: fixture.tenantA.id,
        user_id: fixture.orphanUser.id,
        role: "owner",
        status: "active",
      }),
    ).rejects.toThrow(/check|constraint|role|violat/i);
  });

  it("[P0] status CHECK: a status outside (active,invited,disabled) is REJECTED by the DB (admin/service-role path)", async () => {
    if (!stackUp) return;
    await expect(
      adminInsertMembership({
        tenant_id: fixture.tenantA.id,
        user_id: fixture.orphanUser.id,
        role: "tenant_admin",
        status: "pending",
      }),
    ).rejects.toThrow(/check|constraint|status|violat/i);
  });
});

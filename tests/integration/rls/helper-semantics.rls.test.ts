/**
 * Story 2.2 — coverage EXPANSION: RLS helper SEMANTICS across the membership
 * status axis (G3, AC4 / R-006 supporting). P0.
 *
 * `is_active_tenant_member` / `is_tenant_admin` are the predicates EVERY policy
 * (and the resolver's authority) ultimately rests on. The existing suite proves
 * they resist a search_path hijack and that a REAL member resolves TRUE, but it
 * never exercises the helpers across the active / invited / disabled lifecycle,
 * nor the cross-tenant negative, nor the divergence the migration deliberately
 * preserves between the two predicates. A regression that, say, treated `invited`
 * as active, or dropped the `tenant_id` scope, would slip past every other test.
 *
 * Technique: drive the helpers directly over a `pg` admin session that sets
 * `request.jwt.claim.sub` so `auth.uid()` returns the chosen user (the same
 * primitive the R-006 negative uses). This isolates the FUNCTION semantics from
 * the PostgREST/policy layer.
 *
 * Runs against the LOCAL Supabase stack only; skips when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  adminInsertMembership,
  cleanupFixture,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { adminSession, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";

let stackUp = false;
let fixture: TwoTenantFixture;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
});

afterAll(async () => {
  if (stackUp) {
    if (fixture) await cleanupFixture(fixture);
    await closeAdminPool();
  }
});

/**
 * Evaluate a helper as a specific user against a specific tenant. Sets
 * `auth.uid()` via the JWT-claim GUC on a single session, then calls the helper.
 */
async function callHelper(
  helper: "is_active_tenant_member" | "is_tenant_admin",
  asUserId: string,
  targetTenantId: string,
): Promise<boolean> {
  return adminSession(async ({ query }) => {
    await query(`select set_config('request.jwt.claim.sub', $1, false)`, [
      asUserId,
    ]);
    const rows = await query<{ ok: boolean }>(
      `select public.${helper}($1::uuid) as ok`,
      [targetTenantId],
    );
    return rows[0]?.ok ?? false;
  });
}

describe("RLS helper semantics across the membership status axis (G3)", () => {
  it("[P0] is_active_tenant_member: an ACTIVE member of their own tenant → TRUE", async () => {
    if (!stackUp) return;
    expect(
      await callHelper("is_active_tenant_member", fixture.adminA.id, fixture.tenantA.id),
    ).toBe(true);
  });

  it("[P0] is_active_tenant_member: a member of a DIFFERENT tenant → FALSE (tenant_id scope holds)", async () => {
    if (!stackUp) return;
    // adminA is active in tenantA but NOT in tenantB.
    expect(
      await callHelper("is_active_tenant_member", fixture.adminA.id, fixture.tenantB.id),
    ).toBe(false);
  });

  it("[P0] is_active_tenant_member: a user with NO membership → FALSE", async () => {
    if (!stackUp) return;
    expect(
      await callHelper("is_active_tenant_member", fixture.orphanUser.id, fixture.tenantA.id),
    ).toBe(false);
  });

  it("[P0] is_active_tenant_member: a DISABLED member → FALSE (only active grants access)", async () => {
    if (!stackUp) return;
    const f = await createTwoTenantFixture();
    try {
      await adminInsertMembership({
        tenant_id: f.tenantA.id,
        user_id: f.orphanUser.id,
        role: "tenant_admin",
        status: "disabled",
      });
      expect(
        await callHelper("is_active_tenant_member", f.orphanUser.id, f.tenantA.id),
      ).toBe(false);
    } finally {
      await cleanupFixture(f);
    }
  });

  it("[P0] is_active_tenant_member: an INVITED (not-yet-active) member → FALSE", async () => {
    if (!stackUp) return;
    const f = await createTwoTenantFixture();
    try {
      await adminInsertMembership({
        tenant_id: f.tenantA.id,
        user_id: f.orphanUser.id,
        role: "tenant_admin",
        status: "invited",
      });
      expect(
        await callHelper("is_active_tenant_member", f.orphanUser.id, f.tenantA.id),
      ).toBe(false);
    } finally {
      await cleanupFixture(f);
    }
  });
});

describe("is_tenant_admin tracks is_active_tenant_member in Phase A but stays a distinct predicate (G3)", () => {
  it("[P0] is_tenant_admin: an ACTIVE tenant_admin of their tenant → TRUE", async () => {
    if (!stackUp) return;
    expect(
      await callHelper("is_tenant_admin", fixture.adminA.id, fixture.tenantA.id),
    ).toBe(true);
  });

  it("[P0] is_tenant_admin: cross-tenant → FALSE (scope holds, no admin leakage)", async () => {
    if (!stackUp) return;
    expect(
      await callHelper("is_tenant_admin", fixture.adminA.id, fixture.tenantB.id),
    ).toBe(false);
  });

  it("[P0] is_tenant_admin: a DISABLED tenant_admin → FALSE (status gate also applies to the admin predicate)", async () => {
    if (!stackUp) return;
    const f = await createTwoTenantFixture();
    try {
      await adminInsertMembership({
        tenant_id: f.tenantA.id,
        user_id: f.orphanUser.id,
        role: "tenant_admin",
        status: "disabled",
      });
      expect(
        await callHelper("is_tenant_admin", f.orphanUser.id, f.tenantA.id),
      ).toBe(false);
    } finally {
      await cleanupFixture(f);
    }
  });

  it("[P0] both predicates agree for the SAME active admin (Phase A: role is always tenant_admin)", async () => {
    if (!stackUp) return;
    const active = await callHelper(
      "is_active_tenant_member",
      fixture.adminB.id,
      fixture.tenantB.id,
    );
    const admin = await callHelper(
      "is_tenant_admin",
      fixture.adminB.id,
      fixture.tenantB.id,
    );
    // In Phase A role is DB-constrained to tenant_admin, so an active member IS an
    // active admin — the two predicates must agree. (They are kept distinct so a
    // future role expansion localizes the role check in is_tenant_admin.)
    expect(active).toBe(true);
    expect(admin).toBe(true);
  });
});

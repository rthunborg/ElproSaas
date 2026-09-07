/** Story 11.1 — hardened has_tenant_role helper proofs. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminInsertMembership,
  cleanupFixture,
  createTwoTenantFixture,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { adminExec, adminQuery, adminSession, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

let stackUp = false;
let fixture: TwoTenantFixture;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (stackUp) fixture = await createTwoTenantFixture();
});

afterAll(async () => {
  if (stackUp) {
    await adminExec("drop schema if exists evil cascade;").catch(() => {});
    if (fixture) await cleanupFixture(fixture);
    await closeAdminPool();
  }
});

async function hasTenantRole(asUserId: string, targetTenantId: string, allowedRoles: readonly string[]): Promise<boolean> {
  return adminSession(async ({ query }) => {
    await query("select set_config('request.jwt.claim.sub', $1, false)", [asUserId]);
    const rows = await query<{ ok: boolean }>(
      "select public.has_tenant_role($1::uuid, $2::text[]) as ok",
      [targetTenantId, allowedRoles],
    );
    return rows[0]?.ok ?? false;
  });
}

describe("11.1 has_tenant_role RLS helper", () => {
  it("[P0] returns true for legacy tenant_admin without a child row and for an allowed child role", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    expect(await hasTenantRole(fixture.adminA.id, fixture.tenantA.id, ["tenant_admin"])).toBe(true);
    const membershipRows = await adminQuery<{ id: string }>(
      "select id from public.tenant_memberships where user_id = $1", [fixture.adminA.id],
    );
    const membershipId = membershipRows[0]?.id;
    if (!membershipId) throw new Error("fixture membership was not created");
    await adminQuery(
      "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, 'projektledare')",
      [fixture.tenantA.id, membershipId],
    );
    expect(await hasTenantRole(fixture.adminA.id, fixture.tenantA.id, ["projektledare"])).toBe(true);
  });

  it("[P0] returns false for inactive, cross-tenant, unknown, and absent authorization inputs", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await adminInsertMembership({ tenant_id: fixture.tenantA.id, user_id: fixture.orphanUser.id, role: "tenant_admin", status: "disabled" });
    await expect(hasTenantRole(fixture.orphanUser.id, fixture.tenantA.id, ["tenant_admin"])).resolves.toBe(false);
    await expect(hasTenantRole(fixture.adminA.id, fixture.tenantB.id, ["tenant_admin"])).resolves.toBe(false);
    await expect(hasTenantRole(fixture.adminA.id, fixture.tenantA.id, ["not_a_role"])).resolves.toBe(false);
    await expect(hasTenantRole(fixture.adminA.id, fixture.tenantA.id, [])).resolves.toBe(false);
  });

  it("[P0] pins an empty search_path so shadow membership_roles objects cannot forge authority", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await adminSession(async ({ query }) => {
      await query("select set_config('request.jwt.claim.sub', $1, false)", [fixture.adminA.id]);
      const memberships = await query<{ id: string }>("select id from public.tenant_memberships where user_id = $1", [fixture.adminA.id]);
      const membershipId = memberships[0]?.id;
      if (!membershipId) throw new Error("fixture membership was not created");
      await query("create schema if not exists evil;");
      await query("drop table if exists evil.membership_roles;");
      await query("create table evil.membership_roles (membership_id uuid, tenant_id uuid, role text);");
      await query("insert into evil.membership_roles (membership_id, tenant_id, role) values ($1, $2, 'montor')", [membershipId, fixture.tenantA.id]);
      await query("set search_path = evil, public;");
      const rows = await query<{ ok: boolean }>(
        "select public.has_tenant_role($1::uuid, array['montor']::text[]) as ok", [fixture.tenantA.id],
      );
      return rows[0]?.ok ?? false;
    });
    expect(result).toBe(false);
  });
});

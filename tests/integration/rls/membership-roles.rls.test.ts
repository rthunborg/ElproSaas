/** Story 11.1 — membership_roles database authority proofs. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminInsertMembership,
  cleanupFixture,
  createTwoTenantFixture,
  makeAuthedServerClient,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

interface MembershipRow { id: string; tenant_id: string }

let stackUp = false;
let fixture: TwoTenantFixture;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (stackUp) fixture = await createTwoTenantFixture();
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
  if (stackUp) await closeAdminPool();
});

async function membershipFor(userId: string): Promise<MembershipRow> {
  const rows = await adminQuery<MembershipRow>(
    "select id, tenant_id from public.tenant_memberships where user_id = $1",
    [userId],
  );
  const row = rows[0];
  if (!row) throw new Error("fixture membership was not created");
  return row;
}

describe("11.1 membership_roles RLS", () => {
  it("[P0] rejects a child role whose tenant differs from the parent membership tenant", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const membershipB = await membershipFor(fixture.adminB.id);
    const thrown = await adminQuery(
      "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, 'montor')",
      [fixture.tenantA.id, membershipB.id],
    ).then(() => null, (error: Error & { code?: string }) => error);
    expect(thrown).not.toBeNull();
    expect(thrown?.code).toBe("23503");
  });

  it("[P0] an authenticated caller cannot forge its own or another tenant's child role and independent readback is unchanged", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const [membershipA, membershipB] = await Promise.all([
      membershipFor(fixture.adminA.id), membershipFor(fixture.adminB.id),
    ]);
    const caller = await makeAuthedServerClient(fixture.adminA);
    for (const attempt of [
      { tenant_id: fixture.tenantA.id, membership_id: membershipA.id, role: "montor" },
      { tenant_id: fixture.tenantB.id, membership_id: membershipB.id, role: "saljare" },
    ]) {
      const { data, error } = await caller.from("membership_roles").insert(attempt).select();
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    }
    const rows = await adminQuery<{ tenant_id: string; membership_id: string; role: string }>(
      "select tenant_id, membership_id, role from public.membership_roles where membership_id = any($1::uuid[]) order by membership_id, role",
      [[membershipA.id, membershipB.id]],
    );
    expect(rows).toEqual([]);
  });

  it("[P0] duplicate membership × role assignments are rejected by a database uniqueness constraint", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const membershipA = await membershipFor(fixture.adminA.id);
    await adminQuery(
      "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, 'projektledare')",
      [fixture.tenantA.id, membershipA.id],
    );
    const thrown = await adminQuery(
      "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, 'projektledare')",
      [fixture.tenantA.id, membershipA.id],
    ).then(() => null, (error: Error & { code?: string }) => error);
    expect(thrown).not.toBeNull();
    expect(thrown?.code).toBe("23505");
  });

  it("[P0] rejects an unknown child role at the database boundary", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const membershipA = await membershipFor(fixture.adminA.id);
    const thrown = await adminQuery(
      "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, 'unknown_role')",
      [fixture.tenantA.id, membershipA.id],
    ).then(() => null, (error: Error & { code?: string }) => error);
    expect(thrown).not.toBeNull();
    expect(thrown?.code).toBe("23514");
  });

  it("[P0] a non-admin active member cannot enumerate tenant-wide role assignments", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await adminInsertMembership({
      tenant_id: fixture.tenantA.id,
      user_id: fixture.orphanUser.id,
      role: "montor",
      status: "active",
    });
    const membershipA = await membershipFor(fixture.adminA.id);
    await adminQuery(
      "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, 'ekonomi')",
      [fixture.tenantA.id, membershipA.id],
    );

    const caller = await makeAuthedServerClient(fixture.orphanUser);
    const { data, error } = await caller.from("membership_roles").select("id, membership_id, role");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

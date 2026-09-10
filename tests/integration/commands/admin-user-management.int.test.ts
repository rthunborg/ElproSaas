import { describe, expect, test } from "vitest";

describe("Admin user management commands (Story 11.3 ATDD RED)", () => {
  test.skip("[P0] serializes a last-active-Admin disable, rejects it, and preserves membership plus audit count", async () => {
    const { createTwoTenantFixture, cleanupFixture } = await import("../../factories/tenants");
    const { adminQuery } = await import("../../factories/admin-sql");
    const { changeMembershipLifecycle } = await import("@/server/commands/admin-users/lifecycle");
    const fixture = await createTwoTenantFixture();
    try {
      const before = await adminQuery<{ status: string; audit_count: number }>(
        "select tm.status, (select count(*)::int from public.audit_events where tenant_id = tm.tenant_id) as audit_count from public.tenant_memberships tm where tm.tenant_id = $1 and tm.user_id = $2",
        [fixture.tenantA.id, fixture.adminA.id],
      );
      const result = await changeMembershipLifecycle({
        actorId: fixture.adminA.id,
        tenantId: fixture.tenantA.id,
        membershipUserId: fixture.adminA.id,
        action: "disable",
        operationId: crypto.randomUUID(),
      });
      const after = await adminQuery<{ status: string; audit_count: number }>(
        "select tm.status, (select count(*)::int from public.audit_events where tenant_id = tm.tenant_id) as audit_count from public.tenant_memberships tm where tm.tenant_id = $1 and tm.user_id = $2",
        [fixture.tenantA.id, fixture.adminA.id],
      );
      expect(result).toEqual({ ok: false, code: "ADMIN_USER_ACTION_DENIED" });
      expect(after[0]).toEqual(before[0]);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  test.skip("[P0] rejects a last-active-Admin role downgrade and end through the same serialized DB boundary", async () => {
    const { changeMembershipLifecycle } = await import("@/server/commands/admin-users/lifecycle");
    const lastAdmin = { tenantId: "tenant-a", actorId: "admin-a", membershipId: "membership-a" };
    for (const action of ["re-role", "end"] as const) {
      const result = await changeMembershipLifecycle({ ...lastAdmin, action, operationId: crypto.randomUUID() });
      expect(result).toEqual({ ok: false, code: "ADMIN_USER_ACTION_DENIED" });
    }
  });

  test.skip("[P1] ends one shared Auth account only in the selected tenant and retains ended history for a fresh re-invite", async () => {
    const { createTwoTenantFixture, cleanupFixture } = await import("../../factories/tenants");
    const { adminQuery } = await import("../../factories/admin-sql");
    const { inviteAdminUser } = await import("@/server/commands/admin-users/invite");
    const { changeMembershipLifecycle } = await import("@/server/commands/admin-users/lifecycle");
    const fixture = await createTwoTenantFixture();
    try {
      const invite = await inviteAdminUser({
        actorId: fixture.adminA.id,
        tenantId: fixture.tenantA.id,
        email: fixture.adminB.email,
        roles: ["tenant_admin"],
        operationId: crypto.randomUUID(),
      });
      await changeMembershipLifecycle({
        actorId: fixture.adminA.id,
        tenantId: fixture.tenantA.id,
        membershipId: invite.membershipId,
        action: "end",
        operationId: crypto.randomUUID(),
      });
      const memberships = await adminQuery<{ tenant_id: string; status: string }>(
        "select tenant_id, status from public.tenant_memberships where user_id = $1 order by tenant_id",
        [fixture.adminB.id],
      );
      expect(memberships).toContainEqual({ tenant_id: fixture.tenantA.id, status: "ended" });
      expect(memberships).toContainEqual({ tenant_id: fixture.tenantB.id, status: "active" });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  test.skip("[P0] reconciles a repeated failed or uncertain Auth operation as one membership effect with durable outcome", async () => {
    const { reconcileAdminUserOperation } = await import("@/server/commands/admin-users/reconcile");
    const operationId = "0ad1cd0c-fb67-4bf9-a0d4-ffac1cf53d93";
    const first = await reconcileAdminUserOperation({ tenantId: "tenant-a", actorId: "admin-a", operationId });
    const second = await reconcileAdminUserOperation({ tenantId: "tenant-a", actorId: "admin-a", operationId });
    expect(second).toMatchObject({ operationId, membershipMutationCount: 1 });
    expect(second).toEqual(first);
  });
});

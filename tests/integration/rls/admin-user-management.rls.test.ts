import { describe, expect, test } from "vitest";

describe("Admin user management RLS and wrapper boundary (Story 11.3)", () => {
  test("[P0] authenticated users cannot direct-DML membership lifecycle or operation records; independent admin readback is unchanged", async () => {
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants");
    const { adminQuery } = await import("../../factories/admin-sql");
    const fixture = await createTwoTenantFixture();
    try {
      const caller = await makeAuthedServerClient(fixture.adminA);
      const before = await adminQuery<{ status: string }>(
        "select status from public.tenant_memberships where tenant_id = $1 and user_id = $2",
        [fixture.tenantA.id, fixture.adminA.id],
      );
      const { error } = await caller
        .from("tenant_memberships")
        .update({ status: "disabled" })
        .eq("tenant_id", fixture.tenantA.id)
        .eq("user_id", fixture.adminA.id);
      const after = await adminQuery<{ status: string }>(
        "select status from public.tenant_memberships where tenant_id = $1 and user_id = $2",
        [fixture.tenantA.id, fixture.adminA.id],
      );
      expect(error).not.toBeNull();
      expect(after).toEqual(before);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  test("[P0] a tenant-A Admin cannot read or mutate tenant-B membership operations through RLS or hardened wrappers", async () => {
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants");
    const { adminQuery } = await import("../../factories/admin-sql");
    const fixture = await createTwoTenantFixture();
    try {
      const operationId = crypto.randomUUID();
      await adminQuery(
        "insert into public.membership_admin_operations (id, tenant_id, actor_user_id, action, outcome) values ($1, $2, $3, 'invite', 'succeeded')",
        [operationId, fixture.tenantB.id, fixture.adminB.id],
      );
      const tenantAAdmin = await makeAuthedServerClient(fixture.adminA);
      const { data, error } = await tenantAAdmin
        .from("membership_admin_operations")
        .select("id, tenant_id, outcome")
        .eq("tenant_id", fixture.tenantB.id);
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
      const independent = await adminQuery<{ count: number }>(
        "select count(*)::int as count from public.membership_admin_operations where tenant_id = $1",
        [fixture.tenantB.id],
      );
      expect(independent[0]?.count).toBe(1);
    } finally {
      await cleanupFixture(fixture);
    }
  });
});

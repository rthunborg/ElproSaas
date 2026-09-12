import { afterAll, afterEach, describe, expect, test, vi } from "vitest";

import { closeAdminPool, adminQuery } from "../../factories/admin-sql";
import { adminInsertMembership, cleanupFixture, createTwoTenantFixture, makeAuthedServerClient } from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const serverClient = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@/server/db/supabase-server-client", () => ({
  createSupabaseServerClient: serverClient.create,
}));

import { readAdminUsers, readAdminUsersRoleSurface } from "@/features/admin-users/read";

afterEach(() => {
  serverClient.create.mockReset();
});

afterAll(async () => {
  await closeAdminPool();
});

describe("Admin users current-tenant count isolation (Story 11.4 follow-up)", () => {
  test("[P0] a multi-tenant Admin can RLS-read both tenants but the Roles count projects only the resolved current tenant", async (testCtx) => {
    const stackUp = await isLocalStackReachable();
    if (skipUnlessStack(testCtx, stackUp)) return;

    const fixture = await createTwoTenantFixture();
    try {
      await adminInsertMembership({
        tenant_id: fixture.tenantB.id,
        user_id: fixture.adminA.id,
        role: "tenant_admin",
        status: "active",
        invited_email: fixture.adminA.email,
      });
      // `resolveTenantContext` selects the oldest active row. Make the second membership
      // deterministically newer so this proof pins the current tenant to Tenant A.
      await adminQuery(
        "update public.tenant_memberships set created_at = now() + interval '1 day' where tenant_id = $1 and user_id = $2",
        [fixture.tenantB.id, fixture.adminA.id],
      );
      const tenantAMembership = (await adminQuery<{ id: string }>(
        "select id from public.tenant_memberships where tenant_id = $1 and user_id = $2",
        [fixture.tenantA.id, fixture.adminA.id],
      ))[0];
      expect(tenantAMembership).toBeDefined();

      const client = await makeAuthedServerClient(fixture.adminA);
      const rawVisible = await client
        .from("tenant_memberships")
        .select("id, tenant_id")
        .in("tenant_id", [fixture.tenantA.id, fixture.tenantB.id])
        .eq("status", "active");
      expect(rawVisible.error).toBeNull();
      expect(rawVisible.data?.map((row) => row.tenant_id).sort()).toEqual([
        fixture.tenantA.id,
        fixture.tenantB.id,
        fixture.tenantB.id,
      ].sort());

      serverClient.create.mockResolvedValue(client);
      const users = await readAdminUsers();
      const surface = await readAdminUsersRoleSurface();

      expect(users.error).toBeNull();
      expect(users.rows.map((row) => row.id)).toEqual([tenantAMembership!.id]);
      expect(surface.error).toBeNull();
      expect(surface.catalogue?.roles.find((role) => role.role === "tenant_admin")?.activeMemberCount).toBe(1);
    } finally {
      await cleanupFixture(fixture);
    }
  });
});

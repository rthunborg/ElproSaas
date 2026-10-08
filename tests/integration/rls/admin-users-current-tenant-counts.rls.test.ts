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
import { readAdminUsersForTenant, type AdminUsersReadClient } from "@/features/admin-users/read-model";
import { canAccessPhaseARoute } from "@/server/authz/phase-a-surface";

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

  test("[P0] the paged projection retains worker own-child RLS and the Admin route capability boundary", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const fixture = await createTwoTenantFixture();
    try {
      await adminInsertMembership({ tenant_id: fixture.tenantA.id, user_id: fixture.orphanUser.id,
        role: "montor", status: "active", invited_email: fixture.orphanUser.email });
      const members = await adminQuery<{ id: string; user_id: string; tenant_id: string }>(
        "select id,user_id,tenant_id from public.tenant_memberships where tenant_id=any($1::uuid[]) order by id",
        [[fixture.tenantA.id, fixture.tenantB.id]]);
      const worker = members.find((row) => row.user_id === fixture.orphanUser.id)!;
      const adminA = members.find((row) => row.user_id === fixture.adminA.id)!;
      const adminB = members.find((row) => row.user_id === fixture.adminB.id)!;
      expect(worker).toBeDefined(); expect(adminA).toBeDefined(); expect(adminB).toBeDefined();
      await adminQuery(`insert into public.membership_roles(tenant_id,membership_id,role) values
        ($1,$2,'montor'),($1,$2,'saljare'),($1,$3,'ekonomi'),($4,$5,'projektledare')`,
      [fixture.tenantA.id, worker.id, adminA.id, fixture.tenantB.id, adminB.id]);
      const snapshot = () => adminQuery<{ membership_id: string; role: string }>(
        "select membership_id,role from public.membership_roles where tenant_id=any($1::uuid[]) order by membership_id,role",
        [[fixture.tenantA.id, fixture.tenantB.id]]);
      const before = await snapshot();
      expect(before).toEqual(expect.arrayContaining([
        { membership_id: worker.id, role: "montor" }, { membership_id: worker.id, role: "saljare" },
        { membership_id: adminA.id, role: "ekonomi" }, { membership_id: adminB.id, role: "projektledare" },
      ]));
      const client = await makeAuthedServerClient(fixture.orphanUser);
      const raw = await client.from("membership_roles").select("membership_id,role").order("role");
      expect(raw.error).toBeNull();
      expect(raw.data).toEqual([{ membership_id: worker.id, role: "montor" }, { membership_id: worker.id, role: "saljare" }]);
      const projection = await readAdminUsersForTenant(client as unknown as AdminUsersReadClient, fixture.tenantA.id);
      expect(projection.error).toBeNull();
      expect(projection.rows.map((row) => ({ id: row.id, roles: row.roles })))
        .toEqual([{ id: worker.id, roles: ["montor", "saljare"] }]);
      expect(await readAdminUsersForTenant(client as unknown as AdminUsersReadClient, fixture.tenantB.id))
        .toEqual({ rows: [], error: null });
      expect(canAccessPhaseARoute(["montor", "saljare"], "/admin/users")).toBe(false);
      expect(canAccessPhaseARoute(["tenant_admin"], "/admin/users")).toBe(true);
      expect(await snapshot()).toEqual(before);
    } finally { await cleanupFixture(fixture); }
  });
});

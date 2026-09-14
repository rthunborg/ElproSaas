import { describe, expect, test, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createClient: vi.fn(),
  resolveTenantContext: vi.fn(),
}));

vi.mock("@/server/db/supabase-server-client", () => ({ createSupabaseServerClient: dependencies.createClient }));
vi.mock("@/server/auth/resolve-tenant-context", () => ({ resolveTenantContext: dependencies.resolveTenantContext }));

import { readAdminUsers } from "@/features/admin-users/read";

function readClient() {
  const calls: Array<{ table: string; tenantId: string | null }> = [];
  const client = {
    from(table: "tenant_memberships" | "membership_roles") {
      let tenantId: string | null = null;
      const query = {
        select() { return query; },
        eq(column: string, value: string) { if (column === "tenant_id") tenantId = value; return query; },
        in() { return query; },
        order() { return query; },
        range() {
          calls.push({ table, tenantId });
          return Promise.resolve({
            data: table === "tenant_memberships"
              ? [{ id: "member-a", invited_email: "a@example.test", status: "active", role: "saljare", created_at: "2026-01-01T00:00:00Z" }]
              : [{ membership_id: "member-a", role: "saljare" }],
            error: null,
          });
        },
      };
      return query;
    },
  };
  return { client, calls };
}

describe("Admin user current-tenant read boundary", () => {
  test("[P0][11.4] resolves the current tenant before querying counts and never relies on broad Admin RLS visibility", async () => {
    const { client, calls } = readClient();
    dependencies.createClient.mockResolvedValue(client);
    dependencies.resolveTenantContext.mockResolvedValue({ ok: true, data: { tenantId: "tenant-a" } });

    const result = await readAdminUsers();

    expect(result.error).toBeNull();
    expect(result.rows).toHaveLength(1);
    expect(dependencies.resolveTenantContext).toHaveBeenCalledWith({ client });
    expect(calls).toEqual([
      { table: "tenant_memberships", tenantId: "tenant-a" },
      { table: "membership_roles", tenantId: "tenant-a" },
    ]);
  });
});

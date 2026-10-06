import assert from "node:assert/strict";
import { test } from "node:test";

import { RLS_PAGE_SIZE, RLS_ID_BATCH_SIZE } from "@/server/read-models/pagination";
import { readAdminUsersForTenant } from "@/features/admin-users/read-model";

type Membership = { id: string; tenant_id: string; invited_email: string; status: string; role: string; created_at: string };
type MembershipRole = { membership_id: string; tenant_id: string; role: string };
type QueryCall = { table: string; tenantId: string | null; range: readonly [number, number]; membershipIds: readonly string[] | null };

function createReadClient(input: {
  readonly memberships: readonly Membership[];
  readonly roles: readonly MembershipRole[];
  readonly failMembershipPage?: number;
  readonly failRoleBatch?: number;
}) {
  const calls: QueryCall[] = [];
  let roleBatch = 0;
  const client = {
    from(table: "tenant_memberships" | "membership_roles") {
      let tenantId: string | null = null;
      let membershipIds: readonly string[] | null = null;
      const query = {
        select() { return query; },
        eq(column: string, value: string) {
          if (column === "tenant_id") tenantId = value;
          return query;
        },
        in(column: string, values: readonly string[]) {
          if (column === "membership_id") { membershipIds = values; roleBatch += 1; }
          return query;
        },
        order() { return query; },
        range(from: number, to: number) {
          calls.push({ table, tenantId, range: [from, to], membershipIds });
          if (table === "tenant_memberships" && input.failMembershipPage === from / RLS_PAGE_SIZE) {
            return Promise.resolve({ data: null, error: { message: "late page unavailable" } });
          }
          if (table === "membership_roles" && input.failRoleBatch === roleBatch - 1) {
            return Promise.resolve({ data: null, error: { message: "late child page unavailable" } });
          }
          const source = table === "tenant_memberships"
            ? input.memberships.filter((row) => row.tenant_id === tenantId)
            : input.roles.filter((row) => row.tenant_id === tenantId && membershipIds?.includes(row.membership_id));
          return Promise.resolve({ data: source.slice(from, to + 1), error: null });
        },
      };
      return query;
    },
  };
  return { client, calls };
}

test("[P0][11.4] Admin role counts scope roots and child roles to the resolved current tenant", async () => {
  const { client, calls } = createReadClient({
    memberships: [
      { id: "a-member", tenant_id: "tenant-a", invited_email: "a@example.test", status: "active", role: "saljare", created_at: "2026-01-02T00:00:00Z" },
      { id: "b-member", tenant_id: "tenant-b", invited_email: "b@example.test", status: "active", role: "tenant_admin", created_at: "2026-01-01T00:00:00Z" },
    ],
    roles: [
      { membership_id: "a-member", tenant_id: "tenant-a", role: "saljare" },
      { membership_id: "b-member", tenant_id: "tenant-b", role: "tenant_admin" },
    ],
  });

  const result = await readAdminUsersForTenant(client as never, "tenant-a");

  assert.equal(result.error, null);
  assert.deepEqual(result.rows.map((row) => ({ id: row.id, roles: row.roles })), [{ id: "a-member", roles: ["saljare"] }]);
  assert.ok(calls.length > 0);
  assert.ok(calls.every((call) => call.tenantId === "tenant-a"));
});

test("[P0][11.4] Admin role counts collect every membership and bounded child-role batch", async () => {
  const memberships = Array.from({ length: RLS_PAGE_SIZE + 1 }, (_, index): Membership => ({
    id: `member-${index}`,
    tenant_id: "tenant-a",
    invited_email: `member-${index}@example.test`,
    status: "active",
    role: "saljare",
    created_at: `2026-01-01T00:00:${String(index % 60).padStart(2, "0")}Z`,
  }));
  // Fifty IDs with five valid roles fit one page; every bounded ID batch must still be read.
  const roles = memberships.flatMap((membership) => ["tenant_admin", "projektledare", "montor", "saljare", "ekonomi"].map((role) => ({ membership_id: membership.id, tenant_id: "tenant-a", role })));
  const { client, calls } = createReadClient({ memberships, roles });

  const result = await readAdminUsersForTenant(client as never, "tenant-a");

  assert.equal(result.error, null);
  assert.equal(result.rows.length, RLS_PAGE_SIZE + 1);
  assert.deepEqual(result.rows[0]?.roles, ["tenant_admin", "projektledare", "montor", "saljare", "ekonomi"]);
  assert.ok(calls.some((call) => call.table === "tenant_memberships" && call.range[0] === RLS_PAGE_SIZE));
  const childCalls = calls.filter((call) => call.table === "membership_roles");
  assert.ok(childCalls.length > 1);
  assert.ok(childCalls.every((call) => (call.membershipIds?.length ?? 0) <= RLS_ID_BATCH_SIZE));
  assert.deepEqual(childCalls.flatMap((call) => call.membershipIds ?? []), memberships.map((row) => row.id));
});

test("[P0][11.4] a later membership page failure suppresses counts and all partial authority data", async () => {
  const memberships = Array.from({ length: RLS_PAGE_SIZE }, (_, index): Membership => ({
    id: `member-${index}`,
    tenant_id: "tenant-a",
    invited_email: `member-${index}@example.test`,
    status: "active",
    role: "saljare",
    created_at: "2026-01-01T00:00:00Z",
  }));
  const { client, calls } = createReadClient({ memberships, roles: [], failMembershipPage: 1 });

  const result = await readAdminUsersForTenant(client as never, "tenant-a");

  assert.deepEqual(result.rows, []);
  assert.match(result.error ?? "", /kunde inte läsas/i);
  assert.equal(calls.some((call) => call.table === "membership_roles"), false);
});

test("[P0][11.4] a later child-role batch failure suppresses counts and all partial authority data", async () => {
  const memberships = Array.from({ length: RLS_ID_BATCH_SIZE + 1 }, (_, index): Membership => ({
    id: `member-${index}`,
    tenant_id: "tenant-a",
    invited_email: `member-${index}@example.test`,
    status: "active",
    role: "saljare",
    created_at: "2026-01-01T00:00:00Z",
  }));
  const roles = memberships.flatMap((membership) => ["tenant_admin", "projektledare", "montor", "saljare", "ekonomi"].map((role) => ({ membership_id: membership.id, tenant_id: "tenant-a", role })));
  const { client, calls } = createReadClient({ memberships, roles, failRoleBatch: 1 });

  const result = await readAdminUsersForTenant(client as never, "tenant-a");

  assert.deepEqual(result.rows, []);
  assert.match(result.error ?? "", /kunde inte läsas/i);
  assert.ok(calls.some((call) => call.table === "membership_roles" && call.membershipIds?.includes(`member-${RLS_ID_BATCH_SIZE}`)));
});

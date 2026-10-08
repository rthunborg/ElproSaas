import assert from "node:assert/strict";
import { test } from "node:test";

import { RLS_PAGE_SIZE } from "@/server/read-models/pagination";
import { readAdminUsersForTenant } from "@/features/admin-users/read-model";

type Membership = { id: string; tenant_id: string; invited_email: string; status: string; role: string; created_at: string };
type MembershipRole = { membership_id: string; tenant_id: string; role: string };
type QueryCall = { table: string; tenantId: string | null; range: readonly [number, number]; orders: readonly [string, boolean][] };

function createReadClient(input: {
  readonly memberships: readonly Membership[];
  readonly roles: readonly MembershipRole[];
  readonly failMembershipPage?: number;
  readonly failRolePage?: number;
}) {
  const calls: QueryCall[] = [];
  const client = {
    from(table: "tenant_memberships" | "membership_roles") {
      let tenantId: string | null = null;
      const orders: [string, boolean][] = [];
      const query = {
        select() { return query; },
        eq(column: string, value: string) {
          if (column === "tenant_id") tenantId = value;
          return query;
        },
        order(column: string, options: { ascending: boolean }) { orders.push([column, options.ascending]); return query; },
        range(from: number, to: number) {
          calls.push({ table, tenantId, range: [from, to], orders: [...orders] });
          if (table === "tenant_memberships" && input.failMembershipPage === from / RLS_PAGE_SIZE) {
            return Promise.resolve({ data: null, error: { message: "late page unavailable" } });
          }
          if (table === "membership_roles" && input.failRolePage === from / RLS_PAGE_SIZE) {
            return Promise.resolve({ data: null, error: { message: "late child page unavailable" } });
          }
          const source = table === "tenant_memberships"
            ? input.memberships.filter((row) => row.tenant_id === tenantId)
            : input.roles.filter((row) => row.tenant_id === tenantId);
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

test("[P0][11.4] Admin role counts collect every membership and every tenant-scoped child-role page", async () => {
  const memberships = Array.from({ length: 501 }, (_, index): Membership => ({
    id: `member-${index}`,
    tenant_id: "tenant-a",
    invited_email: `member-${index}@example.test`,
    status: "active",
    role: "saljare",
    created_at: `2026-01-01T00:00:${String(index % 60).padStart(2, "0")}Z`,
  }));
  // Preserve the original 501 roots and all 2,505 valid child roles.
  const roles = memberships.flatMap((membership) => ["tenant_admin", "projektledare", "montor", "saljare", "ekonomi"].map((role) => ({ membership_id: membership.id, tenant_id: "tenant-a", role })));
  const { client, calls } = createReadClient({ memberships, roles });

  const result = await readAdminUsersForTenant(client as never, "tenant-a");

  assert.equal(result.error, null);
  assert.equal(result.rows.length, RLS_PAGE_SIZE + 1);
  assert.deepEqual(result.rows, memberships.map((row) => ({ id: row.id, email: row.invited_email, status: row.status,
    role: row.role, roles: ["tenant_admin", "projektledare", "montor", "saljare", "ekonomi"], createdAt: row.created_at })));
  assert.ok(calls.some((call) => call.table === "tenant_memberships" && call.range[0] === RLS_PAGE_SIZE));
  const childCalls = calls.filter((call) => call.table === "membership_roles");
  assert.deepEqual(childCalls.map((call) => call.range), [[0, 499], [500, 999], [1000, 1499], [1500, 1999], [2000, 2499], [2500, 2999]]);
  assert.ok(childCalls.every((call) => call.tenantId === "tenant-a"));
  assert.ok(childCalls.every((call) => JSON.stringify(call.orders) === JSON.stringify([["membership_id", true], ["role", true]])));
  assert.ok(calls.filter((call) => call.table === "tenant_memberships").every((call) =>
    JSON.stringify(call.orders) === JSON.stringify([["created_at", false], ["id", false]])));
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

test("[P0][11.4] the original 51-root child-read failure suppresses counts and all authority data", async () => {
  const memberships = Array.from({ length: 51 }, (_, index): Membership => ({
    id: `member-${index}`,
    tenant_id: "tenant-a",
    invited_email: `member-${index}@example.test`,
    status: "active",
    role: "saljare",
    created_at: "2026-01-01T00:00:00Z",
  }));
  const roles = memberships.flatMap((membership) => ["tenant_admin", "projektledare", "montor", "saljare", "ekonomi"].map((role) => ({ membership_id: membership.id, tenant_id: "tenant-a", role })));
  // All original 255 roles now fit the first child page; retain this failure control.
  const { client, calls } = createReadClient({ memberships, roles, failRolePage: 0 });

  const result = await readAdminUsersForTenant(client as never, "tenant-a");

  assert.deepEqual(result.rows, []);
  assert.match(result.error ?? "", /kunde inte läsas/i);
  assert.deepEqual(calls.filter((call) => call.table === "membership_roles").map((call) => call.range), [[0, 499]]);
});

function membershipFixture(count: number): Membership[] {
  return Array.from({ length: count }, (_, index) => ({ id: `member-${index}`, tenant_id: "tenant-a",
    invited_email: `member-${index}@example.test`, status: "active", role: "saljare", created_at: "2026-01-01T00:00:00Z" }));
}
const fiveRoles = ["tenant_admin", "projektledare", "montor", "saljare", "ekonomi"];

test("[P0][11.4] a literal 101-root later child page failure suppresses every partial authority row", async () => {
  const memberships = membershipFixture(101);
  const roles = memberships.flatMap((row) => fiveRoles.map((role) => ({ membership_id: row.id, tenant_id: row.tenant_id, role })));
  assert.equal(roles.length, 505);
  const { client, calls } = createReadClient({ memberships, roles, failRolePage: 1 });
  const result = await readAdminUsersForTenant(client as never, "tenant-a");
  assert.deepEqual(result.rows, []);
  assert.match(result.error ?? "", /kunde inte läsas/i);
  assert.deepEqual(calls.filter((call) => call.table === "membership_roles").map((call) => call.range), [[0, 499], [500, 999]]);
});

test("[P0][11.4] exactly 500 child roles require the empty terminal page without losing roles", async () => {
  const memberships = membershipFixture(100);
  const roles = memberships.flatMap((row) => fiveRoles.map((role) => ({ membership_id: row.id, tenant_id: row.tenant_id, role })));
  const { client, calls } = createReadClient({ memberships, roles });
  const result = await readAdminUsersForTenant(client as never, "tenant-a");
  assert.equal(result.error, null);
  assert.deepEqual(result.rows.map((row) => ({ id: row.id, roles: row.roles })), memberships.map((row) => ({ id: row.id, roles: fiveRoles })));
  assert.deepEqual(calls.filter((call) => call.table === "membership_roles").map((call) => call.range), [[0, 499], [500, 999]]);
});

test("[P0][11.4] empty visible roots do not read authorized child rows", async () => {
  const { client, calls } = createReadClient({ memberships: [], roles: [{ membership_id: "absent-root", tenant_id: "tenant-a", role: "tenant_admin" }] });
  assert.deepEqual(await readAdminUsersForTenant(client as never, "tenant-a"), { rows: [], error: null });
  assert.deepEqual(calls.map((call) => call.table), ["tenant_memberships"]);
});

test("[P0][11.4] roots without valid IDs retain scalar fallback without a child query", async () => {
  const memberships = [{ ...membershipFixture(1)[0]!, id: "" }];
  const { client, calls } = createReadClient({ memberships, roles: [{ membership_id: "absent-root", tenant_id: "tenant-a", role: "tenant_admin" }] });
  const result = await readAdminUsersForTenant(client as never, "tenant-a");
  assert.equal(result.error, null);
  assert.deepEqual(result.rows.map((row) => ({ id: row.id, roles: row.roles })), [{ id: "", roles: ["saljare"] }]);
  assert.deepEqual(calls.map((call) => call.table), ["tenant_memberships"]);
});

test("[P0][11.4] valid roots keep scalar fallback and omit role children absent from the root snapshot", async () => {
  const memberships = membershipFixture(1);
  const { client } = createReadClient({ memberships, roles: [{ membership_id: "absent-root", tenant_id: "tenant-a", role: "tenant_admin" }] });
  const result = await readAdminUsersForTenant(client as never, "tenant-a");
  assert.equal(result.error, null);
  assert.deepEqual(result.rows.map((row) => ({ id: row.id, roles: row.roles })), [{ id: "member-0", roles: ["saljare"] }]);
});

test("[P0][11.4] the unchanged 120-member 160-role pilot projection takes exactly two reads", async () => {
  const memberships = membershipFixture(120).map((row, index) => ({ ...row, role: fiveRoles[index % 5]! }));
  const expectedRoles = memberships.map((row, index) => index % 3 === 0 ? [row.role, fiveRoles[(index + 1) % 5]!] : [row.role]);
  const roles = memberships.flatMap((row, index) => expectedRoles[index]!
    .map((role) => ({ membership_id: row.id, tenant_id: row.tenant_id, role })));
  assert.equal(roles.length, 160);
  const { client, calls } = createReadClient({ memberships, roles });
  const result = await readAdminUsersForTenant(client as never, "tenant-a");
  assert.equal(result.error, null);
  assert.deepEqual(result.rows.map((row) => ({ id: row.id, roles: row.roles })), memberships.map((row, index) =>
    ({ id: row.id, roles: expectedRoles[index] })));
  assert.deepEqual(calls.map((call) => ({ table: call.table, tenantId: call.tenantId, range: call.range })), [
    { table: "tenant_memberships", tenantId: "tenant-a", range: [0, 499] },
    { table: "membership_roles", tenantId: "tenant-a", range: [0, 499] },
  ]);
});

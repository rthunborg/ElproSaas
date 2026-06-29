/**
 * Story 2.4 — the inventory-gate PURE comparison core (AC4, R-008, P1).
 * Runs under `node --test` (`pnpm run test:unit`); NO database.
 *
 * Structuring the gate's core as a PURE function — mirroring the
 * resolve-tenant-context-core pure-core pattern — lets us prove the gate BITES
 * (AC4) with fakes: no live schema, no scratch branch. The DB-backed gate
 * (tests/integration/rls/rls-inventory-gate.int.test.ts) exercises the SAME
 * comparison against the real schema.
 *
 * COVERAGE (test-design-epic-2.md R-008, P1 "Harness fails on an intentionally
 * mismatched … attempt — proves the harness actually bites"):
 *   AC4 → the comparison returns the omitted table when the enrolled set is
 *         deliberately shrunk (the gate is not inert / vacuously green).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findUnenrolledTenantTables,
  introspectTenantOwnedTables,
  TENANT_ROOT_TABLE,
  unenrolledTablesMessage,
  INVENTORY_MODULE_PATH,
  type AdminQueryFn,
} from "../../integration/rls/tenant-table-inventory";

const OWNED = ["audit_events", "tenant_memberships", "tenants"];
const FULLY_ENROLLED = ["audit_events", "tenant_memberships", "tenants"];

test("[P1/AC4] BITES: a shrunk enrolled set surfaces the omitted tenant-owned table", () => {
  const shrunk = FULLY_ENROLLED.filter((x) => x !== "audit_events");
  const missing = findUnenrolledTenantTables(new Set(OWNED), new Set(shrunk));
  assert.deepEqual(missing, ["audit_events"]);
});

test("[P1] GREEN: a fully-enrolled set yields ZERO unenrolled tables", () => {
  const missing = findUnenrolledTenantTables(
    new Set(OWNED),
    new Set(FULLY_ENROLLED),
  );
  assert.deepEqual(missing, []);
});

test("[P1] a NEW schema table absent from the enrolled set is reported (the standing regression)", () => {
  // The Epics 3-9 protection: schema grows, enrollment lags → red.
  const owned = new Set([...OWNED, "tenant_counters"]);
  const missing = findUnenrolledTenantTables(owned, new Set(FULLY_ENROLLED));
  assert.deepEqual(missing, ["tenant_counters"]);
});

test("[P1] over-enrollment (an enrolled table not yet in schema) is NOT reported as unenrolled", () => {
  // The gate guards owned⊆enrolled; an enrolled-but-not-yet-present table is
  // harmless to THIS direction (coverage that landed early).
  const enrolled = new Set([...FULLY_ENROLLED, "future_table"]);
  const missing = findUnenrolledTenantTables(new Set(OWNED), enrolled);
  assert.deepEqual(missing, []);
});

test("[P1] multiple unenrolled tables are returned SORTED and de-duped", () => {
  // A failure that names several tables must be stable/ordered for a clear message.
  const owned = ["zeta_table", "audit_events", "alpha_table", "alpha_table"];
  const missing = findUnenrolledTenantTables(owned, new Set(FULLY_ENROLLED));
  assert.deepEqual(missing, ["alpha_table", "zeta_table"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// introspectTenantOwnedTables — the SCHEMA-INTROSPECTION branch logic, exercised
// with a FAKE adminQuery (no DB, no Docker). Mirrors the resolve-tenant-context
// pure-core pattern: introspectTenantOwnedTables takes an AdminQueryFn precisely so
// its branches (the carrier union + the load-bearing `tenants` edge case) can be
// proven WITHOUT the live stack. The DB-backed gate
// (rls-inventory-gate.int.test.ts) exercises the SAME function against the real
// schema, but skips when Docker is absent — these units cover the logic
// unconditionally. [Story 2.4 Task 1.1, AC3; gap: tenants-union branch untested off-DB]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A fake adminQuery that dispatches on the SQL text: the carrier query (the one
 * mentioning the `tenant_id` attribute) returns `carriers`; the `tenants`-exists
 * probe returns whether the root table is present.
 */
function fakeAdminQuery(
  carriers: readonly string[],
  rootExists: boolean,
): AdminQueryFn {
  return (async (sql: string) => {
    if (/a\.attname = 'tenant_id'/.test(sql)) {
      return carriers.map((table_name) => ({ table_name }));
    }
    // The `tenants`-root exists probe (selects `exists(...)`).
    return [{ exists: rootExists }];
  }) as AdminQueryFn;
}

test("[P1/AC3] UNIONS the tenant_id-carriers with the literal `tenants` root (the load-bearing edge case)", async () => {
  // `tenants` has NO tenant_id column, so the carrier query never returns it — the
  // explicit union must add it back. A naive heuristic would silently DROP it.
  const owned = await introspectTenantOwnedTables(
    fakeAdminQuery(["tenant_memberships", "audit_events"], true),
  );
  assert.deepEqual([...owned].sort(), [
    "audit_events",
    "tenant_memberships",
    TENANT_ROOT_TABLE,
  ]);
  assert.ok(owned.has(TENANT_ROOT_TABLE), "`tenants` must survive the union");
});

test("[P1] does NOT add `tenants` when the root table is absent from the live schema (no phantom)", async () => {
  // The union is gated on a real `public.tenants` base table existing — so the gate
  // reflects the actual schema, never a phantom enrollment demand.
  const owned = await introspectTenantOwnedTables(
    fakeAdminQuery(["tenant_memberships"], false),
  );
  assert.deepEqual([...owned].sort(), ["tenant_memberships"]);
  assert.ok(!owned.has(TENANT_ROOT_TABLE), "absent `tenants` must NOT be added");
});

test("[P1] a future tenant_id-carrier (e.g. tenant_counters) is picked up by the carrier query", async () => {
  // The standing Epics 3-9 mechanism: a new tenant_id-carrying table appears in the
  // introspected set the moment it lands in the schema, driving the gate red until
  // it is enrolled.
  const owned = await introspectTenantOwnedTables(
    fakeAdminQuery(
      ["tenant_memberships", "audit_events", "tenant_counters"],
      true,
    ),
  );
  assert.ok(owned.has("tenant_counters"));
  // End-to-end with the comparison: a carrier absent from the enrolled set surfaces.
  const missing = findUnenrolledTenantTables(owned, new Set(FULLY_ENROLLED));
  assert.deepEqual(missing, ["tenant_counters"]);
});

test("[P3] the unenrolled-table message names every offending table AND the inventory module", () => {
  // DX contract (Task 1.3): a future contributor must learn the exact table(s) and
  // the file to edit from the failure text alone.
  const message = unenrolledTablesMessage(["tenant_counters", "widgets"]);
  assert.match(message, /tenant_counters/);
  assert.match(message, /widgets/);
  assert.ok(
    message.includes(INVENTORY_MODULE_PATH),
    "message must point at the inventory module to update",
  );
  assert.match(message, /architecture §18/);
});

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
import { findUnenrolledTenantTables } from "../../integration/rls/tenant-table-inventory";

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

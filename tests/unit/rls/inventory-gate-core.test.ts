/**
 * ATDD RED-PHASE SCAFFOLD — Story 2.4, the inventory-gate PURE comparison core
 * (AC4, R-008, P1). Runs under `node --test` (`pnpm run test:unit`); NO database.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GATED — DOES NOT RUN UNTIL Story 2.4 implementation.                     ║
 * ║                                                                          ║
 * ║  Needs the pure comparison exported from the NEW shared inventory module   ║
 * ║    `tests/integration/rls/tenant-table-inventory.ts`:                      ║
 * ║      findUnenrolledTenantTables(ownedSet, enrolledSet): string[]          ║
 * ║  (sorted, de-duped table names that are tenant-owned-in-schema but NOT     ║
 * ║  enrolled). Structuring the gate's core as a PURE function — mirroring the ║
 * ║  resolve-tenant-context-core pure-core pattern — lets us prove the gate    ║
 * ║  BITES (AC4) with fakes, no live schema, no scratch branch. Until it lands ║
 * ║  every test below `t.skip(...)`s; keep them skipped.                       ║
 * ║                                                                          ║
 * ║  GREEN-PHASE: implement findUnenrolledTenantTables, import it, drop the     ║
 * ║  `t.skip` guard, run `pnpm run test:unit`, make GREEN.                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * COVERAGE (test-design-epic-2.md R-008, P1 "Harness fails on an intentionally
 * mismatched … attempt — proves the harness actually bites"):
 *   AC4 → the comparison returns the omitted table when the enrolled set is
 *         deliberately shrunk (the gate is not inert / vacuously green).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
// GREEN-PHASE: import the pure comparison once it exists (Task 1.2 / 1.4).
// import { findUnenrolledTenantTables } from "../../integration/rls/tenant-table-inventory";

const GATED = true; // flip to false in GREEN-PHASE once the module exists.

const OWNED = ["audit_events", "tenant_memberships", "tenants"];
const FULLY_ENROLLED = ["audit_events", "tenant_memberships", "tenants"];

test("[P1/AC4] BITES: a shrunk enrolled set surfaces the omitted tenant-owned table", (t) => {
  if (GATED) return t.skip("GATED: findUnenrolledTenantTables not implemented yet");
  // GREEN-PHASE:
  //   const shrunk = FULLY_ENROLLED.filter((x) => x !== "audit_events");
  //   const missing = findUnenrolledTenantTables(new Set(OWNED), new Set(shrunk));
  //   assert.deepEqual(missing, ["audit_events"]);
  void OWNED;
  void FULLY_ENROLLED;
});

test("[P1] GREEN: a fully-enrolled set yields ZERO unenrolled tables", (t) => {
  if (GATED) return t.skip("GATED: findUnenrolledTenantTables not implemented yet");
  // GREEN-PHASE:
  //   const missing = findUnenrolledTenantTables(new Set(OWNED), new Set(FULLY_ENROLLED));
  //   assert.deepEqual(missing, []);
});

test("[P1] a NEW schema table absent from the enrolled set is reported (the standing regression)", (t) => {
  if (GATED) return t.skip("GATED: findUnenrolledTenantTables not implemented yet");
  // GREEN-PHASE — the Epics 3-9 protection: schema grows, enrollment lags → red:
  //   const owned = new Set([...OWNED, "tenant_counters"]);
  //   const missing = findUnenrolledTenantTables(owned, new Set(FULLY_ENROLLED));
  //   assert.deepEqual(missing, ["tenant_counters"]);
});

test("[P1] over-enrollment (an enrolled table not yet in schema) is NOT reported as unenrolled", (t) => {
  if (GATED) return t.skip("GATED: findUnenrolledTenantTables not implemented yet");
  // GREEN-PHASE — the gate guards owned⊆enrolled; an enrolled-but-not-yet-present
  // table is harmless to THIS direction (it just means coverage is ready early):
  //   const enrolled = new Set([...FULLY_ENROLLED, "future_table"]);
  //   const missing = findUnenrolledTenantTables(new Set(OWNED), enrolled);
  //   assert.deepEqual(missing, []);
});

void assert;

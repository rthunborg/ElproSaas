/**
 * ATDD RED-PHASE SCAFFOLD — Story 2.4, the H4 RLS table-inventory gate
 * (AC3 / AC4, R-008, P0). DB-backed Vitest INT suite.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GATED — DOES NOT RUN UNTIL Story 2.4 implementation.                     ║
 * ║                                                                          ║
 * ║  Needs the NEW shared inventory module                                    ║
 * ║    `tests/integration/rls/tenant-table-inventory.ts`                      ║
 * ║  exporting `TENANT_TABLES` (the enrolled set) + a PURE comparison         ║
 * ║  `findUnenrolledTenantTables(schemaSet, enrolledSet)` (Task 1.2 / 1.4),   ║
 * ║  and the live-schema introspection helper that computes the tenant-owned  ║
 * ║  set. Until those land this suite is `describe.skip`; keep it skipped.    ║
 * ║                                                                          ║
 * ║  GREEN-PHASE: build the inventory module + gate, replace the gated()      ║
 * ║  guards with the real `adminQuery` introspection + set-difference         ║
 * ║  assertion, remove `.skip`, run `pnpm run test:int` against the local     ║
 * ║  stack, make GREEN. Then prove it BITES (AC4): the pure-fn shrunk-set     ║
 * ║  case lives in tests/unit/rls/inventory-gate-core.test.ts, and the        ║
 * ║  scratch-branch run (omit a real table from the enrolled array → CI red)  ║
 * ║  is documented in the Dev Agent Record.                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * "TENANT-OWNED" (the gate's precise definition — document in the module too):
 *   a `public` BASE table that either
 *     (a) carries a direct `tenant_id` column, OR
 *     (b) IS the literal `tenants` root table (its PK `id` IS the tenant id; it
 *         has NO `tenant_id` column yet IS tenant-owned and IS RLS-protected),
 *   and is NOT a global enum/reference table nor an auth-owned table. Always
 *   schema-qualify to `public` — an internal `_realtime.tenants` exists too
 *   (see migration-reset.int.test.ts) and MUST NOT be counted.
 *
 *   CRITICAL EDGE CASE: a naive `WHERE column_name = 'tenant_id'` inventory query
 *   DROPS `tenants` and the gate goes silently incomplete. Handle `tenants`
 *   explicitly (union the tenant_id-carrying tables with the literal `tenants`).
 *
 * EXPECTED current tenant-owned set: EXACTLY `{tenants, tenant_memberships,
 * audit_events}` (architecture §7 v0; `tenant_counters` etc. are later stories —
 * the gate will demand THEIR enrollment when they land).
 *
 * COVERAGE (test-design-epic-2.md R-008, P0):
 *   AC3 → the live-schema tenant-owned set == the enrolled set; CI FAILS with a
 *         clear "table not covered" message naming the missing table(s).
 *   AC4 → the gate actually BITES (a deliberately-shrunk enrolled set surfaces the
 *         omitted table) — exercised here live + as a pure-fn unit.
 *
 * Runs against the LOCAL Supabase stack only; skips when unreachable.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
// `expect` is retained for the GREEN-PHASE set-difference assertions (kept
// referenced here so the red-phase scaffold lints clean).
void expect;
// GREEN-PHASE: uncomment once the shared inventory module exists (Task 1.2).
// import {
//   TENANT_TABLES,
//   findUnenrolledTenantTables,
//   introspectTenantOwnedTables,
// } from "./tenant-table-inventory";

const EXPECTED_TENANT_OWNED = [
  "audit_events",
  "tenant_memberships",
  "tenants",
] as const;

function gated(): never {
  throw new Error(
    "GATED: the shared inventory module `tenant-table-inventory.ts` " +
      "(TENANT_TABLES + findUnenrolledTenantTables + introspectTenantOwnedTables) " +
      "is required. Intentionally skipped until Story 2.4 implementation.",
  );
}

let stackUp = false;
beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});

describe.skip("H4 RLS table-inventory gate (Story 2.4 — GATED on tenant-table-inventory.ts)", () => {
  it("[P0] live-schema tenant-owned set is EXACTLY {tenants, tenant_memberships, audit_events}", async () => {
    if (!stackUp) return;
    gated();
    // GREEN-PHASE — the gate's schema introspection, public-qualified, including
    // the literal `tenants` despite its missing tenant_id column:
    //   const owned = await introspectTenantOwnedTables(adminQuery);
    //   expect([...owned].sort()).toEqual([...EXPECTED_TENANT_OWNED]);
    void adminQuery;
    void EXPECTED_TENANT_OWNED;
  });

  it("[P0] every live tenant-owned table is ENROLLED in the parameterized negative suite (set difference is empty)", async () => {
    if (!stackUp) return;
    gated();
    // GREEN-PHASE — the H4 gate proper. Prefer an explicit set-difference
    // assertion over a bare length check so the failure NAMES the table(s):
    //   const owned = await introspectTenantOwnedTables(adminQuery);
    //   const unenrolled = findUnenrolledTenantTables(owned, TENANT_TABLES);
    //   expect(unenrolled).toEqual([]); // message must point at the inventory module
  });

  it("[P0/AC4] the gate BITES: a deliberately-shrunk enrolled set surfaces the omitted table by name", async () => {
    if (!stackUp) return;
    gated();
    // GREEN-PHASE — prove the comparison is not inert without a scratch branch:
    //   const owned = await introspectTenantOwnedTables(adminQuery);
    //   const shrunk = TENANT_TABLES.filter((t) => t !== "audit_events");
    //   const unenrolled = findUnenrolledTenantTables(owned, shrunk);
    //   expect(unenrolled).toContain("audit_events");
  });

  it("[P0] the unenrolled-table failure message names the table AND points at the inventory module (P3 DX)", async () => {
    if (!stackUp) return;
    gated();
    // GREEN-PHASE — assert the developer-facing message shape (Task 1.3):
    //   const owned = new Set([...EXPECTED_TENANT_OWNED, "future_widgets"]);
    //   const unenrolled = findUnenrolledTenantTables(owned, TENANT_TABLES);
    //   expect(unenrolled).toContain("future_widgets");
    //   // and the gate's thrown/asserted message includes
    //   //   "future_widgets" + "tenant-table-inventory.ts"
  });
});

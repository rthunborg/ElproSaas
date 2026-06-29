/**
 * Story 2.4 — the H4 RLS table-inventory gate (AC3 / AC4, R-008, P0).
 * DB-backed Vitest INT suite.
 *
 * The STANDING regression mechanism for every later tenant-owned table (Epics
 * 3-9): it introspects the LIVE schema for the set of tenant-owned `public` base
 * tables and compares it against the set ENROLLED in the parameterized
 * cross-tenant negative suite (`TENANT_TABLES` in tenant-table-inventory.ts). CI
 * FAILS with a clear, named "table not covered" message when a tenant-owned table
 * is not enrolled — so a future PR adding a tenant table without isolation
 * coverage cannot silently merge.
 *
 * "TENANT-OWNED" definition + the load-bearing `tenants` edge case are documented
 * in tenant-table-inventory.ts (the single source of truth this gate reads).
 *
 * EXPECTED current tenant-owned set: EXACTLY {tenants, tenant_memberships,
 * audit_events} (architecture §7 v0).
 *
 * BITE PROOF (AC4):
 *   - Pure-fn (no DB, no scratch branch): tests/unit/rls/inventory-gate-core.test.ts
 *     proves a shrunk enrolled set surfaces the omitted table.
 *   - Live (here): the gate's comparison is exercised against the REAL schema, and
 *     a deliberately-shrunk enrolled set is shown to surface the omitted REAL table.
 *   - Manual scratch-branch verification is documented in the story Dev Agent Record.
 *
 * Runs against the LOCAL Supabase stack only; skips when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import {
  TENANT_TABLES,
  INVENTORY_MODULE_PATH,
  findUnenrolledTenantTables,
  introspectTenantOwnedTables,
  unenrolledTablesMessage,
} from "./tenant-table-inventory";

// Derived from the single-source-of-truth inventory, NOT a second hardcoded copy:
// when the inventory grows to a fourth table this stays in sync automatically, so
// the "exact-set" assertion fails for a REAL coverage reason (an unenrolled table),
// never a stale-test reason. [Review][Patch][Low] EXPECTED_TENANT_OWNED divergence.
const EXPECTED_TENANT_OWNED = [...TENANT_TABLES].sort();

let stackUp = false;
beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});

afterAll(async () => {
  await closeAdminPool();
});

describe("H4 RLS table-inventory gate (Story 2.4 / AC3 / AC4 / R-008)", () => {
  it("[P0] live-schema tenant-owned set is EXACTLY {tenants, tenant_memberships, audit_events}", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // The gate's schema introspection, public-qualified, including the literal
    // `tenants` despite its missing tenant_id column AND excluding `_realtime.tenants`.
    const owned = await introspectTenantOwnedTables(adminQuery);
    expect([...owned].sort()).toEqual([...EXPECTED_TENANT_OWNED]);
    // The load-bearing edge case: a naive tenant_id-column heuristic would DROP
    // `tenants`; assert it survived the union explicitly.
    expect(owned.has("tenants")).toBe(true);
  });

  it("[P0] every live tenant-owned table is ENROLLED in the parameterized negative suite (set difference is empty)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // The H4 gate proper. An explicit set-difference (NOT a bare length check) so a
    // failure NAMES the offending table(s) and points at the inventory module.
    const owned = await introspectTenantOwnedTables(adminQuery);
    const unenrolled = findUnenrolledTenantTables(owned, TENANT_TABLES);
    expect(
      unenrolled,
      unenrolled.length > 0 ? unenrolledTablesMessage(unenrolled) : undefined,
    ).toEqual([]);
  });

  it("[P0/AC4] the gate BITES: a deliberately-shrunk enrolled set surfaces the omitted REAL table by name (not inert/vacuous)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Prove the comparison is not inert WITHOUT a scratch branch: feed the gate the
    // real schema but an enrolled set with `audit_events` removed — the gate must
    // report the now-unenrolled REAL table. If the comparison were vacuously green,
    // this would (wrongly) return []. (Pure-fn analogue: inventory-gate-core.test.ts.)
    const owned = await introspectTenantOwnedTables(adminQuery);
    const shrunk = TENANT_TABLES.filter((t) => t !== "audit_events");
    const unenrolled = findUnenrolledTenantTables(owned, shrunk);
    expect(unenrolled).toContain("audit_events");
  });

  it("[P0] the unenrolled-table failure message names the table AND points at the inventory module (P3 DX)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // A future tenant-owned table absent from enrollment must produce an actionable
    // message: the offending table name + the inventory module to update.
    const owned = new Set([...EXPECTED_TENANT_OWNED, "future_widgets"]);
    const unenrolled = findUnenrolledTenantTables(owned, TENANT_TABLES);
    expect(unenrolled).toContain("future_widgets");
    const message = unenrolledTablesMessage(unenrolled);
    expect(message).toContain("future_widgets");
    expect(message).toContain(INVENTORY_MODULE_PATH);
  });
});

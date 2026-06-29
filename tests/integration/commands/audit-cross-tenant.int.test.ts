// @ts-nocheck
/**
 * Story 2.3 — RED-PHASE ATDD scaffold (TEA testarch-atdd, 2026-06-29).
 *
 * DB-BACKED cross-tenant isolation for `audit_events` (AC4 / R-001 / R-009, P0):
 * Tenant A's admin cannot SELECT / INSERT / UPDATE / DELETE Tenant B audit rows.
 *
 * ENROLLMENT NOTE (Task 5.3b): the AUTHORITATIVE home for this is the data-driven
 * `TABLES` array in `tests/integration/rls/cross-tenant-isolation.rls.test.ts` —
 * Story 2.3 dev-story ADDS `"audit_events"` to that array plus a `spoofedRowFor` /
 * `tenantBFilter` entry, and seeds a Tenant B audit row so the cross-tenant SELECT
 * has a real row to be denied. That existing suite is GREEN today, so to keep the
 * RED phase isolated this scaffold is a SEPARATE `describe.skip(...)` file that
 * pins the SAME assertions; once the table exists, dev-story enrolls `audit_events`
 * in the data-driven suite and this scaffold can be deleted (its coverage subsumed).
 *
 * Applies the Story 2.2 review hardening: a spoof-INSERT uses a FRESH uuid so the
 * denial is the privilege layer (42501), not a PK collision (23505); UPDATE/DELETE
 * assert non-null error + null data, never a vacuous empty set. LOCAL stack only.
 *
 * RED PHASE: `describe.skip(...)`. Un-skip + drop `@ts-nocheck` once the migration
 * ships; then prefer the data-driven enrollment over this standalone file.
 *
 * COVERAGE (test-design-epic-2.md P0, "Cross-tenant audit read/write denied" +
 * R-001/R-009; story AC4).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";

// RED: TEST-ONLY audit seeding helper is authored by Story 2.3 dev-story. Imported
// DYNAMICALLY + tolerantly because the top-level `beforeAll` runs even for a
// `describe.skip` suite; a static import of the not-yet-built factory would crash the
// hook and turn the int gate RED at load time. dev-story converts this to a static
// import + un-skips (or deletes this file in favour of the data-driven enrollment).
async function loadAuditFactory() {
  return import("../../factories/audit-events");
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key client
let tenantBAuditId: string;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  let adminInsertAuditEvent: typeof import("../../factories/audit-events")["adminInsertAuditEvent"];
  try {
    ({ adminInsertAuditEvent } = await loadAuditFactory());
  } catch {
    return; // RED: factory not implemented yet
  }
  // Seed a REAL Tenant B audit row via the privileged path so the cross-tenant
  // SELECT/UPDATE/DELETE has a concrete target that must stay invisible to A.
  tenantBAuditId = await adminInsertAuditEvent({
    tenant_id: fixture.tenantB.id,
    actor_user_id: fixture.adminB.id,
    command: "b.command",
    event_type: "b.event",
    target_type: "tenant",
    target_id: fixture.tenantB.id,
    correlation_id: crypto.randomUUID(),
    metadata: { reason: "tenant-b-seed" },
  });
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe.skip("Cross-tenant RLS isolation — audit_events (AC4 / R-001) — RED until Story 2.3", () => {
  it("[P0] SELECT: Tenant A admin reads ZERO Tenant B audit rows (RLS empty set, no error leak)", async () => {
    if (!stackUp) return;
    const { data, error } = await a
      .from("audit_events")
      .select("*")
      .eq("tenant_id", fixture.tenantB.id);
    // RLS (is_tenant_admin(tenant_id) SELECT policy) yields an EMPTY set for A, not
    // an error that confirms existence. `authenticated` HAS a SELECT grant, so RLS —
    // not the privilege layer — does the narrowing here.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("[P0] INSERT: Tenant A admin cannot INSERT an audit row carrying Tenant B ownership (fresh uuid → 42501, not 23505)", async () => {
    if (!stackUp) return;
    const { error } = await a.from("audit_events").insert({
      id: crypto.randomUUID(), // fresh id → denial is the missing GRANT, not a PK collision
      tenant_id: fixture.tenantB.id,
      actor_user_id: fixture.adminA.id,
      command: "spoof.by.a",
      event_type: "spoof.by.a",
      target_type: "tenant",
      target_id: fixture.tenantB.id,
      correlation_id: crypto.randomUUID(),
      metadata: {},
    });
    // `authenticated` has NO INSERT grant on audit_events (writes go via the
    // privileged DEFINER path), so the app-path INSERT is denied at the privilege
    // layer with 42501 — assert the mechanism.
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("[P0] UPDATE: Tenant A admin cannot UPDATE Tenant B's audit rows", async () => {
    if (!stackUp) return;
    const { data: affected, error } = await a
      .from("audit_events")
      .update({ metadata: { hijacked: true } })
      .eq("id", tenantBAuditId)
      .select();
    expect(error).not.toBeNull();
    expect(affected).toBeNull();
  });

  it("[P0] DELETE: Tenant A admin cannot DELETE Tenant B's audit rows", async () => {
    if (!stackUp) return;
    const { data: deleted, error } = await a
      .from("audit_events")
      .delete()
      .eq("id", tenantBAuditId)
      .select();
    expect(error).not.toBeNull();
    expect(deleted).toBeNull();
  });
});

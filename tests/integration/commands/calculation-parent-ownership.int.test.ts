/**
 * Story 5.1 — cross-tenant PARENT-link command negative (AC3, P0 — 5.1-INT-02 /
 * R-502). The load-bearing parent-ownership-spoofing guard.
 *
 * Proves a Tenant-A `createCalculation` that supplies a Tenant-B
 * `customer_id`/`facility_id`/`contact_id` as the calc parent is DENIED with the
 * stable typed `TENANT_ACCESS_DENIED`:
 *   - the CUSTOMER parent is verified by the envelope `ownership` step (a Tenant-B
 *     customer_id is invisible under Tenant A's RLS → zero rows → TENANT_ACCESS_DENIED
 *     BEFORE execute runs), and
 *   - the OPTIONAL facility/contact links are the DB-level backstop: the INSERT writes
 *     the RESOLVED tenant (Tenant A), so the composite same-tenant FK rejects a
 *     Tenant-B facility/contact (`23503` mapped to TENANT_ACCESS_DENIED via
 *     `throwMappedWriteError`, never a raw throw).
 * Client-supplied `tenant_id` is IGNORED — the resolved tenant from membership is the
 * only authority (the validator strips it; execute writes the resolved tenant).
 *
 * The seeds are REAL (but A-invisible) Tenant-B CRM parents, so the cross-tenant link
 * points at a concrete existing target — never a non-existent id that would deny
 * vacuously. Tenant A's OWN customer is seeded too so the facility/contact negatives
 * pass the customer-ownership gate and reach the composite-FK backstop.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable.
 *
 * COVERAGE (test-design-epic-5.md 5.1-INT-02; story AC3 / Task 3.3).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertFacility,
  adminInsertContact,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { createCalculation } from "@/server/commands/calculations";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-02T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key client
let tenantACustomerId: string; // A's OWN customer (visible; passes the ownership gate)
let tenantBCustomerId: string; // a REAL Tenant B customer (cross-tenant parent target)
let tenantBFacilityId: string; // a REAL Tenant B facility (cross-tenant parent target)
let tenantBContactId: string; // a REAL Tenant B contact (cross-tenant parent target)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  // A's own customer (visible under A's RLS) — lets the facility/contact negatives
  // pass the customer-ownership gate so the composite-FK backstop is what denies.
  tenantACustomerId = await adminInsertCustomer({
    tenant_id: fixture.tenantA.id,
    customer_type: "company",
    display_name: "tenant-a-own-customer",
    org_nr: "556000-1111",
  });
  // REAL Tenant B CRM parents (existing but A-invisible) so the cross-tenant link
  // points at a concrete target — never a non-existent id that would deny vacuously.
  tenantBCustomerId = await adminInsertCustomer({
    tenant_id: fixture.tenantB.id,
    customer_type: "company",
    display_name: "tenant-b-parent-customer",
    org_nr: "556000-2222",
  });
  tenantBFacilityId = await adminInsertFacility({
    tenant_id: fixture.tenantB.id,
    customer_id: tenantBCustomerId,
    name: "tenant-b-parent-facility",
  });
  tenantBContactId = await adminInsertContact({
    tenant_id: fixture.tenantB.id,
    customer_id: tenantBCustomerId,
    facility_id: tenantBFacilityId,
    name: "tenant-b-parent-contact",
  });
  // Vacuity guard: a missing seed id would make the cross-tenant link target a
  // non-existent row and deny vacuously (for the wrong reason). Fail loudly.
  if (
    !tenantACustomerId ||
    !tenantBCustomerId ||
    !tenantBFacilityId ||
    !tenantBContactId
  ) {
    throw new Error(
      "calc parent-ownership seed produced no id (A customer / B customer/facility/" +
        "contact) — the cross-tenant parent-link negatives would deny VACUOUSLY.",
    );
  }
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe("Calc cross-tenant parent-link denial (AC3 / 5.1-INT-02, R-502)", () => {
  it("[P0] createCalculation with a Tenant-B customer_id → TENANT_ACCESS_DENIED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(createCalculation, {
      client: a as never,
      input: { customer_id: tenantBCustomerId, title: "Hijack via foreign customer" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[P0] createCalculation (A's own customer) with a Tenant-B facility_id → TENANT_ACCESS_DENIED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // The customer is A's OWN (passes the ownership gate); the FACILITY is B's, so the
    // composite same-tenant FK rejects it at INSERT (23503 → TENANT_ACCESS_DENIED).
    const result = await runCommand(createCalculation, {
      client: a as never,
      input: {
        customer_id: tenantACustomerId,
        facility_id: tenantBFacilityId,
        title: "Hijack via foreign facility",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[P0] createCalculation (A's own customer) with a Tenant-B contact_id → TENANT_ACCESS_DENIED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(createCalculation, {
      client: a as never,
      input: {
        customer_id: tenantACustomerId,
        contact_id: tenantBContactId,
        title: "Hijack via foreign contact",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[P0] a client-supplied tenant_id is IGNORED — resolved-tenant is the authority", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Even if the caller injects Tenant B's tenant_id, the command resolves the tenant
    // from membership (Tenant A) — the Tenant-B customer is still A-invisible → denied.
    // (The validator strips the extra tenant_id key; the ownership gate then bites.)
    const result = await runCommand(createCalculation, {
      client: a as never,
      input: {
        tenant_id: fixture.tenantB.id, // spoofed — must be ignored
        customer_id: tenantBCustomerId,
        title: "tenant_id spoof",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });
});

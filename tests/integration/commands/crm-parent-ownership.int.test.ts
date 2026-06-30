/**
 * Story 3.1 — ATDD RED-PHASE scaffold: cross-tenant PARENT-link command negative
 * (AC4, P0 / R-002). The load-bearing parent-ownership-spoofing guard.
 *
 * Proves a Tenant-A `createFacility`/`createContact`/`updateFacility`/`updateContact`
 * that supplies a Tenant-B parent id (`customer_id`/`facility_id`) is DENIED with the
 * stable typed `TENANT_ACCESS_DENIED` — the parent is invisible under Tenant A's RLS,
 * so the envelope `ownership` verify (or the composite same-tenant FK at INSERT) bites.
 * Never trusts a client-supplied `tenant_id` for the parent.
 *
 * ── WHY `describe.skip` (RED PHASE) ─────────────────────────────────────────────
 * The CRM commands + the `crm_data_model` migration do not exist yet (Story 3.1 dev
 * Tasks 1-2). The scaffold seeds a REAL Tenant B parent via the service-role factory
 * helper that Task 3.1 ADDS (`adminInsertCustomer`/`adminInsertFacility`), then drives
 * a Tenant-A command at it. Until those land the suite stays skipped (project red-phase
 * idiom) and the command surface is a LOCAL `notYetImplemented()` placeholder so the
 * file type-checks without importing a missing module.
 *
 * ── GREEN-PHASE HAND-OFF (Story 3.1 dev) ────────────────────────────────────────
 *   1. Replace `notYetImplemented()` with the real `@/server/commands/crm/*` imports.
 *   2. Replace `seedTenantBCustomer`/`seedTenantBFacility` with the real Task-3.1
 *      `adminInsertCustomer`/`adminInsertFacility` service-role seed helpers.
 *   3. Remove `.skip`. Keep the `TENANT_ACCESS_DENIED` assertions — they are the
 *      contract for R-002 (parent-ownership spoofing).
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable.
 *
 * COVERAGE (test-design-epic-3.md P0 "Facility/contact cannot be linked to a Tenant B
 * parent"; story AC4 / Task 2.3 / Task 4.3).
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
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-06-30T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/** RED-PHASE placeholder for the not-yet-built CRM commands (see file header). */
function notYetImplemented(): never {
  throw new Error(
    "Story 3.1 RED PHASE: the CRM commands are not implemented yet. " +
      "Replace this with the real import from @/server/commands/crm/* in the dev phase.",
  );
}

/**
 * RED-PHASE placeholders for the Task-3.1 service-role seed helpers. The dev phase
 * replaces them with the real `adminInsertCustomer`/`adminInsertFacility` added to
 * `tests/factories/tenants.ts` (mirroring `adminInsertMembership`, preserving the
 * Postgres `code` on throw). They seed a REAL Tenant B parent the negative targets.
 */
function seedTenantBCustomer(): never {
  throw new Error("Story 3.1 RED PHASE: adminInsertCustomer not implemented yet.");
}
function seedTenantBFacility(): never {
  throw new Error("Story 3.1 RED PHASE: adminInsertFacility not implemented yet.");
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key client
let tenantBCustomerId: string; // a REAL Tenant B customer (cross-tenant parent target)
let tenantBFacilityId: string; // a REAL Tenant B facility (cross-tenant parent target)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  // GREEN PHASE: seed REAL Tenant B parents so the cross-tenant link has a concrete,
  // existing (but A-invisible) target — never a non-existent id that would deny
  // vacuously. The seed returns the ids the negatives below point Tenant A at.
  tenantBCustomerId = seedTenantBCustomer();
  tenantBFacilityId = seedTenantBFacility();
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

// SKIPPED until the CRM commands + migration + factory seeds land (Story 3.1 dev).
describe.skip("CRM parent-ownership cross-tenant negatives (AC4 / R-002)", () => {
  it("[P0] createFacility with a Tenant B customer_id → TENANT_ACCESS_DENIED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const createFacility = notYetImplemented();
    const result = await runCommand(createFacility, {
      client: a as never,
      input: { customer_id: tenantBCustomerId, name: "A-forged facility" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[P0] createContact with a Tenant B customer_id → TENANT_ACCESS_DENIED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const createContact = notYetImplemented();
    const result = await runCommand(createContact, {
      client: a as never,
      input: { customer_id: tenantBCustomerId, name: "A-forged contact" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[P0] createContact linking a Tenant B facility_id is rejected (not a cross-tenant link)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const createContact = notYetImplemented();
    // The optional facility_id points at a Tenant B facility. Even with a valid
    // (own-tenant) customer, the cross-tenant facility link must be rejected — the
    // composite same-tenant FK on facilities(id, tenant_id) re-using the resolved
    // tenant_id makes it a DB-level reject mapped to VALIDATION_FAILED/
    // TENANT_ACCESS_DENIED, never a raw throw.
    const result = await runCommand(createContact, {
      client: a as never,
      input: {
        // Own-tenant customer would be seeded in green phase; the facility is foreign.
        customer_id: "REPLACE_WITH_OWN_TENANT_CUSTOMER_IN_GREEN_PHASE",
        facility_id: tenantBFacilityId,
        name: "A-forged contact via facility",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect([
        "TENANT_ACCESS_DENIED",
        "VALIDATION_FAILED",
      ]).toContain(result.code);
    }
  });

  it("[P0] a client-supplied tenant_id is IGNORED — the resolved tenant is authority", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const createFacility = notYetImplemented();
    // Even if the caller smuggles Tenant B's tenant_id alongside a Tenant B parent,
    // the command re-derives tenant from membership (Tenant A) → the parent is still
    // invisible → DENIED. Never trust a client tenant id.
    const result = await runCommand(createFacility, {
      client: a as never,
      input: {
        tenant_id: fixture.tenantB.id,
        customer_id: tenantBCustomerId,
        name: "A-forged via client tenant_id",
      } as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });
});

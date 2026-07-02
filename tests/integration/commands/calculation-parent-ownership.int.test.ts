/**
 * Story 5.1 — ATDD RED-PHASE scaffold: cross-tenant PARENT-link command negative
 * (AC3, P0 — 5.1-INT-02 / R-502). The load-bearing parent-ownership-spoofing guard.
 *
 * Proves a Tenant-A `createCalculation` (or `updateCalculation`) that supplies a
 * Tenant-B `customer_id`/`facility_id`/`contact_id` as the calc parent is DENIED with
 * the stable typed `TENANT_ACCESS_DENIED` — the parent is invisible under Tenant A's
 * RLS so the envelope `ownership` verify bites, and the composite same-tenant FK is the
 * DB-level backstop (a cross-tenant link is a `23503` mapped to `TENANT_ACCESS_DENIED`
 * via `throwMappedWriteError`, never a raw throw). Client-supplied `tenant_id` is IGNORED.
 *
 * ── WHY `describe.skip` (RED PHASE) ─────────────────────────────────────────────
 * The calc commands + the `calculation_data_model` migration do not exist yet (Story
 * 5.1 dev Tasks 1-3). The scaffold seeds a REAL Tenant B customer/facility/contact via
 * the service-role factory helpers Task 4.1 ADDS, then drives a Tenant-A command at
 * them. Until those land the suite stays skipped (project red-phase idiom) and the
 * command surface + seeds are LOCAL `notYetImplemented()` placeholders so the file
 * type-checks without importing a missing module.
 *
 * ── GREEN-PHASE HAND-OFF (Story 5.1 dev) ────────────────────────────────────────
 *   1. Replace `notYetImplemented()` with the real `@/server/commands/calculations/*`
 *      import (`createCalculation`).
 *   2. Replace `seedTenantB*` with the real Task-4.1 `adminInsertCustomer`/
 *      `adminInsertFacility`/`adminInsertContact` service-role seed helpers (Tenant B).
 *   3. Remove `.skip`. Keep the `TENANT_ACCESS_DENIED` assertions — they are the
 *      contract for R-502 (parent-ownership spoofing). Seeding a REAL (but A-invisible)
 *      Tenant-B parent guards against a vacuous deny on a non-existent id.
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
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-02T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/** RED-PHASE placeholder for the not-yet-built calc commands (see file header). */
function notYetImplemented(): never {
  throw new Error(
    "Story 5.1 RED PHASE: createCalculation not implemented yet. " +
      "Replace with the real @/server/commands/calculations/* import in the dev phase.",
  );
}

/**
 * RED-PHASE placeholders for the Task-4.1 service-role seed helpers. The dev phase
 * replaces them with the real `adminInsertCustomer`/`adminInsertFacility`/
 * `adminInsertContact` added to `tests/factories/tenants.ts`. They seed REAL Tenant B
 * CRM parents (existing but A-invisible) so the cross-tenant link has a concrete target.
 */
function seedTenantBCustomer(): never {
  throw new Error("Story 5.1 RED PHASE: adminInsertCustomer (Tenant B) not implemented yet.");
}
function seedTenantBFacility(): never {
  throw new Error("Story 5.1 RED PHASE: adminInsertFacility (Tenant B) not implemented yet.");
}
function seedTenantBContact(): never {
  throw new Error("Story 5.1 RED PHASE: adminInsertContact (Tenant B) not implemented yet.");
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key client
let tenantBCustomerId: string; // a REAL Tenant B customer (cross-tenant parent target)
let tenantBFacilityId: string; // a REAL Tenant B facility (cross-tenant parent target)
let tenantBContactId: string; // a REAL Tenant B contact (cross-tenant parent target)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  // GREEN PHASE: seed REAL Tenant B CRM parents so the cross-tenant link points at a
  // concrete, existing (but A-invisible) target — never a non-existent id that would
  // deny vacuously.
  tenantBCustomerId = seedTenantBCustomer();
  tenantBFacilityId = seedTenantBFacility();
  tenantBContactId = seedTenantBContact();
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

// SKIPPED until the calc commands + migration + factory seeds land (Story 5.1 dev).
describe.skip("Calc cross-tenant parent-link denial (AC3 / 5.1-INT-02, R-502)", () => {
  it("[P0] createCalculation with a Tenant-B customer_id → TENANT_ACCESS_DENIED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const createCalculation = notYetImplemented();
    const result = await runCommand(createCalculation, {
      client: a as never,
      input: { customer_id: tenantBCustomerId, title: "Hijack via foreign customer" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[P0] createCalculation with a Tenant-B facility_id → TENANT_ACCESS_DENIED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const createCalculation = notYetImplemented();
    // The customer is A's own (seed omitted for brevity in RED phase); the FACILITY is B's.
    const result = await runCommand(createCalculation, {
      client: a as never,
      input: {
        customer_id: crypto.randomUUID(), // dev phase: A's own customer id
        facility_id: tenantBFacilityId,
        title: "Hijack via foreign facility",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[P0] createCalculation with a Tenant-B contact_id → TENANT_ACCESS_DENIED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const createCalculation = notYetImplemented();
    const result = await runCommand(createCalculation, {
      client: a as never,
      input: {
        customer_id: crypto.randomUUID(), // dev phase: A's own customer id
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
    const createCalculation = notYetImplemented();
    // Even if the caller injects Tenant B's tenant_id, the command resolves the tenant
    // from membership (Tenant A) — the Tenant-B customer is still A-invisible → denied.
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

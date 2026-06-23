/**
 * ATDD RED-PHASE SCAFFOLD — Story 2.2, per-worker two-tenant fixture isolation (R-012 / H5, P1)
 * + the un-gate acceptance for Story 2.1's DB-backed INT scaffold (AC5).
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GATED ON THE STORY 2.2 DEV PHASE — DOES NOT RUN YET.                     ║
 * ║  Needs: real runner (Vitest), local Supabase stack, two-tenant factories. ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * COVERAGE:
 *   R-012 / H5 (P1) → each worker provisions its OWN tenant pair (unique ids/names);
 *                     NO shared mutable fixture. Parallel runs do not interfere.
 *   B1 / P2        → factory contract extends cleanly to later record shapes
 *                    (forward-compat smoke for Epic 3 — additive, no rework).
 *   AC5            → un-gate acceptance: the Story 2.1 DB-backed INT scaffold
 *                    (`tests/integration/server/auth/resolve-tenant-context.int.test.ts`)
 *                    is un-skipped, wired to THESE factories, and passes — proving the
 *                    AC1-AC4 properties Story 2.1 deferred to here. (That file is the
 *                    authoritative 2.1 suite; this case is the explicit handoff marker
 *                    so the un-gate is tracked, not forgotten.)
 *
 * GREEN-PHASE (Story 2.2 dev phase):
 *   1. `import { describe, it, expect } from "vitest";` + factories.
 *   2. Provision two fixtures in the same worker and assert disjoint ids/names.
 *   3. Un-`.skip` `resolve-tenant-context.int.test.ts`, wire it to these factories,
 *      remove `tests/integration/**` from `tsconfig` `exclude`, and make it GREEN.
 *   4. Remove `.skip` here, run after `supabase db reset`, make GREEN.
 */

// Green-phase imports:
// import { describe, it, expect } from "vitest";
// import { createTwoTenantFixture } from "../../factories/tenants";

function gatedFactoryIsolation(): never {
  throw new Error(
    "GATED: per-worker fixture isolation + 2.1-scaffold un-gate acceptance run only " +
      "inside the Story 2.2 dev phase. Intentionally skipped in the ATDD red phase.",
  );
}

describe.skip("Two-tenant factory isolation + 2.1 INT un-gate (GATED on Story 2.2 dev stack)", () => {
  it("[P1] per-worker isolation: two fixtures provisioned in one worker have DISJOINT tenant ids and names (no shared mutable fixture)", async () => {
    gatedFactoryIsolation();
    // const f1 = await createTwoTenantFixture();
    // const f2 = await createTwoTenantFixture();
    // const ids = [f1.tenantA.id, f1.tenantB.id, f2.tenantA.id, f2.tenantB.id];
    // expect(new Set(ids).size).toBe(ids.length); // all unique
    // const names = [f1.tenantA.name, f1.tenantB.name, f2.tenantA.name, f2.tenantB.name];
    // expect(new Set(names).size).toBe(names.length);
  });

  it("[P1] determinism: a fresh fixture exposes exactly two tenants, two active tenant_admins, and one orphan user", async () => {
    gatedFactoryIsolation();
    // const f = await createTwoTenantFixture();
    // expect(f.tenantA.id).not.toBe(f.tenantB.id);
    // expect(f.adminA.id).not.toBe(f.adminB.id);
    // expect(f.orphanUser.id).toBeTruthy();
    // // adminA is an ACTIVE tenant_admin of tenantA (verified via the resolver/RLS reads in sibling suites).
  });

  it("[P2] forward-compat: the fixture handle shape is additive — extending it with CRM-shaped records needs no rework of these names", async () => {
    gatedFactoryIsolation();
    // Smoke only: the { tenantA, tenantB, adminA, adminB, orphanUser } contract must remain
    // stable while Epic 3+ adds e.g. `customerA` / `quoteA` handles ALONGSIDE these.
  });

  it("[AC5] un-gate marker: Story 2.1's resolve-tenant-context.int.test.ts is un-skipped, wired to these factories, and GREEN", async () => {
    gatedFactoryIsolation();
    // Tracking assertion for the Task 6.6 hand-off. The authoritative coverage lives in
    // `tests/integration/server/auth/resolve-tenant-context.int.test.ts`; the green-phase
    // implementer removes ITS `.skip`, points its factory import at `tests/factories/tenants`,
    // removes `tests/integration/**` from `tsconfig` `exclude`, and confirms it passes after
    // `supabase db reset`. This case fails (skipped/red) until that hand-off is done.
  });
});

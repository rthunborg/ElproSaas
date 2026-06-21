/**
 * ATDD RED-PHASE SCAFFOLD — Story 2.1, AUTHORITATIVE integration tests.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GATED ON STORY 2.2 — DOES NOT RUN IN STORY 2.1.                          ║
 * ║                                                                          ║
 * ║  These are the AUTHORITATIVE, DB-backed acceptance tests for Story 2.1's  ║
 * ║  security properties. They CANNOT execute until Story 2.2 lands:          ║
 * ║    - the local Supabase stack (`supabase start` / `supabase db reset`),   ║
 * ║    - the `tenants` / `tenant_memberships` tables + RLS helpers,           ║
 * ║    - the two-tenant factories (tenants, auth users, tenant_admin          ║
 * ║      memberships) — blocker B1.                                           ║
 * ║  And the real test runner (TEA `testarch-framework`).                     ║
 * ║                                                                          ║
 * ║  Per test-design-epic-2.md ("Critical Prerequisite" + Dependencies #2/#3) ║
 * ║  and Story 2.1 Task 6.1/6.2, these scenarios are OWNED/ENROLLED in Story  ║
 * ║  2.2's stack. This file is the red-phase SPEC carried forward so 2.2/2.4  ║
 * ║  can verify nothing fell through — it is intentionally `.skip`-ed and     ║
 * ║  must STAY skipped while running under Story 2.1.                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * COVERAGE (test-design-epic-2.md P0/P1 rows citing Story 2.1 ACs):
 *   AC1 → "Active membership resolves correct tenant context server-side" (P1 INT, R-004)
 *   AC2 → "Authenticated user without active membership is denied; no tenant data loaded" (P0 INT, R-004)
 *       + "Disabled/inactive membership treated as no-access" (P1 INT, R-004)
 *   AC3 → "Anonymous user cannot reach protected command" (P0 INT, R-003)
 *   AC4 → "Command rejects client-supplied tenant_id mismatch" (P0 INT, R-004)
 *
 * GREEN-PHASE INSTRUCTIONS (for whoever lands this inside Story 2.2):
 *   1. Replace the factory/stack placeholders with the real two-tenant factories
 *      and the local-Supabase test client (per-worker tenant pair, B1/H5).
 *   2. Wire the resolver against a real per-request SSR server client bound to a
 *      real authenticated session (password-based / admin-created users — B2).
 *   3. Remove `.skip`, run against `supabase db reset`, make GREEN.
 *   4. Record in the Story 2.2 Dev Agent Record that these 2.1-AC scenarios are now
 *      covered (Task 6.2 hand-off).
 */

// Placeholders — the real imports land with Story 2.2's stack:
// import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
// import { createTwoTenantFixture, makeAuthedServerClient } from "../../../factories/tenants";

function gatedOn2dot2(): never {
  throw new Error(
    "GATED: this DB-backed test runs only inside Story 2.2's local Supabase stack " +
      "+ two-tenant factories. It is intentionally skipped under Story 2.1.",
  );
}

describe.skip("resolveTenantContext — DB-backed (GATED on Story 2.2 stack/factories)", () => {
  it("AC1: an authenticated tenant_admin of Tenant A resolves to Tenant A's context (membership-derived, server-side)", async () => {
    gatedOn2dot2();
    // const { tenantA, adminA } = await createTwoTenantFixture();
    // const supabase = await makeAuthedServerClient(adminA);
    // const result = await resolveTenantContext(supabase);
    // expect(result.ok).toBe(true);
    // expect(result.data?.tenantId).toBe(tenantA.id);
  });

  it("AC2: an authenticated user with no active membership is denied (TENANT_MEMBERSHIP_REQUIRED) and reads ZERO tenant rows", async () => {
    gatedOn2dot2();
    // const { orphanUser } = await createTwoTenantFixture();
    // const supabase = await makeAuthedServerClient(orphanUser);
    // const result = await resolveTenantContext(supabase);
    // expect(result.ok).toBe(false);
    // expect(result.code).toBe("TENANT_MEMBERSHIP_REQUIRED");
    // // And no tenant-owned rows are returned to this user under RLS.
  });

  it("AC2 (distinct): a 'disabled' membership row is treated as no-access, distinct from no-row", async () => {
    gatedOn2dot2();
    // ... seed adminA with status='disabled', expect TENANT_MEMBERSHIP_REQUIRED.
  });

  it("AC3: an anonymous (unauthenticated) caller cannot resolve a context (UNAUTHENTICATED) — no privileged anon path", async () => {
    gatedOn2dot2();
    // const supabase = await makeAnonServerClient();
    // const result = await resolveTenantContext(supabase);
    // expect(result.ok).toBe(false);
    // expect(result.code).toBe("UNAUTHENTICATED");
  });

  it("AC4: Tenant A admin supplying a forged client tenant_id of Tenant B never reads/widens to Tenant B (membership stays authority)", async () => {
    gatedOn2dot2();
    // const { tenantA, tenantB, adminA } = await createTwoTenantFixture();
    // const supabase = await makeAuthedServerClient(adminA);
    // const result = await resolveTenantContext(supabase, { clientTenantId: tenantB.id });
    // // Ignored-or-rejected; resolved tenant is never tenantB, and no Tenant B row is readable.
    // expect(result.data?.tenantId).not.toBe(tenantB.id);
  });
});

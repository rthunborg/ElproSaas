/**
 * ATDD RED-PHASE SCAFFOLD — Story 2.2, SECURITY DEFINER search-path hijack negative (AC4 / R-006).
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GATED ON THE STORY 2.2 DEV PHASE — DOES NOT RUN YET.                     ║
 * ║  Needs: real runner (Vitest), local Supabase stack + tenant_foundation    ║
 * ║  migration (the `is_active_tenant_member` / `is_tenant_admin` helpers),    ║
 * ║  two-tenant factories, and an admin/service-role client to plant the      ║
 * ║  adversarial object + flip search_path.                                   ║
 * ║                                                                          ║
 * ║  Lives under tests/integration/** (already tsconfig-excluded) — NOT under ║
 * ║  supabase/, because creating `supabase/` is the dev phase's gated action. ║
 * ║  The green-phase implementer may relocate to `supabase/tests/rls/` once   ║
 * ║  the stack + tsconfig re-enrollment land (architecture §3/§22 allow both).║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * COVERAGE (test-design-epic-2.md P0; AC4):
 *   AC4 / R-006 → IF a helper is `SECURITY DEFINER`, prove that planting a
 *                 malicious `tenant_memberships`-shaped object (table/function) in
 *                 a schema on a TAMPERED `search_path` CANNOT change the helper's
 *                 authorization result — because the helper pins `search_path`
 *                 (`set search_path = ''` + schema-qualified refs, or
 *                 `set search_path = pg_catalog`).
 *
 *   DECISION GATE (record in the Story 2.2 Dev Agent Record + migration comment):
 *     - If the dev phase declares the helpers `SECURITY INVOKER` (least-privilege,
 *       preferred where it satisfies the RLS need), R-006 is N/A: KEEP this file
 *       but flip the active assertion to "helper still resolves correctly under
 *       the caller's own RLS" and document the N/A in the checklist + Dev Agent
 *       Record. The hijack case below then asserts nothing privileged is bypassable.
 *     - If any helper is `SECURITY DEFINER`, the hijack negative below is LOAD-BEARING.
 *
 * GREEN-PHASE (Story 2.2 dev phase):
 *   1. `import { describe, it, expect } from "vitest";` + factories + an admin SQL exec helper.
 *   2. As an admin/service-role connection, create a hostile object on a schema and
 *      prepend it to `search_path` (e.g. `set search_path = evil, public`), then call
 *      the helper for a user/tenant pair where the TRUE answer is known.
 *   3. Assert the helper returns the TRUE authorization answer (the hostile object did
 *      not shadow `public.tenant_memberships` / `auth.uid()`), proving the pinned path.
 *   4. Remove `.skip`, run after `supabase db reset`, make GREEN.
 */

// Green-phase imports:
// import { describe, it, expect } from "vitest";
// import { createTwoTenantFixture } from "../../factories/tenants";
// (admin SQL exec helper + a way to call is_active_tenant_member/is_tenant_admin land with the dev stack)

function gatedSecurityDefiner(): never {
  throw new Error(
    "GATED: SECURITY DEFINER search-path hijack negative runs only inside the Story 2.2 " +
      "dev phase (helpers + admin SQL exec). Intentionally skipped in the ATDD red phase.",
  );
}

const HELPERS = ["is_active_tenant_member", "is_tenant_admin"] as const;

describe.skip("SECURITY DEFINER helpers resist search_path hijack (AC4 / R-006) (GATED on Story 2.2 dev stack)", () => {
  for (const helper of HELPERS) {
    it(`[P0] ${helper}: a malicious object on a tampered search_path CANNOT alter the helper's authorization result`, async () => {
      gatedSecurityDefiner();
      // const { tenantB, orphanUser } = await createTwoTenantFixture();
      // await adminExec(`create schema if not exists evil;`);
      // // A hostile table that, if resolved unqualified, would falsely report membership:
      // await adminExec(`create table evil.tenant_memberships (user_id uuid, tenant_id uuid, role text, status text);`);
      // await adminExec(`insert into evil.tenant_memberships values ('${orphanUser.id}','${tenantB.id}','tenant_admin','active');`);
      // await adminExec(`set search_path = evil, public;`);
      // // The helper pins its own search_path, so the TRUE answer (no real membership) must hold:
      // const result = await adminCallHelper(helper, { user: orphanUser.id, tenant: tenantB.id });
      // expect(result).toBe(false);
      //
      // // If the dev phase chose SECURITY INVOKER instead, this assertion becomes:
      // //   "helper resolves the same authorization answer under the caller's RLS" — and
      // //   R-006 is recorded N/A in the checklist + Dev Agent Record.
    });
  }

  it("[REVIEW NOTE] the search_path / DEFINER-vs-INVOKER decision is recorded in the migration comment AND the Dev Agent Record", async () => {
    gatedSecurityDefiner();
    // Documentation gate, not a runtime assertion: the green-phase implementer must record
    // (a) whether each helper is DEFINER or INVOKER, and (b) for any DEFINER, that
    // `search_path` is pinned (`set search_path = ''` + schema-qualified, or pg_catalog),
    // with this hijack negative proving it. AC4 requires an explicit review note.
  });
});

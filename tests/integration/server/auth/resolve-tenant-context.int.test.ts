/**
 * Story 2.1 AUTHORITATIVE DB-backed integration tests — UN-GATED and GREEN in
 * Story 2.2 (Task 6.6 hand-off).
 *
 * These cover Story 2.1's security properties (AC1-AC4) against the REAL local
 * Supabase stack + the two-tenant factories this story landed. They were carried
 * forward `.skip`-ed from Story 2.1 (whose stack/factories did not yet exist);
 * Story 2.2 un-skips them, wires them to `tests/factories/tenants`, and proves
 * them green.
 *
 *   AC1 → active membership resolves the correct tenant context (server-side)
 *   AC2 → no active membership → TENANT_MEMBERSHIP_REQUIRED + zero tenant rows
 *         (+ a 'disabled' membership treated as no-access, distinct from no-row)
 *   AC3 → anonymous caller → UNAUTHENTICATED
 *   AC4 → a forged client tenant_id never reads/widens to Tenant B
 *
 * Runs against the LOCAL Supabase stack only; skips when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  makeAnonServerClient,
  adminInsertMembership,
  cleanupFixture,
  type TwoTenantFixture,
} from "../../../factories/tenants";
import { isLocalStackReachable } from "../../../support/test-env";
import { skipUnlessStack } from "../../../support/stack-gate";

// The factory returns a `@supabase/supabase-js` client; the resolver expects the
// structurally-compatible `@supabase/ssr` server client (it only uses
// `.auth.getClaims()` and `.from(...)`). Adapt the type at the call boundary.
type ResolverClient = Parameters<typeof resolveTenantContext>[0] extends infer O
  ? O extends { client?: infer C }
    ? C
    : never
  : never;

let stackUp = false;
let fixture: TwoTenantFixture;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe("resolveTenantContext — DB-backed (Story 2.1 AC1-AC4, un-gated in 2.2)", () => {
  it("AC1: an active tenant_admin of Tenant A resolves to Tenant A's context", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const client = (await makeAuthedServerClient(
      fixture.adminA,
    )) as unknown as ResolverClient;
    const result = await resolveTenantContext({ client });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tenantId).toBe(fixture.tenantA.id);
      expect(result.data.userId).toBe(fixture.adminA.id);
      expect(result.data.role).toBe("tenant_admin");
      expect(result.data.status).toBe("active");
      // The joined tenant name resolves (NOT NULL constraint guarantees it).
      expect(result.data.tenantName).toBe(fixture.tenantA.name);
    }
  });

  it("AC2: an authenticated user with no membership is denied and reads ZERO tenant rows", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const client = (await makeAuthedServerClient(
      fixture.orphanUser,
    )) as unknown as ResolverClient;
    const result = await resolveTenantContext({ client });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_MEMBERSHIP_REQUIRED");

    // And no tenant-owned rows are readable by this user under RLS.
    const authed = await makeAuthedServerClient(fixture.orphanUser);
    const { data: tenants } = await authed.from("tenants").select("id");
    expect(tenants ?? []).toEqual([]);
    const { data: memberships } = await authed
      .from("tenant_memberships")
      .select("tenant_id");
    expect(memberships ?? []).toEqual([]);
  });

  it("AC2 (distinct): a 'disabled' membership is treated as no-access, distinct from no-row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Build a dedicated fixture so the disabled state does not perturb others.
    const f = await createTwoTenantFixture();
    try {
      // Seed the orphan as a DISABLED tenant_admin of tenant A (admin path).
      await adminInsertMembership({
        tenant_id: f.tenantA.id,
        user_id: f.orphanUser.id,
        role: "tenant_admin",
        status: "disabled",
      });
      const client = (await makeAuthedServerClient(
        f.orphanUser,
      )) as unknown as ResolverClient;
      const result = await resolveTenantContext({ client });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("TENANT_MEMBERSHIP_REQUIRED");
    } finally {
      await cleanupFixture(f);
    }
  });

  it("AC3: an anonymous caller cannot resolve a context (UNAUTHENTICATED)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const client = (await makeAnonServerClient()) as unknown as ResolverClient;
    const result = await resolveTenantContext({ client });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHENTICATED");
  });

  it("AC4: Tenant A admin supplying a forged Tenant B tenant_id never reads/widens to Tenant B", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const client = (await makeAuthedServerClient(
      fixture.adminA,
    )) as unknown as ResolverClient;
    const result = await resolveTenantContext({
      client,
      clientTenantId: fixture.tenantB.id, // forged — must be ignored
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Authority stays membership-derived: tenant is A, never the forged B.
      expect(result.data.tenantId).toBe(fixture.tenantA.id);
      expect(result.data.tenantId).not.toBe(fixture.tenantB.id);
    }
  });
});

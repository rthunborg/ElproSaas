/**
 * Story 2.2 — coverage EXPANSION: membership data-integrity + policy-scope
 * guarantees the existing suite does not prove (G4 / G5 / G6).
 *
 *   G4  FK `on delete cascade`: deleting a `tenants` row OR an `auth.users` row
 *       removes the dependent `tenant_memberships` rows — no DANGLING authorization
 *       rows survive (the migration's stated invariant + the factory's cleanup
 *       contract). Verified via the admin/service-role path (introspection-level).
 *   G5  Within-tenant READ scope of `tenant_memberships_select_own`: an active
 *       admin reads a SECOND membership in their OWN tenant, while STILL reading
 *       zero of another tenant's. Proves the SELECT policy is correctly scoped —
 *       neither under- (own co-members hidden) nor over-broad (cross-tenant leak).
 *   G6  DB-backed `selectPreferredMembership` (Task 7.2): a user who is DISABLED in
 *       one tenant and ACTIVE in another resolves to the ACTIVE tenant — the real
 *       cross-tenant multi-row scenario the UNIQUE(tenant_id,user_id) constraint
 *       permits, previously covered only by a unit-level fake.
 *
 * Runs against the LOCAL Supabase stack only; skips when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  adminInsertMembership,
  cleanupFixture,
} from "../../factories/tenants";
import { adminQuery, adminExec, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

// The factory returns a supabase-js client; the resolver expects the
// structurally-compatible @supabase/ssr server client (only .auth.getClaims() +
// .from(...)). Adapt at the call boundary (same pattern as the 2.1 INT scaffold).
type ResolverClient = Parameters<typeof resolveTenantContext>[0] extends infer O
  ? O extends { client?: infer C }
    ? C
    : never
  : never;

let stackUp = false;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});

afterAll(async () => {
  if (stackUp) await closeAdminPool();
});

async function membershipCount(filter: {
  column: "tenant_id" | "user_id";
  value: string;
}): Promise<number> {
  const rows = await adminQuery<{ n: string }>(
    `select count(*)::text as n from public.tenant_memberships where ${filter.column} = $1`,
    [filter.value],
  );
  return Number(rows[0]?.n ?? "0");
}

describe("FK on delete cascade — no dangling authorization rows (G4)", () => {
  it("[P1] deleting a tenant cascades its membership rows away", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const f = await createTwoTenantFixture();
    try {
      // Pre-condition: tenantA has adminA's membership.
      expect(await membershipCount({ column: "tenant_id", value: f.tenantA.id })).toBe(1);

      await adminExec(`delete from public.tenants where id = $1`, [f.tenantA.id]);

      // The membership row is gone (tenant_id FK → on delete cascade).
      expect(await membershipCount({ column: "tenant_id", value: f.tenantA.id })).toBe(0);
    } finally {
      // adminA's membership already cascaded; cleanup still removes the users +
      // tenantB (best-effort, tolerant of the already-deleted tenantA).
      await cleanupFixture(f);
    }
  });

  it("[P1] deleting an auth user cascades their membership rows away", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const f = await createTwoTenantFixture();
    try {
      expect(await membershipCount({ column: "user_id", value: f.adminA.id })).toBe(1);

      // Remove the auth user directly (user_id FK → on delete cascade).
      await adminExec(`delete from auth.users where id = $1`, [f.adminA.id]);

      expect(await membershipCount({ column: "user_id", value: f.adminA.id })).toBe(0);
    } finally {
      await cleanupFixture(f);
    }
  });
});

describe("tenant_memberships_select_own scope: own-tenant breadth, no cross-tenant leak (G5)", () => {
  it("[P1] an active admin reads a SECOND membership in their OWN tenant, but ZERO of another tenant's", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const f = await createTwoTenantFixture();
    try {
      // Add a second member (the orphan) to tenantA as an active tenant_admin.
      await adminInsertMembership({
        tenant_id: f.tenantA.id,
        user_id: f.orphanUser.id,
        role: "tenant_admin",
        status: "active",
      });

      const a = await makeAuthedServerClient(f.adminA);

      // adminA (active admin of tenantA) sees BOTH tenantA memberships under the
      // SELECT policy (it scopes by is_tenant_admin(tenant_id), not by own row).
      const { data: ownTenantRows, error: ownErr } = await a
        .from("tenant_memberships")
        .select("user_id, tenant_id")
        .eq("tenant_id", f.tenantA.id);
      expect(ownErr).toBeNull();
      expect((ownTenantRows ?? []).length).toBe(2);
      const seenUsers = new Set((ownTenantRows ?? []).map((r) => r.user_id as string));
      expect(seenUsers.has(f.adminA.id)).toBe(true);
      expect(seenUsers.has(f.orphanUser.id)).toBe(true);

      // …but reads ZERO of tenantB's memberships (no cross-tenant widening).
      const { data: otherTenantRows } = await a
        .from("tenant_memberships")
        .select("user_id")
        .eq("tenant_id", f.tenantB.id);
      expect(otherTenantRows ?? []).toEqual([]);
    } finally {
      await cleanupFixture(f);
    }
  });
});

describe("selectPreferredMembership active-first across tenants — DB-backed (G6 / Task 7.2)", () => {
  it("[P1] a user DISABLED in one tenant and ACTIVE in another resolves to the ACTIVE tenant", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const f = await createTwoTenantFixture();
    try {
      // orphanUser: disabled tenant_admin in tenantA, active tenant_admin in tenantB.
      // (UNIQUE(tenant_id,user_id) allows one row per tenant → multi-row only here.)
      await adminInsertMembership({
        tenant_id: f.tenantA.id,
        user_id: f.orphanUser.id,
        role: "tenant_admin",
        status: "disabled",
      });
      await adminInsertMembership({
        tenant_id: f.tenantB.id,
        user_id: f.orphanUser.id,
        role: "tenant_admin",
        status: "active",
      });

      const client = (await makeAuthedServerClient(
        f.orphanUser,
      )) as unknown as ResolverClient;
      const result = await resolveTenantContext({ client });

      // The resolver must pick the ACTIVE membership (tenantB), never the stale
      // disabled tenantA row — regardless of how 'active'/'disabled' would sort.
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.tenantId).toBe(f.tenantB.id);
        expect(result.data.tenantId).not.toBe(f.tenantA.id);
        expect(result.data.status).toBe("active");
      }
    } finally {
      await cleanupFixture(f);
    }
  });

  it("[P1] a user DISABLED in BOTH tenants resolves to NO context (TENANT_MEMBERSHIP_REQUIRED)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const f = await createTwoTenantFixture();
    try {
      await adminInsertMembership({
        tenant_id: f.tenantA.id,
        user_id: f.orphanUser.id,
        role: "tenant_admin",
        status: "disabled",
      });
      await adminInsertMembership({
        tenant_id: f.tenantB.id,
        user_id: f.orphanUser.id,
        role: "tenant_admin",
        status: "disabled",
      });

      const client = (await makeAuthedServerClient(
        f.orphanUser,
      )) as unknown as ResolverClient;
      const result = await resolveTenantContext({ client });

      // No active row anywhere → denied (and never silently picks a disabled one).
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("TENANT_MEMBERSHIP_REQUIRED");
    } finally {
      await cleanupFixture(f);
    }
  });
});

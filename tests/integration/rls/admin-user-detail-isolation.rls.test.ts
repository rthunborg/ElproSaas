import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const serverClient = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@/server/db/supabase-server-client", () => ({
  createSupabaseServerClient: serverClient.create,
}));

import { readAdminUserDetail } from "@/features/admin-users/read";

const GENERIC_FAILURE = "Användarna kunde inte läsas. Försök igen om en stund.";

afterEach(() => {
  serverClient.create.mockReset();
});

afterAll(async () => {
  await closeAdminPool();
});

describe("Admin user detail read-model isolation (Story 11.4 AC4)", () => {
  test("[P0] returns the generic empty result for a missing membership UUID", async (testCtx) => {
    const stackUp = await isLocalStackReachable();
    if (skipUnlessStack(testCtx, stackUp)) return;

    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } =
      await import("../../factories/tenants");
    const fixture = await createTwoTenantFixture();
    try {
      serverClient.create.mockResolvedValue(await makeAuthedServerClient(fixture.adminA));

      const result = await readAdminUserDetail(crypto.randomUUID());

      expect(result).toEqual({ detail: null, error: GENERIC_FAILURE });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  test("[P0] gives a tenant-A Admin the exact missing-target result for Tenant B's real membership", async (testCtx) => {
    const stackUp = await isLocalStackReachable();
    if (skipUnlessStack(testCtx, stackUp)) return;

    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } =
      await import("../../factories/tenants");
    const { adminQuery } = await import("../../factories/admin-sql");
    const fixture = await createTwoTenantFixture();
    try {
      const foreignMembershipRows = await adminQuery<{
        id: string;
        tenant_id: string;
        user_id: string;
      }>(
        "select id, tenant_id, user_id from public.tenant_memberships where tenant_id = $1 and user_id = $2",
        [fixture.tenantB.id, fixture.adminB.id],
      );
      expect(foreignMembershipRows).toHaveLength(1);
      const foreignMembership = foreignMembershipRows[0]!;
      expect(foreignMembership.tenant_id).toBe(fixture.tenantB.id);
      expect(foreignMembership.user_id).toBe(fixture.adminB.id);

      serverClient.create.mockResolvedValue(await makeAuthedServerClient(fixture.adminA));
      const missingResult = await readAdminUserDetail(crypto.randomUUID());
      const foreignResult = await readAdminUserDetail(foreignMembership.id);

      expect(missingResult).toEqual({ detail: null, error: GENERIC_FAILURE });
      expect(foreignResult).toEqual(missingResult);
      expect(foreignResult).toEqual({ detail: null, error: GENERIC_FAILURE });
    } finally {
      await cleanupFixture(fixture);
    }
  });
});

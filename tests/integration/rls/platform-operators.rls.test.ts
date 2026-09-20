import { describe, expect, test } from "vitest";
import {
  assertProvisioningTenantIsolation,
  attemptProvisioningAsEveryUnauthorizedIdentity,
  cleanupPlatformOperatorFixture,
  createPlatformOperatorFixture,
  makePlatformOperatorClient,
} from "../../factories/platform-operators";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

describe("platform operator authority — Story 12.1 ATDD", () => {
  test("[P0] 12.1-INT-001 operator self-read succeeds while tenant roles, orphan, and anonymous identities cannot enumerate platform_operators", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const fixture = await createPlatformOperatorFixture();
    try {
      const operatorClient = await makePlatformOperatorClient(fixture.operator);
      const ownRows = await operatorClient
        .from("platform_operators")
        .select("user_id");
      expect(ownRows.error).toBeNull();
      expect(ownRows.data).toEqual([{ user_id: fixture.operator.id }]);

      for (const subject of [
        fixture.tenantAdmin,
        fixture.orphan,
        fixture.anonymous,
      ]) {
        const deniedClient = await makePlatformOperatorClient(subject);
        const denied = await deniedClient
          .from("platform_operators")
          .select("user_id");
        // PostgREST returns either an empty projection (authenticated callers)
        // or null with a generic privilege denial (anon); neither reveals rows.
        expect(denied.data ?? []).toEqual([]);
      }
    } finally {
      await cleanupPlatformOperatorFixture(fixture);
    }
  });

  test("[P0] 12.1-INT-010 tenant roles, orphan, anonymous, absent/forged claims, and direct callers receive generic pre-validation denial with zero effects", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;

    for (const result of await attemptProvisioningAsEveryUnauthorizedIdentity()) {
      expect(result).toMatchObject({
        code: "42501",
        generic: true,
        validationReached: false,
        effects: 0,
        tenantData: null,
      });
    }
  });

  test("[P0] 12.1-INT-011 a provisioning command cannot read or mutate foreign tenant state or leak its existence", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    expect(await assertProvisioningTenantIsolation()).toEqual({
      foreignDigestUnchanged: true,
      foreignExistenceLeaked: false,
      foreignBusinessDataReturned: false,
    });
  });
});

/**
 * Story 12.2 RED scaffolds. The implementation task must extend the existing
 * factory with a direct-entry probe; preserving the Story 12.1 suite avoids a
 * duplicate provisioning-protocol test or an unresolved future import today.
 */
const operatorConsoleEntryProbe = undefined as unknown as (
  input: { readonly identity: string; readonly entry: string },
) => Promise<{ readonly code: string; readonly data: null; readonly effects: number; readonly validationReached: boolean; readonly auditWrites: number; readonly providerCalls: number; readonly databaseMutations: number; readonly existenceLeaked?: boolean }>;

describe("platform operator authority — Story 12.2 console ATDD (RED)", () => {
  test.skip("[P0] 12.2-INT-001 independently denies list, detail, preview, provision, reconcile, and retry before any side effect", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;

    // Given every denied identity invokes each entry directly.
    const outcomes = await Promise.all(
      ["tenant_admin", "tenant_user", "orphan", "anonymous", "absent_claim", "forged_claim"].flatMap((identity) =>
        ["list", "detail", "preview", "provision", "reconcile", "retry"].map((entry) => operatorConsoleEntryProbe({ identity, entry })),
      ),
    );

    // Then all paths stop before validation, audit, provider, or mutation work.
    expect(outcomes).toEqual(Array(36).fill({
      code: "OPERATOR_ACCESS_DENIED", data: null, effects: 0, validationReached: false,
      auditWrites: 0, providerCalls: 0, databaseMutations: 0,
    }));
  });

  test.skip("[P0] 12.2-INT-002 denies direct base-table probes with no tenant or provisioning existence signal", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;

    // Given a tenant identity tries the browser/RLS base-table path.
    const result = await operatorConsoleEntryProbe({ identity: "tenant_admin", entry: "base_table_probe" });

    // Then the same generic denial has no observable data or mutation.
    expect(result).toMatchObject({
      code: "OPERATOR_ACCESS_DENIED", data: null, effects: 0, databaseMutations: 0, existenceLeaked: false,
    });
  });
});

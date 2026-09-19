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

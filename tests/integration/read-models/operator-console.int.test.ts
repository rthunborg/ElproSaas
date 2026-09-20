import { describe, expect, test } from "vitest";
import { cleanupPlatformOperatorFixture, createPlatformOperatorFixture, makePlatformOperatorClient } from "../../factories/platform-operators";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

describe("Story 12.2 operator-console read model", () => {
  test("[P0] 12.2-INT-001 platform projection denies a tenant identity without data", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const fixture = await createPlatformOperatorFixture();
    try {
      const result = await (await makePlatformOperatorClient(fixture.tenantAdmin)).rpc("operator_console_projection", { p_tenant_id: null });
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("42501");
    } finally { await cleanupPlatformOperatorFixture(fixture); }
  });

  test("[P0] 12.2-INT-002 operator projection has the exact safe column contract", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const fixture = await createPlatformOperatorFixture();
    try {
      const result = await (await makePlatformOperatorClient(fixture.operator)).rpc("operator_console_projection", { p_tenant_id: null });
      expect(result.error).toBeNull();
      for (const row of result.data ?? []) expect(Object.keys(row).sort()).toEqual(["canonical_organisation_identity", "created_at", "first_admin_state", "provisioning_state", "tenant_name"]);
    } finally { await cleanupPlatformOperatorFixture(fixture); }
  });
});

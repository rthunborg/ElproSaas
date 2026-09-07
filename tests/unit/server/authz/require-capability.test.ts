/** Story 11.1 ATDD RED — generic capability denial contract. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { requireCapability } from "@/server/authz/require-capability";

test("[P0] 11.1-UNIT-005 absent, inactive, unknown, and ungranted inputs return indistinguishable PERMISSION_DENIED", () => {
  for (const roles of [undefined, [], ["unknown"], ["montor"]]) {
    const result = requireCapability({ roles, module: "foundation", capability: "Memberships.Manage" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "PERMISSION_DENIED");
      assert.equal("tenantId" in result, false);
      assert.equal("targetId" in result, false);
    }
  }
});

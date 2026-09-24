/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

async function loadContainmentChecker(): Promise<any> {
  return import(["../../../../scripts/verify/check-service-role-containment.mjs"].join(""));
}

describe("Story 13.4 delivery and public-shell containment (ATDD RED)", () => {
  test("[P0][13.4-STATIC-001] allows the provider adapter only in server email modules and rejects credentials or adapter imports from client paths", async () => {
    const { verifyServiceRoleContainment } = await loadContainmentChecker();
    const result = await verifyServiceRoleContainment({ root: process.cwd(), allowlist: ["src/server/email/provider.ts"] });
    assert.deepEqual(result.violations, []);
    assert.deepEqual(result.allowedUsages, ["src/server/email/provider.ts"]);
  });

  test("[P1][13.4-STATIC-002] keeps the public unsubscribe route free of app shell, tenant context, session, navigation, and provider imports", async () => {
    const { verifyPublicRouteImports } = await loadContainmentChecker();
    const result = await verifyPublicRouteImports({ root: process.cwd(), route: "src/app/(public)/unsubscribe" });
    assert.deepEqual(result.violations, []);
    assert.doesNotMatch(JSON.stringify(result.imports), /app-shell|tenant-context|session|navigation|provider/i);
  });
});

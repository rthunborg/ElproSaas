import { describe, expect, test } from "vitest";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

type ConsoleProbe = (input: Record<string, unknown>) => Promise<Record<string, unknown>>;

/** Replace with the Story 12.2 local-Supabase fixture after its server entries exist. */
const operatorConsoleProbe = undefined as unknown as ConsoleProbe;

describe("Story 12.2 operator-console read model (ATDD, RED)", () => {
  test.skip("[P0] 12.2-INT-001 independently authorizes list and detail and gives every denied identity one generic zero-data result", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;

    // Given each read is called directly, rather than only through the route layout.
    const denied = await Promise.all([
      "tenant_admin",
      "tenant_user",
      "orphan",
      "anonymous",
      "absent_claim",
      "forged_claim",
    ].flatMap((identity) => ["list", "detail"].map((entry) => operatorConsoleProbe({ identity, entry }))));

    // Then the server leaks neither data nor which tenant or entry was requested.
    expect(denied).toEqual(Array(12).fill({ code: "OPERATOR_ACCESS_DENIED", data: null, effects: 0 }));
  });

  test.skip("[P0] 12.2-INT-002 returns exact safe fields and serializes no tenant A/B nested or aliased canaries", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;

    // Given the fixture seeds customer, quote, file, money, membership, hash, token, and audit canaries.
    const result = await operatorConsoleProbe({ identity: "operator", entry: "list", seedCanaries: true });

    // Then neither rows, errors, nor the response envelope contains them.
    expect(result).toMatchObject({
      rows: expect.any(Array),
      errors: [],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /TENANT-[AB]-CANARY|customer-canary|quote-canary|file-canary|money-canary|membership-canary|token-canary|hash-canary|audit-canary/i,
    );
  });
});

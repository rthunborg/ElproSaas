import assert from "node:assert/strict";
import { test } from "node:test";

type IsolationResult = { readonly ok: boolean; readonly violations: readonly string[] };

/** Replace with the checked-in static scanner when the Story 12.2 implementation adds it. */
const runOperatorConsoleIsolationCheck = undefined as unknown as (
  fixture: "forbidden-tenant-imports-and-nav-entry" | "missing-independent-gates",
) => Promise<IsolationResult>;

test.skip("[P0] 12.2-STATIC-001 rejects operator routes importing tenant shell/context/navigation or exposing an operator tenant-nav entry", async () => {
  // Given a deliberately forbidden import/nav fixture.
  const result = await runOperatorConsoleIsolationCheck("forbidden-tenant-imports-and-nav-entry");

  // Then the scanner identifies the platform/tenant boundary violation.
  assert.equal(result.ok, false);
  assert.match(result.violations.join("\n"), /AppShell|tenant context|nav/i);
});

test.skip("[P0] 12.2-STATIC-001 requires independent platform gating for page, read-model, and action entry points", async () => {
  // Given a fixture that omits one direct-entry platform gate.
  const result = await runOperatorConsoleIsolationCheck("missing-independent-gates");

  // Then layout-only authorization is rejected.
  assert.equal(result.ok, false);
  assert.match(result.violations.join("\n"), /resolve-platform-operator|is_platform_operator/i);
});

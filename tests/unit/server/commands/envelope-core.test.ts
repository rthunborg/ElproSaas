/**
 * Story 2.3 — PURE-LOGIC acceptance tests for the server command-envelope DECISION
 * CORE (`@/server/commands/envelope-core`), exercising AC1/AC2 gate ORDERING and the
 * stable typed error codes WITHOUT a live database. Mirrors the established
 * pure-core pattern in `tests/unit/server/auth/resolve-tenant-context.test.ts`
 * (node:test + node:assert, fakes injected — no I/O).
 *
 * GREEN as of Story 2.3 dev-story (modules implemented):
 *   - src/server/commands/envelope-core.ts  (pure gate ordering → stable code)
 *   - src/server/commands/command-errors.ts (stable code union + user-safe messages)
 *
 * COVERAGE (test-design-epic-2.md P1, R-003/R-004; story AC1/AC2; Task 5.1):
 *   AC2 gate: unauthenticated                 → UNAUTHENTICATED      + NO audit row
 *   AC2 gate: authenticated, no active admin  → TENANT_MEMBERSHIP_REQUIRED + NO audit row
 *   AC2 gate: input fails typed schema        → VALIDATION_FAILED    + NO audit row
 *   AC2 gate: cross-tenant target id          → TENANT_ACCESS_DENIED + NO audit row
 *   AC2 gate: transient infra throw           → SERVER_ERROR         + NO audit row
 *   AC1 happy: all gates pass                  → ok(...)              + exactly ONE audit row
 *   AC1 ordering: gates short-circuit in §5 order (auth → membership → validate → own)
 *   AC2: a failure Result carries NO data and NO raw throw/stack/SQL crosses the boundary
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runCommandCore,
  type RunCommandCoreInput,
} from "@/server/commands/envelope-core";
import { COMMAND_MESSAGES } from "@/server/commands/command-errors";

async function load() {
  return { runCommandCore, COMMAND_MESSAGES };
}

test.skip("[P0] 11.1 envelope: declared capability denial occurs before validation, ownership, execute, and audit", async () => {
  const { runCommandCore: run } = await load();
  const calls: string[] = [];
  const result = await run({
    resolveContext: async () => ({ ok: true, data: { roles: ["montor"] } }),
    requiredCapability: { module: "foundation", capability: "Memberships.Manage" },
    validate: async () => { calls.push("validate"); return { ok: true, data: {} }; },
    ownership: async () => { calls.push("ownership"); return { ok: true }; },
    execute: async () => { calls.push("execute"); return { ok: true, data: {} }; },
    audit: async () => { calls.push("audit"); },
  });
  assert.deepEqual(result, { ok: false, code: "PERMISSION_DENIED" });
  assert.deepEqual(calls, []);
});

/** The input shape these tests build (a result carrying `{ id }` or a lifecycle field). */
type TestInput = RunCommandCoreInput<unknown, Record<string, unknown>, unknown>;

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TARGET_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

/** An active tenant_admin context (the resolver output the envelope reuses). */
const ACTIVE_CTX = {
  userId: USER_ID,
  tenantId: TENANT_A,
  role: "tenant_admin",
  status: "active",
  userEmail: "admin@example.test",
  tenantName: "Acme Elektro AB",
} as const;

/**
 * Build the fake decision-core inputs. The pure core receives the ALREADY-resolved
 * tenant-context Result (mirroring `resolveTenantContext`), a typed validator, an
 * ownership checker, and an `execute` fn — all injectable so the unit asserts ONLY
 * the gate ordering + stable-code mapping, never real auth/DB.
 *
 * `auditWrites` records every audit row the core would emit so each test can assert
 * "NO audit row on failure" / "exactly ONE on success" without touching a DB.
 */
function makeScenario(overrides: Partial<TestInput> = {}) {
  const auditWrites: unknown[] = [];
  const base: TestInput = {
    // step 1-3: pre-resolved tenant context Result (ok = authed active admin).
    tenantContextResult: { ok: true, data: ACTIVE_CTX },
    // step 4: typed input validator → ok(value) | err("VALIDATION_FAILED").
    validate: (raw: unknown) => ({ ok: true, data: raw as Record<string, unknown> }),
    rawInput: { foo: "bar" },
    // step 5: ownership checker → ok | err("TENANT_ACCESS_DENIED").
    verifyOwnership: async () => ({ ok: true }),
    // step 6-7: the command body. Throwing here simulates a transient infra fault.
    execute: async () => ({ id: TARGET_ID }),
    // step 8: audit sink the core calls on success.
    recordAudit: async (row) => {
      auditWrites.push(row);
    },
    auditable: true,
    command: "test.command",
    eventType: "test.executed",
  };
  return { input: { ...base, ...overrides }, auditWrites };
}

test("AC2 gate (1): an unauthenticated caller short-circuits with UNAUTHENTICATED and writes NO audit row", async () => {
  const { input, auditWrites } = makeScenario({
    tenantContextResult: { ok: false, code: "UNAUTHENTICATED", message: "x" },
  });

  const { runCommandCore, COMMAND_MESSAGES } = await load();
  const result = await runCommandCore(input);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "UNAUTHENTICATED");
    assert.equal(result.message, COMMAND_MESSAGES.UNAUTHENTICATED);
    assert.equal("data" in result, false); // no tenant/user signal leaks
  }
  assert.equal(auditWrites.length, 0); // NO audit row on a failed gate
});

test("AC2 gate (2): authenticated but no active tenant_admin → TENANT_MEMBERSHIP_REQUIRED, no audit row", async () => {
  const { input, auditWrites } = makeScenario({
    tenantContextResult: {
      ok: false,
      code: "TENANT_MEMBERSHIP_REQUIRED",
      message: "x",
    },
  });

  const { runCommandCore } = await load();
  const result = await runCommandCore(input);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TENANT_MEMBERSHIP_REQUIRED");
  assert.equal(auditWrites.length, 0);
});

test("AC2 gate (3): input failing the typed schema → VALIDATION_FAILED with a generic message, no raw value echoed, no audit row", async () => {
  const { input, auditWrites } = makeScenario({
    validate: () => ({ ok: false, code: "VALIDATION_FAILED" }),
    rawInput: { secret: "p@ssw0rd-should-never-be-echoed" },
  });

  const { runCommandCore, COMMAND_MESSAGES } = await load();
  const result = await runCommandCore(input);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "VALIDATION_FAILED");
    assert.equal(result.message, COMMAND_MESSAGES.VALIDATION_FAILED);
    // The raw invalid value must NEVER appear in the user-safe message (no echo/leak).
    assert.equal(result.message.includes("p@ssw0rd"), false);
  }
  assert.equal(auditWrites.length, 0);
});

test("AC2 gate (4): a target id resolving to a DIFFERENT tenant → TENANT_ACCESS_DENIED, no audit row", async () => {
  const { input, auditWrites } = makeScenario({
    verifyOwnership: async () => ({ ok: false, code: "TENANT_ACCESS_DENIED" }),
  });

  const { runCommandCore } = await load();
  const result = await runCommandCore(input);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TENANT_ACCESS_DENIED");
  assert.equal(auditWrites.length, 0);
});

test("AC2 gate (5): a TRANSIENT throw inside execute maps to SERVER_ERROR (not a raw throw), no audit row", async () => {
  const { input, auditWrites } = makeScenario({
    execute: async () => {
      throw new Error("connection reset by peer at db.ts:42"); // infra fault w/ stack
    },
  });

  const { runCommandCore, COMMAND_MESSAGES } = await load();
  const result = await runCommandCore(input);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "SERVER_ERROR");
    // The generic message must leak NO stack / SQL / file path.
    assert.equal(result.message, COMMAND_MESSAGES.SERVER_ERROR);
    assert.equal(/db\.ts|connection reset|stack/i.test(result.message), false);
  }
  // execute failed AFTER the gates but BEFORE the audit write → still no audit row.
  assert.equal(auditWrites.length, 0);
});

test("AC1 happy path: all gates pass → ok(execute result) AND exactly ONE audit row is written", async () => {
  const { input, auditWrites } = makeScenario();

  const { runCommandCore } = await load();
  const result = await runCommandCore(input);

  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.data, { id: TARGET_ID });
  assert.equal(auditWrites.length, 1); // step 8 fires exactly once on success
});

test("AC1 ordering: gates short-circuit in §5 order — a validation failure is reported even when ownership would ALSO fail (validate runs first)", async () => {
  // Both validate and verifyOwnership would fail; the envelope must report the
  // EARLIER gate (VALIDATION_FAILED), proving deterministic §5 step ordering
  // (auth → membership → validate → own), not last-writer-wins.
  const { input } = makeScenario({
    validate: () => ({ ok: false, code: "VALIDATION_FAILED" }),
    verifyOwnership: async () => ({ ok: false, code: "TENANT_ACCESS_DENIED" }),
  });

  const { runCommandCore } = await load();
  const result = await runCommandCore(input);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "VALIDATION_FAILED");
});

test("AC1: a non-auditable command does NOT write an audit row even on success (auditable flag respected)", async () => {
  const { input, auditWrites } = makeScenario({ auditable: false });

  const { runCommandCore } = await load();
  const result = await runCommandCore(input);

  assert.equal(result.ok, true);
  assert.equal(auditWrites.length, 0); // only auditable commands emit a row
});

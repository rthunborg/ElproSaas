/**
 * Story 2.3 — PURE-LOGIC EDGE tests for the envelope DECISION CORE
 * (`@/server/commands/envelope-core`), supplementing the gate-ordering proofs in
 * `envelope-core.test.ts`. These pin down the AUDIT-ROW COMPOSITION branches the
 * primary suite does not assert: the default `buildAuditFields` fallback, the exact
 * snake_case columns the core emits, that the SINGLE command instant and the
 * correlation id thread into the row, and the audit-write-failure → SERVER_ERROR
 * fail-closed path.
 *
 * Coverage gap closed by this file (test-automation expansion): the core's audit-row
 * builder (gate 8) was only observed as "exactly one write" / "no write"; here every
 * persisted field is asserted, including the no-`buildAuditFields` default branch and
 * the recordAudit-throws path (AC2/AC3/AC6). Mirrors the node:test + node:assert
 * pure-unit style (fakes injected, no I/O).
 *
 * COVERAGE (test-design-epic-2.md P1, R-011; story AC1/AC2/AC3/AC6).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runCommandCore,
  type AuditRow,
  type RunCommandCoreInput,
} from "@/server/commands/envelope-core";
import { COMMAND_MESSAGES } from "@/server/commands/command-errors";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CORRELATION = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const TARGET_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const FIXED_ISO = "2026-06-29T12:00:00.000Z";

const ACTIVE_CTX = {
  userId: USER_ID,
  tenantId: TENANT_A,
  role: "tenant_admin",
  status: "active",
  userEmail: null,
  tenantName: null,
} as const;

type Input = RunCommandCoreInput<unknown, Record<string, unknown>, unknown>;

function makeScenario(overrides: Partial<Input> = {}) {
  const auditWrites: AuditRow[] = [];
  const base: Input = {
    tenantContextResult: { ok: true, data: ACTIVE_CTX },
    validate: (raw: unknown) => ({ ok: true, data: raw as Record<string, unknown> }),
    rawInput: {},
    verifyOwnership: async () => ({ ok: true }),
    execute: async () => ({ id: TARGET_ID }),
    recordAudit: (row) => {
      auditWrites.push(row);
    },
    auditable: true,
    command: "test.command",
    eventType: "test.executed",
    correlationId: CORRELATION,
    clock: { now: () => new Date(FIXED_ISO) },
  };
  return { input: { ...base, ...overrides }, auditWrites };
}

test("AC3 default audit fields: with NO buildAuditFields, the row uses targetType ?? '', null target_id, and empty metadata", async () => {
  const { input, auditWrites } = makeScenario({ targetType: "tenant" });
  const result = await runCommandCore(input);

  assert.equal(result.ok, true);
  assert.equal(auditWrites.length, 1);
  const row = auditWrites[0];
  assert.equal(row.target_type, "tenant");
  assert.equal(row.target_id, null);
  assert.deepEqual(row.metadata, {});
});

test("AC3 default audit fields: an absent targetType defaults to an empty string (never undefined) in the row", async () => {
  const { input, auditWrites } = makeScenario({ targetType: undefined });
  await runCommandCore(input);
  assert.equal(auditWrites[0].target_type, "");
});

test("AC3/AC6 row composition: tenant/actor/command/event_type/correlation/created_at are taken from the resolved context + single clock + ids", async () => {
  const { input, auditWrites } = makeScenario({
    targetType: "tenant",
    command: "membership.disable",
    eventType: "membership.disabled",
  });
  await runCommandCore(input);
  const row = auditWrites[0];

  assert.equal(row.tenant_id, TENANT_A); // resolved tenant, never client-supplied
  assert.equal(row.actor_user_id, USER_ID); // authenticated actor
  assert.equal(row.command, "membership.disable");
  assert.equal(row.event_type, "membership.disabled");
  assert.equal(row.correlation_id, CORRELATION); // threaded per-command id
  assert.equal(row.created_at, FIXED_ISO); // the ONE captured instant (no drift)
});

test("AC3 buildAuditFields override: a supplied builder controls target_id + metadata; the core still stamps tenant/actor/clock", async () => {
  const { input, auditWrites } = makeScenario({
    buildAuditFields: () => ({
      targetType: "customer",
      targetId: TARGET_ID,
      metadata: { reason: "quote_accepted" },
    }),
  });
  await runCommandCore(input);
  const row = auditWrites[0];

  assert.equal(row.target_type, "customer");
  assert.equal(row.target_id, TARGET_ID);
  assert.deepEqual(row.metadata, { reason: "quote_accepted" });
  // Authority fields are NOT builder-controlled.
  assert.equal(row.tenant_id, TENANT_A);
  assert.equal(row.actor_user_id, USER_ID);
});

test("AC2 fail-closed: if the audit WRITE itself throws, the command returns SERVER_ERROR (never ok while the row was not persisted)", async () => {
  const { input } = makeScenario({
    recordAudit: () => {
      throw new Error("insert into audit_events failed: connection reset");
    },
  });
  const result = await runCommandCore(input);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "SERVER_ERROR");
    assert.equal(result.message, COMMAND_MESSAGES.SERVER_ERROR);
    // No internal detail (SQL / stack) crosses the boundary.
    assert.equal(/audit_events|connection reset|insert/i.test(result.message), false);
  }
});

test("AC1 non-auditable: execute still runs and its result is returned, with NO audit row and NO recordAudit call", async () => {
  let recordCalls = 0;
  const { input } = makeScenario({
    auditable: false,
    recordAudit: () => {
      recordCalls += 1;
    },
    execute: async () => ({ id: TARGET_ID, done: true }),
  });
  const result = await runCommandCore(input);

  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.data, { id: TARGET_ID, done: true });
  assert.equal(recordCalls, 0); // the sink is never even invoked when not auditable
});

test("AC2 ordering: an UNAUTHENTICATED context short-circuits before validate/ownership/execute ever run (no side effects)", async () => {
  let executed = false;
  const { input, auditWrites } = makeScenario({
    tenantContextResult: { ok: false, code: "UNAUTHENTICATED" },
    execute: async () => {
      executed = true;
      return { id: TARGET_ID };
    },
  });
  const result = await runCommandCore(input);

  assert.equal(result.ok, false);
  assert.equal(executed, false); // gate 1 fired before the body
  assert.equal(auditWrites.length, 0);
});

test("AC2: a SERVER_ERROR from the tenant-context resolver is surfaced verbatim with the shared message", async () => {
  const { input, auditWrites } = makeScenario({
    tenantContextResult: { ok: false, code: "SERVER_ERROR" },
  });
  const result = await runCommandCore(input);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "SERVER_ERROR");
    assert.equal(result.message, COMMAND_MESSAGES.SERVER_ERROR);
  }
  assert.equal(auditWrites.length, 0);
});

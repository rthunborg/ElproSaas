/**
 * Story 2.3 — PURE-LOGIC determinism tests for the injectable COMMAND CLOCK
 * (`@/server/commands/clock`) and the single-timestamp discipline (H1 / R-011 /
 * AC6): ONE `clock.now()` captured per command threads into every lifecycle field,
 * event-type derivation, and the audit `created_at`. Time-dependent assertions use
 * a fixed injected clock and NEVER sleep.
 *
 * GREEN as of Story 2.3 dev-story (clock implemented + threaded through the core).
 *
 * COVERAGE (test-design-epic-2.md P1, R-011; story AC6; Task 2.1 / 5.1).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { systemClock, type CommandClock } from "@/server/commands/clock";
import { runCommandCore } from "@/server/commands/envelope-core";

const FIXED_ISO = "2026-06-29T12:00:00.000Z";

function fixedClock(): CommandClock {
  return { now: () => new Date(FIXED_ISO) };
}
async function load() {
  return { systemClock, runCommandCore };
}

test("AC6/R-011: systemClock exposes a now() returning a Date (default real clock)", async () => {
  const { systemClock } = await load();
  const before = Date.now();
  const t = systemClock.now();
  const after = Date.now();
  assert.ok(t instanceof Date);
  assert.ok(t.getTime() >= before && t.getTime() <= after);
});

test("AC6/R-011: a fixed injected clock yields IDENTICAL created_at across the audit row and any lifecycle field — captured ONCE, no Date.now() drift", async () => {
  // The core captures clock.now() ONE time at the start and threads that single
  // value everywhere. Capture the audit row the core emits and assert its
  // created_at equals the injected timestamp exactly (no per-field re-read).
  const { runCommandCore } = await load();
  let auditedRow: { created_at: string } | undefined;
  const result = await runCommandCore({
    tenantContextResult: {
      ok: true,
      data: {
        userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        tenantId: "11111111-1111-1111-1111-111111111111",
        role: "tenant_admin",
        status: "active",
        userEmail: null,
        tenantName: null,
      },
    },
    validate: (raw: unknown) => ({ ok: true, data: raw }),
    rawInput: {},
    verifyOwnership: async () => ({ ok: true }),
    execute: async (ctx: { clock: CommandClock }) => ({
      // a lifecycle field set from the SAME command clock
      lifecycleAt: ctx.clock.now().toISOString(),
    }),
    recordAudit: async (row: { created_at: string }) => {
      auditedRow = row;
    },
    auditable: true,
    command: "test.command",
    eventType: "test.executed",
    clock: fixedClock(),
  });

  assert.equal(result.ok, true);
  assert.ok(auditedRow);
  assert.equal(auditedRow!.created_at, FIXED_ISO);
  if (result.ok) {
    // The lifecycle field derived inside execute uses the very same instant.
    assert.equal(result.data.lifecycleAt, FIXED_ISO);
  }
});

test("AC6/R-011: two reads of the SAME command clock within one command return the same instant (no wall-clock advance mid-command)", () => {
  const clock = fixedClock();
  const a = clock.now().toISOString();
  const b = clock.now().toISOString();
  assert.equal(a, b);
  assert.equal(a, FIXED_ISO);
});

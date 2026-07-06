/**
 * Story 7.2 — PURE contract coverage for the `ACCEPTANCE_ALREADY_RECORDED` command error code + its
 * user-safe Swedish message (test-design-epic-7.md#7.2-INT-06, Task 3.2, R-707/R-710). This is the
 * ONE new stable error code Story 7.2 introduces: the idempotency-conflict surface for a raced accept
 * that lost the one-acceptance-per-version race and could NOT be resolved into an idempotent return.
 *
 * The DB-backed INT suite (7.2-INT-06) proves the concurrent-accept BEHAVIOR (exactly one job; the
 * loser idempotent-returns OR fails cleanly with `COMMAND_CONFLICT`/`ACCEPTANCE_ALREADY_RECORDED`).
 * This fast gate pins the pure boundary CONTRACT that INT never asserts directly and that the local
 * stack would SKIP when unreachable:
 *   1. the code is a real member of `CommandErrorCode` (a `CommandError` can carry it);
 *   2. it maps to a NON-EMPTY, user-safe message (no SQL/stack/SQLSTATE, no echoed row values / PII);
 *   3. it is DISTINCT from the reserved-but-generic `COMMAND_CONFLICT` (7.2 chose a dedicated, more
 *      actionable "already accepted — refresh to see it" surface rather than reusing the generic one);
 *   4. the `CommandError` for it carries the CODE as its `.message` (never the raw pg text) — the
 *      single-voice boundary discipline every stable code follows.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — PURE, NO DB, NO PII, NO clock (the fast gate).
 *
 * [Source: src/server/commands/command-errors.ts (CommandErrorCode + COMMAND_MESSAGES +
 *  ACCEPTANCE_ALREADY_RECORDED); story 7.2 Task 3.2 + Dev Notes "Stable error codes";
 *  src/server/commands/quotes/accept-and-create-job.ts (the raced-23505 → ACCEPTANCE_ALREADY_RECORDED
 *  mapping); test-design-epic-7.md#7.2-INT-06]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CommandError,
  isCommandError,
  COMMAND_MESSAGES,
} from "@/server/commands/command-errors";

test("[7.2] ACCEPTANCE_ALREADY_RECORDED is a real CommandErrorCode a CommandError can carry", () => {
  // Constructing it must type-check + produce a genuine CommandError (the code is on the union).
  const e = new CommandError("ACCEPTANCE_ALREADY_RECORDED");
  assert.ok(isCommandError(e));
  assert.equal(e.code, "ACCEPTANCE_ALREADY_RECORDED");
});

test("[7.2] the CommandError carries the CODE as its .message — never a raw pg / SQLSTATE body (no leak)", () => {
  // `CommandError` does `super(code)` so the human message is derived downstream from
  // COMMAND_MESSAGES; the thrown error's own message must be the stable code, not leaky pg text.
  const e = new CommandError("ACCEPTANCE_ALREADY_RECORDED");
  assert.equal(e.message, "ACCEPTANCE_ALREADY_RECORDED");
  assert.doesNotMatch(e.message, /23505|quote_acceptances_version_unique|tenant|customer/i);
});

test("[7.2] ACCEPTANCE_ALREADY_RECORDED maps to a NON-EMPTY user-safe Swedish message", () => {
  const message = COMMAND_MESSAGES.ACCEPTANCE_ALREADY_RECORDED;
  assert.equal(typeof message, "string");
  assert.ok(message.trim().length > 0, "the message must be non-empty");
});

test("[7.2] the ACCEPTANCE_ALREADY_RECORDED message leaks NO SQL / SQLSTATE / stack / row values", () => {
  const message = COMMAND_MESSAGES.ACCEPTANCE_ALREADY_RECORDED;
  // No SQLSTATE, constraint name, table name, SQL keyword, or stack marker.
  assert.doesNotMatch(
    message,
    /23505|QV\d{3}|_unique|quote_acceptances|jobs\b|SELECT|INSERT|UPDATE|rollback|at Object|\.ts:/i,
  );
  // No PII-shaped value (personnummer/orgnr) baked into a boundary message.
  assert.doesNotMatch(message, /\b\d{6,8}[-+]\d{4}\b/);
});

test("[7.2] ACCEPTANCE_ALREADY_RECORDED is DISTINCT from the generic reserved COMMAND_CONFLICT", () => {
  // 7.2 deliberately chose a dedicated, more actionable surface over reusing COMMAND_CONFLICT
  // (Task 3.2) — the two codes AND their messages must not collapse into one.
  assert.notEqual(
    COMMAND_MESSAGES.ACCEPTANCE_ALREADY_RECORDED,
    COMMAND_MESSAGES.COMMAND_CONFLICT,
  );
});

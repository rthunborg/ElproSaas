/**
 * Story 7.3 — PURE coverage for `throwMappedJobWriteError` (the `updateJob` write-error SQLSTATE →
 * stable `CommandError` mapper). Companion to the DB-backed `update-job.int.test.ts`: the INT suite
 * proves the audited persistence + tenant-isolation BEHAVIOR end-to-end (and SKIPS when the local
 * Supabase stack is down), whereas this fast `node --test` gate pins every mapping branch cheaply,
 * UNCONDITIONALLY, and WITHOUT a database — so a regression in the error contract (e.g. a raw pg
 * message starting to leak, or a transient fault masquerading as a stable outcome) is caught even
 * when the stack is unavailable. Mirrors `quote-write-error-mapper.test.ts` verbatim.
 *
 * The load-bearing rules (kept in lockstep with jobs-db.ts):
 *   - `23503` (FK) / `42501` (RLS WITH CHECK / privilege) → TENANT_ACCESS_DENIED (no existence
 *     disclosure on a cross-tenant/foreign owner — AC3);
 *   - `23505` (unique) / `23514` (status/event_type CHECK) / `22P02` (malformed uuid/date) →
 *     VALIDATION_FAILED;
 *   - ANY other/absent code → a GENERIC non-`CommandError` plain Error (the envelope maps it to a
 *     retryable SERVER_ERROR) that NEVER surfaces the raw Postgres message body (which can embed row
 *     values / customer identity — R-710 audit/leak hygiene).
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock. `jobs-db.ts` imports
 * only `CommandError`/`CommandDbClient` (no `next/headers`), so it resolves under the unit runner.
 *
 * [Source: src/server/commands/jobs/jobs-db.ts (throwMappedJobWriteError — the mapping table);
 *  src/server/commands/command-errors.ts (CommandError + isCommandError); story 7.3 AC3/AC4 + Task 4.3;
 *  test-design-epic-7.md#7.3-INT-02; tests/unit/server/commands/quote-write-error-mapper.test.ts]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { throwMappedJobWriteError } from "@/server/commands/jobs/jobs-db";
import { CommandError, isCommandError } from "@/server/commands/command-errors";

/** Run the mapper and return the thrown error (it always throws). */
function catchMapped(error: { code?: string; message?: string }): unknown {
  try {
    throwMappedJobWriteError(error);
  } catch (e) {
    return e;
  }
  throw new Error("throwMappedJobWriteError must always throw");
}

test("7.3: 23503 (composite same-tenant FK) / 42501 (RLS WITH CHECK / privilege) → TENANT_ACCESS_DENIED", () => {
  for (const code of ["23503", "42501"]) {
    const e = catchMapped({ code, message: "constraint / privilege detail" });
    assert.ok(e instanceof CommandError, `${code} must throw a CommandError`);
    assert.equal(
      (e as CommandError).code,
      "TENANT_ACCESS_DENIED",
      `${code} → TENANT_ACCESS_DENIED`,
    );
  }
});

test("7.3: 23505 (unique) / 23514 (status/event_type CHECK) / 22P02 (invalid text repr) → VALIDATION_FAILED", () => {
  for (const code of ["23505", "23514", "22P02"]) {
    const e = catchMapped({ code, message: "unique / check / cast detail" });
    assert.ok(e instanceof CommandError, `${code} must throw a CommandError`);
    assert.equal(
      (e as CommandError).code,
      "VALIDATION_FAILED",
      `${code} → VALIDATION_FAILED`,
    );
  }
});

test("7.3: the TENANT_ACCESS_DENIED mapping never surfaces the raw SQLSTATE or pg message (no existence/leak signal)", () => {
  const e = catchMapped({
    code: "23503",
    message: "insert on jobs violates fk jobs_customer_id_fkey (customer 9999 tenant 4711-…)",
  });
  assert.ok(e instanceof CommandError);
  // The CommandError carries the CODE as its message (`super(code)`) — never the raw pg text.
  assert.equal((e as CommandError).message, "TENANT_ACCESS_DENIED");
  assert.doesNotMatch((e as CommandError).message, /23503|jobs_customer|9999|4711/);
});

test("7.3: an UNMAPPED code throws a GENERIC non-CommandError (never a stable code, never the raw message)", () => {
  const e = catchMapped({
    code: "XX999",
    message: "customer Anna Andersson 19800101-1234 accepted_price_ore=125000",
  });
  // A default-branch error is a plain Error (the envelope maps it to a retryable SERVER_ERROR) — NOT a
  // stable CommandError, so a transient infra fault can never masquerade as an access/validation outcome.
  assert.ok(e instanceof Error);
  assert.equal(isCommandError(e), false);
  // The default message references only the CODE placeholder — never the leaky pg message body.
  assert.doesNotMatch((e as Error).message, /Anna|19800101|125000|customer/);
});

test("7.3: an error with NO code throws a generic non-CommandError (defensive default)", () => {
  const e = catchMapped({ message: "no code present — treat as a transient fault" });
  assert.ok(e instanceof Error);
  assert.equal(isCommandError(e), false);
  // The "?" placeholder is used when the code is absent — still no message-body leak.
  assert.doesNotMatch((e as Error).message, /no code present/);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Story 7.4 (ATDD RED PHASE) — the accepted-record lock mapper branch.
//
// { skip: true } until 7.4 lands: the additive migration 20260711120000_accepted_record_lock.sql
// RAISEs the custom SQLSTATE `AR704` from the `enforce_job_source_ref_lock` trigger when a DIRECT SQL
// UPDATE mutates an immutable job source ref; the `throwMappedJobWriteError` branch must map that to
// the NEW stable `ACCEPTED_RECORD_LOCKED` command code (mirroring the QV409 → QUOTE_VERSION_LOCKED
// branch in the quote mapper). Remove `{ skip: true }` when 7.4 is implemented and this must PASS.
//
// AR704 → ACCEPTED_RECORD_LOCKED is a DISTINCT-but-related sibling of 6.4's QV409 → QUOTE_VERSION_LOCKED
// (the "one model, three scopes, shared lock-code FAMILY not a fork" retro constraint): a family means
// related-but-distinct codes with a shared trigger shape, NOT one reused code and NOT a divergent
// mechanism. Both co-exist; neither is merged or renamed.
//
// [Source: story 7.4 Task 2.2; test-design-epic-7.md#7.4-INT-01/02, R-704;
//  src/server/commands/jobs/jobs-db.ts (throwMappedJobWriteError — add the AR704 branch);
//  src/server/commands/command-errors.ts (add ACCEPTED_RECORD_LOCKED to the union + COMMAND_MESSAGES);
//  src/server/commands/quotes/quote-db.ts (the QV409 → QUOTE_VERSION_LOCKED template)]
// ════════════════════════════════════════════════════════════════════════════════════════════════

test("7.4: AR704 (accepted-record lock trigger) → ACCEPTED_RECORD_LOCKED (distinct from QUOTE_VERSION_LOCKED)", { skip: true }, () => {
  const e = catchMapped({ code: "AR704", message: "accepted record is locked (trigger AR704)" });
  assert.ok(e instanceof CommandError, "AR704 must throw a CommandError");
  assert.equal(
    (e as CommandError).code,
    "ACCEPTED_RECORD_LOCKED",
    "AR704 → ACCEPTED_RECORD_LOCKED",
  );
});

test("7.4: the ACCEPTED_RECORD_LOCKED mapping never surfaces the raw SQLSTATE or pg message (no leak)", { skip: true }, () => {
  const e = catchMapped({
    code: "AR704",
    message: "update on jobs rejected by enforce_job_source_ref_lock (customer 9999 accepted_price_ore=125000)",
  });
  assert.ok(e instanceof CommandError);
  // The CommandError carries the CODE as its message (`super(code)`) — never the raw pg text.
  assert.equal((e as CommandError).message, "ACCEPTED_RECORD_LOCKED");
  assert.doesNotMatch((e as CommandError).message, /AR704|jobs|9999|125000|customer/);
});

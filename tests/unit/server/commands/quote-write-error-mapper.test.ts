/**
 * Story 6.4 (+ 6.1/6.3) — PURE coverage for `throwMappedQuoteWriteError` (the quote write-error
 * SQLSTATE → stable `CommandError` mapper). test-design-epic-6.md#6.4-INT-02, R-605.
 *
 * `throwMappedQuoteWriteError` translates a Postgres/PostgREST write error into a STABLE,
 * user-safe `CommandErrorCode` — NEVER the raw pg message (which can embed row values / customer
 * identity). The load-bearing branch for Story 6.4 is the custom `QV409` SQLSTATE (raised by BOTH
 * the sent-lock trigger AND the RPC's not-draft assertion) → `QUOTE_VERSION_LOCKED`, distinct from
 * the standard classes so it can never collide with them. Before this suite the mapping table was
 * only exercised (skippably) through the DB-backed INT suite; this pins every branch cheaply and
 * UNCONDITIONALLY under the fast `node --test` gate — no DB, no silent-skip risk.
 *
 * The mapper is pure (branches on `error.code`), so `node --test` can protect it without a
 * database. It throws `CommandError` (code only — the message is derived downstream from
 * COMMAND_MESSAGES), so each case asserts on the thrown `CommandError.code` and that the story-
 * critical mapping never leaks the raw SQLSTATE / pg text.
 *
 * [Source: src/server/commands/quotes/quote-db.ts:454 (throwMappedQuoteWriteError — the mapping
 *  table incl. QV409 → QUOTE_VERSION_LOCKED); src/server/commands/command-errors.ts (CommandError
 *  + CommandErrorCode); story 6.4 Task 3.3 + Task 6; test-design-epic-6.md#6.4-INT-02, R-605]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { throwMappedQuoteWriteError } from "@/server/commands/quotes/quote-db";
import { CommandError, isCommandError } from "@/server/commands/command-errors";

/** Run the mapper and return the thrown error (it always throws). */
function catchMapped(error: { code?: string; message?: string }): unknown {
  try {
    throwMappedQuoteWriteError(error);
  } catch (e) {
    return e;
  }
  throw new Error("throwMappedQuoteWriteError must always throw");
}

test("[6.4] QV409 (the sent-lock trigger + RPC not-draft assertion) → QUOTE_VERSION_LOCKED", () => {
  // A realistic raw trigger message that MUST NOT leak — only the stable code surfaces.
  const e = catchMapped({
    code: "QV409",
    message: "sent version is locked: column intro_text cannot be updated (value=…)",
  });
  assert.ok(isCommandError(e), "must throw a CommandError");
  assert.ok(e instanceof CommandError);
  assert.equal(e.code, "QUOTE_VERSION_LOCKED");
});

test("[6.4] the QV409 mapping never surfaces the raw SQLSTATE or pg message (no leak)", () => {
  const e = catchMapped({
    code: "QV409",
    message: "base_total_ore=999999 rejected on sent version 1111-…",
  });
  assert.ok(e instanceof CommandError);
  // The CommandError carries the CODE as its message (`super(code)`) — never the raw pg text.
  assert.equal(e.message, "QUOTE_VERSION_LOCKED");
  assert.doesNotMatch(e.message, /QV409|base_total_ore|999999|1111/);
});

test("[6.1] 23503 (FK violation) / 42501 (insufficient privilege) → TENANT_ACCESS_DENIED", () => {
  for (const code of ["23503", "42501"]) {
    const e = catchMapped({ code, message: "constraint / privilege detail" });
    assert.ok(e instanceof CommandError, `${code} must throw a CommandError`);
    assert.equal(e.code, "TENANT_ACCESS_DENIED", `${code} → TENANT_ACCESS_DENIED`);
  }
});

test("[6.1] 23505 (unique) / 23514 (check) / 22P02 (invalid text repr) → VALIDATION_FAILED", () => {
  for (const code of ["23505", "23514", "22P02"]) {
    const e = catchMapped({ code, message: "unique / check / cast detail" });
    assert.ok(e instanceof CommandError, `${code} must throw a CommandError`);
    assert.equal(e.code, "VALIDATION_FAILED", `${code} → VALIDATION_FAILED`);
  }
});

test("[6.4] an UNMAPPED code throws a generic non-CommandError (never a stable code, never the raw message)", () => {
  const e = catchMapped({ code: "XX999", message: "customer Anna Andersson 19800101-1234" });
  // A default-branch error is a plain Error (the envelope maps it to SERVER_ERROR) — NOT a
  // stable CommandError, so it can never masquerade as a locked/validation outcome.
  assert.ok(e instanceof Error);
  assert.equal(isCommandError(e), false);
  // The default message includes only the CODE placeholder, never the leaky pg message body.
  assert.doesNotMatch((e as Error).message, /Anna|19800101/);
});

test("[6.4] an error with NO code throws a generic non-CommandError (defensive default)", () => {
  const e = catchMapped({ message: "no code present" });
  assert.ok(e instanceof Error);
  assert.equal(isCommandError(e), false);
});

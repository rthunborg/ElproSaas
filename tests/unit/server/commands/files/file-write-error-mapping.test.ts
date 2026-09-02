/**
 * Story 8.4 — PURE coverage for the `FL823 → FILE_LINK_LOCKED` mapper branch (the file-write SQLSTATE
 * → stable `CommandError` mapper). Companion to the DB-backed `file-link-lock.int.test.ts` /
 * `file-link-lock.rls.test.ts`: the INT/RLS suites prove the two-layer lock BEHAVIOR end-to-end (and
 * SKIP when the local Supabase stack is down), whereas this fast `node --test` gate pins the mapping
 * branch cheaply, UNCONDITIONALLY, and WITHOUT a database — so an error-contract regression (a raw pg
 * message leaking, or the lock code collapsing into an opaque SERVER_ERROR) is caught even when the
 * stack is unavailable. Mirrors `job-write-error-mapping.test.ts` (the 7.4 AR704 template) verbatim.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * RED PHASE (ATDD) — the two 8.4 tests are `{ skip: true }`. `throwMappedFileWriteError` does not yet
 * map `FL823`, and `FILE_LINK_LOCKED` is not yet in the `CommandErrorCode` union — Story 8.4 Task 3.1
 * adds the code + message and Task 3.2 adds the `FL823` branch (BEFORE the standard-class cases so a
 * lock RAISE surfaces the stable code, not SERVER_ERROR). The EXISTING file-mapper branch tests below
 * stay ACTIVE (they cover the shipped 8.1 mappings — a regression guard). Remove `{ skip: true }` from
 * the two 8.4 tests in dev-story green phase.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `FL823 → FILE_LINK_LOCKED` is a DISTINCT-but-related SIBLING of 6.4's `QV409 → QUOTE_VERSION_LOCKED`
 * and 7.4's `AR704 → ACCEPTED_RECORD_LOCKED` (the "one model, three scopes, shared lock-code FAMILY not
 * a fork" retro constraint, R-822): a family means related-but-distinct codes with a shared trigger
 * shape, NOT one reused code and NOT a divergent mechanism. All three co-exist; none is merged/renamed.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock. `file-db.ts` imports
 * only `CommandError`/`CommandDbClient` (no `next/headers`), so it resolves under the unit runner.
 *
 * [Source: src/server/commands/files/file-db.ts (throwMappedFileWriteError — the mapping table + the
 *  new FL823 branch); src/server/commands/command-errors.ts (CommandError + isCommandError; the
 *  FILE_LINK_LOCKED union member + the family doc comment); story 8.4 AC1/AC3 + Task 3.1/3.2;
 *  test-design-epic-8.md (8.4 command-code half); tests/unit/server/commands/job-write-error-mapping.test.ts
 *  (the AR704 template to mirror)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { throwMappedFileWriteError } from "@/server/commands/files/file-db";
import { CommandError, isCommandError } from "@/server/commands/command-errors";

/** Run the mapper and return the thrown error (it always throws). */
function catchMapped(error: { code?: string; message?: string }): unknown {
  try {
    throwMappedFileWriteError(error);
  } catch (e) {
    return e;
  }
  throw new Error("throwMappedFileWriteError must always throw");
}

// ── EXISTING (shipped 8.1) mappings — a regression guard, stays ACTIVE ────────────────────────────

test("8.1 (guard): 23503 (composite same-tenant FK) / 42501 (RLS WITH CHECK / privilege) → TENANT_ACCESS_DENIED", () => {
  for (const code of ["23503", "42501"]) {
    const e = catchMapped({ code, message: "constraint / privilege detail" });
    assert.ok(e instanceof CommandError, `${code} must throw a CommandError`);
    assert.equal((e as CommandError).code, "TENANT_ACCESS_DENIED", `${code} → TENANT_ACCESS_DENIED`);
  }
});

test("8.1 (guard): 23505 (unique) / 23514 (check) / 22P02 (invalid text repr) → VALIDATION_FAILED", () => {
  for (const code of ["23505", "23514", "22P02"]) {
    const e = catchMapped({ code, message: "unique / check / cast detail" });
    assert.ok(e instanceof CommandError, `${code} must throw a CommandError`);
    assert.equal((e as CommandError).code, "VALIDATION_FAILED", `${code} → VALIDATION_FAILED`);
  }
});

test("8.1 (guard): an UNMAPPED code throws a GENERIC non-CommandError (never a stable code, never the raw message)", () => {
  const e = catchMapped({
    code: "XX999",
    message: "object_path 4711-…/secret.pdf display_name customer-Anna.pdf",
  });
  assert.ok(e instanceof Error);
  assert.equal(isCommandError(e), false);
  // The default message references only the CODE placeholder — never the leaky pg message body.
  assert.doesNotMatch((e as Error).message, /Anna|secret|object_path|4711/);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Story 8.4 (RED — remove `{ skip: true }` on green) — the file-link lock mapper branch.
//
// The additive migration 20260712120000_file_link_lock.sql RAISEs the custom SQLSTATE `FL823` from
// the `enforce_file_link_lock` / `enforce_file_lock` triggers when a locked link/file is mutated or
// hard-deleted; the `throwMappedFileWriteError` branch (added BEFORE the standard-class cases) maps
// that to the NEW stable `FILE_LINK_LOCKED` command code (mirroring the QV409 → QUOTE_VERSION_LOCKED
// and AR704 → ACCEPTED_RECORD_LOCKED branches).
// ════════════════════════════════════════════════════════════════════════════════════════════════

test(
  "8.4: FL823 (file-link lock trigger) → FILE_LINK_LOCKED (distinct from QUOTE_VERSION_LOCKED / ACCEPTED_RECORD_LOCKED)",
  () => {
    const e = catchMapped({ code: "FL823", message: "file link is locked (trigger FL823)" });
    assert.ok(e instanceof CommandError, "FL823 must throw a CommandError");
    assert.equal((e as CommandError).code, "FILE_LINK_LOCKED", "FL823 → FILE_LINK_LOCKED");
  },
);

test("10.6: AR704 from late acceptance-evidence append/relink → ACCEPTED_RECORD_LOCKED", () => {
  const e = catchMapped({ code: "AR704", message: "acceptance evidence is immutable" });
  assert.ok(e instanceof CommandError);
  assert.equal((e as CommandError).code, "ACCEPTED_RECORD_LOCKED");
});

test(
  "8.4: the FILE_LINK_LOCKED mapping never surfaces the raw SQLSTATE or pg message (no leak / no existence disclosure)",
  () => {
    const e = catchMapped({
      code: "FL823",
      message: "update on file_links rejected by enforce_file_link_lock (object_path 4711-…/offert.pdf)",
    });
    assert.ok(e instanceof CommandError);
    // The CommandError carries the CODE as its message (`super(code)`) — never the raw pg text.
    assert.equal((e as CommandError).message, "FILE_LINK_LOCKED");
    assert.doesNotMatch((e as CommandError).message, /FL823|file_links|object_path|offert|4711/);
  },
);

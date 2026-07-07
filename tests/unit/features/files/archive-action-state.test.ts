/**
 * Story 8.5 — coverage-expansion UNIT pins for the PURE archive-action-state contract
 * (`src/features/files/archive-action-state.ts`, Task 2.3) — 8.5-UNIT-02 (P1, AC5; R-809).
 *
 * The panel/index ARCHIVE-only affordance wires the EXISTING `archiveFile` command through
 * `archiveFileAction`, mapping its typed `Result` code to one of THREE user-safe states. That
 * decision table previously lived INLINE inside the `"use server"` action — a module the fast
 * strip-types `node --test` gate can NOT import (the coverage-shape lesson `classifyUploadError`
 * follows: a decision trapped in a `"use server"`/`.tsx` module is vacuous-green). It is now the
 * pure `classifyArchiveError` classifier this suite pins at EVERY branch:
 *   - `FILE_LINK_LOCKED`                            → LOCKED (defensive — the UI always ARCHIVES);
 *   - `TENANT_ACCESS_DENIED` / `FILE_ACCESS_DENIED` → PERMISSION (R-809 — one generic shape, a
 *     foreign id is indistinguishable from not-found, no existence disclosure);
 *   - `UNAUTHENTICATED` / `TENANT_MEMBERSHIP_REQUIRED` → PERMISSION (generic, no leak);
 *   - `SERVER_ERROR` / any unknown code             → NETWORK_OR_SERVER (transient, retryable);
 * plus the message contract: one non-empty, DISTINCT user-safe Swedish message per state, and the
 * PERMISSION message carries NO existence/tenant signal (R-809 — a foreign file reads identically to
 * nothing at all).
 *
 * Runs under `node --test` (`pnpm run test:unit`) — PURE, NO DB, NO PII, NO clock, NO JSX.
 *
 * [Source: story 8.5 AC5 + Task 2.3; src/features/files/archive-action-state.ts;
 *  src/features/files/actions.ts (archiveFileAction — the consumer, now routing through this
 *  classifier so the live UI path IS the tested path — the coverage-inversion discipline);
 *  tests/unit/features/files/upload-action-state.test.ts (the pure-classifier template it mirrors)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHIVE_ACTION_INITIAL,
  ARCHIVE_ERROR_MESSAGES,
  classifyArchiveError,
  type ArchiveErrorState,
} from "@/features/files/archive-action-state";

const ALL_STATES: readonly ArchiveErrorState[] = [
  "LOCKED",
  "PERMISSION",
  "NETWORK_OR_SERVER",
];

test("[8.5-UNIT-02a][P1] classifyArchiveError maps FILE_LINK_LOCKED → LOCKED", () => {
  assert.equal(classifyArchiveError("FILE_LINK_LOCKED"), "LOCKED");
});

test("[8.5-UNIT-02b][P1/R-809] classifyArchiveError collapses BOTH access denials to the generic PERMISSION", () => {
  // A foreign id (TENANT_ACCESS_DENIED) and a file-specific denial (FILE_ACCESS_DENIED) must read
  // identically — the classifier can NEVER split "forbidden" from "not found" (no existence leak).
  assert.equal(classifyArchiveError("TENANT_ACCESS_DENIED"), "PERMISSION");
  assert.equal(classifyArchiveError("FILE_ACCESS_DENIED"), "PERMISSION");
});

test("[8.5-UNIT-02c][P1/R-809] an auth/membership denial is ALSO a generic PERMISSION (no leak)", () => {
  assert.equal(classifyArchiveError("UNAUTHENTICATED"), "PERMISSION");
  assert.equal(classifyArchiveError("TENANT_MEMBERSHIP_REQUIRED"), "PERMISSION");
});

test("[8.5-UNIT-02d][P1] SERVER_ERROR → NETWORK_OR_SERVER (transient, retryable)", () => {
  assert.equal(classifyArchiveError("SERVER_ERROR"), "NETWORK_OR_SERVER");
});

test("[8.5-UNIT-02e][P1] an UNKNOWN/unmapped code degrades to the GENERIC retryable state — never LOCKED/PERMISSION, never a throw", () => {
  // Defense-in-depth: an unmapped code must NOT over-disclose (no PERMISSION/LOCKED) and must NOT throw.
  for (const code of ["VALIDATION_FAILED", "COMMAND_CONFLICT", "SOME_FUTURE_CODE", ""]) {
    assert.equal(
      classifyArchiveError(code),
      "NETWORK_OR_SERVER",
      `unmapped code '${code}' must degrade to the generic retryable state`,
    );
  }
});

test("[8.5-UNIT-02f][P1/AC5] every error state has a non-empty user-safe message", () => {
  for (const state of ALL_STATES) {
    const message = ARCHIVE_ERROR_MESSAGES[state];
    assert.equal(typeof message, "string");
    assert.ok(message.trim().length > 0, `${state} must have a non-empty message`);
  }
});

test("[8.5-UNIT-02g][P1/AC5] the three messages are DISTINCT (no two states read identically)", () => {
  const messages = ALL_STATES.map((s) => ARCHIVE_ERROR_MESSAGES[s]);
  assert.equal(new Set(messages).size, 3, "each of the three states needs its own message");
});

test("[8.5-UNIT-02h][P1/R-809] the PERMISSION message discloses no existence / tenant / user detail", () => {
  const message = ARCHIVE_ERROR_MESSAGES.PERMISSION.toLowerCase();
  // A generic authorization message — never "finns inte" / "hittades inte" (would split not-found
  // from forbidden and leak existence).
  assert.ok(!message.includes("finns inte"));
  assert.ok(!message.includes("hittades inte"));
});

test("[8.5-UNIT-02i][P1] ARCHIVE_ACTION_INITIAL is a pristine, error-free starting shape", () => {
  assert.equal(ARCHIVE_ACTION_INITIAL.status, "idle");
  assert.equal(ARCHIVE_ACTION_INITIAL.errorState, null);
  assert.equal(ARCHIVE_ACTION_INITIAL.formError, null);
});

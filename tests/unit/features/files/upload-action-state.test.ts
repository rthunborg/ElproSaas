/**
 * Story 8.2 — coverage-expansion UNIT pins for the PURE upload-action-state contract
 * (`src/features/files/upload-action-state.ts`, Task 4.2) — 8.2-UNIT-05 (P1, AC3).
 *
 * The `useActionState` shape maps the `uploadFile` command's typed Result to the FOUR
 * DISTINCT user-safe error states. This file pins the parts that are pure decisions:
 *   - `UPLOAD_ERROR_MESSAGES`: one non-empty, user-safe Swedish message per state, and no two
 *     states share a message (the AC3 "four DISTINCT error states" contract at the copy layer —
 *     a blocked-type must not read identically to a permission failure);
 *   - `isRetryableUploadError`: ONLY `NETWORK_OR_SERVER` is retryable — a `PERMISSION` /
 *     `BLOCKED_TYPE` / `TOO_LARGE` failure is permanent (mirrors the signed-access
 *     transient-vs-permanent discipline), and an idle/success state is not "retryable";
 *   - `UPLOAD_ACTION_INITIAL`: the pristine, error-free starting shape.
 *
 * No existence/tenant/user signal is carried by any message (R-809): PERMISSION reads
 * identically whether a foreign file exists or nothing exists.
 *
 * Runs under `node --test` (pure, no DB, no PII).
 *
 * [Source: story 8.2 Task 4.2 / Task 7.1; src/features/files/upload-action-state.ts;
 *  src/server/storage/upload-error-classifier.ts (the UploadErrorState union); epics.md 8.2 AC3]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  UPLOAD_ACTION_INITIAL,
  UPLOAD_ERROR_MESSAGES,
  isRetryableUploadError,
  type UploadActionState,
} from "@/features/files/upload-action-state";
import type { UploadErrorState } from "@/server/storage/upload-error-classifier";

const ALL_STATES: readonly UploadErrorState[] = [
  "BLOCKED_TYPE",
  "TOO_LARGE",
  "NETWORK_OR_SERVER",
  "PERMISSION",
];

test("[8.2-UNIT-05a][P1/AC3] every error state has a non-empty user-safe message", () => {
  for (const state of ALL_STATES) {
    const message = UPLOAD_ERROR_MESSAGES[state];
    assert.equal(typeof message, "string");
    assert.ok(message.trim().length > 0, `${state} must have a non-empty message`);
  }
});

test("[8.2-UNIT-05b][P1/AC3] the four messages are DISTINCT (no two states read identically)", () => {
  const messages = ALL_STATES.map((s) => UPLOAD_ERROR_MESSAGES[s]);
  assert.equal(new Set(messages).size, 4, "each of the four states needs its own message");
});

test("[8.2-UNIT-05c][P1/R-809] the PERMISSION message discloses no existence / tenant / user detail", () => {
  const message = UPLOAD_ERROR_MESSAGES.PERMISSION.toLowerCase();
  // A generic authorization message — never "finns inte" / "hittades inte" (would split
  // not-found from forbidden and leak existence).
  assert.ok(!message.includes("finns inte"));
  assert.ok(!message.includes("hittades inte"));
});

test("[8.2-UNIT-05d][P1] isRetryableUploadError is true ONLY for a NETWORK_OR_SERVER error", () => {
  const retryable: UploadActionState = {
    status: "error",
    errorState: "NETWORK_OR_SERVER",
    formError: UPLOAD_ERROR_MESSAGES.NETWORK_OR_SERVER,
    fileId: null,
  };
  assert.equal(isRetryableUploadError(retryable), true);

  for (const state of ["PERMISSION", "BLOCKED_TYPE", "TOO_LARGE"] as const) {
    const permanent: UploadActionState = {
      status: "error",
      errorState: state,
      formError: UPLOAD_ERROR_MESSAGES[state],
      fileId: null,
    };
    assert.equal(
      isRetryableUploadError(permanent),
      false,
      `${state} is a permanent failure, never retryable`,
    );
  }
});

test("[8.2-UNIT-05e][P1] a non-error (idle / success) state is not retryable", () => {
  assert.equal(isRetryableUploadError(UPLOAD_ACTION_INITIAL), false);
  const success: UploadActionState = {
    status: "success",
    errorState: null,
    formError: null,
    fileId: "22222222-2222-2222-2222-222222222222",
  };
  assert.equal(isRetryableUploadError(success), false);
});

test("[8.2-UNIT-05f][P1] UPLOAD_ACTION_INITIAL is a pristine, error-free starting shape", () => {
  assert.equal(UPLOAD_ACTION_INITIAL.status, "idle");
  assert.equal(UPLOAD_ACTION_INITIAL.errorState, null);
  assert.equal(UPLOAD_ACTION_INITIAL.formError, null);
  assert.equal(UPLOAD_ACTION_INITIAL.fileId, null);
});

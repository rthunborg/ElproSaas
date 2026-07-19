/**
 * Story 10.3 — coverage expansion (bmad-testarch-automate): the PURE follow-up server-action state
 * contract (Task 5.4; AC1/AC3). `src/features/quotes/follow-up-action-state.ts` is the client-island
 * `useActionState` shape the plan / complete / annotate affordances share — extracted to a unit so the
 * fast gate protects it (the epic-9/10 "extract client-island logic to a pure unit" lesson). It shipped
 * WITHOUT a dedicated unit; this suite pins:
 *   - `FOLLOW_UP_ACTION_INITIAL` — the pristine idle state (no leaked error/target).
 *   - `isRetryableFollowUpError(state)` — true ONLY for a status:"error" + code:"SERVER_ERROR"
 *     (the transient/retryable failure), false for every other stable CommandErrorCode and for the
 *     idle/success states. The retry affordance keys off exactly this, so a code drifting into or out
 *     of "retryable" is a behaviour change this test would catch.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock. Two-runner discipline
 * (epic-10 retro): client-island logic lands as UNIT, never Playwright.
 *
 * [Source: story 10.3 Task 5.4 + Dev Notes "Reuse — the action-state / subroute-revalidation shape";
 *  src/features/quotes/follow-up-action-state.ts; src/server/commands/command-errors.ts]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FOLLOW_UP_ACTION_INITIAL,
  isRetryableFollowUpError,
  type FollowUpActionState,
} from "@/features/quotes/follow-up-action-state";
import type { CommandErrorCode } from "@/server/commands/command-errors";

test("10.3-UNIT (action-state): the initial state is pristine idle (no code/error/target leaked)", () => {
  assert.equal(FOLLOW_UP_ACTION_INITIAL.status, "idle");
  assert.equal(FOLLOW_UP_ACTION_INITIAL.code, null);
  assert.equal(FOLLOW_UP_ACTION_INITIAL.formError, null);
  assert.equal(FOLLOW_UP_ACTION_INITIAL.targetId, null);
  // The initial state is never classified retryable (nothing failed yet).
  assert.equal(isRetryableFollowUpError(FOLLOW_UP_ACTION_INITIAL), false);
});

test("10.3-UNIT (action-state): a transient SERVER_ERROR is the ONLY retryable failure", () => {
  const serverError: FollowUpActionState = {
    status: "error",
    code: "SERVER_ERROR",
    formError: "Ett tillfälligt fel inträffade.",
    targetId: null,
  };
  assert.equal(isRetryableFollowUpError(serverError), true);
});

test("10.3-UNIT (action-state): no NON-transient stable error code is retryable", () => {
  // Every stable code that is NOT the transient infra fault must NOT surface the retry affordance —
  // a VALIDATION_FAILED (e.g. the one-open / already-completed reject) is a deterministic user error,
  // an access/auth denial is terminal, and the lock-family codes are business-final.
  const nonRetryableCodes: CommandErrorCode[] = [
    "UNAUTHENTICATED",
    "TENANT_MEMBERSHIP_REQUIRED",
    "VALIDATION_FAILED",
    "TENANT_ACCESS_DENIED",
    "FILE_ACCESS_DENIED",
    "COMMAND_CONFLICT",
    "ACCEPTANCE_ALREADY_RECORDED",
    "QUOTE_VERSION_NOT_DRAFT",
    "QUOTE_VERSION_LOCKED",
    "ACCEPTED_RECORD_LOCKED",
    "FILE_LINK_LOCKED",
  ];
  for (const code of nonRetryableCodes) {
    const state: FollowUpActionState = {
      status: "error",
      code,
      formError: "…",
      targetId: null,
    };
    assert.equal(
      isRetryableFollowUpError(state),
      false,
      `code ${code} must NOT be retryable`,
    );
  }
});

test("10.3-UNIT (action-state): a SUCCESS state is never retryable (even if a stale code is present)", () => {
  const success: FollowUpActionState = {
    status: "success",
    code: null,
    formError: null,
    targetId: "11111111-1111-1111-1111-111111111111",
  };
  assert.equal(isRetryableFollowUpError(success), false);
  // Defensive: the guard keys off status too — a success carrying a stray SERVER_ERROR code is still
  // not retryable (the retry affordance must never appear on a completed action).
  const successWithStrayCode: FollowUpActionState = {
    ...success,
    code: "SERVER_ERROR",
  };
  assert.equal(isRetryableFollowUpError(successWithStrayCode), false);
});

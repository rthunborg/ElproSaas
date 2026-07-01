/**
 * Story 3.2 — unit tests for the PURE CRM action-state contract
 * (`src/features/crm/action-state.ts`).
 *
 * `action-state.ts` is the typed `useActionState` state every CRM form carries and the
 * `Result`-code → "is this retryable?" predicate the UI keys on. It is I/O-free, so its
 * contract is pinned here without a browser or a server round-trip:
 *   - the pristine initial state is fully blank (idle, no code/error/values/targetId);
 *   - `isRetryableError` is true ONLY for a transient `SERVER_ERROR` (the AC4 rule:
 *     a DB hiccup is a retry, NEVER a permanent access denial), and false for a denial,
 *     a validation failure, an auth failure, success, or the idle state.
 *
 * Pure logic, no I/O — runs under the dependency-free `node --test` runner.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CRM_ACTION_INITIAL,
  isRetryableError,
  type CrmActionState,
} from "@/features/crm/action-state";

test("CRM_ACTION_INITIAL is a fully pristine, blank state", () => {
  assert.deepEqual(CRM_ACTION_INITIAL, {
    status: "idle",
    code: null,
    formError: null,
    fieldErrors: {},
    values: {},
    targetId: null,
  });
});

function state(partial: Partial<CrmActionState>): CrmActionState {
  return { ...CRM_ACTION_INITIAL, ...partial };
}

test("isRetryableError: true ONLY for an error-status SERVER_ERROR (transient ≠ denial)", () => {
  assert.equal(
    isRetryableError(state({ status: "error", code: "SERVER_ERROR" })),
    true,
  );
});

test("isRetryableError: false for a denial / validation / auth failure (NOT retryable)", () => {
  for (const code of [
    "TENANT_ACCESS_DENIED",
    "VALIDATION_FAILED",
    "UNAUTHENTICATED",
    "TENANT_MEMBERSHIP_REQUIRED",
    "COMMAND_CONFLICT",
  ] as const) {
    assert.equal(
      isRetryableError(state({ status: "error", code })),
      false,
      `code ${code} must not be retryable`,
    );
  }
});

test("isRetryableError: false for the idle state and for success (no error to retry)", () => {
  assert.equal(isRetryableError(CRM_ACTION_INITIAL), false);
  assert.equal(
    isRetryableError(state({ status: "success", code: null, targetId: "x" })),
    false,
  );
});

test("isRetryableError: a SERVER_ERROR code with a NON-error status is not retryable (status guards it)", () => {
  // Defensive: the predicate must require status==='error', not just the code, so a
  // stale code on a non-error state never spuriously offers a retry.
  assert.equal(
    isRetryableError(state({ status: "idle", code: "SERVER_ERROR" })),
    false,
  );
  assert.equal(
    isRetryableError(state({ status: "success", code: "SERVER_ERROR" })),
    false,
  );
});

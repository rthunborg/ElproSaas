/**
 * Story 5.2 — UNIT tests for the calc-editor action-state contract
 * (`src/features/calculations/action-state.ts`). Pins the initial pristine state + the
 * retryable-error discriminator (a transient SERVER_ERROR is retryable; a denial is not).
 * Runs under `node --test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CALC_ACTION_INITIAL,
  isRetryableCalcError,
  type CalcActionState,
} from "@/features/calculations/action-state";

test("the initial state is pristine (idle, no errors, no values)", () => {
  assert.equal(CALC_ACTION_INITIAL.status, "idle");
  assert.equal(CALC_ACTION_INITIAL.form, null);
  assert.equal(CALC_ACTION_INITIAL.code, null);
  assert.equal(CALC_ACTION_INITIAL.formError, null);
  assert.deepEqual(CALC_ACTION_INITIAL.fieldErrors, {});
  assert.deepEqual(CALC_ACTION_INITIAL.values, {});
  assert.equal(CALC_ACTION_INITIAL.targetId, null);
});

test("a transient SERVER_ERROR is RETRYABLE", () => {
  const state: CalcActionState = {
    ...CALC_ACTION_INITIAL,
    status: "error",
    form: "row",
    code: "SERVER_ERROR",
    formError: "fel",
  };
  assert.equal(isRetryableCalcError(state), true);
});

test("a TENANT_ACCESS_DENIED / VALIDATION_FAILED is NOT retryable", () => {
  const denied: CalcActionState = {
    ...CALC_ACTION_INITIAL,
    status: "error",
    form: "row",
    code: "TENANT_ACCESS_DENIED",
    formError: "nekad",
  };
  const invalid: CalcActionState = {
    ...CALC_ACTION_INITIAL,
    status: "error",
    form: "row",
    code: "VALIDATION_FAILED",
    formError: "ogiltig",
  };
  assert.equal(isRetryableCalcError(denied), false);
  assert.equal(isRetryableCalcError(invalid), false);
});

test("an idle state is not retryable", () => {
  assert.equal(isRetryableCalcError(CALC_ACTION_INITIAL), false);
});

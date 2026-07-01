/**
 * Story 3.4 — unit tests for the pricing form-action state contract
 * (`src/features/pricing/action-state.ts`). Pin the LOAD-BEARING retryable-vs-denial
 * mapping (AC5: a transient `SERVER_ERROR` is a RETRYABLE failure, NEVER a permanent
 * access denial) and the pristine initial state, as a fast pure unit — the exact
 * predicate the pricing editors consume, so a regression in retry rendering fails HERE
 * without a browser. Runs under `node --test` (pure, no I/O).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isRetryablePricingError,
  PRICING_ACTION_INITIAL,
  type PricingActionState,
} from "@/features/pricing/action-state";

// ── PRICING_ACTION_INITIAL: the pristine state ──────────────────────────────────

test("initial: the pristine state is idle with no error/field signals", () => {
  assert.equal(PRICING_ACTION_INITIAL.status, "idle");
  assert.equal(PRICING_ACTION_INITIAL.form, null);
  assert.equal(PRICING_ACTION_INITIAL.code, null);
  assert.equal(PRICING_ACTION_INITIAL.formError, null);
  assert.equal(PRICING_ACTION_INITIAL.targetId, null);
  assert.deepEqual(PRICING_ACTION_INITIAL.fieldErrors, {});
  assert.deepEqual(PRICING_ACTION_INITIAL.values, {});
});

// ── isRetryablePricingError: retryable (transient) vs denial (permanent) ──────────

test("retryable: only a SERVER_ERROR is retryable; VALIDATION / ACCESS denials are not", () => {
  const serverError: PricingActionState = {
    ...PRICING_ACTION_INITIAL,
    status: "error",
    code: "SERVER_ERROR",
  };
  assert.equal(isRetryablePricingError(serverError), true);

  const validation: PricingActionState = {
    ...PRICING_ACTION_INITIAL,
    status: "error",
    code: "VALIDATION_FAILED",
  };
  assert.equal(isRetryablePricingError(validation), false);

  const denied: PricingActionState = {
    ...PRICING_ACTION_INITIAL,
    status: "error",
    code: "TENANT_ACCESS_DENIED",
  };
  assert.equal(isRetryablePricingError(denied), false);
});

test("retryable: every non-SERVER_ERROR command code on an error state is a (non-retryable) denial", () => {
  for (const code of [
    "UNAUTHENTICATED",
    "TENANT_MEMBERSHIP_REQUIRED",
    "VALIDATION_FAILED",
    "TENANT_ACCESS_DENIED",
  ] as const) {
    const state: PricingActionState = { ...PRICING_ACTION_INITIAL, status: "error", code };
    assert.equal(isRetryablePricingError(state), false, `${code} must not be retryable`);
  }
});

test("retryable: a SERVER_ERROR code on a NON-error status is NOT treated as retryable (status guards the code)", () => {
  // Defensive: the predicate must require status === 'error', not just the code — a stale
  // SERVER_ERROR code on an idle/success state must never light up the retry affordance.
  const idle: PricingActionState = {
    ...PRICING_ACTION_INITIAL,
    status: "idle",
    code: "SERVER_ERROR",
  };
  assert.equal(isRetryablePricingError(idle), false);

  const success: PricingActionState = {
    ...PRICING_ACTION_INITIAL,
    status: "success",
    code: "SERVER_ERROR",
  };
  assert.equal(isRetryablePricingError(success), false);
});

test("retryable: the pristine initial state is not retryable", () => {
  assert.equal(isRetryablePricingError(PRICING_ACTION_INITIAL), false);
});

/**
 * Story 3.3 — unit tests for the quote-terms SIGN-OFF state machine
 * (`resolveTermsApproved` in `src/features/settings/action-state.ts`) and the
 * retryable-error predicate. This pins the LOAD-BEARING approve-vs-save precedence
 * (the HARD STOP-CONDITION, AC2) as a fast pure unit — the exact logic the
 * QuoteTermsEditor consumes, so a regression in the component's approval rendering
 * fails HERE without a browser.
 *
 * The fixed regression these tests guard (do not let it drift): a prior in-session
 * text-save success must NEVER suppress the APPROVED view after a deliberate approve.
 *
 * Runs under `node --test` (pure, no I/O).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveTermsApproved,
  isRetryableSettingsError,
  SETTINGS_ACTION_INITIAL,
  type SettingsActionState,
} from "@/features/settings/action-state";

const APPROVED_AT = "2026-06-30T12:00:00.000Z";

// ── resolveTermsApproved: the approve-vs-save precedence ────────────────────────

test("signoff: a not-approved server state with no in-session action → NOT approved (warning)", () => {
  assert.equal(
    resolveTermsApproved({
      serverApprovedAt: null,
      justSavedText: false,
      justApproved: false,
    }),
    false,
  );
});

test("signoff: a server-approved row with no in-session action → APPROVED", () => {
  assert.equal(
    resolveTermsApproved({
      serverApprovedAt: APPROVED_AT,
      justSavedText: false,
      justApproved: false,
    }),
    true,
  );
});

test("signoff: a bare text-save this session NEVER yields approved (save resets approval)", () => {
  // No prior server approval — a save alone must stay not-approved.
  assert.equal(
    resolveTermsApproved({
      serverApprovedAt: null,
      justSavedText: true,
      justApproved: false,
    }),
    false,
  );
});

test("signoff: editing (text-save) a previously server-approved row SUPPRESSES the stale approved state", () => {
  // The command resets approved_at on every text save, so the editor must show the
  // not-approved warning even though the page LOADED with a server-approved row.
  assert.equal(
    resolveTermsApproved({
      serverApprovedAt: APPROVED_AT,
      justSavedText: true,
      justApproved: false,
    }),
    false,
  );
});

test("signoff: a deliberate approve this session → APPROVED (from a not-approved load)", () => {
  assert.equal(
    resolveTermsApproved({
      serverApprovedAt: null,
      justSavedText: false,
      justApproved: true,
    }),
    true,
  );
});

test("REGRESSION: a prior text-save success must NOT suppress the approved view after a deliberate approve", () => {
  // The exact fixed bug: server-approved → edit (text save) → approve. The lingering
  // justSavedText=true must NOT win over the fresh justApproved=true. Approve ALWAYS
  // takes precedence — it is the only path to approved.
  assert.equal(
    resolveTermsApproved({
      serverApprovedAt: APPROVED_AT,
      justSavedText: true,
      justApproved: true,
    }),
    true,
    "a deliberate approve must win over a lingering in-session text-save",
  );
  // And the same precedence holds from a fresh (not-server-approved) load: save-then-approve.
  assert.equal(
    resolveTermsApproved({
      serverApprovedAt: null,
      justSavedText: true,
      justApproved: true,
    }),
    true,
    "save-then-approve from a fresh load must render approved",
  );
});

test("signoff: approve precedence holds for EVERY combination of the other two signals", () => {
  // justApproved=true ALWAYS resolves approved, regardless of the other two signals —
  // exhaustive truth table for the precedence rule (4 combinations).
  for (const serverApprovedAt of [null, APPROVED_AT]) {
    for (const justSavedText of [false, true]) {
      assert.equal(
        resolveTermsApproved({ serverApprovedAt, justSavedText, justApproved: true }),
        true,
        `approve must win (server=${serverApprovedAt}, saved=${justSavedText})`,
      );
    }
  }
});

test("signoff: with no approve, a text-save always beats a server-approved fallback", () => {
  // justApproved=false → justSavedText is the next deciding signal; when it is true the
  // result is not-approved regardless of the server state (the reset semantics).
  assert.equal(
    resolveTermsApproved({
      serverApprovedAt: APPROVED_AT,
      justSavedText: true,
      justApproved: false,
    }),
    false,
  );
  assert.equal(
    resolveTermsApproved({
      serverApprovedAt: null,
      justSavedText: true,
      justApproved: false,
    }),
    false,
  );
});

// ── isRetryableSettingsError ────────────────────────────────────────────────────

test("retryable: only a SERVER_ERROR is retryable; VALIDATION/ACCESS denials are not", () => {
  const serverError: SettingsActionState = {
    ...SETTINGS_ACTION_INITIAL,
    status: "error",
    code: "SERVER_ERROR",
  };
  assert.equal(isRetryableSettingsError(serverError), true);

  const validation: SettingsActionState = {
    ...SETTINGS_ACTION_INITIAL,
    status: "error",
    code: "VALIDATION_FAILED",
  };
  assert.equal(isRetryableSettingsError(validation), false);

  const denied: SettingsActionState = {
    ...SETTINGS_ACTION_INITIAL,
    status: "error",
    code: "TENANT_ACCESS_DENIED",
  };
  assert.equal(isRetryableSettingsError(denied), false);
});

test("retryable: a SERVER_ERROR code on a non-error status is NOT treated as retryable", () => {
  // Defensive: the predicate must require status === 'error', not just the code.
  const state: SettingsActionState = {
    ...SETTINGS_ACTION_INITIAL,
    status: "idle",
    code: "SERVER_ERROR",
  };
  assert.equal(isRetryableSettingsError(state), false);
});

test("retryable: the pristine initial state is not retryable", () => {
  assert.equal(isRetryableSettingsError(SETTINGS_ACTION_INITIAL), false);
});

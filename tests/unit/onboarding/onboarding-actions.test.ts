import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ONBOARDING_ACTION_INPUT_ERROR,
  ONBOARDING_ACTION_PERSISTENCE_ERROR,
  parseOnboardingDismissal,
} from "@/features/onboarding/action-state";

test("12.3-UNIT-007 onboarding dismissal accepts only the two server-action values", () => {
  assert.equal(parseOnboardingDismissal("true"), true);
  assert.equal(parseOnboardingDismissal("false"), false);
  assert.equal(parseOnboardingDismissal("yes"), null);
  assert.equal(parseOnboardingDismissal(null), null);
});

test("12.3-UNIT-008 onboarding action errors keep input rejection distinct from retryable persistence feedback", () => {
  assert.deepEqual(ONBOARDING_ACTION_INPUT_ERROR, {
    status: "error",
    message: "Åtgärden kunde inte genomföras.",
  });
  assert.deepEqual(ONBOARDING_ACTION_PERSISTENCE_ERROR, {
    status: "error",
    message: "Åtgärden kunde inte sparas. Försök igen.",
  });
});

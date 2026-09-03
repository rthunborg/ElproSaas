import assert from "node:assert/strict";
import test from "node:test";

import {
  followUpIdForLossAttempt,
  shouldCarryFollowUpId,
} from "@/features/quotes/lost-follow-up-retry";

test("10.5 action retry omits a follow-up already completed before a failed loss transition", () => {
  const id = "7c67e62b-9f6b-43b5-a85c-ec57d4e39622";
  assert.equal(followUpIdForLossAttempt(id, false), id);
  assert.equal(followUpIdForLossAttempt(id, true), null);
  assert.equal(shouldCarryFollowUpId(id, false), true);
  assert.equal(shouldCarryFollowUpId(id, true), false);
});

test("10.5 action retry never treats blank or non-string form values as an auto-complete request", () => {
  assert.equal(followUpIdForLossAttempt("", false), null);
  assert.equal(followUpIdForLossAttempt(null, false), null);
  assert.equal(shouldCarryFollowUpId(undefined, false), false);
});

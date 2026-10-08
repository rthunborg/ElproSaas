import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isResourceE2eSaveFailureEnabled,
  shouldInjectResourceE2eSaveFailure,
} from "../../../../src/server/resources/e2e-save-failure";

test("[14.1][P0] resource E2E failure seam requires the private runtime opt-in", () => {
  assert.equal(isResourceE2eSaveFailureEnabled(undefined), false);
  assert.equal(shouldInjectResourceE2eSaveFailure({ requested: "true", attempt: null }), false);
  assert.equal(shouldInjectResourceE2eSaveFailure({ runtimeFlag: "false", requested: "true", attempt: null }), false);
  assert.equal(shouldInjectResourceE2eSaveFailure({ runtimeFlag: "true", requested: "true", attempt: null }), true);
  assert.equal(shouldInjectResourceE2eSaveFailure({ runtimeFlag: "true", requested: "true", attempt: "retry" }), false);
});

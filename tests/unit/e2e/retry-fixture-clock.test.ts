import assert from "node:assert/strict";
import { test } from "node:test";
import { RETRY_FIXTURE_DUE_DATE } from "../../e2e/retry-fixture-clock";

test("[P1] retry fixture due date is a stable valid calendar date", () => {
  assert.equal(RETRY_FIXTURE_DUE_DATE, "2099-01-31");
  const dueAtUtc = new Date(`${RETRY_FIXTURE_DUE_DATE}T00:00:00.000Z`);
  assert.equal(dueAtUtc.getUTCFullYear(), 2099);
  assert.equal(dueAtUtc.getUTCMonth(), 0);
  assert.equal(dueAtUtc.getUTCDate(), 31);
});

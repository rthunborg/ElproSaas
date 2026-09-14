import assert from "node:assert/strict";
import { test } from "node:test";
import { assertDurationWithinBudget } from "../../support/ci-duration-budget";

test("CI duration budget accepts the exact ceiling", () => {
  assert.doesNotThrow(() => assertDurationWithinBudget({ label: "browser tests", elapsedMs: 300_000, maxMs: 300_000 }));
});

test("CI duration budget fails a late browser test attempt", () => {
  assert.throws(
    () => assertDurationWithinBudget({ label: "browser tests", elapsedMs: 300_001, maxMs: 300_000 }),
    /exceeding the 300s CI execution budget/,
  );
});

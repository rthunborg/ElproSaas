import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_CALCULATION_ROWS,
  canAddCalculationRow,
  exceedsCalculationRowLimit,
} from "@/features/calculations/limits";

test("the editor allows rows below 500 and refuses a 501st row", () => {
  assert.equal(MAX_CALCULATION_ROWS, 500);
  assert.equal(canAddCalculationRow(499), true);
  assert.equal(canAddCalculationRow(500), false);
  assert.equal(exceedsCalculationRowLimit(500), false);
  assert.equal(exceedsCalculationRowLimit(501), true);
});

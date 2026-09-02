import assert from "node:assert/strict";
import { test } from "node:test";

import {
  REVERSE_CHARGE_DEDUCTION_CONFLICT_MESSAGE,
  hasReverseChargeDeductionConflict,
} from "@/features/calculations/tax-settings-ui";

test("reverse charge blocks every deduction posture with specific Swedish feedback", () => {
  assert.equal(
    hasReverseChargeDeductionConflict("REVERSE_CHARGE_CONSTRUCTION", "ROT"),
    true,
  );
  assert.equal(
    hasReverseChargeDeductionConflict("REVERSE_CHARGE_CONSTRUCTION", "GREEN"),
    true,
  );
  assert.equal(
    hasReverseChargeDeductionConflict(
      "REVERSE_CHARGE_CONSTRUCTION",
      "ROT_AND_GREEN",
    ),
    true,
  );
  assert.match(REVERSE_CHARGE_DEDUCTION_CONFLICT_MESSAGE, /ROT eller grön teknik/);
});

test("standard VAT deductions and reverse charge without deduction remain valid", () => {
  assert.equal(
    hasReverseChargeDeductionConflict("STANDARD_VAT_25", "ROT_AND_GREEN"),
    false,
  );
  assert.equal(
    hasReverseChargeDeductionConflict("REVERSE_CHARGE_CONSTRUCTION", "NONE"),
    false,
  );
});

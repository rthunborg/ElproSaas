import assert from "node:assert/strict";
import { test } from "node:test";

import { isEffectiveRowVatPairCoherent } from "@/features/calculations/row-vat-transition";

test("one-sided VAT updates are checked against the persisted other half", () => {
  assert.equal(
    isEffectiveRowVatPairCoherent(
      { vatType: "REVERSE_CHARGE_CONSTRUCTION" },
      { vatType: "STANDARD_VAT_25", vatRateBp: 2500 },
    ),
    true,
  );
  assert.equal(
    isEffectiveRowVatPairCoherent(
      { vatRateBp: 0 },
      { vatType: "STANDARD_VAT_25", vatRateBp: 2500 },
    ),
    false,
  );
  assert.equal(
    isEffectiveRowVatPairCoherent(
      { vatType: "ZERO_RATED" },
      { vatType: "STANDARD_VAT_25", vatRateBp: 2500 },
    ),
    false,
  );
});

test("malformed legacy persisted halves fail closed", () => {
  assert.equal(
    isEffectiveRowVatPairCoherent(
      { vatRateBp: 2500 },
      { vatType: null, vatRateBp: null },
    ),
    false,
  );
});

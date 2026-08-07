import assert from "node:assert/strict";
import { test } from "node:test";

import { invoiceInclusionForOptionSelectionTransition } from "@/features/calculations/row-option-transition";

const persisted = {
  isOptional: true,
  isSelected: false,
  includedInInvoiceTotal: false,
} as const;

test("an actual optional selection transition synchronizes economic inclusion", () => {
  assert.equal(
    invoiceInclusionForOptionSelectionTransition({ isSelected: true }, persisted),
    true,
  );
  assert.equal(
    invoiceInclusionForOptionSelectionTransition(
      { isSelected: false },
      { ...persisted, isSelected: true, includedInInvoiceTotal: true },
    ),
    false,
  );
});

test("unchanged selection, unrelated edits, and inclusion-only edits remain independent", () => {
  assert.equal(
    invoiceInclusionForOptionSelectionTransition({ isSelected: false }, persisted),
    undefined,
  );
  assert.equal(invoiceInclusionForOptionSelectionTransition({}, persisted), undefined);
  assert.equal(
    invoiceInclusionForOptionSelectionTransition(
      { includedInInvoiceTotal: true },
      persisted,
    ),
    undefined,
  );
});

test("selection never drives inclusion for an effective mandatory row", () => {
  assert.equal(
    invoiceInclusionForOptionSelectionTransition(
      { isOptional: false, isSelected: true },
      persisted,
    ),
    undefined,
  );
});

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  invoiceInclusionForNewRow,
  invoiceInclusionForOptionSelectionTransition,
} from "@/features/calculations/row-option-transition";

const persisted = {
  isOptional: true,
  isSelected: false,
  includedInInvoiceTotal: false,
} as const;

test("new optional rows derive inclusion from selection only when inclusion is omitted", () => {
  assert.equal(
    invoiceInclusionForNewRow({ isOptional: true, isSelected: false }),
    false,
  );
  assert.equal(
    invoiceInclusionForNewRow({ isOptional: true, isSelected: true }),
    true,
  );
  assert.equal(
    invoiceInclusionForNewRow({
      isOptional: true,
      isSelected: false,
      includedInInvoiceTotal: true,
    }),
    true,
  );
  assert.equal(invoiceInclusionForNewRow({ isOptional: false }), true);
});

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

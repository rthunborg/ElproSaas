/**
 * Story 6.2 — 6.2-UNIT-01 (P0, AC1/AC2): the customer-visible quote view-model EXCLUDES
 * internal notes + cost/margin by construction (leakage-by-construction guard, R-607). Drive
 * the builder with a fixture that carries internal fields AT THE SOURCE, and assert they are
 * ABSENT in the output. Pure, in-memory, NO DB, NO PII. Runs under `node --test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerVisibleLines,
  toCustomerVisibleLine,
  CUSTOMER_VISIBLE_LINE_KEYS,
  FORBIDDEN_INTERNAL_LINE_KEYS,
  type QuoteLineSource,
} from "@/features/quotes/view-model";

/** A source line that ALSO carries internal fields (cost/margin/markup/internal_note). */
const hostileSource: QuoteLineSource = {
  rowType: "labor",
  sortOrder: 0,
  label: "Elarbete",
  description: "Installation",
  quoteNote: "Ingår i priset",
  quantity: 2,
  unit: "h",
  unitSellOre: 85000,
  lineNetOre: 170000,
  vatRateBp: 2500,
  isHidden: false,
  isOptional: false,
  isSelected: null,
  // Internal fields that MUST NOT leak into the customer-visible view-model:
  unitCostOre: 45000,
  marginBp: 4700,
  markupBp: 8888,
  internalNote: "Marginal pressad – förhandla",
  // Even snake_case / arbitrary extra keys must not survive the projection.
  unit_cost_ore: 45000,
  internal_note: "leak me",
};

test("6.2-UNIT-01: the customer-visible line carries NO internal keys", () => {
  const line = toCustomerVisibleLine(hostileSource);
  const keys = Object.keys(line);
  for (const forbidden of FORBIDDEN_INTERNAL_LINE_KEYS) {
    assert.equal(
      keys.includes(forbidden),
      false,
      `forbidden internal key "${forbidden}" leaked into the customer-visible line`,
    );
  }
});

test("6.2-UNIT-01: the customer-visible line's keys are EXACTLY the allow-list", () => {
  const line = toCustomerVisibleLine(hostileSource);
  const keys = Object.keys(line).sort();
  const allowed = [...CUSTOMER_VISIBLE_LINE_KEYS].sort();
  assert.deepEqual(keys, allowed);
});

test("6.2-UNIT-01: the customer-visible fields are copied VERBATIM (sell/net öre, not cost)", () => {
  const line = toCustomerVisibleLine(hostileSource);
  assert.equal(line.unitSellOre, 85000);
  assert.equal(line.lineNetOre, 170000);
  assert.equal(line.quoteNote, "Ingår i priset");
  // The internal cost is 45000; it must NOT surface as the sell/net.
  assert.notEqual(line.unitSellOre, 45000);
  assert.notEqual(line.lineNetOre, 45000);
});

test("6.2-UNIT-01: no forbidden value string is reachable via JSON of the output", () => {
  const line = toCustomerVisibleLine(hostileSource);
  const json = JSON.stringify(line);
  assert.equal(json.includes("Marginal pressad"), false);
  assert.equal(json.includes("leak me"), false);
});

test("6.2-UNIT-01: buildCustomerVisibleLines orders by sortOrder and stays leak-free", () => {
  const lines = buildCustomerVisibleLines([
    { ...hostileSource, sortOrder: 2, label: "B" },
    { ...hostileSource, sortOrder: 0, label: "A" },
    { ...hostileSource, sortOrder: 1, label: "C" },
  ]);
  assert.deepEqual(
    lines.map((l) => l.label),
    ["A", "C", "B"],
  );
  for (const line of lines) {
    for (const forbidden of FORBIDDEN_INTERNAL_LINE_KEYS) {
      assert.equal(Object.keys(line).includes(forbidden), false);
    }
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { stockholmBusinessDate } from "@/lib/datetime/business-date";

test("Story 10.6 quote-capture dates use the DST-aware Europe/Stockholm calendar day", () => {
  assert.equal(stockholmBusinessDate("2026-08-04T21:59:59.999Z"), "2026-08-04");
  assert.equal(stockholmBusinessDate("2026-08-04T22:00:00.000Z"), "2026-08-05");
  assert.equal(stockholmBusinessDate("2026-01-15T22:30:00.000Z"), "2026-01-15");
  assert.equal(stockholmBusinessDate("2026-01-15T23:30:00.000Z"), "2026-01-16");
});

test("Story 10.6 Stockholm business-date authority fails loud for an invalid instant", () => {
  assert.throws(() => stockholmBusinessDate("not-an-instant"), RangeError);
});

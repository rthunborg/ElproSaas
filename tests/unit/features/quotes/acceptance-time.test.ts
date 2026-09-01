import assert from "node:assert/strict";
import { test } from "node:test";

import { localAcceptanceTimeToIso } from "@/features/quotes/acceptance-time";

test("datetime-local acceptance input becomes an explicit ISO instant", () => {
  assert.equal(
    localAcceptanceTimeToIso("2026-08-05T14:30"),
    new Date(2026, 7, 5, 14, 30, 0, 0).toISOString(),
  );
});

test("invalid and normalized local timestamps are rejected before submission", () => {
  assert.equal(localAcceptanceTimeToIso(""), null);
  assert.equal(localAcceptanceTimeToIso("2026-02-30T12:00"), null);
  assert.equal(localAcceptanceTimeToIso("2026-08-05"), null);
});

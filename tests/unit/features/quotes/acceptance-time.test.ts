import assert from "node:assert/strict";
import { test } from "node:test";

import {
  localAcceptanceTimeCandidates,
  localAcceptanceTimeToIso,
  type TimezoneOffsetProvider,
} from "@/features/quotes/acceptance-time";

const STOCKHOLM_2026: TimezoneOffsetProvider = (instantMs) => {
  const springForward = Date.parse("2026-03-29T01:00:00.000Z");
  const fallBack = Date.parse("2026-10-25T01:00:00.000Z");
  return instantMs >= springForward && instantMs < fallBack ? -120 : -60;
};

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

test("Stockholm's spring-forward gap has no valid instant", () => {
  assert.deepEqual(
    localAcceptanceTimeCandidates("2026-03-29T02:30", STOCKHOLM_2026),
    [],
  );
  assert.equal(localAcceptanceTimeToIso("2026-03-29T02:30", STOCKHOLM_2026), null);
});

test("Stockholm's fall-back overlap exposes both instants and requires a choice", () => {
  assert.deepEqual(
    localAcceptanceTimeCandidates("2026-10-25T02:30", STOCKHOLM_2026),
    ["2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z"],
  );
  assert.equal(localAcceptanceTimeToIso("2026-10-25T02:30", STOCKHOLM_2026), null);
});

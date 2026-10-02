import assert from "node:assert/strict";
import { test } from "node:test";
import { buildScheduleReadShifts } from "../../../../src/features/resources/schedule-read";

test("[P0] assigns same-weekday breaks only to their containing split shift in deterministic order", () => {
  assert.deepEqual(buildScheduleReadShifts([
    { entry_kind: "weekly_break", weekday: 1, starts_at: "14:00:00", ends_at: "14:15:00" },
    { entry_kind: "weekly_shift", weekday: 1, starts_at: "13:00:00", ends_at: "16:00:00" },
    { entry_kind: "weekly_break", weekday: 1, starts_at: "08:00:00", ends_at: "08:15:00" },
    { entry_kind: "weekly_shift", weekday: 1, starts_at: "07:00:00", ends_at: "10:00:00" },
  ]), [
    { weekday: 1, start: "07:00:00", end: "10:00:00", breaks: [{ start: "08:00:00", end: "08:15:00" }] },
    { weekday: 1, start: "13:00:00", end: "16:00:00", breaks: [{ start: "14:00:00", end: "14:15:00" }] },
  ]);
});

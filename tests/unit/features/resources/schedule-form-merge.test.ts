import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeRenderedSchedule } from "../../../../src/features/resources/schedule-form-merge";

test("[P0] preserves non-rendered same-day shifts and breaks when editing the compact schedule form", () => {
  const merged = mergeRenderedSchedule(
    [{ weekday: 1, start: "08:00", end: "16:00", breaks: [{ start: "12:00", end: "12:30" }] }],
    [
      { weekday: 1, start: "07:00", end: "16:00", breaks: [{ start: "10:00", end: "10:15" }, { start: "13:00", end: "13:15" }] },
      { weekday: 1, start: "17:00", end: "20:00", breaks: [] },
    ],
  );

  assert.deepEqual(merged, [
    { weekday: 1, start: "08:00", end: "16:00", breaks: [{ start: "12:00", end: "12:30" }, { start: "13:00", end: "13:15" }] },
    { weekday: 1, start: "17:00", end: "20:00", breaks: [] },
  ]);
});

test("[P0] treats a fully blank rendered schedule as an explicit clear", () => {
  assert.deepEqual(mergeRenderedSchedule([], [{ weekday: 1, start: "07:00", end: "16:00", breaks: [] }]), []);
});

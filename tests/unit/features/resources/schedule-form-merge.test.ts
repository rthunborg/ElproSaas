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

test("[P0] retains hidden later shifts when the rendered first shift is cleared during a partial edit", () => {
  const merged = mergeRenderedSchedule(
    [{ weekday: 2, start: "07:00", end: "16:00", breaks: [] }],
    [
      { weekday: 1, start: "07:00:00", end: "10:00:00", breaks: [] },
      { weekday: 1, start: "13:00:00", end: "16:00:00", breaks: [{ start: "14:00:00", end: "14:15:00" }] },
      { weekday: 2, start: "07:00:00", end: "16:00:00", breaks: [] },
    ],
  );

  assert.deepEqual(merged, [
    { weekday: 1, start: "13:00:00", end: "16:00:00", breaks: [{ start: "14:00:00", end: "14:15:00" }] },
    { weekday: 2, start: "07:00:00", end: "16:00:00", breaks: [] },
  ]);
});

test("[P0] preserves unchanged PostgreSQL time precision instead of rewriting it to the compact form value", () => {
  const stored = [{ weekday: 1, start: "07:00:30.123456", end: "16:00:30.123456", breaks: [{ start: "12:00:30.123456", end: "12:30:30.123456" }] }];
  const merged = mergeRenderedSchedule([{ weekday: 1, start: "07:00", end: "16:00", breaks: [{ start: "12:00", end: "12:30" }] }], stored);
  assert.deepEqual(merged, stored);
});

test("[P0] fails closed when the stored preservation baseline is malformed", () => {
  assert.equal(mergeRenderedSchedule([{ weekday: 1, start: "07:00", end: "16:00", breaks: [] }], [{ weekday: 1, start: "invalid", end: "16:00", breaks: [] }]), null);
});

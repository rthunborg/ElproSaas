/** Story 14.1 ATDD red-phase scaffold; all scenarios stay skipped until the pure module exists. */
import assert from "node:assert/strict";
import { test } from "node:test";

const workHoursModulePath = "../../../../src/features/resources/work-hours";

test("[P0] preserves different daily availability for four-full-day and five-short-day 80-percent templates", async () => {
  const resourceModule = await import(workHoursModulePath) as {
    scheduledAvailabilityForTemplate?: (input: unknown) => readonly { weekday: number; scheduledMinutes: number }[];
  };
  assert.ok(resourceModule.scheduledAvailabilityForTemplate);

  const fourFullDays = resourceModule.scheduledAvailabilityForTemplate?.({
    employmentPercentage: 80,
    shifts: [
      { weekday: 1, start: "07:00", end: "16:00", breaks: [] },
      { weekday: 2, start: "07:00", end: "16:00", breaks: [] },
      { weekday: 3, start: "07:00", end: "16:00", breaks: [] },
      { weekday: 4, start: "07:00", end: "16:00", breaks: [] },
    ],
  });
  const fiveShortDays = resourceModule.scheduledAvailabilityForTemplate?.({
    employmentPercentage: 80,
    shifts: [
      { weekday: 1, start: "07:00", end: "14:12", breaks: [] },
      { weekday: 2, start: "07:00", end: "14:12", breaks: [] },
      { weekday: 3, start: "07:00", end: "14:12", breaks: [] },
      { weekday: 4, start: "07:00", end: "14:12", breaks: [] },
      { weekday: 5, start: "07:00", end: "14:12", breaks: [] },
    ],
  });

  assert.notDeepEqual(fourFullDays, fiveShortDays);
  assert.deepEqual(fourFullDays?.map((day) => day.weekday), [1, 2, 3, 4]);
  assert.deepEqual(fiveShortDays?.map((day) => day.weekday), [1, 2, 3, 4, 5]);
});

test("[P0] rejects overlapping or out-of-bound shifts and breaks without deriving hours from employment percentage", async () => {
  const resourceModule = await import(workHoursModulePath) as {
    validateWorkHoursInput?: (input: unknown) => { ok: boolean };
  };
  const overlappingShift = resourceModule.validateWorkHoursInput?.({
    employmentPercentage: 80,
    shifts: [
      { weekday: 1, start: "07:00", end: "12:00", breaks: [] },
      { weekday: 1, start: "11:30", end: "15:00", breaks: [] },
    ],
  });
  const invalidBreak = resourceModule.validateWorkHoursInput?.({
    shifts: [{ weekday: 1, start: "07:00", end: "16:00", breaks: [{ start: "06:59", end: "07:30" }] }],
  });

  assert.equal(overlappingShift?.ok, false);
  assert.equal(invalidBreak?.ok, false);
});

test("[P0] rejects overlapping breaks inside a single actual shift", async () => {
  const resourceModule = await import(workHoursModulePath) as {
    validateWorkHoursInput?: (input: unknown) => { ok: boolean };
  };
  const result = resourceModule.validateWorkHoursInput?.({
    shifts: [{
      weekday: 1,
      start: "07:00",
      end: "16:00",
      breaks: [{ start: "10:00", end: "11:00" }, { start: "10:30", end: "11:30" }],
    }],
  });

  assert.equal(result?.ok, false);
});

test("[P0] accepts PostgreSQL time values with seconds and microseconds from the scheduling read model", async () => {
  const resourceModule = await import(workHoursModulePath) as {
    validateWorkHoursInput?: (input: unknown) => { ok: boolean };
  };
  const result = resourceModule.validateWorkHoursInput?.({
    shifts: [{ weekday: 1, start: "07:00:30.123456", end: "16:00:30.123456", breaks: [{ start: "12:00:30.123456", end: "12:30:30.123456" }] }],
  });
  assert.equal(result?.ok, true);
});

/** Story14.3 golden capacity evidence, actual schedule and N-9 authority. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PEER, PERSON, candidate, capacity, engine, facts, golden, type Terms } from "../../../support/scheduling-atdd";
import { DEFAULT_SCHEDULING_RULES } from "../../../../src/features/scheduling/types";

test("[P0] 14.3-UNIT-004 every positive overrun warns regardless of injected threshold", async () => {
  const detect = await engine(); const input = facts(); input.people[0]!.shifts = [{ weekday: 1, start: "10:00", end: "10:30", breaks: [] }];
  input.rules.acknowledgmentThresholdMinutes = 120;
  let rows = detect(input).filter((r) => r.conflictType === "over_capacity");
  assert.equal(rows.length, 1); assert.deepEqual(rows[0]!.affectedPersonIds, [PERSON]);
  input.rules.acknowledgmentThresholdMinutes = 0; rows = detect(input).filter((r) => r.conflictType === "over_capacity"); assert.equal(rows.length, 1);
  input.candidate.endsAt = "2026-10-12T08:30:00.000000Z"; assert.equal(detect(input).filter((r) => r.conflictType === "over_capacity").length, 0);
  const aggregate = facts(); aggregate.people[0]!.shifts = [{ weekday: 1, start: "08:00", end: "09:00", breaks: [] }];
  aggregate.candidate = candidate({ startsAt: "2026-10-12T06:00:00Z", endsAt: "2026-10-12T06:30:00Z" });
  aggregate.existingBookings = [candidate({ id: PEER, startsAt: "2026-10-12T06:30:00Z", endsAt: "2026-10-12T07:00:00.000001Z" })];
  const rowsWithMicrosecondOverrun = detect(aggregate).filter((row) => row.conflictType === "over_capacity");
  assert.equal(rowsWithMicrosecondOverrun.length, 1);
  assert.deepEqual(rowsWithMicrosecondOverrun[0]!.bookingIds, [aggregate.candidate.id, PEER]);
  assert.equal(rowsWithMicrosecondOverrun[0]!.startsAt, "2026-10-11T22:00:00.000000Z");
  assert.equal(rowsWithMicrosecondOverrun[0]!.endsAt, "2026-10-12T22:00:00.000000Z");
  const peerPerspective = { ...aggregate, candidate: aggregate.existingBookings[0]!, existingBookings: [aggregate.candidate] };
  assert.deepEqual(detect(peerPerspective).filter((row) => row.conflictType === "over_capacity"), rowsWithMicrosecondOverrun);
  aggregate.existingBookings[0]!.endsAt = "2026-10-12T07:00:00Z";
  assert.equal(detect(aggregate).filter((row) => row.conflictType === "over_capacity").length, 0);
  aggregate.rules.planningBufferMinutes = 1;
  assert.equal(detect(aggregate).filter((row) => row.conflictType === "over_capacity").length, 1);
  const submicrosecond = facts(); submicrosecond.people[0]!.shifts = [{ weekday: 1, start: "08:00:00", end: "08:00:00.000001", breaks: [] }];
  submicrosecond.candidate = candidate({ startsAt: "2026-10-12T06:00:00Z", endsAt: "2026-10-12T06:00:00.000001Z" });
  submicrosecond.calendarDays = [{ date: "2026-10-12", variant: "reduced_capacity", reductionPercent: 50 }];
  assert.equal((await capacity())(submicrosecond, PERSON, "2026-10-12").availableMinutes, 1 / 120000000);
  assert.equal(detect(submicrosecond).filter((row) => row.conflictType === "over_capacity").length, 1);
});

test("[P0] 14.3-UNIT-012 six formula terms isolate each change and layered subtraction once", async () => {
  const pack = await golden<{ terms: { name: string; change: keyof Terms | null; expected: Terms }[]; swedishHolidays: { date: string; holiday: boolean }[] }>("capacity");
  const calculate = await capacity();
  for (const row of pack.terms) {
    const input = facts(); input.people[0]!.shifts = [{ weekday: 1, start: "08:00", end: row.change === "scheduledMinutes" ? "15:00" : "16:00", breaks: [] }];
    if (row.change === "holidayClosedMinutes") input.calendarDays = [{ date: "2026-10-12", variant: "reduced_capacity", reductionPercent: 50 }];
    if (row.change === "absenceMinutes") input.people[0]!.exceptions = [{ kind: "absence", date: "2026-10-12", start: "08:00", end: "09:00" }];
    if (row.change === "existingBookingMinutes") input.existingBookings = [candidate({ id: "20000000-0000-4000-8000-000000000003", startsAt: "2026-10-12T06:00:00.000000Z", endsAt: "2026-10-12T07:00:00.000000Z" })];
    if (row.change === "blockedMinutes") input.people[0]!.exceptions = [{ kind: "blocked_time", date: "2026-10-12", start: "08:00", end: "09:00" }];
    if (row.change === "bufferMinutes") input.rules.planningBufferMinutes = 60;
    assert.deepEqual(calculate(input, PERSON, "2026-10-12"), row.expected, row.name);
  }
  const overlap = facts(); overlap.people[0]!.shifts = [{ weekday: 1, start: "08:00", end: "16:00", breaks: [] }];
  overlap.people[0]!.exceptions = [{ kind: "absence", date: "2026-10-12", start: "08:00", end: "09:00" }, { kind: "blocked_time", date: "2026-10-12", start: "08:30", end: "09:30" }];
  assert.equal(calculate(overlap, PERSON, "2026-10-12").availableMinutes, 390);
  assert.deepEqual(calculate(overlap, PERSON, "2026-10-12"), { scheduledMinutes: 480, holidayClosedMinutes: 0, absenceMinutes: 60, existingBookingMinutes: 0, blockedMinutes: 30, bufferMinutes: 0, availableMinutes: 390 });
  overlap.calendarDays = [{ date: "2026-10-12", variant: "reduced_capacity", reductionPercent: 50 }];
  assert.deepEqual(calculate(overlap, PERSON, "2026-10-12"), { scheduledMinutes: 480, holidayClosedMinutes: 195, absenceMinutes: 60, existingBookingMinutes: 0, blockedMinutes: 30, bufferMinutes: 0, availableMinutes: 195 });
  // Reduction is a budget, not an invented closed morning/afternoon.
  assert.equal((await engine())(overlap).filter((row) => row.conflictType === "outside_work_hours").length, 0);
  overlap.calendarDays = [{ date: "2026-01-06", variant: "closed" }]; overlap.people[0]!.shifts = [{ weekday: 2, start: "08:00", end: "16:00", breaks: [] }];
  assert.equal(calculate(overlap, PERSON, "2026-01-06").availableMinutes, 0);
  const path = new URL("../../../../src/features/scheduling/swedish-holidays.ts", import.meta.url).href;
  const holidayModule = await import(path) as { isSwedishPublicHoliday?: (date: string) => boolean };
  assert.equal(typeof holidayModule.isSwedishPublicHoliday, "function");
  for (const day of pack.swedishHolidays) assert.equal(holidayModule.isSwedishPublicHoliday!(day.date), day.holiday, day.date);
  const four = facts(); four.people[0]!.employmentPercentage = 80; four.people[0]!.shifts = [1,2,3,4].map((weekday) => ({ weekday, start: "08:00", end: "16:00", breaks: [] }));
  const five = structuredClone(four); five.people[0]!.shifts = [1,2,3,4,5].map((weekday) => ({ weekday, start: "08:00", end: "14:24", breaks: [] }));
  assert.equal(calculate(four, PERSON, "2026-10-16").scheduledMinutes, 0); assert.equal(calculate(five, PERSON, "2026-10-16").scheduledMinutes, 384);
  const empty = structuredClone(four); empty.people[0]!.shifts = []; assert.equal(calculate(empty, PERSON, "2026-10-12").availableMinutes, 0);
  for (const mutate of [
    (input: typeof empty) => { input.rules.planningBufferMinutes = -1; },
    (input: typeof empty) => { input.rules.acknowledgmentThresholdMinutes = NaN; },
    (input: typeof empty) => { input.calendarDays = [{ date: "2026-02-30", variant: "closed" }]; },
    (input: typeof empty) => { input.people[0]!.exceptions = [{ kind: "absence", date: "2026-10-12", start: "10:00" }]; },
    (input: typeof empty) => { input.candidate.assigneeIds = ["missing-person"]; },
    (input: typeof empty) => { input.existingBookings = [candidate({ id: PEER }), candidate({ id: PEER, endsAt: "2026-10-12T10:00:00Z" })]; },
    (input: typeof empty) => { input.candidate.startsAt = input.candidate.endsAt; },
  ]) { const invalid = structuredClone(empty); mutate(invalid); assert.throws(() => calculate(invalid, PERSON, "2026-10-12")); }
});

test("[P1] 14.3-UNIT-013 overtime is explicitly injected data and never default capacity", async () => {
  const calculate = await capacity(); const detect = await engine(); const input = facts(); input.people[0]!.shifts = [{ weekday: 1, start: "08:00", end: "16:00", breaks: [] }];
  input.candidate = candidate({ startsAt: "2026-10-12T14:00:00.000000Z", endsAt: "2026-10-12T15:00:00.000000Z" });
  assert.equal(calculate(input, PERSON, "2026-10-12").availableMinutes, 480); assert.ok(detect(input).some((r) => r.conflictType === "outside_work_hours"));
  input.rules.authorizedOvertime = [{ personId: PERSON, startsAt: input.candidate.startsAt, endsAt: input.candidate.endsAt }];
  assert.equal(calculate(input, PERSON, "2026-10-12").availableMinutes, 540); assert.equal(detect(input).filter((r) => r.conflictType === "outside_work_hours").length, 0);
  input.rules.authorizedOvertime.push(...input.rules.authorizedOvertime);
  assert.equal(calculate(input, PERSON, "2026-10-12").availableMinutes, 540);
  input.rules.authorizedOvertime.push({ personId: PERSON, startsAt: "2026-10-12T13:30:00Z", endsAt: "2026-10-12T15:00:00Z" });
  assert.equal(calculate(input, PERSON, "2026-10-12").availableMinutes, 540);
  assert.deepEqual(DEFAULT_SCHEDULING_RULES, { version: "stockholm-capacity-v1", timeZone: "Europe/Stockholm", planningBufferMinutes: 0, acknowledgmentThresholdMinutes: 60, authorizedOvertime: [] });
  assert.ok(Object.isFrozen(DEFAULT_SCHEDULING_RULES)); assert.ok(Object.isFrozen(DEFAULT_SCHEDULING_RULES.authorizedOvertime));
});

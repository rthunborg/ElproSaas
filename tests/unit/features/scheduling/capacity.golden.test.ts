/** Story14.3 RED golden capacity scaffolds, actual schedule and N-9 authority. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PERSON, candidate, capacity, engine, facts, golden, type Terms } from "../../../support/scheduling-atdd";

test.skip("[P0] 14.3-UNIT-004 every positive overrun warns regardless of injected threshold", async () => {
  const detect = await engine(); const input = facts(); input.people[0]!.shifts = [{ weekday: 1, start: "10:00", end: "10:30", breaks: [] }];
  input.rules.acknowledgmentThresholdMinutes = 120;
  let rows = detect(input).filter((r) => r.conflictType === "over_capacity");
  assert.equal(rows.length, 1); assert.deepEqual(rows[0]!.affectedPersonIds, [PERSON]);
  input.rules.acknowledgmentThresholdMinutes = 0; rows = detect(input).filter((r) => r.conflictType === "over_capacity"); assert.equal(rows.length, 1);
  input.candidate.endsAt = "2026-10-12T08:30:00.000000Z"; assert.equal(detect(input).filter((r) => r.conflictType === "over_capacity").length, 0);
});

test.skip("[P0] 14.3-UNIT-012 six formula terms isolate each change and layered subtraction once", async () => {
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
});

test.skip("[P1] 14.3-UNIT-013 overtime is explicitly injected data and never default capacity", async () => {
  const calculate = await capacity(); const detect = await engine(); const input = facts(); input.people[0]!.shifts = [{ weekday: 1, start: "08:00", end: "16:00", breaks: [] }];
  input.candidate = candidate({ startsAt: "2026-10-12T14:00:00.000000Z", endsAt: "2026-10-12T15:00:00.000000Z" });
  assert.equal(calculate(input, PERSON, "2026-10-12").availableMinutes, 480); assert.ok(detect(input).some((r) => r.conflictType === "outside_work_hours"));
  input.rules.authorizedOvertime = [{ personId: PERSON, startsAt: input.candidate.startsAt, endsAt: input.candidate.endsAt }];
  assert.equal(calculate(input, PERSON, "2026-10-12").availableMinutes, 540); assert.equal(detect(input).filter((r) => r.conflictType === "outside_work_hours").length, 0);
});

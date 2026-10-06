/** Story14.3 Stockholm DST packs preserve all six fractional digits. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PERSON, capacity, domain, engine, facts, golden, localTime } from "../../../support/scheduling-atdd";
import { formatUtcInstant, localDateForInstant, parseUtcInstant } from "../../../../src/features/scheduling/time-zone";
type Pack = { gap: { local: string; expectedUtc: string }[]; fold: { local: string; expectedUtc: string }[];
  allDay: { startLocal: string; endLocal: string; startUtc: string; endUtc: string; hours: number }[];
  multiDay: { startLocal: string; endLocal: string; startUtc: string; endUtc: string; hours: number }[];
  boundaryWeeks: { local: string; expectedUtc: string }[] };

test("[P1] 14.3-UNIT-009 spring gap uses first valid instant across all-day/multi-day", async () => {
  const pack = await golden<Pack>("dst"); const convert = await localTime(); for (const row of pack.gap) assert.equal(convert(row.local), row.expectedUtc);
  for (const row of pack.boundaryWeeks.filter((row) => row.local.includes("-03-"))) assert.equal(convert(row.local), row.expectedUtc);
  for (const row of [pack.allDay[0]!,pack.multiDay[0]!]) {
    assert.equal(convert(row.startLocal), row.startUtc); assert.equal(convert(row.endLocal), row.endUtc);
    assert.equal((Date.parse(row.endUtc)-Date.parse(row.startUtc))/3600000,row.hours);
  }
  const detect = await engine(); const input = facts(); input.candidate = { ...input.candidate, allDay: true, startsAt: pack.multiDay[0]!.startUtc, endsAt: pack.multiDay[0]!.endUtc };
  const rows = detect(input); assert.ok(rows.some((r) => r.conflictType === "outside_work_hours")); assert.deepEqual(domain(detect(structuredClone(input))), domain(rows));
  const timed = facts(); timed.people[0]!.shifts = [];
  timed.rules.authorizedOvertime = [{ personId: PERSON, startsAt: convert("2026-03-29T01:30:00"), endsAt: convert("2026-03-29T03:30:00") }];
  timed.candidate = { ...timed.candidate, startsAt: timed.rules.authorizedOvertime[0]!.startsAt, endsAt: timed.rules.authorizedOvertime[0]!.endsAt };
  assert.equal((await capacity())(timed, PERSON, "2026-03-29").scheduledMinutes, 60);
  assert.deepEqual(detect(timed), []);
  const gapShift = facts(); gapShift.people[0]!.shifts = [{ weekday: 7, start: "02:10", end: "02:40", breaks: [] }];
  assert.equal((await capacity())(gapShift, PERSON, "2026-03-29").scheduledMinutes, 0);
  assert.throws(() => convert("2026-02-30T12:00:00")); assert.throws(() => convert("2026-03-29T24:00:00"));
});

test("[P1] 14.3-UNIT-010 fall fold uses earlier instant and retains exact microseconds", async () => {
  const pack = await golden<Pack>("dst"); const convert = await localTime(); for (const row of pack.fold) assert.equal(convert(row.local), row.expectedUtc);
  for (const row of pack.boundaryWeeks.filter((row) => row.local.includes("-10-"))) assert.equal(convert(row.local), row.expectedUtc);
  for (const row of [pack.allDay[1]!,pack.multiDay[1]!]) {
    assert.equal(convert(row.startLocal), row.startUtc); assert.equal(convert(row.endLocal), row.endUtc);
    assert.equal((Date.parse(row.endUtc)-Date.parse(row.startUtc))/3600000,row.hours);
  }
  const detect = await engine(); const input = facts(); input.candidate = { ...input.candidate, allDay: true, startsAt: pack.multiDay[1]!.startUtc, endsAt: pack.multiDay[1]!.endUtc };
  const rows = detect(input); assert.ok(rows.some((r) => r.conflictType === "outside_work_hours")); assert.deepEqual(detect(structuredClone(input)), rows);
  const timed = facts(); timed.people[0]!.shifts = [];
  timed.rules.authorizedOvertime = [{ personId: PERSON, startsAt: convert("2026-10-25T01:30:00"), endsAt: convert("2026-10-25T03:30:00") }];
  timed.candidate = { ...timed.candidate, startsAt: timed.rules.authorizedOvertime[0]!.startsAt, endsAt: timed.rules.authorizedOvertime[0]!.endsAt };
  assert.equal((await capacity())(timed, PERSON, "2026-10-25").scheduledMinutes, 180); assert.deepEqual(detect(timed), []);
  assert.equal(formatUtcInstant(parseUtcInstant("2026-10-25T02:30:00.123456+02:00")), "2026-10-25T00:30:00.123456Z");
  assert.equal(formatUtcInstant(parseUtcInstant("1969-12-31T23:59:59.999999Z")), "1969-12-31T23:59:59.999999Z");
  assert.equal(localDateForInstant(parseUtcInstant("1969-12-31T22:59:59.999999Z")), "1969-12-31");
});

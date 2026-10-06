/** Story14.3 RED Stockholm DST packs preserve all six fractional digits. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { domain, engine, facts, golden, localTime } from "../../../support/scheduling-atdd";
type Pack = { gap: { local: string; expectedUtc: string }[]; fold: { local: string; expectedUtc: string }[];
  allDay: { startLocal: string; endLocal: string; startUtc: string; endUtc: string; hours: number }[];
  multiDay: { startLocal: string; endLocal: string; startUtc: string; endUtc: string; hours: number }[] };

test.skip("[P1] 14.3-UNIT-009 spring gap uses first valid instant across all-day/multi-day", async () => {
  const pack = await golden<Pack>("dst"); const convert = await localTime(); for (const row of pack.gap) assert.equal(convert(row.local), row.expectedUtc);
  for (const row of [pack.allDay[0]!,pack.multiDay[0]!]) {
    assert.equal(convert(row.startLocal), row.startUtc); assert.equal(convert(row.endLocal), row.endUtc);
    assert.equal((Date.parse(row.endUtc)-Date.parse(row.startUtc))/3600000,row.hours);
  }
  const detect = await engine(); const input = facts(); input.candidate = { ...input.candidate, allDay: true, startsAt: pack.multiDay[0]!.startUtc, endsAt: pack.multiDay[0]!.endUtc };
  const rows = detect(input); assert.ok(rows.some((r) => r.conflictType === "outside_work_hours")); assert.deepEqual(domain(detect(structuredClone(input))), domain(rows));
});

test.skip("[P1] 14.3-UNIT-010 fall fold uses earlier instant and retains exact microseconds", async () => {
  const pack = await golden<Pack>("dst"); const convert = await localTime(); for (const row of pack.fold) assert.equal(convert(row.local), row.expectedUtc);
  for (const row of [pack.allDay[1]!,pack.multiDay[1]!]) {
    assert.equal(convert(row.startLocal), row.startUtc); assert.equal(convert(row.endLocal), row.endUtc);
    assert.equal((Date.parse(row.endUtc)-Date.parse(row.startUtc))/3600000,row.hours);
  }
  const detect = await engine(); const input = facts(); input.candidate = { ...input.candidate, allDay: true, startsAt: pack.multiDay[1]!.startUtc, endsAt: pack.multiDay[1]!.endUtc };
  const rows = detect(input); assert.ok(rows.some((r) => r.conflictType === "outside_work_hours")); assert.deepEqual(detect(structuredClone(input)), rows);
});

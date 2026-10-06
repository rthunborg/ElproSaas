/** Story14.3 RED scaffolds: missing sole detector; activate task by task. */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { BOOKING, OTHER, PEER, PERSON, ROLE, THIRD, candidate, domain, engine, facts, freeze, golden,
  type Scenario } from "../../../support/scheduling-atdd";

test.skip("[P0] 14.3-UNIT-001 shared assignee emits exact stable pair/person/window", async () => {
  const pack = await golden<{ scenarios: Scenario[] }>("conflicts"); const scenario = pack.scenarios[0]!;
  const detect = await engine(); const result = detect(freeze(scenario.input));
  assert.deepEqual(domain(result), scenario.expected);
  assert.equal(new Set(result.map((r) => r.naturalKey)).size, result.length);
  assert.deepEqual(detect(scenario.input), result);
});

test.skip("[P1] 14.3-UNIT-002 adjacent half-open intervals clear, microsecond overlap real", async () => {
  const pack = await golden<{ scenarios: Scenario[] }>("conflicts"); const detect = await engine();
  for (const row of pack.scenarios.slice(1)) assert.deepEqual(domain(detect(row.input)), row.expected, row.name);
});

test.skip("[P1] 14.3-UNIT-003 only colliding people appear, permutations have identical bytes", async () => {
  const detect = await engine(); const input = facts({ candidate: candidate({ assigneeIds: [PERSON, OTHER] }),
    existingBookings: [candidate({ id: PEER, assigneeIds: [PERSON, THIRD], startsAt: "2026-10-12T08:30:00.000000Z" })] });
  input.people.push({ ...structuredClone(input.people[0]!), id: OTHER }, { ...structuredClone(input.people[0]!), id: THIRD });
  const output = detect(freeze(input)); assert.equal(output.length, 1); assert.deepEqual(output[0]!.affectedPersonIds, [PERSON]);
  const permutation = structuredClone(input); permutation.candidate.assigneeIds.reverse();
  permutation.existingBookings[0]!.assigneeIds.reverse(); permutation.people.reverse();
  assert.equal(JSON.stringify(detect(freeze(permutation))), JSON.stringify(output));
});

test.skip("[P1] 14.3-UNIT-005 outside actual shifts retains partial/whole violating windows", async () => {
  const detect = await engine();
  for (const [start, end, expectedEnd] of [["2026-10-12T04:30:00.000000Z", "2026-10-12T05:30:00.000000Z", "2026-10-12T05:00:00.000000Z"],
    ["2026-10-12T03:30:00.000000Z", "2026-10-12T04:00:00.000000Z", "2026-10-12T04:00:00.000000Z"]]) {
    const rows = detect(facts({ candidate: candidate({ startsAt: start!, endsAt: end! }) })).filter((r) => r.conflictType === "outside_work_hours");
    assert.deepEqual(domain(rows), [{ conflictType: "outside_work_hours", bookingIds: [BOOKING], affectedPersonIds: [PERSON], startsAt: start, endsAt: expectedEnd }]);
  }
  const empty = facts(); empty.people[0]!.shifts = []; empty.people[0]!.employmentPercentage = 80;
  assert.ok(detect(empty).some((r) => r.conflictType === "outside_work_hours"));
  assert.throws(() => detect({ ...empty, people: [{ ...empty.people[0]!, shifts: [{ weekday: 1, start: "bad", end: "17:00", breaks: [] }] }] }));
});

test.skip("[P1] 14.3-UNIT-006 split shifts, break and overlapping absence/blocked emit one identity", async () => {
  const detect = await engine(); const input = facts();
  input.people[0]!.shifts = [{ weekday: 1, start: "07:00", end: "12:00", breaks: [{ start: "10:00", end: "10:30" }] }, { weekday: 1, start: "13:00", end: "17:00", breaks: [] }];
  input.people[0]!.exceptions = [{ kind: "absence", date: "2026-10-12", start: "10:00", end: "10:30" }, { kind: "blocked_time", date: "2026-10-12", start: "10:00", end: "10:30" }];
  const rows = detect(input).filter((r) => r.conflictType === "outside_work_hours");
  assert.deepEqual(domain(rows), [{ conflictType: "outside_work_hours", bookingIds: [BOOKING], affectedPersonIds: [PERSON], startsAt: "2026-10-12T08:00:00.000000Z", endsAt: "2026-10-12T08:30:00.000000Z" }]);
  assert.equal(new Set(rows.map((r) => r.naturalKey)).size, rows.length);
  input.candidate = candidate({ startsAt: "2026-10-12T11:30:00.000000Z", endsAt: "2026-10-12T12:00:00.000000Z" });
  assert.equal(detect(input).filter((r) => r.conflictType === "outside_work_hours").length, 0);
});

test.skip("[P1] 14.3-UNIT-007 only supplied access window emits exact warning", async () => {
  const detect = await engine(); const input = facts();
  assert.equal(detect(input).filter((r) => r.conflictType === "outside_access_window").length, 0);
  input.jobInputs = { accessWindows: [{ startsAt: "2026-10-12T08:30:00.000000Z", endsAt: "2026-10-12T09:00:00.000000Z" }] };
  assert.deepEqual(domain(detect(input).filter((r) => r.conflictType === "outside_access_window")), [{ conflictType: "outside_access_window", bookingIds: [BOOKING], affectedPersonIds: [PERSON], startsAt: "2026-10-12T08:00:00.000000Z", endsAt: "2026-10-12T08:30:00.000000Z" }]);
});

test.skip("[P1] 14.3-UNIT-008 explicit missing required role warns, matching role clears it", async () => {
  const detect = await engine(); const input = facts();
  assert.equal(detect(input).filter((r) => r.conflictType === "competence_missing").length, 0);
  input.jobInputs = { requiredWorkRoleIds: [ROLE] }; input.people[0]!.workRoleIds = [];
  const rows = detect(input).filter((r) => r.conflictType === "competence_missing");
  assert.deepEqual(domain(rows), [{ conflictType: "competence_missing", bookingIds: [BOOKING], affectedPersonIds: [PERSON], startsAt: input.candidate.startsAt, endsAt: input.candidate.endsAt }]);
  input.people[0]!.workRoleIds = [ROLE]; assert.equal(detect(input).filter((r) => r.conflictType === "competence_missing").length, 0);
});

test.skip("[P1] 14.3-UNIT-011 frozen inputs yield sorted byte-identical output without clock/I/O", async (t) => {
  const pack = await golden<{ scenarios: Scenario[] }>("conflicts"); const detect = await engine();
  const input = structuredClone(pack.scenarios[0]!.input);
  input.existingBookings.push(candidate({ id: "20000000-0000-4000-8000-000000000003", startsAt: "2026-10-12T08:45:00.000000Z", endsAt: "2026-10-12T08:50:00.000000Z" }));
  freeze(input); const before = JSON.stringify(input);
  t.mock.method(Date, "now", () => { throw new Error("ambient clock forbidden"); });
  t.mock.method(globalThis, "fetch", () => { throw new Error("runtime I/O forbidden"); });
  t.mock.method(fs, "readFileSync", () => { throw new Error("runtime filesystem forbidden"); });
  t.mock.method(fsp, "readFile", () => { throw new Error("runtime filesystem forbidden"); });
  const originalDate = Date;
  globalThis.Date = new Proxy(originalDate, {
    construct(target, args) { assert.ok(args.length > 0, "ambient new Date forbidden"); return Reflect.construct(target, args); },
    apply() { throw new Error("ambient Date call forbidden"); },
  });
  t.after(() => { globalThis.Date = originalDate; });
  const output = detect(input); assert.ok(output.length >= 2); const bytes = JSON.stringify(output);
  for (let i = 0; i < 3; i++) assert.equal(JSON.stringify(detect(input)), bytes);
  assert.equal(JSON.stringify(input), before);
  const keys = output.map((r) => r.naturalKey); assert.deepEqual(keys, [...keys].sort());
  const cancelled = structuredClone(input); cancelled.candidate.status = "cancelled"; assert.deepEqual(detect(cancelled), []);
  // Author additionally verifies the pure import graph; probes above cover common runtime clock/I/O paths.
});

test.skip("[P1] 14.3-UNIT-014 named immutable miss/phantom packs protect every corrected defect", async () => {
  const pack = await golden<{ provenance: string; scenarios: Scenario[] }>("regressions"); const detect = await engine();
  assert.equal(pack.provenance, "new-expected"); assert.equal(new Set(pack.scenarios.map((r) => r.name)).size, pack.scenarios.length);
  assert.ok(pack.scenarios.length >= 4);
  for (const row of pack.scenarios) assert.deepEqual(domain(detect(freeze(row.input))), row.expected, row.name);
});

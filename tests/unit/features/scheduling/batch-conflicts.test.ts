import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { detectAllBookingConflicts, detectConflicts } from "../../../../src/features/scheduling/conflicts";
import { deriveBookingConflicts, type DetectionSnapshot } from "../../../../src/server/bookings/conflict-facts";
import { DEFAULT_SCHEDULING_RULES, type SchedulingConflict, type SchedulingFacts } from "../../../../src/features/scheduling/types";
import { BOOKING, OTHER, PEER, PERSON, candidate, domain, facts, freeze, golden, type Scenario } from "../../../support/scheduling-atdd";

/** Independent per-candidate orchestration retains the pre-batch public contract. */
function repeatedDetection(input: SchedulingFacts): SchedulingConflict[] {
  const bookings = [...new Map(input.existingBookings.filter((row) => row.id !== input.candidate.id).map((row) => [row.id, row])).values(), input.candidate];
  const output = new Map<string, SchedulingConflict>();
  for (const candidate of bookings) {
    for (const row of detectConflicts({ ...input, candidate, existingBookings: bookings.filter((row) => row.id !== candidate.id) })) output.set(row.naturalKey, row);
  }
  return [...output.values()].sort((a, b) => a.naturalKey < b.naturalKey ? -1 : a.naturalKey > b.naturalKey ? 1 : 0);
}
function equivalent(input: SchedulingFacts): void {
  const before = JSON.stringify(input);
  assert.equal(JSON.stringify(detectAllBookingConflicts(freeze(input))), JSON.stringify(repeatedDetection(input)));
  assert.equal(JSON.stringify(input), before);
}

test("batch full-tenant output matches repeated detector and independent literal goldens", async () => {
  for (const pack of ["conflicts", "regressions"]) {
    for (const scenario of (await golden<{ scenarios: Scenario[] }>(pack)).scenarios) {
      equivalent(scenario.input);
      assert.deepEqual(domain(detectAllBookingConflicts(scenario.input).filter((row) => row.bookingIds.includes(scenario.input.candidate.id))), scenario.expected, scenario.name);
    }
  }
});

test("batch preserves old/new assignees and windows, cancelled history, duplicates and peer-only conflicts", () => {
  const reused = facts(); const first = detectAllBookingConflicts(reused);
  reused.people[0]!.shifts = [];
  assert.notDeepEqual(detectAllBookingConflicts(reused), first, "capacity is never cached across invocations");
  reused.candidate.startsAt = "bad";
  assert.throws(() => detectAllBookingConflicts(reused), "a reused object is revalidated and reparsed");
  const input = facts(); input.people.push({ ...structuredClone(input.people[0]!), id: OTHER });
  input.candidate.assigneeIds = [OTHER];
  input.existingBookings = [candidate({ startsAt: "2026-10-12T03:00:00Z", assigneeIds: [PERSON] }),
    candidate({ id: PEER }), candidate({ id: "peer-third", startsAt: "2026-10-12T08:30:00Z" }),
    candidate({ id: "cancelled", status: "cancelled" })];
  input.existingBookings.push(structuredClone(input.existingBookings[1]!));
  equivalent(input);
  const rows = detectAllBookingConflicts(input);
  assert.ok(rows.some((row) => row.conflictType === "double_booking" && !row.bookingIds.includes(BOOKING)));
  assert.ok(rows.every((row) => !row.bookingIds.includes("cancelled")));
  assert.ok(rows.every((row) => !(row.conflictType === "outside_work_hours" && row.bookingIds.includes(BOOKING))));
  const cancelled = structuredClone(input); cancelled.candidate.status = "cancelled"; equivalent(cancelled);
  assert.ok(detectAllBookingConflicts(cancelled).length > 0, "cancellation still refreshes peers");
  const permutation = structuredClone(input); permutation.existingBookings.reverse(); permutation.people.reverse();
  assert.deepEqual(detectAllBookingConflicts(permutation), rows);
});

test("batch retains fractional reduction, exact microsecond aggregate demand, buffers and explicit overtime", () => {
  for (const reductionPercent of [1, 50, 99, 100]) for (const buffer of [0, 1 / 60000000]) {
    const input = facts(); input.people[0]!.employmentPercentage = 80;
    input.people[0]!.shifts = [{ weekday: 1, start: "08:00:00", end: "08:00:00.000005", breaks: [] }];
    input.calendarDays = [{ date: "2026-10-12", variant: "reduced_capacity", reductionPercent }];
    input.rules.planningBufferMinutes = buffer;
    input.candidate = candidate({ startsAt: "2026-10-12T06:00:00Z", endsAt: "2026-10-12T06:00:00.000002Z" });
    input.existingBookings = [candidate({ id: PEER, startsAt: "2026-10-12T06:00:00.000002Z", endsAt: "2026-10-12T06:00:00.000003Z" })];
    equivalent(input);
    const overtime = structuredClone(input); overtime.rules.authorizedOvertime = [{ personId: PERSON, startsAt: "2026-10-12T06:00:00.000005Z", endsAt: "2026-10-12T06:00:00.000009Z" }];
    overtime.rules.authorizedOvertime.push(structuredClone(overtime.rules.authorizedOvertime[0]!)); equivalent(overtime);
  }
});

test("batch keeps DST day windows, layered absence/blocked time, optional job facts and microsecond boundaries", () => {
  for (const [start, end] of [["2026-03-28T23:00:00.123456Z", "2026-03-30T22:00:00.000001Z"],
    ["2026-10-24T22:00:00Z", "2026-10-26T23:00:00Z"]]) {
    const input = facts(); input.candidate.startsAt = start!; input.candidate.endsAt = end!; input.candidate.allDay = true;
    input.existingBookings = [candidate({ id: PEER, startsAt: start!, endsAt: end! }),
      candidate({ id: "third", startsAt: end!, endsAt: end!.slice(0, 10) + "T23:59:59.999999Z" })];
    // A peer adjacent to the long range must not become a double booking.
    input.people[0]!.exceptions = [{ kind: "absence", date: start!.slice(0, 10), start: "10:00", end: "11:00" }, { kind: "blocked_time", date: start!.slice(0, 10), start: "10:30", end: "11:30" }];
    input.jobInputs = { requiredWorkRoleIds: ["required-role"], accessWindows: [{ startsAt: start!, endsAt: end! }] };
    equivalent(input);
    assert.ok(detectAllBookingConflicts(input).every((row) => row.conflictType !== "double_booking" || !row.bookingIds.includes("third")));
  }
});

test("batch validates malformed facts even when candidates or history are cancelled", () => {
  for (const mutate of [
    (input: ReturnType<typeof facts>) => { input.rules.planningBufferMinutes = -1; },
    (input: ReturnType<typeof facts>) => { input.people[0]!.shifts[0]!.start = "bad"; },
    (input: ReturnType<typeof facts>) => { input.people[0]!.exceptions = [{ kind: "absence", date: "2026-02-30" }]; },
    (input: ReturnType<typeof facts>) => { input.calendarDays = [{ date: "2026-02-30", variant: "closed" }]; },
    (input: ReturnType<typeof facts>) => { input.existingBookings[0]!.startsAt = "bad"; },
    (input: ReturnType<typeof facts>) => { input.existingBookings[0]!.assigneeIds = ["missing"]; },
    (input: ReturnType<typeof facts>) => { input.existingBookings.push(candidate({ id: PEER, endsAt: "2026-10-12T10:00:00Z" })); },
    (input: ReturnType<typeof facts>) => { input.jobInputs = { accessWindows: [{ startsAt: "bad", endsAt: input.candidate.endsAt }] }; },
  ]) {
    const input = facts({ candidate: candidate({ status: "cancelled" }), existingBookings: [candidate({ id: PEER, status: "cancelled" })] });
    mutate(input); assert.throws(() => detectAllBookingConflicts(input)); assert.throws(() => detectConflicts(input));
  }
});

test("server projection preserves complete aggregate keys and candidate-third groups", () => {
  const input = facts(); input.rules = { ...DEFAULT_SCHEDULING_RULES, authorizedOvertime: [] };
  input.people[0]!.shifts = [{ weekday: 1, start: "10:00", end: "11:00", breaks: [] }];
  input.candidate.id = "z-candidate";
  input.existingBookings = [candidate({ id: "a-peer" }), candidate({ id: "b-peer" }), candidate({ id: "c-peer" })];
  const snapshot = { bookingId: input.candidate.id, candidate: input.candidate, facts: {
    bookings: input.existingBookings, profiles: [{ id: PERSON, membershipId: "member", defaultWorkRoleId: null, employmentPercentage: 100, archivedAt: null }],
    memberships: [{ id: "member", userId: "user", status: "active", role: "montor", roles: [] }], workRoles: [],
    hours: [{ id: "hours", personProfileId: PERSON, entryKind: "weekly_shift", weekday: 1, localDate: null, exceptionKind: null, startsAt: "10:00", endsAt: "11:00" }],
    calendarDays: [], jobInputs: null, rules: input.rules,
  } } as unknown as DetectionSnapshot;
  const derived = deriveBookingConflicts(freeze(snapshot));
  const expectedRows = new Map(); const expectedGroups = [];
  for (const conflict of repeatedDetection(input)) for (const personId of conflict.affectedPersonIds) {
    const naturalKey = `v1:${createHash("sha256").update(JSON.stringify([conflict.naturalKey, personId])).digest("hex")}`;
    const row = { booking_id: conflict.bookingIds[0]!, related_booking_id: conflict.bookingIds[1] ?? null, affected_person_profile_id: personId,
      conflict_type: conflict.conflictType, starts_at: conflict.startsAt, ends_at: conflict.endsAt, natural_key: naturalKey };
    expectedRows.set(naturalKey, row); const keys = [naturalKey];
    for (const bookingId of conflict.bookingIds.slice(2)) {
      const key = `v2:${createHash("sha256").update(JSON.stringify([conflict.naturalKey, personId, bookingId])).digest("hex")}`;
      expectedRows.set(key, { ...row, booking_id: bookingId, related_booking_id: conflict.bookingIds[0], natural_key: key }); keys.push(key);
    }
    if (conflict.bookingIds.includes(input.candidate.id)) expectedGroups.push({ logicalId: JSON.stringify([conflict.naturalKey, personId]), keys: keys.sort(),
      personId, bookingIds: conflict.bookingIds, rule: conflict.conflictType, startsAt: conflict.startsAt, endsAt: conflict.endsAt });
  }
  assert.equal(JSON.stringify(derived), JSON.stringify({ output: [...expectedRows.values()].sort((a, b) => a.natural_key < b.natural_key ? -1 : 1),
    groups: expectedGroups.sort((a, b) => a.logicalId < b.logicalId ? -1 : 1) }));
  const aggregate = derived.groups.find((row) => row.rule === "over_capacity")!;
  assert.deepEqual(aggregate.bookingIds, ["a-peer", "b-peer", "c-peer", "z-candidate"]);
  assert.equal(aggregate.keys.length, 3);
  assert.equal(derived.output.filter((row) => aggregate.keys.includes(row.natural_key)).length, 3);
});

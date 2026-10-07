/**
 * Skipped RED pure editor input contract. Bind real input functions during GREEN;
 * no parser/timezone/detector implementation lives in the test-owned adapter.
 * Duplicate decision IDs are rejected here consistently with existing assignee
 * input validation; canonical de-duplication is also permissible if documented
 * at implementation and shown to preserve the same business decision identity.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { binding, booking, decision, GROUP_A, GROUP_B } from "@/tests-support/booking-editor-contract";

// RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
test("[P1] 14.4-UNIT-INPUT-001 canonical decision orders logical identities and trims reason", { skip: true }, () => {
  const result = binding("normalizeDecision")(decision({ reviewedLogicalIds: [GROUP_B, GROUP_A],
    selectedLogicalIds: [GROUP_B, GROUP_A], reason: "  Kunden godkänner samordning \n " }));
  assert.deepEqual(result, { ok: true, data: decision({ reviewedLogicalIds: [GROUP_A, GROUP_B].sort(),
    selectedLogicalIds: [GROUP_A, GROUP_B].sort(), reason: "Kunden godkänner samordning" }) });
});

// RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
test("[P1] 14.4-UNIT-INPUT-002 duplicate selected logical identities do not form a valid decision", { skip: true }, () => {
  assert.deepEqual(binding("normalizeDecision")(decision({ selectedLogicalIds: [GROUP_A, GROUP_A] })),
    { ok: false, code: "VALIDATION_FAILED" });
});

// RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
test("[P0] 14.4-UNIT-INPUT-003 closed human decision rejects authority and transport fields", { skip: true }, () => {
  for (const field of ["tenantId", "actorId", "acceptedAt", "receipt", "signature", "proof", "conflicts"]) {
    assert.deepEqual(binding("normalizeDecision")({ ...decision(), [field]: "forged" }),
      { ok: false, code: "VALIDATION_FAILED" }, field);
  }
});

// RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
test("[P1] 14.4-UNIT-INPUT-004 current-set review cannot carry a whitespace-only reason", { skip: true }, () => {
  assert.deepEqual(binding("normalizeDecision")(decision({ reason: " \n\t " })),
    { ok: false, code: "VALIDATION_FAILED" });
});

// RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
test("[P1] 14.4-UNIT-INPUT-005 reviewed warning set permits an empty selected subset", { skip: true }, () => {
  const supplied = decision({ selectedLogicalIds: [] });
  assert.deepEqual(binding("normalizeDecision")(supplied), { ok: true, data: { ...supplied,
    reviewedLogicalIds: [GROUP_A, GROUP_B].sort() } });
});

// RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
test("[P1] 14.4-UNIT-INPUT-006 equivalent permutations produce the same canonical business decision", { skip: true }, () => {
  const first = binding("normalizeDecision")(decision({ reviewedLogicalIds: [GROUP_A, GROUP_B],
    selectedLogicalIds: [GROUP_A, GROUP_B], reason: "Samordning" }));
  const second = binding("normalizeDecision")(decision({ reviewedLogicalIds: [GROUP_B, GROUP_A],
    selectedLogicalIds: [GROUP_B, GROUP_A], reason: "  Samordning  " }));
  assert.equal(first.ok, true);
  assert.deepEqual(second, first);
});

// RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
test("[P1] 14.4-UNIT-INPUT-007 untouched displayed minutes preserve exact PostgreSQL microseconds", { skip: true }, () => {
  const original = booking();
  const actual = binding("prepareTimes")({ original, timeChanged: false, allDay: false,
    startsAtLocal: "2026-10-12T08:00:00", endsAtLocal: "2026-10-12T16:00:00" });
  assert.deepEqual(actual, { startsAt: original.startsAt, endsAt: original.endsAt });
});

// RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
test("[P1] 14.4-UNIT-INPUT-008 changed Stockholm fold input uses the existing earliest-instant policy", { skip: true }, () => {
  const actual = binding("prepareTimes")({ original: booking(), timeChanged: true, allDay: false,
    startsAtLocal: "2026-10-25T02:30:00", endsAtLocal: "2026-10-25T03:30:00" });
  assert.deepEqual(actual, { startsAt: "2026-10-25T00:30:00.000000Z", endsAt: "2026-10-25T02:30:00.000000Z" });
});

// RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
test("[P1] 14.4-UNIT-INPUT-009 changed Stockholm gap input uses the existing first-valid-instant policy", { skip: true }, () => {
  const actual = binding("prepareTimes")({ original: booking(), timeChanged: true, allDay: false,
    startsAtLocal: "2026-03-29T02:30:00", endsAtLocal: "2026-03-29T04:00:00" });
  assert.deepEqual(actual, { startsAt: "2026-03-29T01:00:00.000000Z", endsAt: "2026-03-29T02:00:00.000000Z" });
});

// RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
test("[P1] 14.4-UNIT-INPUT-010 changed full-day spring bounds span Stockholm's 23-hour local day", { skip: true }, () => {
  const actual = binding("prepareTimes")({ original: booking(), timeChanged: true, allDay: true,
    startsAtLocal: "2026-03-29T00:00:00", endsAtLocal: "2026-03-30T00:00:00" });
  assert.deepEqual(actual, { startsAt: "2026-03-28T23:00:00.000000Z", endsAt: "2026-03-29T22:00:00.000000Z" });
});

// RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
test("[P1] 14.4-UNIT-INPUT-011 changed full-day autumn bounds span Stockholm's 25-hour local day", { skip: true }, () => {
  const actual = binding("prepareTimes")({ original: booking(), timeChanged: true, allDay: true,
    startsAtLocal: "2026-10-25T00:00:00", endsAtLocal: "2026-10-26T00:00:00" });
  assert.deepEqual(actual, { startsAt: "2026-10-24T22:00:00.000000Z", endsAt: "2026-10-25T23:00:00.000000Z" });
});

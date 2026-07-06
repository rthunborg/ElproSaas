/**
 * Story 6.1 — PURE quote command input validator coverage (AC2/AC3; test-design-epic-6.md
 * #6.1-INT-02 boundary complement / R-602).
 *
 * `validateCreateQuoteVersionFromCalculation` is the input-shape guard the command envelope
 * runs BEFORE any DB access (architecture §5 step 4). It is pure (no I/O), so the fast
 * `node --test` gate protects its branches WITHOUT a database — the DB-backed INT suite
 * (`quote-version.int.test.ts`) proves the cross-tenant/ownership behaviour, this suite
 * proves the exhaustive shape rules cheaply. Every other command domain already has such a
 * validator unit test (calc / crm / files / pricing / settings) — this closes the one gap.
 *
 * The load-bearing rules:
 *   - `calculation_id` is REQUIRED and UUID-shaped (a value the DB would reject as `22P02`
 *     fails as VALIDATION, not as an opaque server error);
 *   - `attachment_file_ids` is OPTIONAL — absent / null → an empty list; when present it must
 *     be a bounded (≤100) array of UUID-shaped ids; a foreign id's OWNERSHIP is re-checked
 *     later in execute (that is the INT suite's job, not this one);
 *   - a client-supplied `tenant_id` is NEVER read — the resolved membership is the only
 *     authority (the validator strips/ignores it).
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock.
 * Mirrors `tests/unit/server/commands/file-validation.test.ts`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCreateQuoteVersionFromCalculation } from "@/server/commands/quotes/validation";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";
const UUID_UPPER = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";

test("[6.1-INT-02] accepts a uuid calculation_id with NO attachments (the common path)", () => {
  const r = validateCreateQuoteVersionFromCalculation({ calculation_id: UUID_A });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.calculation_id, UUID_A);
  // An absent attachment list narrows to the empty list (no attachments selected).
  assert.deepEqual(r.data.attachment_file_ids, []);
});

test("[6.1-INT-02] accepts a uuid calculation_id WITH a bounded uuid attachment array", () => {
  const r = validateCreateQuoteVersionFromCalculation({
    calculation_id: UUID_A,
    attachment_file_ids: [UUID_A, UUID_B],
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual([...r.data.attachment_file_ids], [UUID_A, UUID_B]);
});

test("accepts an UPPERCASE (case-insensitive) uuid calculation_id + attachment id", () => {
  const r = validateCreateQuoteVersionFromCalculation({
    calculation_id: UUID_UPPER,
    attachment_file_ids: [UUID_UPPER],
  });
  assert.equal(r.ok, true, "UUID_RE is case-insensitive");
});

test("attachment_file_ids: null / undefined both narrow to the empty list", () => {
  for (const v of [null, undefined]) {
    const r = validateCreateQuoteVersionFromCalculation({
      calculation_id: UUID_A,
      attachment_file_ids: v,
    });
    assert.equal(r.ok, true, `attachment_file_ids=${String(v)} must be optional`);
    if (!r.ok) return;
    assert.deepEqual(r.data.attachment_file_ids, []);
  }
});

test("attachment_file_ids: an explicit EMPTY array is accepted (no attachments)", () => {
  const r = validateCreateQuoteVersionFromCalculation({
    calculation_id: UUID_A,
    attachment_file_ids: [],
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.data.attachment_file_ids, []);
});

test("[VALIDATION_FAILED] a non-record raw value is rejected (never crashes)", () => {
  for (const raw of [null, undefined, 42, "x", true, [] as unknown]) {
    const r = validateCreateQuoteVersionFromCalculation(raw);
    assert.equal(r.ok, false, `non-record ${String(raw)} must fail`);
    if (r.ok) return;
    assert.equal(r.code, "VALIDATION_FAILED");
  }
});

test("[VALIDATION_FAILED] a missing / non-uuid calculation_id is rejected", () => {
  const bad = [
    {},
    { calculation_id: null },
    { calculation_id: 123 },
    { calculation_id: "not-a-uuid" },
    { calculation_id: "1111" },
    // A too-long value (a uuid with trailing junk) fails the length + regex guard.
    { calculation_id: `${UUID_A}-extra` },
    // Empty string.
    { calculation_id: "" },
  ];
  for (const raw of bad) {
    const r = validateCreateQuoteVersionFromCalculation(raw);
    assert.equal(r.ok, false, `calculation_id ${JSON.stringify(raw)} must fail`);
  }
});

test("[VALIDATION_FAILED] a non-array / non-uuid-element / over-bounded attachment list is rejected", () => {
  const cases: unknown[] = [
    { calculation_id: UUID_A, attachment_file_ids: "not-an-array" },
    { calculation_id: UUID_A, attachment_file_ids: 7 },
    { calculation_id: UUID_A, attachment_file_ids: {} },
    // A non-uuid element anywhere fails the whole list.
    { calculation_id: UUID_A, attachment_file_ids: [UUID_A, "bad"] },
    { calculation_id: UUID_A, attachment_file_ids: [123] },
    { calculation_id: UUID_A, attachment_file_ids: [null] },
    // Over the 100-element bound.
    {
      calculation_id: UUID_A,
      attachment_file_ids: Array.from({ length: 101 }, () => UUID_B),
    },
  ];
  for (const raw of cases) {
    const r = validateCreateQuoteVersionFromCalculation(raw);
    assert.equal(r.ok, false, `attachment list ${JSON.stringify(raw)} must fail`);
  }
});

test("EXACTLY 100 attachment ids is at the bound (accepted); 101 is over (rejected)", () => {
  const at = validateCreateQuoteVersionFromCalculation({
    calculation_id: UUID_A,
    attachment_file_ids: Array.from({ length: 100 }, () => UUID_B),
  });
  assert.equal(at.ok, true, "100 is the inclusive bound");
  const over = validateCreateQuoteVersionFromCalculation({
    calculation_id: UUID_A,
    attachment_file_ids: Array.from({ length: 101 }, () => UUID_B),
  });
  assert.equal(over.ok, false, "101 exceeds the bound");
});

test("a client-supplied tenant_id is STRIPPED — never surfaced on the validated data", () => {
  const r = validateCreateQuoteVersionFromCalculation({
    calculation_id: UUID_A,
    tenant_id: "99999999-9999-9999-9999-999999999999",
    attachment_file_ids: [UUID_A],
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // The resolved membership is the only tenant authority — the validated payload carries
  // ONLY the calc id + attachment ids; a smuggled tenant_id does not appear.
  assert.ok(
    !("tenant_id" in (r.data as unknown as Record<string, unknown>)),
    "validated data must NOT carry a client-supplied tenant_id",
  );
  assert.deepEqual(Object.keys(r.data).sort(), [
    "attachment_file_ids",
    "calculation_id",
  ]);
});

test("the validated attachment array is a COPY (a later mutation of the raw input can't reach it)", () => {
  const rawIds = [UUID_A, UUID_B];
  const r = validateCreateQuoteVersionFromCalculation({
    calculation_id: UUID_A,
    attachment_file_ids: rawIds,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // Mutating the caller's array AFTER validation must not change the validated value.
  rawIds.push("33333333-3333-3333-3333-333333333333");
  assert.equal(r.data.attachment_file_ids.length, 2);
});

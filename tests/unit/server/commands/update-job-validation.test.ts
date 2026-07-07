/**
 * Story 7.3 — PURE input-validator coverage for the `updateJob` allowed-edit command (7.3-INT-02
 * shape half; test-design-epic-7.md 7.3 rows). `validateUpdateJob` is the input-shape guard the
 * envelope runs BEFORE any DB access (architecture §5 step 4) for the LIVE 7.3 edit path. Pure (no
 * I/O), so this fast `node --test` gate protects every branch WITHOUT a database (the DB-backed INT
 * suite proves the audited persistence + tenant isolation and SKIPS when the local stack is down).
 *
 * The load-bearing rules (kept in lockstep with validation.ts):
 *   - `id` REQUIRED + UUID-shaped;
 *   - the ONLY editable fields are `title` / `status` / `planned_start_date` / `planned_end_date`;
 *   - ANY key outside that allow-list (an immutable/commitment field like `quote_version_id` /
 *     `quote_acceptance_id` / `customer_id` / `accepted_price_ore` / `evidence_*` / `accepted_at` /
 *     `channel` / `tenant_id`) ⇒ VALIDATION_FAILED (a hard "unknown field" reject — a client cannot
 *     smuggle an immutable field; AC4);
 *   - `status` MUST be in the closed `created|in_progress|done|cancelled` set (a field-worker state is
 *     rejected); planned dates must be ISO `YYYY-MM-DD`; an id-only input is VALID (the empty-patch
 *     no-op the command short-circuits).
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock.
 *
 * [Source: src/server/commands/jobs/validation.ts (validateUpdateJob); story 7.3 AC4 + Task 4.1;
 *  test-design-epic-7.md#7.3-INT-02]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateUpdateJob } from "@/server/commands/jobs/validation";

const UUID = "11111111-1111-1111-1111-111111111111";

test("7.3-INT-02(shape): an id-only input is VALID (the empty-patch no-op)", () => {
  const r = validateUpdateJob({ id: UUID });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.data, { id: UUID });
});

test("7.3-INT-02(shape): title / status / planned dates all validate and narrow", () => {
  const r = validateUpdateJob({
    id: UUID,
    title: "  Nytt jobb  ",
    status: "in_progress",
    planned_start_date: "2026-08-01",
    planned_end_date: "2026-08-15",
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.title, "Nytt jobb"); // trimmed
    assert.equal(r.data.status, "in_progress");
    assert.equal(r.data.planned_start_date, "2026-08-01");
    assert.equal(r.data.planned_end_date, "2026-08-15");
  }
});

test("7.3-INT-02(shape): a missing/invalid id ⇒ VALIDATION_FAILED", () => {
  assert.equal(validateUpdateJob({ title: "x" }).ok, false);
  assert.equal(validateUpdateJob({ id: "not-a-uuid", title: "x" }).ok, false);
  assert.equal(validateUpdateJob(null).ok, false);
  assert.equal(validateUpdateJob("nope").ok, false);
});

test("7.3-INT-02(shape): EVERY immutable/commitment field is rejected (unknown key ⇒ VALIDATION_FAILED)", () => {
  for (const key of [
    "quote_version_id",
    "quote_acceptance_id",
    "customer_id",
    "accepted_price_ore",
    "source_sent_total_ore",
    "evidence_file_id",
    "evidence_reference",
    "accepted_at",
    "channel",
    "tenant_id",
    "archived_at",
  ]) {
    const r = validateUpdateJob({ id: UUID, [key]: "x" });
    assert.equal(
      r.ok,
      false,
      `expected the immutable field "${key}" to be rejected as an unknown key`,
    );
  }
});

test("7.3-INT-02(shape): a status outside the closed set ⇒ VALIDATION_FAILED (no field-worker states)", () => {
  for (const bad of ["dispatched", "scheduled", "on_site", "shipped", ""]) {
    assert.equal(
      validateUpdateJob({ id: UUID, status: bad }).ok,
      false,
      `expected status "${bad}" to be rejected`,
    );
  }
});

test("7.3-INT-02(shape): a malformed planned date ⇒ VALIDATION_FAILED", () => {
  assert.equal(validateUpdateJob({ id: UUID, planned_start_date: "01/08/2026" }).ok, false);
  assert.equal(validateUpdateJob({ id: UUID, planned_end_date: "2026-13-40" }).ok, false);
  assert.equal(validateUpdateJob({ id: UUID, planned_start_date: "not-a-date" }).ok, false);
});

test("7.3-INT-02(shape): an empty title / null date is an explicit clear (kept as null)", () => {
  const r = validateUpdateJob({ id: UUID, title: "   ", planned_end_date: null });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.title, null);
    assert.equal(r.data.planned_end_date, null);
  }
});

test("7.3-INT-02(shape): an INVERTED planned window (end before start) ⇒ VALIDATION_FAILED (epic-7 review fix)", () => {
  assert.equal(
    validateUpdateJob({
      id: UUID,
      planned_start_date: "2026-08-15",
      planned_end_date: "2026-08-01",
    }).ok,
    false,
    "an end date before the start date must be rejected as an ordering violation",
  );
});

test("7.3-INT-02(shape): equal / ordered planned dates are ACCEPTED; a lone date has no ordering to enforce", () => {
  // end == start is allowed (a single-day window).
  assert.equal(
    validateUpdateJob({
      id: UUID,
      planned_start_date: "2026-08-01",
      planned_end_date: "2026-08-01",
    }).ok,
    true,
  );
  // end after start is allowed.
  assert.equal(
    validateUpdateJob({
      id: UUID,
      planned_start_date: "2026-08-01",
      planned_end_date: "2026-08-02",
    }).ok,
    true,
  );
  // Only one date present (or one cleared) ⇒ no ordering to enforce.
  assert.equal(validateUpdateJob({ id: UUID, planned_end_date: "2026-08-01" }).ok, true);
  assert.equal(
    validateUpdateJob({ id: UUID, planned_start_date: "2026-08-15", planned_end_date: null }).ok,
    true,
  );
});

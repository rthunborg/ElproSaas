/**
 * Standalone job creation (owner decision 2026-07-14; spec `spec-list-page-create-entry-points.md`)
 * — PURE input-validator coverage for the `createJob` command. `validateCreateJob` is the
 * input-shape guard the envelope runs BEFORE any DB access (architecture §5 step 4) for the LIVE
 * "Skapa nytt jobb" list-page path. Pure (no I/O), so this fast `node --test` gate protects every
 * branch WITHOUT a database (the DB-backed INT suite proves the audited persistence + tenant
 * isolation and SKIPS when the local stack is down).
 *
 * The load-bearing rules (kept in lockstep with validation.ts):
 *   - `customer_id` REQUIRED + UUID-shaped;
 *   - the ONLY optional fields are `title` / `planned_start_date` / `planned_end_date`;
 *   - ANY key outside that allow-list (a source ref like `quote_version_id` /
 *     `quote_acceptance_id`, a client-set `status`, `tenant_id`, a money field) ⇒
 *     VALIDATION_FAILED (a hard "unknown field" reject — a standalone job is born with NULL
 *     source refs and status 'created', both server-derived);
 *   - planned dates must be ISO `YYYY-MM-DD`; an inverted window (end < start) is rejected
 *     (the SAME ordering rule as validateUpdateJob — the spec I/O matrix's inverted-dates row).
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock.
 *
 * [Source: src/server/commands/jobs/validation.ts (validateCreateJob); spec I/O matrix;
 *  tests/unit/server/commands/update-job-validation.test.ts (the sibling pattern)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCreateJob } from "@/server/commands/jobs/validation";

const UUID = "22222222-2222-2222-2222-222222222222";

test("createJob(shape): a customer-only input is VALID (title/dates optional)", () => {
  const r = validateCreateJob({ customer_id: UUID });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.data, { customer_id: UUID });
});

test("createJob(shape): customer + title + planned dates all validate and narrow", () => {
  const r = validateCreateJob({
    customer_id: UUID,
    title: "  Nytt fristående jobb  ",
    planned_start_date: "2026-08-01",
    planned_end_date: "2026-08-15",
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.customer_id, UUID);
    assert.equal(r.data.title, "Nytt fristående jobb"); // trimmed
    assert.equal(r.data.planned_start_date, "2026-08-01");
    assert.equal(r.data.planned_end_date, "2026-08-15");
  }
});

test("createJob(shape): a missing/invalid customer_id ⇒ VALIDATION_FAILED", () => {
  assert.equal(validateCreateJob({}).ok, false);
  assert.equal(validateCreateJob({ title: "x" }).ok, false);
  assert.equal(validateCreateJob({ customer_id: "not-a-uuid" }).ok, false);
  assert.equal(validateCreateJob({ customer_id: null }).ok, false);
  assert.equal(validateCreateJob(null).ok, false);
  assert.equal(validateCreateJob("nope").ok, false);
});

test("createJob(shape): EVERY source-ref / commitment / server-derived field is rejected (unknown key ⇒ VALIDATION_FAILED)", () => {
  for (const key of [
    "id",
    "quote_version_id",
    "quote_acceptance_id",
    "status",
    "accepted_price_ore",
    "source_sent_total_ore",
    "evidence_file_id",
    "evidence_reference",
    "accepted_at",
    "channel",
    "tenant_id",
    "archived_at",
    "facility_id",
    "contact_id",
  ]) {
    const r = validateCreateJob({ customer_id: UUID, [key]: "x" });
    assert.equal(
      r.ok,
      false,
      `expected the field "${key}" to be rejected as an unknown key`,
    );
  }
});

test("createJob(shape): a malformed planned date ⇒ VALIDATION_FAILED", () => {
  assert.equal(
    validateCreateJob({ customer_id: UUID, planned_start_date: "01/08/2026" }).ok,
    false,
  );
  assert.equal(
    validateCreateJob({ customer_id: UUID, planned_end_date: "2026-13-40" }).ok,
    false,
  );
  assert.equal(
    validateCreateJob({ customer_id: UUID, planned_start_date: "not-a-date" }).ok,
    false,
  );
});

test("createJob(shape): an INVERTED planned window (end before start) ⇒ VALIDATION_FAILED (I/O matrix)", () => {
  assert.equal(
    validateCreateJob({
      customer_id: UUID,
      planned_start_date: "2026-08-15",
      planned_end_date: "2026-08-01",
    }).ok,
    false,
    "an end date before the start date must be rejected as an ordering violation",
  );
});

test("createJob(shape): equal / ordered planned dates are ACCEPTED; a lone date has no ordering to enforce", () => {
  // end == start is allowed (a single-day window).
  assert.equal(
    validateCreateJob({
      customer_id: UUID,
      planned_start_date: "2026-08-01",
      planned_end_date: "2026-08-01",
    }).ok,
    true,
  );
  // end after start is allowed.
  assert.equal(
    validateCreateJob({
      customer_id: UUID,
      planned_start_date: "2026-08-01",
      planned_end_date: "2026-08-02",
    }).ok,
    true,
  );
  // Only one date present ⇒ no ordering to enforce.
  assert.equal(
    validateCreateJob({ customer_id: UUID, planned_end_date: "2026-08-01" }).ok,
    true,
  );
});

test("createJob(shape): an empty/whitespace title collapses to null; an overlong title is rejected", () => {
  const r = validateCreateJob({ customer_id: UUID, title: "   " });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.title, null);
  const r2 = validateCreateJob({ customer_id: UUID, title: null });
  assert.equal(r2.ok, true);
  if (r2.ok) assert.equal(r2.data.title, null);
  assert.equal(
    validateCreateJob({ customer_id: UUID, title: "x".repeat(257) }).ok,
    false,
  );
});

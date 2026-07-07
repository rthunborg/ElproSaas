/**
 * Story 7.2 — PURE input-validator + RPC-result-extractor coverage for the accept-and-create-job
 * command (7.2-INT-05 shape half + 7.2-INT-01/02 result-parse half; test-design-epic-7.md 7.2 rows).
 *
 * `validateAcceptQuoteAndCreateJob` is the input-shape guard the envelope runs BEFORE any DB access
 * (architecture §5 step 4) for the LIVE Story 7.2 accept path. It EXTENDS the 7.1 capture shape with
 * an optional job `title` + a TEST-ONLY `__faultInject` closed-set field (the atomicity/rollback
 * hook). It is pure (no I/O), so this fast `node --test` gate protects every branch WITHOUT a
 * database (the DB-backed INT suite proves the transaction behaviour and SKIPS when the local stack
 * is unreachable).
 *
 * `extractAcceptAndCreateJobResult` is the pure coercion of the RPC's returned single row (which raw
 * pg / PostgREST can return as a single object OR a one-row array, and `was_existing` as a boolean OR
 * a string) into the typed `{ acceptanceId, jobId, wasExisting }` shape — pinned here without a DB.
 *
 * The load-bearing rules (kept in lockstep with validation.ts / quote-db.ts):
 *   - `quote_version_id` REQUIRED + UUID-shaped; `accepted_price_ore` REQUIRED + canonical öre;
 *     `accepted_at` REQUIRED + ISO instant (H1); optional channel/reason/evidence/notes/planned dates
 *     + an optional `title` (≤2000 chars); tenant_id / accepted user / source total / status NEVER read;
 *   - `__faultInject` is TEST-ONLY: an explicit value MUST be a known boundary (`job-insert` /
 *     `event-write`) — a stray value ⇒ VALIDATION_FAILED (it is never reachable through the action).
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock. Öre < 10 digits (R-717).
 *
 * [Source: src/server/commands/quotes/validation.ts (validateAcceptQuoteAndCreateJob);
 *  src/server/commands/quotes/quote-db.ts (extractAcceptAndCreateJobResult); story 7.2 Task 2.1 + 3;
 *  test-design-epic-7.md#7.2-INT-01/02/05]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ORE_AMOUNT_MAX } from "@/lib/money/ore";
import { validateAcceptQuoteAndCreateJob } from "@/server/commands/quotes/validation";
import { extractAcceptAndCreateJobResult } from "@/server/commands/quotes/quote-db";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";
const UUID_FILE = "33333333-3333-3333-3333-333333333333";
const ACCEPTED_ISO = "2026-07-10T08:30:00.000Z";
const ACCEPTED_PRICE_ORE = 125_000; // < 10 digits (R-717)

function base(): Record<string, unknown> {
  return {
    quote_version_id: UUID_A,
    accepted_price_ore: ACCEPTED_PRICE_ORE,
    accepted_at: ACCEPTED_ISO,
  };
}

// ── Happy path ───────────────────────────────────────────────────────────────────────────────

test("[7.2] accepts the required-fields-only input (all optional fields absent, none carried)", () => {
  const r = validateAcceptQuoteAndCreateJob(base());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(
    Object.keys(r.data).sort(),
    ["accepted_at", "accepted_price_ore", "quote_version_id"],
  );
});

test("[7.2] accepts a fully-populated accept (title + channel/reason/evidence/notes/planned dates)", () => {
  const r = validateAcceptQuoteAndCreateJob({
    ...base(),
    title: "Jobb från accepterad offert",
    channel: "email",
    adjustment_reason: "kundrabatt",
    evidence_file_id: UUID_FILE,
    evidence_reference: "kundmail 4711",
    notes: "kundens bekräftelse",
    planned_start_date: "2026-07-15T00:00:00.000Z",
    planned_end_date: "2026-07-20T00:00:00.000Z",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.title, "Jobb från accepterad offert");
  assert.equal(r.data.channel, "email");
  assert.equal(r.data.evidence_file_id, UUID_FILE);
});

test("[7.2] accepts accepted_price_ore at 0 and at exactly ORE_AMOUNT_MAX (the öre boundaries)", () => {
  assert.equal(validateAcceptQuoteAndCreateJob({ ...base(), accepted_price_ore: 0 }).ok, true);
  assert.equal(
    validateAcceptQuoteAndCreateJob({ ...base(), accepted_price_ore: ORE_AMOUNT_MAX }).ok,
    true,
  );
});

// ── TEST-ONLY __faultInject closed-set guard ───────────────────────────────────────────────────

test("[7.2] accepts a KNOWN __faultInject boundary; carries it through", () => {
  for (const point of ["job-insert", "event-write"]) {
    const r = validateAcceptQuoteAndCreateJob({ ...base(), __faultInject: point });
    assert.equal(r.ok, true, `${point} must be a known fault-injection boundary`);
    if (!r.ok) return;
    assert.equal(r.data.__faultInject, point);
  }
});

test("[7.2 VALIDATION_FAILED] a STRAY __faultInject value is rejected (never a passthrough)", () => {
  for (const bad of ["nope", "commit", 5, true]) {
    const r = validateAcceptQuoteAndCreateJob({ ...base(), __faultInject: bad });
    assert.equal(r.ok, false, `__faultInject ${JSON.stringify(bad)} must fail`);
  }
});

// ── Required-field + öre + instant negatives (mirror the 7.1 validator) ─────────────────────────

test("[7.2 VALIDATION_FAILED] a non-record / missing-required-field input is rejected", () => {
  for (const raw of [null, undefined, 42, "x", [] as unknown, {}, { ...base(), quote_version_id: "x" }]) {
    const r = validateAcceptQuoteAndCreateJob(raw);
    assert.equal(r.ok, false, `${JSON.stringify(raw)} must fail`);
  }
});

test("[7.2 VALIDATION_FAILED] a non-canonical accepted_price_ore is rejected", () => {
  for (const bad of [125_000.5, -1, Number.NaN, ORE_AMOUNT_MAX + 1, "125000", {}]) {
    const r = validateAcceptQuoteAndCreateJob({ ...base(), accepted_price_ore: bad });
    assert.equal(r.ok, false, `accepted_price_ore ${JSON.stringify(bad)} must fail`);
  }
});

test("[7.2 VALIDATION_FAILED] a missing / garbage accepted_at is rejected (H1)", () => {
  for (const bad of [undefined, null, "", "not-a-date", 1_752_000_000_000]) {
    const r = validateAcceptQuoteAndCreateJob({ ...base(), accepted_at: bad });
    assert.equal(r.ok, false, `accepted_at ${JSON.stringify(bad)} must fail`);
  }
});

test("[7.2 VALIDATION_FAILED] an over-length title is rejected", () => {
  const r = validateAcceptQuoteAndCreateJob({ ...base(), title: "z".repeat(2001) });
  assert.equal(r.ok, false);
});

test("[7.2 VALIDATION_FAILED] an INVERTED planned window (end before start) is rejected (epic-7 review fix)", () => {
  assert.equal(
    validateAcceptQuoteAndCreateJob({
      ...base(),
      planned_start_date: "2026-07-20T00:00:00.000Z",
      planned_end_date: "2026-07-15T00:00:00.000Z",
    }).ok,
    false,
  );
  // Equal / ordered windows are accepted.
  assert.equal(
    validateAcceptQuoteAndCreateJob({
      ...base(),
      planned_start_date: "2026-07-15T00:00:00.000Z",
      planned_end_date: "2026-07-15T00:00:00.000Z",
    }).ok,
    true,
  );
});

// ── Smuggled server-resolved keys are stripped ──────────────────────────────────────────────────

test("[7.2] a client-supplied tenant_id / source total / status / job id is STRIPPED", () => {
  const r = validateAcceptQuoteAndCreateJob({
    ...base(),
    tenant_id: "99999999-9999-9999-9999-999999999999",
    source_sent_total_ore: 999_999,
    status: "accepted",
    job_id: UUID_B,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const asRecord = r.data as unknown as Record<string, unknown>;
  for (const smuggled of ["tenant_id", "source_sent_total_ore", "status", "job_id"]) {
    assert.equal(smuggled in asRecord, false, `smuggled key "${smuggled}" must be stripped`);
  }
});

// ── extractAcceptAndCreateJobResult — the pure RPC-row coercion ─────────────────────────────────

test("[7.2] extractAcceptAndCreateJobResult parses a one-row array (fresh accept, was_existing=false)", () => {
  const parsed = extractAcceptAndCreateJobResult([
    { acceptance_id: UUID_A, job_id: UUID_B, was_existing: false },
  ]);
  assert.deepEqual(parsed, { acceptanceId: UUID_A, jobId: UUID_B, wasExisting: false });
});

test("[7.2] extractAcceptAndCreateJobResult parses a single object (idempotent re-entry, was_existing=true)", () => {
  const parsed = extractAcceptAndCreateJobResult({
    acceptance_id: UUID_A,
    job_id: UUID_B,
    was_existing: true,
  });
  assert.deepEqual(parsed, { acceptanceId: UUID_A, jobId: UUID_B, wasExisting: true });
});

test("[7.2] extractAcceptAndCreateJobResult coerces a STRING was_existing ('true' → true)", () => {
  const parsed = extractAcceptAndCreateJobResult([
    { acceptance_id: UUID_A, job_id: UUID_B, was_existing: "true" },
  ]);
  assert.equal(parsed?.wasExisting, true);
});

test("[7.2] extractAcceptAndCreateJobResult returns null on a malformed / empty row", () => {
  for (const bad of [null, undefined, [], {}, [{ acceptance_id: 5, job_id: UUID_B }], "x"]) {
    assert.equal(extractAcceptAndCreateJobResult(bad), null, `${JSON.stringify(bad)} → null`);
  }
});

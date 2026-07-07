/**
 * Story 7.1 — PURE input-validator coverage for `validateCaptureQuoteAcceptance`
 * (AC1/AC2/AC5; test-design-epic-7.md #7.1-INT-02..05, R-705/R-717 — the fast-gate coverage
 * EXPANSION for the acceptance-capture command's input-shape guard).
 *
 * `validateCaptureQuoteAcceptance` is the input-shape guard the command envelope runs BEFORE any
 * DB access (architecture §5 step 4) for the Story 7.1 acceptance-capture path. It is pure (no
 * I/O), so the fast `node --test` gate can protect its branches WITHOUT a database — the DB-backed
 * INT suite (`capture-quote-acceptance.int.test.ts`) proves the load-bearing sent-state / adjusted-
 * price / öre-persistence / cross-tenant behaviour and SKIPS when the local stack is unreachable,
 * so the shape rules were previously only exercised (skippably, and non-exhaustively) through that
 * suite. THIS suite pins every reject branch cheaply and unconditionally, closing the one remaining
 * validator gap (every sibling quote validator — mark-sent, update-draft, generate-pdf,
 * create-new-version — already has a dedicated unit test; the 7.1 acceptance validator did not).
 *
 * The load-bearing rules (kept in lockstep with `src/server/commands/quotes/validation.ts`):
 *   - `quote_version_id` is REQUIRED and UUID-shaped (a value the DB would reject as `22P02` fails
 *     as VALIDATION here, not as an opaque server error);
 *   - `accepted_price_ore` is REQUIRED and a CANONICAL integer öre (`isOreAmount` / `ORE_AMOUNT_MAX`
 *     — one authority, no fork): a float / negative / NaN / ∞ / overflow / non-number ⇒ VALIDATION,
 *     never a silently-wrong persisted price (money impact HIGH, AC5);
 *   - `accepted_at` is REQUIRED and a real ISO instant (H1 determinism — the accepted moment is an
 *     EXPLICIT input, never derived from a wall-clock; a missing/garbage instant ⇒ VALIDATION);
 *   - `channel` / `adjustment_reason` / `evidence_reference` / `notes` are OPTIONAL free-text
 *     (≤2000 chars, nullable); `evidence_file_id` is an OPTIONAL UUID-shaped id; `planned_start_date`
 *     / `planned_end_date` are OPTIONAL ISO instants — an absent field is omitted from the validated
 *     data; a PRESENT `null` is carried through as an explicit "not supplied";
 *   - a client-supplied `tenant_id` / accepted user / `source_sent_total_ore` / `status` is NEVER
 *     read (the tenant is the RESOLVED tenant, the accepted user is the resolved session user, the
 *     source sent total is loaded server-side from the FROZEN version row, and the adjusted-price
 *     REASON gate is a SERVER-SIDE re-validation) — so smuggled keys must not appear on the
 *     validated data.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock. Öre values kept
 * < 10 digits in every non-boundary case (the orgnr-scan boundary, R-717).
 * Mirrors `tests/unit/server/commands/mark-quote-version-sent-validation.test.ts`.
 *
 * [Source: src/server/commands/quotes/validation.ts (validateCaptureQuoteAcceptance + the
 *  ACCEPTANCE_TEXT_MAX=2000 bound + the isOreAmount öre-shape guard + the field-presence semantics);
 *  src/server/commands/quotes/accept.ts (only the shaped input is read; tenant/user/source total/
 *  clock are server-resolved); src/lib/money/ore.ts (isOreAmount / ORE_AMOUNT_MAX — the canonical
 *  öre authority); story 7.1 Task 4.1 + AC1/AC2/AC5; test-design-epic-7.md#7.1-INT-02..05]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ORE_AMOUNT_MAX } from "@/lib/money/ore";
import { validateCaptureQuoteAcceptance } from "@/server/commands/quotes/validation";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_FILE = "22222222-2222-2222-2222-222222222222";
const UUID_UPPER = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";
const ACCEPTED_ISO = "2026-07-09T08:30:00.000Z";
const ACCEPTED_PRICE_ORE = 125_000; // < 10 digits (R-717)

/** A minimal valid input: the three required fields only. */
function base(): Record<string, unknown> {
  return {
    quote_version_id: UUID_A,
    accepted_price_ore: ACCEPTED_PRICE_ORE,
    accepted_at: ACCEPTED_ISO,
  };
}

// ── Happy path ───────────────────────────────────────────────────────────────────────────────

test("[7.1] accepts the required-fields-only input (all optional fields absent, none carried)", () => {
  const r = validateCaptureQuoteAcceptance(base());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.quote_version_id, UUID_A);
  assert.equal(r.data.accepted_price_ore, ACCEPTED_PRICE_ORE);
  assert.equal(r.data.accepted_at, ACCEPTED_ISO);
  // No optional field supplied → only the three required keys appear on the validated data.
  assert.deepEqual(
    Object.keys(r.data).sort(),
    ["accepted_at", "accepted_price_ore", "quote_version_id"],
  );
});

test("[7.1] accepts an UPPERCASE (case-insensitive) uuid quote_version_id and evidence_file_id", () => {
  const r = validateCaptureQuoteAcceptance({
    ...base(),
    quote_version_id: UUID_UPPER,
    evidence_file_id: UUID_UPPER,
  });
  assert.equal(r.ok, true, "the uuid check is case-insensitive");
});

test("[7.1] accepts a fully-populated capture (channel/reason/evidence/notes/planned dates)", () => {
  const r = validateCaptureQuoteAcceptance({
    ...base(),
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
  assert.equal(r.data.channel, "email");
  assert.equal(r.data.adjustment_reason, "kundrabatt");
  assert.equal(r.data.evidence_file_id, UUID_FILE);
  assert.equal(r.data.evidence_reference, "kundmail 4711");
  assert.equal(r.data.notes, "kundens bekräftelse");
  assert.equal(r.data.planned_start_date, "2026-07-15T00:00:00.000Z");
  assert.equal(r.data.planned_end_date, "2026-07-20T00:00:00.000Z");
});

test("[7.1] accepts accepted_price_ore = 0 (a canonical öre value — the zero-price boundary)", () => {
  const r = validateCaptureQuoteAcceptance({ ...base(), accepted_price_ore: 0 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.accepted_price_ore, 0);
});

test("[7.1] accepts accepted_price_ore at EXACTLY ORE_AMOUNT_MAX (the öre ceiling)", () => {
  const r = validateCaptureQuoteAcceptance({ ...base(), accepted_price_ore: ORE_AMOUNT_MAX });
  assert.equal(r.ok, true, "ORE_AMOUNT_MAX is the inclusive canonical öre ceiling");
});

// ── FIELD-PRESENCE semantics (absent = omitted; present null = explicit "not supplied") ────────

test("[7.1] a PRESENT null optional field is carried through; an ABSENT one is omitted", () => {
  const r = validateCaptureQuoteAcceptance({
    ...base(),
    channel: null,
    // adjustment_reason / evidence_* / notes / planned_* are ABSENT — must NOT appear.
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal("channel" in r.data, true);
  assert.equal(r.data.channel, null);
  for (const absent of [
    "adjustment_reason",
    "evidence_file_id",
    "evidence_reference",
    "notes",
    "planned_start_date",
    "planned_end_date",
  ]) {
    assert.equal(absent in r.data, false, `absent field "${absent}" must be omitted`);
  }
});

// ── [VALIDATION_FAILED] non-record / required-field negatives ───────────────────────────────────

test("[7.1 VALIDATION_FAILED] a non-record raw value is rejected (never crashes)", () => {
  for (const raw of [null, undefined, 42, "x", true, [] as unknown]) {
    const r = validateCaptureQuoteAcceptance(raw);
    assert.equal(r.ok, false, `non-record ${String(raw)} must fail`);
    if (r.ok) return;
    assert.equal(r.code, "VALIDATION_FAILED");
  }
});

test("[7.1 VALIDATION_FAILED] a missing / non-uuid quote_version_id is rejected", () => {
  const bad = [
    { accepted_price_ore: ACCEPTED_PRICE_ORE, accepted_at: ACCEPTED_ISO },
    { ...base(), quote_version_id: null },
    { ...base(), quote_version_id: 123 },
    { ...base(), quote_version_id: "not-a-uuid" },
    { ...base(), quote_version_id: "1111" },
    { ...base(), quote_version_id: `${UUID_A}-extra` },
    { ...base(), quote_version_id: "" },
  ];
  for (const raw of bad) {
    const r = validateCaptureQuoteAcceptance(raw);
    assert.equal(r.ok, false, `quote_version_id ${JSON.stringify(raw)} must fail`);
  }
});

// ── [VALIDATION_FAILED] accepted_price_ore öre-shape (money impact HIGH, AC5) ───────────────────

test("[7.1 VALIDATION_FAILED] a non-canonical accepted_price_ore is rejected by isOreAmount", () => {
  const bad = [
    { ...base(), accepted_price_ore: undefined },
    { ...base(), accepted_price_ore: null },
    { ...base(), accepted_price_ore: 125_000.5 }, // float öre
    { ...base(), accepted_price_ore: -1 }, // negative öre
    { ...base(), accepted_price_ore: Number.NaN },
    { ...base(), accepted_price_ore: Number.POSITIVE_INFINITY },
    { ...base(), accepted_price_ore: ORE_AMOUNT_MAX + 1 }, // over the öre ceiling
    { ...base(), accepted_price_ore: "125000" }, // string, not a number
    { ...base(), accepted_price_ore: {} },
  ];
  for (const raw of bad) {
    const r = validateCaptureQuoteAcceptance(raw);
    assert.equal(r.ok, false, `accepted_price_ore ${JSON.stringify(raw.accepted_price_ore)} must fail`);
    if (r.ok) return;
    assert.equal(r.code, "VALIDATION_FAILED");
  }
});

// ── [VALIDATION_FAILED] accepted_at explicit-instant (H1 determinism) ──────────────────────────

test("[7.1 VALIDATION_FAILED] a missing / garbage accepted_at instant is rejected (H1)", () => {
  const bad = [
    { ...base(), accepted_at: undefined },
    { ...base(), accepted_at: null },
    { ...base(), accepted_at: "" },
    { ...base(), accepted_at: "not-a-date" },
    { ...base(), accepted_at: 1_752_000_000_000 }, // a number epoch is not the ISO string shape
    { ...base(), accepted_at: "x".repeat(41) }, // over the 40-char instant bound
  ];
  for (const raw of bad) {
    const r = validateCaptureQuoteAcceptance(raw);
    assert.equal(r.ok, false, `accepted_at ${JSON.stringify(raw.accepted_at)} must fail`);
  }
});

// ── [VALIDATION_FAILED] optional-field shape negatives ─────────────────────────────────────────

test("[7.1 VALIDATION_FAILED] a non-string / over-length free-text optional field is rejected", () => {
  const over = "z".repeat(2001); // over the ACCEPTANCE_TEXT_MAX=2000 bound
  const cases: unknown[] = [
    { ...base(), channel: 5 },
    { ...base(), channel: over },
    { ...base(), adjustment_reason: {} },
    { ...base(), adjustment_reason: over },
    { ...base(), evidence_reference: [] },
    { ...base(), evidence_reference: over },
    { ...base(), notes: true },
    { ...base(), notes: over },
  ];
  for (const raw of cases) {
    const r = validateCaptureQuoteAcceptance(raw);
    assert.equal(r.ok, false, `optional free-text ${JSON.stringify(raw)} must fail`);
  }
});

test("[7.1 VALIDATION_FAILED] a non-uuid evidence_file_id is rejected (but null/absent is fine)", () => {
  for (const bad of ["not-a-uuid", 123, "1111", `${UUID_A}-extra`]) {
    const r = validateCaptureQuoteAcceptance({ ...base(), evidence_file_id: bad });
    assert.equal(r.ok, false, `evidence_file_id ${JSON.stringify(bad)} must fail`);
  }
  // null and absent are BOTH valid (evidence is optional).
  assert.equal(validateCaptureQuoteAcceptance({ ...base(), evidence_file_id: null }).ok, true);
  assert.equal(validateCaptureQuoteAcceptance(base()).ok, true);
});

test("[7.1 VALIDATION_FAILED] a non-ISO / over-bound planned_start_date / planned_end_date is rejected", () => {
  const cases: unknown[] = [
    { ...base(), planned_start_date: "not-a-date" },
    { ...base(), planned_start_date: 5 },
    { ...base(), planned_start_date: "x".repeat(41) },
    { ...base(), planned_end_date: "nope" },
    { ...base(), planned_end_date: {} },
  ];
  for (const raw of cases) {
    const r = validateCaptureQuoteAcceptance(raw);
    assert.equal(r.ok, false, `planned date ${JSON.stringify(raw)} must fail`);
  }
  // null planned dates are valid ("not set").
  assert.equal(
    validateCaptureQuoteAcceptance({ ...base(), planned_start_date: null, planned_end_date: null }).ok,
    true,
  );
});

test("[7.1 VALIDATION_FAILED] an INVERTED planned window (end before start) is rejected (epic-7 review fix)", () => {
  // Both present but end < start ⇒ a nonsensical planning window that would persist on the
  // acceptance AND the job.
  assert.equal(
    validateCaptureQuoteAcceptance({
      ...base(),
      planned_start_date: "2026-07-20T00:00:00.000Z",
      planned_end_date: "2026-07-15T00:00:00.000Z",
    }).ok,
    false,
  );
  // Equal (single-day) and ordered windows are accepted.
  assert.equal(
    validateCaptureQuoteAcceptance({
      ...base(),
      planned_start_date: "2026-07-15T00:00:00.000Z",
      planned_end_date: "2026-07-15T00:00:00.000Z",
    }).ok,
    true,
  );
});

// ── Acceptance scope: server-resolved / smuggled keys are never carried ─────────────────────────

test("[7.1] a client-supplied tenant_id / accepted user / source total / status is STRIPPED", () => {
  const r = validateCaptureQuoteAcceptance({
    ...base(),
    channel: "email",
    // Smuggled keys the acceptance path must NEVER accept — the tenant is the RESOLVED tenant, the
    // accepted user is the resolved session user, the source sent total is loaded server-side from
    // the FROZEN version row, and status is server-owned.
    tenant_id: "99999999-9999-9999-9999-999999999999",
    accepted_by: "88888888-8888-8888-8888-888888888888",
    source_sent_total_ore: 999_999,
    status: "accepted",
    quote_id: "77777777-7777-7777-7777-777777777777",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // ONLY the required fields + the supplied optional field survive; every smuggled key is dropped.
  assert.deepEqual(
    Object.keys(r.data).sort(),
    ["accepted_at", "accepted_price_ore", "channel", "quote_version_id"],
  );
  const asRecord = r.data as unknown as Record<string, unknown>;
  for (const smuggled of [
    "tenant_id",
    "accepted_by",
    "source_sent_total_ore",
    "status",
    "quote_id",
  ]) {
    assert.equal(smuggled in asRecord, false, `smuggled key "${smuggled}" must be stripped`);
  }
});

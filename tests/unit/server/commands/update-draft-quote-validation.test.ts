/**
 * Story 6.2 — PURE input-validator coverage for `validateUpdateDraftQuoteVersion`
 * (AC2/AC3; test-design-epic-6.md #6.2-E2E-02 / Testability Note 2 / R-605 / R-616).
 *
 * `validateUpdateDraftQuoteVersion` is the input-shape guard the command envelope runs
 * BEFORE any DB access (architecture §5 step 4) for the Story 6.2 draft-edit path. It is
 * pure (no I/O), so the fast `node --test` gate can protect its branches WITHOUT a database.
 * The DB-backed INT suite (`update-draft-quote-version.int.test.ts`) proves the load-bearing
 * re-assert-draft / cross-tenant behaviour; THIS suite proves the exhaustive shape rules
 * cheaply — the one remaining validator gap (its sibling 6.1 validator already has a unit
 * test in `quote-validation.test.ts`; every other command domain has one too).
 *
 * The load-bearing rules (kept in lockstep with `src/server/commands/quotes/validation.ts`):
 *   - `quote_version_id` is REQUIRED and UUID-shaped (a value the DB would reject as `22P02`
 *     fails as VALIDATION, not as an opaque server error);
 *   - the allowed edits are scoped CONSERVATIVELY to four PRESENTATIONAL fields — `intro_text`,
 *     `customer_notes` (bounded free text, ≤5000, nullable), `valid_until` (a parseable ISO
 *     date/timestamp, nullable), and `display_mode` (a closed allow-list, nullable);
 *   - FIELD-PRESENCE semantics drive the downstream empty-patch guard: an ABSENT field is
 *     omitted from the validated data (left unchanged); a PRESENT `null` is carried through
 *     (an explicit clear). So `"field" in data` must mirror `"field" in raw`;
 *   - a client-supplied `tenant_id` / `status` / totals / lines are NEVER read — the draft edit
 *     can touch ONLY the four presentational fields (line/price/VAT changes are Story 6.5),
 *     so smuggled keys must not appear on the validated data.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock.
 * Mirrors `tests/unit/server/commands/quote-validation.test.ts`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateUpdateDraftQuoteVersion } from "@/server/commands/quotes/validation";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_UPPER = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";

test("[6.2] accepts an id-only edit (the empty-patch path) — no presentational field carried", () => {
  const r = validateUpdateDraftQuoteVersion({ quote_version_id: UUID_A });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.quote_version_id, UUID_A);
  // No presentational field was supplied → none is present on the validated data (so the
  // command's empty-patch guard short-circuits to a no-op instead of `.update({})`).
  assert.deepEqual(Object.keys(r.data), ["quote_version_id"]);
});

test("[6.2] accepts an UPPERCASE (case-insensitive) uuid quote_version_id", () => {
  const r = validateUpdateDraftQuoteVersion({ quote_version_id: UUID_UPPER });
  assert.equal(r.ok, true, "UUID_RE is case-insensitive");
});

test("[6.2] accepts the full set of presentational fields with valid values", () => {
  const r = validateUpdateDraftQuoteVersion({
    quote_version_id: UUID_A,
    intro_text: "Tack för förfrågan.",
    customer_notes: "Vi bokar in ett startmöte.",
    valid_until: "2026-08-31",
    display_mode: "detailed",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.intro_text, "Tack för förfrågan.");
  assert.equal(r.data.customer_notes, "Vi bokar in ett startmöte.");
  assert.equal(r.data.valid_until, "2026-08-31");
  assert.equal(r.data.display_mode, "detailed");
});

test("[6.2] accepts a full ISO-8601 timestamp for valid_until (not just a date)", () => {
  const r = validateUpdateDraftQuoteVersion({
    quote_version_id: UUID_A,
    valid_until: "2026-08-31T23:59:59.000Z",
  });
  assert.equal(r.ok, true);
});

test("[6.2] accepts every display_mode in the closed allow-list", () => {
  for (const mode of ["detailed", "summary", "text_only"]) {
    const r = validateUpdateDraftQuoteVersion({
      quote_version_id: UUID_A,
      display_mode: mode,
    });
    assert.equal(r.ok, true, `display_mode=${mode} must be accepted`);
  }
});

// ── FIELD-PRESENCE semantics (the empty-patch guard contract) ───────────────────────────────

test("[6.2] a PRESENT null is carried through (an explicit clear); an ABSENT field is omitted", () => {
  const r = validateUpdateDraftQuoteVersion({
    quote_version_id: UUID_A,
    intro_text: null,
    valid_until: null,
    // customer_notes + display_mode are ABSENT — must NOT appear on the validated data.
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // Present-null fields are carried (explicit clear).
  assert.equal("intro_text" in r.data, true);
  assert.equal(r.data.intro_text, null);
  assert.equal("valid_until" in r.data, true);
  assert.equal(r.data.valid_until, null);
  // Absent fields are omitted entirely (left unchanged downstream).
  assert.equal("customer_notes" in r.data, false);
  assert.equal("display_mode" in r.data, false);
});

test("[6.2] validated field-presence mirrors the raw input exactly (no spurious keys)", () => {
  const r = validateUpdateDraftQuoteVersion({
    quote_version_id: UUID_A,
    customer_notes: "Endast detta fält.",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(Object.keys(r.data).sort(), ["customer_notes", "quote_version_id"]);
});

test("[6.2] accepts empty-string presentational text (a coarse-bounded field, not a business rule)", () => {
  const r = validateUpdateDraftQuoteVersion({
    quote_version_id: UUID_A,
    intro_text: "",
    customer_notes: "",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.intro_text, "");
  assert.equal(r.data.customer_notes, "");
});

test("[6.2] text at EXACTLY the 5000 bound is accepted; 5001 is over (rejected)", () => {
  const at = validateUpdateDraftQuoteVersion({
    quote_version_id: UUID_A,
    intro_text: "x".repeat(5000),
  });
  assert.equal(at.ok, true, "5000 is the inclusive bound");
  const over = validateUpdateDraftQuoteVersion({
    quote_version_id: UUID_A,
    customer_notes: "x".repeat(5001),
  });
  assert.equal(over.ok, false, "5001 exceeds the text bound");
});

// ── [VALIDATION_FAILED] negative paths ──────────────────────────────────────────────────────

test("[6.2 VALIDATION_FAILED] a non-record raw value is rejected (never crashes)", () => {
  for (const raw of [null, undefined, 42, "x", true, [] as unknown]) {
    const r = validateUpdateDraftQuoteVersion(raw);
    assert.equal(r.ok, false, `non-record ${String(raw)} must fail`);
    if (r.ok) return;
    assert.equal(r.code, "VALIDATION_FAILED");
  }
});

test("[6.2 VALIDATION_FAILED] a missing / non-uuid quote_version_id is rejected", () => {
  const bad = [
    {},
    { quote_version_id: null },
    { quote_version_id: 123 },
    { quote_version_id: "not-a-uuid" },
    { quote_version_id: "1111" },
    { quote_version_id: `${UUID_A}-extra` },
    { quote_version_id: "" },
  ];
  for (const raw of bad) {
    const r = validateUpdateDraftQuoteVersion(raw);
    assert.equal(r.ok, false, `quote_version_id ${JSON.stringify(raw)} must fail`);
  }
});

test("[6.2 VALIDATION_FAILED] a non-string presentational text is rejected", () => {
  const cases: unknown[] = [
    { quote_version_id: UUID_A, intro_text: 5 },
    { quote_version_id: UUID_A, intro_text: true },
    { quote_version_id: UUID_A, intro_text: {} },
    { quote_version_id: UUID_A, customer_notes: 5 },
    { quote_version_id: UUID_A, customer_notes: [] },
  ];
  for (const raw of cases) {
    const r = validateUpdateDraftQuoteVersion(raw);
    assert.equal(r.ok, false, `non-string text ${JSON.stringify(raw)} must fail`);
  }
});

test("[6.2 VALIDATION_FAILED] an unparseable / out-of-bounds valid_until is rejected", () => {
  const cases: unknown[] = [
    { quote_version_id: UUID_A, valid_until: "not-a-date" },
    { quote_version_id: UUID_A, valid_until: "" }, // empty string is not a date
    { quote_version_id: UUID_A, valid_until: 20260831 }, // must be a string
    { quote_version_id: UUID_A, valid_until: true },
    // Over the 40-char guard (a padded junk string longer than any ISO timestamp).
    { quote_version_id: UUID_A, valid_until: `2026-08-31T00:00:00.000Z${"0".repeat(40)}` },
  ];
  for (const raw of cases) {
    const r = validateUpdateDraftQuoteVersion(raw);
    assert.equal(r.ok, false, `valid_until ${JSON.stringify(raw)} must fail`);
  }
});

test("[6.2 VALIDATION_FAILED] a display_mode outside the closed allow-list is rejected", () => {
  const cases: unknown[] = [
    { quote_version_id: UUID_A, display_mode: "compact" },
    { quote_version_id: UUID_A, display_mode: "DETAILED" }, // case-sensitive allow-list
    { quote_version_id: UUID_A, display_mode: "" },
    { quote_version_id: UUID_A, display_mode: 1 },
    { quote_version_id: UUID_A, display_mode: {} },
  ];
  for (const raw of cases) {
    const r = validateUpdateDraftQuoteVersion(raw);
    assert.equal(r.ok, false, `display_mode ${JSON.stringify(raw)} must fail`);
  }
});

// ── The draft-only scope: NON-presentational / smuggled keys are never carried ──────────────

test("[6.2] a client-supplied tenant_id / status / totals / lines are STRIPPED (draft scope)", () => {
  const r = validateUpdateDraftQuoteVersion({
    quote_version_id: UUID_A,
    intro_text: "ok",
    // Smuggled fields the draft edit must NEVER accept — line/price/VAT/ROT changes are a NEW
    // version via Story 6.5, and tenant_id/status are server-resolved, never client-supplied.
    tenant_id: "99999999-9999-9999-9999-999999999999",
    status: "sent",
    base_total_ore: 100000,
    vat_total_ore: 25000,
    lines: [{ label: "evil" }],
    quote_number: 4242,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // ONLY the id + the supplied presentational field survive; every smuggled key is dropped.
  assert.deepEqual(Object.keys(r.data).sort(), ["intro_text", "quote_version_id"]);
  const asRecord = r.data as unknown as Record<string, unknown>;
  for (const smuggled of [
    "tenant_id",
    "status",
    "base_total_ore",
    "vat_total_ore",
    "lines",
    "quote_number",
  ]) {
    assert.equal(smuggled in asRecord, false, `smuggled key "${smuggled}" must be stripped`);
  }
});

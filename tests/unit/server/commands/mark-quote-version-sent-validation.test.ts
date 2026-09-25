/**
 * Story 6.4 — PURE input-validator coverage for `validateMarkQuoteVersionSent`
 * (AC1/AC2/AC3; test-design-epic-6.md #6.4-INT-01, R-605/R-608 — the fast-gate coverage
 * expansion for the mark-sent command's input-shape guard).
 *
 * `validateMarkQuoteVersionSent` is the input-shape guard the command envelope runs BEFORE any
 * DB access (architecture §5 step 4) for the Story 6.4 mark-sent path. It is pure (no I/O), so
 * the fast `node --test` gate can protect its branches WITHOUT a database — the DB-backed INT
 * suite (`mark-quote-version-sent.int.test.ts`) proves the load-bearing transition / immutability
 * / cross-tenant behaviour and SKIPS when the local stack is unreachable, so the shape rules
 * were previously only exercised (skippably) through that suite. THIS suite pins them cheaply and
 * unconditionally, closing the one remaining validator gap (its sibling 6.2 validator has a unit
 * test in `update-draft-quote-validation.test.ts`; every other command domain has one too).
 *
 * The load-bearing rules (kept in lockstep with `src/server/commands/quotes/validation.ts`):
 *   - `quote_version_id` is REQUIRED and UUID-shaped (a value the DB would reject as `22P02`
 *     fails as VALIDATION here, not as an opaque server error);
 *   - `channel` / `reference` are OPTIONAL recorded FREE-TEXT fields (≤200 chars, nullable) — an
 *     absent field is omitted from the validated data (never recorded); a PRESENT `null` is
 *     carried through as an explicit "not recorded"; so `"field" in data` mirrors `"field" in raw`;
 *   - `channel` / `reference` are NEVER a send integration — they are conservative recorded
 *     fields, and a client-supplied `tenant_id` / `status` / `sent_at` / totals are NEVER read
 *     (the tenant is the RESOLVED tenant, the sent timestamp is the INJECTED clock, and the
 *     transition is server-owned), so smuggled keys must not appear on the validated data.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock.
 * Mirrors `tests/unit/server/commands/update-draft-quote-validation.test.ts`.
 *
 * [Source: src/server/commands/quotes/validation.ts (validateMarkQuoteVersionSent + the
 *  SENT_FIELD_MAX=200 bound + the field-presence semantics); src/server/commands/quotes/
 *  mark-sent.ts (only quote_version_id + optional channel/reference are read; tenant/clock are
 *  server-resolved); story 6.4 Task 3.2 + Task 6; test-design-epic-6.md#6.4-INT-01]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMarkQuoteVersionSent } from "@/server/commands/quotes/validation";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_UPPER = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";

// ── Happy path ───────────────────────────────────────────────────────────────────────────────

test("[13.4] requires a complete linked recipient selection before final send", () => {
  const r = validateMarkQuoteVersionSent({
    quote_version_id: UUID_A,
    recipient_source_type: "customer",
    recipient_source_id: UUID_UPPER,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.quote_version_id, UUID_A);
  // Recipient identity is always carried; recorded channel/reference remain absent.
  assert.deepEqual(Object.keys(r.data).sort(), ["quote_version_id", "recipient_source_id", "recipient_source_type"]);
});

test("[6.4] accepts an UPPERCASE (case-insensitive) uuid quote_version_id", () => {
  const r = validateMarkQuoteVersionSent({ quote_version_id: UUID_UPPER, recipient_source_type: "customer", recipient_source_id: UUID_A });
  assert.equal(r.ok, true, "the uuid check is case-insensitive");
});

test("[6.4] accepts a send with both recorded channel + reference", () => {
  const r = validateMarkQuoteVersionSent({
    quote_version_id: UUID_A,
    channel: "email",
    reference: "REF-123",
    recipient_source_type: "customer",
    recipient_source_id: UUID_UPPER,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.channel, "email");
  assert.equal(r.data.reference, "REF-123");
});

test("[13.4] accepts a complete linked recipient selection and rejects absent, partial, or unknown sources", () => {
  const selected = validateMarkQuoteVersionSent({ quote_version_id: UUID_A, recipient_source_type: "contact", recipient_source_id: UUID_UPPER });
  assert.equal(selected.ok, true);
  if (selected.ok) assert.deepEqual(selected.data.recipient_source_type, "contact");
  for (const raw of [
    { quote_version_id: UUID_A },
    { quote_version_id: UUID_A, recipient_source_type: "contact" },
    { quote_version_id: UUID_A, recipient_source_id: UUID_A },
    { quote_version_id: UUID_A, recipient_source_type: "other", recipient_source_id: UUID_A },
  ]) assert.equal(validateMarkQuoteVersionSent(raw).ok, false);
});

test("[6.4] accepts empty-string channel/reference (a coarse-bounded field, not a business rule)", () => {
  const r = validateMarkQuoteVersionSent({
    quote_version_id: UUID_A,
    channel: "",
    reference: "",
    recipient_source_type: "customer",
    recipient_source_id: UUID_UPPER,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.channel, "");
  assert.equal(r.data.reference, "");
});

test("[6.4] channel/reference at EXACTLY the 200 bound is accepted; 201 is over (rejected)", () => {
  const at = validateMarkQuoteVersionSent({
    quote_version_id: UUID_A,
    channel: "x".repeat(200),
    reference: "y".repeat(200),
    recipient_source_type: "customer",
    recipient_source_id: UUID_UPPER,
  });
  assert.equal(at.ok, true, "200 is the inclusive bound");
  const overChannel = validateMarkQuoteVersionSent({
    quote_version_id: UUID_A,
    channel: "x".repeat(201),
    recipient_source_type: "customer",
    recipient_source_id: UUID_UPPER,
  });
  assert.equal(overChannel.ok, false, "201-char channel exceeds the field bound");
  const overReference = validateMarkQuoteVersionSent({
    quote_version_id: UUID_A,
    reference: "y".repeat(201),
    recipient_source_type: "customer",
    recipient_source_id: UUID_UPPER,
  });
  assert.equal(overReference.ok, false, "201-char reference exceeds the field bound");
});

// ── FIELD-PRESENCE semantics (absent = not recorded; present null = explicit "not recorded") ───

test("[6.4] a PRESENT null is carried through (explicit not-recorded); an ABSENT field is omitted", () => {
  const r = validateMarkQuoteVersionSent({
    quote_version_id: UUID_A,
    channel: null,
    recipient_source_type: "customer",
    recipient_source_id: UUID_UPPER,
    // reference is ABSENT — must NOT appear on the validated data.
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // Present-null is carried through (mapped to null by the validator).
  assert.equal("channel" in r.data, true);
  assert.equal(r.data.channel, null);
  // Absent field is omitted entirely.
  assert.equal("reference" in r.data, false);
});

test("[6.4] validated field-presence mirrors the raw input exactly (no spurious keys)", () => {
  const r = validateMarkQuoteVersionSent({
    quote_version_id: UUID_A,
    reference: "endast-referens",
    recipient_source_type: "customer",
    recipient_source_id: UUID_UPPER,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(Object.keys(r.data).sort(), ["quote_version_id", "recipient_source_id", "recipient_source_type", "reference"]);
});

// ── [VALIDATION_FAILED] negative paths ─────────────────────────────────────────────────────────

test("[6.4 VALIDATION_FAILED] a non-record raw value is rejected (never crashes)", () => {
  for (const raw of [null, undefined, 42, "x", true, [] as unknown]) {
    const r = validateMarkQuoteVersionSent(raw);
    assert.equal(r.ok, false, `non-record ${String(raw)} must fail`);
    if (r.ok) return;
    assert.equal(r.code, "VALIDATION_FAILED");
  }
});

test("[6.4 VALIDATION_FAILED] a missing / non-uuid quote_version_id is rejected", () => {
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
    const r = validateMarkQuoteVersionSent(raw);
    assert.equal(r.ok, false, `quote_version_id ${JSON.stringify(raw)} must fail`);
  }
});

test("[6.4 VALIDATION_FAILED] a non-string channel / reference is rejected", () => {
  const cases: unknown[] = [
    { quote_version_id: UUID_A, channel: 5 },
    { quote_version_id: UUID_A, channel: true },
    { quote_version_id: UUID_A, channel: {} },
    { quote_version_id: UUID_A, channel: [] },
    { quote_version_id: UUID_A, reference: 5 },
    { quote_version_id: UUID_A, reference: {} },
    { quote_version_id: UUID_A, reference: [] },
  ];
  for (const raw of cases) {
    const r = validateMarkQuoteVersionSent(raw);
    assert.equal(r.ok, false, `non-string field ${JSON.stringify(raw)} must fail`);
  }
});

// ── Mark-sent scope: server-resolved / smuggled keys are never carried ─────────────────────────

test("[6.4] a client-supplied tenant_id / status / sent_at / totals are STRIPPED (mark-sent scope)", () => {
  const r = validateMarkQuoteVersionSent({
    quote_version_id: UUID_A,
    channel: "email",
    recipient_source_type: "customer",
    recipient_source_id: UUID_UPPER,
    // Smuggled fields the mark-sent path must NEVER accept — the tenant is the RESOLVED tenant,
    // the sent timestamp is the INJECTED command clock, and status/totals are server-owned.
    tenant_id: "99999999-9999-9999-9999-999999999999",
    status: "accepted",
    sent_at: "2000-01-01T00:00:00.000Z",
    base_total_ore: 100000,
    quote_number: 4242,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // ONLY the id + the supplied recorded field survive; every smuggled key is dropped.
  assert.deepEqual(Object.keys(r.data).sort(), ["channel", "quote_version_id", "recipient_source_id", "recipient_source_type"]);
  const asRecord = r.data as unknown as Record<string, unknown>;
  for (const smuggled of [
    "tenant_id",
    "status",
    "sent_at",
    "base_total_ore",
    "quote_number",
  ]) {
    assert.equal(smuggled in asRecord, false, `smuggled key "${smuggled}" must be stripped`);
  }
});

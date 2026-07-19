/**
 * Story 10.2 — PURE input-validator coverage for `validateMarkQuoteVersionLost` (10.2-UNIT-02, P0,
 * AC1; test-design-epic-10.md, R-1012).
 *
 * `validateMarkQuoteVersionLost` is the input-shape guard the command envelope runs BEFORE any DB
 * access (architecture §5 step 4) for the Förlorad/Avböjd path. It is pure (no I/O), so the fast
 * `node --test` gate protects every reject branch WITHOUT a database — the DB-backed INT suite
 * (`mark-quote-version-lost.int.test.ts`) proves the load-bearing status-only-flip / cross-tenant /
 * duplicate behaviour and SKIPS when the local stack is unreachable.
 *
 * The load-bearing rules (kept in lockstep with `src/server/commands/quotes/validation.ts`):
 *   - `quote_version_id` is REQUIRED and UUID-shaped (a value the DB would reject as `22P02` fails as
 *     VALIDATION here, not as an opaque server error);
 *   - `outcome` is REQUIRED and in the CLOSED set {forlorad, avbojd} (the Förlorad-vs-Avböjd flavour);
 *   - `category` is REQUIRED and in the CLOSED strawman set {pris, konkurrent, tidplan,
 *     uteblivet_svar, annat};
 *   - `note` is OPTIONAL free-text (≤2000 chars, nullable) EXCEPT when `category==='annat'`, where a
 *     non-empty (trimmed) note is REQUIRED — a missing / whitespace-only note on `annat` ⇒ VALIDATION;
 *   - the RAW invalid value is NEVER echoed (the failure is the generic VALIDATION_FAILED code);
 *   - a client-supplied `tenant_id` / `status` is NEVER read (the tenant is the RESOLVED tenant; the
 *     injected clock stamps occurred_at) — so smuggled keys never appear on the validated data.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock. Two-runner discipline
 * (epic-10 retro): the reason validator lands as UNIT, not Playwright.
 *
 * [Source: src/server/commands/quotes/validation.ts (validateMarkQuoteVersionLost + the closed
 *  outcome/category sets + the note-required-on-annat rule); src/server/commands/quotes/lost.ts (only
 *  the shaped input is read; tenant/clock are server-resolved); story 10.2 Task 4.1 + AC1]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMarkQuoteVersionLost } from "@/server/commands/quotes/validation";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_UPPER = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";

/** A minimal valid input: version id + outcome + a non-annat category (no note required). */
function validInput(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { quote_version_id: UUID_A, outcome: "forlorad", category: "pris", ...over };
}

test("10.2-UNIT-02: accepts a minimal valid input (version id + outcome + non-annat category)", () => {
  const r = validateMarkQuoteVersionLost(validInput());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.data, {
    quote_version_id: UUID_A,
    outcome: "forlorad",
    category: "pris",
  });
});

test("10.2-UNIT-02: accepts every outcome × category combination (closed sets)", () => {
  for (const outcome of ["forlorad", "avbojd"]) {
    for (const category of ["pris", "konkurrent", "tidplan", "uteblivet_svar"]) {
      const r = validateMarkQuoteVersionLost(validInput({ outcome, category }));
      assert.equal(r.ok, true, `${outcome}/${category} must validate`);
    }
  }
});

test("10.2-UNIT-02: a UUID-shaped id is accepted regardless of case; a non-UUID id is rejected", () => {
  assert.equal(validateMarkQuoteVersionLost(validInput({ quote_version_id: UUID_UPPER })).ok, true);
  for (const bad of ["not-a-uuid", "", 123, null, undefined, `${UUID_A} `]) {
    assert.equal(
      validateMarkQuoteVersionLost(validInput({ quote_version_id: bad })).ok,
      false,
      `id ${JSON.stringify(bad)} must be rejected`,
    );
  }
});

test("10.2-UNIT-02: outcome must be in the closed set {forlorad, avbojd}", () => {
  for (const bad of ["forlorat", "declined", "lost", "", 1, null, undefined, {}]) {
    assert.equal(
      validateMarkQuoteVersionLost(validInput({ outcome: bad })).ok,
      false,
      `outcome ${JSON.stringify(bad)} must be rejected`,
    );
  }
});

test("10.2-UNIT-02: category must be in the closed strawman set", () => {
  for (const bad of ["price", "other", "annât", "", 0, null, undefined, []]) {
    assert.equal(
      validateMarkQuoteVersionLost(validInput({ category: bad })).ok,
      false,
      `category ${JSON.stringify(bad)} must be rejected`,
    );
  }
});

test("10.2-UNIT-02: a note on `annat` is REQUIRED — a non-empty trimmed note validates", () => {
  const r = validateMarkQuoteVersionLost(
    validInput({ category: "annat", note: "kunden valde en annan leverantör" }),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.note, "kunden valde en annan leverantör");
});

test("10.2-UNIT-02: a MISSING / whitespace-only note on `annat` is rejected", () => {
  for (const note of [undefined, null, "", "   ", "\t\n "]) {
    assert.equal(
      validateMarkQuoteVersionLost(validInput({ category: "annat", note })).ok,
      false,
      `annat note ${JSON.stringify(note)} must be rejected`,
    );
  }
});

test("10.2-UNIT-02: a note on a NON-annat category is OPTIONAL (present → carried; absent → omitted)", () => {
  const withNote = validateMarkQuoteVersionLost(validInput({ category: "pris", note: "för dyrt" }));
  assert.equal(withNote.ok, true);
  if (!withNote.ok) return;
  assert.equal(withNote.data.note, "för dyrt");

  const withoutNote = validateMarkQuoteVersionLost(validInput({ category: "pris" }));
  assert.equal(withoutNote.ok, true);
  if (!withoutNote.ok) return;
  assert.equal("note" in withoutNote.data, false, "an absent note must not appear on the validated data");

  // A present-but-null note on a non-annat category is carried through as an explicit null.
  const nullNote = validateMarkQuoteVersionLost(validInput({ category: "pris", note: null }));
  assert.equal(nullNote.ok, true);
  if (!nullNote.ok) return;
  assert.equal(nullNote.data.note, null);
});

test("10.2-UNIT-02: an over-long note (> 2000 chars) is rejected", () => {
  const longNote = "x".repeat(2001);
  assert.equal(validateMarkQuoteVersionLost(validInput({ category: "pris", note: longNote })).ok, false);
  assert.equal(validateMarkQuoteVersionLost(validInput({ category: "annat", note: longNote })).ok, false);
});

test("10.2-UNIT-02: a non-record / non-string note is rejected; smuggled keys are never carried", () => {
  assert.equal(validateMarkQuoteVersionLost(null).ok, false);
  assert.equal(validateMarkQuoteVersionLost("nope").ok, false);
  assert.equal(validateMarkQuoteVersionLost(validInput({ note: 42 })).ok, false);

  // A client-supplied tenant_id / status must NOT appear on the validated data (server-resolved).
  const r = validateMarkQuoteVersionLost(
    validInput({ tenant_id: "smuggled", status: "lost" }),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal("tenant_id" in r.data, false);
  assert.equal("status" in r.data, false);
});

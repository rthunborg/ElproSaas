/**
 * Story 10.3 — ATDD RED-PHASE scaffold: the PURE input validators for the three follow-up commands
 * (part of 10.3-UNIT-01/02 family, P0, AC1/AC3; test-design-epic-10.md R-1030/R-1032).
 *
 * The three validators are the input-shape guards the command envelope runs BEFORE any DB access
 * (architecture §5 step 4). They are pure (no I/O), so the fast `node --test` gate protects every reject
 * branch WITHOUT a database. The load-bearing rules (kept in lockstep with
 * `src/server/commands/quotes/validation.ts`, Task 3.1):
 *   - `validatePlanQuoteFollowUp`   — `quote_version_id` REQUIRED + UUID-shaped; `due_date` a valid ISO
 *     calendar date (YYYY-MM-DD); `note` OPTIONAL, trimmed, bounded (an over-long note is rejected).
 *     A client-supplied `quote_id` / `tenant_id` / `status` is NEVER read onto the validated data (the
 *     command derives quote_id from the loaded anchor version — SETTLED DESIGN DECISION 3 + Task 3.2).
 *   - `validateCompleteQuoteFollowUp` — `follow_up_id` REQUIRED + UUID-shaped; `outcome` REQUIRED,
 *     non-empty (trimmed), bounded — a missing / whitespace-only outcome is VALIDATION.
 *   - `validateAnnotateQuoteFollowUp` — `follow_up_id` REQUIRED + UUID-shaped; `note` bounded.
 *   - the RAW invalid value is NEVER echoed (the failure is the generic VALIDATION_FAILED code).
 *
 * ── GREEN (Story 10.3 implemented) ────────────────────────────────────────────────────────────────
 * The three validators are landed in `validation.ts`; this suite imports the real exports and every
 * test is unskipped and green. The assertions are the CONTRACT — do not weaken them.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock. Two-runner discipline
 * (epic-10 retro): the follow-up validators land as UNIT, mirroring `mark-lost-validation.test.ts`.
 *
 * [Source: story 10.3 AC1/AC3 + Task 3.1/3.2 + Dev Notes "The three commands"; test-design-epic-10.md
 *  R-1030/R-1032; src/server/commands/quotes/validation.ts (the validateMarkQuoteVersionLost pattern)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validatePlanQuoteFollowUp,
  validateCompleteQuoteFollowUp,
  validateAnnotateQuoteFollowUp,
} from "@/server/commands/quotes/validation";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_UPPER = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";

// ── validatePlanQuoteFollowUp ───────────────────────────────────────────────────────────────────
test("10.3-UNIT (plan): accepts a minimal valid input (uuid version id + valid ISO due date)", () => {
  const r = validatePlanQuoteFollowUp({ quote_version_id: UUID_A, due_date: "2026-08-01" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.quote_version_id, UUID_A);
  assert.equal(r.data.due_date, "2026-08-01");
});

test("10.3-UNIT (plan): a UUID-shaped version id is accepted regardless of case; a non-UUID is rejected", () => {
  assert.equal(validatePlanQuoteFollowUp({ quote_version_id: UUID_UPPER, due_date: "2026-08-01" }).ok, true);
  for (const bad of ["not-a-uuid", "", 123, null, undefined, `${UUID_A} `]) {
    assert.equal(
      validatePlanQuoteFollowUp({ quote_version_id: bad, due_date: "2026-08-01" }).ok,
      false,
      `version id ${JSON.stringify(bad)} must be rejected`,
    );
  }
});

test("10.3-UNIT (plan): due_date must be a valid ISO calendar date", () => {
  for (const bad of ["", "2026-13-01", "2026-02-30", "01/08/2026", "not-a-date", 20260801, null, undefined]) {
    assert.equal(
      validatePlanQuoteFollowUp({ quote_version_id: UUID_A, due_date: bad }).ok,
      false,
      `due_date ${JSON.stringify(bad)} must be rejected`,
    );
  }
});

test("10.3-UNIT (plan): note is OPTIONAL; an over-long note is rejected; server-owned keys are stripped", () => {
  const withNote = validatePlanQuoteFollowUp({ quote_version_id: UUID_A, due_date: "2026-08-01", note: "  ring kund  " });
  assert.equal(withNote.ok, true);

  const longNote = "x".repeat(4001);
  assert.equal(validatePlanQuoteFollowUp({ quote_version_id: UUID_A, due_date: "2026-08-01", note: longNote }).ok, false);

  // A client-supplied quote_id / tenant_id / status must NOT survive onto the validated data — the
  // command derives quote_id from the loaded anchor version, and tenant/status are server-resolved.
  const r = validatePlanQuoteFollowUp({
    quote_version_id: UUID_A,
    due_date: "2026-08-01",
    quote_id: "smuggled-quote",
    tenant_id: "smuggled-tenant",
    status: "open",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal("quote_id" in r.data, false);
  assert.equal("tenant_id" in r.data, false);
  assert.equal("status" in r.data, false);
});

// ── validateCompleteQuoteFollowUp ───────────────────────────────────────────────────────────────
test("10.3-UNIT (complete): accepts a uuid follow_up_id + a non-empty trimmed outcome", () => {
  const r = validateCompleteQuoteFollowUp({ follow_up_id: UUID_A, outcome: "kund vill ha ny version" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.follow_up_id, UUID_A);
  assert.equal(r.data.outcome, "kund vill ha ny version");
});

test("10.3-UNIT (complete): outcome is REQUIRED — missing / whitespace-only / over-long is rejected", () => {
  for (const bad of [undefined, null, "", "   ", "\t\n ", "x".repeat(4001), 42]) {
    assert.equal(
      validateCompleteQuoteFollowUp({ follow_up_id: UUID_A, outcome: bad }).ok,
      false,
      `outcome ${JSON.stringify(bad)} must be rejected`,
    );
  }
});

test("10.3-UNIT (complete): a non-UUID follow_up_id is rejected", () => {
  for (const bad of ["nope", "", null, undefined, 7]) {
    assert.equal(validateCompleteQuoteFollowUp({ follow_up_id: bad, outcome: "ok" }).ok, false);
  }
});

// F5 (integration review): the OPTIONAL expected_quote_id scope — absent is fine (unchanged sheet
// path), a valid UUID is carried through (auto-complete-on-lost path), a malformed one is rejected.
test("F5-UNIT (complete): expected_quote_id is optional — absent → accepted, no field carried", () => {
  const r = validateCompleteQuoteFollowUp({ follow_up_id: UUID_A, outcome: "ok" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal("expected_quote_id" in r.data, false);
});

test("F5-UNIT (complete): a valid expected_quote_id is carried through", () => {
  const r = validateCompleteQuoteFollowUp({
    follow_up_id: UUID_A,
    outcome: "ok",
    expected_quote_id: UUID_UPPER,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.expected_quote_id, UUID_UPPER);
});

test("F5-UNIT (complete): a malformed expected_quote_id is rejected", () => {
  for (const bad of ["nope", "", 7, null]) {
    assert.equal(
      validateCompleteQuoteFollowUp({ follow_up_id: UUID_A, outcome: "ok", expected_quote_id: bad }).ok,
      false,
      `expected_quote_id ${JSON.stringify(bad)} must be rejected`,
    );
  }
});

// ── validateAnnotateQuoteFollowUp ───────────────────────────────────────────────────────────────
test("10.3-UNIT (annotate): accepts a uuid follow_up_id + a bounded note; rejects a non-uuid id and an over-long note", () => {
  assert.equal(validateAnnotateQuoteFollowUp({ follow_up_id: UUID_A, note: "uppdaterad notering" }).ok, true);
  assert.equal(validateAnnotateQuoteFollowUp({ follow_up_id: "nope", note: "x" }).ok, false);
  assert.equal(validateAnnotateQuoteFollowUp({ follow_up_id: UUID_A, note: "x".repeat(4001) }).ok, false);
});

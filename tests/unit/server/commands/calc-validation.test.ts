/**
 * Story 5.1 — ATDD RED-PHASE scaffold: PURE calc validators (AC2, P0 — 5.1-UNIT-01/02).
 *
 * Pins the load-bearing command-layer validation contract WITHOUT a DB or a browser,
 * mirroring `tests/unit/server/commands/crm-validation.test.ts`:
 *   - `row_type` ∈ the closed 5-value union (labor/material/subcontractor/machinery/other);
 *   - `quantity > 0` + a non-empty `unit`;
 *   - EVERY öre money field re-validated via the CANONICAL `isOreAmount`/`ORE_AMOUNT_MAX`
 *     from `@/lib/money` — float / negative / overflow / locale-comma / decimal-string all
 *     rejected (NO forked öre rule);
 *   - `vat_rate_bp` present + integer basis-points-shaped;
 *   - a lifecycle STATE MACHINE — only legal `status` transitions accepted;
 *   - a rejection is the `VALIDATION_FAILED` shape and NEVER echoes the raw invalid value.
 *
 * ── WHY THESE TESTS ARE `{ skip: true }` (RED PHASE) ─────────────────────────────
 * `src/server/commands/calculations/validation.ts` does NOT exist yet (Story 5.1 dev
 * Task 3.2). node --test has no `describe.skip`, so each test is gated with the
 * `{ skip: true }` option, and the not-yet-built validators are a LOCAL
 * `notYetImplemented()` placeholder that THROWS — so a mistakenly un-skipped run fails
 * LOUD rather than green-by-accident, and the file type-checks today without importing a
 * missing module.
 *
 * ── GREEN-PHASE HAND-OFF (Story 5.1 dev) ────────────────────────────────────────
 *   1. Replace `notYetImplemented()` with the real imports:
 *        import { ROW_TYPES, validateCreateRow, validateUpdateCalculation } from
 *          "@/server/commands/calculations/validation";
 *   2. Delete the `{ skip: true }` option on each test.
 *   3. Keep the assertions — they are the CONTRACT (raw value never echoed; canonical öre).
 *
 * Pure logic, no I/O — runs under the dependency-free `node --test` runner
 * (`pnpm run test:unit`), the fast gate protecting validation on every PR.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = { skip: "Story 5.1 RED PHASE — calc validators not implemented yet" } as const;

/**
 * The validator surface this scaffold asserts against. The dev phase (Task 3.2) supplies
 * the real implementations from `@/server/commands/calculations/validation`.
 */
type ValidationResult = { ok: boolean; code?: string; data?: unknown };
interface CalcValidators {
  readonly ROW_TYPES: readonly string[];
  validateCreateRow(input: unknown): ValidationResult;
  validateUpdateCalculation(input: unknown): ValidationResult;
}

/**
 * RED-PHASE placeholder for the not-yet-built calc validators. It is TYPED as the real
 * surface (so destructured `validateCreateRow(...)`/`ROW_TYPES` type-check today) but
 * THROWS at call time — a mistakenly un-skipped run fails LOUD, never green-by-accident.
 * The dev phase DELETES this and imports the real handles (see file header).
 */
function notYetImplemented(): CalcValidators {
  throw new Error(
    "Story 5.1 RED PHASE: calc validators not implemented yet. " +
      "Replace with @/server/commands/calculations/validation in the dev phase.",
  );
}

/** Assert a result is the VALIDATION_FAILED shape (and NEVER echoes the raw value). */
function assertRejected(result: { ok: boolean }, label: string): void {
  assert.equal(result.ok, false, `expected VALIDATION_FAILED: ${label}`);
  const r = result as { ok: false; code?: string; data?: unknown };
  assert.equal(r.code, "VALIDATION_FAILED", `wrong code: ${label}`);
  assert.equal("data" in r, false, `rejection must not carry data: ${label}`);
}

/** Assert a result is the accepted shape and return the narrowed data. */
function assertAccepted<T>(result: { ok: boolean }, label: string): T {
  assert.equal(result.ok, true, `expected accepted: ${label}`);
  const r = result as { ok: true; data: T };
  return r.data;
}

const SECTION_ID = "11111111-1111-4111-8111-111111111111";

function baseRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    section_id: SECTION_ID,
    row_type: "labor",
    quantity: 1.5,
    unit: "h",
    unit_cost_ore: 45000,
    unit_sell_ore: 85000,
    vat_rate_bp: 2500,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// row_type closed union (5.1-UNIT-01)
// ─────────────────────────────────────────────────────────────────────────────

test("ROW_TYPES is exactly the five approved values", SKIP, () => {
  const { ROW_TYPES } = notYetImplemented();
  assert.deepEqual(
    [...ROW_TYPES].sort(),
    ["labor", "machinery", "material", "other", "subcontractor"],
  );
});

test("validateCreateRow accepts every approved row_type", SKIP, () => {
  const { validateCreateRow } = notYetImplemented();
  for (const t of ["labor", "material", "subcontractor", "machinery", "other"]) {
    assertAccepted(validateCreateRow(baseRow({ row_type: t })), `row_type ${t}`);
  }
});

test("validateCreateRow rejects a row_type outside the closed union", SKIP, () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(validateCreateRow(baseRow({ row_type: "consulting" })), "bad row_type");
  assertRejected(validateCreateRow(baseRow({ row_type: 42 })), "non-string row_type");
});

// ─────────────────────────────────────────────────────────────────────────────
// quantity > 0 + unit required (5.1-UNIT-01)
// ─────────────────────────────────────────────────────────────────────────────

test("validateCreateRow accepts a fractional positive quantity", SKIP, () => {
  const { validateCreateRow } = notYetImplemented();
  assertAccepted(validateCreateRow(baseRow({ quantity: 0.333 })), "fractional qty");
});

test("validateCreateRow rejects a non-positive quantity", SKIP, () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(validateCreateRow(baseRow({ quantity: 0 })), "qty 0");
  assertRejected(validateCreateRow(baseRow({ quantity: -1 })), "qty -1");
});

test("validateCreateRow rejects an empty or whitespace unit", SKIP, () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(validateCreateRow(baseRow({ unit: "" })), "empty unit");
  assertRejected(validateCreateRow(baseRow({ unit: "   " })), "whitespace unit");
});

// ─────────────────────────────────────────────────────────────────────────────
// öre money via the CANONICAL isOreAmount/ORE_AMOUNT_MAX (5.1-UNIT-02)
// ─────────────────────────────────────────────────────────────────────────────

test("validateCreateRow accepts an integer-öre money value at 0 and up to ORE_AMOUNT_MAX", SKIP, () => {
  const { validateCreateRow } = notYetImplemented();
  assertAccepted(validateCreateRow(baseRow({ unit_sell_ore: 0 })), "zero öre");
  assertAccepted(
    validateCreateRow(baseRow({ unit_sell_ore: Number.MAX_SAFE_INTEGER })),
    "öre at ceiling",
  );
});

test("validateCreateRow rejects a float öre (öre are whole integers)", SKIP, () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(validateCreateRow(baseRow({ unit_sell_ore: 100.5 })), "float öre");
});

test("validateCreateRow rejects a negative öre (no discount/negative money in Phase A)", SKIP, () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(validateCreateRow(baseRow({ unit_sell_ore: -1 })), "negative öre");
});

test("validateCreateRow rejects an overflow öre (> ORE_AMOUNT_MAX)", SKIP, () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(
    validateCreateRow(baseRow({ unit_sell_ore: Number.MAX_SAFE_INTEGER + 1 })),
    "overflow öre",
  );
});

test("validateCreateRow rejects a locale-comma / decimal-string öre (comma-decimal trap)", SKIP, () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(validateCreateRow(baseRow({ unit_sell_ore: "850,00" })), "comma-string öre");
  assertRejected(validateCreateRow(baseRow({ unit_sell_ore: "85000" })), "numeric-string öre");
});

// ─────────────────────────────────────────────────────────────────────────────
// VAT assumption present + basis-points-shaped (5.1-UNIT-01)
// ─────────────────────────────────────────────────────────────────────────────

test("validateCreateRow accepts a well-formed integer basis-points VAT (e.g. 2500)", SKIP, () => {
  const { validateCreateRow } = notYetImplemented();
  assertAccepted(validateCreateRow(baseRow({ vat_rate_bp: 2500 })), "vat 2500 bp");
});

test("validateCreateRow rejects a missing or non-integer VAT assumption", SKIP, () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(validateCreateRow(baseRow({ vat_rate_bp: undefined })), "missing vat");
  assertRejected(validateCreateRow(baseRow({ vat_rate_bp: 25.5 })), "float vat");
  assertRejected(validateCreateRow(baseRow({ vat_rate_bp: "2500" })), "string vat");
});

// ─────────────────────────────────────────────────────────────────────────────
// lifecycle state machine — only legal status transitions (5.1-UNIT-01)
// ─────────────────────────────────────────────────────────────────────────────

test("validateUpdateCalculation accepts a legal lifecycle transition (draft → ready)", SKIP, () => {
  const { validateUpdateCalculation } = notYetImplemented();
  assertAccepted(
    validateUpdateCalculation({ id: SECTION_ID, status: "ready", currentStatus: "draft" }),
    "draft→ready",
  );
});

test("validateUpdateCalculation rejects an illegal lifecycle transition / unknown status", SKIP, () => {
  const { validateUpdateCalculation } = notYetImplemented();
  assertRejected(
    validateUpdateCalculation({ id: SECTION_ID, status: "not_a_status" }),
    "unknown status",
  );
  assertRejected(
    validateUpdateCalculation({ id: SECTION_ID, status: "draft", currentStatus: "archived" }),
    "archived→draft (illegal)",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// raw invalid value never echoed (R-506 discipline)
// ─────────────────────────────────────────────────────────────────────────────

test("a rejection NEVER carries the raw invalid value back (assertRejected enforces no data)", SKIP, () => {
  const { validateCreateRow } = notYetImplemented();
  // assertRejected already asserts `"data" in r === false`; this test documents that the
  // öre reject path in particular does not echo the offending value.
  assertRejected(validateCreateRow(baseRow({ unit_sell_ore: 100.5 })), "no-echo on float öre");
});

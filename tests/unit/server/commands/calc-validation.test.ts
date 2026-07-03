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
import {
  ROW_TYPES as REAL_ROW_TYPES,
  isLegalTransition as realIsLegalTransition,
  validateCreateRow as realValidateCreateRow,
  validateUpdateCalculation as realValidateUpdateCalculation,
} from "@/server/commands/calculations/validation";

/**
 * The validator surface this suite asserts against. GREEN as of Story 5.1 dev (Task 3.2)
 * — the real implementations live in `@/server/commands/calculations/validation`.
 */
type ValidationResult = { ok: boolean; code?: string; data?: unknown };
interface CalcValidators {
  readonly ROW_TYPES: readonly string[];
  validateCreateRow(input: unknown): ValidationResult;
  validateUpdateCalculation(input: unknown): ValidationResult;
  isLegalTransition(
    current: "draft" | "ready" | "archived",
    target: "draft" | "ready" | "archived",
  ): boolean;
}

/** Bind the real calc validators (the RED-phase `notYetImplemented()` placeholder). */
function notYetImplemented(): CalcValidators {
  return {
    ROW_TYPES: REAL_ROW_TYPES,
    validateCreateRow: realValidateCreateRow,
    validateUpdateCalculation: realValidateUpdateCalculation,
    isLegalTransition: realIsLegalTransition,
  };
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

test("ROW_TYPES is exactly the five approved values", () => {
  const { ROW_TYPES } = notYetImplemented();
  assert.deepEqual(
    [...ROW_TYPES].sort(),
    ["labor", "machinery", "material", "other", "subcontractor"],
  );
});

test("validateCreateRow accepts every approved row_type", () => {
  const { validateCreateRow } = notYetImplemented();
  for (const t of ["labor", "material", "subcontractor", "machinery", "other"]) {
    assertAccepted(validateCreateRow(baseRow({ row_type: t })), `row_type ${t}`);
  }
});

test("validateCreateRow rejects a row_type outside the closed union", () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(validateCreateRow(baseRow({ row_type: "consulting" })), "bad row_type");
  assertRejected(validateCreateRow(baseRow({ row_type: 42 })), "non-string row_type");
});

// ─────────────────────────────────────────────────────────────────────────────
// quantity > 0 + unit required (5.1-UNIT-01)
// ─────────────────────────────────────────────────────────────────────────────

test("validateCreateRow accepts a fractional positive quantity", () => {
  const { validateCreateRow } = notYetImplemented();
  assertAccepted(validateCreateRow(baseRow({ quantity: 0.333 })), "fractional qty");
});

test("validateCreateRow rejects a non-positive quantity", () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(validateCreateRow(baseRow({ quantity: 0 })), "qty 0");
  assertRejected(validateCreateRow(baseRow({ quantity: -1 })), "qty -1");
});

test("validateCreateRow rejects an empty or whitespace unit", () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(validateCreateRow(baseRow({ unit: "" })), "empty unit");
  assertRejected(validateCreateRow(baseRow({ unit: "   " })), "whitespace unit");
});

// ─────────────────────────────────────────────────────────────────────────────
// öre money via the CANONICAL isOreAmount/ORE_AMOUNT_MAX (5.1-UNIT-02)
// ─────────────────────────────────────────────────────────────────────────────

test("validateCreateRow accepts an integer-öre money value at 0 and up to ORE_AMOUNT_MAX", () => {
  const { validateCreateRow } = notYetImplemented();
  assertAccepted(validateCreateRow(baseRow({ unit_sell_ore: 0 })), "zero öre");
  assertAccepted(
    validateCreateRow(baseRow({ unit_sell_ore: Number.MAX_SAFE_INTEGER })),
    "öre at ceiling",
  );
});

test("validateCreateRow rejects a float öre (öre are whole integers)", () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(validateCreateRow(baseRow({ unit_sell_ore: 100.5 })), "float öre");
});

test("validateCreateRow rejects a negative öre (no discount/negative money in Phase A)", () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(validateCreateRow(baseRow({ unit_sell_ore: -1 })), "negative öre");
});

test("validateCreateRow rejects an overflow öre (> ORE_AMOUNT_MAX)", () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(
    validateCreateRow(baseRow({ unit_sell_ore: Number.MAX_SAFE_INTEGER + 1 })),
    "overflow öre",
  );
});

test("validateCreateRow rejects a locale-comma / decimal-string öre (comma-decimal trap)", () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(validateCreateRow(baseRow({ unit_sell_ore: "850,00" })), "comma-string öre");
  assertRejected(validateCreateRow(baseRow({ unit_sell_ore: "85000" })), "numeric-string öre");
});

// ─────────────────────────────────────────────────────────────────────────────
// VAT assumption present + basis-points-shaped (5.1-UNIT-01)
// ─────────────────────────────────────────────────────────────────────────────

test("validateCreateRow accepts a well-formed integer basis-points VAT (e.g. 2500)", () => {
  const { validateCreateRow } = notYetImplemented();
  assertAccepted(validateCreateRow(baseRow({ vat_rate_bp: 2500 })), "vat 2500 bp");
});

test("validateCreateRow rejects a missing or non-integer VAT assumption", () => {
  const { validateCreateRow } = notYetImplemented();
  assertRejected(validateCreateRow(baseRow({ vat_rate_bp: undefined })), "missing vat");
  assertRejected(validateCreateRow(baseRow({ vat_rate_bp: 25.5 })), "float vat");
  assertRejected(validateCreateRow(baseRow({ vat_rate_bp: "2500" })), "string vat");
});

// ─────────────────────────────────────────────────────────────────────────────
// lifecycle state machine — only legal status transitions (5.1-UNIT-01)
// ─────────────────────────────────────────────────────────────────────────────

// The validator does a VALUE-SHAPE check only: a supplied `status` must be a known
// CalcStatus. The TRANSITION legality is NOT decided by the pure validator — it is
// enforced authoritatively in `updateCalculation.execute` against the target row's REAL
// status loaded from the DB (findings 1 & 2), so a client-supplied `currentStatus` is
// never trusted. The pure state machine itself is covered by `isLegalTransition` below;
// the DB-authoritative transition is covered by the command integration test.
test("validateUpdateCalculation accepts a well-formed status value (shape check)", () => {
  const { validateUpdateCalculation } = notYetImplemented();
  assertAccepted(
    validateUpdateCalculation({ id: SECTION_ID, status: "ready" }),
    "known status value ready",
  );
});

test("validateUpdateCalculation rejects an unknown status VALUE", () => {
  const { validateUpdateCalculation } = notYetImplemented();
  assertRejected(
    validateUpdateCalculation({ id: SECTION_ID, status: "not_a_status" }),
    "unknown status",
  );
});

test("validateUpdateCalculation IGNORES a client-supplied currentStatus (never trusted)", () => {
  const { validateUpdateCalculation } = notYetImplemented();
  // A client claiming currentStatus "archived" cannot make the validator reject a
  // shape-valid target — the transition is decided in execute against the real row, not
  // here. The validator accepts the value shape regardless of any spoofed currentStatus.
  assertAccepted(
    validateUpdateCalculation({
      id: SECTION_ID,
      status: "draft",
      currentStatus: "archived",
    }),
    "shape-valid despite spoofed currentStatus",
  );
});

test("isLegalTransition encodes the forward-only state machine (archived is terminal)", () => {
  const { isLegalTransition } = notYetImplemented();
  // Legal: draft ↔ ready, and archive from any active state; same-state no-op.
  assert.equal(isLegalTransition("draft", "ready"), true);
  assert.equal(isLegalTransition("ready", "draft"), true);
  assert.equal(isLegalTransition("draft", "archived"), true);
  assert.equal(isLegalTransition("ready", "archived"), true);
  assert.equal(isLegalTransition("draft", "draft"), true);
  // Illegal: reviving an archived calc (this is what finding 1's DB-authoritative check
  // blocks in production — archived → draft/ready is never legal).
  assert.equal(isLegalTransition("archived", "draft"), false);
  assert.equal(isLegalTransition("archived", "ready"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// raw invalid value never echoed (R-506 discipline)
// ─────────────────────────────────────────────────────────────────────────────

test("a rejection NEVER carries the raw invalid value back (assertRejected enforces no data)", () => {
  const { validateCreateRow } = notYetImplemented();
  // assertRejected already asserts `"data" in r === false`; this test documents that the
  // öre reject path in particular does not echo the offending value.
  assertRejected(validateCreateRow(baseRow({ unit_sell_ore: 100.5 })), "no-echo on float öre");
});

/**
 * Story 5.1 — coverage-expansion unit suite for the PURE calc validators
 * (bmad-testarch-automate; AC2, 5.1-UNIT-01/02).
 *
 * The original ATDD suite (`calc-validation.test.ts`) pins `validateCreateRow` and
 * `validateUpdateCalculation`. This suite EXTENDS the fast per-PR validation gate to the
 * six exported validators that had no test anywhere:
 *   - `validateCreateCalculation` — customer UUID required, optional facility/contact UUID
 *     guard, title required, client `tenant_id` stripped (never echoed).
 *   - `validateCreateSection` / `validateUpdateSection` — optional title, the closed
 *     `display_mode` set, id UUID guard.
 *   - `validateUpdateRow` — patch-optional VAT (differs from create), per-field öre / qty /
 *     row_type / markup guards, id UUID guard.
 *   - `validateReorderRows` / `validateReorderSections` — the atomic-reorder input contract
 *     (non-empty, bounded, UUID-shaped id array + section/calc UUID).
 * Plus the untested branches of the shared row-field validator (`markup_bp` bp shape, the
 * boolean flag guards) and the remaining lifecycle state-machine transitions.
 *
 * Pure logic, no I/O — runs under the dependency-free `node --test` runner
 * (`pnpm run test:unit`). Mirrors the assertion discipline of the sibling suite: a
 * rejection is the `VALIDATION_FAILED` shape and NEVER carries the raw invalid value.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SECTION_DISPLAY_MODES,
  isLegalTransition,
  validateCreateCalculation,
  validateCreateSection,
  validateUpdateSection,
  validateUpdateCalculation,
  validateUpdateRow,
  validateReorderRows,
  validateReorderSections,
} from "@/server/commands/calculations/validation";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

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

/** Assert the pure state-machine result for a `current → target` transition. */
function assertTransition(
  current: "draft" | "ready" | "archived",
  target: "draft" | "ready" | "archived",
  expected: boolean,
): void {
  assert.equal(
    isLegalTransition(current, target),
    expected,
    `${current}→${target} should be ${expected ? "legal" : "illegal"}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// validateCreateCalculation — parent UUIDs + title + tenant_id stripped
// ─────────────────────────────────────────────────────────────────────────────

test("validateCreateCalculation accepts a minimal customer + title payload", () => {
  const data = assertAccepted<{
    customer_id: string;
    title: string;
    facility_id?: string;
    contact_id?: string;
  }>(
    validateCreateCalculation({ customer_id: UUID_A, title: "  Ombyggnad  " }),
    "minimal calc",
  );
  assert.equal(data.customer_id, UUID_A);
  assert.equal(data.title, "Ombyggnad"); // trimmed
  assert.equal(data.facility_id, undefined);
  assert.equal(data.contact_id, undefined);
});

test("validateCreateCalculation accepts optional facility_id + contact_id", () => {
  const data = assertAccepted<{ facility_id?: string; contact_id?: string }>(
    validateCreateCalculation({
      customer_id: UUID_A,
      facility_id: UUID_B,
      contact_id: UUID_C,
      title: "with parents",
    }),
    "calc with facility+contact",
  );
  assert.equal(data.facility_id, UUID_B);
  assert.equal(data.contact_id, UUID_C);
});

test("validateCreateCalculation rejects a missing / non-UUID customer_id", () => {
  assertRejected(validateCreateCalculation({ title: "no customer" }), "missing customer_id");
  assertRejected(
    validateCreateCalculation({ customer_id: "not-a-uuid", title: "bad customer" }),
    "non-uuid customer_id",
  );
});

test("validateCreateCalculation rejects a present-but-malformed facility/contact id", () => {
  assertRejected(
    validateCreateCalculation({ customer_id: UUID_A, facility_id: "nope", title: "t" }),
    "bad facility_id",
  );
  assertRejected(
    validateCreateCalculation({ customer_id: UUID_A, contact_id: "nope", title: "t" }),
    "bad contact_id",
  );
});

test("validateCreateCalculation rejects a missing / empty title", () => {
  assertRejected(validateCreateCalculation({ customer_id: UUID_A }), "missing title");
  assertRejected(
    validateCreateCalculation({ customer_id: UUID_A, title: "   " }),
    "whitespace title",
  );
});

test("validateCreateCalculation STRIPS a client-supplied tenant_id (never in output)", () => {
  const data = assertAccepted<Record<string, unknown>>(
    validateCreateCalculation({
      customer_id: UUID_A,
      title: "spoof",
      tenant_id: UUID_B, // client-supplied — the resolved tenant is the only authority
    }),
    "tenant_id stripped",
  );
  assert.equal("tenant_id" in data, false);
});

test("validateCreateCalculation rejects a non-record input", () => {
  assertRejected(validateCreateCalculation(null), "null");
  assertRejected(validateCreateCalculation("string"), "string");
});

// ─────────────────────────────────────────────────────────────────────────────
// validateCreateSection / validateUpdateSection — optional title + display_mode enum
// ─────────────────────────────────────────────────────────────────────────────

test("SECTION_DISPLAY_MODES is exactly the three approved values", () => {
  assert.deepEqual([...SECTION_DISPLAY_MODES].sort(), ["detailed", "summary", "text_only"]);
});

test("validateCreateSection accepts an untitled section (title optional)", () => {
  const data = assertAccepted<{ calculation_id: string; title?: string }>(
    validateCreateSection({ calculation_id: UUID_A }),
    "untitled section",
  );
  assert.equal(data.calculation_id, UUID_A);
  assert.equal(data.title, undefined);
});

test("validateCreateSection accepts every approved display_mode", () => {
  for (const mode of SECTION_DISPLAY_MODES) {
    const data = assertAccepted<{ display_mode?: string }>(
      validateCreateSection({ calculation_id: UUID_A, display_mode: mode }),
      `display_mode ${mode}`,
    );
    assert.equal(data.display_mode, mode);
  }
});

test("validateCreateSection rejects an unknown display_mode / missing calculation_id", () => {
  assertRejected(
    validateCreateSection({ calculation_id: UUID_A, display_mode: "fancy" }),
    "bad display_mode",
  );
  assertRejected(validateCreateSection({ display_mode: "detailed" }), "missing calculation_id");
});

test("validateUpdateSection accepts an id-only patch and a display_mode patch", () => {
  assertAccepted(validateUpdateSection({ id: UUID_A }), "id-only section patch");
  const data = assertAccepted<{ display_mode?: string; title?: string }>(
    validateUpdateSection({ id: UUID_A, title: "  Kabel  ", display_mode: "summary" }),
    "section title+mode patch",
  );
  assert.equal(data.title, "Kabel"); // trimmed
  assert.equal(data.display_mode, "summary");
});

test("validateUpdateSection rejects a bad id / whitespace title / bad display_mode", () => {
  assertRejected(validateUpdateSection({ id: "nope" }), "bad id");
  // A present-but-blank (whitespace-only) title is rejected; an empty-string title is
  // treated as absent (dropped) by the empty-patch-friendly `isPresent` convention.
  assertRejected(validateUpdateSection({ id: UUID_A, title: "   " }), "whitespace title");
  assertAccepted(validateUpdateSection({ id: UUID_A, title: "" }), "empty-string title dropped");
  assertRejected(
    validateUpdateSection({ id: UUID_A, display_mode: "nope" }),
    "bad display_mode",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// validateUpdateRow — patch-optional VAT + per-field guards
// ─────────────────────────────────────────────────────────────────────────────

test("validateUpdateRow accepts an id-only patch (no VAT required on update)", () => {
  // Unlike create, VAT is OPTIONAL on an update patch — an id-only patch is valid.
  assertAccepted(validateUpdateRow({ id: UUID_A }), "id-only row patch");
});

test("validateUpdateRow accepts a valid partial patch (qty + öre + flags)", () => {
  const data = assertAccepted<{
    quantity?: number;
    unit_sell_ore?: number;
    is_hidden?: boolean;
  }>(
    validateUpdateRow({
      id: UUID_A,
      quantity: 2.5,
      unit_sell_ore: 90000,
      is_hidden: true,
    }),
    "row partial patch",
  );
  assert.equal(data.quantity, 2.5);
  assert.equal(data.unit_sell_ore, 90000);
  assert.equal(data.is_hidden, true);
});

test("validateUpdateRow rejects a bad id", () => {
  assertRejected(validateUpdateRow({ id: "not-a-uuid" }), "bad row id");
});

test("validateUpdateRow rejects a present-but-invalid field (row_type/qty/unit/öre/vat)", () => {
  assertRejected(validateUpdateRow({ id: UUID_A, row_type: "consulting" }), "bad row_type");
  assertRejected(validateUpdateRow({ id: UUID_A, quantity: 0 }), "non-positive qty");
  assertRejected(validateUpdateRow({ id: UUID_A, quantity: -1 }), "negative qty");
  // A whitespace-only unit is a present-but-blank rejection; an empty-string unit is
  // treated as absent (dropped) by the empty-patch-friendly `isPresent` convention.
  assertRejected(validateUpdateRow({ id: UUID_A, unit: "   " }), "whitespace unit");
  assertAccepted(validateUpdateRow({ id: UUID_A, unit: "" }), "empty-string unit dropped");
  assertRejected(validateUpdateRow({ id: UUID_A, unit_cost_ore: 100.5 }), "float öre");
  assertRejected(validateUpdateRow({ id: UUID_A, unit_sell_ore: -1 }), "negative öre");
  assertRejected(validateUpdateRow({ id: UUID_A, vat_rate_bp: 25.5 }), "float vat bp");
  assertRejected(validateUpdateRow({ id: UUID_A, vat_rate_bp: "2500" }), "string vat bp");
});

test("validateUpdateRow rejects an invalid raw value WITHOUT echoing it (no-echo discipline)", () => {
  const result = validateUpdateRow({ id: UUID_A, unit_sell_ore: 123.456 });
  assertRejected(result, "no-echo float öre");
  assert.equal(JSON.stringify(result).includes("123.456"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// markup_bp + boolean flag guards (untested branches of validateRowCommonFields)
// ─────────────────────────────────────────────────────────────────────────────

test("validateUpdateRow accepts a well-formed markup_bp (integer basis points)", () => {
  const data = assertAccepted<{ markup_bp?: number }>(
    validateUpdateRow({ id: UUID_A, markup_bp: 1500 }),
    "markup 1500 bp",
  );
  assert.equal(data.markup_bp, 1500);
});

test("validateUpdateRow accepts a markup_bp above 100% (a markup is not a VAT rate)", () => {
  // A cost→sell markup routinely exceeds 100% — e.g. 150% = 15000 bp — which the
  // VAT-only `isVatRateBp` [0, 10000] bound would wrongly reject (finding-3 regression).
  const data = assertAccepted<{ markup_bp?: number }>(
    validateUpdateRow({ id: UUID_A, markup_bp: 15_000 }),
    "markup 15000 bp (150%)",
  );
  assert.equal(data.markup_bp, 15_000);
});

test("validateUpdateRow rejects a malformed markup_bp (float / negative / absurd / string)", () => {
  assertRejected(validateUpdateRow({ id: UUID_A, markup_bp: 12.5 }), "float markup");
  assertRejected(validateUpdateRow({ id: UUID_A, markup_bp: -1 }), "negative markup");
  // 10001 bp (just over 100%) is now a LEGITIMATE markup and must be accepted — only a
  // truly out-of-range value (beyond the markup-specific ceiling) is rejected.
  assertRejected(
    validateUpdateRow({ id: UUID_A, markup_bp: 1_000_001 }),
    "absurd over-range markup",
  );
  assertRejected(validateUpdateRow({ id: UUID_A, markup_bp: "1500" }), "string markup");
});

test("validateUpdateRow accepts a markup_bp of 10001 (just over 100%)", () => {
  const data = assertAccepted<{ markup_bp?: number }>(
    validateUpdateRow({ id: UUID_A, markup_bp: 10_001 }),
    "markup 10001 bp",
  );
  assert.equal(data.markup_bp, 10_001);
});

test("validateUpdateRow rejects a non-boolean visibility/option flag", () => {
  assertRejected(validateUpdateRow({ id: UUID_A, is_hidden: "yes" }), "non-bool is_hidden");
  assertRejected(validateUpdateRow({ id: UUID_A, is_optional: 1 }), "non-bool is_optional");
  assertRejected(validateUpdateRow({ id: UUID_A, is_selected: "no" }), "non-bool is_selected");
});

// ─────────────────────────────────────────────────────────────────────────────
// validateReorderRows / validateReorderSections — the atomic-reorder input contract
// ─────────────────────────────────────────────────────────────────────────────

test("validateReorderRows accepts a section + non-empty UUID id array", () => {
  const data = assertAccepted<{ section_id: string; ordered_row_ids: readonly string[] }>(
    validateReorderRows({ section_id: UUID_A, ordered_row_ids: [UUID_B, UUID_C] }),
    "reorder rows",
  );
  assert.equal(data.section_id, UUID_A);
  assert.deepEqual([...data.ordered_row_ids], [UUID_B, UUID_C]);
});

test("validateReorderRows rejects a bad section_id / empty array / non-UUID member", () => {
  assertRejected(
    validateReorderRows({ section_id: "nope", ordered_row_ids: [UUID_B] }),
    "bad section_id",
  );
  assertRejected(
    validateReorderRows({ section_id: UUID_A, ordered_row_ids: [] }),
    "empty id array",
  );
  assertRejected(
    validateReorderRows({ section_id: UUID_A, ordered_row_ids: [UUID_B, "not-a-uuid"] }),
    "non-uuid member",
  );
  assertRejected(
    validateReorderRows({ section_id: UUID_A, ordered_row_ids: "not-an-array" }),
    "non-array ids",
  );
});

test("validateReorderSections accepts a calculation + non-empty UUID id array", () => {
  const data = assertAccepted<{
    calculation_id: string;
    ordered_section_ids: readonly string[];
  }>(
    validateReorderSections({ calculation_id: UUID_A, ordered_section_ids: [UUID_B, UUID_C] }),
    "reorder sections",
  );
  assert.equal(data.calculation_id, UUID_A);
  assert.deepEqual([...data.ordered_section_ids], [UUID_B, UUID_C]);
});

test("validateReorderSections rejects a bad calculation_id / empty array / non-UUID member", () => {
  assertRejected(
    validateReorderSections({ calculation_id: "nope", ordered_section_ids: [UUID_B] }),
    "bad calculation_id",
  );
  assertRejected(
    validateReorderSections({ calculation_id: UUID_A, ordered_section_ids: [] }),
    "empty id array",
  );
  assertRejected(
    validateReorderSections({
      calculation_id: UUID_A,
      ordered_section_ids: [UUID_B, "not-a-uuid"],
    }),
    "non-uuid member",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// validateUpdateCalculation — status VALUE-shape check (transition legality is
// enforced authoritatively in execute against the real DB row, findings 1 & 2)
// ─────────────────────────────────────────────────────────────────────────────

test("validateUpdateCalculation accepts each known status VALUE (shape only)", () => {
  for (const status of ["draft", "ready", "archived"] as const) {
    const data = assertAccepted<{ status?: string }>(
      validateUpdateCalculation({ id: UUID_A, status }),
      `known status ${status}`,
    );
    assert.equal(data.status, status);
  }
});

test("validateUpdateCalculation IGNORES any client-supplied currentStatus", () => {
  // The pure validator can NOT read the row's real status and must NEVER trust a
  // client-supplied currentStatus (a caller could spoof it). It therefore accepts a
  // shape-valid target regardless of currentStatus — the transition is decided in
  // execute against the DB. (This is the finding-1/2 fix: no client-driven bypass.)
  assertAccepted(
    validateUpdateCalculation({ id: UUID_A, status: "ready", currentStatus: "archived" }),
    "spoofed currentStatus is ignored, shape-valid target accepted",
  );
  assertAccepted(
    validateUpdateCalculation({ id: UUID_A, status: "ready", currentStatus: "bogus" }),
    "bogus currentStatus is ignored, shape-valid target accepted",
  );
});

test("isLegalTransition encodes the full forward-only state machine", () => {
  // Legal transitions (archived is reachable from any active state; same-state no-op ok).
  assertTransition("draft", "ready", true);
  assertTransition("ready", "draft", true);
  assertTransition("draft", "draft", true);
  assertTransition("ready", "archived", true);
  assertTransition("draft", "archived", true);
  assertTransition("archived", "archived", true);
  // Illegal: reviving an archived calc — the check finding 1 makes authoritative.
  assertTransition("archived", "draft", false);
  assertTransition("archived", "ready", false);
});

test("validateUpdateCalculation accepts a title-only patch (no status transition)", () => {
  const data = assertAccepted<{ title?: string; status?: string }>(
    validateUpdateCalculation({ id: UUID_A, title: "  Rev 2  " }),
    "title-only patch",
  );
  assert.equal(data.title, "Rev 2"); // trimmed
  assert.equal(data.status, undefined);
});

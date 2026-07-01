/**
 * Story 3.4 — unit tests for the PURE pricing FormData parsers
 * (`src/features/pricing/form-parsing.ts`). These pin the client-side (UX nicety)
 * field validation + the kronor→öre boundary conversion (the stored value is never a
 * float) + the work-role COST-defaults-to-0 semantics + the article OPTIONAL-field
 * omitted-vs-cleared behaviour + the HARD no-supplier-scope at the form layer, WITHOUT
 * a browser. The server `validateInput` is the authority; these guard the form so a
 * near-miss surfaces as a field-associated message instead of a generic
 * VALIDATION_FAILED, and so no malformed price is ever silently coerced. Runs under
 * `node --test` (pure, no I/O).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseArchiveForm,
  parseArticleForm,
  parseWorkRoleForm,
} from "@/features/pricing/form-parsing";

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) form.set(k, v);
  return form;
}

// ── work-role form: kronor→öre boundary + rate semantics ─────────────────────────

test("workRole: a valid form converts both kronor rates to integer öre (no float leaks)", () => {
  const parsed = parseWorkRoleForm(
    fd({
      display_name: "Montör",
      cost_rate_kronor: "450,00",
      sell_rate_kronor: "850,00",
    }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.cost_rate_ore, 45000);
  assert.equal(parsed.input.sell_rate_ore, 85000);
  assert.equal(Number.isInteger(parsed.input.cost_rate_ore as number), true);
  assert.equal(Number.isInteger(parsed.input.sell_rate_ore as number), true);
});

test("workRole: a missing display_name is a field error", () => {
  const parsed = parseWorkRoleForm(
    fd({ sell_rate_kronor: "850,00", cost_rate_kronor: "450,00" }),
  );
  assert.ok(parsed.fieldErrors.display_name);
});

test("workRole: the COST rate is OPTIONAL — a blank cost defaults to 0 öre with NO field error", () => {
  // A tenant pricing only by a sell rate is valid for the pilot; a blank cost is NOT an
  // error, it stores 0 öre. (sell is the required customer-facing price.)
  const parsed = parseWorkRoleForm(
    fd({ display_name: "Montör", sell_rate_kronor: "850,00", cost_rate_kronor: "" }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.cost_rate_ore, 0);
  assert.equal(parsed.input.sell_rate_ore, 85000);
});

test("workRole: an OMITTED cost field (not submitted at all) also defaults to 0 öre", () => {
  const parsed = parseWorkRoleForm(
    fd({ display_name: "Montör", sell_rate_kronor: "850,00" }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.cost_rate_ore, 0);
});

test("workRole: a MALFORMED cost (present but bad) is a field error and is NOT defaulted to 0", () => {
  // Critical distinction vs the blank/omitted default: a PRESENT-but-malformed cost is a
  // user mistake → field error + the value is NOT silently coerced to 0 (which would lose
  // the user's intent). The round-trip is blocked; the server never sees a coerced value.
  const parsed = parseWorkRoleForm(
    fd({ display_name: "Montör", sell_rate_kronor: "850,00", cost_rate_kronor: "-5" }),
  );
  assert.ok(parsed.fieldErrors.cost_rate_kronor);
  assert.equal("cost_rate_ore" in parsed.input, false);
});

test("workRole: the SELL rate is REQUIRED — a blank sell is a field error and no öre is attached", () => {
  const parsed = parseWorkRoleForm(
    fd({ display_name: "Montör", sell_rate_kronor: "   ", cost_rate_kronor: "450,00" }),
  );
  assert.ok(parsed.fieldErrors.sell_rate_kronor);
  assert.equal("sell_rate_ore" in parsed.input, false);
});

test("workRole: a malformed (float / sign / comma-thousands) sell rate is a field error, never coerced", () => {
  for (const bad of ["850.50", "+850", "1.000,00", "abc", "850 kr"]) {
    const parsed = parseWorkRoleForm(
      fd({ display_name: "Montör", sell_rate_kronor: bad, cost_rate_kronor: "450,00" }),
    );
    assert.ok(parsed.fieldErrors.sell_rate_kronor, `sell=${bad} → field error`);
    assert.equal("sell_rate_ore" in parsed.input, false, `sell=${bad} → no öre`);
  }
});

test("workRole: BOTH a missing name and a malformed sell raise INDEPENDENT field errors", () => {
  const parsed = parseWorkRoleForm(
    fd({ sell_rate_kronor: "850.50", cost_rate_kronor: "450,00" }),
  );
  assert.ok(parsed.fieldErrors.display_name);
  assert.ok(parsed.fieldErrors.sell_rate_kronor);
});

test("workRole: an optional id makes it an UPDATE; absent → CREATE (no id on the input)", () => {
  const update = parseWorkRoleForm(
    fd({
      id: "11111111-1111-4111-8111-111111111111",
      display_name: "Montör",
      sell_rate_kronor: "850,00",
    }),
  );
  assert.equal(update.input.id, "11111111-1111-4111-8111-111111111111");

  const create = parseWorkRoleForm(
    fd({ display_name: "Montör", sell_rate_kronor: "850,00" }),
  );
  assert.equal("id" in create.input, false);
});

test("workRole: the submitted RAW values are echoed back so the form preserves input on failure", () => {
  const parsed = parseWorkRoleForm(
    fd({
      display_name: "Montör",
      cost_rate_kronor: "450,00",
      sell_rate_kronor: "850.50", // malformed → the whole form re-renders with input
    }),
  );
  assert.equal(parsed.values.display_name, "Montör");
  assert.equal(parsed.values.cost_rate_kronor, "450,00");
  assert.equal(parsed.values.sell_rate_kronor, "850.50");
});

// ── article form: optional sku/unit + no-supplier-scope + price boundary ─────────

test("article: a valid minimal form (name + unit price) converts the price to integer öre", () => {
  const parsed = parseArticleForm(fd({ name: "Kabel 3G1.5", unit_price_kronor: "12,50" }));
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.name, "Kabel 3G1.5");
  assert.equal(parsed.input.unit_price_ore, 1250);
});

test("article: a missing name is a field error", () => {
  const parsed = parseArticleForm(fd({ unit_price_kronor: "12,50" }));
  assert.ok(parsed.fieldErrors.name);
});

test("article: the unit price is REQUIRED — a blank price is a field error and no öre is attached", () => {
  const parsed = parseArticleForm(fd({ name: "Kabel", unit_price_kronor: "  " }));
  assert.ok(parsed.fieldErrors.unit_price_kronor);
  assert.equal("unit_price_ore" in parsed.input, false);
});

test("article: a malformed unit price is a field error, never coerced to a number", () => {
  for (const bad of ["12.50", "-1", "12,505", "abc"]) {
    const parsed = parseArticleForm(fd({ name: "Kabel", unit_price_kronor: bad }));
    assert.ok(parsed.fieldErrors.unit_price_kronor, `price=${bad} → field error`);
    assert.equal("unit_price_ore" in parsed.input, false, `price=${bad} → no öre`);
  }
});

test("article: a PRESENT optional sku/unit is forwarded trimmed", () => {
  const parsed = parseArticleForm(
    fd({ name: "Kabel", sku: "  K-3G15  ", unit: "  m  ", unit_price_kronor: "12,50" }),
  );
  assert.equal(parsed.input.sku, "K-3G15");
  assert.equal(parsed.input.unit, "m");
});

test("article: an OMITTED optional sku/unit parses to undefined (not an empty string)", () => {
  const parsed = parseArticleForm(fd({ name: "Kabel", unit_price_kronor: "12,50" }));
  assert.equal(parsed.input.sku, undefined);
  assert.equal(parsed.input.unit, undefined);
});

test("article: a CLEARED optional sku/unit (blank / whitespace) parses to undefined (no spurious empty value)", () => {
  const parsed = parseArticleForm(
    fd({ name: "Kabel", sku: "   ", unit: "", unit_price_kronor: "12,50" }),
  );
  assert.equal(parsed.input.sku, undefined);
  assert.equal(parsed.input.unit, undefined);
});

test("article: HARD no-supplier-scope — a smuggled supplier control is NEVER parsed onto the input", () => {
  // The article form has no supplier control; even if a client forges supplier-ish form
  // fields, the parser reads ONLY the minimal manual fields (the command validator strips
  // anything else regardless). None of these forbidden keys reach the command input.
  const parsed = parseArticleForm(
    fd({
      name: "Kabel 3G1.5",
      unit_price_kronor: "12,50",
      supplier_id: "SUP-1",
      vendor: "Ahlsell",
      sync_token: "abc",
      fortnox_article_id: "F-1",
      api_key: "secret",
      external_ref: "EXT-1",
      import_batch: "B-1",
      edi_code: "E-1",
      supplier_mapping: "x",
    }),
  );
  for (const forbidden of [
    "supplier_id",
    "vendor",
    "sync_token",
    "fortnox_article_id",
    "api_key",
    "external_ref",
    "import_batch",
    "edi_code",
    "supplier_mapping",
  ]) {
    assert.equal(forbidden in parsed.input, false, `${forbidden} must never be parsed onto the input`);
  }
  assert.equal(parsed.input.name, "Kabel 3G1.5");
  assert.equal(parsed.input.unit_price_ore, 1250);
});

test("article: an optional id makes it an UPDATE; absent → CREATE (no id on the input)", () => {
  const update = parseArticleForm(
    fd({ id: "22222222-2222-4222-8222-222222222222", name: "Kabel", unit_price_kronor: "12,50" }),
  );
  assert.equal(update.input.id, "22222222-2222-4222-8222-222222222222");

  const create = parseArticleForm(fd({ name: "Kabel", unit_price_kronor: "12,50" }));
  assert.equal("id" in create.input, false);
});

test("article: the submitted RAW values are echoed back so the form preserves input on failure", () => {
  const parsed = parseArticleForm(
    fd({ name: "Kabel", sku: "K-1", unit: "m", unit_price_kronor: "12.50" }),
  );
  assert.equal(parsed.values.name, "Kabel");
  assert.equal(parsed.values.sku, "K-1");
  assert.equal(parsed.values.unit, "m");
  assert.equal(parsed.values.unit_price_kronor, "12.50");
});

// ── archive form: id-only ─────────────────────────────────────────────────────────

test("archive: a present id parses; a missing id is a field error", () => {
  const ok = parseArchiveForm(fd({ id: "11111111-1111-4111-8111-111111111111" }));
  assert.deepEqual(ok.fieldErrors, {});
  assert.equal(ok.input.id, "11111111-1111-4111-8111-111111111111");

  const bad = parseArchiveForm(fd({}));
  assert.ok(bad.fieldErrors.id);
});

test("archive: a blank id is a field error; a non-UUID string passes through (server rejects)", () => {
  const blank = parseArchiveForm(fd({ id: "   " }));
  assert.ok(blank.fieldErrors.id);

  const nonUuid = parseArchiveForm(fd({ id: "not-a-uuid" }));
  assert.deepEqual(nonUuid.fieldErrors, {});
  assert.equal(nonUuid.input.id, "not-a-uuid");
});

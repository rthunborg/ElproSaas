/**
 * Story 3.3 — unit tests for the PURE settings FormData parsers
 * (`src/features/settings/form-parsing.ts`). Pin the client-side (UX nicety) field
 * validation + the percent→basis-points boundary conversion (the stored value is never
 * a float) + the sign-off STOP-CONDITION (saving terms NEVER carries an approval
 * field), WITHOUT a browser. Runs under `node --test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseApproveTermsForm,
  parseCompanySettingsForm,
  parseQuoteTermsForm,
} from "@/features/settings/form-parsing";

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) form.set(k, v);
  return form;
}

test("company: a valid form converts the percent to integer basis points", () => {
  const parsed = parseCompanySettingsForm(
    fd({
      company_name: "Elpro Pilot AB",
      default_vat_display: "company_togglable",
      vat_rate_percent: "25",
    }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.vat_rate_bp, 2500);
  assert.equal(Number.isInteger(parsed.input.vat_rate_bp as number), true);
});

test("company: a missing company_name is a field error", () => {
  const parsed = parseCompanySettingsForm(
    fd({ default_vat_display: "company_togglable", vat_rate_percent: "25" }),
  );
  assert.ok(parsed.fieldErrors.company_name);
});

test("company: an out-of-range VAT rate is a field error AND no bp is attached", () => {
  const parsed = parseCompanySettingsForm(
    fd({
      company_name: "Elpro Pilot AB",
      default_vat_display: "company_togglable",
      vat_rate_percent: "250", // 250 % — out of [0,100]
    }),
  );
  assert.ok(parsed.fieldErrors.vat_rate_percent);
  // The malformed rate is NEVER coerced into a basis-points value on the input.
  assert.equal("vat_rate_bp" in parsed.input, false);
  // Input is preserved for the form to re-render.
  assert.equal(parsed.values.vat_rate_percent, "250");
  assert.equal(parsed.values.company_name, "Elpro Pilot AB");
});

test("terms: a non-empty terms_text parses; NO approval field is ever produced", () => {
  const parsed = parseQuoteTermsForm(
    fd({ terms_text: "Betalningsvillkor 30 dagar (platshållartext)" }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(
    parsed.input.terms_text,
    "Betalningsvillkor 30 dagar (platshållartext)",
  );
  assert.equal("approved_at" in parsed.input, false);
  assert.equal("approved" in parsed.input, false);
});

test("terms: a blank terms_text is a field error", () => {
  const parsed = parseQuoteTermsForm(fd({ terms_text: "   " }));
  assert.ok(parsed.fieldErrors.terms_text);
});

test("approve: the id-only form parses; a missing id is a field error", () => {
  const ok = parseApproveTermsForm(
    fd({ id: "11111111-1111-4111-8111-111111111111" }),
  );
  assert.deepEqual(ok.fieldErrors, {});
  assert.equal(ok.input.id, "11111111-1111-4111-8111-111111111111");

  const bad = parseApproveTermsForm(fd({}));
  assert.ok(bad.fieldErrors.id);
});

// ── company: optional-field omitted vs cleared semantics ────────────────────────

test("company: an OMITTED optional field parses to undefined (not the empty string)", () => {
  // org_nr / address / contact are all optional; when not submitted at all they must be
  // `undefined` on the input (the server treats undefined as 'unchanged/absent'), never
  // a coerced empty string that could clobber a stored value.
  const parsed = parseCompanySettingsForm(
    fd({
      company_name: "Elpro Pilot AB",
      default_vat_display: "company_togglable",
      vat_rate_percent: "25",
    }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  for (const key of [
    "org_nr",
    "address_line1",
    "address_line2",
    "postal_code",
    "city",
    "email",
    "phone",
    "logo_url",
  ]) {
    assert.equal(parsed.input[key], undefined, `${key} omitted → undefined`);
  }
});

test("company: a CLEARED optional field (blank / whitespace-only) parses to undefined", () => {
  // The user emptied the field. `field()` trims and treats blank as absent → undefined,
  // so a blank submission does not become a spurious empty-string value on the input.
  const parsed = parseCompanySettingsForm(
    fd({
      company_name: "Elpro Pilot AB",
      org_nr: "   ",
      city: "",
      email: "  ",
      default_vat_display: "company_togglable",
      vat_rate_percent: "25",
    }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.org_nr, undefined);
  assert.equal(parsed.input.city, undefined);
  assert.equal(parsed.input.email, undefined);
});

test("company: a PRESENT optional field is forwarded trimmed", () => {
  const parsed = parseCompanySettingsForm(
    fd({
      company_name: "Elpro Pilot AB",
      org_nr: "  556677-8899  ",
      default_vat_display: "company_togglable",
      vat_rate_percent: "25",
    }),
  );
  assert.equal(parsed.input.org_nr, "556677-8899");
});

test("company: default_vat_display is forwarded VERBATIM (the server validates the enum)", () => {
  // The parser does not validate the enum — it forwards whatever was submitted so the
  // server's validateInput is the single authority. A bad value reaches the server as-is.
  const parsed = parseCompanySettingsForm(
    fd({
      company_name: "Elpro Pilot AB",
      default_vat_display: "company_excl",
      vat_rate_percent: "25",
    }),
  );
  assert.equal(parsed.input.default_vat_display, "company_excl");

  const badEnum = parseCompanySettingsForm(
    fd({
      company_name: "Elpro Pilot AB",
      default_vat_display: "totally-bogus",
      vat_rate_percent: "25",
    }),
  );
  // No client-side enum check — the value is forwarded, no field error raised here.
  assert.equal(badEnum.input.default_vat_display, "totally-bogus");
  assert.equal("default_vat_display" in badEnum.fieldErrors, false);
});

test("company: a missing default_vat_display forwards undefined (server rejects it)", () => {
  const parsed = parseCompanySettingsForm(
    fd({ company_name: "Elpro Pilot AB", vat_rate_percent: "25" }),
  );
  assert.equal(parsed.input.default_vat_display, undefined);
});

test("company: a blank VAT rate is a field error AND no bp is attached", () => {
  const parsed = parseCompanySettingsForm(
    fd({
      company_name: "Elpro Pilot AB",
      default_vat_display: "company_togglable",
      vat_rate_percent: "   ",
    }),
  );
  assert.ok(parsed.fieldErrors.vat_rate_percent);
  assert.equal("vat_rate_bp" in parsed.input, false);
});

test("company: BOTH a missing name and a bad rate raise INDEPENDENT field errors", () => {
  const parsed = parseCompanySettingsForm(
    fd({ default_vat_display: "company_togglable", vat_rate_percent: "999" }),
  );
  assert.ok(parsed.fieldErrors.company_name);
  assert.ok(parsed.fieldErrors.vat_rate_percent);
  assert.equal("vat_rate_bp" in parsed.input, false);
});

// ── terms: trim + echo-back ─────────────────────────────────────────────────────

test("terms: a present terms_text is trimmed on the input; values echo the RAW submission", () => {
  const parsed = parseQuoteTermsForm(fd({ terms_text: "  Villkor  " }));
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.terms_text, "Villkor");
  // The echoed value preserves what the user typed (so the form re-renders verbatim).
  assert.equal(parsed.values.terms_text, "  Villkor  ");
});

test("terms: a missing terms_text field is a field error", () => {
  const parsed = parseQuoteTermsForm(fd({}));
  assert.ok(parsed.fieldErrors.terms_text);
  assert.equal(parsed.input.terms_text, undefined);
});

// ── approve: id-shape passthrough ───────────────────────────────────────────────

test("approve: a blank id is a field error; a non-UUID string still passes through (server rejects)", () => {
  // The parser only checks presence — UUID-shape is the server validator's job.
  const blank = parseApproveTermsForm(fd({ id: "   " }));
  assert.ok(blank.fieldErrors.id);

  const nonUuid = parseApproveTermsForm(fd({ id: "not-a-uuid" }));
  assert.deepEqual(nonUuid.fieldErrors, {});
  assert.equal(nonUuid.input.id, "not-a-uuid");
});

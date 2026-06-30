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

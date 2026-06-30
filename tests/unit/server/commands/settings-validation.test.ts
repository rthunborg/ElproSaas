/**
 * Story 3.3 — PURE-LOGIC tests for the settings input validators
 * (`@/server/commands/settings/validation`). Pin the exact branch boundaries WITHOUT
 * a database (the DB-backed command envelope tests drive a handful through Vitest;
 * this exhaustively pins the pure validators):
 *   - updateCompanySettings: default_vat_display enum surface; vat_rate_bp INTEGER
 *     basis-points range [0,10000] + float/non-integer rejection; optional identity
 *     fields validated only when present; non-record inputs; tenant_id stripped.
 *   - updateQuoteTerms: terms_text required + non-blank; NO approval field ever read.
 *   - approveQuoteTerms: id UUID-shape guard.
 *
 * Runs under `node --test` (pure, no I/O). Every assertion encodes EXPECTED behavior.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VAT_DISPLAY_MODES,
  validateApproveQuoteTerms,
  validateUpdateCompanySettings,
  validateUpdateQuoteTerms,
} from "@/server/commands/settings/validation";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function assertRejected(result: { ok: boolean }, label: string): void {
  assert.equal(result.ok, false, `expected VALIDATION_FAILED: ${label}`);
  const r = result as { ok: false; code?: string; data?: unknown };
  assert.equal(r.code, "VALIDATION_FAILED", `wrong code: ${label}`);
  assert.equal("data" in r, false, `rejection must not carry data: ${label}`);
}

// ── updateCompanySettings ──────────────────────────────────────────────────────

test("company: a valid minimal input (display + integer bp) is accepted", () => {
  const r = validateUpdateCompanySettings({
    company_name: "Elpro Pilot AB",
    default_vat_display: "company_togglable",
    vat_rate_bp: 2500,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.vat_rate_bp, 2500);
    assert.equal(r.data.default_vat_display, "company_togglable");
  }
});

test("company: both enum display modes are accepted", () => {
  for (const mode of VAT_DISPLAY_MODES) {
    const r = validateUpdateCompanySettings({
      default_vat_display: mode,
      vat_rate_bp: 0,
    });
    assert.equal(r.ok, true, `mode ${mode} should be accepted`);
  }
});

test("company: an unknown default_vat_display value is rejected", () => {
  assertRejected(
    validateUpdateCompanySettings({
      default_vat_display: "not-a-mode",
      vat_rate_bp: 2500,
    }),
    "unknown display mode",
  );
});

test("company: vat_rate_bp out of range (>10000 or <0) is rejected", () => {
  assertRejected(
    validateUpdateCompanySettings({
      default_vat_display: "company_togglable",
      vat_rate_bp: 10001,
    }),
    "10001 > 10000",
  );
  assertRejected(
    validateUpdateCompanySettings({
      default_vat_display: "company_togglable",
      vat_rate_bp: -1,
    }),
    "-1 < 0",
  );
});

test("company: a float / non-integer vat_rate_bp is rejected (basis points are integers)", () => {
  assertRejected(
    validateUpdateCompanySettings({
      default_vat_display: "company_togglable",
      vat_rate_bp: 25.5,
    }),
    "float bp",
  );
  assertRejected(
    validateUpdateCompanySettings({
      default_vat_display: "company_togglable",
      vat_rate_bp: "2500" as unknown,
    }),
    "string bp",
  );
});

test("company: the [0,10000] boundaries are inclusive", () => {
  for (const bp of [0, 10000]) {
    const r = validateUpdateCompanySettings({
      default_vat_display: "company_togglable",
      vat_rate_bp: bp,
    });
    assert.equal(r.ok, true, `boundary ${bp} should be accepted`);
  }
});

test("company: a present-but-malformed email is rejected; absent is fine", () => {
  assertRejected(
    validateUpdateCompanySettings({
      default_vat_display: "company_togglable",
      vat_rate_bp: 2500,
      email: "not-an-email",
    }),
    "bad email",
  );
  const r = validateUpdateCompanySettings({
    default_vat_display: "company_togglable",
    vat_rate_bp: 2500,
  });
  assert.equal(r.ok, true);
});

test("company: a client-supplied tenant_id is NEVER part of the validated value", () => {
  const r = validateUpdateCompanySettings({
    tenant_id: "99999999-9999-4999-8999-999999999999",
    default_vat_display: "company_togglable",
    vat_rate_bp: 2500,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal("tenant_id" in r.data, false, "tenant_id must be stripped");
  }
});

test("company: a non-record input is rejected", () => {
  assertRejected(validateUpdateCompanySettings(null), "null");
  assertRejected(validateUpdateCompanySettings("x"), "string");
});

test("company: a present-but-malformed phone is rejected; a well-formed one is accepted; absent is fine", () => {
  assertRejected(
    validateUpdateCompanySettings({
      default_vat_display: "company_togglable",
      vat_rate_bp: 2500,
      phone: "abc", // letters — not a phone shape
    }),
    "bad phone",
  );
  assertRejected(
    validateUpdateCompanySettings({
      default_vat_display: "company_togglable",
      vat_rate_bp: 2500,
      phone: "12", // < 5 chars
    }),
    "too-short phone",
  );
  const ok = validateUpdateCompanySettings({
    default_vat_display: "company_togglable",
    vat_rate_bp: 2500,
    phone: "+46 70 123 45 67",
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.data.phone, "+46 70 123 45 67");
});

test("company: an over-length identity field is rejected (defensive bound)", () => {
  const tooLong = "x".repeat(257); // MAX_TEXT is 256
  assertRejected(
    validateUpdateCompanySettings({
      default_vat_display: "company_togglable",
      vat_rate_bp: 2500,
      org_nr: tooLong,
    }),
    "over-length org_nr",
  );
  // A long-text field (address) tolerates up to 512.
  const addr512 = "x".repeat(512);
  const ok = validateUpdateCompanySettings({
    default_vat_display: "company_togglable",
    vat_rate_bp: 2500,
    address_line1: addr512,
  });
  assert.equal(ok.ok, true);
  assertRejected(
    validateUpdateCompanySettings({
      default_vat_display: "company_togglable",
      vat_rate_bp: 2500,
      address_line1: "x".repeat(513),
    }),
    "over-length address",
  );
});

test("company: a present non-string identity field is rejected", () => {
  // A numeric / object value in an optional text slot is present-but-bad → rejected.
  assertRejected(
    validateUpdateCompanySettings({
      default_vat_display: "company_togglable",
      vat_rate_bp: 2500,
      company_name: 12345 as unknown as string,
    }),
    "numeric company_name",
  );
});

test("company: a missing default_vat_display (undefined) is rejected", () => {
  assertRejected(
    validateUpdateCompanySettings({ vat_rate_bp: 2500 }),
    "missing display",
  );
});

test("company: a missing vat_rate_bp is rejected (the rate is required)", () => {
  assertRejected(
    validateUpdateCompanySettings({ default_vat_display: "company_togglable" }),
    "missing rate",
  );
});

test("company: optional identity fields survive onto the validated value when present", () => {
  const r = validateUpdateCompanySettings({
    default_vat_display: "company_excl",
    vat_rate_bp: 1200,
    company_name: "Full AB",
    org_nr: "556677-8899",
    address_line1: "Storgatan 1",
    address_line2: "2 tr",
    postal_code: "11122",
    city: "Stockholm",
    email: "info@example.com",
    phone: "+46 8 123 456",
    logo_url: "https://example.com/logo.png",
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.company_name, "Full AB");
    assert.equal(r.data.address_line2, "2 tr");
    assert.equal(r.data.email, "info@example.com");
    assert.equal(r.data.logo_url, "https://example.com/logo.png");
  }
});

test("terms: an over-length terms_text is rejected (generous but bounded)", () => {
  assertRejected(
    validateUpdateQuoteTerms({ terms_text: "x".repeat(20001) }),
    "over-length terms",
  );
  // The generous cap itself is accepted.
  const ok = validateUpdateQuoteTerms({ terms_text: "x".repeat(20000) });
  assert.equal(ok.ok, true);
});

test("terms: a non-string terms_text is rejected", () => {
  assertRejected(
    validateUpdateQuoteTerms({ terms_text: 42 as unknown as string }),
    "numeric terms",
  );
});

test("approve: a non-record / non-string id is rejected", () => {
  assertRejected(validateApproveQuoteTerms(null), "null");
  assertRejected(validateApproveQuoteTerms({ id: 123 as unknown }), "numeric id");
  assertRejected(
    validateApproveQuoteTerms({ id: `${VALID_UUID}x` }),
    "over-length uuid-ish",
  );
});

test("approve: the validated value carries ONLY the id (no smuggled fields survive)", () => {
  const r = validateApproveQuoteTerms({
    id: VALID_UUID,
    approved_at: "2026-06-30T12:00:00.000Z",
    tenant_id: "99999999-9999-4999-8999-999999999999",
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(Object.keys(r.data), ["id"]);
  }
});

// ── updateQuoteTerms ───────────────────────────────────────────────────────────

test("terms: a non-empty terms_text is accepted and trimmed; NO approval field survives", () => {
  const r = validateUpdateQuoteTerms({
    terms_text: "  Betalningsvillkor 30 dagar  ",
    approved_at: "2026-06-30T12:00:00.000Z", // a smuggled approval must be ignored
    approved: true,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.terms_text, "Betalningsvillkor 30 dagar");
    assert.equal("approved_at" in r.data, false);
    assert.equal("approved" in r.data, false);
  }
});

test("terms: a blank/missing terms_text is rejected", () => {
  assertRejected(validateUpdateQuoteTerms({ terms_text: "   " }), "blank");
  assertRejected(validateUpdateQuoteTerms({}), "missing");
  assertRejected(validateUpdateQuoteTerms(null), "null");
});

// ── approveQuoteTerms ────────────────────────────────────────────────────────────

test("approve: a UUID-shaped id is accepted; a bad id is rejected", () => {
  const r = validateApproveQuoteTerms({ id: VALID_UUID });
  assert.equal(r.ok, true);
  assertRejected(validateApproveQuoteTerms({ id: "not-a-uuid" }), "bad id");
  assertRejected(validateApproveQuoteTerms({}), "missing id");
});

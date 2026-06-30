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

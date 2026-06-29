// @ts-nocheck
/**
 * Story 2.3 — RED-PHASE ATDD scaffold (TEA testarch-atdd, 2026-06-29).
 *
 * PURE-LOGIC acceptance tests for the audit METADATA SANITIZER
 * (`@/server/commands/audit-metadata`), exercising AC5 / R-010: metadata is an
 * ALLOW-LIST, never free pass-through. Forbidden content (secrets, `.env` values,
 * raw file contents, service-role key material, full request bodies, broad
 * free-text PII) must be DROPPED/REJECTED — proven "impossible by construction",
 * not by hoping callers behave.
 *
 * RED PHASE: every `test(...)` is `{ skip: "RED: ..." }` and imports
 * `@/server/commands/audit-metadata`, which does NOT exist yet. Remove the skip +
 * `@ts-nocheck` once Story 2.3 implements `sanitizeAuditMetadata`.
 *
 * COVERAGE (test-design-epic-2.md P1, R-010; story AC5; Task 4.3 / 5.1).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const RED = { skip: "RED: pending Story 2.3 audit-metadata sanitizer" } as const;

// RED: imported DYNAMICALLY inside each (skipped) test body so the missing-module
// throw never fires while RED — a static import would crash file load before the
// `{ skip }` applies. Drop the `{ skip }` + `@ts-nocheck` when the module lands.
async function load() {
  const { sanitizeAuditMetadata } = await import("@/server/commands/audit-metadata");
  return { sanitizeAuditMetadata };
}

test("R-010: a planted fake secret/api key is DROPPED from the persisted metadata", RED, async () => {
  const { sanitizeAuditMetadata } = await load();
  const out = sanitizeAuditMetadata({
    reason: "membership_disabled",
    apiKey: "sk_live_0000000000000000deadbeef", // forbidden — must not persist
    serviceRoleKey: "eyJhbGciOi...service-role...", // forbidden
  });

  assert.equal("apiKey" in out, false);
  assert.equal("serviceRoleKey" in out, false);
  // The safe enum field survives.
  assert.equal(out.reason, "membership_disabled");
});

test("R-010: an `.env`-looking blob is never persisted", RED, async () => {
  const { sanitizeAuditMetadata } = await load();
  const out = sanitizeAuditMetadata({
    env: "SUPABASE_SERVICE_ROLE_KEY=eyJ...\nDATABASE_URL=postgres://u:p@h/db",
    reason: "settings_updated",
  });

  assert.equal("env" in out, false);
  const serialized = JSON.stringify(out);
  assert.equal(/SERVICE_ROLE_KEY|DATABASE_URL|postgres:\/\//.test(serialized), false);
});

test("R-010: raw file contents / a full request body are dropped (not a safe field)", RED, async () => {
  const { sanitizeAuditMetadata } = await load();
  const out = sanitizeAuditMetadata({
    fileContents: "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----",
    requestBody: { password: "hunter2", ssn: "830101-0000", note: "x".repeat(5000) },
    reason: "file_attached",
  });

  assert.equal("fileContents" in out, false);
  assert.equal("requestBody" in out, false);
  const serialized = JSON.stringify(out);
  assert.equal(/PRIVATE KEY|hunter2|830101/.test(serialized), false);
});

test("R-010: a long free-text PII blob is rejected/dropped (allow-list is scalar safe fields only)", RED, async () => {
  const longPii =
    "Customer Anna Andersson, personnummer 19830101-0000, address Storgatan 1, phone 070-0000000, " +
    "lorem ipsum ".repeat(50);

  const { sanitizeAuditMetadata } = await load();
  const out = sanitizeAuditMetadata({ note: longPii, reason: "note_added" });

  // Either the field is dropped entirely, or it is not the raw blob — never persisted verbatim.
  const serialized = JSON.stringify(out);
  assert.equal(serialized.includes("19830101-0000"), false);
  assert.equal(serialized.includes("070-0000000"), false);
});

test("R-010: pre-approved safe scalar fields PASS unchanged (before/after hashes, enum reason, scoped ids)", RED, async () => {
  const { sanitizeAuditMetadata } = await load();
  const out = sanitizeAuditMetadata({
    reason: "quote_accepted",
    beforeHash: "sha256:aaaa",
    afterHash: "sha256:bbbb",
    targetVersion: 3,
  });

  assert.equal(out.reason, "quote_accepted");
  assert.equal(out.beforeHash, "sha256:aaaa");
  assert.equal(out.afterHash, "sha256:bbbb");
  assert.equal(out.targetVersion, 3);
});

test("R-010: an empty / no-metadata input yields a safe empty object (never null/undefined leakage)", RED, async () => {
  const { sanitizeAuditMetadata } = await load();
  const out = sanitizeAuditMetadata({});
  assert.deepEqual(out, {});
});

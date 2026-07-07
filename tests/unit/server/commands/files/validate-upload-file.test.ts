/**
 * Story 8.2 — ATDD RED-PHASE scaffold: the PURE `validateUploadFile` input validator
 * unit pins (AC2, P0 — 8.2-UNIT-03, R-808).
 *
 * `validateUploadFile(raw)` extends `src/server/commands/files/validation.ts` (Task 2.1)
 * and returns a `ValidationResult<UploadFileInput>`. It validates STRUCTURALLY, PURELY,
 * with NO I/O — reusing the existing `isOwnerType` / `isFilePurpose` / `isUuidLike`
 * closed-union guards (do NOT reinvent them). The raw invalid value is NEVER echoed (the
 * envelope maps VALIDATION_FAILED to a generic user-safe message).
 *
 * The validator is the SERVER authority (AC2): a client `tenant_id` / `object_path` /
 * `bucket_id` is NEVER read (server-derived only — stripped/ignored). A blocked MIME or
 * oversized value fails as VALIDATION_FAILED. The owner_type↔purpose coupling SHOULD be
 * enforced so a mismatched pair (e.g. `job` owner + `crm_document` purpose) is rejected.
 *
 * Coverage (mapped to the epic test design + story Task 2 / Task 7.1):
 *   - 8.2-UNIT-03a (P0): a fully-valid own-shape input ACCEPTS (narrowed value returned).
 *   - 8.2-UNIT-03b (P0): a blocked MIME → VALIDATION_FAILED.
 *   - 8.2-UNIT-03c (P0): an oversized size_bytes → VALIDATION_FAILED.
 *   - 8.2-UNIT-03d (P0): a non-UUID owner_id / bad owner_type / bad purpose → VALIDATION_FAILED.
 *   - 8.2-UNIT-03e (P0): an UNKNOWN owner_type (deferred module) → VALIDATION_FAILED (STOP).
 *   - 8.2-UNIT-03f (P1): a mismatched owner_type↔purpose pair → VALIDATION_FAILED.
 *   - 8.2-UNIT-03g (P0): a client-supplied tenant_id/object_path/bucket_id is NOT surfaced
 *     on the narrowed result (server-derived only).
 *
 * ── RED until Story 8.2 dev adds `validateUploadFile` + `UploadFileInput` (Task 2.1) ──
 * Imports the not-yet-created validator + type. Compile/import-fails until Task 2 exports
 * them from `files/validation.ts`. The valid-input shape below reflects the intended
 * `UploadFileInput` (owner_type/owner_id/purpose/display_name/mime_type/size_bytes) — if
 * dev names a field differently, align this builder; the ACCEPT/REJECT contract stands.
 *
 * Runs under `node --test` (pure, no DB, no PII).
 *
 * [Source: story 8.2 Task 2 / Task 7.1; test-design-epic-8.md §P0 (R-808);
 *  src/server/commands/files/validation.ts (the guards to reuse); epics.md 8.2 AC2]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateUploadFile,
  type UploadFileInput,
} from "@/server/commands/files/validation";

/** A fully-valid own-shape upload input (a customer CRM document — an ACTIVE owner type). */
function validRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    owner_type: "customer",
    owner_id: crypto.randomUUID(),
    purpose: "crm_document",
    display_name: "kundavtal.pdf",
    mime_type: "application/pdf",
    size_bytes: 12_345,
    ...overrides,
  };
}

test("[8.2-UNIT-03a][P0/AC2] a fully-valid own-shape input ACCEPTS with a narrowed value", () => {
  const result = validateUploadFile(validRaw());
  assert.equal(result.ok, true);
  if (result.ok) {
    const data: UploadFileInput = result.data;
    assert.equal(data.owner_type, "customer");
    assert.equal(data.purpose, "crm_document");
    assert.equal(data.mime_type, "application/pdf");
  }
});

test("[8.2-UNIT-03b][P0/AC2] a BLOCKED MIME → VALIDATION_FAILED", () => {
  const result = validateUploadFile(validRaw({ mime_type: "application/x-msdownload" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "VALIDATION_FAILED");
});

test("[8.2-UNIT-03c][P0/AC2] an OVERSIZED size_bytes → VALIDATION_FAILED", () => {
  // 1 GiB — well over any conservative dev max (Task 1.1 max <= 50MiB).
  const result = validateUploadFile(validRaw({ size_bytes: 1024 * 1024 * 1024 }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "VALIDATION_FAILED");
});

test("[8.2-UNIT-03c][P0] a negative / non-integer size_bytes → VALIDATION_FAILED", () => {
  assert.equal(validateUploadFile(validRaw({ size_bytes: -1 })).ok, false);
  assert.equal(validateUploadFile(validRaw({ size_bytes: 1.5 })).ok, false);
  assert.equal(validateUploadFile(validRaw({ size_bytes: "big" })).ok, false);
});

test("[8.2-UNIT-03d][P0] a non-UUID owner_id / bad owner_type / bad purpose / empty name → VALIDATION_FAILED", () => {
  assert.equal(validateUploadFile(validRaw({ owner_id: "not-a-uuid" })).ok, false);
  assert.equal(validateUploadFile(validRaw({ owner_type: 123 })).ok, false);
  assert.equal(validateUploadFile(validRaw({ purpose: "bogus_purpose" })).ok, false);
  assert.equal(validateUploadFile(validRaw({ display_name: "" })).ok, false);
});

test("[8.2-UNIT-03e][P0] an UNKNOWN owner_type (deferred module) → VALIDATION_FAILED (STOP condition)", () => {
  // A deferred-module type (supplier/asset) is not in the closed OWNER_TYPES union.
  const result = validateUploadFile(validRaw({ owner_type: "supplier" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "VALIDATION_FAILED");
});

test("[8.2-UNIT-03f][P1] a MISMATCHED owner_type↔purpose pair → VALIDATION_FAILED", () => {
  // `job` owner requires `job_evidence`; pairing it with `crm_document` is a mismatch.
  const result = validateUploadFile(
    validRaw({ owner_type: "job", owner_id: crypto.randomUUID(), purpose: "crm_document" }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "VALIDATION_FAILED");
});

test("[8.2-UNIT-03f][P1] the CORRECT owner_type↔purpose pairs ACCEPT (active owner types)", () => {
  const pairs: { owner_type: string; purpose: string }[] = [
    { owner_type: "customer", purpose: "crm_document" },
    { owner_type: "facility", purpose: "crm_document" },
    { owner_type: "contact", purpose: "crm_document" },
    { owner_type: "calculation", purpose: "calculation_attachment" },
    { owner_type: "quote_acceptance", purpose: "acceptance_evidence" },
    { owner_type: "job", purpose: "job_evidence" },
  ];
  for (const p of pairs) {
    const result = validateUploadFile(
      validRaw({ owner_type: p.owner_type, owner_id: crypto.randomUUID(), purpose: p.purpose }),
    );
    assert.equal(result.ok, true, `${p.owner_type}+${p.purpose} should be a valid pair`);
  }
});

test("[8.2-UNIT-03g][P0/R-803] a client tenant_id/object_path/bucket_id is NOT read (server-derived only)", () => {
  const result = validateUploadFile(
    validRaw({
      tenant_id: crypto.randomUUID(),
      object_path: "../../etc/passwd",
      bucket_id: "some-other-bucket",
    }),
  );
  // The extra client-controlled path/tenant fields must NOT appear on the narrowed value —
  // the server derives tenant_id + object_path + bucket_id itself (never from the client).
  assert.equal(result.ok, true);
  if (result.ok) {
    const keys = Object.keys(result.data as Record<string, unknown>);
    assert.ok(!keys.includes("tenant_id"), "tenant_id must be stripped");
    assert.ok(!keys.includes("object_path"), "object_path must be stripped");
    assert.ok(!keys.includes("bucket_id"), "bucket_id must be stripped");
  }
});

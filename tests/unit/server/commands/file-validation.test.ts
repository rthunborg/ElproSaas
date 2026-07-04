/**
 * Story 8.1 — PURE file command validators + signed-URL TTL resolution (AC3/AC5/§14).
 *
 * The owner-type / purpose closed-union rules + the TTL env resolution are pure (no
 * I/O), so the fast `node --test` gate protects them: an unknown owner type (a
 * deferred-module STOP), a bad purpose, a non-uuid id, and a hardcoded/invalid TTL are
 * all caught here without a database.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateSignedAccess,
  validateCreateFileLink,
  isOwnerType,
  isActiveOwnerType,
  isFilePurpose,
  OWNER_TYPES,
  ACTIVE_OWNER_TYPES,
  FILE_PURPOSES,
} from "@/server/commands/files/validation";
import {
  resolveSignedUrlTtlSeconds,
  DEFAULT_SIGNED_URL_TTL_SECONDS,
} from "@/server/storage/signed-access";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";

test("[AC5] validateSignedAccess accepts a uuid file_id, rejects non-uuid / missing", () => {
  assert.equal(validateSignedAccess({ file_id: UUID_A }).ok, true);
  assert.equal(validateSignedAccess({ file_id: "not-a-uuid" }).ok, false);
  assert.equal(validateSignedAccess({}).ok, false);
  assert.equal(validateSignedAccess(null).ok, false);
});

test("[AC3] validateCreateFileLink accepts every ACTIVE owner type + a valid purpose", () => {
  for (const ownerType of ACTIVE_OWNER_TYPES) {
    const r = validateCreateFileLink({
      file_id: UUID_A,
      owner_type: ownerType,
      owner_id: UUID_B,
      purpose: "crm_document",
    });
    assert.equal(r.ok, true, `active owner type ${ownerType} must validate`);
  }
});

test("[AC3] validateCreateFileLink accepts the DEFERRED owner types STRUCTURALLY", () => {
  // quote_version / quote_acceptance / job pass validation (the "not-yet-available"
  // rejection is an EXECUTE-layer decision, not a validation one).
  for (const ownerType of ["quote_version", "quote_acceptance", "job"] as const) {
    const r = validateCreateFileLink({
      file_id: UUID_A,
      owner_type: ownerType,
      owner_id: UUID_B,
      purpose: "quote_attachment_snapshot",
    });
    assert.equal(r.ok, true, `deferred owner type ${ownerType} validates structurally`);
  }
});

test("[AC3] validateCreateFileLink REJECTS an unknown owner type (deferred-module STOP)", () => {
  for (const bad of ["supplier", "asset", "rental", "hr", "tender", "fku"]) {
    const r = validateCreateFileLink({
      file_id: UUID_A,
      owner_type: bad,
      owner_id: UUID_B,
      purpose: "crm_document",
    });
    assert.equal(r.ok, false, `unknown owner type ${bad} must be rejected`);
  }
});

test("[AC3] validateCreateFileLink REJECTS a bad purpose / non-uuid ids", () => {
  assert.equal(
    validateCreateFileLink({
      file_id: UUID_A,
      owner_type: "customer",
      owner_id: UUID_B,
      purpose: "not-a-purpose",
    }).ok,
    false,
  );
  assert.equal(
    validateCreateFileLink({
      file_id: "bad",
      owner_type: "customer",
      owner_id: UUID_B,
      purpose: "crm_document",
    }).ok,
    false,
  );
  assert.equal(
    validateCreateFileLink({
      file_id: UUID_A,
      owner_type: "customer",
      owner_id: "bad",
      purpose: "crm_document",
    }).ok,
    false,
  );
});

test("owner-type / purpose guards match the closed unions", () => {
  for (const t of OWNER_TYPES) assert.equal(isOwnerType(t), true);
  assert.equal(isOwnerType("supplier"), false);
  for (const t of ACTIVE_OWNER_TYPES) assert.equal(isActiveOwnerType(t), true);
  assert.equal(isActiveOwnerType("job"), false);
  assert.equal(isActiveOwnerType("quote_version"), false);
  for (const p of FILE_PURPOSES) assert.equal(isFilePurpose(p), true);
  assert.equal(isFilePurpose("bogus"), false);
});

test("[R-806] resolveSignedUrlTtlSeconds: env-driven with a safe default (no hardcode)", () => {
  assert.equal(resolveSignedUrlTtlSeconds(undefined), DEFAULT_SIGNED_URL_TTL_SECONDS);
  assert.equal(resolveSignedUrlTtlSeconds("1"), 1); // low value makes expiry testable
  assert.equal(resolveSignedUrlTtlSeconds("600"), 600);
  // Invalid / non-positive / non-integer fall back to the safe default.
  assert.equal(resolveSignedUrlTtlSeconds("0"), DEFAULT_SIGNED_URL_TTL_SECONDS);
  assert.equal(resolveSignedUrlTtlSeconds("-5"), DEFAULT_SIGNED_URL_TTL_SECONDS);
  assert.equal(resolveSignedUrlTtlSeconds("abc"), DEFAULT_SIGNED_URL_TTL_SECONDS);
  assert.equal(resolveSignedUrlTtlSeconds("1.5"), DEFAULT_SIGNED_URL_TTL_SECONDS);
});

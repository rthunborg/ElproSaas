/**
 * Story 8.2 — coverage-expansion UNIT pins for the PURE entity-file-panel FormData parsing
 * (`src/features/files/form-parsing.ts`, Task 4.3) — 8.2-UNIT-04 (P1, AC1/AC3, R-803).
 *
 * `parseUploadForm` reads ONLY owner_type/owner_id/purpose/display_name (trimmed, null on
 * blank) and NEVER surfaces a client-supplied object_path / bucket_id / tenant_id (server-
 * derived only — R-803). `precheckUpload` computes the CLIENT-SIDE discriminant from the
 * SAME pure policy the server re-checks: `blocked-type` when the mime is off the allow-list,
 * `too-large` when an allowed type exceeds the size limit, `none` when both pass. blocked-type
 * is the more specific signal and WINS when both would fail.
 *
 * These decisions previously escaped the fast gate — they were only exercised indirectly
 * through the `"use server"` `uploadFileAction`. This file pins them cheaply (pure, no DB,
 * no PII) under `node --test`.
 *
 * [Source: story 8.2 Task 4.3 / Task 7.1; src/features/files/form-parsing.ts;
 *  src/server/storage/upload-policy.ts (the allow-list + size limit the pre-check mirrors);
 *  epics.md 8.2 AC1/AC3; test-design-epic-8.md §Coverage-shape lesson (R-811)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUploadForm, precheckUpload } from "@/features/files/form-parsing";
import {
  MAX_UPLOAD_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from "@/server/storage/upload-policy";

const OWNER_ID = "11111111-1111-1111-1111-111111111111";

/** Build a FormData from a flat record (only string entries). */
function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) form.set(k, v);
  return form;
}

test("[8.2-UNIT-04a][P1/AC1] parseUploadForm reads owner/purpose/name (trimmed)", () => {
  const parsed = parseUploadForm(
    fd({
      owner_type: "  customer  ",
      owner_id: `  ${OWNER_ID}  `,
      purpose: " crm_document ",
      display_name: "  kundavtal.pdf  ",
    }),
  );
  assert.equal(parsed.ownerType, "customer");
  assert.equal(parsed.ownerId, OWNER_ID);
  assert.equal(parsed.purpose, "crm_document");
  assert.equal(parsed.displayName, "kundavtal.pdf");
});

test("[8.2-UNIT-04b][P1] parseUploadForm returns null for absent / blank / whitespace fields", () => {
  const parsed = parseUploadForm(fd({ owner_type: "customer", display_name: "   " }));
  assert.equal(parsed.ownerType, "customer");
  // Absent owner_id / purpose → null; whitespace-only display_name → null (not "").
  assert.equal(parsed.ownerId, null);
  assert.equal(parsed.purpose, null);
  assert.equal(parsed.displayName, null);
});

test("[8.2-UNIT-04c][P0/R-803] a client object_path / bucket_id / tenant_id is NEVER surfaced", () => {
  // A bypassed client could inject path/bucket/tenant fields — the parser must ignore them;
  // the server derives the path (never from the client). The parsed shape has ONLY the four
  // safe fields, so a smuggled traversal path can never reach the object path.
  const parsed = parseUploadForm(
    fd({
      owner_type: "customer",
      owner_id: OWNER_ID,
      purpose: "crm_document",
      display_name: "x.pdf",
      object_path: "../../etc/passwd",
      bucket_id: "some-other-bucket",
      tenant_id: "99999999-9999-9999-9999-999999999999",
    }),
  );
  const keys = Object.keys(parsed as unknown as Record<string, unknown>);
  assert.deepEqual(keys.sort(), ["displayName", "ownerId", "ownerType", "purpose"]);
  assert.ok(!keys.includes("objectPath"));
  assert.ok(!keys.includes("bucketId"));
  assert.ok(!keys.includes("tenantId"));
});

test("[8.2-UNIT-04d][P1/AC3] precheckUpload → none when an allowed type is within the size limit", () => {
  const allowed = ALLOWED_MIME_TYPES[0];
  assert.equal(precheckUpload(allowed, 1_024), "none");
  // Exactly-at-limit still passes (boundary — mirrors isWithinSizeLimit).
  assert.equal(precheckUpload(allowed, MAX_UPLOAD_SIZE_BYTES), "none");
});

test("[8.2-UNIT-04e][P1/AC3] precheckUpload → blocked-type for a disallowed mime", () => {
  assert.equal(precheckUpload("application/x-msdownload", 1_024), "blocked-type");
  assert.equal(precheckUpload("text/html", 1_024), "blocked-type");
  assert.equal(precheckUpload("", 1_024), "blocked-type");
});

test("[8.2-UNIT-04f][P1/AC3] precheckUpload → too-large for an allowed type over the limit", () => {
  const allowed = ALLOWED_MIME_TYPES[0];
  assert.equal(precheckUpload(allowed, MAX_UPLOAD_SIZE_BYTES + 1), "too-large");
});

test("[8.2-UNIT-04g][P1/AC3] blocked-type WINS when the type is blocked AND the size is over", () => {
  // A blocked type that is also oversized reports the MORE SPECIFIC blocked-type signal
  // (the type check gates before the size check).
  assert.equal(
    precheckUpload("application/x-msdownload", MAX_UPLOAD_SIZE_BYTES + 1),
    "blocked-type",
  );
});

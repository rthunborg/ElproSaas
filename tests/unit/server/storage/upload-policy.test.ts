/**
 * Story 8.2 — ATDD RED-PHASE scaffold: the PURE upload-policy (MIME allow-list +
 * size limit) unit pins (AC2/AC3, P0 — 8.2-UNIT-01, R-808/R-811/R-817).
 *
 * The upload gate's MIME/size authority is a PURE `.ts` module so the coverage-shape
 * lesson holds (the decision is unit-pinned, never buried in a `.tsx` that escapes the
 * fast gate — R-811). The server validator is the SOLE authority (AC2): the same
 * allow-list a client MAY pre-check with is re-checked server-side, so a client bypass
 * is still rejected. The max size MUST respect the config.toml outer bound
 * (`file_size_limit = "50MiB"` on `tenant-files`) — the policy max is ≤ that.
 *
 * Coverage (mapped to the epic test design + story Task 1.1 / Task 7.1):
 *   - 8.2-UNIT-01a (P0, AC2): `isAllowedMimeType` — a conservative dev allow-list ACCEPTS
 *     the pilot's needed types (application/pdf, image/png, image/jpeg) and REJECTS a
 *     blocked type (e.g. application/x-msdownload, text/html) + an empty/garbage value.
 *   - 8.2-UNIT-01b (P0, AC3): `isWithinSizeLimit` — BOUNDARY: exactly-at-limit passes,
 *     one-over fails, zero passes, a negative value fails.
 *   - 8.2-UNIT-01c (P0, R-817): the policy `MAX_UPLOAD_SIZE_BYTES` constant is ≤ the
 *     config.toml 50MiB bucket outer bound (the server policy is the authority but must
 *     never exceed the storage layer's hard cap).
 *
 * ── RED until Story 8.2 dev lands `src/server/storage/upload-policy.ts` (Task 1.1) ──
 * This scaffold imports the not-yet-created pure policy module. It COMPILE-FAILS /
 * import-fails until Task 1 exports `isAllowedMimeType`, `isWithinSizeLimit`, and the
 * `MAX_UPLOAD_SIZE_BYTES` / `ALLOWED_MIME_TYPES` constants. When the module lands, this
 * file goes GREEN with no test-body change — the assertions describe the intended policy
 * contract, not the current (absent) code.
 *
 * Runs under `node --test` (pure, no DB, no PII — R-516/R-819).
 *
 * [Source: story 8.2 Task 1.1 / Task 7.1; test-design-epic-8.md §P0 (R-808), §Coverage-shape
 *  lesson (R-811); supabase/config.toml:127-144 (50MiB outer bound); epics.md 8.2 AC2/AC3]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedMimeType,
  isWithinSizeLimit,
  MAX_UPLOAD_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from "@/server/storage/upload-policy";

// The config.toml `tenant-files` bucket outer bound: `file_size_limit = "50MiB"`.
const CONFIG_BUCKET_MAX_BYTES = 50 * 1024 * 1024;

test("[8.2-UNIT-01a][P0/AC2] isAllowedMimeType ACCEPTS the conservative pilot allow-list", () => {
  // The pilot needs at minimum PDF + common image types (Task 1.1).
  assert.equal(isAllowedMimeType("application/pdf"), true);
  assert.equal(isAllowedMimeType("image/png"), true);
  assert.equal(isAllowedMimeType("image/jpeg"), true);
});

test("[8.2-UNIT-01a][P0/AC3] isAllowedMimeType REJECTS blocked / garbage MIME values", () => {
  // Executable + active-content types are the canonical blocked class; empty/garbage must
  // also be rejected (a bypassed client can send anything — the server allow-list is closed).
  assert.equal(isAllowedMimeType("application/x-msdownload"), false);
  assert.equal(isAllowedMimeType("text/html"), false);
  assert.equal(isAllowedMimeType("application/octet-stream"), false);
  assert.equal(isAllowedMimeType(""), false);
  assert.equal(isAllowedMimeType("not-a-mime"), false);
});

test("[8.2-UNIT-01a][P0] the allow-list is a CLOSED, non-empty set (bypass authority is finite)", () => {
  assert.ok(Array.isArray(ALLOWED_MIME_TYPES));
  assert.ok(ALLOWED_MIME_TYPES.length > 0);
  // Every entry the guard advertises must itself pass the guard (self-consistency).
  for (const mime of ALLOWED_MIME_TYPES) {
    assert.equal(isAllowedMimeType(mime), true, `${mime} should be allowed by its own guard`);
  }
});

test("[8.2-UNIT-01b][P0/AC3] isWithinSizeLimit BOUNDARY: exactly-at-limit passes, one-over fails", () => {
  assert.equal(isWithinSizeLimit(MAX_UPLOAD_SIZE_BYTES), true, "exactly-at-limit must pass");
  assert.equal(
    isWithinSizeLimit(MAX_UPLOAD_SIZE_BYTES + 1),
    false,
    "one byte over the limit must fail",
  );
});

test("[8.2-UNIT-01b][P0/AC3] isWithinSizeLimit edge: zero passes, negative fails", () => {
  assert.equal(isWithinSizeLimit(0), true, "a zero-byte file is within the limit");
  assert.equal(isWithinSizeLimit(-1), false, "a negative size is never within the limit");
});

test("[8.2-UNIT-01c][P0/R-817] the policy max is <= the config.toml 50MiB bucket outer bound", () => {
  assert.ok(
    MAX_UPLOAD_SIZE_BYTES <= CONFIG_BUCKET_MAX_BYTES,
    `policy max ${MAX_UPLOAD_SIZE_BYTES} must be <= the ${CONFIG_BUCKET_MAX_BYTES} bucket bound`,
  );
});

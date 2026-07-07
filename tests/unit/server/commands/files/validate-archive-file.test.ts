/**
 * Story 8.4 — PURE branch coverage for the `validateArchiveFile` input validator (Task 3.3 /
 * Task 5.1; AC3/AC4). The `archiveFile` archive-only-delete command is the ONE new file command
 * 8.4 adds; its `validateInput` is a pure, no-I/O gate that narrows the crafted-request surface
 * (`{ id, reason?, hardDelete? }`) BEFORE any DB round-trip. This fast `node --test` gate pins
 * every branch cheaply, UNCONDITIONALLY, and WITHOUT a database — the coverage-shape discipline
 * (pull the pure DECISION out of the DB-backed INT suite so the strip-types runner protects it).
 * Mirrors `validate-upload-file.test.ts` (the 8.2 template) verbatim.
 *
 * The validator is the SERVER authority: a client-supplied `tenant_id` / `object_path` /
 * `bucket_id` is NEVER read (server/resolved-tenant only) — it must be stripped by omission from
 * the narrowed value. The raw invalid value is NEVER echoed (the envelope maps VALIDATION_FAILED
 * to a generic user-safe message). `hardDelete` is a DELIBERATE crafted-request surface: a hard
 * delete of a locked file is BLOCKED (FL823 → FILE_LINK_LOCKED) — a UI never offers it, but the
 * command proves the block, so the validator must accept a well-typed `hardDelete: true` intent
 * (the REJECT of the outcome is the command's job, proven in the DB-backed INT suite).
 *
 * Branches pinned:
 *   - a fully-valid `{ id }` (no reason, no hardDelete) ACCEPTS with a narrowed value.
 *   - an OPTIONAL bounded `reason` ACCEPTS and is trimmed; a well-typed `hardDelete: true` ACCEPTS.
 *   - a non-record / non-UUID `id` → VALIDATION_FAILED.
 *   - a non-string reason / empty (or whitespace-only) reason / oversized reason → VALIDATION_FAILED.
 *   - a non-boolean `hardDelete` → VALIDATION_FAILED.
 *   - a client-supplied tenant_id/object_path/bucket_id is NOT surfaced on the narrowed value.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock.
 *
 * [Source: src/server/commands/files/validation.ts (validateArchiveFile + ArchiveFileInput —
 *  the guards to reuse); story 8.4 Task 3.3 + AC3/AC4; src/server/commands/files/files.ts (archiveFile,
 *  hardDelete crafted-request surface); tests/unit/server/commands/files/validate-upload-file.test.ts
 *  (the 8.2 validator-unit template to mirror)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateArchiveFile,
  type ArchiveFileInput,
} from "@/server/commands/files/validation";

/** A fully-valid own-shape archive input (just the target file id). */
function validRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: crypto.randomUUID(), ...overrides };
}

test("[8.4-UNIT-02a][AC3] a fully-valid { id } (no reason, no hardDelete) ACCEPTS with a narrowed value", () => {
  const id = crypto.randomUUID();
  const result = validateArchiveFile({ id });
  assert.equal(result.ok, true);
  if (result.ok) {
    const data: ArchiveFileInput = result.data;
    assert.equal(data.id, id);
    // Absent optionals are omitted (never defaulted to a truthy/echoed value).
    assert.equal(data.reason, undefined);
    assert.equal(data.hardDelete, undefined);
  }
});

test("[8.4-UNIT-02b][AC3] an OPTIONAL bounded reason is ACCEPTED and trimmed", () => {
  const result = validateArchiveFile(validRaw({ reason: "  superseded by a new version  " }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.reason, "superseded by a new version");
});

test("[8.4-UNIT-02c][AC3] a well-typed hardDelete: true intent is ACCEPTED (the crafted-request surface; the block is the command's job)", () => {
  const result = validateArchiveFile(validRaw({ hardDelete: true }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.hardDelete, true);
});

test("[8.4-UNIT-02d][AC3] a non-record input → VALIDATION_FAILED", () => {
  for (const raw of [null, undefined, "x", 42, [] as unknown]) {
    const result = validateArchiveFile(raw as unknown);
    assert.equal(result.ok, false, `raw=${JSON.stringify(raw)}`);
    if (!result.ok) assert.equal(result.code, "VALIDATION_FAILED");
  }
});

test("[8.4-UNIT-02e][AC3] a non-UUID id → VALIDATION_FAILED (a value the DB would 22P02-reject fails as VALIDATION)", () => {
  for (const id of ["", "not-a-uuid", "1234", 12345]) {
    const result = validateArchiveFile({ id });
    assert.equal(result.ok, false, `id=${JSON.stringify(id)}`);
    if (!result.ok) assert.equal(result.code, "VALIDATION_FAILED");
  }
});

test("[8.4-UNIT-02f][AC3] a non-string / empty / whitespace-only reason → VALIDATION_FAILED", () => {
  for (const reason of [123, "", "   "]) {
    const result = validateArchiveFile(validRaw({ reason }));
    assert.equal(result.ok, false, `reason=${JSON.stringify(reason)}`);
    if (!result.ok) assert.equal(result.code, "VALIDATION_FAILED");
  }
});

test("[8.4-UNIT-02g][AC3] an OVERSIZED reason (> 128 chars) → VALIDATION_FAILED (the raw value is never echoed)", () => {
  const result = validateArchiveFile(validRaw({ reason: "x".repeat(129) }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "VALIDATION_FAILED");
});

test("[8.4-UNIT-02h][AC3] a non-boolean hardDelete → VALIDATION_FAILED", () => {
  for (const hardDelete of ["true", 1, {}]) {
    const result = validateArchiveFile(validRaw({ hardDelete }));
    assert.equal(result.ok, false, `hardDelete=${JSON.stringify(hardDelete)}`);
    if (!result.ok) assert.equal(result.code, "VALIDATION_FAILED");
  }
});

test("[8.4-UNIT-02i][AC5] a client-supplied tenant_id/object_path/bucket_id is NOT surfaced on the narrowed value (server-authority only)", () => {
  const result = validateArchiveFile(
    validRaw({
      tenant_id: crypto.randomUUID(),
      object_path: "9999-tenant/secret.pdf",
      bucket_id: "forged-bucket",
    }),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    const surfaced = Object.keys(result.data);
    assert.deepEqual(
      surfaced.filter((k) => ["tenant_id", "object_path", "bucket_id"].includes(k)),
      [],
      "no client-supplied storage/tenant field may leak onto the narrowed value",
    );
  }
});

/**
 * Story 6.5 — PURE input-validator coverage for `validateCreateNewQuoteVersion` (AC1;
 * test-design-epic-6.md #6.5-INT-01, R-602/R-609 — the fast-gate coverage for the new-version
 * command's input-shape guard).
 *
 * `validateCreateNewQuoteVersion` is the input-shape guard the command envelope runs BEFORE any DB
 * access (architecture §5 step 4) for the Story 6.5 new-version path. It is pure (no I/O), so the
 * fast `node --test` gate protects its branches WITHOUT a database — the DB-backed INT suite
 * (`create-new-quote-version.int.test.ts`) proves the load-bearing new-version / preservation /
 * cross-tenant behaviour and SKIPS when the local stack is unreachable.
 *
 * The load-bearing rules (kept in lockstep with `src/server/commands/quotes/validation.ts`):
 *   - `quote_version_id` (the PARENT version) is REQUIRED and UUID-shaped;
 *   - `attachment_file_ids` is an OPTIONAL bounded UUID array (re-validated for ownership in the
 *     command execute); absence requests the server-derived carry-forward default while an
 *     explicit empty list means "copy none";
 *   - a client-supplied `tenant_id` / `status` / totals / lines are NEVER read (the tenant is the
 *     RESOLVED tenant; the fresh snapshot is RE-CAPTURED server-side), so smuggled keys must not
 *     appear on the validated data.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock.
 * Mirrors `tests/unit/server/commands/mark-quote-version-sent-validation.test.ts`.
 *
 * [Source: src/server/commands/quotes/validation.ts (validateCreateNewQuoteVersion); story 6.5
 *  Task 3.2; test-design-epic-6.md#6.5-INT-01]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCreateNewQuoteVersion } from "@/server/commands/quotes/validation";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";

test("10.9: an absent attachment selection preserves the server-derived carry-forward default", () => {
  const res = validateCreateNewQuoteVersion({ quote_version_id: UUID_A });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.data.quote_version_id, UUID_A);
    assert.equal("attachment_file_ids" in res.data, false);
  }
});

test("6.5-INT-01: accepts an optional bounded UUID array of re-selected attachment ids", () => {
  const res = validateCreateNewQuoteVersion({
    quote_version_id: UUID_A,
    attachment_file_ids: [UUID_B],
  });
  assert.equal(res.ok, true);
  if (res.ok) assert.deepEqual(res.data.attachment_file_ids, [UUID_B]);
});

test("10.9: an explicit empty attachment selection means copy none", () => {
  const res = validateCreateNewQuoteVersion({
    quote_version_id: UUID_A,
    attachment_file_ids: [],
  });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal("attachment_file_ids" in res.data, true);
    assert.deepEqual(res.data.attachment_file_ids, []);
  }
});

test("6.5-INT-01: REJECTS a missing / malformed parent version id (a value the DB would 22P02)", () => {
  assert.equal(validateCreateNewQuoteVersion({}).ok, false);
  assert.equal(
    validateCreateNewQuoteVersion({ quote_version_id: "not-a-uuid" }).ok,
    false,
  );
  assert.equal(validateCreateNewQuoteVersion(null).ok, false);
  assert.equal(validateCreateNewQuoteVersion("string").ok, false);
});

test("6.5-INT-01: REJECTS a non-UUID / over-bounded attachment array", () => {
  assert.equal(
    validateCreateNewQuoteVersion({
      quote_version_id: UUID_A,
      attachment_file_ids: ["not-a-uuid"],
    }).ok,
    false,
  );
  assert.equal(
    validateCreateNewQuoteVersion({
      quote_version_id: UUID_A,
      attachment_file_ids: Array.from({ length: 101 }, () => UUID_B),
    }).ok,
    false,
  );
});

test("6.5-INT-01: NEVER reads a smuggled tenant_id / status / totals from input", () => {
  const res = validateCreateNewQuoteVersion({
    quote_version_id: UUID_A,
    tenant_id: UUID_B,
    status: "sent",
    base_total_ore: 999999,
  });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal("tenant_id" in res.data, false);
    assert.equal("status" in res.data, false);
    assert.equal("base_total_ore" in res.data, false);
  }
});

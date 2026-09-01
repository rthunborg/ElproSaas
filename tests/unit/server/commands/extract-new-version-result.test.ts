/**
 * Story 6.5 — EXPANDED fast-gate coverage (bmad-testarch-automate) for the pure
 * `extractNewVersionResult` RPC-result normalizer in `createNewQuoteVersion`.
 *
 * WHY THIS EXISTS (coverage-gap fill): the new-version command reads the narrow RPC's
 * `table (quote_version_id uuid, version_number bigint)` result, which the raw pg / PostgREST
 * layer can surface as EITHER a single object OR a one-row array, with `version_number`
 * (a bigint) coming back as a STRING. `extractNewVersionResult` normalizes/coerces that shape
 * and defends against a malformed/empty row (returning `null` so the command throws a generic
 * error rather than trusting a bad id). That branch logic was previously exercised ONLY through
 * the DB-backed INT suite (`create-new-quote-version.int.test.ts`), which SKIPS when the local
 * Supabase stack is unreachable — leaving the coercion/guard branches unprotected on the fast
 * gate. This pure `node --test` suite pins them WITHOUT a database.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock.
 * [Source: src/server/commands/quotes/new-version.ts (extractNewVersionResult); story 6.5
 *  Task 3.1 + Completion Notes (raw pg bigint→string coercion, R-604); test-design-epic-6.md
 *  #6.5-INT-01]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractNewVersionResult,
  isRecoverableLegacyDraftParent,
  resolveCarryForwardAttachmentFileIds,
} from "@/server/commands/quotes/new-version";

const VERSION_ID = "33333333-3333-3333-3333-333333333333";

test("10.6 recovery: only a literal V1/null-schema draft may branch from a draft parent", () => {
  assert.equal(isRecoverableLegacyDraftParent("draft", null), true);
  assert.equal(isRecoverableLegacyDraftParent("draft", 2), false);
  assert.equal(isRecoverableLegacyDraftParent("draft", 1), false);
  assert.equal(isRecoverableLegacyDraftParent("sent", null), false);
  assert.equal(isRecoverableLegacyDraftParent("accepted", null), false);
});

test("10.9: absent selection defaults to the eligible predecessor intersection and de-duplicates", () => {
  assert.deepEqual(
    resolveCarryForwardAttachmentFileIds(
      undefined,
      ["file-a", "file-b", "file-a", "file-c"],
      ["file-c", "file-a"],
    ),
    ["file-a", "file-c"],
  );
});

test("10.9: explicit selection is filtered to eligible ids, de-duplicated, and permits copy none", () => {
  assert.deepEqual(
    resolveCarryForwardAttachmentFileIds(
      ["file-b", "file-a", "file-a", "file-c"],
      ["file-a"],
      ["file-a", "file-c"],
    ),
    ["file-a", "file-c"],
  );
  assert.deepEqual(
    resolveCarryForwardAttachmentFileIds([], ["file-a"], ["file-a"]),
    [],
  );
});

test("6.5-INT-01 (unit): a single-object row with a numeric version_number is normalized", () => {
  const res = extractNewVersionResult({
    quote_version_id: VERSION_ID,
    version_number: 2,
  });
  assert.deepEqual(res, { quoteVersionId: VERSION_ID, versionNumber: 2 });
});

test("6.5-INT-01 (unit): a one-row ARRAY (the PostgREST returns-table shape) is unwrapped", () => {
  const res = extractNewVersionResult([
    { quote_version_id: VERSION_ID, version_number: 3 },
  ]);
  assert.deepEqual(res, { quoteVersionId: VERSION_ID, versionNumber: 3 });
});

test("6.5-INT-01 (unit, R-604): a bigint version_number returned as a STRING is coerced to a number", () => {
  // Raw pg / PostgREST can serialize a bigint as a string — the extractor must coerce it so the
  // command's `versionNumber` result is always a JS number (never a "2" string).
  const res = extractNewVersionResult({
    quote_version_id: VERSION_ID,
    version_number: "42",
  });
  assert.deepEqual(res, { quoteVersionId: VERSION_ID, versionNumber: 42 });
  if (res) assert.equal(typeof res.versionNumber, "number");
});

test("6.5-INT-01 (unit): a large version_number-as-string stays exact within safe-integer range", () => {
  const res = extractNewVersionResult({
    quote_version_id: VERSION_ID,
    version_number: "9007199254740991", // Number.MAX_SAFE_INTEGER
  });
  assert.equal(res?.versionNumber, Number.MAX_SAFE_INTEGER);
});

test("6.5-INT-01 (unit): a NULL / empty / non-object payload returns null (never a fabricated id)", () => {
  assert.equal(extractNewVersionResult(null), null);
  assert.equal(extractNewVersionResult(undefined), null);
  assert.equal(extractNewVersionResult([]), null); // empty row array
  assert.equal(extractNewVersionResult("nope"), null);
  assert.equal(extractNewVersionResult(123), null);
});

test("6.5-INT-01 (unit): a row missing / mistyping quote_version_id returns null (defends the audit target)", () => {
  assert.equal(extractNewVersionResult({ version_number: 2 }), null);
  assert.equal(
    extractNewVersionResult({ quote_version_id: 12345, version_number: 2 }),
    null,
  );
  assert.equal(
    extractNewVersionResult({ quote_version_id: null, version_number: 2 }),
    null,
  );
});

test("6.5-INT-01 (unit): an unparseable version_number string returns null (never NaN)", () => {
  // Number("abc") → NaN → !Number.isFinite → null (the guard the extractor relies on).
  assert.equal(
    extractNewVersionResult({ quote_version_id: VERSION_ID, version_number: "abc" }),
    null,
  );
  // A MISSING version_number key → Number(undefined) → NaN → null.
  assert.equal(extractNewVersionResult({ quote_version_id: VERSION_ID }), null);
});

test("6.5-INT-01 (unit): a NULL version_number coerces to 0 (Number(null) === 0 is finite) — documents the quirk", () => {
  // Documented behavior boundary: `Number(null)` is 0 (a FINITE number), so a null version_number
  // does NOT fail the finiteness guard — it normalizes to versionNumber: 0. In practice the RPC
  // always returns a >=1 bigint (version_number CHECK (>=1)), so this null path is unreachable in
  // production; pinned here so a future guard tightening is a deliberate, test-visible choice.
  const res = extractNewVersionResult({ quote_version_id: VERSION_ID, version_number: null });
  assert.deepEqual(res, { quoteVersionId: VERSION_ID, versionNumber: 0 });
});

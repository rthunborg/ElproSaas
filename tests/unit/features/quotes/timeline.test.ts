/**
 * Story 6.2 — 6.2-UNIT-02 (P2, AC1): timeline ordering + current-version selection logic
 * extracted into `src/features/quotes/timeline.ts` and unit-pinned. Pure functions, in-memory
 * fixtures, NO DB, NO PII. Runs under `node --test`.
 *
 * The three rules:
 *   1. ORDER the timeline by `versionNumber` ascending.
 *   2. "current commitment" = the LATEST sent/accepted version, else the LATEST (working) version.
 *   3. SELECT by id when supplied (and in the timeline); else the LATEST is the default.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  currentCommitmentVersion,
  latestVersion,
  orderVersionsByNumber,
  resolveSelectedVersion,
  type TimelineVersion,
} from "@/features/quotes/timeline";

/** A small helper to build a version fixture. */
function v(
  id: string,
  versionNumber: number,
  status: TimelineVersion["status"],
): TimelineVersion {
  return { id, versionNumber, status };
}

test("6.2-UNIT-02: orderVersionsByNumber sorts ascending and does not mutate input", () => {
  const input = [v("c", 3, "draft"), v("a", 1, "sent"), v("b", 2, "superseded")];
  const out = orderVersionsByNumber(input);
  assert.deepEqual(
    out.map((x) => x.versionNumber),
    [1, 2, 3],
  );
  // Original untouched.
  assert.deepEqual(
    input.map((x) => x.id),
    ["c", "a", "b"],
  );
});

test("6.2-UNIT-02: latestVersion is the highest versionNumber", () => {
  const input = [v("a", 1, "sent"), v("c", 3, "draft"), v("b", 2, "superseded")];
  assert.equal(latestVersion(input)?.id, "c");
});

test("6.2-UNIT-02: latestVersion on an empty list is null", () => {
  assert.equal(latestVersion([]), null);
});

test("6.2-UNIT-02: current commitment = the LATEST sent/accepted version", () => {
  // v3 is a working draft; the current commitment is the latest SENT (v2), not the draft.
  const input = [v("a", 1, "superseded"), v("b", 2, "sent"), v("c", 3, "draft")];
  assert.equal(currentCommitmentVersion(input)?.id, "b");
});

test("6.2-UNIT-02: current commitment prefers ACCEPTED over an earlier sent", () => {
  const input = [v("a", 1, "sent"), v("b", 2, "accepted"), v("c", 3, "draft")];
  assert.equal(currentCommitmentVersion(input)?.id, "b");
});

test("6.2-UNIT-02: current commitment = the LATEST version when none are sent/accepted", () => {
  // A pre-send quote's commitment is its working (latest) draft.
  const input = [v("a", 1, "draft"), v("b", 2, "draft")];
  assert.equal(currentCommitmentVersion(input)?.id, "b");
});

test("6.2-UNIT-02: current commitment ignores rejected/expired as commitments", () => {
  // A rejected/expired version is not a commitment → fall back to the latest working version.
  const input = [v("a", 1, "rejected"), v("b", 2, "expired"), v("c", 3, "draft")];
  assert.equal(currentCommitmentVersion(input)?.id, "c");
});

test("6.2-UNIT-02: current commitment on an empty list is null", () => {
  assert.equal(currentCommitmentVersion([]), null);
});

// ── Story 10.2 — the `lost` token's timeline semantics (10.2-UNIT-04, added by the automation pass).
// The settled 10.2 design (Task 3.2) is EXPLICIT: `lost` is a TERMINAL dead-end and is NOT a
// commitment (do NOT add it to `isCommitment`), yet the `currentCommitmentVersion` fallback still
// surfaces a lost LATEST version as the current version (so the detail page renders it). Before this
// pass that decision lived only in a code comment + the E2E — a future dev could add `lost` to
// `isCommitment` (or drop the fallback) and no fast-gate test would catch the semantic regression.

test("10.2-UNIT-04: a `lost` version is NOT a commitment — an earlier SENT stays the current commitment", () => {
  // v3 is lost (terminal); the last real commitment is the earlier SENT v2, not the lost latest.
  const input = [v("a", 1, "superseded"), v("b", 2, "sent"), v("c", 3, "lost")];
  assert.equal(currentCommitmentVersion(input)?.id, "b");
});

test("10.2-UNIT-04: a `lost` latest with NO prior commitment still surfaces via the latest-version fallback", () => {
  // No sent/accepted version exists → the fallback returns the LATEST (the lost v2) so the page
  // still has a version to render (the deal can be revived only via a NEW version).
  const input = [v("a", 1, "draft"), v("b", 2, "lost")];
  assert.equal(currentCommitmentVersion(input)?.id, "b");
});

test("10.2-UNIT-04: a `lost` version never masks a later ACCEPTED commitment", () => {
  // A revive-via-new-version path: v1 lost, then a fresh v2 accepted — the accepted v2 wins.
  const input = [v("a", 1, "lost"), v("b", 2, "accepted")];
  assert.equal(currentCommitmentVersion(input)?.id, "b");
});

test("6.2-UNIT-02: resolveSelectedVersion picks the supplied id when present", () => {
  const input = [v("a", 1, "sent"), v("b", 2, "draft")];
  assert.equal(resolveSelectedVersion(input, "a")?.id, "a");
});

test("6.2-UNIT-02: resolveSelectedVersion defaults to LATEST when no id supplied", () => {
  const input = [v("a", 1, "sent"), v("b", 2, "draft")];
  assert.equal(resolveSelectedVersion(input)?.id, "b");
});

test("6.2-UNIT-02: resolveSelectedVersion falls back to LATEST for a foreign/unknown id", () => {
  // An id not in the timeline (foreign / gone) must NOT throw or leak — fall back to latest.
  const input = [v("a", 1, "sent"), v("b", 2, "draft")];
  assert.equal(resolveSelectedVersion(input, "does-not-exist")?.id, "b");
});

test("6.2-UNIT-02: resolveSelectedVersion on an empty timeline is null", () => {
  assert.equal(resolveSelectedVersion([], "a"), null);
});

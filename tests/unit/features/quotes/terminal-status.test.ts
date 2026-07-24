import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LATEST_DECIDED_STATUSES,
  isLatestDecidedStatus,
} from "@/features/quotes/terminal-status";

// Integration review F3/F4: the single-source terminal (decided) latest-version set that gates the
// /quotes list flags, the pipeline aggregate counts, AND the quote-detail header chip. Proving the
// decision function here proves the gate that suppresses a stale follow-up chip on a decided quote.

test("10.x-UNIT terminal set is exactly {accepted, lost, rejected, expired} — superseded EXCLUDED", () => {
  assert.deepEqual(
    [...LATEST_DECIDED_STATUSES].sort(),
    ["accepted", "expired", "lost", "rejected"],
  );
  // superseded is intentionally NOT terminal — it always has a higher-numbered successor.
  assert.equal(LATEST_DECIDED_STATUSES.has("superseded" as never), false);
});

test("10.x-UNIT isLatestDecidedStatus — decided statuses TRUE", () => {
  for (const s of ["accepted", "lost", "rejected", "expired"]) {
    assert.equal(isLatestDecidedStatus(s), true, `${s} must be decided`);
  }
});

test("10.x-UNIT isLatestDecidedStatus — open/interim statuses FALSE (chip still shows on sent)", () => {
  for (const s of ["draft", "sent", "superseded"]) {
    assert.equal(isLatestDecidedStatus(s), false, `${s} must NOT be decided`);
  }
});

test("10.x-UNIT isLatestDecidedStatus — null/undefined/unknown are FALSE (never over-suppress)", () => {
  assert.equal(isLatestDecidedStatus(null), false);
  assert.equal(isLatestDecidedStatus(undefined), false);
  assert.equal(isLatestDecidedStatus(""), false);
  assert.equal(isLatestDecidedStatus("nonsense"), false);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LATEST_DECIDED_STATUSES,
  isLatestDecidedStatus,
} from "@/features/quotes/terminal-status";

// Integration review F3/F4: the single-source terminal (decided) latest-version set that gates the
// /quotes list flags, the pipeline aggregate counts, AND the quote-detail header chip. Proving the
// decision function here proves the gate that suppresses a stale follow-up chip on a decided quote.

test("10.x-UNIT terminal set is exactly {accepted, lost, rejected, expired, superseded}", () => {
  assert.deepEqual(
    [...LATEST_DECIDED_STATUSES].sort(),
    ["accepted", "expired", "lost", "rejected", "superseded"],
  );
  // Codex review: `superseded` IS included — it is reachable as a LATEST status when a version is
  // superseded without a successor being created, and a stranded follow-up there is unclearable.
  assert.equal(LATEST_DECIDED_STATUSES.has("superseded"), true);
});

test("10.x-UNIT isLatestDecidedStatus — decided statuses TRUE", () => {
  for (const s of ["accepted", "lost", "rejected", "expired", "superseded"]) {
    assert.equal(isLatestDecidedStatus(s), true, `${s} must be decided`);
  }
});

test("10.x-UNIT isLatestDecidedStatus — open statuses FALSE (chip still shows on draft/sent)", () => {
  for (const s of ["draft", "sent"]) {
    assert.equal(isLatestDecidedStatus(s), false, `${s} must NOT be decided`);
  }
});

test("10.x-UNIT isLatestDecidedStatus — null/undefined/unknown are FALSE (never over-suppress)", () => {
  assert.equal(isLatestDecidedStatus(null), false);
  assert.equal(isLatestDecidedStatus(undefined), false);
  assert.equal(isLatestDecidedStatus(""), false);
  assert.equal(isLatestDecidedStatus("nonsense"), false);
});

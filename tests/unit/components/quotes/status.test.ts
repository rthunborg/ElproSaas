/**
 * Story 6.2 — UNIT guard for the status-badge TEXT labels (WCAG 1.4.1 / 6.2-E2E-04 backing).
 * Every lifecycle status maps to a non-empty Swedish TEXT label, so the badge conveys status
 * as TEXT (not color alone). Pure, no DB, runs under `node --test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quoteStatusLabel,
  quoteStatusColor,
  isReadOnlyStatus,
  QUOTE_STATUS_LABELS,
} from "@/components/quotes/status";

const ALL_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "superseded",
] as const;

test("6.2: every status has a non-empty distinct TEXT label", () => {
  const labels = new Set<string>();
  for (const s of ALL_STATUSES) {
    const label = quoteStatusLabel(s);
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0, `status ${s} has an empty label`);
    labels.add(label);
  }
  // Labels are distinct (a colour-blind user must be able to tell them apart by text).
  assert.equal(labels.size, ALL_STATUSES.length);
});

test("6.2: an unknown status falls back to the raw code (never blank)", () => {
  assert.equal(quoteStatusLabel("weird"), "weird");
  // And still returns a (neutral) colour class — never throws.
  assert.equal(typeof quoteStatusColor("weird"), "string");
});

test("6.2: draft is editable; every other status is read-only", () => {
  assert.equal(isReadOnlyStatus("draft"), false);
  for (const s of ALL_STATUSES.filter((x) => x !== "draft")) {
    assert.equal(isReadOnlyStatus(s), true, `${s} should be read-only`);
  }
});

test("6.2: the label map covers exactly the closed lifecycle set", () => {
  assert.deepEqual(Object.keys(QUOTE_STATUS_LABELS).sort(), [...ALL_STATUSES].sort());
});

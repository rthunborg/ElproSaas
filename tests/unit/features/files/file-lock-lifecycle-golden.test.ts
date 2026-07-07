/**
 * Story 8.4 — 8.4-GOLDEN-01 (P1, R-822): the LOCK-STATE lifecycle golden oracle. Pins the
 * is_locked / lifecycle-state outcome across the quote/PDF/attachment + acceptance-evidence lifecycle
 * — draft version + PDF link => unlocked; version SENT (or any non-draft) => PDF/attachment links
 * locked; acceptance committed => evidence link locked; locked file archived => lifecycle 'archived'
 * (never deleted). Mirrors the Epic 6/7 golden discipline (origin-labelled, a live oracle over a JSON
 * fixture, GREEN in one pass — it builds NO lock code, it PINS the expected lock-state contract).
 *
 * Every case is `origin: "new-expected"`: NO real Lovable lock oracle exists (Lovable allowed MUTABLE
 * quote attachments + acceptance evidence — the documented 8.4-DOCS-01 delta). Phase A's lock is a
 * DELIBERATE, SAFER new behavior. The three-way origin/schema guard is kept so an Epic-9 delta can
 * land without a code-shape change (the Lovable app is a behavioral oracle ONLY — AGENTS.md / ADR-A007;
 * no Lovable code is copied).
 *
 * Runner: `node --test` (`pnpm run test:unit`) — PURE, NO DB, NO PII, NO clock. Lock-STATE only (no
 * money), but every numeric value stays < 10 digits (R-717 orgnr-scan boundary). NOT a red-phase gate:
 * the fixture + this oracle are authored + GREEN together (a fixture-shape deliverable), so this test
 * is ACTIVE now — it locks the expected contract the 8.4 trigger/apply must satisfy.
 *
 * The four guards this test provides:
 *   1. LOCK-STATE ORACLE — for a lockable owner/purpose, expectedIsLocked === (parentState !== 'draft').
 *   2. ARCHIVE ORACLE — an `action: "archive"` case pins expectedFileLifecycle === 'archived' (never deleted).
 *   3. SHAPE — each case pins a lockable ownerType/purpose from the policy block.
 *   4. LABELLING + PRIVACY — every case carries `origin: "new-expected"` + a non-empty `note`; NO PII.
 *
 * [Source: story 8.4 Task 5.2 + AC1-AC4; test-design-epic-8.md (8.4 lifecycle golden, R-822);
 *  architecture.md#14 (archive-over-delete) / #16 (Lovable coexistence delta);
 *  tests/fixtures/golden/files/file-lock-lifecycle.json; tests/unit/features/quotes/accept-quote-to-job-golden.test.ts
 *  (the golden pack-guard + privacy-scan pattern to mirror)]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(HERE, "../../../fixtures/golden/files/file-lock-lifecycle.json");

interface LockCase {
  readonly id: string;
  readonly origin: "new-expected" | "documented-delta" | "old-lovable";
  readonly note: string;
  readonly ownerType: string;
  readonly purpose: string;
  readonly parentState: string;
  readonly action?: "archive";
  readonly expectedIsLocked: boolean;
  readonly expectedFileLifecycle: string;
}

interface Fixture {
  readonly policy?: {
    readonly lockableOwnerPurposes?: readonly { ownerType: string; purpose: string }[];
  };
  readonly cases?: readonly LockCase[];
}

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Fixture;
const cases = fixture.cases ?? [];
const lockable = fixture.policy?.lockableOwnerPurposes ?? [];

const DRAFT_STATES = new Set(["draft"]);
const PII_PATTERNS: readonly RegExp[] = [
  /\b\d{6,8}[-+]\d{4}\b/, // personnummer / orgnr
  /\b[\w.+-]+@(?!example\.test)[\w.-]+\.[a-z]{2,}\b/i, // non-example.test email
  /\b(?:\+46|0)\d[\d\s-]{6,}\b/, // phone
];

describe("8.4-GOLDEN-01: file-lock lifecycle golden (lock-state oracle)", () => {
  test("the fixture has at least the six lifecycle cases + a non-empty lockable policy", () => {
    assert.ok(cases.length >= 6, "expected >= 6 lifecycle cases");
    assert.ok(lockable.length >= 3, "expected the three lockable owner/purpose pairs");
  });

  test("LOCK-STATE ORACLE: for a lockable owner/purpose, expectedIsLocked === (parentState !== 'draft')", () => {
    for (const c of cases) {
      const isLockablePair = lockable.some(
        (p) => p.ownerType === c.ownerType && p.purpose === c.purpose,
      );
      assert.ok(isLockablePair, `${c.id}: owner/purpose must be a lockable pair`);
      const expectedByRule = !DRAFT_STATES.has(c.parentState);
      assert.equal(
        c.expectedIsLocked,
        expectedByRule,
        `${c.id}: is_locked must be ${expectedByRule} for parentState='${c.parentState}'`,
      );
    }
  });

  test("ARCHIVE ORACLE: an archive action pins lifecycle 'archived' (never deleted); otherwise a locked file's lifecycle is 'locked'", () => {
    for (const c of cases) {
      if (c.action === "archive") {
        assert.equal(c.expectedFileLifecycle, "archived", `${c.id}: archive => 'archived'`);
        assert.notEqual(c.expectedFileLifecycle, "deleted", `${c.id}: never a hard delete`);
      } else if (c.expectedIsLocked) {
        assert.equal(c.expectedFileLifecycle, "locked", `${c.id}: a locked file lifecycle is 'locked'`);
      }
    }
  });

  test("LABELLING + PRIVACY: every case is origin 'new-expected' with a non-empty note and no PII", () => {
    for (const c of cases) {
      assert.equal(c.origin, "new-expected", `${c.id}: no Lovable lock oracle => 'new-expected'`);
      assert.ok(c.note.trim().length > 0, `${c.id}: non-empty note`);
      const blob = JSON.stringify(c);
      for (const re of PII_PATTERNS) {
        assert.doesNotMatch(blob, re, `${c.id}: no PII in the golden case`);
      }
    }
  });
});

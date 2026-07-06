/**
 * Story 7.2 — 7.2-GOLDEN-01 (P1, R-705/R-717): the ACCEPTED-QUOTE-TO-JOB golden oracle. REUSES +
 * EXTENDS `tests/fixtures/golden/money/accepted-price-deltas.json` (Story 4.4, "feeds Epic 7") — it
 * does NOT fork the file: 4.4 owns the accepted-vs-recalculated `deltaCases`; Story 7.2 ADDED the
 * `transactionCases` block (the accepted-price-vs-sent-total-at-acceptance-time delta + the immutable
 * job source refs). This test is the LIVE oracle over that new block: it recomputes the transaction
 * delta with plain integer öre arithmetic (no new engine surface), re-derives the `reasonRequired`
 * gate, and asserts the transaction SHAPE (source refs) + the origin labelling + the documented
 * Lovable transactional delta — so a mis-stated fixture value fails LOUD rather than drifting.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — PURE, NO DB, NO PII, NO clock. Öre values < 10 digits
 * (R-717). Unlike the transaction INT suite this is NOT a red-phase gate: the golden fixture + this
 * oracle are authored + GREEN in ONE pass (a fixture-shape + arithmetic deliverable — architecture's
 * "acceptance with unchanged and adjusted accepted price" pin). It builds NO acceptance/job code.
 *
 * The four guards this test provides for the `transactionCases` block:
 *   1. ARITHMETIC ORACLE — transactionDeltaOre === acceptedPriceOre − sourceSentTotalOre for EVERY case.
 *   2. REASON-GATE ORACLE — reasonRequired === (transactionDeltaOre !== 0) for EVERY case (AC5 rule).
 *   3. SHAPE — each case pins the immutable job source refs (quote_version_id + quote_acceptance_id).
 *   4. LABELLING + PRIVACY — every case carries a valid `origin` + non-empty `note`; a
 *      `documented-delta` case ALSO carries `oldLovableWouldGive` + `newExpected`; NO PII anywhere.
 *
 * [Source: test-design-epic-7.md#7.2-GOLDEN-01, R-705/R-717; story 7.2 Dev Notes "Golden fixture
 *  (7.2-GOLDEN-01)"; tests/fixtures/golden/money/accepted-price-deltas.json (#transactionCases);
 *  tests/unit/lib/money/golden-pack.test.ts (the pack-guard + privacy-scan pattern to mirror)]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(
  HERE,
  "../../../fixtures/golden/money/accepted-price-deltas.json",
);

interface TransactionCase {
  readonly id: string;
  readonly origin: "new-expected" | "documented-delta" | "old-lovable";
  readonly note: string;
  readonly sourceSentTotalOre: number;
  readonly acceptedPriceOre: number;
  readonly transactionDeltaOre: number;
  readonly reasonRequired: boolean;
  readonly jobSourceRefs: readonly string[];
  readonly oldLovableWouldGive?: unknown;
  readonly newExpected?: unknown;
}

interface Fixture {
  readonly transactionCases?: readonly TransactionCase[];
  readonly transactionPolicy?: Record<string, unknown>;
}

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Fixture;
const cases = fixture.transactionCases ?? [];

const VALID_ORIGINS = new Set(["new-expected", "documented-delta", "old-lovable"]);
// The öre-digit boundary (R-717): keep any fixture öre value < 10 digits (orgnr-scan safe).
const ORE_MAX_DIGITS = 10;
// A minimal PII scan over the DATA payload (NFR17/R-411) — personnummer/orgnr/email/phone shapes.
const PII_PATTERNS: readonly RegExp[] = [
  /\b\d{6,8}[-+]\d{4}\b/, // personnummer / orgnr
  /\b[\w.+-]+@(?!example\.test)[\w.-]+\.[a-z]{2,}\b/i, // non-example.test email
  /\b(?:\+46|0)\d[\d\s-]{6,}\b/, // phone
];

describe("7.2-GOLDEN-01: accepted-quote-to-job transaction golden", () => {
  test("the transactionCases block exists and covers unchanged + adjusted accepted price", () => {
    assert.ok(cases.length >= 3, "expected >= 3 transaction cases (unchanged + adjusted-below + adjusted-above)");
    const deltas = cases.map((c) => c.transactionDeltaOre);
    assert.ok(deltas.includes(0), "a zero-delta (unchanged accepted price) case is required");
    assert.ok(deltas.some((d) => d < 0), "a negative-delta (accepted below sent total) case is required");
    assert.ok(deltas.some((d) => d > 0), "a positive-delta (accepted above sent total) case is required");
  });

  for (const c of cases) {
    describe(`case: ${c.id}`, () => {
      test("ARITHMETIC: transactionDeltaOre === acceptedPriceOre − sourceSentTotalOre", () => {
        assert.equal(c.transactionDeltaOre, c.acceptedPriceOre - c.sourceSentTotalOre);
      });

      test("REASON-GATE: reasonRequired === (transactionDeltaOre !== 0) (AC5)", () => {
        assert.equal(c.reasonRequired, c.transactionDeltaOre !== 0);
      });

      test("SHAPE: the job pins the immutable source refs (quote_version_id + quote_acceptance_id)", () => {
        assert.ok(c.jobSourceRefs.includes("quote_version_id"));
        assert.ok(c.jobSourceRefs.includes("quote_acceptance_id"));
      });

      test("ÖRE: every öre value is a non-negative integer < 10 digits (R-717)", () => {
        for (const v of [c.sourceSentTotalOre, c.acceptedPriceOre]) {
          assert.ok(Number.isInteger(v) && v >= 0, `${c.id}: öre must be a non-negative integer`);
          assert.ok(String(Math.abs(v)).length < ORE_MAX_DIGITS, `${c.id}: öre must be < 10 digits`);
        }
      });

      test("LABELLING: a valid origin + non-empty note; a documented-delta carries oldLovableWouldGive + newExpected", () => {
        assert.ok(VALID_ORIGINS.has(c.origin), `${c.id}: invalid origin ${c.origin}`);
        assert.ok(typeof c.note === "string" && c.note.length > 0, `${c.id}: note must be non-empty`);
        if (c.origin === "documented-delta") {
          assert.ok(c.oldLovableWouldGive !== undefined, `${c.id}: documented-delta must carry oldLovableWouldGive`);
          assert.ok(c.newExpected !== undefined, `${c.id}: documented-delta must carry newExpected`);
        }
      });

      test("PRIVACY: no PII in the case payload (NFR17/R-411)", () => {
        const payload = JSON.stringify(c);
        for (const re of PII_PATTERNS) {
          assert.ok(!re.test(payload), `${c.id}: PII-shaped value matched ${re}`);
        }
      });
    });
  }
});

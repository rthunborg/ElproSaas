/**
 * Story 9.3 — GOLDEN-MASTER COMPARISON: ACCEPTANCE TRANSITION + ACCEPTED PRICE + JOB SOURCE REFS
 * (9.3-CMP-03, GREEN).
 *
 * DRIVES the acceptance/accepted-price/job-source machinery over the anonymized 9.2 fixtures
 * (`acceptance.json` — unchanged AND adjusted accepted price; `accepted-quote-to-job.json` — job
 * source refs). REUSES the 7.2 accept-quote-to-job golden pattern + the
 * `accepted-price-deltas.json#transactionCases` authority:
 *   - recompute the accepted-price delta with plain INTEGER öre arithmetic
 *     (acceptedPriceOre − recalculatedTotalOre) — the delta is explainable via the bp engine; do NOT
 *     invent a new engine surface;
 *   - re-derive the `reasonRequired` gate (delta !== 0);
 *   - assert the IMMUTABLE job source-ref tuple (quote_version_id + quote_acceptance_id) on the
 *     accepted-quote→job fixture.
 * Covers two of the nine AC1 comparison categories: acceptance-transition-and-accepted-price and
 * job-source-refs.
 *
 * ── GREEN STATUS ─────────────────────────────────────────────────────────────────────
 * All checks RUN and PASS (the acceptance-delta arithmetic + the transactionCases authority exist
 * since Story 7.2), per Task 2.3:
 *   (1) The fixture's `adjustmentDeltaOre` reproduces the plain-öre recompute for BOTH the unchanged
 *       (delta 0, no reason) and the adjusted (non-zero delta, reason required) cases.
 *   (2) The delta + reason gate cross-check `accepted-price-deltas.json#transactionCases` as the
 *       single authority (a divergence is a STOP, never a re-pin).
 *   (3) The job carries the immutable (quote_version_id + quote_acceptance_id) source-ref tuple, the
 *       same shape the 7.2 authority pins.
 *   (4) "acceptance-transition-and-accepted-price" + "job-source-refs" register through the shared
 *       `driveComparisonCase` live-drive path (the coverage manifest uses the identical path).
 *
 * Runner: `node --test` (`pnpm run test:unit`). NO DB, NO PII, NO clock. Öre < 10 digits.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { loadLovableFixture, readJson, driveComparisonCase } from "./comparison-support";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ACCEPTED_PRICE_DELTAS = resolve(
  HERE,
  "../../../../fixtures/golden/money/accepted-price-deltas.json",
);

interface AcceptanceCase {
  readonly id: string;
  readonly acceptedPriceOre: number;
  readonly recalculatedTotalOre: number;
  readonly adjustmentReason: string | null;
  readonly adjustmentDeltaOre: number;
}

describe("Story 9.3 — ACCEPTANCE TRANSITION + ACCEPTED PRICE comparison (9.3-CMP-03, R-906)", () => {
  test("[P0] accepted-price delta — the fixture delta reproduces the plain-öre recompute; reasonRequired === (delta !== 0)", async () => {
    const fx = loadLovableFixture("acceptance");
    const cases = (fx.cases ?? []) as unknown as AcceptanceCase[];
    assert.ok(cases.length >= 2, "acceptance.json must carry an unchanged AND an adjusted case");

    for (const c of cases) {
      // Plain INTEGER öre arithmetic — the accepted-price delta needs NO new engine surface (R-906).
      const recomputedDelta = c.acceptedPriceOre - c.recalculatedTotalOre;
      assert.equal(
        c.adjustmentDeltaOre,
        recomputedDelta,
        `${c.id}: the fixture adjustmentDeltaOre must equal acceptedPriceOre − recalculatedTotalOre (plain öre)`,
      );
      // The reason gate: any non-zero delta REQUIRES a reason; a zero delta must NOT.
      const reasonRequired = recomputedDelta !== 0;
      const hasReason = typeof c.adjustmentReason === "string" && c.adjustmentReason.trim().length > 0;
      assert.equal(
        hasReason,
        reasonRequired,
        `${c.id}: reasonRequired === (delta !== 0) — a non-zero accepted-price delta MUST carry an adjustment reason`,
      );
      // Guard the öre-digit boundary (orgnr-scan safe).
      assert.ok(Math.abs(c.acceptedPriceOre) < 1_000_000_000, `${c.id}: acceptedPriceOre must be < 10 digits`);
    }

    // SINGLE AUTHORITY (R-906): the 7.2 `accepted-price-deltas.json#transactionCases` OWNS the
    // accepted-price-vs-sent-total delta + reason-gate rule. Prove the SAME plain-öre delta +
    // reason-gate the harness applies is the rule the authority pins (a divergence is a STOP).
    const authority = readJson(ACCEPTED_PRICE_DELTAS) as {
      transactionCases?: {
        id: string;
        sourceSentTotalOre: number;
        acceptedPriceOre: number;
        transactionDeltaOre: number;
        reasonRequired: boolean;
      }[];
    };
    assert.ok(
      Array.isArray(authority.transactionCases) && authority.transactionCases.length >= 1,
      "the accepted-price transaction authority must exist (single authority)",
    );
    for (const tc of authority.transactionCases!) {
      assert.equal(
        tc.transactionDeltaOre,
        tc.acceptedPriceOre - tc.sourceSentTotalOre,
        `${tc.id}: the authority's delta must equal acceptedPriceOre − sourceSentTotalOre (same plain-öre rule)`,
      );
      assert.equal(
        tc.reasonRequired,
        tc.transactionDeltaOre !== 0,
        `${tc.id}: the authority's reason gate must equal (delta !== 0) — the identical rule the harness applies`,
      );
    }

    // Register the category through the shared live-drive path (the manifest uses the same path).
    const result = await driveComparisonCase("acceptance-transition-and-accepted-price");
    assert.equal(result.category, "acceptance-transition-and-accepted-price");
    assert.ok(result.matchedKeys.includes("adjustmentDeltaOre"));
  });
});

describe("Story 9.3 — JOB SOURCE REFERENCES comparison (9.3-CMP-03, R-906)", () => {
  test("[P0] job-source-refs — a job created from an accepted quote carries the IMMUTABLE (quoteVersionId + quoteAcceptanceId) tuple", async () => {
    const fx = loadLovableFixture("accepted-quote-to-job");
    const c = (fx.cases ?? []).find(
      (x) => (x as Record<string, unknown>).id === "job-created-from-accepted-quote",
    ) as { jobSource: Record<string, unknown> } | undefined;
    assert.ok(c, "accepted-quote-to-job.json must carry the job-created-from-accepted-quote case");

    const src = c!.jobSource;
    assert.equal(typeof src.quoteVersionId, "string", "the job source must carry an immutable quoteVersionId");
    assert.equal(typeof src.quoteAcceptanceId, "string", "the job source must carry an immutable quoteAcceptanceId");
    assert.ok((src.quoteVersionId as string).length > 0, "quoteVersionId must be non-empty");
    assert.ok((src.quoteAcceptanceId as string).length > 0, "quoteAcceptanceId must be non-empty");

    // The 7.2 authority pins the immutable source-ref TUPLE shape (quote_version_id +
    // quote_acceptance_id); prove the harness asserts the SAME tuple the authority requires.
    const authority = readJson(ACCEPTED_PRICE_DELTAS) as {
      transactionCases?: { jobSourceRefs: string[] }[];
    };
    const refShape = authority.transactionCases?.[0]?.jobSourceRefs ?? [];
    assert.ok(
      refShape.includes("quote_version_id") && refShape.includes("quote_acceptance_id"),
      "the 7.2 authority pins the immutable (quote_version_id + quote_acceptance_id) source-ref tuple",
    );

    // Register the category through the shared live-drive path.
    const result = await driveComparisonCase("job-source-refs");
    assert.equal(result.category, "job-source-refs");
    assert.ok(result.matchedKeys.includes("quoteVersionId") && result.matchedKeys.includes("quoteAcceptanceId"));
    assert.equal((result.detail as { hasImmutableTuple: boolean }).hasImmutableTuple, true);
  });
});

/**
 * Story 9.3 — GOLDEN-MASTER COMPARISON: ACCEPTANCE TRANSITION + ACCEPTED PRICE + JOB SOURCE REFS
 * (9.3-CMP-03, RED-PHASE SCAFFOLD).
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
 * ── RED-PHASE STATUS ─────────────────────────────────────────────────────────────────
 * The acceptance-delta arithmetic + the transactionCases authority already exist (Story 7.2). The
 * dev must, per Task 2.3:
 *   (1) Assert the fixture's `adjustmentDeltaOre` reproduces the plain-öre recompute for BOTH the
 *       unchanged (delta 0, no reason) and the adjusted (non-zero delta, reason required) cases.
 *   (2) Cross-check against `accepted-price-deltas.json#transactionCases` as the single authority.
 *   (3) Assert the job carries the immutable source-ref tuple.
 *   (4) REGISTER "acceptance-transition-and-accepted-price" + "job-source-refs" into the coverage
 *       manifest EXECUTED set (lovable-comparison-guards.test.ts).
 * The unchanged/adjusted delta arithmetic and the source-ref tuple checks that need no new glue are
 * authored to RUN now; the single-authority cross-check is the marked GREEN work.
 *
 * Runner: `node --test` (`pnpm run test:unit`). NO DB, NO PII, NO clock. Öre < 10 digits.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { loadLovableFixture, readJson } from "./comparison-support";
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
  test("[P0] accepted-price delta — the fixture delta reproduces the plain-öre recompute; reasonRequired === (delta !== 0)", () => {
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
    // GREEN (Task 2.3): cross-check the delta against
    //        accepted-price-deltas.json#transactionCases as the SINGLE authority (a divergence is a
    //        STOP, never a re-pin); then register "acceptance-transition-and-accepted-price" into the manifest.
    const authority = readJson(ACCEPTED_PRICE_DELTAS) as { transactionCases?: unknown[] };
    assert.ok(Array.isArray(authority.transactionCases), "the accepted-price transaction authority must exist (single authority)");
  });
});

describe("Story 9.3 — JOB SOURCE REFERENCES comparison (9.3-CMP-03, R-906)", () => {
  test("[P0] job-source-refs — a job created from an accepted quote carries the IMMUTABLE (quoteVersionId + quoteAcceptanceId) tuple", () => {
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
    // GREEN (Task 2.3): drive the REAL accept-quote-to-job oracle (the 7.2 pattern) so the source-ref
    //        tuple is asserted against the live oracle output, not just the static fixture field; then
    //        register "job-source-refs" into the coverage manifest EXECUTED set.
  });
});

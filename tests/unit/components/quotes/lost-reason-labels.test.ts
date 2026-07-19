/**
 * Story 10.2 — UNIT coverage for the Förlorad/Avböjd reason label resolvers
 * (`lostOutcomeLabel` / `lostCategoryLabel` + `LOST_OUTCOME_LABELS` / `LOST_CATEGORY_LABELS`,
 * `src/components/quotes/status.ts`). Added by the test-automation expansion pass (10.2-UNIT-03).
 *
 * WHY this suite exists (the gap it closes): the settled 10.2 design stores the Förlorad-vs-Avböjd
 * flavour + the strawman category SOLELY as ASCII machine tokens in `quote_lost_reasons.outcome` /
 * `.category`; the Swedish UI words are resolved by these PURE maps and surfaced on the version card
 * AND the list `Förlustorsak` column (AC2 / AC4). Before this pass they were exercised ONLY through
 * the DB-backed E2E — so a DRIFT between the validator's CLOSED machine-token sets
 * (`validateMarkQuoteVersionLost`: outcome ∈ {forlorad, avbojd}, category ∈ {pris, konkurrent,
 * tidplan, uteblivet_svar, annat}) and these label-map KEYS would ship a raw unlabeled token
 * ("forlorad", "uteblivet_svar") to the user with no fast-gate failure. This suite pins the
 * coherence at the `node --test` level (two-runner discipline, epic-10 retro: pure presentation
 * logic is UNIT, not Playwright).
 *
 * The coherence is enforced at BOTH levels:
 *   - COMPILE time — the `OUTCOME_EXHAUSTIVE` / `CATEGORY_EXHAUSTIVE` `Record<Union, …>` maps use the
 *     validator's EXPORTED `QuoteLostOutcome` / `QuoteLostCategory` unions as keys, so if a future
 *     story widens either closed set the enumeration below FAILS TO COMPILE until it is updated.
 *   - RUN time — every enumerated machine token must resolve to a non-empty, distinct Swedish label,
 *     and the label maps must contain EXACTLY those tokens (no orphan / missing key).
 *
 * Runner: `node --test` (`pnpm run test:unit`) — PURE, NO DB, NO PII, NO clock.
 *
 * [Source: src/components/quotes/status.ts (LOST_OUTCOME_LABELS/LOST_CATEGORY_LABELS + resolvers);
 *  src/server/commands/quotes/validation.ts (the closed outcome/category sets); story 10.2 AC2/AC4 +
 *  Dev Notes "The quote_lost_reasons table" (ASCII token → Swedish label convention)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOST_OUTCOME_LABELS,
  LOST_CATEGORY_LABELS,
  lostOutcomeLabel,
  lostCategoryLabel,
} from "@/components/quotes/status";
import type {
  QuoteLostOutcome,
  QuoteLostCategory,
} from "@/server/commands/quotes/validation";

// COMPILE-TIME exhaustiveness: keyed by the validator's exported unions. A widened closed set (e.g.
// a new outcome/category token) makes these object literals fail to compile until the new member is
// enumerated here — which forces a matching label-map + label-resolver update. The values are the
// EXPECTED Swedish labels (the human words the card/column must render).
const OUTCOME_EXHAUSTIVE: Record<QuoteLostOutcome, string> = {
  forlorad: "Förlorad",
  avbojd: "Avböjd",
};

const CATEGORY_EXHAUSTIVE: Record<QuoteLostCategory, string> = {
  pris: "Pris",
  konkurrent: "Konkurrent",
  tidplan: "Tidplan",
  uteblivet_svar: "Uteblivet svar",
  annat: "Annat",
};

const OUTCOME_TOKENS = Object.keys(OUTCOME_EXHAUSTIVE) as QuoteLostOutcome[];
const CATEGORY_TOKENS = Object.keys(CATEGORY_EXHAUSTIVE) as QuoteLostCategory[];

test("10.2-UNIT-03: every validator-accepted outcome token resolves to the expected Swedish label", () => {
  for (const token of OUTCOME_TOKENS) {
    assert.equal(
      lostOutcomeLabel(token),
      OUTCOME_EXHAUSTIVE[token],
      `outcome ${token} must render as ${OUTCOME_EXHAUSTIVE[token]}`,
    );
    assert.equal(LOST_OUTCOME_LABELS[token], OUTCOME_EXHAUSTIVE[token]);
  }
});

test("10.2-UNIT-03: every validator-accepted category token resolves to the expected Swedish label", () => {
  for (const token of CATEGORY_TOKENS) {
    assert.equal(
      lostCategoryLabel(token),
      CATEGORY_EXHAUSTIVE[token],
      `category ${token} must render as ${CATEGORY_EXHAUSTIVE[token]}`,
    );
    assert.equal(LOST_CATEGORY_LABELS[token], CATEGORY_EXHAUSTIVE[token]);
  }
});

test("10.2-UNIT-03: the label maps contain EXACTLY the validator's closed sets (no drift, no orphan key)", () => {
  // The label-map keys must be exactly the machine tokens the validator accepts — an extra key is a
  // dead label; a missing key is a raw-token leak to the user. Either is the R-1011 drift class.
  assert.deepEqual(Object.keys(LOST_OUTCOME_LABELS).sort(), [...OUTCOME_TOKENS].sort());
  assert.deepEqual(Object.keys(LOST_CATEGORY_LABELS).sort(), [...CATEGORY_TOKENS].sort());
});

test("10.2-UNIT-03: outcome labels are non-empty and distinct (a colour-blind user reads them as TEXT)", () => {
  const labels = OUTCOME_TOKENS.map((t) => lostOutcomeLabel(t));
  for (const label of labels) assert.ok(label.length > 0, "an outcome label must not be blank");
  assert.equal(new Set(labels).size, OUTCOME_TOKENS.length, "outcome labels must be distinct");
});

test("10.2-UNIT-03: category labels are non-empty and distinct", () => {
  const labels = CATEGORY_TOKENS.map((t) => lostCategoryLabel(t));
  for (const label of labels) assert.ok(label.length > 0, "a category label must not be blank");
  assert.equal(new Set(labels).size, CATEGORY_TOKENS.length, "category labels must be distinct");
});

test("10.2-UNIT-03: an unknown token falls back to the raw token (never blank, never throws)", () => {
  // A defensive contract: a legacy/foreign token from an older row must degrade to the raw string
  // rather than render blank — matching the quoteStatusLabel unknown-status fallback discipline.
  for (const unknown of ["", "declined", "OTHER", "prís", "uteblivet svar"]) {
    assert.equal(lostOutcomeLabel(unknown), unknown);
    assert.equal(lostCategoryLabel(unknown), unknown);
  }
});

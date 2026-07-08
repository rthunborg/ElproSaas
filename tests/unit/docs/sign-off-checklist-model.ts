/**
 * Executable sign-off CUTOVER-BLOCK checklist model — the epic-blocker teeth (9.4-BLOCK-01,
 * R-905/R-908). This is the pure, I/O-free decision function the sign-off register + the
 * `sign-off-register-validators.test.ts` acceptance validator share so the "the checklist BLOCKS
 * pilot cutover" requirement is an EXECUTABLE guard, not prose (AC3).
 *
 * WHAT IT MODELS (architecture §16 cutover-by-workflow; PRD NFR21):
 *   Given a pilot workflow, a track (`real-pilot` | `demo`), and the workflow's set of OPEN
 *   blocking sign-off item IDs, decide whether:
 *     - real-pilot cutover is permitted for that workflow, and
 *     - the workflow's Lovable fallback may be removed.
 *
 * THE TWO NON-NEGOTIABLE RULES (the story's OPS/BUS gate):
 *   1. REAL-PILOT track: ANY open blocking money/tax/immutability/acceptance/required-file/
 *      migration-classification item HARD-BLOCKS both cutover AND fallback removal for that
 *      workflow (fallback-erosion guard, R-908/NFR21). The block ATTRIBUTES which items stopped
 *      it (`blockedBy`) so it is a traceable block, never an opaque `false`.
 *   2. DEMO track: NON-BLOCKING even with the same open items — the pilot runs on disposable,
 *      obviously-fake demo data entered fresh, nothing is migrated, so the money/tax/migration
 *      placeholders never gate demo work (owner decision 2026-07-03). The two tracks are NEVER
 *      conflated.
 *
 * PROVEN REACHABLE (not a structurally-unreachable dead guard — the epic-5-ledgered anti-pattern):
 *   the acceptance validator seeds an OPEN blocking item on a real-pilot workflow and asserts the
 *   block FIRES (negative path) AND a clean workflow IS cutover-ready (positive path), so the guard
 *   gates on OPEN items and is not a permanent deny.
 *
 * PURITY: no DB, no clock, no network, no filesystem, no PII. Plain inputs → a plain decision.
 * This module is a `tests/unit/**` test ASSET (it drives the docs-invariant validator), NOT app
 * runtime `src/**` code — 9.4 writes no product code.
 *
 * [Source: story 9.4 AC3 + Task 3.2; test-design-epic-9.md 9.4-BLOCK-01, R-905/R-908,
 *  Non-Negotiable Requirements; architecture §16 (cutover-by-workflow, fallback-until-gates-pass);
 *  PRD NFR21; MEMORY (demo-data-only, 2026-07-03); deferred-work.md epic-5 review (prove the guard
 *  fires — no structurally-unreachable machinery)]
 */

/** The migration/cutover track. `real-pilot` gates on open blocking items; `demo` never does. */
export type CutoverTrack = "real-pilot" | "demo";

/** The input to a single workflow's cutover-readiness evaluation. */
export interface EvaluateCutoverInput {
  /** The pilot workflow under evaluation (e.g. "Calculations", "Required Files"). */
  readonly workflow: string;
  /** `real-pilot` (blocking) or `demo` (non-blocking). */
  readonly track: CutoverTrack;
  /**
   * The sign-off item IDs that are STILL OPEN (blocking) for this workflow — e.g. `["A.2", "8.1"]`.
   * An EMPTY set means every blocking assumption for the workflow is resolved.
   */
  readonly openBlockingItems: readonly string[];
}

/** The decision returned for a single workflow's cutover-readiness evaluation. */
export interface CutoverDecision {
  /** `true` iff real-pilot cutover is permitted for this workflow (always `true` on the demo track). */
  readonly cutoverAllowed: boolean;
  /** `true` iff the workflow's Lovable fallback may be removed (gated by the same open-item state). */
  readonly fallbackRemovalAllowed: boolean;
  /** The exact open blocking item IDs that stopped a real-pilot cutover (empty when allowed / demo). */
  readonly blockedBy: readonly string[];
}

/**
 * Decide whether a workflow may cut over to the real-pilot track (and whether its fallback may be
 * removed), given the workflow's set of OPEN blocking sign-off items and the track.
 *
 * The whole gate is `track === "real-pilot" && openBlockingItems.length > 0` → BLOCK. The demo
 * track short-circuits to allowed regardless of open items (the two tracks are never conflated).
 *
 * @returns a traceable decision — `blockedBy` names the offending open items so a caller can report
 *   WHICH assumption blocked cutover (never an opaque `false`).
 */
export function evaluateCutover(input: EvaluateCutoverInput): CutoverDecision {
  const openItems = [...input.openBlockingItems];

  // DEMO track — non-blocking by construction (disposable fake data, nothing migrated). Even with
  // the SAME open items that block real-pilot, demo work proceeds (owner decision 2026-07-03).
  if (input.track === "demo") {
    return {
      cutoverAllowed: true,
      // A demo workflow does not carry a "removable fallback" gate — nothing was migrated to fall
      // back from — so removal is trivially allowed (never a real-data operation on the demo track).
      fallbackRemovalAllowed: true,
      blockedBy: [],
    };
  }

  // REAL-PILOT track — ANY open blocking item HARD-BLOCKS cutover AND fallback removal (R-908).
  const blocked = openItems.length > 0;
  return {
    cutoverAllowed: !blocked,
    fallbackRemovalAllowed: !blocked,
    // Attribute the block to the exact open items (traceable block, not an opaque false).
    blockedBy: blocked ? openItems : [],
  };
}

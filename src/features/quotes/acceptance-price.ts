/**
 * PURE adjusted-price / reason-required decision module (Story 7.1, Task 3 / AC2; R-705).
 *
 * The fast-gate half of the adjusted-price gate the `captureQuoteAcceptance` command
 * re-validates server-side (7.1-INT-03) and the acceptance form MIRRORS (7.1-E2E-02). The
 * decision lives HERE, in a sibling `.ts`, NOT inside a `"use client"` component (the
 * coverage-shape lesson — a helper buried in a client component escapes the `node --test`
 * gate). The command + the UI both consume this single authority; neither re-derives the
 * delta ad hoc.
 *
 * ── THE RULE (server truth; the UI mirrors it) ────────────────────────────────────────────
 * Given an accepted price (öre) and the version's frozen source sent total (öre):
 *   - `deltaOre = acceptedPriceOre − sourceSentTotalOre` — computed with INTEGER öre
 *     arithmetic over CANONICAL-`isOreAmount`-validated inputs (never a float / re-derived
 *     kronor value). Both inputs are validated with `isOreAmount` / `ORE_AMOUNT_MAX` (the one
 *     money-validity authority, no fork) BEFORE the subtraction, so a float / negative / NaN /
 *     overflow öre is a typed rejection, never a silently-wrong delta.
 *   - `reasonRequired = deltaOre !== 0` — ANY non-zero delta (over OR under the sent total)
 *     REQUIRES an explicit `adjustment_reason` (or evidence). A zero delta requires none.
 *
 * ── ÖRE DISCIPLINE ────────────────────────────────────────────────────────────────────────
 * The delta is a signed integer öre (it can be negative — an accepted price BELOW the sent
 * total). `isOreAmount` guards the two non-negative INPUTS; the SIGNED delta between two
 * safe-integer öre is itself safe (|Δ| ≤ ORE_AMOUNT_MAX), so no separate overflow can arise
 * from the subtraction — the only overflow branch is an input already beyond `ORE_AMOUNT_MAX`,
 * which `isOreAmount` rejects as `INVALID_ORE_AMOUNT`. A dedicated `ORE_OVERFLOW` code is kept
 * in the union for shape-parity with `@/lib/money` (defensive; unreachable on valid inputs).
 *
 * PURE: no `"use client"`, no DB, no clock, no network, no PII. Exhaustively `node --test`-able.
 *
 * [Source: test-design-epic-7.md#7.1-UNIT-01/02 + 7.1-INT-03, R-705; story 7.1 Task 3 + AC2;
 *  src/lib/money/ore.ts (isOreAmount / ORE_AMOUNT_MAX — the canonical öre engine to reuse);
 *  src/features/quotes/send-gate.ts (the sibling-`.ts` pure-decision precedent for the fast gate)]
 */
import { isOreAmount } from "@/lib/money/ore";

/**
 * The pure adjusted-price decision result: an OK carrying the signed integer-öre delta +
 * whether an adjustment reason is required, or a typed failure carrying ONLY a stable code
 * (never the raw invalid input). Mirrors the `@/lib/money` `OreResult` shape.
 */
export type AcceptanceDeltaResult =
  | { readonly ok: true; readonly deltaOre: number; readonly reasonRequired: boolean }
  | { readonly ok: false; readonly code: "INVALID_ORE_AMOUNT" | "ORE_OVERFLOW" };

/**
 * Compute the accepted-price adjustment decision.
 *
 * Validates BOTH inputs with the canonical `isOreAmount` FIRST (a float / negative / NaN /
 * ∞ / overflow / non-number öre ⇒ `{ ok:false, code:"INVALID_ORE_AMOUNT" }`, never a wrong
 * delta). On valid inputs returns `deltaOre = acceptedPriceOre − sourceSentTotalOre` (signed
 * integer öre) and `reasonRequired = deltaOre !== 0`.
 */
export function computeAcceptanceDelta(
  acceptedPriceOre: unknown,
  sourceSentTotalOre: unknown,
): AcceptanceDeltaResult {
  if (!isOreAmount(acceptedPriceOre)) return { ok: false, code: "INVALID_ORE_AMOUNT" };
  if (!isOreAmount(sourceSentTotalOre)) return { ok: false, code: "INVALID_ORE_AMOUNT" };
  const deltaOre = acceptedPriceOre - sourceSentTotalOre;
  return { ok: true, deltaOre, reasonRequired: deltaOre !== 0 };
}

/**
 * True iff a non-zero delta REQUIRES an adjustment reason. A thin, self-describing predicate
 * over an already-computed signed öre delta (the command reads `reasonRequired` off
 * `computeAcceptanceDelta`; this is exposed for a caller that already holds the delta).
 */
export function reasonRequiredForDelta(deltaOre: number): boolean {
  return deltaOre !== 0;
}

/**
 * Decide whether an acceptance's adjusted-price gate is SATISFIED, given the entered price,
 * the frozen source sent total, and whether an adjustment reason/evidence was supplied. This
 * is the single decision the command re-validates server-side (the client cannot bypass it):
 *   - an INVALID öre input ⇒ the underlying delta failure (`INVALID_ORE_AMOUNT`);
 *   - a non-zero delta with NO reason ⇒ `{ ok:false, code:"REASON_REQUIRED" }`;
 *   - otherwise ⇒ OK carrying the delta (which the command persists alongside the öre values).
 *
 * `hasReason` folds BOTH the free-text reason and the evidence presence (a delta may be
 * justified by an adjustment reason OR by attached evidence — the caller ORs them).
 */
export type AcceptanceGateResult =
  | { readonly ok: true; readonly deltaOre: number }
  | { readonly ok: false; readonly code: "INVALID_ORE_AMOUNT" | "ORE_OVERFLOW" | "REASON_REQUIRED" };

export function evaluateAcceptancePriceGate(input: {
  readonly acceptedPriceOre: unknown;
  readonly sourceSentTotalOre: unknown;
  readonly hasReason: boolean;
}): AcceptanceGateResult {
  const delta = computeAcceptanceDelta(input.acceptedPriceOre, input.sourceSentTotalOre);
  if (!delta.ok) return delta;
  if (delta.reasonRequired && !input.hasReason) {
    return { ok: false, code: "REASON_REQUIRED" };
  }
  return { ok: true, deltaOre: delta.deltaOre };
}

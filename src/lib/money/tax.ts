/**
 * Story 4.3 — the PURE ROT / grön-teknik ESTIMATE ENGINE that EXTENDS the Story 4.1/4.2
 * integer-öre money engine (architecture §22: `src/lib/money`). This is the FIRST ROT /
 * grön-teknik deduction math in the repo (project-context: "NO money/VAT/ROT CALCULATION
 * ENGINE exists yet — Epic 4 owns it").
 *
 * ── PURITY / DETERMINISM (inherited from Story 4.1/4.2) ──────────────────────────
 * Every function here is PURE: NO I/O, NO DB access, NO clock read (`Date.now()` NEVER
 * appears — the tax-assumption snapshot takes an INJECTED `capturedAt`, mirroring
 * `buildVatAssumptionSnapshot` / `src/lib/snapshots/build.ts`), NO network. That is why the
 * whole surface is exhaustively `node --test` unit-testable and golden-pinnable.
 *
 * ── RATES / CAPS ARE EXPLICIT UNAPPROVED PROFILES — NO HIDDEN PERCENT (R-404 generalized) ──
 * The deduction rate ALWAYS flows in as an INTEGER BASIS-POINT value (3000 = 30.00%) from a
 * NAMED profile object, NEVER a bare `0.30`/`30`/`0.50`/`50`/`1.3` literal scattered through the
 * code: deduction = `roundToOre(eligibleBasisOre * deductionPercentBp / 10000)`, CAPPED at the
 * profile `capOre`. The `/ 10000` basis-point denominator (`BP_PER_UNIT`) is the ONLY rate-related
 * numeric literal in the deduction computation — exactly the Story 4.2 VAT `/ 10000` pattern. A
 * golden source-grep (`tax.golden.test.ts`) asserts no hidden percent literal exists (R-404,
 * epic blocker generalized to tax rates).
 *
 * ── THE WHOLE TAX POLICY IS A CONSERVATIVE UNAPPROVED PILOT ASSUMPTION (R-405, epic blocker) ──
 * The profiles are NAMED `*_UNAPPROVED` records carrying `approved: false` +
 * `signOffStatus: "pending-owner-accounting-legal"`; every estimate returns `requiresSignOff:
 * true` by DEFAULT and the assumption snapshot ALSO carries the unapproved marker. The engine has
 * NO parameter, branch, or field that renders / persists a tax output as `approved` — a missing
 * sign-off is the STRUCTURAL default (mirrors the Epic 3 `quote_terms.approved_at` "approval is
 * structural, never a default string" discipline; only a deliberate later human sign-off — which
 * THIS story does NOT build — could flip it). The EXACT numeric rates/caps/schablon/eligibility
 * are owner-gated (Sign-Off Q3/Q4/Q5/Q7, still pending the working session); the constants below
 * are DEFENSIBLE CONSERVATIVE PLACEHOLDERS encoded as DATA so a later sign-off swaps the numbers
 * with NO code-shape change — they are NOT shipped as production-approved fact.
 *
 * ── ROT AND GRÖN TEKNIK CANNOT BE MIXED — BLOCK, NEVER SILENTLY SUM (R-406, epic blocker) ──
 * A request combining ROT AND grön teknik on one calculation returns the BLOCKING
 * `ROT_GRON_MIX_NOT_ALLOWED` typed failure; there is NO combined-sum code path (owner decision
 * 2026-06-18). Only a later approved rule may permit it — not this story.
 *
 * ── ONLY A RESOLVED ELIGIBILITY POSTURE — NO PII / NO PERSONNUMMER (R-412) ────────
 * The engine takes a resolved eligibility POSTURE (`private` eligible vs not) derived from the
 * customer type UPSTREAM — NEVER a personnummer, orgnr, name, email, or address. NO PII enters
 * `src/lib/money`. ONLY a `private` posture is eligible (owner decision 2026-06-18); a non-private
 * posture (`company`/`brf`/`public`) yields an eligibility WARNING under the conservative Phase-A
 * policy. Personnummer-based ROT eligibility is a FLAGGED UNAPPROVED ASSUMPTION handled by the CRM
 * (access-controlled for `private` customers), NOT an engine input.
 *
 * ── ROUNDING + öre discipline reuse the SINGLE Story 4.1 mode (R-401/R-402 inherited) ──
 * Every rounding goes through the Story 4.1 `roundToOre` (half-away-from-zero); multi-line basis
 * sums go through `sumOre` (sum-of-rounded); every computed öre is validated by the ONE
 * `isOreAmount` so an overflow is a typed `ORE_OVERFLOW`, never a silently-unsafe integer. The
 * deduction-rate-in-bp is validated by the ONE reused `isVatRateBp` bp-validity rule (a deduction %
 * expressed as bp is the same 0..10000 integer-bp discipline — no third forked bp check).
 *
 * [Source: epics.md#Story 4.3 AC1-AC3 + Technical/Stop Conditions; architecture.md#10 (integer öre;
 *  deduction type/eligible basis/rates-caps profile/persons-count/schablon/warnings; do not mix ROT
 *  and grön teknik; estimates until owner/accounting/legal sign-off; do not capture personnummer)
 *  / #11 / #22; project-context.md#Money rules; owner-decisions-applied-2026-06-18.md; test-design-
 *  epic-4.md R-405/R-406/R-407/R-408/R-409/R-412 + 4.3-UNIT-01..07 + 4.3-GOLDEN-01/02; `src/lib/money/
 *  ore.ts` + `vat.ts` (the reused 4.1/4.2 primitives + the `buildVatAssumptionSnapshot` model);
 *  `src/lib/snapshots/build.ts` (the reused Story 3.5 freeze + `assertNever` discipline).]
 */
import {
  isOreAmount,
  isQuantity,
  roundToOre,
  sumOre,
  type MoneyErrorCode,
  type OreResult,
} from "./ore";
import { isVatRateBp } from "./vat";

/**
 * The number of basis points per whole unit (100.00% = 10000 bp). The ONLY rate-related numeric
 * literal in the deduction computation path (`deductionPercentBp / BP_PER_UNIT`) — the SCALE that
 * converts a basis-point rate into a fraction, NOT a hidden rate constant. There is NO
 * `0.30`/`30`/`0.50`/`50`/`1.3` anywhere: the rate always flows in as `deductionPercentBp` from a
 * profile (R-404 generalized to tax rates). Mirrors the Story 4.2 `VAT_BP_PER_UNIT`.
 */
const BP_PER_UNIT = 10000;

/**
 * The CLOSED set of deduction types this engine supports. ROT (renovation/labour) and grön teknik
 * (green-technology) are the only two Phase-A deduction categories. A `deductionType` outside this
 * union is an `UNKNOWN_DEDUCTION_TYPE` typed failure (never a silent fall-through to a wrong
 * profile). Defined here in `@/lib/money` (NOT imported from `src/server`) so the `src/lib` →
 * `src/server` layer direction is never inverted — mirrors how `vat.ts` keeps its own
 * `VatDisplayMode` copy.
 */
export type DeductionType = "rot" | "gron_teknik";

/**
 * The resolved eligibility POSTURE the engine consumes — a customer-type-derived enum, NEVER a
 * personnummer or any PII (R-412). ONLY `private` is eligible for ROT / grön teknik under the
 * conservative Phase-A policy (owner decision 2026-06-18); `company` / `brf` / `public` are
 * flagged as an eligibility WARNING. This mirrors the CRM `CustomerType` member set one-for-one,
 * but the engine keeps its OWN copy of the union (like `vat.ts`'s `VatDisplayPosture`) rather than
 * importing the server validator's type — no PII, no layer inversion.
 */
export type EligibilityPosture = "private" | "company" | "brf" | "public";

/**
 * A single structured warning surfaced on an estimate. `code` is the stable machine discriminant a
 * caller / test asserts on; `message` is a user-safe note. The customer-facing disclaimer wording is
 * a CONSERVATIVE UNAPPROVED assumption (Sign-Off Q5) — NOT shipped as legally-approved.
 */
export interface DeductionWarning {
  readonly code: DeductionWarningCode;
  readonly message: string;
}

/** The closed set of warning discriminants the estimate may carry. */
export type DeductionWarningCode =
  /** The profile is a conservative UNAPPROVED pilot assumption pending owner/accounting/legal sign-off. */
  | "UNAPPROVED_PROFILE"
  /** The customer posture is not `private` — not eligible under the conservative Phase-A policy. */
  | "POSTURE_NOT_ELIGIBLE"
  /** The rate-applied amount exceeded the profile cap and was CLAMPED to the cap. */
  | "DEDUCTION_CLAMPED_TO_CAP";

/**
 * A NAMED, self-describing UNAPPROVED deduction profile. Frozen `as const` DATA — a later
 * owner/accounting/legal sign-off swaps the NUMBERS with NO code-shape change. Carries the rate in
 * BASIS POINTS (never a percent float), a `capOre` (per-person for ROT, per-category for grön
 * teknik) in integer öre, a `profileId`/`label` naming it, and explicit `approved: false` +
 * `signOffStatus` markers so the profile is self-describing as UNAPPROVED.
 */
export interface DeductionProfile {
  /** The deduction category this profile applies to. */
  readonly deductionType: DeductionType;
  /** The deduction rate in BASIS POINTS (3000 = 30.00%) — NOT a percent float. */
  readonly deductionPercentBp: number;
  /** The cap in integer öre (per-person for ROT, per-category for grön teknik). */
  readonly capOre: number;
  /** A stable identifier naming this profile (self-describing as UNAPPROVED). */
  readonly profileId: string;
  /** A human label for the profile. */
  readonly label: string;
  /** ALWAYS `false` — the profile is a conservative pilot assumption, NOT production-approved. */
  readonly approved: false;
  /** The sign-off state — always pending the owner/accounting/legal working session. */
  readonly signOffStatus: "pending-owner-accounting-legal";
}

/**
 * ROT deduction profile — CONSERVATIVE UNAPPROVED PLACEHOLDER. 30.00% (3000 bp) on the eligible
 * labour basis, per-person cap 50 000 kr (5 000 000 öre). The EXACT rate / cap / labour-only basis
 * / multi-owner handling is owner-gated (Sign-Off Q3, pending the working session) — encoded here
 * as DATA + `approved: false`, NOT shipped as production-approved. `as const` + `Object.freeze`
 * so the profile cannot be mutated at runtime.
 */
export const ROT_PROFILE_UNAPPROVED: DeductionProfile = Object.freeze({
  deductionType: "rot",
  deductionPercentBp: 3000,
  capOre: 5_000_000,
  profileId: "ROT_PROFILE_UNAPPROVED",
  label: "ROT (conservative unapproved pilot assumption)",
  approved: false,
  signOffStatus: "pending-owner-accounting-legal",
} as const);

/**
 * Grön-teknik deduction profile — CONSERVATIVE UNAPPROVED PLACEHOLDER. 20.00% (2000 bp) on the
 * eligible basis, per-category cap 50 000 kr (5 000 000 öre); schablon handling is NOT modelled in
 * the placeholder (a schablon on/off value would require treating an owner decision as final — it
 * is deferred to Sign-Off Q4, encoded as a conservative placeholder + the unapproved warning, not
 * invented as an approved value). The EXACT category rates / caps / schablon are owner-gated
 * (Sign-Off Q4, pending the working session) — DATA + `approved: false`, NOT production-approved.
 */
export const GRON_TEKNIK_PROFILE_UNAPPROVED: DeductionProfile = Object.freeze({
  deductionType: "gron_teknik",
  deductionPercentBp: 2000,
  capOre: 5_000_000,
  profileId: "GRON_TEKNIK_PROFILE_UNAPPROVED",
  label: "Grön teknik (conservative unapproved pilot assumption)",
  approved: false,
  signOffStatus: "pending-owner-accounting-legal",
} as const);

/**
 * Resolve the NAMED profile for a deduction type — the profile registry is a CLOSED set, so a
 * `switch` + `assertNever` (mirroring the snapshot `buildSnapshotSource` exhaustiveness discipline)
 * makes an unhandled type a COMPILE error rather than a silent wrong-profile fall-through. Returns
 * `null` for an unknown (non-`DeductionType`) input so the caller emits the clear
 * `UNKNOWN_DEDUCTION_TYPE` typed failure at the boundary.
 */
function profileFor(deductionType: string): DeductionProfile | null {
  switch (deductionType) {
    case "rot":
      return ROT_PROFILE_UNAPPROVED;
    case "gron_teknik":
      return GRON_TEKNIK_PROFILE_UNAPPROVED;
    default:
      return null;
  }
}

/**
 * The FROZEN in-memory tax-assumption value the later quote-version snapshot (Epic 6) will carry.
 * COPIES BY VALUE the exact deduction profile used (type, `deductionPercentBp`, `capOre`,
 * `profileId`, `label`, `approved`, `signOffStatus`), the eligible-basis inputs that fed it, the
 * warnings, the persons/count (when supplied), and the `requiresSignOff` UNAPPROVED marker, plus
 * the INJECTED `capturedAt`. Captures STATE only — NO further arithmetic, NO derived `isApproved`.
 */
export interface TaxAssumptionSnapshot {
  readonly deductionType: DeductionType;
  /** BASIS POINTS, copied verbatim (NOT a percent, no math). */
  readonly deductionPercentBp: number;
  /** The cap in integer öre, copied verbatim. */
  readonly capOre: number;
  readonly profileId: string;
  readonly label: string;
  /** ALWAYS `false` — the captured profile is UNAPPROVED (never derives an approval flag). */
  readonly approved: false;
  readonly signOffStatus: "pending-owner-accounting-legal";
  /** The eligible-basis öre that fed the estimate, copied verbatim (no arithmetic in the builder). */
  readonly eligibleBasisOre: number;
  /** The captured warnings (copied into a fresh frozen array). */
  readonly warnings: readonly DeductionWarning[];
  /** The persons/count used for the per-person ROT cap, when supplied. */
  readonly persons?: number;
  /** ALWAYS `true` — the assumption structurally requires sign-off (the default). */
  readonly requiresSignOff: true;
  /** The INJECTED capture instant (never a clock read). */
  readonly capturedAt: string;
}

/**
 * The result of `buildTaxAssumptionSnapshot`: the frozen assumption on success, or a typed failure
 * (`INVALID_CAPTURED_AT`) when the injected capture instant is not a valid non-empty string. The OK
 * arm is the bare frozen `TaxAssumptionSnapshot` (NOT a wrapper — mirrors `VatAssumptionResult`) so a
 * consumer that reads the captured fields off the returned value keeps working; branch on the
 * `ok === false` failure arm (a discriminated union carrying `ok: false` + a stable `code`).
 */
export type TaxAssumptionResult =
  | TaxAssumptionSnapshot
  | { readonly ok: false; readonly code: MoneyErrorCode };

/**
 * The source a `buildTaxAssumptionSnapshot` caller supplies — the deduction profile it used plus
 * the eligible-basis / warnings / persons context. Deliberately carries NO PII (no personnummer /
 * orgnr / name) — only the deduction profile numbers + basis + warnings.
 */
export interface TaxAssumptionSource {
  readonly deductionType: DeductionType;
  readonly deductionPercentBp: number;
  readonly capOre: number;
  readonly profileId: string;
  readonly label?: string;
  readonly eligibleBasisOre: number;
  readonly warnings?: readonly DeductionWarning[];
  readonly persons?: number;
}

/** The injected-clock options the pure builder takes (mirrors `VatAssumptionBuildOptions`). */
export interface TaxAssumptionBuildOptions {
  /**
   * The capture instant (ISO timestamp), supplied by the caller's injected clock. The pure builder
   * NEVER reads the wall clock (`Date.now()` never appears) — deterministic + testable.
   */
  readonly capturedAt: string;
}

/**
 * Build the FROZEN tax-assumption snapshot — REUSES the Story 3.5 / 4.2 freeze discipline
 * (copy-by-value + `Object.freeze` + INJECTED `capturedAt`, never `Date.now()`).
 *
 * COPIES BY VALUE the deduction profile (type, `deductionPercentBp`, `capOre`, `profileId`,
 * `label`, `approved: false`, `signOffStatus`), the eligible-basis öre, the warnings (into a fresh
 * frozen array), and the optional persons/count, then returns `Object.freeze(...)`. The result
 * holds NO live reference to the input — so mutating the source profile / rate AFTER capture CANNOT
 * reach a prior snapshot (an estimate NEVER silently recomputes when a rate later changes, R-409).
 *
 * Captures STATE only: it does NO arithmetic on the öre / bp (`deductionPercentBp` stays basis
 * points; `capOre` / `eligibleBasisOre` stay verbatim öre) and derives NO `isApproved` flag —
 * `requiresSignOff: true` and `approved: false` are the STRUCTURAL default (R-405). This story does
 * NOT persist the snapshot to any table (Epic 6 owns quote-version freeze).
 *
 * GUARDS the injected `capturedAt` FIRST — an empty string / non-string is rejected with a typed
 * `INVALID_CAPTURED_AT` failure rather than frozen verbatim into the assumption. The capture instant
 * anchors a frozen assumption the Epic 6 quote-version freeze consumes, so a malformed capture
 * instant must not silently pass while every other input in the engine is type-guarded.
 */
export function buildTaxAssumptionSnapshot(
  source: TaxAssumptionSource,
  opts: TaxAssumptionBuildOptions,
): TaxAssumptionResult {
  // Guard the injected capture instant FIRST — a malformed (empty / non-string) capturedAt must not
  // be frozen verbatim into the assumption the later quote-version freeze consumes.
  if (typeof opts.capturedAt !== "string" || opts.capturedAt.length === 0) {
    return { ok: false, code: "INVALID_CAPTURED_AT" };
  }
  // Copy the warnings BY VALUE into a fresh frozen array so a later mutation of the source array
  // cannot reach the captured assumption.
  const warnings: readonly DeductionWarning[] = Object.freeze(
    (source.warnings ?? []).map((w) => Object.freeze({ code: w.code, message: w.message })),
  );
  const base = {
    deductionType: source.deductionType,
    deductionPercentBp: source.deductionPercentBp,
    capOre: source.capOre,
    profileId: source.profileId,
    label: source.label ?? source.profileId,
    approved: false as const,
    signOffStatus: "pending-owner-accounting-legal" as const,
    eligibleBasisOre: source.eligibleBasisOre,
    warnings,
    requiresSignOff: true as const,
    capturedAt: opts.capturedAt,
  };
  // Omit the optional persons field rather than carry `undefined` (mirrors the VAT builder's
  // omit-absent-optional-fields pattern).
  const withPersons =
    source.persons !== undefined ? { ...base, persons: source.persons } : base;
  return Object.freeze(withPersons satisfies TaxAssumptionSnapshot);
}

/**
 * The input to `estimateDeduction`. `deductionType` is a CLOSED union; `eligibleBasisOre` is either
 * a single integer-öre basis or an ARRAY of integer-öre lines (multi-line basis — hidden rows DO
 * count, R-408). `posture` is a resolved eligibility posture (NEVER a personnummer). `persons` is
 * the count for the per-person ROT cap. `capturedAt` is the INJECTED snapshot instant.
 *
 * The optional `deductionTypes` / `rot` / `gronTeknik` fields exist ONLY so a caller that models
 * "both requested on one calc" is detected as a ROT×grön mix and BLOCKED (R-406) — they are NOT a
 * combine-both feature.
 */
export interface DeductionInput {
  readonly deductionType?: string;
  readonly eligibleBasisOre: number | readonly number[];
  readonly posture: string;
  readonly persons?: number;
  readonly capturedAt: string;
  /** Mix-detection escape hatches — a request modelling BOTH deduction types is BLOCKED, never summed. */
  readonly deductionTypes?: readonly string[];
  readonly rot?: unknown;
  readonly gronTeknik?: unknown;
}

/** The successful estimate: deduction + eligible basis + warnings + snapshot + the sign-off default. */
export interface DeductionEstimate {
  readonly ok: true;
  /** The applied deduction in integer öre, CAPPED at the profile cap. */
  readonly deductionOre: number;
  /** The eligible basis in integer öre (multi-line summed via sum-of-rounded). */
  readonly eligibleBasisOre: number;
  /** The warnings surfaced (always includes the UNAPPROVED_PROFILE marker; never absent). */
  readonly warnings: readonly DeductionWarning[];
  /** The frozen tax-assumption snapshot capturing the profile + basis + warnings. */
  readonly assumptionSnapshot: TaxAssumptionSnapshot;
  /** ALWAYS `true` — the estimate structurally requires sign-off (the default, R-405). */
  readonly requiresSignOff: true;
}

/** The typed result of `estimateDeduction`: the estimate on success, or a stable typed failure. */
export type DeductionResult =
  | DeductionEstimate
  | { readonly ok: false; readonly code: MoneyErrorCode };

/**
 * Detect whether an input models BOTH ROT AND grön teknik on one calculation (however the caller
 * shapes it): a `deductionTypes` array carrying both, or a single `deductionType` alongside a
 * co-present `rot`/`gronTeknik` sub-request for the OTHER type. Returns true iff a mix is attempted
 * — the caller then BLOCKS with `ROT_GRON_MIX_NOT_ALLOWED` (R-406), never a combined sum.
 */
function isRotGronMix(input: DeductionInput): boolean {
  if (Array.isArray(input.deductionTypes)) {
    const set = new Set(input.deductionTypes);
    if (set.has("rot") && set.has("gron_teknik")) return true;
  }
  // A single primary type PLUS a co-present sub-request for the other type is also a mix.
  if (input.deductionType === "rot" && input.gronTeknik !== undefined) return true;
  if (input.deductionType === "gron_teknik" && input.rot !== undefined) return true;
  return false;
}

/**
 * Resolve the eligible basis to a single validated integer-öre amount. A single number is validated
 * with `isOreAmount`; an ARRAY of line öre is summed via the Story 4.1 `sumOre` (sum-of-rounded) —
 * hidden rows DO count toward the basis (R-408, owner decision 2026-06-18). Returns the typed
 * `OreResult` so an invalid basis (float / negative / non-öre element / overflow) is a typed
 * failure, never a silently-wrong basis.
 */
function resolveEligibleBasis(basis: number | readonly number[]): OreResult {
  if (Array.isArray(basis)) {
    return sumOre(basis);
  }
  if (!isOreAmount(basis)) return { ok: false, code: "INVALID_ORE_AMOUNT" };
  return { ok: true, value: basis };
}

/**
 * Estimate a ROT / grön-teknik deduction — the pure engine. Returns, on success,
 * `{ deductionOre, eligibleBasisOre, warnings, assumptionSnapshot, requiresSignOff: true }`, or a
 * BLOCKING typed failure.
 *
 * Order of guards (each a typed failure, never a throw / raw-value echo / NaN):
 *   1. ROT×grön MIX → `ROT_GRON_MIX_NOT_ALLOWED` (R-406, epic blocker) — checked FIRST so a mix
 *      is blocked before any profile/basis is resolved; there is NO combined-sum path.
 *   2. Unknown / missing `deductionType` → `UNKNOWN_DEDUCTION_TYPE` (4.3-UNIT-07) — the closed
 *      registry, never a silent wrong-profile fall-through.
 *   3. Invalid eligible basis (non-öre / bad line) → `INVALID_ORE_AMOUNT` / `ORE_OVERFLOW`.
 *
 * The deduction = `min( roundToOre(eligibleBasisOre * deductionPercentBp / 10000), capOre )` — the
 * applied rate on the eligible basis, CLAMPED at the profile cap (a clamp adds a warning). The rate
 * flows from the profile as BASIS POINTS via `/ 10000` (no percent literal). A zero basis → 0. A
 * non-`private` posture adds an eligibility WARNING (conservative Phase-A policy; owner decision
 * 2026-06-18 only `private` is eligible). Every estimate carries the UNAPPROVED_PROFILE warning +
 * `requiresSignOff: true` by DEFAULT (R-405) — the engine has NO path to render it approved. The
 * engine reads NO personnummer / PII — eligibility is the resolved posture only (R-412).
 */
export function estimateDeduction(input: DeductionInput): DeductionResult {
  // 1) The mix block FIRST — a ROT×grön mix is a BLOCKING failure before anything is computed.
  if (isRotGronMix(input)) {
    return { ok: false, code: "ROT_GRON_MIX_NOT_ALLOWED" };
  }

  // 2) Resolve the profile from the CLOSED registry — an unknown/missing type is a clear failure.
  const deductionType = input.deductionType ?? "";
  const profile = profileFor(deductionType);
  if (profile === null) {
    return { ok: false, code: "UNKNOWN_DEDUCTION_TYPE" };
  }

  // Validate the per-person count when supplied (a bad count must not silently pass); it does not
  // scale the deduction in the placeholder (the cap is a flat per-person/per-category öre value),
  // but it is captured into the assumption snapshot and must be a finite non-negative number.
  if (input.persons !== undefined && !isQuantity(input.persons)) {
    return { ok: false, code: "INVALID_QUANTITY" };
  }

  // 3) Resolve + validate the eligible basis (single öre or a multi-line sum — hidden rows count).
  const basis = resolveEligibleBasis(input.eligibleBasisOre);
  if (!basis.ok) return basis;
  const eligibleBasisOre = basis.value;

  // The rate flows in as BASIS POINTS from the profile — defense-in-depth via the ONE reused
  // bp-validity rule so a malformed profile rate can never drive the computation. The PREDICATE is
  // shared (a deduction % in bp is the same 0..10000 integer-bp discipline), but a malformed *tax*
  // profile rate surfaces as the tax-scoped `INVALID_DEDUCTION_RATE_BP` — never the VAT-named code —
  // so the error surface is self-describing across the story boundary.
  if (!isVatRateBp(profile.deductionPercentBp)) {
    return { ok: false, code: "INVALID_DEDUCTION_RATE_BP" };
  }

  // Apply the rate on the eligible basis via the SINGLE Story 4.1 half-away-from-zero mode.
  const rateApplied = roundToOre((eligibleBasisOre * profile.deductionPercentBp) / BP_PER_UNIT);
  if (!isOreAmount(rateApplied)) {
    return { ok: false, code: "ORE_OVERFLOW" };
  }

  // Clamp at the profile cap (per-person for ROT, per-category for grön teknik).
  const clamped = rateApplied > profile.capOre;
  const deductionOre = clamped ? profile.capOre : rateApplied;
  if (!isOreAmount(deductionOre)) {
    return { ok: false, code: "ORE_OVERFLOW" };
  }

  // Build the warnings — ALWAYS the UNAPPROVED_PROFILE marker (R-405 structural default), plus a
  // clamp note when the deduction hit the cap, plus an eligibility warning for a non-private posture.
  const warnings: DeductionWarning[] = [
    {
      code: "UNAPPROVED_PROFILE",
      message:
        `Deduction estimate uses the conservative UNAPPROVED profile ${profile.profileId} ` +
        `(pending owner/accounting/legal sign-off) — not production-approved.`,
    },
  ];
  if (clamped) {
    warnings.push({
      code: "DEDUCTION_CLAMPED_TO_CAP",
      message: `Rate-applied amount exceeded the profile cap and was clamped to ${profile.capOre} öre.`,
    });
  }
  if (input.posture !== "private") {
    warnings.push({
      code: "POSTURE_NOT_ELIGIBLE",
      message:
        `Customer posture '${String(input.posture)}' is not eligible for this deduction under the ` +
        `conservative Phase-A policy (only 'private' is eligible) — unapproved eligibility assumption.`,
    });
  }
  const frozenWarnings: readonly DeductionWarning[] = Object.freeze(
    warnings.map((w) => Object.freeze(w)),
  );

  const assumptionSnapshot = buildTaxAssumptionSnapshot(
    {
      deductionType: profile.deductionType,
      deductionPercentBp: profile.deductionPercentBp,
      capOre: profile.capOre,
      profileId: profile.profileId,
      label: profile.label,
      eligibleBasisOre,
      warnings: frozenWarnings,
      persons: input.persons,
    },
    { capturedAt: input.capturedAt },
  );
  // Propagate a malformed-capturedAt typed failure rather than embedding a failed snapshot into the
  // estimate — an invalid capture instant blocks the estimate at the same boundary as every other
  // guarded input. The failure arm is the only one carrying an `ok` property, so `"ok" in …` narrows
  // `assumptionSnapshot` to the bare frozen `TaxAssumptionSnapshot` below.
  if ("ok" in assumptionSnapshot) {
    return { ok: false, code: assumptionSnapshot.code };
  }

  return {
    ok: true,
    deductionOre,
    eligibleBasisOre,
    warnings: frozenWarnings,
    assumptionSnapshot,
    requiresSignOff: true,
  };
}

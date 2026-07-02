/**
 * Story 4.2 — the PURE VAT + quote-total primitives that EXTEND the Story 4.1 integer-öre
 * money engine (architecture §22: `src/lib/money`). This is the FIRST VAT computation in the
 * repo (project-context: "NO money/VAT/ROT CALCULATION ENGINE exists yet — Epic 4 owns it").
 *
 * ── PURITY / DETERMINISM (inherited from Story 4.1) ──────────────────────────────
 * Every function here is PURE: NO I/O, NO DB access, NO clock read (`Date.now()` NEVER
 * appears — the VAT-assumption snapshot takes an INJECTED `capturedAt`, mirroring
 * `src/lib/snapshots/build.ts`), NO network. That is why the whole surface is exhaustively
 * `node --test` unit-testable and golden-pinnable — a deterministic function of its inputs.
 *
 * ── VAT RATE IS BASIS POINTS ONLY — NO HIDDEN 25% CONSTANT (R-404, epic blocker) ──
 * The VAT rate ALWAYS flows in as an INTEGER BASIS-POINT value (2500 = 25.00%) from tenant
 * `company_settings.vat_rate_bp` / a snapshot. The engine invents NO rate and holds NO
 * percent constant: VAT = `roundToOre(lineNetOre * vatRateBp / 10000)`. There is NO
 * `0.25`/`25`/`1.25` gross-shortcut literal in the VAT path — that would be a NON-NEGOTIABLE
 * epic blocker (test-design Non-Negotiable) and is exactly the divergence-from-Lovable this
 * story documents (Lovable hardcoded 25%). The `/ 10000` basis-point denominator is the ONLY
 * numeric literal in the VAT computation; `10000` is the bp-per-unit scale, not a rate.
 *
 * ── ONE basis-point-validity RULE (no fork) ─────────────────────────────────────
 * `isVatRateBp` / `VAT_RATE_BP_MIN` / `VAT_RATE_BP_MAX` are the SINGLE basis-point-validity
 * authority (moved here from `src/server/commands/settings/validation.ts`, which now
 * re-exports them — mirroring the Story 4.1 `isOreAmount` move). There is exactly ONE
 * implementation in the codebase; the settings command layer and this VAT engine share it.
 *
 * ── VAT ROUNDING POLICY (R-403, golden-PINNED conservative pilot assumption) ─────
 * VAT is rounded PER LINE via the SINGLE Story 4.1 `roundToOre` (the SAME half-away-from-zero
 * mode 4.1 golden-pinned — NOT a second/different mode), and section/quote VAT totals SUM the
 * already-rounded per-line VAT values (`sumOre` = SUM-OF-ROUNDED, never round-of-sum). The
 * load-bearing golden case is the one where sum-of-rounded ≠ round-of-sum so an accidental
 * round-at-end fails loud. THIS VAT ROUNDING POLICY IS A CONSERVATIVE PILOT ASSUMPTION PENDING
 * OWNER/ACCOUNTING SIGN-OFF (architecture.md#10 Rounding; test-design Sign-Off Q1) — recorded
 * as an assumption, NOT hard-coded as accounting-final. If accounting requires DOCUMENT-LEVEL
 * VAT rounding instead of per-line, that is a STOP CONDITION (report `needs-human`).
 *
 * ── DISPLAY VIEWS ARE PRESENTATION-ONLY (AC2) ────────────────────────────────────
 * `vatBreakdown` yields `{ netOre, vatOre, grossOre }` where `grossOre = netOre + vatOre` is
 * DERIVED — the net + VAT öre are the immutable source of truth, gross is never an independent
 * stored total. The display-mode selector re-derives from the same source öre and NEVER mutates
 * them; a round-trip through any mode returns the identical stored öre. The "PRIVATE customer →
 * ALWAYS incl-VAT (not togglable)" rule is a documented CONSERVATIVE ASSUMPTION (Sign-Off Q2),
 * NOT legally-approved fact — do NOT ship it as owner/legally-approved customer-facing wording.
 *
 * ── NO PII in the pure engine (R-411/R-412 posture, inherited from Story 4.1) ────
 * No personnummer, orgnr, customer field, or clock read enters this module — it is pure math
 * over öre + basis-point numbers. The VAT-assumption snapshot copies primitives by value and
 * takes an injected `capturedAt`; it holds NO live reference to its source.
 *
 * [Source: epics.md#Story 4.2 AC1-AC4 + Technical Notes; architecture.md#10 (integer öre; VAT
 *  rates in basis points; VAT per line from rounded line net + snapshotted bp; sum rounded line
 *  values for totals) / #11 (quote versions snapshot VAT assumptions) / #22 (`src/lib/money`);
 *  project-context.md#Money rules; test-design-epic-4.md R-403/R-404/R-409 + 4.2-UNIT-01..06 +
 *  4.2-GOLDEN-01; `src/lib/money/ore.ts` (the reused 4.1 primitives); `src/lib/snapshots/build.ts`
 *  (the reused Story 3.5 freeze discipline).]
 */
import {
  isOreAmount,
  roundToOre,
  sumOre,
  type MoneyErrorCode,
  type OreResult,
} from "./ore";

/**
 * Inclusive bounds for a VAT rate in BASIS POINTS: 0 bp (0%) .. 10000 bp (100.00%). These are
 * the CANONICAL bp bounds (moved here from the settings validator, which now re-exports them)
 * so there is exactly ONE basis-point range in the codebase — no re-hardcoded literal.
 */
export const VAT_RATE_BP_MIN = 0;
export const VAT_RATE_BP_MAX = 10000;

/**
 * The number of basis points per whole unit (100.00% = 10000 bp). The ONLY numeric literal in
 * the VAT computation path (`vatRateBp / VAT_BP_PER_UNIT`) — the SCALE that converts a
 * basis-point rate into a fraction, NOT a hidden rate constant. There is NO `0.25`/`25`/`1.25`
 * anywhere: the rate always flows in as `vatRateBp` (R-404).
 */
const VAT_BP_PER_UNIT = 10000;

/**
 * True iff `v` is a valid INTEGER VAT rate in BASIS POINTS within [VAT_RATE_BP_MIN,
 * VAT_RATE_BP_MAX] = [0, 10000]. A float / non-finite / out-of-range value is rejected — basis
 * points are integers, NEVER a float (the HARD money discipline). Accepts an integer-valued
 * number only (0, 600, 1200, 2500, … up to 10000 inclusive).
 *
 * This is the CANONICAL, single-source basis-point-validity rule. `src/server/commands/
 * settings/validation.ts` re-exports it — the settings command layer and this VAT engine share
 * this ONE implementation (mirrors the Story 4.1 `isOreAmount` consolidation; no fork).
 */
export function isVatRateBp(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isInteger(v) &&
    v >= VAT_RATE_BP_MIN &&
    v <= VAT_RATE_BP_MAX
  );
}

/**
 * Compute the PER-LINE VAT in integer öre from a rounded line net (integer öre) and a VAT rate
 * in BASIS POINTS: `roundToOre(lineNetOre * vatRateBp / 10000)`.
 *
 * Validates BOTH inputs FIRST — `isOreAmount(lineNetOre)` (the net is already a rounded integer
 * öre from `lineNetOre`) and `isVatRateBp(vatRateBp)` (integer basis points in [0, 10000], via
 * the ONE reused bp-validity rule). An invalid input returns the matching typed failure (never
 * a `NaN` / throw / raw-value echo): a bad net → `INVALID_ORE_AMOUNT`, a bad rate →
 * `INVALID_VAT_RATE_BP`.
 *
 * The rounding is LINE-LEVEL — it happens per line via the SINGLE Story 4.1 `roundToOre`
 * (half-away-from-zero), NEVER a `* 1.25` gross shortcut. The rounded VAT is re-checked with
 * `isOreAmount` so an overflowing product is a typed `ORE_OVERFLOW`, never a silently-unsafe
 * integer. `vatRateBp = 0` yields VAT `0` cleanly — VAT-exempt is the same formula, not a
 * special-case bug.
 */
export function lineVatOre(lineNetOre: number, vatRateBp: number): OreResult {
  if (!isOreAmount(lineNetOre)) return { ok: false, code: "INVALID_ORE_AMOUNT" };
  if (!isVatRateBp(vatRateBp)) return { ok: false, code: "INVALID_VAT_RATE_BP" };
  const vat = roundToOre((lineNetOre * vatRateBp) / VAT_BP_PER_UNIT);
  // Guard the OUTPUT: a large net × a large rate can exceed the safe-integer ceiling even when
  // both inputs are individually valid. An overflow is a typed failure, never an unsafe integer.
  if (!isOreAmount(vat)) return { ok: false, code: "ORE_OVERFLOW" };
  return { ok: true, value: vat };
}

/**
 * Sum an array of ALREADY-ROUNDED per-line VAT values (integer öre) into an exact section/quote
 * VAT total. This is SUM-OF-ROUNDED, never round-of-sum: section/quote VAT totals SUM the
 * rounded line VAT values (delegating to the Story 4.1 `sumOre` primitive) — the divergence from
 * round-of-summed-VAT is the INTENDED conservative pilot behaviour and is golden-pinned (R-403).
 *
 * A thin wrapper over `sumOre` so the VAT-total intent reads at the call site while the
 * per-element `isOreAmount` validation and the `ORE_AMOUNT_MAX` accumulator guard come for free.
 * A non-öre element is a typed `INVALID_ORE_AMOUNT`; a total past the ceiling is `ORE_OVERFLOW`;
 * an empty array sums to `0`.
 */
export function sumVatOre(lineVatValues: readonly number[]): OreResult {
  return sumOre(lineVatValues);
}

/**
 * A pure VAT breakdown for one line/section: the three öre values a display view derives from.
 * `netOre` is the validated source net, `vatOre` the per-line VAT, and `grossOre = netOre +
 * vatOre` the DERIVED total. The net + VAT öre are the immutable source of truth; `grossOre` is
 * never an independent stored total — it is re-derived here.
 */
export interface VatBreakdown {
  readonly netOre: number;
  readonly vatOre: number;
  readonly grossOre: number;
}

/** The OK/typed-failure result of a `vatBreakdown` computation (mirrors `OreResult`'s shape). */
export type VatBreakdownResult =
  | { readonly ok: true; readonly value: VatBreakdown }
  | { readonly ok: false; readonly code: MoneyErrorCode };

/**
 * Compute the `{ netOre, vatOre, grossOre }` breakdown for one line/section from a rounded line
 * net (integer öre) and a VAT rate in BASIS POINTS. `grossOre = netOre + vatOre` is DERIVED and
 * guarded against `ORE_AMOUNT_MAX` — it is never a separately-stored source total.
 *
 * Validates via the same `lineVatOre` path, so an invalid net/rate returns the matching typed
 * failure (never a partial breakdown). A zero net yields all-zero `{ 0, 0, 0 }`; a `vatRateBp =
 * 0` yields `{ netOre, 0, netOre }` (gross equals net when VAT is 0) — neither is a special case.
 */
export function vatBreakdown(netOre: number, vatRateBp: number): VatBreakdownResult {
  const vat = lineVatOre(netOre, vatRateBp);
  if (!vat.ok) return { ok: false, code: vat.code };
  const grossOre = netOre + vat.value;
  // Guard the DERIVED gross so a net + VAT that overflows the safe-integer ceiling is a typed
  // `ORE_OVERFLOW`, never a silently-unsafe integer. (`netOre` is already validated by lineVatOre.)
  if (!isOreAmount(grossOre)) return { ok: false, code: "ORE_OVERFLOW" };
  return { ok: true, value: { netOre, vatOre: vat.value, grossOre } };
}

/**
 * The resolved customer POSTURE a display view is selected for. `company_togglable` /
 * `company_excl` are the tenant `default_vat_display` enum values (consumed AS-IS as a
 * presentation input — mirrors `VAT_DISPLAY_MODES` in the settings validator). `private` is the
 * resolved private-customer posture that triggers the always-incl-VAT INVARIANT.
 *
 * The private posture is NOT a stored `default_vat_display` option — it is the Epic-4 presentation
 * INVARIANT the display layer honours regardless of the tenant setting (a private customer always
 * sees incl-VAT/gross). It is a documented CONSERVATIVE ASSUMPTION (Sign-Off Q2), NOT encoded as
 * legally-approved fact.
 */
export type VatDisplayPosture = "company_togglable" | "company_excl" | "private";

/** Which öre amount(s) a resolved display view surfaces (presentation-only, re-derived). */
export interface VatDisplayView {
  /** The resolved posture this view was selected for. */
  readonly posture: VatDisplayPosture;
  /** The primary amount to display: net (excl) for `company_excl`, gross (incl) otherwise. */
  readonly primaryOre: number;
  /** True iff the customer may TOGGLE between excl and incl (only `company_togglable`). */
  readonly togglable: boolean;
  /** The excl-VAT (net) öre, always available for a togglable/both view. */
  readonly netOre: number;
  /** The VAT öre. */
  readonly vatOre: number;
  /** The incl-VAT (gross) öre, always available for a togglable/both/private view. */
  readonly grossOre: number;
}

/**
 * A pure PRESENTATION-ONLY display-mode selector: given a resolved `VatDisplayPosture` and an
 * immutable `{ netOre, vatOre, grossOre }` breakdown, return WHICH öre amount(s) to show —
 * WITHOUT mutating the source breakdown.
 *
 *   - `company_excl`      → show NET (excl-VAT), not togglable.
 *   - `company_togglable` → both available (default primary = incl/gross), togglable.
 *   - `private` INVARIANT → ALWAYS incl-VAT (gross), not togglable (Sign-Off Q2 conservative
 *                            assumption — a private customer always sees the gross total).
 *
 * The selector RE-DERIVES a fresh view object from the same source öre and NEVER mutates the input
 * breakdown; a round-trip through any posture returns the identical stored öre (the source net +
 * VAT are the immutable truth). No kronor string is produced here — the ONE öre→kronor formatter
 * (`formatOreAsKronor` in `@/lib/money`) is the sole presentation-boundary that formats, so this
 * transform stays a pure öre-selection with no second formatting seam. An UNKNOWN posture falls
 * back to the conservative incl-VAT (gross) view rather than leaking a partial/undefined amount.
 */
export function selectVatDisplay(
  posture: VatDisplayPosture,
  breakdown: VatBreakdown,
): VatDisplayView {
  const { netOre, vatOre, grossOre } = breakdown;
  if (posture === "company_excl") {
    return { posture, primaryOre: netOre, togglable: false, netOre, vatOre, grossOre };
  }
  if (posture === "company_togglable") {
    return { posture, primaryOre: grossOre, togglable: true, netOre, vatOre, grossOre };
  }
  // `private` (and any unexpected posture) → the conservative always-incl-VAT invariant.
  return { posture: "private", primaryOre: grossOre, togglable: false, netOre, vatOre, grossOre };
}

/**
 * The mutable VAT-assumption SOURCE the builder copies from — the VAT half of a
 * `company_settings` row / a `CompanySettingsSnapshot`: the rate in BASIS POINTS + the display
 * mode enum, plus the OPTIONAL source identity (`sourceId` / `sourceUpdatedAt`) when a row is
 * passed. Deliberately the VAT-ONLY slice (NOT the full `company_settings` identity — that is
 * Epic 6's PDF-identity concern; `CompanySettingsSnapshot` is intentionally identity-partial).
 */
export interface VatAssumptionSource {
  /** The VAT rate in BASIS POINTS (2500 = 25.00%), copied verbatim (NOT a percent, no math). */
  readonly vatRateBp: number;
  /** The tenant `default_vat_display` enum, captured AS-IS as a presentation input. */
  readonly defaultVatDisplay: string;
  /** OPTIONAL: the source row's id (when built from a settings row/snapshot). */
  readonly sourceId?: string;
  /** OPTIONAL: the source row's `updated_at` used as the source "version". */
  readonly sourceUpdatedAt?: string;
}

/** The injected-clock options the pure builder takes (mirrors `SnapshotBuildOptions`). */
export interface VatAssumptionBuildOptions {
  /**
   * The capture instant (ISO timestamp), supplied by the caller's injected clock. The pure
   * builder NEVER reads the wall clock (`Date.now()` never appears) — deterministic + testable.
   */
  readonly capturedAt: string;
}

/**
 * The FROZEN in-memory VAT-assumption value the later quote-version snapshot (Epic 6) will carry.
 * Copies BY VALUE the exact `vatRateBp` + `defaultVatDisplay` (+ optional source id/version) and
 * the injected `capturedAt`. Captures STATE only — NO computed VAT amount, NO derived `isApproved`
 * flag; `vatRateBp` stays basis points (no arithmetic on it in the builder).
 */
export interface VatAssumptionSnapshot {
  /** From `vat_rate_bp` — BASIS POINTS (2500 = 25.00%), copied verbatim (NOT a percent). */
  readonly vatRateBp: number;
  /** From `default_vat_display` — the display-mode enum, captured AS-IS. */
  readonly defaultVatDisplay: string;
  /** OPTIONAL source id (when built from a settings row/snapshot). */
  readonly sourceId?: string;
  /** OPTIONAL source `updated_at` version (when built from a settings row/snapshot). */
  readonly sourceUpdatedAt?: string;
  /** The INJECTED capture instant (never a clock read). */
  readonly capturedAt: string;
}

/**
 * Build the FROZEN VAT-assumption snapshot — REUSES the Story 3.5 `src/lib/snapshots` freeze
 * discipline (copy-by-value + `Object.freeze` + INJECTED `capturedAt`, never `Date.now()`).
 *
 * COPIES BY VALUE the exact `vatRateBp` + `defaultVatDisplay` (+ the optional `sourceId` /
 * `sourceUpdatedAt` when a row is passed) into a fresh object and returns `Object.freeze(...)`.
 * The result holds NO live reference to the input — so mutating the source row AFTER capture
 * CANNOT reach a prior snapshot (a later tenant-rate change never retroactively alters a captured
 * assumption). Captures STATE only: it computes NO VAT amount into itself (the amount is computed
 * by `lineVatOre` at calc time, reproducible from the frozen rate) and derives NO `isApproved`
 * flag; `vatRateBp` stays basis points (no arithmetic on it here).
 *
 * This story does NOT persist the snapshot to any table (Epic 6 owns quote-version freeze) — it
 * builds the FROZEN in-memory VAT-assumption value the later quote snapshot will carry.
 */
export function buildVatAssumptionSnapshot(
  source: VatAssumptionSource,
  opts: VatAssumptionBuildOptions,
): VatAssumptionSnapshot {
  // Build the base captured payload by value (primitives), then conditionally attach the optional
  // source identity so the frozen shape omits absent optional fields rather than carrying undefined.
  const base = {
    vatRateBp: source.vatRateBp,
    defaultVatDisplay: source.defaultVatDisplay,
    capturedAt: opts.capturedAt,
  };
  const withId =
    source.sourceId !== undefined ? { ...base, sourceId: source.sourceId } : base;
  const withVersion =
    source.sourceUpdatedAt !== undefined
      ? { ...withId, sourceUpdatedAt: source.sourceUpdatedAt }
      : withId;
  return Object.freeze(withVersion satisfies VatAssumptionSnapshot);
}

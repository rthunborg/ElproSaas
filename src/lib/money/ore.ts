/**
 * Story 4.1 — the PURE integer-öre money + rounding engine (architecture §22:
 * `src/lib/money`). This is the FIRST money / VAT / ROT calculation surface in the repo —
 * Epic 4 owns it (project-context: "NO money/VAT/ROT CALCULATION ENGINE exists yet").
 *
 * ── PURITY / DETERMINISM ─────────────────────────────────────────────────────────
 * Every function here is PURE: NO I/O, NO DB access, NO clock read (`Date.now()` never
 * appears), NO network. That is why the engine is exhaustively `node --test` unit-testable
 * and golden-pinnable — a function is a deterministic function of its inputs alone. (It
 * mirrors the injected-clock discipline of `src/lib/snapshots/build.ts` / the command
 * clock, though 4.1 does no snapshotting.)
 *
 * ── INTEGER ÖRE END-TO-END (R-401, load-bearing epic invariant) ──────────────────
 * ALL internal money is a non-negative SAFE integer öre `number`. NO float-kronor value
 * ever survives off the presentation boundary — the ONLY place öre becomes a kronor STRING
 * is `formatOreAsKronor` (the presentation-boundary formatter). Every value that crosses a
 * function boundary here is öre; a kronor string is produced only by that one formatter.
 *
 * ── ONE öre-VALIDITY RULE (no fork) ──────────────────────────────────────────────
 * `isOreAmount` / `ORE_AMOUNT_MAX` are the SINGLE money-validity authority (moved here from
 * `src/server/commands/pricing/validation.ts`, which now re-exports them). There is exactly
 * ONE implementation in the codebase; a new öre field is validated by this same unit, never
 * a second forked rule. (project-context: "Reuse `isOreAmount` for every new öre field".)
 *
 * ── ROUNDING POLICY (R-402, golden-PINNED conservative pilot assumption) ─────────
 * Rounding is LINE-LEVEL with a single explicitly-pinned half-rounding mode:
 * ROUND-HALF-AWAY-FROM-ZERO (`Math.round` semantics on non-negative inputs — `x.5 → x+1`),
 * NOT half-to-even / banker's rounding. Section/quote totals PRESERVE exact öre by SUMMING
 * the already-rounded line values (`sumOre` = SUM-OF-ROUNDED, never round-of-sum). The mode
 * is pinned by `tests/fixtures/golden/money/rounding-mode.json` so an accidental flip fails
 * loud. THIS ROUNDING POLICY IS A CONSERVATIVE PILOT ASSUMPTION PENDING OWNER/ACCOUNTING
 * SIGN-OFF (architecture.md#10 Rounding) — it is recorded as an assumption, NOT hard-coded
 * as accounting-final. If accounting requires DOCUMENT-LEVEL rounding, or a discount /
 * negative-amount data model, that is a STOP CONDITION (report `needs-human`), not something
 * this engine invents.
 *
 * ── NO PII in the pure engine (R-411/R-412 posture) ─────────────────────────────
 * No personnummer, orgnr, customer field, or clock read ever enters this module — it is pure
 * math over öre + quantity numbers only. That posture is established here and inherited by
 * the 4.2 (VAT) and 4.3 (ROT / grön teknik) engines.
 *
 * [Source: epics.md#Story 4.1 AC1-AC4 + Technical Notes; architecture.md#10 (integer öre,
 *  line-level rounding, sum rounded lines, kronor only at presentation) / #22 (`src/lib/money`);
 *  project-context.md#Money rules; test-design-epic-4.md R-401/R-402/R-413 + 4.1-UNIT-01..07 +
 *  4.1-GOLDEN-01; `src/server/commands/pricing/validation.ts` (`isOreAmount`/`ORE_AMOUNT_MAX`).]
 */

/**
 * The typed failure discriminant the engine returns for any invalid money/quantity input.
 * The primitives NEVER throw, NEVER echo the raw invalid value, and NEVER return
 * `NaN`/`Infinity` — they return a stable typed failure whose `code` is the contract a
 * caller / test asserts on (user-safe, never an internal message or the raw value).
 */
export type MoneyErrorCode =
  /** A unit-price öre value was not a valid `isOreAmount` (float/negative/NaN/∞/overflow/…). */
  | "INVALID_ORE_AMOUNT"
  /** A quantity was not a finite non-negative decimal number. */
  | "INVALID_QUANTITY"
  /** A VAT rate was not a valid basis-point value (integer, [0, 10000]) — Story 4.2 VAT path. */
  | "INVALID_VAT_RATE_BP"
  /**
   * A DEDUCTION rate (ROT / grön teknik `deductionPercentBp`) was not a valid basis-point value —
   * Story 4.3 tax path. Tax-scoped twin of `INVALID_VAT_RATE_BP`: the deduction-rate validity check
   * REUSES the one `isVatRateBp` bp-validity predicate (a deduction % expressed as bp is the same
   * 0..10000 integer-bp discipline — no forked rule), but a malformed *tax* profile rate surfaces as
   * this tax-scoped discriminant so the error surface is self-describing across the story boundary
   * (a VAT-named code must not leak out of the deduction path). Defense-in-depth — shipped profiles
   * are frozen `const` and always valid, so this branch is effectively unreachable in production.
   */
  | "INVALID_DEDUCTION_RATE_BP"
  /**
   * A snapshot `capturedAt` instant was not a valid non-empty string — Story 4.2/4.3 snapshot
   * builders. The injected capture instant anchors a FROZEN assumption a later quote-version freeze
   * (Epic 6) consumes, so an empty/non-string capture instant is rejected with this typed failure
   * rather than frozen verbatim, matching the engine's every-input-is-type-guarded discipline.
   */
  | "INVALID_CAPTURED_AT"
  /** A computed line net / total exceeded the safe öre ceiling (`ORE_AMOUNT_MAX`). */
  | "ORE_OVERFLOW"
  /**
   * A single calculation attempted to combine ROT AND grön teknik — Story 4.3 tax path.
   * ROT and grön teknik CANNOT be mixed on one calculation (owner decision 2026-06-18): the
   * engine returns this BLOCKING failure, NEVER a silently-combined deduction sum (R-406).
   */
  | "ROT_GRON_MIX_NOT_ALLOWED"
  /**
   * A deduction type outside the closed `{ "rot", "gron_teknik" }` set was requested — Story 4.3
   * tax path. A clear typed error (never a silent fall-through to a wrong profile) so an unknown /
   * misspelt / future deduction category fails loud rather than computing on a wrong rate (4.3-UNIT-07).
   */
  | "UNKNOWN_DEDUCTION_TYPE";

/**
 * A pure money result: an OK carrying a validated integer-öre `value`, or a typed failure
 * carrying only a stable `code`. It mirrors the `KronorParseResult` `{ ok } | { ok:false }`
 * shape while adding a stable discriminant (like `Result<T,C>` in `@/lib/result/result`) so
 * a caller can branch on WHY it failed without ever seeing the raw input.
 */
export type OreResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly code: MoneyErrorCode };

/** Internal constructor for the OK arm (keeps the öre value the single carried field). */
function okOre(value: number): OreResult {
  return { ok: true, value };
}

/** Internal constructor for the typed-failure arm — carries ONLY a stable code, never the raw value. */
function failOre(code: MoneyErrorCode): OreResult {
  return { ok: false, code };
}

/**
 * The safe upper bound for an integer-öre money amount: `Number.MAX_SAFE_INTEGER`
 * (9_007_199_254_740_991 öre ≈ 90 trillion kr). Beyond it JS integer arithmetic is
 * unreliable; it fits a Postgres `bigint` comfortably. A legitimate price is many orders of
 * magnitude below this, so it is a generous-but-real guard against overflow / typo / attack.
 *
 * This is the CANONICAL definition (Story 4.1 moved it here from the pricing validator,
 * which now re-exports it) so there is exactly ONE öre ceiling in the codebase.
 */
export const ORE_AMOUNT_MAX = Number.MAX_SAFE_INTEGER;

/**
 * True iff `v` is a valid INTEGER-ÖRE money amount: a non-negative SAFE integer NUMBER.
 *
 * Accepts: 0, 1, 85000, … up to `ORE_AMOUNT_MAX` (inclusive). REJECTS — by design and
 * pinned by the pricing-validation + money units:
 *   - a FLOAT öre (850.5, 0.5) — öre are whole integers, never fractional;
 *   - a NEGATIVE öre (-1) — prices are non-negative (Phase A has no discount/negative money);
 *   - NaN / +Infinity / -Infinity — non-finite is never a price;
 *   - overflow (> `ORE_AMOUNT_MAX`) — unreliable / absurd;
 *   - a LOCALE-COMMA string ("850,00") — the comma-decimal trap (the boundary helper
 *     converts kronor→öre; a raw comma string reaching a money authority is a BUG);
 *   - a DECIMAL / numeric / non-numeric string ("850.00", "85000", "abc") — the authority
 *     takes a NUMBER, never a coerced string;
 *   - null / undefined / object.
 *
 * This is the CANONICAL, single-source öre-validity rule. `src/server/commands/pricing/
 * validation.ts` re-exports it — both call sites share this one implementation (no fork).
 */
export function isOreAmount(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isInteger(v) &&
    v >= 0 &&
    v <= ORE_AMOUNT_MAX
  );
}

/**
 * True iff `q` is a valid QUANTITY: a FINITE, NON-NEGATIVE decimal `number` (architecture
 * §10 — "quantities use explicit decimal/numeric quantity plus unit"). A fractional quantity
 * such as `1.5` / `0.333` / `2.25` is valid; the rounding step (`lineNetOre`) absorbs the
 * float-multiplication residue into an exact integer öre.
 *
 * REJECTS: `NaN`, `±Infinity`, negatives, and any non-number (string/null/undefined/object).
 * Kept a plain finite `number` for Phase A — no arbitrary-precision decimal library (that
 * would be a gated new dependency); `roundToOre` makes the multiplied result deterministic.
 */
export function isQuantity(q: unknown): q is number {
  return typeof q === "number" && Number.isFinite(q) && q >= 0;
}

/**
 * Validate a quantity, returning a typed result (never a throw / `NaN`). OK carries the
 * finite non-negative decimal; a malformed quantity yields `{ ok:false, code:"INVALID_QUANTITY" }`
 * with NO raw value echoed. (Exposed for callers that validate a quantity independently of a
 * line net; `lineNetOre` validates internally too.)
 */
export function validateQuantity(q: unknown): OreResult {
  return isQuantity(q) ? okOre(q) : failOre("INVALID_QUANTITY");
}

/**
 * The SINGLE rounding primitive: round a real öre value to the NEAREST whole öre using
 * ROUND-HALF-AWAY-FROM-ZERO (i.e. `Math.round` semantics for non-negative inputs — `x.5`
 * rounds UP to `x+1`). This is the explicitly-pinned conservative half-rounding mode; it is
 * NOT half-to-even / banker's rounding. EVERY rounding in the engine goes through this ONE
 * function so the mode is defined in exactly one place (and golden-pinned).
 *
 * Note `Math.round(-0.5) === -0` (toward +∞), i.e. it is not strictly symmetric about zero,
 * but the engine only ever rounds NON-NEGATIVE products (unit price and quantity are both
 * non-negative), so within its domain `Math.round` IS round-half-away-from-zero. A non-finite
 * input is returned as-is (`NaN`/`±Infinity`) — callers validate inputs BEFORE calling this,
 * so a non-finite value never reaches a customer-visible öre.
 */
export function roundToOre(value: number): number {
  return Math.round(value);
}

/**
 * Compute a LINE NET in integer öre: `roundToOre(quantity × unitPriceOre)`.
 *
 * Validates BOTH inputs FIRST — `isQuantity(quantity)` (finite non-negative decimal) and
 * `isOreAmount(unitPriceOre)` (non-negative safe integer öre). An invalid input returns the
 * matching typed failure (never a `NaN` / throw). The rounding is LINE-LEVEL — it happens
 * per line, at this boundary. The output is re-checked against `isOreAmount` so an
 * overflowing product (e.g. `2 × ORE_AMOUNT_MAX`) is a typed `ORE_OVERFLOW` failure, never a
 * silently-unsafe integer.
 */
export function lineNetOre(quantity: number, unitPriceOre: number): OreResult {
  if (!isQuantity(quantity)) return failOre("INVALID_QUANTITY");
  if (!isOreAmount(unitPriceOre)) return failOre("INVALID_ORE_AMOUNT");
  const net = roundToOre(quantity * unitPriceOre);
  // The product can exceed the safe-integer ceiling even when both inputs are individually
  // valid (a large quantity × a large unit price). Guard the OUTPUT, not just the inputs.
  if (!isOreAmount(net)) return failOre("ORE_OVERFLOW");
  return okOre(net);
}

/**
 * Sum an array of ALREADY-ROUNDED integer-öre line values into an exact integer-öre total.
 *
 * This is SUM-OF-ROUNDED, never round-of-sum: section / quote totals preserve exact öre by
 * summing the rounded line values — no re-rounding of the sum (even if a UI/PDF later shows
 * whole kronor). Each element is validated with `isOreAmount` (a non-öre element is a typed
 * `INVALID_ORE_AMOUNT` failure), and the accumulator is guarded so a total past
 * `ORE_AMOUNT_MAX` is a typed `ORE_OVERFLOW` failure rather than a silently-unsafe integer.
 * An empty array sums to `0`. Section/quote totals in later epics are built from this primitive.
 */
export function sumOre(values: readonly number[]): OreResult {
  let total = 0;
  for (const v of values) {
    if (!isOreAmount(v)) return failOre("INVALID_ORE_AMOUNT");
    total += v;
    // Guard AFTER each add so the running total never leaves the safe-integer range.
    if (total > ORE_AMOUNT_MAX) return failOre("ORE_OVERFLOW");
  }
  return okOre(total);
}

/**
 * The CANONICAL öre→kronor DISPLAY formatter — the ONLY place öre becomes a kronor string in
 * the calculation path (the presentation boundary). Produces a Swedish kronor string with a
 * comma decimal and exactly two decimals: `85000 → "850,00"`, `1 → "0,01"`, `0 → "0,00"`,
 * `1250 → "12,50"`. A non-finite öre (`NaN` / `±Infinity`) yields `""` so no `NaN` ever leaks
 * to the UI. NO business calculation happens here — presentation / encoding only.
 *
 * Total & defensive so it can back the pricing-UI formatter too: a negative öre keeps its
 * sign (`-85000 → "-850,00"`) and a non-integer öre is truncated toward zero before
 * formatting (`1250.9 → "12,50"`) rather than emitting a fractional/`NaN` string. The
 * calculation path only ever feeds it validated non-negative integer öre; the sign/truncate
 * behaviour exists so `src/features/pricing/money-display.ts` can delegate to this single
 * formatting authority without a divergent second implementation.
 */
export function formatOreAsKronor(ore: number): string {
  if (!Number.isFinite(ore)) return "";
  const sign = ore < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(ore));
  const kronor = Math.floor(abs / 100);
  const remainder = abs % 100;
  const fractional = String(remainder).padStart(2, "0");
  return `${sign}${kronor},${fractional}`;
}

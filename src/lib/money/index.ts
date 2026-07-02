/**
 * `@/lib/money` — the pure integer-öre money + rounding engine (Story 4.1, architecture §22).
 *
 * Barrel re-export of the öre-arithmetic primitives, the single öre-validity rule, and the
 * presentation-boundary kronor formatter. See `./ore.ts` for the full module documentation
 * (integer-öre-end-to-end invariant, the golden-pinned line-level half-away-from-zero rounding
 * policy, and the pure/no-PII/no-clock discipline).
 *
 * The `@/lib/money` alias resolves to this file (`src/lib/money/index.ts`) for both the
 * `node --test` unit runner (via `tests/support/alias-hook.mjs`) and tsc/Next.
 */
export {
  ORE_AMOUNT_MAX,
  isOreAmount,
  isQuantity,
  validateQuantity,
  roundToOre,
  lineNetOre,
  sumOre,
  formatOreAsKronor,
} from "./ore";

export type { MoneyErrorCode, OreResult } from "./ore";

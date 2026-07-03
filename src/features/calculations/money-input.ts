/**
 * The kronor↔öre and percent↔bp UI boundary for the calc editor (Story 5.2, Task 2.4).
 *
 * This module REUSES the existing seams rather than forking a second parser:
 *   - `kronorStringToOre` / `oreToKronorString` (pricing) for the cost/sell price inputs
 *     (kronor Swedish comma decimal ↔ integer öre);
 *   - `percentStringToBp` / `bpToPercentString` (settings) for the VAT input (a VAT % is
 *     the same 0..100 → 0..10000 bp discipline);
 *   - a markup-specific percent↔bp parse (`percentStringToMarkupBp` /
 *     `markupBpToPercentString`) because a cost→sell MARKUP can exceed 100% (a VAT rate
 *     cannot) — it mirrors the settings percent parse but with the markup upper bound, and
 *     is NOT a fork of the VAT-only `percentStringToBp`.
 *
 * CRITICAL boundary note: this is a UX NICETY ONLY. The authority is the 5.1 command's
 * `isOreAmount` / `isVatRateBp` / `isMarkupBp` re-validation on the server. The parse must
 * never mis-parse "850,00" or leak a NaN/float into the stored value; the display direction
 * routes through the single `formatOreAsKronor`. NO calculation happens here.
 */
import {
  kronorStringToOre,
  oreToKronorString,
  type KronorParseResult,
} from "@/features/pricing/money-display";
import { MARKUP_BP_MAX } from "@/server/commands/calculations/validation";

// Re-export the kronor seam under the calc-editor's names so the editor imports one place.
export { kronorStringToOre, oreToKronorString };
export type { KronorParseResult };
export {
  percentStringToBp,
  bpToPercentString,
  type PercentParseResult,
} from "@/features/settings/vat-display";

/** The outcome of parsing a markup percent input into basis points. */
export type MarkupParseResult =
  | { readonly ok: true; readonly bp: number }
  | { readonly ok: false };

/**
 * Parse a user-entered MARKUP percent string into INTEGER basis points, accepting values
 * ABOVE 100% (a cost→sell markup is not a VAT rate). Mirrors the settings percent parse
 * shape (Swedish comma tolerated, at most two fractional digits → sub-bp rejected) but uses
 * the markup upper bound (`MARKUP_BP_MAX`, the same ceiling the 5.1 `isMarkupBp` validator
 * enforces). A blank input → rejected here only when the caller treats markup as required;
 * the editor treats markup as OPTIONAL, so a blank is handled by the parser as "omit".
 *
 * Examples: "0" → 0; "25" → 2500; "150" → 15000; "12,5" → 1250; "-5" → rejected;
 * "25.555" → rejected (sub-bp precision).
 */
export function percentStringToMarkupBp(raw: string): MarkupParseResult {
  const trimmed = raw.trim().replace(",", "."); // accept Swedish decimal comma
  if (trimmed.length === 0) return { ok: false };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return { ok: false };
  const percent = Number(trimmed);
  if (!Number.isFinite(percent)) return { ok: false };
  const bp = Math.round(percent * 100);
  if (!Number.isInteger(bp)) return { ok: false };
  if (bp < 0 || bp > MARKUP_BP_MAX) return { ok: false };
  return { ok: true, bp };
}

/**
 * Format a stored markup basis-points value as a percent string for display (no trailing
 * ".00" — `15000` → "150"). A non-finite bp yields "".
 */
export function markupBpToPercentString(bp: number): string {
  if (!Number.isFinite(bp)) return "";
  const percent = bp / 100;
  return String(percent);
}

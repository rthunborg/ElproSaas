/**
 * PURE kronor↔öre money boundary helpers (Story 3.4, Task 4.2) — the single conversion
 * seam between the pricing UI (which DISPLAYS kronor, Swedish comma decimal, e.g.
 * "850,00 kr/tim") and the stored value (INTEGER ÖRE). Mirrors the 3.3 bp↔percent
 * boundary (`percentStringToBp`/`bpToPercentString` in `src/features/settings/
 * vat-display.ts`). I/O-free so it is exhaustively unit-testable (`tests/unit/**`).
 *
 * CRITICAL boundary note: this is a UX NICETY only. The authority is the pricing
 * command's `isOreAmount`/`validateUpsert*` on the server (architecture §5) — the
 * command RE-VALIDATES the integer öre. But this helper must NEVER mis-parse "850,00"
 * or leak a NaN/float into the stored value: it accepts the Swedish comma decimal AND a
 * plain integer, rejects negatives / >2 decimals / signs / thousands separators /
 * non-numeric / blank, and always yields a non-negative INTEGER number of öre.
 *
 * NO calculation is done here (Epic 4 owns the money engine) — presentation/encoding only.
 *
 * FORMATTER CONSOLIDATION (Story 4.1): the öre→kronor DISPLAY direction is now a single
 * authority — `formatOreAsKronor` in `@/lib/money` (the calculation-engine's presentation
 * boundary). `oreToKronorString` below DELEGATES to it so there is ONE formatting
 * implementation in the codebase (byte-identical output). This module remains the pricing-UI
 * input parse/format seam (`kronorStringToOre` is the UI-input parse; `oreToKronorString`
 * keeps its name for the existing UI consumers); `@/lib/money` is the calculation-engine's
 * formatter. Both emit the identical Swedish comma-decimal string.
 */
import { formatOreAsKronor } from "@/lib/money";

/** The outcome of parsing a kronor input string into integer öre. */
export type KronorParseResult =
  | { readonly ok: true; readonly ore: number }
  | { readonly ok: false };

/**
 * Parse a user-entered kronor string into INTEGER öre.
 *
 * Accepts: a Swedish comma decimal ("850,00" → 85000), a plain integer ("850" → 85000,
 * "0" → 0), and one/two-decimal comma inputs ("12,5" → 1250, "0,01" → 1 öre). Leading/
 * trailing whitespace around a valid value is tolerated.
 *
 * Rejects (→ { ok: false }): negatives ("-5"), sub-öre precision / >2 decimals
 * ("850,005"), non-numeric / blank / whitespace-only, an explicit sign ("+850"), a
 * thousands separator ("1.000,00"), and a unit suffix ("850 kr"). The result is ALWAYS
 * a non-negative INTEGER number of öre (never a float).
 */
export function kronorStringToOre(input: string): KronorParseResult {
  if (typeof input !== "string") return { ok: false };
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false };
  // A plain non-negative integer kronor, OR a comma-decimal with 1-2 fractional digits.
  // No sign, no thousands separator, no unit suffix, no dot decimal.
  const match = /^(\d+)(?:,(\d{1,2}))?$/.exec(trimmed);
  if (!match) return { ok: false };
  const kronor = Number(match[1]);
  // Pad the fractional part to exactly two digits (öre): "5" → 50, "" → 0, "01" → 1.
  const fractional = (match[2] ?? "").padEnd(2, "0");
  const ore = kronor * 100 + Number(fractional);
  if (!Number.isInteger(ore) || ore < 0) return { ok: false };
  return { ok: true, ore };
}

/**
 * Format integer öre as a Swedish kronor string with exactly two decimals (a comma
 * decimal): 85000 → "850,00", 0 → "0,00", 1 → "0,01", 1250 → "12,50". A non-finite öre
 * (NaN / ±Infinity) yields "" so no NaN ever leaks into the UI. A negative öre keeps its
 * sign and a non-integer öre is truncated toward zero (defensive) — see `formatOreAsKronor`.
 *
 * DELEGATES to the canonical `@/lib/money` formatter so there is ONE öre→kronor formatting
 * authority in the codebase (Story 4.1 consolidation). Kept under this name for the existing
 * pricing-UI consumers (`WorkRolesEditor` / `ArticlesEditor`).
 */
export function oreToKronorString(ore: number): string {
  return formatOreAsKronor(ore);
}

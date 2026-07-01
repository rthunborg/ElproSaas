/**
 * PURE VAT display/encoding helpers (Story 3.3) — the bp↔percent boundary conversion
 * and the VAT-display-mode label map. I/O-free so they are exhaustively unit-testable
 * (`tests/unit/**`).
 *
 * MONEY discipline: the UI shows the VAT rate as a PERCENT (e.g. "25 %"), but the
 * stored value is INTEGER BASIS POINTS (2500 = 25.00%). The conversion happens HERE,
 * at the boundary — the stored value is never a float. NO VAT CALCULATION is done
 * here (Epic 4 owns the engine); this is presentation/encoding only.
 */
import {
  VAT_DISPLAY_MODES,
  VAT_RATE_BP_MAX,
  VAT_RATE_BP_MIN,
  type VatDisplayMode,
} from "@/server/commands/settings/validation";

/** Swedish labels for the default VAT display modes (UX §4/§9). */
export const VAT_DISPLAY_LABELS: Record<VatDisplayMode, string> = {
  company_togglable:
    "Företagskunder: moms kan visas/döljas (privatkunder visas alltid inkl. moms)",
  company_excl:
    "Företagskunder: visa exkl. moms som standard (privatkunder visas alltid inkl. moms)",
};

/** The select options for the default-VAT-display control, in a stable order. */
export const VAT_DISPLAY_OPTIONS: ReadonlyArray<{
  readonly value: VatDisplayMode;
  readonly label: string;
}> = VAT_DISPLAY_MODES.map((value) => ({
  value,
  label: VAT_DISPLAY_LABELS[value],
}));

/**
 * Convert a stored basis-points rate to a percent string for display (no trailing
 * ".00" — `2500` → "25", `2550` → "25.5"). Used to seed the percent input.
 */
export function bpToPercentString(bp: number): string {
  if (!Number.isFinite(bp)) return "";
  const percent = bp / 100;
  // Trim a trailing ".00" / unnecessary decimals while preserving real fractions.
  return Number.isInteger(percent) ? String(percent) : String(percent);
}

/** The outcome of parsing a percent input into basis points. */
export type PercentParseResult =
  | { readonly ok: true; readonly bp: number }
  | { readonly ok: false };

/**
 * Parse a user-entered percent string into INTEGER basis points, rejecting anything
 * that is not a clean percent in [0, 100.00] (which maps to [0, 10000] bp). A value
 * with more than two decimal places (sub-basis-point precision) is rejected — basis
 * points are the smallest unit. Empty/blank → rejected (the rate is required).
 *
 * Examples: "25" → 2500; "25.5" → 2550; "0" → 0; "100" → 10000; "250" → rejected
 * (out of range); "abc" → rejected; "25.555" → rejected (sub-bp precision).
 */
export function percentStringToBp(raw: string): PercentParseResult {
  const trimmed = raw.trim().replace(",", "."); // accept Swedish decimal comma
  if (trimmed.length === 0) return { ok: false };
  // A plain decimal number with at most two fractional digits.
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return { ok: false };
  const percent = Number(trimmed);
  if (!Number.isFinite(percent)) return { ok: false };
  const bp = Math.round(percent * 100);
  if (!Number.isInteger(bp)) return { ok: false };
  if (bp < VAT_RATE_BP_MIN || bp > VAT_RATE_BP_MAX) return { ok: false };
  return { ok: true, bp };
}

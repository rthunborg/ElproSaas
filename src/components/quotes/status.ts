/**
 * Quote-version lifecycle status → Swedish TEXT label + a redundant color cue (Story 6.2,
 * Task 2.3 / 4.2; WCAG 1.4.1). The badge LABEL is the status word — a screen-reader / colour-
 * blind user reads the status from TEXT alone; the color class is at most a redundant
 * reinforcement, NEVER the sole signal (a color-only badge fails the story).
 *
 * PURE (no JSX) so it is importable both by the client island and by a `node --test` unit.
 * [Source: epics.md#Story 6.2 Technical Notes; test-design-epic-6.md#6.2-E2E-04; ux §6]
 */
import type { QuoteVersionStatus } from "@/features/quotes/timeline";

/** The Swedish TEXT label shown IN the badge (the machine status → a human word). */
export const QUOTE_STATUS_LABELS: Record<QuoteVersionStatus, string> = {
  draft: "Utkast",
  sent: "Skickad",
  accepted: "Accepterad",
  rejected: "Avvisad",
  expired: "Utgången",
  superseded: "Ersatt",
};

/**
 * A REDUNDANT color class for the badge (background/text/border). Text is always the primary
 * signal — this is a reinforcement only. Falls back to neutral for an unknown status.
 */
export const QUOTE_STATUS_COLORS: Record<QuoteVersionStatus, string> = {
  draft: "bg-zinc-100 text-zinc-800 border-zinc-300",
  sent: "bg-blue-100 text-blue-800 border-blue-300",
  accepted: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  expired: "bg-amber-100 text-amber-800 border-amber-300",
  superseded: "bg-zinc-100 text-zinc-600 border-zinc-300",
};

/** The TEXT label for a status (the badge text). Unknown status → the raw code (never blank). */
export function quoteStatusLabel(status: string): string {
  return QUOTE_STATUS_LABELS[status as QuoteVersionStatus] ?? status;
}

/** The redundant color class for a status. Unknown status → a neutral class. */
export function quoteStatusColor(status: string): string {
  return (
    QUOTE_STATUS_COLORS[status as QuoteVersionStatus] ??
    "bg-zinc-100 text-zinc-700 border-zinc-300"
  );
}

/** A version is customer-visible READ-ONLY (no edit affordances) once it is sent/accepted. */
export function isReadOnlyStatus(status: string): boolean {
  return status !== "draft";
}

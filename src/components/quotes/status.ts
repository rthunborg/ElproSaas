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
import type { FollowUpDateClass } from "@/features/quotes/follow-up-dates";

/** The Swedish TEXT label shown IN the badge (the machine status → a human word). */
export const QUOTE_STATUS_LABELS: Record<QuoteVersionStatus, string> = {
  draft: "Utkast",
  sent: "Skickad",
  accepted: "Accepterad",
  rejected: "Avvisad",
  expired: "Utgången",
  superseded: "Ersatt",
  // Story 10.2 — the single terminal Förlorad/Avböjd token. The Förlorad-vs-Avböjd flavour is
  // resolved from the joined quote_lost_reasons.outcome on the card; the badge word is this label.
  lost: "Förlorad/Avböjd",
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
  // Story 10.2 — a terminal rose/dark tone, VISUALLY DISTINCT from accepted's green (AC2). Text is
  // still the primary signal; this color only reinforces the terminal Förlorad/Avböjd state.
  lost: "bg-rose-100 text-rose-900 border-rose-300",
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

// ─────────────────────────────────────────────────────────────────────────────
// Story 10.2 — the Förlorad/Avböjd reason label maps (ASCII machine token → Swedish UI label).
// The lifecycle STATUS is the single `lost` token (badge label "Förlorad/Avböjd"); the specific
// Förlorad-vs-Avböjd flavour + the category live in the joined quote_lost_reasons row and are
// resolved to Swedish here for the version card + the list Förlustorsak column.
// ─────────────────────────────────────────────────────────────────────────────

/** The lost-reason outcome label (forlorad→"Förlorad", avbojd→"Avböjd"). */
export const LOST_OUTCOME_LABELS: Record<string, string> = {
  forlorad: "Förlorad",
  avbojd: "Avböjd",
};

/** The lost-reason category label (the strawman set → Swedish UI words). */
export const LOST_CATEGORY_LABELS: Record<string, string> = {
  pris: "Pris",
  konkurrent: "Konkurrent",
  tidplan: "Tidplan",
  uteblivet_svar: "Uteblivet svar",
  annat: "Annat",
};

/** The Swedish outcome label for a machine token (unknown → the raw token, never blank). */
export function lostOutcomeLabel(outcome: string): string {
  return LOST_OUTCOME_LABELS[outcome] ?? outcome;
}

/** The Swedish category label for a machine token (unknown → the raw token, never blank). */
export function lostCategoryLabel(category: string): string {
  return LOST_CATEGORY_LABELS[category] ?? category;
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 10.4 — the FOLLOW-UP tone authority (Task 4.1; AC2; the named 10-3 deferred item). The 10.3
// follow-up chip + overdue badge hardcoded bespoke inline tones that SHADOWED QUOTE_STATUS_COLORS;
// this folds them into the SHARED status.ts primitive keyed by the FollowUpDateClass (upcoming /
// due-today / overdue), mirroring the QUOTE_STATUS_LABELS/COLORS + quoteStatusLabel/Color shape.
// TEXT-FIRST (WCAG 1.4.1): the label is the primary signal; the color is a REDUNDANT reinforcement.
// PURE (no JSX) so both the client island (FollowUpChip.tsx) and a node --test unit consume ONE authority.
// ─────────────────────────────────────────────────────────────────────────────

/** The Swedish TEXT label per follow-up date class (the primary, text-first signal). */
export const FOLLOW_UP_TONE_LABELS: Record<FollowUpDateClass, string> = {
  upcoming: "Uppföljning",
  "due-today": "Uppföljning idag",
  overdue: "Försenad uppföljning",
};

/**
 * A REDUNDANT color class per follow-up date class (blue / amber / rose). These are the 10.3 chip tones,
 * byte-preserved through the fold so the render is visually unchanged. Text is always the primary signal.
 */
export const FOLLOW_UP_TONE_COLORS: Record<FollowUpDateClass, string> = {
  upcoming: "bg-blue-100 text-blue-800 border-blue-300",
  "due-today": "bg-amber-100 text-amber-900 border-amber-300",
  overdue: "bg-rose-100 text-rose-900 border-rose-300",
};

/** The TEXT label for a follow-up tone. Unknown key → the raw key (never blank), mirrors quoteStatusLabel. */
export function followUpToneLabel(state: string): string {
  return FOLLOW_UP_TONE_LABELS[state as FollowUpDateClass] ?? state;
}

/** The redundant color class for a follow-up tone. Unknown key → a neutral class, mirrors quoteStatusColor. */
export function followUpToneColor(state: string): string {
  return (
    FOLLOW_UP_TONE_COLORS[state as FollowUpDateClass] ??
    "bg-zinc-100 text-zinc-700 border-zinc-300"
  );
}

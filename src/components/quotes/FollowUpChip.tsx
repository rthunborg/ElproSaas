"use client";

/**
 * The next-follow-up chip (Story 10.3, Task 5.3; UX-BDR17/BDR4). Rendered in the quote-detail header
 * when the quote has an OPEN follow-up. Follows the `StatusBadge`/`ConnectionChip` contract: the state
 * is conveyed as TEXT first (WCAG 1.4.1) — an OVERDUE follow-up escalates to "Försenad uppföljning"
 * with a rose tone, a due-today one reads "Uppföljning idag" (amber), an upcoming one "Uppföljning"
 * (blue). The color is a REDUNDANT reinforcement, never the sole signal. `data-overdue` /
 * `data-due-today` expose the escalation state for the badge contract + the E2E.
 *
 * The overdue/due-today flags are computed by the pure `followUpChipState` selector on the
 * Europe/Stockholm boundary from an INJECTED instant (never `Date.now()`); this component only
 * renders that already-computed state.
 *
 * Story 10.4 (Task 4.2; the named 10-3 deferral): the label + tone are drawn from the SHARED
 * `status.ts` follow-up tone authority (`followUpToneLabel`/`followUpToneColor`) — the bespoke inline
 * `label`/`color` ternaries that shadowed `QUOTE_STATUS_COLORS` are deleted. Text stays the primary
 * signal; the `data-testid`/`data-overdue`/`data-due-today` contract is preserved.
 */
import { followUpToneLabel, followUpToneColor } from "./status";
import type { FollowUpDateClass } from "@/features/quotes/follow-up-dates";

/**
 * Format an ISO date (YYYY-MM-DD) as a Swedish date; a malformed value renders "—". The
 * `timeZone: "Europe/Stockholm"` option is load-bearing: without it the browser folds the
 * midnight-UTC `date` to the HOST zone, so a viewer west of UTC (or a UTC render environment)
 * can see the PREVIOUS calendar day — disagreeing with the server overdue flag. This module
 * reasons on the Stockholm boundary everywhere; the display must too (WCAG/date-discipline).
 */
function formatDueDate(dueDate: string): string {
  const t = Date.parse(dueDate);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });
}

export function FollowUpChip({
  dueDate,
  overdue,
  dueToday,
}: {
  readonly dueDate: string;
  readonly overdue: boolean;
  readonly dueToday: boolean;
}) {
  // The escalation state → a FollowUpDateClass; label + tone come from the shared status.ts authority.
  const toneState: FollowUpDateClass = overdue
    ? "overdue"
    : dueToday
      ? "due-today"
      : "upcoming";
  const label = followUpToneLabel(toneState);
  const color = followUpToneColor(toneState);
  return (
    <span
      data-testid="next-follow-up-chip"
      data-overdue={overdue ? "true" : "false"}
      data-due-today={dueToday ? "true" : "false"}
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        color,
      ].join(" ")}
    >
      {label} · {formatDueDate(dueDate)}
    </span>
  );
}

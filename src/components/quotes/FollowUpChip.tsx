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
 */

/** Format an ISO date (YYYY-MM-DD) as a Swedish date; a malformed value renders "—". */
function formatDueDate(dueDate: string): string {
  const t = Date.parse(dueDate);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString("sv-SE");
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
  const label = overdue
    ? "Försenad uppföljning"
    : dueToday
      ? "Uppföljning idag"
      : "Uppföljning";
  const color = overdue
    ? "bg-rose-100 text-rose-900 border-rose-300"
    : dueToday
      ? "bg-amber-100 text-amber-900 border-amber-300"
      : "bg-blue-100 text-blue-800 border-blue-300";
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

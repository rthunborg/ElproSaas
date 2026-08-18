/**
 * Pure Europe/Stockholm due/overdue classification for quote follow-ups (Story 10.3, Task 4.1;
 * SETTLED DESIGN DECISION 4; AC2). `classifyFollowUp(dueDateISO, now, timeZone)` is a PURE function
 * over `(due_date, injectedNow)` — it computes "today in Europe/Stockholm" from the INJECTED instant
 * and returns whether an OPEN follow-up is upcoming / due-today / overdue.
 *
 * The load-bearing discipline (mirrors the render path's injected-clock / sv-SE discipline in
 * `src/server/quote-pdf/render.ts`):
 *   - it computes the Stockholm calendar day via an explicit `Intl.DateTimeFormat('sv-SE', { timeZone:
 *     'Europe/Stockholm' })` — NEVER the host default locale/zone, NEVER `Date.now()` on this path;
 *   - the comparison is on YYYY-MM-DD strings (lexicographic = calendar-correct), so a `date`-typed
 *     due_date needs no time-of-day or tz reasoning;
 *   - the result is DETERMINISTIC over the injected instant. Story 10.4 reuses this date discipline
 *     for its period windows.
 *
 * The Stockholm boundary is why the zone is load-bearing: an instant late in a UTC day is already the
 * NEXT calendar day in Stockholm (UTC+1/+2), so a naive host-UTC classifier would misfile a due date
 * by a whole day. Completed follow-ups are never due/overdue — that status-aware exclusion lives in
 * `follow-up-view.ts` (this module is the pure date primitive).
 *
 * [Source: story 10.3 AC2 + Task 4.1 + SETTLED DESIGN DECISION 4; src/server/quote-pdf/render.ts]
 */

/** The classification of an OPEN follow-up's due date relative to "today in Stockholm". */
export type FollowUpDateClass = "upcoming" | "due-today" | "overdue";

import { stockholmBusinessDate } from "@/lib/datetime/business-date";

/**
 * "Today in `timeZone`" as a YYYY-MM-DD string, computed from the injected instant via an explicit
 * `sv-SE` formatter (assembled from parts so a locale separator variation can never corrupt the
 * shape). Accepts a `Date` or an ISO string for `now`.
 *
 * EXPORTED (Story 10.4, Task 1.5): the pipeline read-model's period-window helper reuses this SAME
 * sv-SE/injected-clock discipline for its `[from, to]` calendar boundary — the date convention is
 * shared, never forked (SETTLED DESIGN DECISION 6; R-1032).
 */
export function calendarDayIn(now: Date | string, timeZone: string): string {
  if (timeZone === "Europe/Stockholm") return stockholmBusinessDate(now);
  const instant = typeof now === "string" ? new Date(now) : now;
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Classify a follow-up's `due_date` (a YYYY-MM-DD calendar date) relative to "today in `timeZone`",
 * computed PURELY from the injected `now`. overdue = due_date < today; due-today = due_date == today;
 * upcoming = due_date > today. No `Date.now()`; no host-default locale/zone.
 */
export function classifyFollowUp(
  dueDateISO: string,
  now: Date | string,
  timeZone: string = "Europe/Stockholm",
): FollowUpDateClass {
  const today = calendarDayIn(now, timeZone);
  if (dueDateISO < today) return "overdue";
  if (dueDateISO === today) return "due-today";
  return "upcoming";
}

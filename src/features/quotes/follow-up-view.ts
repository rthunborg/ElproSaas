/**
 * Pure next-follow-up chip + overdue-badge selection logic (Story 10.3, Task 4.2; AC1/AC2). Two pure
 * client-island selectors extracted to a unit so the fast gate protects them (the epic-9/10 "extract
 * client-island logic to a pure unit" lesson):
 *   - `selectNextOpenFollowUp(followUps)` — picks the SINGLE open follow-up for the detail-header
 *     chip. The one-open-per-quote invariant (UXB-A6, DB-enforced by the partial unique index) means
 *     at most one open row exists per quote; the selector returns it, or `null` when the list is EMPTY
 *     or every row is COMPLETED (completed rows never drive the chip).
 *   - `followUpChipState(followUp, now)` — the chip / overdue-badge presentation state. An ABSENT or
 *     COMPLETED follow-up yields no chip (`present:false`); an OPEN follow-up yields a chip whose
 *     `overdue`/`dueToday` flags escalate the badge, computed on the Europe/Stockholm boundary via the
 *     pure date primitive (injected instant, never `Date.now()`).
 *
 * [Source: story 10.3 AC1/AC2 + Task 4.2; follow-up-dates.ts (the date primitive)]
 */
import { classifyFollowUp } from "./follow-up-dates";

/** The minimal follow-up row shape the client island consumes (mirrors the read projection). */
export interface FollowUpRecord {
  readonly id: string;
  readonly status: "open" | "completed";
  readonly due_date: string;
  readonly note: string | null;
}

/** The chip / overdue-badge presentation state for the detail header. */
export interface FollowUpChipState {
  readonly present: boolean;
  readonly overdue: boolean;
  readonly dueToday: boolean;
}

/**
 * Pick the SINGLE open follow-up for the chip (at most one exists per quote — the one-open invariant).
 * Returns null when the list is empty or every row is already completed (completed never drives the
 * chip). First-open wins (the invariant guarantees at most one open, so order is immaterial).
 */
export function selectNextOpenFollowUp(
  followUps: readonly FollowUpRecord[],
): FollowUpRecord | null {
  return followUps.find((f) => f.status === "open") ?? null;
}

/**
 * The chip/overdue-badge presentation state for a follow-up. An absent or completed follow-up yields
 * no chip; an open follow-up's due date is classified on the Europe/Stockholm boundary from the
 * injected `now` (never `Date.now()`).
 */
export function followUpChipState(
  followUp: FollowUpRecord | null,
  now: Date | string,
): FollowUpChipState {
  if (!followUp || followUp.status !== "open") {
    return { present: false, overdue: false, dueToday: false };
  }
  const cls = classifyFollowUp(followUp.due_date, now);
  return {
    present: true,
    overdue: cls === "overdue",
    dueToday: cls === "due-today",
  };
}

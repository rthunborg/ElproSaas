/**
 * Story 10.3 — ATDD RED-PHASE scaffold: the PURE next-follow-up chip + overdue-badge selection logic
 * (10.3-UNIT-02, P1, AC1/AC2; test-design-epic-10.md R-1032).
 *
 * Two pure client-island selectors (Task 4.2), extracted to a unit so the fast gate protects them
 * (the epic-9/10 "extract client-island logic to a pure unit" lesson):
 *   - `selectNextOpenFollowUp(followUps)` — picks the SINGLE open follow-up for the detail-header chip.
 *     The one-open-per-quote invariant (UXB-A6, DB-enforced by the partial unique index) means at most
 *     one open row exists per quote; the selector returns it, or `null` when the list is EMPTY or every
 *     row is already COMPLETED (completed rows never drive the chip).
 *   - `followUpChipState(followUp, now)` — the chip / overdue-badge presentation state. An ABSENT or
 *     COMPLETED follow-up yields no chip (`present:false`); an OPEN follow-up yields a chip whose
 *     `overdue`/`dueToday` flags escalate the badge, computed on the Europe/Stockholm boundary via the
 *     10.3-UNIT-01 date primitive (injected instant, never `Date.now()`).
 *
 * This file pins the STATUS-aware exclusions the story lists under UNIT-01/02 (completed-excluded, empty
 * list) that the pure date primitive in `follow-up-dates.test.ts` deliberately does not own.
 *
 * ── GREEN (Story 10.3 implemented) ────────────────────────────────────────────────────────────────
 * `src/features/quotes/follow-up-view.ts` is landed; this suite imports the real selectors + row shape
 * and every test is unskipped and green. The assertions are the CONTRACT — do not weaken them.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII. Two-runner discipline.
 *
 * [Source: story 10.3 AC1/AC2 + Task 4.2 + Dev Notes "Keep client-island logic on the fast unit gate";
 *  test-design-epic-10.md#10.3-UNIT-02, R-1032]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectNextOpenFollowUp,
  followUpChipState,
  type FollowUpRecord,
} from "@/features/quotes/follow-up-view";

const NOON_UTC = "2026-07-19T12:00:00.000Z"; // "today in Stockholm" == 2026-07-19
const OPEN_DUE_TODAY: FollowUpRecord = { id: "f-open-today", status: "open", due_date: "2026-07-19", note: "ring kund" };
const OPEN_OVERDUE: FollowUpRecord = { id: "f-open-overdue", status: "open", due_date: "2026-07-10", note: null };
const COMPLETED: FollowUpRecord = { id: "f-done", status: "completed", due_date: "2026-07-01", note: null };

test("10.3-UNIT-02: selectNextOpenFollowUp returns the single OPEN row", () => {
  const picked = selectNextOpenFollowUp([COMPLETED, OPEN_OVERDUE]);
  assert.equal(picked?.id, OPEN_OVERDUE.id);
});

test("10.3-UNIT-02: selectNextOpenFollowUp returns null for an EMPTY list", () => {
  assert.equal(selectNextOpenFollowUp([]), null);
});

test("10.3-UNIT-02: selectNextOpenFollowUp returns null when every row is COMPLETED (completed never drives the chip)", () => {
  assert.equal(selectNextOpenFollowUp([COMPLETED, { ...COMPLETED, id: "f-done-2" }]), null);
});

test("10.3-UNIT-02: followUpChipState escalates an OVERDUE open follow-up (the badge)", () => {
  const state = followUpChipState(OPEN_OVERDUE, NOON_UTC);
  assert.equal(state.present, true);
  assert.equal(state.overdue, true);
  assert.equal(state.dueToday, false);
});

test("10.3-UNIT-02: followUpChipState marks a due-today open follow-up (present, not overdue)", () => {
  const state = followUpChipState(OPEN_DUE_TODAY, NOON_UTC);
  assert.equal(state.present, true);
  assert.equal(state.overdue, false);
  assert.equal(state.dueToday, true);
});

test("10.3-UNIT-02: followUpChipState yields NO chip for an absent or completed follow-up", () => {
  assert.equal(followUpChipState(null, NOON_UTC).present, false);
  const completed = followUpChipState(COMPLETED, NOON_UTC);
  assert.equal(completed.present, false);
  assert.equal(completed.overdue, false, "a completed follow-up is never overdue");
});

// ── coverage expansion (bmad-testarch-automate) ──────────────────────────────────────────────────────
// The scaffold pins overdue / due-today / absent / completed. The UPCOMING branch (an open follow-up
// whose due date is still in the future) was unasserted: the chip must be PRESENT but neither escalated
// (overdue:false) nor flagged due-today — a follow-up on track shows a calm chip, no badge.
const OPEN_UPCOMING: FollowUpRecord = { id: "f-open-upcoming", status: "open", due_date: "2026-08-15", note: null };

test("10.3-UNIT-02: followUpChipState marks an UPCOMING open follow-up present but NOT escalated", () => {
  const state = followUpChipState(OPEN_UPCOMING, NOON_UTC);
  assert.equal(state.present, true);
  assert.equal(state.overdue, false);
  assert.equal(state.dueToday, false);
});

test("10.3-UNIT-02: selectNextOpenFollowUp finds the single open row among interleaved completed rows", () => {
  // The one-open invariant guarantees at most one open row; the selector must find it regardless of
  // position among completed rows (order is immaterial — first-open wins).
  const picked = selectNextOpenFollowUp([
    COMPLETED,
    { ...COMPLETED, id: "f-done-2" },
    OPEN_UPCOMING,
    { ...COMPLETED, id: "f-done-3" },
  ]);
  assert.equal(picked?.id, OPEN_UPCOMING.id);
});

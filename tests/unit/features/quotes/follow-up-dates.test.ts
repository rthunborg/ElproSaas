/**
 * Story 10.3 — ATDD RED-PHASE scaffold: the PURE Europe/Stockholm due/overdue classification
 * (10.3-UNIT-01, P0, AC2; test-design-epic-10.md R-1031/R-1033).
 *
 * `classifyFollowUp(dueDateISO, now, timeZone)` is a PURE function over `(due_date, injectedNow)` that
 * computes "today in Europe/Stockholm" from the injected instant and returns whether an OPEN follow-up
 * is upcoming / due-today / overdue. The load-bearing discipline (SETTLED DESIGN DECISION 4):
 *   - it computes the Stockholm calendar day via an explicit `Intl.DateTimeFormat('sv-SE', { timeZone:
 *     'Europe/Stockholm' })` — NEVER the host default locale/zone, NEVER `Date.now()` on the path;
 *   - overdue  = due_date  <  todayStockholm;
 *   - due-today = due_date == todayStockholm;
 *   - upcoming = due_date  >  todayStockholm;
 *   - the classification is DETERMINISTIC over the injected instant (mirrors the render path's injected
 *     clock — the same date discipline Story 10.4 reuses for its period windows).
 *
 * The Stockholm-boundary case is the reason the zone is load-bearing: an instant late in a UTC day is
 * already the NEXT calendar day in Stockholm (UTC+1/+2), so a naive host-UTC classifier would misfile a
 * due date by a whole day. Completed follow-ups are never due/overdue — that status-aware exclusion is
 * pinned in the sibling `follow-up-view.test.ts` (10.3-UNIT-02), not here (this file is the date primitive).
 *
 * ── GREEN (Story 10.3 implemented) ────────────────────────────────────────────────────────────────
 * `src/features/quotes/follow-up-dates.ts` is landed; this suite imports the real `classifyFollowUp`
 * and every test is unskipped and green. The assertions are the CONTRACT — do not weaken them.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO wall clock. Two-runner
 * discipline (epic-10 retro): the client-island date logic lands as UNIT, never Playwright.
 *
 * [Source: story 10.3 AC2 + Task 4.1 + SETTLED DESIGN DECISION 4 + Dev Notes "Reuse — the explicit
 *  sv-SE / injected-clock date discipline"; test-design-epic-10.md#10.3-UNIT-01, R-1031/R-1033;
 *  src/server/quote-pdf/render.ts (the sv-SE / injected-clock discipline to mirror)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFollowUp } from "@/features/quotes/follow-up-dates";

// Midday UTC on 2026-07-19 — in Stockholm summer time (UTC+2) this is 2026-07-19 14:00, so "today in
// Stockholm" is unambiguously 2026-07-19. The three boundary cases key off this instant.
const NOON_UTC = "2026-07-19T12:00:00.000Z";
// Late-evening UTC on 2026-07-19 — in Stockholm (UTC+2) this is ALREADY 2026-07-20 00:30. A host-UTC
// classifier would call "today" 2026-07-19; the Stockholm classifier must call it 2026-07-20.
const AFTER_MIDNIGHT_STOCKHOLM_UTC = "2026-07-19T22:30:00.000Z";

test("10.3-UNIT-01: a due date EQUAL to today-in-Stockholm classifies due-today", () => {
  assert.equal(classifyFollowUp("2026-07-19", NOON_UTC), "due-today");
});

test("10.3-UNIT-01: a due date BEFORE today-in-Stockholm classifies overdue (the escalation flag)", () => {
  assert.equal(classifyFollowUp("2026-07-18", NOON_UTC), "overdue");
  assert.equal(classifyFollowUp("2026-01-01", NOON_UTC), "overdue");
});

test("10.3-UNIT-01: a due date AFTER today-in-Stockholm classifies upcoming (never overdue)", () => {
  assert.equal(classifyFollowUp("2026-07-20", NOON_UTC), "upcoming");
  assert.equal(classifyFollowUp("2026-12-31", NOON_UTC), "upcoming");
});

test("10.3-UNIT-01: the Stockholm zone is load-bearing — an after-midnight-Stockholm instant advances the day", () => {
  // At 22:30Z it is already 2026-07-20 in Stockholm, so a follow-up due 2026-07-20 is due-today (a
  // host-UTC classifier would wrongly call it upcoming), and 2026-07-19 is now overdue.
  assert.equal(classifyFollowUp("2026-07-20", AFTER_MIDNIGHT_STOCKHOLM_UTC), "due-today");
  assert.equal(classifyFollowUp("2026-07-19", AFTER_MIDNIGHT_STOCKHOLM_UTC), "overdue");
});

test("10.3-UNIT-01: classification is DETERMINISTIC over the injected instant (no Date.now on the path)", () => {
  // Two calls with identical inputs must agree; the result is a pure function of (dueDate, now, zone),
  // never the ambient wall clock.
  const a = classifyFollowUp("2026-07-19", NOON_UTC);
  const b = classifyFollowUp("2026-07-19", new Date(NOON_UTC));
  assert.equal(a, b);
  assert.equal(a, "due-today");
});

// ── coverage expansion (bmad-testarch-automate): the WINTER (UTC+1) offset ───────────────────────────
// The scaffold above proves the SUMMER (CEST, UTC+2) boundary. Stockholm is UTC+1 in winter (CET), so
// the SAME 22:30Z instant that already rolled the day over in summer is STILL the same calendar day in
// winter. These cases prove the classifier reads the ACTUAL DST offset per instant — not a hard-coded
// +2 that would happen to pass the summer scaffold while misfiling every winter follow-up by a day.
test("10.3-UNIT-01: the offset is DST-aware — a 22:30Z WINTER instant is STILL the same Stockholm day", () => {
  // 2026-01-15 22:30Z in Stockholm winter (UTC+1) is 2026-01-15 23:30 — still 2026-01-15. A classifier
  // that assumed a fixed +2 would wrongly advance to 2026-01-16 and misclassify both cases.
  assert.equal(classifyFollowUp("2026-01-15", "2026-01-15T22:30:00.000Z"), "due-today");
  assert.equal(classifyFollowUp("2026-01-16", "2026-01-15T22:30:00.000Z"), "upcoming");
});

test("10.3-UNIT-01: the WINTER after-midnight-Stockholm instant (23:30Z) advances the day by +1 only", () => {
  // 2026-01-15 23:30Z in Stockholm winter (UTC+1) is 2026-01-16 00:30 — the day HAS rolled over, so a
  // follow-up due 2026-01-16 is due-today and 2026-01-15 is now overdue.
  assert.equal(classifyFollowUp("2026-01-16", "2026-01-15T23:30:00.000Z"), "due-today");
  assert.equal(classifyFollowUp("2026-01-15", "2026-01-15T23:30:00.000Z"), "overdue");
});

test("10.3-UNIT-01: an explicit non-Stockholm timeZone argument is honoured (the zone is a real input)", () => {
  // At 2026-07-19 23:30Z it is already 2026-07-20 in Tokyo (UTC+9), so a follow-up due 2026-07-20 is
  // due-today there — proving the timeZone parameter (not a baked-in constant) drives the boundary.
  assert.equal(classifyFollowUp("2026-07-20", "2026-07-19T23:30:00.000Z", "Asia/Tokyo"), "due-today");
  // And UTC itself: 23:30Z is still 2026-07-19, so 2026-07-20 remains upcoming under the UTC zone.
  assert.equal(classifyFollowUp("2026-07-20", "2026-07-19T23:30:00.000Z", "UTC"), "upcoming");
});

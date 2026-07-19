/**
 * Story 10.4 — ATDD RED-PHASE scaffold: the follow-up TONE AUTHORITY added to `status.ts` (part of
 * 10.4-UNIT-02 / AC2; the named 10-3 deferred item — Task 4.1). The 10.3 follow-up chip + overdue
 * badge currently hardcode bespoke inline tones that shadow `QUOTE_STATUS_COLORS`; Story 10.4 folds
 * them into a SHARED `status.ts` primitive keyed by the `FollowUpDateClass` (upcoming / due-today /
 * overdue). This pins that primitive as a pure `node --test` UNIT (mirrors `status.test.ts`), so both
 * the client island (`FollowUpChip.tsx`) and the `QuoteList.tsx` row badge consume ONE authority.
 *
 * The contract (mirror the existing `quoteStatusLabel` / `quoteStatusColor` shape):
 *   - `FOLLOW_UP_TONE_LABELS` — Uppföljning (upcoming) / Uppföljning idag (due-today) /
 *     Försenad uppföljning (overdue); TEXT-FIRST (WCAG 1.4.1 — the label is the primary signal);
 *   - `FOLLOW_UP_TONE_COLORS` — blue (upcoming) / amber (due-today) / rose (overdue), the current chip
 *     tones, a REDUNDANT reinforcement only;
 *   - `followUpToneLabel(state)` / `followUpToneColor(state)` — an UNKNOWN key falls back to a neutral
 *     tone / the raw key (never blank, never a throw), exactly like `quoteStatusColor`.
 *
 * ── WHY SKIPPED (RED PHASE) ──────────────────────────────────────────────────────────────────────
 * `src/components/quotes/status.ts` exists, but the follow-up tone exports do NOT yet (Task 4.1 is the
 * Story 10.4 DEV phase). Importing not-yet-declared named exports would break `tsc --noEmit`, so this
 * scaffold declares the intended surface via LOCAL `notYetImplemented()` placeholders (typed with the
 * REAL `FollowUpDateClass` from `follow-up-dates.ts`, which exists today) and keeps every test skipped.
 *
 * ── GREEN-PHASE HAND-OFF (Story 10.4 dev) ────────────────────────────────────────────────────────
 * After Task 4.1 lands:
 *   1. Delete the LOCAL placeholder block, replacing with real imports:
 *        import { FOLLOW_UP_TONE_LABELS, followUpToneLabel, followUpToneColor } from "@/components/quotes/status";
 *   2. Remove `{ skip: true }` from every test. The assertions are the CONTRACT — do NOT weaken them.
 *   3. Refactor `FollowUpChip.tsx` + the `QuoteList.tsx` overdue badge to consume these helpers and
 *      delete their inline tone literals (Tasks 4.2/4.3) — the E2E (10.4-E2E-01) then proves the render.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO JSX, NO DB.
 *
 * [Source: story 10.4 AC2 + Task 4.1 + the ⚑ 10-3 DEFERRED ITEM section; src/components/quotes/
 *  status.ts (the authority to extend); src/features/quotes/follow-up-dates.ts (FollowUpDateClass);
 *  test-design-epic-10.md#10.4-E2E-01, R-1044]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { FollowUpDateClass } from "@/features/quotes/follow-up-dates";

// ── LOCAL red-phase declarations (green phase replaces with real imports; see hand-off) ──────────
function notYetImplemented(): never {
  throw new Error(
    "Story 10.4 not yet implemented — remove this placeholder and import the follow-up tone helpers " +
      "from @/components/quotes/status in the green phase.",
  );
}

// Green phase: import { FOLLOW_UP_TONE_LABELS, followUpToneLabel, followUpToneColor } from "@/components/quotes/status";
// NB: an empty typed placeholder (NOT a notYetImplemented() call) so the module never throws at load /
// test collection — the throwing placeholder only fires when a (skipped) test invokes a helper.
const FOLLOW_UP_TONE_LABELS = {} as Record<FollowUpDateClass, string>;
function followUpToneLabel(state: string): string {
  void state;
  return notYetImplemented();
}
function followUpToneColor(state: string): string {
  void state;
  return notYetImplemented();
}

const ALL_CLASSES: readonly FollowUpDateClass[] = ["upcoming", "due-today", "overdue"];

// ── follow-up tone authority (AC2 / Task 4.1) ─────────────────────────────────────────────────────

test("10.4: every FollowUpDateClass has a non-empty distinct Swedish TEXT label (text-first, WCAG 1.4.1)", { skip: true }, () => {
  const labels = new Set<string>();
  for (const c of ALL_CLASSES) {
    const label = followUpToneLabel(c);
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0, `class ${c} has an empty label`);
    labels.add(label);
  }
  assert.equal(labels.size, ALL_CLASSES.length, "labels are distinct — text alone conveys the state");
});

test("10.4: the overdue label is the 10.3 'Försenad uppföljning' word (byte-preserved through the fold)", { skip: true }, () => {
  assert.equal(followUpToneLabel("overdue"), "Försenad uppföljning");
});

test("10.4: every FollowUpDateClass has a redundant color class (blue/amber/rose reinforcement)", { skip: true }, () => {
  for (const c of ALL_CLASSES) {
    const color = followUpToneColor(c);
    assert.equal(typeof color, "string");
    assert.ok(color.length > 0, `class ${c} has an empty color class`);
  }
  // The three tones are visually distinct (color reinforces text; never the sole signal).
  const colors = new Set(ALL_CLASSES.map((c) => followUpToneColor(c)));
  assert.equal(colors.size, ALL_CLASSES.length);
});

test("10.4: an UNKNOWN tone key falls back to a neutral color and never throws (mirrors quoteStatusColor)", { skip: true }, () => {
  assert.equal(typeof followUpToneColor("weird"), "string");
  assert.equal(typeof followUpToneLabel("weird"), "string");
});

test("10.4: the label map covers exactly the closed FollowUpDateClass set", { skip: true }, () => {
  assert.deepEqual(Object.keys(FOLLOW_UP_TONE_LABELS).sort(), [...ALL_CLASSES].sort());
});

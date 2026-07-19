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
 * ── GREEN (Story 10.4 implemented) ───────────────────────────────────────────────────────────────
 * The `status.ts` follow-up tone authority is landed (Task 4.1) and `FollowUpChip.tsx` /
 * `QuoteList.tsx` consume it (Tasks 4.2/4.3); this suite imports the REAL helpers and is unskipped.
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
import {
  FOLLOW_UP_TONE_LABELS,
  followUpToneLabel,
  followUpToneColor,
} from "@/components/quotes/status";

const ALL_CLASSES: readonly FollowUpDateClass[] = ["upcoming", "due-today", "overdue"];

// ── follow-up tone authority (AC2 / Task 4.1) ─────────────────────────────────────────────────────

test("10.4: every FollowUpDateClass has a non-empty distinct Swedish TEXT label (text-first, WCAG 1.4.1)", () => {
  const labels = new Set<string>();
  for (const c of ALL_CLASSES) {
    const label = followUpToneLabel(c);
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0, `class ${c} has an empty label`);
    labels.add(label);
  }
  assert.equal(labels.size, ALL_CLASSES.length, "labels are distinct — text alone conveys the state");
});

test("10.4: the overdue label is the 10.3 'Försenad uppföljning' word (byte-preserved through the fold)", () => {
  assert.equal(followUpToneLabel("overdue"), "Försenad uppföljning");
});

test("10.4: every FollowUpDateClass has a redundant color class (blue/amber/rose reinforcement)", () => {
  for (const c of ALL_CLASSES) {
    const color = followUpToneColor(c);
    assert.equal(typeof color, "string");
    assert.ok(color.length > 0, `class ${c} has an empty color class`);
  }
  // The three tones are visually distinct (color reinforces text; never the sole signal).
  const colors = new Set(ALL_CLASSES.map((c) => followUpToneColor(c)));
  assert.equal(colors.size, ALL_CLASSES.length);
});

test("10.4: an UNKNOWN tone key falls back to a neutral color and never throws (mirrors quoteStatusColor)", () => {
  assert.equal(typeof followUpToneColor("weird"), "string");
  assert.equal(typeof followUpToneLabel("weird"), "string");
});

test("10.4: the label map covers exactly the closed FollowUpDateClass set", () => {
  assert.deepEqual(Object.keys(FOLLOW_UP_TONE_LABELS).sort(), [...ALL_CLASSES].sort());
});

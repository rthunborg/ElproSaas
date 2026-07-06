/**
 * Story 6.5 — 6.5-INT-03 UNIT slice (P0, AC3, R-608): the CLOSED lifecycle-transition map that the
 * `markQuoteVersionLifecycle` command-layer guard consults MUST agree with the 6.4 sent-lock
 * trigger's legal-transition guard — do NOT fork the transition rule. The command guard and the DB
 * trigger are the SAME state machine at two layers; a drift between them is the failure this pins.
 *
 * The closed transition set (from `supabase/migrations/20260707120000_quote_version_sent_lock.sql`
 * :118-134 + story 6.5 Task 2.2):
 *   - from `draft`:      → sent            (a draft is EDITED or DELETED, never rejected/expired/superseded)
 *   - from `sent`:       → accepted | rejected | expired | superseded
 *   - from `accepted`:   (terminal for Epic 6 — acceptance correction is Epic 7)
 *   - from `rejected`:   (terminal)
 *   - from `expired`:    (terminal)
 *   - from `superseded`: (terminal)
 *   - ANY reversal back to `draft` from a non-draft state is ILLEGAL (the trigger RAISES QV409;
 *     the command guard returns VALIDATION_FAILED BEFORE any write).
 *
 * Story 6.5's command lifecycle affordance is limited to the AC3 transitions `rejected | expired |
 * superseded` (accepted is Epic 7). `isLegalLifecycleTransition(from, to)` is the PURE predicate
 * the command guard calls; `validateMarkQuoteVersionLifecycle(input)` is the PURE typed-input
 * validator (uuid + `transition` in the closed set). Both are exhaustively unit-testable without a
 * DB — this fast gate protects the state machine.
 *
 * ── ATDD RED PHASE ─────────────────────────────────────────────────────────────────────────
 * `isLegalLifecycleTransition` (`src/features/quotes/lifecycle.ts`) and
 * `validateMarkQuoteVersionLifecycle` (`src/server/commands/quotes/validation.ts`) do NOT exist
 * yet. Every case is `{ skip: "ATDD red phase — lifecycle transition map not implemented (Story
 * 6.5 Task 2.2/3.2)" }` so the fast `node --test` gate stays GREEN (visible SKIP, never a failing
 * build) until the code lands. The `declare` block placeholders the not-yet-existent symbols so
 * `tsc --noEmit` is clean in the red phase; DELETE the `declare` block + import the real symbols
 * when flipping green.
 *
 * GREEN-PHASE HANDOFF: implement `isLegalLifecycleTransition` as the single source of the closed
 * transition set (the command guard AND — conceptually — the same set the DB trigger enforces) →
 * implement `validateMarkQuoteVersionLifecycle` → un-skip every case → delete the `declare`
 * placeholder → import the real symbols.
 *
 * [Source: test-design-epic-6.md#6.5-INT-03, R-608; story 6.5 Task 2.2 + Task 3.2;
 *  supabase/migrations/20260707120000_quote_version_sent_lock.sql:118-134 (the legal-transition
 *  guard — status change out of a non-draft state allowed ONLY within
 *  sent/accepted/rejected/expired/superseded; a reversal to draft RAISES QV409);
 *  epic-6 retro-notes#Story 6-4 (immutability trigger tests must cover state-machine REVERSAL,
 *  not only content columns); src/server/commands/quotes/validation.ts (the closed-input validator
 *  pattern to mirror — validateMarkQuoteVersionSent)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// ── ATDD red-phase placeholders for the not-yet-existent lifecycle symbols ──────────────────
// DELETE this `declare` block in the green phase and replace with:
//   import { isLegalLifecycleTransition, type QuoteVersionStatus } from "@/features/quotes/lifecycle";
//   import { validateMarkQuoteVersionLifecycle } from "@/server/commands/quotes/validation";
type QuoteVersionStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "superseded";
type LifecycleTransition = "rejected" | "expired" | "superseded";
declare function isLegalLifecycleTransition(
  from: QuoteVersionStatus,
  to: QuoteVersionStatus,
): boolean;
// The typed-input validator: returns the parsed input on success, or throws/returns an error shape
// the command maps to VALIDATION_FAILED. Mirror `validateMarkQuoteVersionSent`.
declare function validateMarkQuoteVersionLifecycle(input: unknown): {
  quote_version_id: string;
  transition: LifecycleTransition;
};

// ── the CLOSED transition map (the single source of truth) ──────────────────────────────────

test(
  "6.5-INT-03 (AC3): sent → rejected|expired|superseded|accepted are LEGAL forward transitions",
  { skip: "ATDD red phase — lifecycle transition map not implemented (Story 6.5 Task 2.2)" },
  () => {
    for (const to of ["rejected", "expired", "superseded", "accepted"] as const) {
      assert.equal(isLegalLifecycleTransition("sent", to), true);
    }
  },
);

test(
  "6.5-INT-03 (AC3): ANY reversal to `draft` from a non-draft state is ILLEGAL (the QV409 reversal)",
  { skip: "ATDD red phase — lifecycle transition map not implemented (Story 6.5 Task 2.2)" },
  () => {
    for (const from of ["sent", "accepted", "rejected", "expired", "superseded"] as const) {
      assert.equal(isLegalLifecycleTransition(from, "draft"), false);
    }
  },
);

test(
  "6.5-INT-03 (AC3): superseded → sent is ILLEGAL (no resurrection of a superseded commitment)",
  { skip: "ATDD red phase — lifecycle transition map not implemented (Story 6.5 Task 2.2)" },
  () => {
    assert.equal(isLegalLifecycleTransition("superseded", "sent"), false);
  },
);

test(
  "6.5-INT-03 (AC3): a DRAFT cannot be rejected/expired/superseded (a draft is edited or deleted, not lifecycle-transitioned)",
  { skip: "ATDD red phase — lifecycle transition map not implemented (Story 6.5 Task 2.2)" },
  () => {
    for (const to of ["rejected", "expired", "superseded"] as const) {
      assert.equal(isLegalLifecycleTransition("draft", to), false);
    }
  },
);

test(
  "6.5-INT-03 (AC3): terminal states (accepted/rejected/expired) do not transition further within Epic 6",
  { skip: "ATDD red phase — lifecycle transition map not implemented (Story 6.5 Task 2.2)" },
  () => {
    // accepted correction is Epic 7; rejected/expired are terminal. None re-enter sent/draft.
    assert.equal(isLegalLifecycleTransition("rejected", "sent"), false);
    assert.equal(isLegalLifecycleTransition("expired", "sent"), false);
    assert.equal(isLegalLifecycleTransition("accepted", "draft"), false);
  },
);

// ── validateMarkQuoteVersionLifecycle — the pure typed-input validator ──────────────────────

test(
  "6.5-INT-03 (AC3): the validator accepts a uuid + a transition in the closed set",
  { skip: "ATDD red phase — validateMarkQuoteVersionLifecycle not implemented (Story 6.5 Task 3.2)" },
  () => {
    const parsed = validateMarkQuoteVersionLifecycle({
      quote_version_id: crypto.randomUUID(),
      transition: "rejected",
    });
    assert.equal(parsed.transition, "rejected");
  },
);

test(
  "6.5-INT-03 (AC3): the validator REJECTS a transition outside the closed set (e.g. `draft`, `sent`, `accepted`, free strings)",
  { skip: "ATDD red phase — validateMarkQuoteVersionLifecycle not implemented (Story 6.5 Task 3.2)" },
  () => {
    for (const bad of ["draft", "sent", "accepted", "cancelled", ""]) {
      assert.throws(() =>
        validateMarkQuoteVersionLifecycle({
          quote_version_id: crypto.randomUUID(),
          transition: bad,
        }),
      );
    }
  },
);

test(
  "6.5-INT-03 (AC3): the validator REJECTS a malformed / missing quote_version_id (never reads tenant_id/status/totals from input)",
  { skip: "ATDD red phase — validateMarkQuoteVersionLifecycle not implemented (Story 6.5 Task 3.2)" },
  () => {
    assert.throws(() =>
      validateMarkQuoteVersionLifecycle({ quote_version_id: "not-a-uuid", transition: "rejected" }),
    );
    assert.throws(() =>
      validateMarkQuoteVersionLifecycle({ transition: "rejected" }),
    );
  },
);

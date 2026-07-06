/**
 * Story 6.5 — 6.5-INT-03 UNIT slice (P0, AC3, R-608): the CLOSED lifecycle-transition map that the
 * `markQuoteVersionLifecycle` command-layer guard consults MUST agree with the 6.4 sent-lock
 * trigger's legal-transition guard — do NOT fork the transition rule. The command guard, the DB
 * trigger, and the 6.5 lifecycle RPC guard are the SAME state machine at three layers; a drift
 * between them is the failure this pins.
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
 * validator (uuid + `transition` in the closed set), returning a `ValidationResult` exactly like
 * `validateMarkQuoteVersionSent`. Both are exhaustively unit-testable without a DB — this fast gate
 * protects the state machine.
 *
 * [Source: test-design-epic-6.md#6.5-INT-03, R-608; story 6.5 Task 2.2 + Task 3.2;
 *  supabase/migrations/20260707120000_quote_version_sent_lock.sql:118-134 (the legal-transition
 *  guard); epic-6 retro-notes#Story 6-4 (immutability trigger tests must cover state-machine
 *  REVERSAL, not only content columns); src/server/commands/quotes/validation.ts
 *  (validateMarkQuoteVersionSent — the closed-input validator pattern mirrored)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLegalLifecycleTransition,
  type QuoteVersionStatus,
} from "@/features/quotes/lifecycle";
import { validateMarkQuoteVersionLifecycle } from "@/server/commands/quotes/validation";

// ── the CLOSED transition map (the single source of truth) ──────────────────────────────────

test("6.5-INT-03 (AC3): sent → rejected|expired|superseded|accepted are LEGAL forward transitions", () => {
  for (const to of ["rejected", "expired", "superseded", "accepted"] as const) {
    assert.equal(isLegalLifecycleTransition("sent", to), true);
  }
});

test("6.5-INT-03 (AC3): ANY reversal to `draft` from a non-draft state is ILLEGAL (the QV409 reversal)", () => {
  for (const from of ["sent", "accepted", "rejected", "expired", "superseded"] as const) {
    assert.equal(isLegalLifecycleTransition(from, "draft"), false);
  }
});

test("6.5-INT-03 (AC3): superseded → sent is ILLEGAL (no resurrection of a superseded commitment)", () => {
  assert.equal(isLegalLifecycleTransition("superseded", "sent"), false);
});

test("6.5-INT-03 (AC3): a DRAFT cannot be rejected/expired/superseded (a draft is edited or deleted, not lifecycle-transitioned)", () => {
  for (const to of ["rejected", "expired", "superseded"] as const) {
    assert.equal(isLegalLifecycleTransition("draft", to), false);
  }
});

test("6.5-INT-03 (AC3): terminal states (accepted/rejected/expired) do not transition further within Epic 6", () => {
  // accepted correction is Epic 7; rejected/expired are terminal. None re-enter sent/draft.
  assert.equal(isLegalLifecycleTransition("rejected", "sent"), false);
  assert.equal(isLegalLifecycleTransition("expired", "sent"), false);
  assert.equal(isLegalLifecycleTransition("accepted", "draft"), false);
});

test("6.5-INT-03 (AC3): a same-status write is NOT a transition (the command never issues a no-op)", () => {
  for (const s of ["draft", "sent", "accepted"] as const) {
    assert.equal(isLegalLifecycleTransition(s as QuoteVersionStatus, s), false);
  }
});

// ── validateMarkQuoteVersionLifecycle — the pure typed-input validator (ValidationResult) ────

test("6.5-INT-03 (AC3): the validator accepts a uuid + a transition in the closed set", () => {
  const res = validateMarkQuoteVersionLifecycle({
    quote_version_id: crypto.randomUUID(),
    transition: "rejected",
  });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.data.transition, "rejected");
});

test("6.5-INT-03 (AC3): the validator REJECTS a transition outside the closed set (e.g. `draft`, `sent`, `accepted`, free strings)", () => {
  for (const bad of ["draft", "sent", "accepted", "cancelled", ""]) {
    const res = validateMarkQuoteVersionLifecycle({
      quote_version_id: crypto.randomUUID(),
      transition: bad,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "VALIDATION_FAILED");
  }
});

test("6.5-INT-03 (AC3): the validator REJECTS a malformed / missing quote_version_id (never reads tenant_id/status/totals from input)", () => {
  assert.equal(
    validateMarkQuoteVersionLifecycle({
      quote_version_id: "not-a-uuid",
      transition: "rejected",
    }).ok,
    false,
  );
  assert.equal(
    validateMarkQuoteVersionLifecycle({ transition: "rejected" }).ok,
    false,
  );
  // A tenant_id / status in the input is IGNORED — never read (resolved server-side).
  const res = validateMarkQuoteVersionLifecycle({
    quote_version_id: crypto.randomUUID(),
    transition: "expired",
    tenant_id: crypto.randomUUID(),
    status: "draft",
  });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal("tenant_id" in res.data, false);
    assert.equal("status" in res.data, false);
  }
});

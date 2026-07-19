/**
 * PURE quote-version lifecycle transition map (Story 6.5, Task 2.2 / 3.2; architecture §9;
 * R-608). The single source of the CLOSED transition set the `markQuoteVersionLifecycle`
 * command-layer guard consults — it MUST agree with the 6.4 sent-lock trigger's legal-transition
 * guard (`supabase/migrations/20260707120000_quote_version_sent_lock.sql:118-134`) + the 6.5
 * `mark_quote_version_lifecycle` RPC guard. The command guard and the DB triggers are the SAME
 * state machine at three layers; a drift between them is the failure this pins.
 *
 * The closed transition set (Story 6.5 Task 2.2, WIDENED by Story 10.2 with the `lost` token):
 *   - from `draft`:      → sent            (a draft is EDITED or DELETED, never rejected/expired/superseded/lost)
 *   - from `sent`:       → accepted | rejected | expired | superseded | lost
 *   - from `accepted`:   (terminal for Epic 6 — acceptance correction is Epic 7)
 *   - from `rejected`:   (terminal)
 *   - from `expired`:    (terminal)
 *   - from `superseded`: (terminal)
 *   - from `lost`:       (terminal — Story 10.2 Förlorad/Avböjd; revive the deal via a NEW version)
 *   - ANY reversal back to `draft` from a non-draft state is ILLEGAL (the trigger RAISES QV409;
 *     the command guard returns VALIDATION_FAILED BEFORE any write).
 *
 * Story 6.5's command lifecycle affordance is limited to the AC3 transitions
 * `rejected | expired | superseded` (accepted is Epic 7; `sent` is the mark-sent command); this
 * predicate encodes the FULL legal state machine so the same rule can back all of them.
 *
 * PURE (no I/O, no JSX) so it runs under the `node --test` fast gate.
 * [Source: test-design-epic-6.md#6.5-INT-03, R-608; supabase/migrations/20260707120000_
 *  quote_version_sent_lock.sql:118-134; epic-6 retro-notes#Story 6-4 (state-machine REVERSAL);
 *  src/features/quotes/timeline.ts (the QuoteVersionStatus union to reuse)]
 */
import type { QuoteVersionStatus } from "./timeline";

export type { QuoteVersionStatus };

/** The standalone lifecycle transitions the 6.5 command owns (accepted is Epic 7). */
export type LifecycleTransition = "rejected" | "expired" | "superseded";

/** The closed set of legal FORWARD transitions per current status (the state machine). */
const LEGAL_TRANSITIONS: Record<QuoteVersionStatus, readonly QuoteVersionStatus[]> = {
  // A draft is edited or deleted — its only lifecycle move is to `sent` (the mark-sent command).
  draft: ["sent"],
  // A sent commitment can be accepted (Epic 7), rejected, expired, superseded (by a new version),
  // or marked lost/declined (Story 10.2 Förlorad/Avböjd — the single new terminal token).
  sent: ["accepted", "rejected", "expired", "superseded", "lost"],
  // Terminal within Epic 6 (accepted correction is Epic 7; the rest are end states).
  accepted: [],
  rejected: [],
  expired: [],
  superseded: [],
  // Terminal (Story 10.2): a lost/declined version is a dead-end — revive the deal via a NEW version.
  lost: [],
};

/**
 * True iff `from → to` is a LEGAL forward lifecycle transition. Any reversal back to `draft`
 * from a non-draft state, any transition off a terminal state, and any move not in the closed
 * per-status set is ILLEGAL. A same-status write is NOT a transition (returns false — the caller
 * decides whether a no-op is meaningful; the command never issues one).
 */
export function isLegalLifecycleTransition(
  from: QuoteVersionStatus,
  to: QuoteVersionStatus,
): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

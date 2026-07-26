/**
 * Story 10.2 — ATDD RED-PHASE scaffold: the single new `lost` lifecycle token, coherent across the
 * PURE layers of the 5-layer widening (10.2-UNIT-01, P0, AC2, R-1011).
 *
 * The SETTLED design (story ⚑) introduces ONE new terminal token `lost` (status + event_type); the
 * Förlorad-vs-Avböjd flavour lives SOLELY in `quote_lost_reasons.outcome`, NOT in the status. The
 * cost of a dedicated token is that it must appear COHERENTLY across all layers — a drift between any
 * two is the exact R-1011 failure. This suite pins the THREE PURE-TS layers that `node --test` can
 * protect WITHOUT a database:
 *   - Layer 5 — `LEGAL_TRANSITIONS` (via the public `isLegalLifecycleTransition` predicate): `sent →
 *     lost` becomes LEGAL, `lost` is TERMINAL (no outward transition), and NO OTHER transition
 *     changes (draft/accepted/rejected/expired/superseded behave exactly as before — additive only).
 *   - the timeline union — `QuoteVersionStatus` now CONTAINS `lost` (so every status-typed surface
 *     admits it).
 *   - presentation labels — `status.ts` gains a `lost` badge LABEL ("Förlorad/Avböjd") whose color
 *     cue is VISUALLY DISTINCT from `accepted`'s green (AC2 "terminal badge distinct from
 *     Accepterad"), and `isReadOnlyStatus('lost')` is true.
 *
 * The remaining widening layers are proven elsewhere (do NOT duplicate here): the 3 DB layers
 * (`quote_versions.status` + `quote_events.event_type` CHECKs, the sent-lock trigger allow-set, the
 * `mark_quote_version_lost` RPC guard) are in `quote-lost-reasons-migration-reset.int.test.ts`
 * (10.2-INT-04) + `mark-quote-version-lost.int.test.ts` (10.2-INT-03); the `read.ts` event-type label
 * ("Förlorad/Avböjd" for the `lost` event in `Händelser`) is exercised in the E2E (10.2-E2E-01),
 * because `read.ts` is not a PURE import (it pulls the server read path).
 *
 * ── GREEN (Story 10.2 shipped) ────────────────────────────────────────────────────────────────────
 * The `lost` token is a real member of the union / transition map / label maps (Task 3 landed); the
 * suite is unskipped and runs green. Every assertion below encodes the post-widening CONTRACT — do NOT
 * weaken any assertion.
 *
 * Runner: `node --test` (`pnpm test:unit`) — PURE, NO DB, NO PII, NO clock. Two-runner discipline
 * (epic-10 retro, Story 10-1 Phase-4): the widened transition map + token coherence land as UNIT, not
 * Playwright. Mirrors `lifecycle-transition.test.ts` (6.5) + `status.test.ts` (6.2).
 *
 * [Source: story 10.2 AC2 + Task 3.1-3.3 + Task 6.1 + Dev Notes "The 5-layer widening — every layer,
 *  no drift"; test-design-epic-10.md#10.2-UNIT-01, R-1011; src/features/quotes/lifecycle.ts;
 *  src/features/quotes/timeline.ts (QuoteVersionStatus); src/components/quotes/status.ts]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isLegalLifecycleTransition,
  type QuoteVersionStatus,
} from "@/features/quotes/lifecycle";
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  quoteStatusLabel,
  quoteStatusColor,
  isReadOnlyStatus,
} from "@/components/quotes/status";

// GREEN PHASE (Story 10.2 landed): `"lost"` is now a real member of the `QuoteVersionStatus` union
// (Task 3.2), so this is a plain literal — no cast. The suite runs (no `skip`).
const LOST: QuoteVersionStatus = "lost";

// The Phase-A statuses that MUST be byte-unchanged by the additive `lost` widening.
const PRE_EXISTING: readonly QuoteVersionStatus[] = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "superseded",
];

describe(
  "10.2-UNIT-01: the `lost` token is coherent across the PURE layers (GREEN — Story 10.2 implemented)",
  () => {
    // ── Layer 5: LEGAL_TRANSITIONS (via the public predicate) ─────────────────────────────────
    test("sent → lost is a LEGAL forward transition (the ONLY new edge into `lost`)", () => {
      assert.equal(isLegalLifecycleTransition("sent", LOST), true);
    });

    test("`lost` is TERMINAL — no outward transition (a lost version is a dead-end; revive = NEW version)", () => {
      for (const to of PRE_EXISTING) {
        assert.equal(
          isLegalLifecycleTransition(LOST, to),
          false,
          `lost → ${to} must be illegal`,
        );
      }
      assert.equal(isLegalLifecycleTransition(LOST, LOST), false);
    });

    test("only a SENT version can be lost — draft/accepted/superseded/rejected/expired → lost are ILLEGAL", () => {
      for (const from of ["draft", "accepted", "superseded", "rejected", "expired"] as const) {
        assert.equal(
          isLegalLifecycleTransition(from, LOST),
          false,
          `${from} → lost must be illegal`,
        );
      }
    });

    test("the widening is ADDITIVE: every pre-existing transition rule is byte-unchanged", () => {
      // draft only advances to sent; sent's legacy fan-out is unchanged; terminals stay terminal.
      assert.equal(isLegalLifecycleTransition("draft", "sent"), true);
      for (const to of ["accepted", "rejected", "expired", "superseded"] as const) {
        assert.equal(isLegalLifecycleTransition("sent", to), true);
      }
      assert.equal(isLegalLifecycleTransition("draft", "accepted"), false);
      for (const term of ["accepted", "rejected", "expired", "superseded"] as const) {
        assert.equal(isLegalLifecycleTransition(term, "draft"), false);
      }
      // The reversal guard is intact: no non-draft state reverts to draft (incl. the new token).
      assert.equal(isLegalLifecycleTransition(LOST, "draft"), false);
    });

    // ── the timeline union: QuoteVersionStatus contains `lost` ────────────────────────────────
    test("the status union admits `lost` (the label maps below enumerate exactly the widened set)", () => {
      // Post-widening the label maps are keyed by the FULL union incl. `lost`; a missing `lost` key
      // is the drift this pins (the map is `Record<QuoteVersionStatus, …>` — exhaustive by type).
      const expected = [...PRE_EXISTING, LOST].map(String).sort();
      assert.deepEqual(Object.keys(QUOTE_STATUS_LABELS).sort(), expected);
      assert.deepEqual(Object.keys(QUOTE_STATUS_COLORS).sort(), expected);
    });

    // ── presentation labels: badge label + distinct color + read-only ─────────────────────────
    test("the `lost` badge LABEL is the Swedish text 'Förlorad/Avböjd' (status conveyed as TEXT — WCAG 1.4.1)", () => {
      assert.equal(QUOTE_STATUS_LABELS[LOST], "Förlorad/Avböjd");
      assert.equal(quoteStatusLabel("lost"), "Förlorad/Avböjd");
    });

    test("the `lost` color cue is VISUALLY DISTINCT from `accepted`'s green (AC2: terminal badge != Accepterad)", () => {
      const lostColor = QUOTE_STATUS_COLORS[LOST];
      assert.equal(typeof lostColor, "string");
      assert.ok((lostColor?.length ?? 0) > 0, "lost must carry a non-empty color class");
      assert.notEqual(lostColor, QUOTE_STATUS_COLORS.accepted);
      assert.doesNotMatch(quoteStatusColor("lost"), /green/, "lost must not reuse the accepted green");
    });

    test("a `lost` version is read-only (no edit affordances) — like every non-draft status", () => {
      assert.equal(isReadOnlyStatus("lost"), true);
    });

    test("every status LABEL (incl. `lost`) is distinct — a colour-blind user tells them apart by text", () => {
      const labels = new Set(Object.values(QUOTE_STATUS_LABELS));
      assert.equal(labels.size, PRE_EXISTING.length + 1);
    });
  },
);

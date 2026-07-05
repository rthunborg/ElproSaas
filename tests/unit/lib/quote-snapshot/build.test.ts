/**
 * Story 6.1 — ATDD RED-PHASE scaffold: the PURE composite quote-version snapshot builder
 * (AC2, P0/P1 — 6.1-UNIT-01/02 + 6.2-UNIT-01 / R-603/R-607).
 *
 * The quote version is the FIRST COMPOSITE immutable snapshot — a copy-by-value freeze of
 * everything customer-visible, composing the three-times-proven freeze discipline (Epic 3
 * snapshot contract → Epic 4 golden freeze → Epic 5 pricing-source row freeze) at quote
 * scale. This suite pins the PURITY + öre + internal-exclusion contract of the builder:
 *
 *   6.1-UNIT-01  the builder is PURE:
 *                - COPY-BY-VALUE: mutating the source input after build does NOT change the
 *                  built snapshot (no live reference retained);
 *                - deep `Object.freeze`: a post-build mutation attempt throws / no-ops
 *                  (strict mode throws), nested objects/arrays are frozen too;
 *                - INJECTED clock: the build instant comes from `opts.capturedAt`, NEVER
 *                  `Date.now()` inside the builder (a fixed capturedAt → deterministic);
 *                - CAPTURE-NOT-COMPUTE: totals are STORED from engine-produced calc state,
 *                  never re-derived — no inline `+`/`*`/`0.25` VAT math in the builder;
 *                - terms `approvedAt` captured VERBATIM (NULL = not-approved), never a
 *                  derived `isApproved` flag; the source is never mutated/approved.
 *   6.1-UNIT-02  öre discipline on the new quote money fields — uses the canonical
 *                `isOreAmount`/`ORE_AMOUNT_MAX`, integer öre, no forked rule; VAT in bp.
 *   6.2-UNIT-01  INTERNAL EXCLUSION (R-607) — the customer-visible line snapshot carries
 *                NO `unit_cost_ore`, NO margin/markup, NO `internal_note`; the builder
 *                DROPS them by construction even when the calc row carries them.
 *
 * ── WHY THE RED-PHASE GATE ──────────────────────────────────────────────────────
 * The pure builder (`src/lib/quote-snapshot/**` or an extension of `src/lib/snapshots/**`)
 * does not exist yet (Story 6.1 dev Task 4). Under `node --test` there is no `describe.skip`
 * that also keeps the tree green while the import is unresolved, so the project idiom is a
 * RED-PHASE GATE constant: the real `describe` body is authored but guarded by
 * `RED_PHASE`, and the dev phase flips it to `false` and wires the real import. This keeps
 * the intended assertions visible and reviewable while the fast unit gate stays green.
 *
 * Runner: `node --test` with TS strip-types (`pnpm test:unit`) — pure logic, NO DB, NO
 * clock read, NO PII. Mirrors `tests/unit/lib/snapshots/build.test.ts`.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

// RED PHASE: flip to `false` in Story 6.1 dev Task 4 once the pure builder lands, and
// replace the placeholder import below with the real one.
const RED_PHASE = true;

// RED PHASE: un-comment in dev — the builder does not exist yet.
// import { buildQuoteVersionSnapshot } from "@/lib/quote-snapshot/build";
// import type { QuoteVersionSnapshotInput } from "@/lib/quote-snapshot/types";

const CAPTURED_AT = "2026-07-05T12:00:00.000Z";

// Forbidden INTERNAL keys — R-607: the customer-visible line snapshot must carry NONE of
// these (cost/margin/internal-note are calc-internal, never customer-visible).
const INTERNAL_FORBIDDEN = [
  "unitcostore",
  "unit_cost_ore",
  "markup",
  "markupbp",
  "margin",
  "internalnote",
  "internal_note",
] as const;

// Forbidden supplier/integration substrings (HARD no-supplier-scope, carried forward).
const SUPPLIER_FORBIDDEN = [
  "supplier",
  "vendor",
  "sync",
  "import",
  "external",
  "fortnox",
  "edi",
  "mapping",
] as const;

describe("Story 6.1 — pure QuoteVersionSnapshot builder purity + öre + internal-exclusion", () => {
  test("[P0] copy-by-value: mutating the source after build does not change the snapshot (6.1-UNIT-01)", () => {
    if (RED_PHASE) return; // dev flips RED_PHASE=false to activate.
    // TODO(dev):
    //   const input = makeQuoteSnapshotInput(); // in-memory fixture, no DB
    //   const snap = buildQuoteVersionSnapshot(input, { capturedAt: CAPTURED_AT });
    //   input.company.orgNr = "MUTATED"; input.lines[0].label = "MUTATED";
    //   assert.notEqual(snap.company.orgNr, "MUTATED");
    //   assert.notEqual(snap.lines[0].label, "MUTATED");
    assert.fail("RED PHASE: buildQuoteVersionSnapshot not implemented yet");
  });

  test("[P0] deep Object.freeze: a post-build mutation attempt throws (strict) / no-ops (6.1-UNIT-01)", () => {
    if (RED_PHASE) return;
    // TODO(dev): assert Object.isFrozen(snap) and Object.isFrozen(snap.lines) and each
    // nested line/attachment; a strict-mode write to snap.quoteNumber throws.
    assert.fail("RED PHASE: deep-freeze not implemented yet");
  });

  test("[P0] injected clock: capturedAt comes from opts, never Date.now() (6.1-UNIT-01)", () => {
    if (RED_PHASE) return;
    // TODO(dev): build twice with the SAME fixed capturedAt → identical capturedAt on the
    // snapshot; the builder never reads the wall clock (deterministic).
    assert.fail("RED PHASE: injected-clock capture not implemented yet");
  });

  test("[P0] capture-not-compute: totals are stored from engine state, no inline money math (6.1-UNIT-01)", () => {
    if (RED_PHASE) return;
    // TODO(dev): pass pre-computed totals (from totals.ts / @/lib/money) in the input and
    // assert the snapshot stores them VERBATIM — the builder does not re-derive any total
    // and does not apply a VAT rate itself.
    assert.fail("RED PHASE: capture-not-compute not implemented yet");
  });

  test("[P0] terms approvedAt captured VERBATIM (NULL = not-approved), source never mutated (6.1-UNIT-01)", () => {
    if (RED_PHASE) return;
    // TODO(dev): NULL approvedAt stays NULL; a non-null approvedAt is copied AS-IS; the
    // builder never derives isApproved and never approves/mutates the terms source.
    assert.fail("RED PHASE: terms verbatim capture not implemented yet");
  });

  test("[P0] öre discipline: money fields integer öre via canonical isOreAmount, VAT in bp (6.1-UNIT-02)", () => {
    if (RED_PHASE) return;
    // TODO(dev): every *_ore field on the snapshot passes canonical isOreAmount (integer,
    // 0..ORE_AMOUNT_MAX); no forked rule; VAT assumptions carry a *_bp basis-points rate,
    // never a float percent.
    assert.fail("RED PHASE: öre discipline not implemented yet");
  });

  test("[P0] internal EXCLUSION: customer-visible lines carry no cost/margin/internal_note (6.2-UNIT-01, R-607)", () => {
    if (RED_PHASE) return;
    // TODO(dev): build from a calc row that DOES carry internal_note + unit_cost_ore +
    // markup_bp; assert NONE of INTERNAL_FORBIDDEN appears as a key on any line snapshot.
    //   for (const line of snap.lines) {
    //     for (const key of Object.keys(line)) {
    //       assert.ok(!INTERNAL_FORBIDDEN.includes(key.toLowerCase().replace(/_/g, "") as never));
    //     }
    //   }
    assert.fail("RED PHASE: internal-exclusion not implemented yet");
  });

  test("[P0] no supplier/integration key anywhere in the snapshot (HARD no-supplier-scope)", () => {
    if (RED_PHASE) return;
    // TODO(dev): recursively walk the snapshot; assert no key matches SUPPLIER_FORBIDDEN.
    assert.fail("RED PHASE: no-supplier-scope guard not implemented yet");
  });

  // A single always-on assertion so the file is a live (green) test module in the tree
  // and the RED_PHASE flip is the ONLY edit needed to activate the real assertions.
  test("[meta] red-phase gate is a boolean the dev phase flips to false", () => {
    assert.equal(typeof RED_PHASE, "boolean");
    // Guard the forbidden-substring tables are non-empty (they drive the real assertions).
    assert.ok(INTERNAL_FORBIDDEN.length > 0);
    assert.ok(SUPPLIER_FORBIDDEN.length > 0);
    assert.ok(CAPTURED_AT.endsWith("Z"));
  });
});

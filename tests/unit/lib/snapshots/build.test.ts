/**
 * Story 3.5 — ATDD RED-PHASE SCAFFOLD (gated `describe.skip`).
 *
 * Pure-builder copy-fidelity + the load-bearing SNAPSHOT-IMMUTABILITY invariant
 * (R-008, score-6) for the snapshot-source contract (`src/lib/snapshots/`).
 *
 * RED PHASE: the implementation modules below do NOT exist yet, so these tests are
 * gated under `describe.skip(...)` to keep the green `node --test` baseline
 * UNPERTURBED until dev lands `src/lib/snapshots/build.ts` + `types.ts`. When the
 * builders exist, the dev removes the `.skip` and these assertions go RED→GREEN.
 *
 * Runner: `node --test` with TS strip-types (`pnpm test:unit`) — pure logic, NO DB,
 * NO clock read (the builder takes `capturedAt` as input). Mirrors the established
 * co-located unit pattern in `tests/unit/lib/result/result.test.ts`.
 *
 * The contract these tests pin (per AC1 + the epic-3 retro-note — capture the REAL
 * 3-3/3-4 columns, NO invented fields, keep it SMALL):
 *   common:           sourceId, kind, tenantId, sourceUpdatedAt (= source row's
 *                     updated_at, the "version"), capturedAt (from opts, NOT
 *                     wall-clock)
 *   work_role:        displayName, costRateOre, sellRateOre, isActive
 *   article:          name, sku|null, unit|null, unitPriceOre, isActive
 *                     (HARD: NO supplier/vendor/sync/import/external/api/fortnox/
 *                      edi/mapping key)
 *   company_settings: vatRateBp (basis points), defaultVatDisplay (+ optional
 *                     minimal companyName)
 *   quote_terms:      termsText, approvedAt|null (AS-IS), approvedBy|null
 *
 * Money stays INTEGER ÖRE (copied verbatim, never recomputed, never float). VAT
 * stays basis points. The contract carries NO computed/derived money (no totalOre,
 * no VAT amount) — it is a SOURCE snapshot, not a calculation (Epic 4 owns math).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

// RED-PHASE imports — these modules are created by the dev in this story. They are
// referenced here so the scaffold un-skips into a real assertion suite with no
// rewrite. Until they exist, the whole file is `describe.skip`-gated.
//
// import {
//   buildWorkRoleSnapshot,
//   buildArticleSnapshot,
//   buildCompanySettingsSnapshot,
//   buildQuoteTermsSnapshot,
// } from "@/lib/snapshots/build";
// import type { SnapshotSource } from "@/lib/snapshots/types";

// The FIXED captured timestamp the pure builder receives via `opts.capturedAt`
// (NEVER read from the wall clock inside the builder). A constant here proves the
// builder is deterministic.
const CAPTURED_AT = "2026-06-30T12:00:00.000Z";
// A distinct source `updated_at` so a test can prove `sourceUpdatedAt` is the ROW's
// updated_at (the "version") and NOT the capturedAt.
const SOURCE_UPDATED_AT = "2026-06-29T08:30:00.000Z";

// Supplier-ish forbidden substrings (HARD no-supplier-scope — carried forward from
// 3-4). NO article-snapshot key may contain any of these.
const SUPPLIER_FORBIDDEN = [
  "supplier",
  "vendor",
  "sync",
  "import",
  "external",
  "api",
  "fortnox",
  "edi",
  "mapping",
] as const;

// Forbidden computed-money keys — the contract captures SOURCE values, never a
// derived total / VAT amount (Epic 4 owns money/VAT math).
const COMPUTED_MONEY_FORBIDDEN = [
  "totalore",
  "vatamount",
  "vatamountore",
  "grossore",
  "netore",
  "amountore",
] as const;

describe.skip("Story 3.5 — snapshot builder copy-fidelity (RED until src/lib/snapshots lands; AC1/AC4)", () => {
  test("[P0] buildWorkRoleSnapshot copies the REAL 3-4 columns by value with correct names/types", () => {
    // const row = {
    //   id: "wr-1",
    //   tenant_id: "tenant-A",
    //   display_name: "Elektriker",
    //   cost_rate_ore: 30000, // integer öre
    //   sell_rate_ore: 60000, // integer öre
    //   is_active: true,
    //   updated_at: SOURCE_UPDATED_AT,
    // };
    // const snap = buildWorkRoleSnapshot(row, { capturedAt: CAPTURED_AT });
    // assert.equal(snap.kind, "work_role");
    // assert.equal(snap.sourceId, "wr-1");
    // assert.equal(snap.tenantId, "tenant-A");
    // assert.equal(snap.sourceUpdatedAt, SOURCE_UPDATED_AT); // the "version"
    // assert.equal(snap.capturedAt, CAPTURED_AT); // from opts, NOT wall-clock
    // assert.equal(snap.displayName, "Elektriker");
    // // Money: integer öre, copied verbatim (NOT recomputed, NOT a float).
    // assert.equal(snap.costRateOre, 30000);
    // assert.equal(snap.sellRateOre, 60000);
    // assert.equal(Number.isInteger(snap.costRateOre), true);
    // assert.equal(Number.isInteger(snap.sellRateOre), true);
    // assert.equal(snap.isActive, true);
    assert.fail("RED: buildWorkRoleSnapshot not implemented yet (un-skip when src/lib/snapshots/build.ts lands)");
  });

  test("[P0] buildArticleSnapshot copies the minimal manual columns; null sku/unit stay null", () => {
    // const row = {
    //   id: "art-1",
    //   tenant_id: "tenant-A",
    //   name: "Kabel 3x1.5",
    //   sku: null,
    //   unit: null,
    //   unit_price_ore: 1995,
    //   is_active: true,
    //   updated_at: SOURCE_UPDATED_AT,
    // };
    // const snap = buildArticleSnapshot(row, { capturedAt: CAPTURED_AT });
    // assert.equal(snap.kind, "article");
    // assert.equal(snap.name, "Kabel 3x1.5");
    // assert.equal(snap.sku, null); // null stays null
    // assert.equal(snap.unit, null); // null stays null
    // assert.equal(snap.unitPriceOre, 1995);
    // assert.equal(Number.isInteger(snap.unitPriceOre), true);
    // assert.equal(snap.isActive, true);
    assert.fail("RED: buildArticleSnapshot not implemented yet");
  });

  test("[P0] HARD no-supplier-scope: the article snapshot carries NO supplier-ish key", () => {
    // const snap = buildArticleSnapshot(
    //   { id: "a", tenant_id: "t", name: "n", sku: "S1", unit: "st", unit_price_ore: 500, is_active: true, updated_at: SOURCE_UPDATED_AT },
    //   { capturedAt: CAPTURED_AT },
    // );
    // for (const key of Object.keys(snap)) {
    //   const lower = key.toLowerCase();
    //   for (const forbidden of SUPPLIER_FORBIDDEN) {
    //     assert.ok(!lower.includes(forbidden), `article snapshot must not carry a "${forbidden}" key (got "${key}")`);
    //   }
    // }
    void SUPPLIER_FORBIDDEN;
    assert.fail("RED: buildArticleSnapshot not implemented yet (no-supplier-scope guard)");
  });

  test("[P0] buildCompanySettingsSnapshot captures vat_rate_bp (basis points) + default_vat_display AS-IS", () => {
    // const row = {
    //   id: "cs-1",
    //   tenant_id: "tenant-A",
    //   company_name: "Acme El AB",
    //   vat_rate_bp: 2500, // basis points (25.00%) — NOT a percent float
    //   default_vat_display: "company_togglable",
    //   updated_at: SOURCE_UPDATED_AT,
    // };
    // const snap = buildCompanySettingsSnapshot(row, { capturedAt: CAPTURED_AT });
    // assert.equal(snap.kind, "company_settings");
    // assert.equal(snap.vatRateBp, 2500); // bp stays bp
    // assert.equal(Number.isInteger(snap.vatRateBp), true);
    // assert.equal(snap.defaultVatDisplay, "company_togglable");
    // // NO computed VAT amount on the contract (Epic 4 owns the math).
    // for (const key of Object.keys(snap)) {
    //   assert.ok(!COMPUTED_MONEY_FORBIDDEN.includes(key.toLowerCase() as never), `no computed money key allowed (got "${key}")`);
    // }
    void COMPUTED_MONEY_FORBIDDEN;
    assert.fail("RED: buildCompanySettingsSnapshot not implemented yet");
  });

  test("[P0] buildQuoteTermsSnapshot captures approved_at sign-off STATE AS-IS (NULL = not-approved)", () => {
    // const notApproved = {
    //   id: "qt-1",
    //   tenant_id: "tenant-A",
    //   terms_text: "Betalningsvillkor 30 dagar (platshållartext).",
    //   approved_at: null, // not-approved — captured AS-IS, NOT a derived boolean
    //   approved_by: null,
    //   updated_at: SOURCE_UPDATED_AT,
    // };
    // const snapNot = buildQuoteTermsSnapshot(notApproved, { capturedAt: CAPTURED_AT });
    // assert.equal(snapNot.kind, "quote_terms");
    // assert.equal(snapNot.termsText, notApproved.terms_text);
    // assert.equal(snapNot.approvedAt, null); // null stays null
    // assert.equal(snapNot.approvedBy, null);
    // // No derived "isApproved" boolean is invented in the contract — rely on approved_at.
    // assert.equal("isApproved" in snapNot, false);
    //
    // const approved = { ...notApproved, approved_at: "2026-06-28T09:00:00.000Z", approved_by: "user-admin-a" };
    // const snapYes = buildQuoteTermsSnapshot(approved, { capturedAt: CAPTURED_AT });
    // assert.equal(snapYes.approvedAt, "2026-06-28T09:00:00.000Z"); // captured verbatim
    // assert.equal(snapYes.approvedBy, "user-admin-a"); // id, NOT a resolved name
    assert.fail("RED: buildQuoteTermsSnapshot not implemented yet (approved_at state capture)");
  });

  test("[P0] capturedAt comes from opts (deterministic), never the wall clock", () => {
    // const row = { id: "wr", tenant_id: "t", display_name: "x", cost_rate_ore: 1, sell_rate_ore: 2, is_active: true, updated_at: SOURCE_UPDATED_AT };
    // const a = buildWorkRoleSnapshot(row, { capturedAt: "2020-01-01T00:00:00.000Z" });
    // const b = buildWorkRoleSnapshot(row, { capturedAt: "2030-12-31T23:59:59.000Z" });
    // assert.equal(a.capturedAt, "2020-01-01T00:00:00.000Z");
    // assert.equal(b.capturedAt, "2030-12-31T23:59:59.000Z");
    assert.fail("RED: builders not implemented yet (deterministic capturedAt)");
  });
});

describe.skip("Story 3.5 — SNAPSHOT IMMUTABILITY (R-008, score-6, P0 headline; AC2)", () => {
  test("[P0] mutating the SOURCE row AFTER build does NOT change the prior snapshot (no silent recompute)", () => {
    // The load-bearing invariant: a snapshot, once built, captures values BY VALUE
    // into a frozen object holding NO live reference to the source row. Mutating the
    // source afterwards must NOT reach into the prior snapshot.
    //
    // const source = {
    //   id: "wr-1",
    //   tenant_id: "tenant-A",
    //   display_name: "Elektriker",
    //   cost_rate_ore: 30000,
    //   sell_rate_ore: 60000,
    //   is_active: true,
    //   updated_at: SOURCE_UPDATED_AT,
    // };
    // const snap = buildWorkRoleSnapshot(source, { capturedAt: CAPTURED_AT });
    //
    // // Capture the snapshot's values BEFORE mutating the source.
    // const before = JSON.stringify(snap);
    //
    // // MUTATE the source row in place (simulating an `upsertWorkRole` edit / archive
    // // landing AFTER the snapshot was built).
    // source.cost_rate_ore = 99999;
    // source.sell_rate_ore = 1;
    // source.display_name = "EDITED";
    // source.is_active = false;
    // source.updated_at = "2099-01-01T00:00:00.000Z";
    //
    // // The prior snapshot is BYTE-FOR-BYTE unchanged — it did not silently recompute.
    // assert.equal(JSON.stringify(snap), before);
    // assert.equal(snap.costRateOre, 30000);
    // assert.equal(snap.sellRateOre, 60000);
    // assert.equal(snap.displayName, "Elektriker");
    // assert.equal(snap.isActive, true);
    // assert.equal(snap.sourceUpdatedAt, SOURCE_UPDATED_AT);
    assert.fail("RED: builders not implemented yet (mutate-source-after-build → unchanged)");
  });

  test("[P0] the returned snapshot is FROZEN — a direct write does not take effect", () => {
    // const snap = buildWorkRoleSnapshot(
    //   { id: "wr", tenant_id: "t", display_name: "x", cost_rate_ore: 100, sell_rate_ore: 200, is_active: true, updated_at: SOURCE_UPDATED_AT },
    //   { capturedAt: CAPTURED_AT },
    // );
    // assert.equal(Object.isFrozen(snap), true);
    // // A direct mutation either throws (strict) or silently no-ops; the value is unchanged.
    // try { (snap as { costRateOre: number }).costRateOre = 0; } catch { /* strict-mode throw is acceptable */ }
    // assert.equal(snap.costRateOre, 100);
    assert.fail("RED: builders not implemented yet (Object.isFrozen + write no-op)");
  });

  test("[P0] terms/VAT capture is STATE-ONLY: mutating approved_at on the source does not approve the prior snapshot, and the builder never mutates the source", () => {
    // const source = {
    //   id: "qt-1",
    //   tenant_id: "tenant-A",
    //   terms_text: "Villkor (platshållartext).",
    //   approved_at: null,
    //   approved_by: null,
    //   updated_at: SOURCE_UPDATED_AT,
    // };
    // const snapshotOfUnapproved = JSON.parse(JSON.stringify(source));
    // const snap = buildQuoteTermsSnapshot(source, { capturedAt: CAPTURED_AT });
    // // The builder must NOT have mutated the source (it captures, it does not approve).
    // assert.deepEqual(source, snapshotOfUnapproved);
    // // Now the source gets approved LATER — the prior snapshot's approvedAt stays null.
    // source.approved_at = "2099-01-01T00:00:00.000Z";
    // source.approved_by = "user-x";
    // assert.equal(snap.approvedAt, null);
    // assert.equal(snap.approvedBy, null);
    assert.fail("RED: buildQuoteTermsSnapshot not implemented yet (state-only capture; never approves)");
  });
});

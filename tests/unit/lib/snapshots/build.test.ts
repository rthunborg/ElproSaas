/**
 * Story 3.5 — snapshot-builder copy-fidelity + the load-bearing SNAPSHOT-IMMUTABILITY
 * invariant (R-008, score-6) for the snapshot-source contract (`src/lib/snapshots/`).
 *
 * GREEN PHASE: `src/lib/snapshots/build.ts` + `types.ts` now exist, so the gate is
 * removed and these assertions run for real under `node --test`.
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

import {
  buildWorkRoleSnapshot,
  buildArticleSnapshot,
  buildCompanySettingsSnapshot,
  buildQuoteTermsSnapshot,
} from "@/lib/snapshots/build";

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

describe("Story 3.5 — snapshot builder copy-fidelity (AC1/AC4)", () => {
  test("[P0] buildWorkRoleSnapshot copies the REAL 3-4 columns by value with correct names/types", () => {
    const row = {
      id: "wr-1",
      tenant_id: "tenant-A",
      display_name: "Elektriker",
      cost_rate_ore: 30000, // integer öre
      sell_rate_ore: 60000, // integer öre
      is_active: true,
      updated_at: SOURCE_UPDATED_AT,
    };
    const snap = buildWorkRoleSnapshot(row, { capturedAt: CAPTURED_AT });
    assert.equal(snap.kind, "work_role");
    assert.equal(snap.sourceId, "wr-1");
    assert.equal(snap.tenantId, "tenant-A");
    assert.equal(snap.sourceUpdatedAt, SOURCE_UPDATED_AT); // the "version"
    assert.equal(snap.capturedAt, CAPTURED_AT); // from opts, NOT wall-clock
    assert.equal(snap.displayName, "Elektriker");
    // Money: integer öre, copied verbatim (NOT recomputed, NOT a float).
    assert.equal(snap.costRateOre, 30000);
    assert.equal(snap.sellRateOre, 60000);
    assert.equal(Number.isInteger(snap.costRateOre), true);
    assert.equal(Number.isInteger(snap.sellRateOre), true);
    assert.equal(snap.isActive, true);
    // No computed money key on the work-role snapshot either.
    for (const key of Object.keys(snap)) {
      assert.ok(
        !COMPUTED_MONEY_FORBIDDEN.includes(key.toLowerCase() as never),
        `no computed money key allowed (got "${key}")`,
      );
    }
  });

  test("[P0] buildArticleSnapshot copies the minimal manual columns; null sku/unit stay null", () => {
    const row = {
      id: "art-1",
      tenant_id: "tenant-A",
      name: "Kabel 3x1.5",
      sku: null,
      unit: null,
      unit_price_ore: 1995,
      is_active: true,
      updated_at: SOURCE_UPDATED_AT,
    };
    const snap = buildArticleSnapshot(row, { capturedAt: CAPTURED_AT });
    assert.equal(snap.kind, "article");
    assert.equal(snap.name, "Kabel 3x1.5");
    assert.equal(snap.sku, null); // null stays null
    assert.equal(snap.unit, null); // null stays null
    assert.equal(snap.unitPriceOre, 1995);
    assert.equal(Number.isInteger(snap.unitPriceOre), true);
    assert.equal(snap.isActive, true);
    assert.equal(snap.sourceUpdatedAt, SOURCE_UPDATED_AT);
    assert.equal(snap.capturedAt, CAPTURED_AT);
  });

  test("[P0] HARD no-supplier-scope: the article snapshot carries NO supplier-ish key", () => {
    const snap = buildArticleSnapshot(
      {
        id: "a",
        tenant_id: "t",
        name: "n",
        sku: "S1",
        unit: "st",
        unit_price_ore: 500,
        is_active: true,
        updated_at: SOURCE_UPDATED_AT,
      },
      { capturedAt: CAPTURED_AT },
    );
    for (const key of Object.keys(snap)) {
      const lower = key.toLowerCase();
      for (const forbidden of SUPPLIER_FORBIDDEN) {
        assert.ok(
          !lower.includes(forbidden),
          `article snapshot must not carry a "${forbidden}" key (got "${key}")`,
        );
      }
    }
  });

  test("[P0] buildCompanySettingsSnapshot captures vat_rate_bp (basis points) + default_vat_display AS-IS", () => {
    const row = {
      id: "cs-1",
      tenant_id: "tenant-A",
      company_name: "Acme El AB",
      vat_rate_bp: 2500, // basis points (25.00%) — NOT a percent float
      default_vat_display: "company_togglable",
      updated_at: SOURCE_UPDATED_AT,
    };
    const snap = buildCompanySettingsSnapshot(row, { capturedAt: CAPTURED_AT });
    assert.equal(snap.kind, "company_settings");
    assert.equal(snap.companyName, "Acme El AB");
    assert.equal(snap.vatRateBp, 2500); // bp stays bp
    assert.equal(Number.isInteger(snap.vatRateBp), true);
    assert.equal(snap.defaultVatDisplay, "company_togglable");
    // NO computed VAT amount on the contract (Epic 4 owns the math).
    for (const key of Object.keys(snap)) {
      assert.ok(
        !COMPUTED_MONEY_FORBIDDEN.includes(key.toLowerCase() as never),
        `no computed money key allowed (got "${key}")`,
      );
    }
  });

  test("[P0] company_settings null company_name stays null (minimal optional identity)", () => {
    const snap = buildCompanySettingsSnapshot(
      {
        id: "cs-2",
        tenant_id: "t",
        company_name: null,
        vat_rate_bp: 0,
        default_vat_display: "company_excl",
        updated_at: SOURCE_UPDATED_AT,
      },
      { capturedAt: CAPTURED_AT },
    );
    assert.equal(snap.companyName, null); // null stays null
    assert.equal(snap.vatRateBp, 0); // a 0-bp rate is a valid captured value
    assert.equal(snap.defaultVatDisplay, "company_excl");
  });

  test("[P0] buildQuoteTermsSnapshot captures approved_at sign-off STATE AS-IS (NULL = not-approved)", () => {
    const notApproved = {
      id: "qt-1",
      tenant_id: "tenant-A",
      terms_text: "Betalningsvillkor 30 dagar (platshållartext).",
      approved_at: null, // not-approved — captured AS-IS, NOT a derived boolean
      approved_by: null,
      updated_at: SOURCE_UPDATED_AT,
    };
    const snapNot = buildQuoteTermsSnapshot(notApproved, {
      capturedAt: CAPTURED_AT,
    });
    assert.equal(snapNot.kind, "quote_terms");
    assert.equal(snapNot.termsText, notApproved.terms_text);
    assert.equal(snapNot.approvedAt, null); // null stays null
    assert.equal(snapNot.approvedBy, null);
    // No derived "isApproved" boolean is invented in the contract — rely on approved_at.
    assert.equal("isApproved" in snapNot, false);

    const approved = {
      ...notApproved,
      approved_at: "2026-06-28T09:00:00.000Z",
      approved_by: "user-admin-a",
    };
    const snapYes = buildQuoteTermsSnapshot(approved, {
      capturedAt: CAPTURED_AT,
    });
    assert.equal(snapYes.approvedAt, "2026-06-28T09:00:00.000Z"); // captured verbatim
    assert.equal(snapYes.approvedBy, "user-admin-a"); // id, NOT a resolved name
  });

  test("[P0] capturedAt comes from opts (deterministic), never the wall clock", () => {
    const row = {
      id: "wr",
      tenant_id: "t",
      display_name: "x",
      cost_rate_ore: 1,
      sell_rate_ore: 2,
      is_active: true,
      updated_at: SOURCE_UPDATED_AT,
    };
    const a = buildWorkRoleSnapshot(row, {
      capturedAt: "2020-01-01T00:00:00.000Z",
    });
    const b = buildWorkRoleSnapshot(row, {
      capturedAt: "2030-12-31T23:59:59.000Z",
    });
    assert.equal(a.capturedAt, "2020-01-01T00:00:00.000Z");
    assert.equal(b.capturedAt, "2030-12-31T23:59:59.000Z");
    // sourceUpdatedAt is the ROW's updated_at either way — the version, not the capture.
    assert.equal(a.sourceUpdatedAt, SOURCE_UPDATED_AT);
    assert.equal(b.sourceUpdatedAt, SOURCE_UPDATED_AT);
  });
});

describe("Story 3.5 — SNAPSHOT IMMUTABILITY (R-008, score-6, P0 headline; AC2)", () => {
  test("[P0] mutating the SOURCE row AFTER build does NOT change the prior snapshot (no silent recompute)", () => {
    // The load-bearing invariant: a snapshot, once built, captures values BY VALUE
    // into a frozen object holding NO live reference to the source row. Mutating the
    // source afterwards must NOT reach into the prior snapshot.
    const source = {
      id: "wr-1",
      tenant_id: "tenant-A",
      display_name: "Elektriker",
      cost_rate_ore: 30000,
      sell_rate_ore: 60000,
      is_active: true,
      updated_at: SOURCE_UPDATED_AT,
    };
    const snap = buildWorkRoleSnapshot(source, { capturedAt: CAPTURED_AT });

    // Capture the snapshot's values BEFORE mutating the source.
    const before = JSON.stringify(snap);

    // MUTATE the source row in place (simulating an `upsertWorkRole` edit / archive
    // landing AFTER the snapshot was built).
    source.cost_rate_ore = 99999;
    source.sell_rate_ore = 1;
    source.display_name = "EDITED";
    source.is_active = false;
    source.updated_at = "2099-01-01T00:00:00.000Z";

    // The prior snapshot is BYTE-FOR-BYTE unchanged — it did not silently recompute.
    assert.equal(JSON.stringify(snap), before);
    assert.equal(snap.costRateOre, 30000);
    assert.equal(snap.sellRateOre, 60000);
    assert.equal(snap.displayName, "Elektriker");
    assert.equal(snap.isActive, true);
    assert.equal(snap.sourceUpdatedAt, SOURCE_UPDATED_AT);
  });

  test("[P0] the returned snapshot is FROZEN — a direct write does not take effect", () => {
    const snap = buildWorkRoleSnapshot(
      {
        id: "wr",
        tenant_id: "t",
        display_name: "x",
        cost_rate_ore: 100,
        sell_rate_ore: 200,
        is_active: true,
        updated_at: SOURCE_UPDATED_AT,
      },
      { capturedAt: CAPTURED_AT },
    );
    assert.equal(Object.isFrozen(snap), true);
    // A direct mutation either throws (strict) or silently no-ops; the value is unchanged.
    try {
      (snap as { costRateOre: number }).costRateOre = 0;
    } catch {
      /* strict-mode throw is acceptable */
    }
    assert.equal(snap.costRateOre, 100);
  });

  test("[P0] every kind returns a frozen snapshot", () => {
    const article = buildArticleSnapshot(
      {
        id: "a",
        tenant_id: "t",
        name: "n",
        sku: null,
        unit: null,
        unit_price_ore: 1,
        is_active: true,
        updated_at: SOURCE_UPDATED_AT,
      },
      { capturedAt: CAPTURED_AT },
    );
    const settings = buildCompanySettingsSnapshot(
      {
        id: "cs",
        tenant_id: "t",
        company_name: null,
        vat_rate_bp: 2500,
        default_vat_display: "company_togglable",
        updated_at: SOURCE_UPDATED_AT,
      },
      { capturedAt: CAPTURED_AT },
    );
    const terms = buildQuoteTermsSnapshot(
      {
        id: "qt",
        tenant_id: "t",
        terms_text: "x",
        approved_at: null,
        approved_by: null,
        updated_at: SOURCE_UPDATED_AT,
      },
      { capturedAt: CAPTURED_AT },
    );
    assert.equal(Object.isFrozen(article), true);
    assert.equal(Object.isFrozen(settings), true);
    assert.equal(Object.isFrozen(terms), true);
  });

  test("[P0] terms/VAT capture is STATE-ONLY: mutating approved_at on the source does not approve the prior snapshot, and the builder never mutates the source", () => {
    const source = {
      id: "qt-1",
      tenant_id: "tenant-A",
      terms_text: "Villkor (platshållartext).",
      approved_at: null as string | null,
      approved_by: null as string | null,
      updated_at: SOURCE_UPDATED_AT,
    };
    const sourceBefore = JSON.parse(JSON.stringify(source));
    const snap = buildQuoteTermsSnapshot(source, { capturedAt: CAPTURED_AT });
    // The builder must NOT have mutated the source (it captures, it does not approve).
    assert.deepEqual(source, sourceBefore);
    // Now the source gets approved LATER — the prior snapshot's approvedAt stays null.
    source.approved_at = "2099-01-01T00:00:00.000Z";
    source.approved_by = "user-x";
    assert.equal(snap.approvedAt, null);
    assert.equal(snap.approvedBy, null);
  });

  // ── R-008 DEPTH: prove copy-by-value (not by-reference) for EVERY kind ──────────
  // The work_role source-mutation proof above covers one kind; the load-bearing
  // invariant must hold identically for article / company_settings / quote_terms.
  // For each: build, snapshot the serialized form, MUTATE every captured field on the
  // ORIGINAL source object, then assert the prior snapshot is byte-for-byte unchanged
  // AND frozen AND the source was never mutated by the builder.

  test("[P0] article: mutating the source AFTER build does NOT change the prior snapshot (copy-by-value)", () => {
    const source = {
      id: "art-1",
      tenant_id: "tenant-A",
      name: "Kabel 3x1.5",
      sku: "EKK-3X15" as string | null,
      unit: "m" as string | null,
      unit_price_ore: 1995,
      is_active: true,
      updated_at: SOURCE_UPDATED_AT,
    };
    const snap = buildArticleSnapshot(source, { capturedAt: CAPTURED_AT });
    const before = JSON.stringify(snap);

    // Mutate EVERY captured field on the original source (simulating a later edit/archive).
    source.name = "EDITED";
    source.sku = "CHANGED";
    source.unit = "st";
    source.unit_price_ore = 99999999;
    source.is_active = false;
    source.updated_at = "2099-01-01T00:00:00.000Z";

    assert.equal(JSON.stringify(snap), before); // no silent recompute
    assert.equal(snap.name, "Kabel 3x1.5");
    assert.equal(snap.sku, "EKK-3X15");
    assert.equal(snap.unit, "m");
    assert.equal(snap.unitPriceOre, 1995);
    assert.equal(snap.isActive, true);
    assert.equal(snap.sourceUpdatedAt, SOURCE_UPDATED_AT);
    assert.equal(Object.isFrozen(snap), true);
  });

  test("[P0] article: a captured NULL sku/unit does not later re-populate from the mutated source", () => {
    const source = {
      id: "art-2",
      tenant_id: "t",
      name: "n",
      sku: null as string | null,
      unit: null as string | null,
      unit_price_ore: 0,
      is_active: true,
      updated_at: SOURCE_UPDATED_AT,
    };
    const snap = buildArticleSnapshot(source, { capturedAt: CAPTURED_AT });
    // Later the source gets an sku/unit — the prior snapshot's captured NULLs stay NULL.
    source.sku = "LATER-SKU";
    source.unit = "st";
    assert.equal(snap.sku, null);
    assert.equal(snap.unit, null);
  });

  test("[P0] company_settings: mutating the source AFTER build does NOT change the prior snapshot (copy-by-value)", () => {
    const source = {
      id: "cs-1",
      tenant_id: "tenant-A",
      company_name: "Acme El AB" as string | null,
      vat_rate_bp: 2500,
      default_vat_display: "company_togglable",
      updated_at: SOURCE_UPDATED_AT,
    };
    const snap = buildCompanySettingsSnapshot(source, { capturedAt: CAPTURED_AT });
    const before = JSON.stringify(snap);

    // Mutate every captured field (a later VAT-rate / display-mode / identity edit).
    source.company_name = "EDITED AB";
    source.vat_rate_bp = 1200;
    source.default_vat_display = "company_excl";
    source.updated_at = "2099-01-01T00:00:00.000Z";

    assert.equal(JSON.stringify(snap), before); // VAT assumptions frozen, no recompute
    assert.equal(snap.companyName, "Acme El AB");
    assert.equal(snap.vatRateBp, 2500);
    assert.equal(snap.defaultVatDisplay, "company_togglable");
    assert.equal(snap.sourceUpdatedAt, SOURCE_UPDATED_AT);
    assert.equal(Object.isFrozen(snap), true);
  });

  test("[P0] quote_terms: mutating the source AFTER build does NOT change the prior snapshot (copy-by-value)", () => {
    const source = {
      id: "qt-1",
      tenant_id: "tenant-A",
      terms_text: "Betalningsvillkor 30 dagar (platshållartext).",
      approved_at: "2026-06-28T09:00:00.000Z" as string | null,
      approved_by: "user-admin-a" as string | null,
      updated_at: SOURCE_UPDATED_AT,
    };
    const snap = buildQuoteTermsSnapshot(source, { capturedAt: CAPTURED_AT });
    const before = JSON.stringify(snap);

    // Mutate every captured field (a later wording edit RESETS approved_at to null).
    source.terms_text = "EDITED WORDING";
    source.approved_at = null;
    source.approved_by = null;
    source.updated_at = "2099-01-01T00:00:00.000Z";

    assert.equal(JSON.stringify(snap), before); // sign-off STATE at capture is preserved
    assert.equal(snap.termsText, "Betalningsvillkor 30 dagar (platshållartext).");
    assert.equal(snap.approvedAt, "2026-06-28T09:00:00.000Z");
    assert.equal(snap.approvedBy, "user-admin-a");
    assert.equal(snap.sourceUpdatedAt, SOURCE_UPDATED_AT);
    assert.equal(Object.isFrozen(snap), true);
  });

  test("[P0] a direct write to a frozen snapshot of EVERY kind does not take effect", () => {
    const snaps: Array<Record<string, unknown>> = [
      buildWorkRoleSnapshot(
        { id: "w", tenant_id: "t", display_name: "x", cost_rate_ore: 1, sell_rate_ore: 2, is_active: true, updated_at: SOURCE_UPDATED_AT },
        { capturedAt: CAPTURED_AT },
      ) as unknown as Record<string, unknown>,
      buildArticleSnapshot(
        { id: "a", tenant_id: "t", name: "n", sku: null, unit: null, unit_price_ore: 5, is_active: true, updated_at: SOURCE_UPDATED_AT },
        { capturedAt: CAPTURED_AT },
      ) as unknown as Record<string, unknown>,
      buildCompanySettingsSnapshot(
        { id: "c", tenant_id: "t", company_name: null, vat_rate_bp: 2500, default_vat_display: "company_excl", updated_at: SOURCE_UPDATED_AT },
        { capturedAt: CAPTURED_AT },
      ) as unknown as Record<string, unknown>,
      buildQuoteTermsSnapshot(
        { id: "q", tenant_id: "t", terms_text: "x", approved_at: null, approved_by: null, updated_at: SOURCE_UPDATED_AT },
        { capturedAt: CAPTURED_AT },
      ) as unknown as Record<string, unknown>,
    ];
    for (const snap of snaps) {
      assert.equal(Object.isFrozen(snap), true);
      const originalKind = snap.kind;
      try {
        snap.kind = "HACKED";
        snap.tenantId = "other-tenant";
      } catch {
        /* strict-mode throw is acceptable */
      }
      assert.equal(snap.kind, originalKind); // the write did not take effect
    }
  });
});

describe("Story 3.5 — field-capture EDGES (AC1: öre boundaries, VAT bp, terms state, version)", () => {
  test("[P0] integer-öre boundary values (0 and a large integer) are copied verbatim and stay integers", () => {
    const zero = buildWorkRoleSnapshot(
      { id: "w0", tenant_id: "t", display_name: "z", cost_rate_ore: 0, sell_rate_ore: 0, is_active: true, updated_at: SOURCE_UPDATED_AT },
      { capturedAt: CAPTURED_AT },
    );
    assert.equal(zero.costRateOre, 0);
    assert.equal(zero.sellRateOre, 0);
    assert.equal(Number.isInteger(zero.costRateOre), true);

    const big = Number.MAX_SAFE_INTEGER; // large öre value (still a safe integer)
    const large = buildWorkRoleSnapshot(
      { id: "wB", tenant_id: "t", display_name: "b", cost_rate_ore: big, sell_rate_ore: big, is_active: true, updated_at: SOURCE_UPDATED_AT },
      { capturedAt: CAPTURED_AT },
    );
    assert.equal(large.costRateOre, big); // verbatim — no float, no recompute
    assert.equal(large.sellRateOre, big);
    assert.equal(Number.isInteger(large.costRateOre), true);

    const artLarge = buildArticleSnapshot(
      { id: "aB", tenant_id: "t", name: "n", sku: null, unit: null, unit_price_ore: big, is_active: true, updated_at: SOURCE_UPDATED_AT },
      { capturedAt: CAPTURED_AT },
    );
    assert.equal(artLarge.unitPriceOre, big);
    assert.equal(Number.isInteger(artLarge.unitPriceOre), true);
  });

  test("[P0] vat_rate_bp boundary values (0, 2500, 10000) are captured verbatim as basis points", () => {
    for (const bp of [0, 2500, 10000]) {
      const snap = buildCompanySettingsSnapshot(
        { id: `cs-${bp}`, tenant_id: "t", company_name: null, vat_rate_bp: bp, default_vat_display: "company_excl", updated_at: SOURCE_UPDATED_AT },
        { capturedAt: CAPTURED_AT },
      );
      assert.equal(snap.vatRateBp, bp); // bp stays bp — NOT converted to a percent
      assert.equal(Number.isInteger(snap.vatRateBp), true);
    }
  });

  test("[P0] terms approved_at: NULL (not-approved) and a timestamp (approved) are BOTH captured faithfully — the builder never approves", () => {
    const notApproved = buildQuoteTermsSnapshot(
      { id: "qt-n", tenant_id: "t", terms_text: "v", approved_at: null, approved_by: null, updated_at: SOURCE_UPDATED_AT },
      { capturedAt: CAPTURED_AT },
    );
    // Not-approved state captured as-is: NULL never becomes a timestamp or a truthy flag.
    assert.equal(notApproved.approvedAt, null);
    assert.equal(notApproved.approvedBy, null);
    assert.equal("isApproved" in notApproved, false);

    const approvedAt = "2026-06-28T09:00:00.000Z";
    const approved = buildQuoteTermsSnapshot(
      { id: "qt-y", tenant_id: "t", terms_text: "v", approved_at: approvedAt, approved_by: "user-x", updated_at: SOURCE_UPDATED_AT },
      { capturedAt: CAPTURED_AT },
    );
    assert.equal(approved.approvedAt, approvedAt); // captured verbatim
    assert.equal(approved.approvedBy, "user-x");
  });

  test("[P0] capturedAt is ALWAYS the injected value and is distinct from the source version (sourceUpdatedAt)", () => {
    // Cover every kind: capturedAt comes from opts, sourceUpdatedAt is the row updated_at.
    const capturedAt = "2027-03-15T10:00:00.000Z";
    const updatedAt = "2025-01-02T03:04:05.000Z";
    const wr = buildWorkRoleSnapshot(
      { id: "w", tenant_id: "t", display_name: "x", cost_rate_ore: 1, sell_rate_ore: 2, is_active: true, updated_at: updatedAt },
      { capturedAt },
    );
    const art = buildArticleSnapshot(
      { id: "a", tenant_id: "t", name: "n", sku: null, unit: null, unit_price_ore: 3, is_active: true, updated_at: updatedAt },
      { capturedAt },
    );
    const cs = buildCompanySettingsSnapshot(
      { id: "c", tenant_id: "t", company_name: null, vat_rate_bp: 2500, default_vat_display: "company_excl", updated_at: updatedAt },
      { capturedAt },
    );
    const qt = buildQuoteTermsSnapshot(
      { id: "q", tenant_id: "t", terms_text: "x", approved_at: null, approved_by: null, updated_at: updatedAt },
      { capturedAt },
    );
    for (const snap of [wr, art, cs, qt]) {
      assert.equal(snap.capturedAt, capturedAt); // always set, from opts
      assert.equal(snap.sourceUpdatedAt, updatedAt); // the source "version"
      assert.notEqual(snap.capturedAt, snap.sourceUpdatedAt); // distinct concerns
    }
  });
});

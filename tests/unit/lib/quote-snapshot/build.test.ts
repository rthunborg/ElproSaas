/**
 * Story 6.1 — the PURE composite quote-version snapshot builder purity + öre +
 * internal-exclusion contract (AC2, P0/P1 — 6.1-UNIT-01/02 + 6.2-UNIT-01 / R-603/R-607).
 *
 * The quote version is the FIRST COMPOSITE immutable snapshot — a copy-by-value freeze of
 * everything customer-visible, composing the three-times-proven freeze discipline (Epic 3
 * snapshot contract → Epic 4 golden freeze → Epic 5 pricing-source row freeze) at quote
 * scale. This suite pins:
 *   6.1-UNIT-01  the builder is PURE — copy-by-value (mutating the source input after build
 *                does NOT change the snapshot), deep `Object.freeze` (a post-build mutation
 *                throws / no-ops, nested arrays frozen), INJECTED clock (capturedAt from
 *                opts, never Date.now()), CAPTURE-NOT-COMPUTE (totals stored from engine
 *                state, no inline money math), terms approvedAt captured VERBATIM.
 *   6.1-UNIT-02  öre discipline — every *_ore field passes the canonical `isOreAmount`;
 *                VAT/deduction rates are BASIS POINTS, never a float.
 *   6.2-UNIT-01  INTERNAL EXCLUSION (R-607) — the customer-visible line snapshot carries NO
 *                `unit_cost_ore`, NO margin/markup, NO `internal_note` (dropped by construction).
 *
 * Runner: `node --test` with TS strip-types (`pnpm test:unit`) — pure logic, NO DB, NO
 * clock read, NO PII. Mirrors `tests/unit/lib/snapshots/build.test.ts`.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildQuoteVersionSnapshot } from "@/lib/quote-snapshot/build";
import type { QuoteVersionSnapshotInput } from "@/lib/quote-snapshot/build";
import type { QuoteVersionSnapshot } from "@/lib/quote-snapshot/types";
import { isOreAmount } from "@/lib/money";

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
];

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
];

function carriesForbiddenSupplierToken(key: string, forbidden: string): boolean {
  // Story 10.6 adds the legitimate tax field `includedInInvoiceTotal`; its normalized key
  // contains the short substring "edi" across a word boundary. Keep the supplier-scope guard
  // focused on real integration keys rather than that incidental spelling.
  if (forbidden === "edi" && key === "includedininvoicetotal") return false;
  return key.includes(forbidden);
}

/** A fully-populated in-memory input fixture (no DB, no PII). */
function makeInput(over: Partial<QuoteVersionSnapshotInput> = {}): QuoteVersionSnapshotInput {
  return {
    calculationId: "calc-1",
    company: {
      company_name: "Anon Demo AB",
      org_nr: "556000-0000",
      address_line1: "Testgatan 1",
      address_line2: null,
      postal_code: "12345",
      city: "Teststad",
      email: "info@example.test",
      phone: "070-0000000",
      logo_url: "logo.png",
    },
    customer: {
      customer_display_name: "Anon Customer",
      customer_type: "private",
      facility_name: "Anon Facility",
      contact_name: "Anon Contact",
    },
    terms: { terms_text: "Villkor (platshållartext)", approved_at: null, approved_by: null },
    totals: {
      baseTotalOre: 230000,
      optionTotalOre: 0,
      vatTotalOre: 57500,
      deductionTotalOre: 0,
      acceptedPriceOre: 287500,
    },
    assumptions: {
      vatRateBp: 2500,
      vatDisplay: "private",
      deductionType: null,
      deductionRateBp: null,
      deductionCapOre: null,
      deductionPersons: null,
      requiresSignOff: true,
    },
    header: {
      quoteNumberDisplay: null,
      validUntil: null,
      introText: null,
      customerNotes: null,
      displayMode: "detailed",
    },
    lines: [
      {
        rowType: "labor",
        sortOrder: 0,
        label: "Arbete",
        description: null,
        quoteNote: "kundnotis",
        quantity: 2,
        unit: "h",
        unitSellOre: 85000,
        lineNetOre: 170000,
        vatRateBp: 2500,
        isHidden: false,
        isOptional: false,
        isSelected: null,
      },
    ],
    attachments: [{ fileId: "file-1", displayName: "bilaga.pdf", sortOrder: 0 }],
    warnings: [
      { code: "REQUIRED_FILES_DEFERRED", severity: "warning", message: "…" },
    ],
    ...over,
  };
}

/** Recursively collect every own-enumerable key (lower-cased, underscores stripped). */
function collectKeys(value: unknown, acc: Set<string>): void {
  if (Array.isArray(value)) {
    for (const el of value) collectKeys(el, acc);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      acc.add(k.toLowerCase().replace(/_/g, ""));
      collectKeys(v, acc);
    }
  }
}

describe("Story 6.1 — pure QuoteVersionSnapshot builder purity + öre + internal-exclusion", () => {
  test("legacy V1 builds keep every V2-only tax fact explicitly null", () => {
    const snap = buildQuoteVersionSnapshot(makeInput(), { capturedAt: CAPTURED_AT });

    assert.equal(snap.snapshotSchemaVersion, null);
    assert.equal(snap.taxRuleVersion, null);
    assert.equal(snap.taxAnswerSnapshot, null);
    assert.equal(snap.buyerVatNumber, null);
    assert.equal(snap.calculatedDeductionOre, null);
    assert.equal(snap.claimDeductionOre, null);
    assert.equal(snap.payableOre, null);
    assert.equal(snap.netOre, null);
    assert.equal(snap.vatOre, null);
    assert.equal(snap.grossOre, null);
    assert.equal(snap.deductionOre, null);
  });

  test("[P0] copy-by-value: mutating the source after build does not change the snapshot (6.1-UNIT-01)", () => {
    const input = makeInput();
    const snap = buildQuoteVersionSnapshot(input, { capturedAt: CAPTURED_AT });
    // Mutate the source input AFTER build.
    (input.company as { org_nr: string }).org_nr = "MUTATED";
    (input.lines[0] as { label: string }).label = "MUTATED";
    // The built snapshot is unaffected (no live reference retained).
    assert.notEqual(snap.companyOrgNr, "MUTATED");
    assert.equal(snap.companyOrgNr, "556000-0000");
    assert.notEqual(snap.lines[0]?.label, "MUTATED");
    assert.equal(snap.lines[0]?.label, "Arbete");
  });

  test("[P0] deep Object.freeze: a post-build mutation attempt throws (strict) (6.1-UNIT-01)", () => {
    "use strict";
    const snap = buildQuoteVersionSnapshot(makeInput(), { capturedAt: CAPTURED_AT });
    assert.ok(Object.isFrozen(snap), "the snapshot value must be frozen");
    assert.ok(Object.isFrozen(snap.lines), "the lines array must be frozen");
    assert.ok(Object.isFrozen(snap.lines[0]), "each line must be frozen");
    assert.ok(Object.isFrozen(snap.attachments), "the attachments array must be frozen");
    assert.ok(Object.isFrozen(snap.attachments[0]), "each attachment must be frozen");
    assert.ok(Object.isFrozen(snap.warnings), "the warnings array must be frozen");
    // A strict-mode write to a frozen property throws.
    assert.throws(() => {
      (snap as { baseTotalOre: number }).baseTotalOre = 1;
    }, TypeError);
  });

  test("[P0] injected clock: capturedAt comes from opts, never Date.now() (6.1-UNIT-01)", () => {
    const snap1 = buildQuoteVersionSnapshot(makeInput(), { capturedAt: CAPTURED_AT });
    const snap2 = buildQuoteVersionSnapshot(makeInput(), { capturedAt: CAPTURED_AT });
    assert.equal(snap1.capturedAt, CAPTURED_AT);
    // Deterministic: the same fixed capturedAt → the same instant (no wall-clock read).
    assert.equal(snap1.capturedAt, snap2.capturedAt);
    // A DIFFERENT injected instant flows through verbatim.
    const other = "2020-01-01T00:00:00.000Z";
    const snap3 = buildQuoteVersionSnapshot(makeInput(), { capturedAt: other });
    assert.equal(snap3.capturedAt, other);
  });

  test("[P0] capture-not-compute: totals are stored from engine state VERBATIM (6.1-UNIT-01)", () => {
    // Pass arbitrary pre-computed totals; the builder stores them verbatim (no re-derive).
    const input = makeInput({
      totals: {
        baseTotalOre: 111111,
        optionTotalOre: 22222,
        vatTotalOre: 33333,
        deductionTotalOre: 4444,
        acceptedPriceOre: 555555,
      },
    });
    const snap = buildQuoteVersionSnapshot(input, { capturedAt: CAPTURED_AT });
    assert.equal(snap.baseTotalOre, 111111);
    assert.equal(snap.optionTotalOre, 22222);
    assert.equal(snap.vatTotalOre, 33333);
    assert.equal(snap.deductionTotalOre, 4444);
    assert.equal(snap.acceptedPriceOre, 555555);
    // The builder never re-derives VAT from the rate: gross != net*rate unless supplied.
    assert.notEqual(snap.acceptedPriceOre, snap.baseTotalOre * 1.25);
  });

  test("[P0] terms approvedAt captured VERBATIM (NULL = not-approved), source never mutated (6.1-UNIT-01)", () => {
    // NULL approved_at stays NULL.
    const nullTerms = makeInput();
    const snapNull = buildQuoteVersionSnapshot(nullTerms, { capturedAt: CAPTURED_AT });
    assert.equal(snapNull.termsApprovedAt, null);
    assert.ok(
      !("isApproved" in (snapNull as unknown as Record<string, unknown>)),
      "the builder NEVER derives an isApproved flag",
    );
    // A non-null approved_at is copied AS-IS.
    const approved = "2026-07-04T09:00:00.000Z";
    const approvedTerms = makeInput({
      terms: { terms_text: "T", approved_at: approved, approved_by: "user-1" },
    });
    const snapApproved = buildQuoteVersionSnapshot(approvedTerms, { capturedAt: CAPTURED_AT });
    assert.equal(snapApproved.termsApprovedAt, approved);
    assert.equal(snapApproved.termsApprovedBy, "user-1");
    // The builder never mutates the source terms row.
    assert.equal(approvedTerms.terms?.approved_at, approved);
  });

  test("[P0] öre discipline: money fields integer öre via canonical isOreAmount, VAT in bp (6.1-UNIT-02)", () => {
    const snap = buildQuoteVersionSnapshot(makeInput(), { capturedAt: CAPTURED_AT });
    // Every top-level *_ore field passes the CANONICAL isOreAmount (integer, 0..MAX).
    for (const ore of [
      snap.baseTotalOre,
      snap.optionTotalOre,
      snap.vatTotalOre,
      snap.deductionTotalOre,
      snap.acceptedPriceOre,
    ]) {
      assert.ok(isOreAmount(ore), `${ore} must be a valid integer öre amount`);
    }
    // Every line öre passes isOreAmount (nulls allowed for a text/section line).
    for (const line of snap.lines) {
      if (line.unitSellOre !== null) assert.ok(isOreAmount(line.unitSellOre));
      if (line.lineNetOre !== null) assert.ok(isOreAmount(line.lineNetOre));
    }
    // VAT rate is BASIS POINTS (integer 0..10000), never a float percent.
    assert.ok(Number.isInteger(snap.vatRateBp));
    assert.ok((snap.vatRateBp ?? 0) >= 0 && (snap.vatRateBp ?? 0) <= 10000);
  });

  test("[P0] internal EXCLUSION: customer-visible lines carry no cost/margin/internal_note (6.2-UNIT-01, R-607)", () => {
    // Build from an input whose (typed) line SOURCE deliberately does not declare the
    // internal fields — even if a caller smuggles extra keys on the source object, the
    // builder reads ONLY the customer-visible fields, so they never land on the snapshot.
    const smuggled = makeInput();
    // Attach internal fields to the source line object (a hostile/careless caller).
    Object.assign(smuggled.lines[0], {
      unit_cost_ore: 45000,
      markup_bp: 5000,
      internal_note: "SECRET INTERNAL NOTE",
    });
    const snap = buildQuoteVersionSnapshot(smuggled, { capturedAt: CAPTURED_AT });
    for (const line of snap.lines) {
      for (const key of Object.keys(line)) {
        const norm = key.toLowerCase().replace(/_/g, "");
        assert.ok(
          !INTERNAL_FORBIDDEN.includes(norm),
          `line snapshot must NOT carry internal key ${key} (R-607)`,
        );
      }
    }
    // And the secret internal note value never appears anywhere in the serialized snapshot.
    assert.ok(
      !JSON.stringify(snap).includes("SECRET INTERNAL NOTE"),
      "the internal note must not leak into the frozen snapshot (R-607)",
    );
  });

  test("[P0] no supplier/integration key anywhere in the snapshot (HARD no-supplier-scope)", () => {
    const snap: QuoteVersionSnapshot = buildQuoteVersionSnapshot(makeInput(), {
      capturedAt: CAPTURED_AT,
    });
    const keys = new Set<string>();
    collectKeys(snap, keys);
    for (const forbidden of SUPPLIER_FORBIDDEN) {
      for (const key of keys) {
        assert.ok(
          !carriesForbiddenSupplierToken(key, forbidden),
          `no snapshot key may contain the supplier/integration token '${forbidden}' (got '${key}')`,
        );
      }
    }
  });
});

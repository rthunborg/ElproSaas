import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildQuoteReviewDigest,
  quoteReviewDigestsEqual,
  type QuoteReviewSource,
} from "@/server/commands/quotes/review-token";

function reviewedSource(): QuoteReviewSource {
  return {
    quoteCaptureDate: "2026-08-07",
    calculation: {
      id: "11111111-1111-1111-1111-111111111111",
      status: "draft",
      customerId: "22222222-2222-2222-2222-222222222222",
      facilityId: null,
      contactId: null,
      taxInput: {
        schemaVersion: 2,
        documentVatType: "STANDARD_VAT_25",
        buyerVatNumber: null,
        deductionChoice: "NONE",
        paymentDate: null,
        finalPaymentDate: null,
        personAllowanceSlots: [],
        greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
        genuineFixedPrice: false,
        fixedPriceOre: null,
        fixedPriceCategorySplitOre: null,
        fixedPriceRowIds: null,
      },
    },
    sections: [
      { id: "section-b", title: "B", displayMode: "detailed", sortOrder: 2 },
      { id: "section-a", title: "A", displayMode: "detailed", sortOrder: 1 },
    ],
    rows: [
      {
        id: "row-b",
        sectionId: "section-b",
        rowType: "material",
        quantity: 1,
        unit: "st",
        unitCostOre: 12_000,
        sourceKind: "article",
        unitSellOre: 20_000,
        vatRateBp: 2_500,
        includedInInvoiceTotal: true,
        deductionClassification: "NONE",
        vatType: "STANDARD_VAT_25",
        isHidden: false,
        isOptional: false,
        isSelected: null,
        label: "B",
        description: null,
        quoteNote: null,
        sortOrder: 1,
      },
      {
        id: "row-a",
        sectionId: "section-a",
        rowType: "labor",
        quantity: 2,
        unit: "h",
        unitCostOre: 5_000,
        sourceKind: "work_role",
        unitSellOre: 10_000,
        vatRateBp: 2_500,
        includedInInvoiceTotal: true,
        deductionClassification: "NONE",
        vatType: "STANDARD_VAT_25",
        isHidden: false,
        isOptional: false,
        isSelected: null,
        label: "A",
        description: "Arbete",
        quoteNote: null,
        sortOrder: 1,
      },
    ],
    customer: {
      displayName: "Kund AB",
      customerType: "company",
      facilityName: null,
      contactName: null,
    },
    company: {
      companyName: "El AB",
      orgNr: "556677-8899",
      addressLine1: "Elgatan 1",
      addressLine2: null,
      postalCode: "11122",
      city: "Stockholm",
      email: "info@example.test",
      phone: null,
      logoUrl: null,
      defaultVatDisplay: "including_vat",
      vatRateBp: 2_500,
    },
    terms: { text: "30 dagar", approvedAt: "2026-08-01T12:00:00Z", approvedBy: "user" },
    attachments: [
      { fileId: "file-b", displayName: "B.pdf", sortOrder: 2 },
      { fileId: "file-a", displayName: "A.pdf", sortOrder: 1 },
    ],
  };
}

test("quote review digest is stable across source collection ordering", () => {
  const source = reviewedSource();
  const reordered: QuoteReviewSource = {
    ...source,
    sections: [...source.sections].reverse(),
    rows: [...source.rows].reverse(),
    attachments: [...source.attachments].reverse(),
  };
  assert.equal(buildQuoteReviewDigest(reordered), buildQuoteReviewDigest(source));
});

test("quote review digest changes for customer-visible, tax, and capture-date changes", () => {
  const source = reviewedSource();
  const original = buildQuoteReviewDigest(source);
  const changedRow: QuoteReviewSource = {
    ...source,
    rows: source.rows.map((row) => row.id === "row-a" ? { ...row, quantity: 3 } : row),
  };
  const changedTax: QuoteReviewSource = {
    ...source,
    calculation: {
      ...source.calculation,
      taxInput: {
        ...(source.calculation.taxInput as Record<string, unknown>),
        deductionChoice: "ROT",
        paymentDate: "2026-08-10",
        personAllowanceSlots: [{
          slot: "PERSON_1",
          remainingRotAllowanceOre: 5_000_000,
          remainingCombinedRotRutAllowanceOre: 7_500_000,
        }],
      },
    },
  };
  assert.notEqual(buildQuoteReviewDigest(changedRow), original);
  assert.notEqual(buildQuoteReviewDigest(changedTax), original);
  assert.notEqual(
    buildQuoteReviewDigest({
      ...source,
      rows: source.rows.map((row) =>
        row.id === "row-a" ? { ...row, unitCostOre: 7_000, sourceKind: null } : row),
    }),
    original,
  );
  const changedPaymentPolicyDate: QuoteReviewSource = {
    ...changedTax,
    calculation: {
      ...changedTax.calculation,
      taxInput: {
        ...(changedTax.calculation.taxInput as Record<string, unknown>),
        paymentDate: "2026-08-11",
      },
    },
  };
  assert.notEqual(
    buildQuoteReviewDigest(changedPaymentPolicyDate),
    buildQuoteReviewDigest(changedTax),
    "the independently resolved ROT payment-date policy fact belongs to the proof",
  );
  assert.notEqual(
    buildQuoteReviewDigest({ ...source, quoteCaptureDate: "2026-08-08" }),
    original,
  );
});

test("quote review digest equality rejects malformed values and compares valid digests", () => {
  const digest = buildQuoteReviewDigest(reviewedSource());
  const otherDigest = digest.slice(0, 63) + (digest.endsWith("0") ? "1" : "0");
  assert.equal(quoteReviewDigestsEqual(digest, digest), true);
  assert.equal(quoteReviewDigestsEqual(digest, otherDigest), false);
  assert.equal(quoteReviewDigestsEqual("not-a-digest", digest), false);
});

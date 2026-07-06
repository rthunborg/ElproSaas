/**
 * Story 6.1 — EDGE coverage for the pure composite `QuoteVersionSnapshot` builder
 * (AC2; test-design-epic-6.md #6.1-UNIT-01 / R-603/R-607).
 *
 * `build.test.ts` pins the headline purity/freeze/öre/internal-exclusion contract over a
 * fully-populated fixture. THIS suite complements it with the boundary shapes the composite
 * builder must survive without leaking a live reference or de-freezing a nested array:
 *   - EMPTY composite children (no lines / no attachments / no warnings) still yield a
 *     deeply-frozen value with frozen empty arrays;
 *   - the `null` terms row → termsText/approvedAt/approvedBy all NULL (the `?? null`
 *     branch, distinct from a present-row-with-NULL-approved_at case);
 *   - copy-by-value at ARRAY depth — mutating a source line / attachment / warning element
 *     AFTER the build does not reach the frozen snapshot (the array is re-mapped, not aliased);
 *   - all-null customer/company/header fields are captured verbatim (a snapshot of an
 *     unconfigured tenant is still a valid frozen value, not a throw);
 *   - a MULTI-line snapshot preserves order + per-line freeze.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildQuoteVersionSnapshot } from "@/lib/quote-snapshot/build";
import type { QuoteVersionSnapshotInput } from "@/lib/quote-snapshot/build";

const CAPTURED_AT = "2026-07-05T12:00:00.000Z";

/** A minimal all-null-ish input (an unconfigured tenant / a bare calc). */
function makeMinimalInput(
  over: Partial<QuoteVersionSnapshotInput> = {},
): QuoteVersionSnapshotInput {
  return {
    calculationId: "calc-min",
    company: {
      company_name: null,
      org_nr: null,
      address_line1: null,
      address_line2: null,
      postal_code: null,
      city: null,
      email: null,
      phone: null,
      logo_url: null,
    },
    customer: {
      customer_display_name: null,
      customer_type: null,
      facility_name: null,
      contact_name: null,
    },
    terms: null,
    totals: {
      baseTotalOre: 0,
      optionTotalOre: 0,
      vatTotalOre: 0,
      deductionTotalOre: 0,
      acceptedPriceOre: 0,
    },
    assumptions: {
      vatRateBp: null,
      vatDisplay: null,
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
      displayMode: null,
    },
    lines: [],
    attachments: [],
    warnings: [],
    ...over,
  };
}

describe("Story 6.1 — QuoteVersionSnapshot builder EDGE coverage (6.1-UNIT-01)", () => {
  test("[P1] EMPTY children: no lines/attachments/warnings → deeply-frozen empty arrays", () => {
    const snap = buildQuoteVersionSnapshot(makeMinimalInput(), {
      capturedAt: CAPTURED_AT,
    });
    assert.ok(Object.isFrozen(snap), "value frozen");
    assert.deepEqual(snap.lines, []);
    assert.deepEqual(snap.attachments, []);
    assert.deepEqual(snap.warnings, []);
    assert.ok(Object.isFrozen(snap.lines), "empty lines array frozen");
    assert.ok(Object.isFrozen(snap.attachments), "empty attachments array frozen");
    assert.ok(Object.isFrozen(snap.warnings), "empty warnings array frozen");
    // A push onto a frozen empty array throws in strict mode (node:test runs modules strict).
    assert.throws(() => {
      (snap.lines as unknown as unknown[]).push({});
    }, TypeError);
  });

  test("[P1] null terms row → termsText/approvedAt/approvedBy all NULL (the ?? null branch)", () => {
    const snap = buildQuoteVersionSnapshot(makeMinimalInput({ terms: null }), {
      capturedAt: CAPTURED_AT,
    });
    assert.equal(snap.termsText, null);
    assert.equal(snap.termsApprovedAt, null);
    assert.equal(snap.termsApprovedBy, null);
    // Still NEVER a derived flag.
    assert.ok(!("isApproved" in (snap as unknown as Record<string, unknown>)));
  });

  test("[P1] all-null company/customer/header captured verbatim (unconfigured tenant is valid)", () => {
    const snap = buildQuoteVersionSnapshot(makeMinimalInput(), {
      capturedAt: CAPTURED_AT,
    });
    assert.equal(snap.companyName, null);
    assert.equal(snap.companyOrgNr, null);
    assert.equal(snap.customerDisplayName, null);
    assert.equal(snap.facilityName, null);
    assert.equal(snap.displayMode, null);
    assert.equal(snap.vatRateBp, null);
    // capturedAt still flows through.
    assert.equal(snap.capturedAt, CAPTURED_AT);
  });

  test("[P1] copy-by-value at ARRAY depth: mutating a source line element after build does not reach the snapshot", () => {
    const lines = [
      {
        rowType: "labor",
        sortOrder: 0,
        label: "A",
        description: null,
        quoteNote: null,
        quantity: 1,
        unit: "h",
        unitSellOre: 10000,
        lineNetOre: 10000,
        vatRateBp: 2500,
        isHidden: false,
        isOptional: false,
        isSelected: null,
      },
    ];
    const input = makeMinimalInput({ lines });
    const snap = buildQuoteVersionSnapshot(input, { capturedAt: CAPTURED_AT });
    // Mutate the SOURCE array element after build.
    (lines[0] as { label: string }).label = "MUTATED";
    (lines[0] as { unitSellOre: number }).unitSellOre = 999999;
    assert.equal(snap.lines[0]?.label, "A", "line label frozen at capture");
    assert.equal(snap.lines[0]?.unitSellOre, 10000, "line öre frozen at capture");
    assert.ok(Object.isFrozen(snap.lines[0]), "each line element frozen");
  });

  test("[P1] copy-by-value at ARRAY depth: mutating a source attachment / warning after build does not reach the snapshot", () => {
    const attachments = [{ fileId: "f-1", displayName: "orig.pdf", sortOrder: 0 }];
    const warnings = [{ code: "W1", severity: "warning", message: "orig" }];
    const input = makeMinimalInput({ attachments, warnings });
    const snap = buildQuoteVersionSnapshot(input, { capturedAt: CAPTURED_AT });
    (attachments[0] as { displayName: string }).displayName = "RENAMED.pdf";
    (warnings[0] as { message: string }).message = "MUTATED";
    assert.equal(snap.attachments[0]?.displayName, "orig.pdf");
    assert.equal(snap.warnings[0]?.message, "orig");
    assert.ok(Object.isFrozen(snap.attachments[0]));
    assert.ok(Object.isFrozen(snap.warnings[0]));
  });

  test("[P1] MULTI-line snapshot preserves source order + sortOrder and freezes each element", () => {
    const lines = [0, 1, 2].map((i) => ({
      rowType: "labor",
      sortOrder: i,
      label: `L${i}`,
      description: null,
      quoteNote: null,
      quantity: 1,
      unit: "h",
      unitSellOre: (i + 1) * 1000,
      lineNetOre: (i + 1) * 1000,
      vatRateBp: 2500,
      isHidden: false,
      isOptional: false,
      isSelected: null,
    }));
    const snap = buildQuoteVersionSnapshot(makeMinimalInput({ lines }), {
      capturedAt: CAPTURED_AT,
    });
    assert.equal(snap.lines.length, 3);
    assert.deepEqual(
      snap.lines.map((l) => l.label),
      ["L0", "L1", "L2"],
    );
    assert.deepEqual(
      snap.lines.map((l) => l.sortOrder),
      [0, 1, 2],
    );
    for (const l of snap.lines) assert.ok(Object.isFrozen(l));
  });

  test("[P1] a DIFFERENT injected capturedAt flows through verbatim on the minimal input (deterministic clock)", () => {
    const other = "1999-12-31T23:59:59.000Z";
    const snap = buildQuoteVersionSnapshot(makeMinimalInput(), { capturedAt: other });
    assert.equal(snap.capturedAt, other);
  });
});

/**
 * Story 6.3 — fast-gate coverage for the DETERMINISTIC server-only PDF renderer
 * `renderQuotePdf` (`src/server/quote-pdf/render.ts`; Task 3, H3 / R-612 / R-607 / R-610).
 *
 * ── WHY A UNIT BELT (not a duplicate of INT-03) ─────────────────────────────────────
 * The renderer reads NO clock and does NO I/O — the render instant is INJECTED via
 * `renderedAt`, so it is a PURE function of its input. That means the load-bearing H3
 * determinism property (`6.3-INT-03`, proven DB-backed) can ALSO be protected cheaply on the
 * fast `node --test` gate that runs on EVERY PR — without a Supabase stack. This suite adds:
 *   - BYTE-DETERMINISM: the same view model + `renderedAt` → byte-identical output (H3/R-612);
 *   - INJECTED-TIMESTAMP discipline: two DIFFERENT `renderedAt` still render (no wall-clock
 *     read anywhere; the InfoDict dates come from the injected instant), and the SAME instant is
 *     byte-identical regardless of when the test runs;
 *   - NON-FINAL FRAMING (R-610): the `NON_FINAL_CUE` prints when `requiresSignOff` and is ABSENT
 *     when not — the PDF is NEVER a legally-final document (demo-data-only accept; MEMORY);
 *   - the R-607 LEAKAGE belt THROUGH THE RENDER: a hostile internal value stuffed into a typed
 *     hole never reaches the extracted PDF text (the renderer prints only the view model's
 *     declared customer-visible fields);
 *   - BRANCH coverage the 2-case golden does not reach: empty lines / empty attachments / no
 *     warnings / no deduction / null company identity → the renderer STILL produces a valid PDF
 *     (no throw) with the right fallback strings;
 *   - `svDate` locale-independent formatting + the `—` fallback for null/unparseable dates.
 *
 * The extracted-TEXT assertions reuse the same `extractPdfText` (`pdfjs-dist`) helper the golden
 * uses, so this belt reads the PDF the way the customer-visible contract does.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO clock (the instant is INJECTED).
 * The renderer is a server-only module but it is I/O-free, so it runs cleanly under the fast gate.
 *
 * [Source: story 6.3 Task 3 (H3 determinism) + Task 6.2 (6.3-INT-03) + Task 6.1;
 *  src/server/quote-pdf/render.ts; test-design-epic-6.md#6.3-INT-03/6.3-GOLDEN-01, R-612/R-607/R-610;
 *  tests/support/pdf-text.ts (the shared text extractor)]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderQuotePdf, NON_FINAL_CUE } from "@/server/quote-pdf/render";
import { extractPdfText } from "../../../support/pdf-text";
import type { QuotePdfViewModel } from "@/lib/quote-pdf";

const FIXED_ISO = "2026-07-05T12:00:00.000Z"; // the INJECTED render instant (determinism, R-612)

/**
 * A representative customer-visible view model (already snapshot-derived + money pre-formatted
 * kronor via the single formatter, exactly as `buildQuotePdfViewModel` emits it). No internal
 * cost/margin/internal-note field exists on the type — the R-607 belt below smuggles one in via
 * a typed hole to prove the renderer STILL never prints it.
 */
function baseViewModel(overrides: Partial<QuotePdfViewModel> = {}): QuotePdfViewModel {
  return {
    companyName: "Test Elfirma AB",
    companyOrgNr: "556000-0000",
    companyAddressLine1: "Testgatan 1",
    companyAddressLine2: null,
    companyPostalCode: "111 11",
    companyCity: "Teststad",
    companyEmail: "kontakt@example.test",
    companyPhone: "+46 00 000 00 00",
    companyLogoUrl: null,
    customerDisplayName: "Kund Kundsson",
    customerType: "private",
    facilityName: "Anläggning A",
    contactName: "Kontakt K",
    quoteNumberDisplay: "2026-1",
    validUntil: "2026-08-05",
    introText: "Tack för förfrågan.",
    customerNotes: "Ring innan besök.",
    termsText: "Betalning 30 dagar netto.",
    termsApprovedAt: null,
    lines: [
      {
        rowType: "labor",
        sortOrder: 0,
        label: "Elarbete",
        description: "Installation",
        quoteNote: "Ingår i priset",
        quantity: 2,
        unit: "h",
        unitSellKronor: "850,00",
        lineNetKronor: "1700,00",
        vatRatePercent: "25",
        isHidden: false,
        isOptional: false,
        isSelected: null,
      },
    ],
    totals: {
      baseKronor: "1700,00",
      optionKronor: "500,00",
      vatKronor: "425,00",
      deductionKronor: "0,00",
      acceptedPriceKronor: "2125,00",
    },
    taxAssumptions: {
      vatRatePercent: "25",
      vatDisplay: null,
      deductionType: "rot",
      deductionRatePercent: "30",
      deductionCapKronor: null,
      deductionPersons: null,
    },
    attachments: [{ fileId: "11111111-1111-1111-1111-111111111111", displayName: "Ritning.pdf", sortOrder: 0 }],
    warnings: [
      { code: "TAX_SIGN_OFF_REQUIRED", severity: "warning", message: "Skatteantaganden kräver godkännande." },
    ],
    displayMode: "detailed",
    requiresSignOff: true,
    ...overrides,
  };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return Buffer.from(a).equals(Buffer.from(b));
}

describe("Story 6.3 — renderQuotePdf determinism + framing (fast-gate belt for 6.3-INT-03)", () => {
  test("[P1] BYTE-DETERMINISM: same view model + same renderedAt → byte-identical output (H3/R-612)", async () => {
    const vm = baseViewModel();
    const a = await renderQuotePdf({ viewModel: vm, renderedAt: FIXED_ISO });
    const b = await renderQuotePdf({ viewModel: vm, renderedAt: FIXED_ISO });
    assert.ok(a.length > 0, "the renderer must produce non-empty PDF bytes");
    assert.equal(bytesEqual(a, b), true, "two renders of the same snapshot+instant must be byte-identical");
  });

  test("[P1] INJECTED TIMESTAMP: a DIFFERENT renderedAt still renders (no wall-clock read; the instant is injected)", async () => {
    const vm = baseViewModel();
    const early = await renderQuotePdf({ viewModel: vm, renderedAt: "2026-01-01T00:00:00.000Z" });
    const late = await renderQuotePdf({ viewModel: vm, renderedAt: "2026-12-31T23:59:59.000Z" });
    // Both render successfully (the render path reads no clock — the instant is the ONLY time
    // source). The InfoDict CreationDate/ModificationDate come from the injected instant, so
    // distinct instants MAY differ in bytes — the point here is neither reads a wall clock.
    assert.ok(early.length > 0 && late.length > 0, "both injected instants must render");
    // Re-rendering the SAME instant is byte-identical regardless of when this test executes,
    // proving the render path never consults `Date.now()`.
    const earlyAgain = await renderQuotePdf({ viewModel: vm, renderedAt: "2026-01-01T00:00:00.000Z" });
    assert.equal(bytesEqual(early, earlyAgain), true, "a fixed instant must render byte-identically (no wall-clock)");
  });

  test("[P1] NON-FINAL FRAMING (R-610): the NON_FINAL_CUE prints when requiresSignOff, absent when not", async () => {
    const requiring = await extractPdfText(
      await renderQuotePdf({ viewModel: baseViewModel({ requiresSignOff: true }), renderedAt: FIXED_ISO }),
    );
    assert.ok(requiring.includes(NON_FINAL_CUE), "a requiresSignOff PDF must render the non-final estimate/sign-off cue");

    const final = await extractPdfText(
      await renderQuotePdf({ viewModel: baseViewModel({ requiresSignOff: false }), renderedAt: FIXED_ISO }),
    );
    assert.equal(final.includes(NON_FINAL_CUE), false, "a non-requiresSignOff PDF must NOT print the non-final cue");
  });

  test("[P1] R-607 belt THROUGH THE RENDER: a smuggled internal value never reaches the PDF text", async () => {
    // The type has no internal-field slot; a hostile caller casts one in. The renderer must
    // print ONLY the view model's declared customer-visible fields, so the internal value never
    // appears in the extracted text (leakage-by-construction survives the render, not just the VM).
    const hostile = {
      ...baseViewModel(),
      // internal fields shoved in via a typed hole — the renderer reads named fields, never a spread.
      unitCostOre: 45000,
      internalNote: "Marginal pressad – förhandla",
      marginBp: 4700,
    } as QuotePdfViewModel;
    const text = await extractPdfText(await renderQuotePdf({ viewModel: hostile, renderedAt: FIXED_ISO }));
    assert.equal(text.includes("Marginal pressad"), false, "an internal note must never reach the PDF text");
    assert.equal(text.includes("45000"), false, "an internal cost öre value must never reach the PDF text");
    // The customer-visible sell price is still printed (verbatim from the pre-formatted VM).
    assert.ok(text.includes("850,00"), "the customer-visible sell kronor must still print");
  });

  test("[P1] the customer-visible totals + warning + attachment appear in the extracted text", async () => {
    const text = await extractPdfText(await renderQuotePdf({ viewModel: baseViewModel(), renderedAt: FIXED_ISO }));
    assert.ok(text.includes("2125,00"), "the accepted-price total must print");
    assert.ok(text.includes("425,00"), "the VAT total must print");
    assert.ok(text.includes("Ritning.pdf"), "the selected attachment name must print");
    assert.ok(text.includes("TAX_SIGN_OFF_REQUIRED"), "the REAL ReadinessCode warning must print verbatim");
  });

  test("[10.6][P1] green fixed-price basis and category enums render only customer-facing Swedish labels", async () => {
    const text = await extractPdfText(await renderQuotePdf({
      viewModel: baseViewModel({
        taxAnswer: {
          source: "v2",
          deductionChoice: "GREEN",
          netKronor: "1 000,00",
          vatKronor: "250,00",
          grossKronor: "1 250,00",
          calculatedDeductionKronor: "181,87",
          claimDeductionKronor: "181,00",
          deductionKronor: "181,00",
          payableKronor: "1 069,00",
          categories: [],
          summaries: {
            labor: { netKronor: "0,00", vatKronor: "0,00", grossKronor: "0,00" },
            material: { netKronor: "1 000,00", vatKronor: "250,00", grossKronor: "1 250,00" },
            other: { netKronor: "0,00", vatKronor: "0,00", grossKronor: "0,00" },
          },
          rot: {
            policy: null,
            basisNetKronor: "0,00",
            allocatedVatKronor: "0,00",
            basisKronor: "0,00",
            calculatedKronor: "0,00",
            claimKronor: "0,00",
            allocations: [],
          },
          green: {
            policy: null,
            basisMethod: "FIXED_PRICE_97_PERCENT",
            categories: {
              SOLAR: { basisKronor: "1 212,50", calculatedKronor: "181,87", claimKronor: "181,00" },
              STORAGE: { basisKronor: "0,00", calculatedKronor: "0,00", claimKronor: "0,00" },
              CHARGING: { basisKronor: "0,00", calculatedKronor: "0,00", claimKronor: "0,00" },
            },
            calculatedKronor: "181,87",
            claimKronor: "181,00",
            allocations: [],
          },
        },
      }),
      renderedAt: FIXED_ISO,
    }));

    for (const label of ["97 % av äkta fastprisavtal", "Solceller", "Lagring", "Laddningspunkt"]) {
      assert.ok(text.includes(label), "the PDF must render the Swedish label: " + label);
    }
    for (const rawEnum of ["FIXED_PRICE_97_PERCENT", "SOLAR", "STORAGE", "CHARGING"]) {
      assert.equal(text.includes(rawEnum), false, "the PDF must not expose the enum: " + rawEnum);
    }
  });
});

describe("Story 6.3 — renderQuotePdf branch coverage (empty/absent-field paths)", () => {
  test("[P2] empty lines / empty attachments / no warnings → renders with the fallback strings (no throw)", async () => {
    const vm = baseViewModel({ lines: [], attachments: [], warnings: [] });
    const text = await extractPdfText(await renderQuotePdf({ viewModel: vm, renderedAt: FIXED_ISO }));
    assert.ok(text.includes("Inga rader"), "empty lines render the 'no rows' fallback");
    assert.ok(text.includes("Inga bifogade filer"), "empty attachments render the 'no files' fallback");
  });

  test("[P2] no deduction type → the deduction total + ROT/grön block are OMITTED", async () => {
    const vm = baseViewModel({
      taxAssumptions: {
        vatRatePercent: "25",
        vatDisplay: null,
        deductionType: null,
        deductionRatePercent: null,
        deductionCapKronor: null,
        deductionPersons: null,
      },
    });
    const text = await extractPdfText(await renderQuotePdf({ viewModel: vm, renderedAt: FIXED_ISO }));
    assert.equal(text.includes("Avdrag (uppskattning)"), false, "with no deduction type the deduction line is omitted");
  });

  test("[P2] null company identity + null optional fields still render a valid PDF (no throw)", async () => {
    const vm = baseViewModel({
      companyName: null,
      companyOrgNr: null,
      companyAddressLine1: null,
      companyAddressLine2: null,
      companyPostalCode: null,
      companyCity: null,
      companyEmail: null,
      companyPhone: null,
      customerDisplayName: null,
      facilityName: null,
      contactName: null,
      quoteNumberDisplay: null,
      introText: null,
      customerNotes: null,
      termsText: null,
    });
    const bytes = await renderQuotePdf({ viewModel: vm, renderedAt: FIXED_ISO });
    assert.ok(bytes.length > 0, "a fully-null-identity view model must still render a valid PDF");
    // The header falls back to the "Offert" heading when companyName is null.
    const text = await extractPdfText(bytes);
    assert.ok(text.includes("Offert"), "the header falls back to 'Offert' when companyName is null");
  });

  test("[P2] svDate: null/unparseable validUntil → the em-dash fallback; a valid ISO → a stable sv-SE date", async () => {
    const nullDate = await extractPdfText(
      await renderQuotePdf({ viewModel: baseViewModel({ validUntil: null }), renderedAt: FIXED_ISO }),
    );
    assert.ok(nullDate.includes("Giltig till: —"), "a null validUntil renders the em-dash fallback");

    const badDate = await extractPdfText(
      await renderQuotePdf({ viewModel: baseViewModel({ validUntil: "not-a-date" }), renderedAt: FIXED_ISO }),
    );
    assert.ok(badDate.includes("Giltig till: —"), "an unparseable validUntil renders the em-dash fallback");

    const goodDate = await extractPdfText(
      await renderQuotePdf({ viewModel: baseViewModel({ validUntil: "2026-08-05" }), renderedAt: FIXED_ISO }),
    );
    // The sv-SE formatter (explicit locale, UTC tz) is host-independent → the date is stable.
    assert.ok(goodDate.includes("2026-08-05"), "a valid ISO date formats to a stable sv-SE date");
  });

  test("[P2] an OPTIONAL (tillval) line is marked in the rendered text", async () => {
    const vm = baseViewModel({
      lines: [
        {
          rowType: "material",
          sortOrder: 0,
          label: "Extra uttag",
          description: null,
          quoteNote: null,
          quantity: 1,
          unit: "st",
          unitSellKronor: "500,00",
          lineNetKronor: "500,00",
          vatRatePercent: "25",
          includedInInvoiceTotal: true,
          isHidden: false,
          isOptional: true,
          isSelected: true,
        },
      ],
    });
    const text = await extractPdfText(await renderQuotePdf({ viewModel: vm, renderedAt: FIXED_ISO }));
    assert.ok(text.includes("tillval"), "an optional line must be marked '(tillval)' in the PDF text");
    assert.ok(text.includes("ingår i totalsumman"), "invoice inclusion must be stated independently from selection");
    assert.ok(text.includes("Tillval som ingår (netto)"), "the subtotal label must describe inclusion, not selection");
  });
});

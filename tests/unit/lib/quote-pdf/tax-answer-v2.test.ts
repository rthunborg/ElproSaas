import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildTaxAnswerSnapshotV2,
  parseTaxInputSnapshot,
} from "@/lib/money";
import { buildQuotePdfViewModel } from "@/lib/quote-pdf";
import { buildQuoteVersionSnapshot } from "@/lib/quote-snapshot";
import { renderQuotePdf } from "@/server/quote-pdf/render";
import { extractPdfText } from "../../../support/pdf-text";

function reverseChargeSnapshot() {
  const taxInput = parseTaxInputSnapshot({
    schemaVersion: 2,
    documentVatType: "REVERSE_CHARGE_CONSTRUCTION",
    buyerVatNumber: "SE556677889901",
    deductionChoice: "NONE",
    paymentDate: null,
    finalPaymentDate: null,
    personAllowanceSlots: [],
    greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
    genuineFixedPrice: false,
    fixedPriceOre: null,
    fixedPriceCategorySplitOre: null,
  });
  if (!taxInput.ok) assert.fail(`tax input failed: ${taxInput.code}`);
  const answer = buildTaxAnswerSnapshotV2({
    rows: [
      {
        id: "standard",
        netOre: 100_000,
        vatType: "STANDARD_VAT_25",
        rateBp: 2_500,
        includedInInvoiceTotal: true,
        deductionClassification: "NONE",
        summaryCategory: "material",
      },
      {
        id: "reverse",
        netOre: 200_000,
        vatType: "REVERSE_CHARGE_CONSTRUCTION",
        rateBp: 2_500,
        includedInInvoiceTotal: true,
        deductionClassification: "NONE",
        summaryCategory: "labor",
      },
    ],
    taxInput: taxInput.value,
    quoteCaptureDate: "2026-08-05",
    customerEligibilityPosture: "company",
  });
  if (!answer.ok) assert.fail(`tax answer failed: ${answer.code}`);
  const frozen = answer.value;
  return buildQuoteVersionSnapshot(
    {
      calculationId: "calc-tax-pdf-v2",
      company: {
        company_name: "Example El AB",
        org_nr: "556000-0000",
        address_line1: null,
        address_line2: null,
        postal_code: null,
        city: null,
        email: "info@example.test",
        phone: null,
        logo_url: null,
      },
      customer: {
        customer_display_name: "Example Customer",
        customer_type: "company",
        facility_name: null,
        contact_name: null,
      },
      terms: null,
      totals: {
        baseTotalOre: frozen.netOre,
        optionTotalOre: 0,
        vatTotalOre: frozen.vatOre,
        deductionTotalOre: frozen.deductionOre,
        acceptedPriceOre: frozen.payableOre,
      },
      assumptions: {
        vatRateBp: 2_500,
        vatDisplay: "company_excl",
        deductionType: null,
        deductionRateBp: null,
        deductionCapOre: null,
        deductionPersons: null,
        requiresSignOff: true,
      },
      header: {
        quoteNumberDisplay: "106",
        validUntil: "2026-09-05",
        introText: null,
        customerNotes: null,
        displayMode: "detailed",
      },
      lines: [
        {
          rowType: "material",
          sortOrder: 0,
          label: "Standardrad",
          description: null,
          quoteNote: null,
          quantity: 1,
          unit: "st",
          unitSellOre: 100_000,
          lineNetOre: 100_000,
          vatRateBp: 2_500,
          includedInInvoiceTotal: true,
          deductionClassification: "NONE",
          vatType: "STANDARD_VAT_25",
          isHidden: false,
          isOptional: false,
          isSelected: null,
        },
        {
          rowType: "labor",
          sortOrder: 1,
          label: "Omvänd rad",
          description: null,
          quoteNote: null,
          quantity: 1,
          unit: "st",
          unitSellOre: 200_000,
          lineNetOre: 200_000,
          vatRateBp: 2_500,
          includedInInvoiceTotal: true,
          deductionClassification: "NONE",
          vatType: "REVERSE_CHARGE_CONSTRUCTION",
          isHidden: false,
          isOptional: false,
          isSelected: null,
        },
      ],
      attachments: [],
      warnings: [],
      snapshotSchemaVersion: 2,
      taxRuleVersion: frozen.taxRuleVersions.join("+"),
      taxAnswerSnapshot: frozen,
      buyerVatNumber: frozen.buyerVatNumber,
      calculatedDeductionOre: frozen.calculatedDeductionOre,
      claimDeductionOre: frozen.claimDeductionOre,
      payableOre: frozen.payableOre,
      netOre: frozen.netOre,
      vatOre: frozen.vatOre,
      grossOre: frozen.grossOre,
      deductionOre: frozen.deductionOre,
    },
    { capturedAt: "2026-08-05T09:00:00.000Z" },
  );
}

function historicalAllocationSnapshot() {
  const taxInput = parseTaxInputSnapshot({
    schemaVersion: 2,
    documentVatType: "STANDARD_VAT_25",
    buyerVatNumber: null,
    deductionChoice: "ROT",
    paymentDate: "2026-08-05",
    finalPaymentDate: null,
    personAllowanceSlots: [{
      slot: "PERSON_1",
      remainingRotAllowanceOre: 5_000_000,
      remainingCombinedRotRutAllowanceOre: 7_500_000,
    }],
    greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
    genuineFixedPrice: false,
    fixedPriceOre: null,
    fixedPriceCategorySplitOre: null,
  });
  if (!taxInput.ok) assert.fail(`legacy-allocation tax input failed: ${taxInput.code}`);
  const answer = buildTaxAnswerSnapshotV2({
    rows: [{
      id: "rot-labor",
      netOre: 100_000,
      vatType: "STANDARD_VAT_25",
      rateBp: 2_500,
      includedInInvoiceTotal: true,
      deductionClassification: "ROT_LABOR",
      summaryCategory: "labor",
    }],
    taxInput: taxInput.value,
    quoteCaptureDate: "2026-08-05",
    customerEligibilityPosture: "private",
  });
  if (!answer.ok) assert.fail(`legacy-allocation tax answer failed: ${answer.code}`);

  const historicalAnswer = JSON.parse(JSON.stringify(answer.value)) as Record<string, unknown>;
  const historicalRot = historicalAnswer.rot as Record<string, unknown>;
  const historicalAllocations = historicalRot.allocations as Array<Record<string, unknown>>;
  historicalAllocations[0].slot = "LegacyRawSlot";

  const snapshot = JSON.parse(JSON.stringify(reverseChargeSnapshot())) as Record<string, unknown>;
  Object.assign(snapshot, {
    customerType: "private",
    baseTotalOre: answer.value.netOre,
    optionTotalOre: 0,
    vatTotalOre: answer.value.vatOre,
    deductionTotalOre: answer.value.deductionOre,
    acceptedPriceOre: answer.value.payableOre,
    taxRuleVersion: answer.value.taxRuleVersions.join("+"),
    taxAnswerSnapshot: historicalAnswer,
    buyerVatNumber: answer.value.buyerVatNumber,
    calculatedDeductionOre: answer.value.calculatedDeductionOre,
    claimDeductionOre: answer.value.claimDeductionOre,
    payableOre: answer.value.payableOre,
    netOre: answer.value.netOre,
    vatOre: answer.value.vatOre,
    grossOre: answer.value.grossOre,
    deductionOre: answer.value.deductionOre,
    lines: [],
  });
  return snapshot;
}

describe("Story 10.6 — frozen V2 PDF consumption", () => {
  test("projects category totals, payable and exact reverse-charge metadata from the frozen answer", () => {
    const vm = buildQuotePdfViewModel(reverseChargeSnapshot());
    assert.equal(vm.reverseChargeText, "Omvänd betalningsskyldighet");
    assert.equal(vm.buyerVatNumber, "SE556677889901");
    assert.equal(vm.taxAnswer?.source, "v2");
    assert.equal(vm.taxAnswer?.payableKronor, "3 250,00");
    assert.deepEqual(vm.taxAnswer?.summaries, {
      labor: { netKronor: "2 000,00", vatKronor: "0,00", grossKronor: "2 000,00" },
      material: { netKronor: "1 000,00", vatKronor: "250,00", grossKronor: "1 250,00" },
      other: { netKronor: "0,00", vatKronor: "0,00", grossKronor: "0,00" },
    });
    assert.deepEqual(
      vm.taxAnswer?.categories.map((category) => ({
        type: category.vatType,
        net: category.netKronor,
        vat: category.vatKronor,
      })),
      [
        { type: "STANDARD_VAT_25", net: "1 000,00", vat: "250,00" },
        { type: "REVERSE_CHARGE_CONSTRUCTION", net: "2 000,00", vat: "0,00" },
      ],
    );
  });

  test("renders the exact reverse-charge wording, buyer VAT number and frozen category values", async () => {
    const vm = buildQuotePdfViewModel(reverseChargeSnapshot());
    const text = await extractPdfText(await renderQuotePdf({
      viewModel: vm,
      renderedAt: "2026-08-05T09:00:00.000Z",
    }));
    assert.ok(text.includes("Omvänd betalningsskyldighet"));
    assert.ok(text.includes("Köparens momsregistreringsnummer: SE556677889901"));
    assert.ok(text.includes("Omvänd betalningsskyldighet"));
    assert.ok(text.includes("Att betala: 3 250,00 kr"));
  });

  test("fails closed when a V2 answer is malformed instead of falling back to legacy math", () => {
    const snapshot = reverseChargeSnapshot();
    const malformed = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
    const taxAnswer = malformed.taxAnswerSnapshot as Record<string, unknown>;
    delete taxAnswer.summaries;
    assert.throws(
      () => buildQuotePdfViewModel(malformed as never),
      /Invalid V2 quote tax snapshot/,
    );
  });

  test("keeps a historical allocation readable while canonicalizing its raw id before PDF output", async () => {
    const vm = buildQuotePdfViewModel(historicalAllocationSnapshot() as never);
    assert.equal(vm.taxAnswer?.source, "v2");
    if (vm.taxAnswer?.source !== "v2") return;
    assert.deepEqual(vm.taxAnswer.rot.allocations, [
      { slot: "PERSON_1", kronor: "375,00" },
    ]);
    assert.equal(JSON.stringify(vm).includes("LegacyRawSlot"), false);

    const text = await extractPdfText(await renderQuotePdf({
      viewModel: vm,
      renderedAt: "2026-08-05T09:00:00.000Z",
    }));
    assert.ok(text.includes("Fördelning PERSON_1: 375,00 kr"));
    assert.equal(text.includes("LegacyRawSlot"), false);
  });
});

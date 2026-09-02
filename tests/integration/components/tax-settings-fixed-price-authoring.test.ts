import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { TaxSettingsPanel } from "@/components/calculations/TaxSettingsPanel";
import type { TaxInputSnapshotV2 } from "@/lib/money";

const ROW_ID = "11111111-1111-4111-8111-111111111111";

const FIXED_PRICE_INPUT: TaxInputSnapshotV2 = {
  schemaVersion: 2,
  documentVatType: "STANDARD_VAT_25",
  buyerVatNumber: null,
  deductionChoice: "GREEN",
  paymentDate: null,
  finalPaymentDate: "2026-08-31",
  personAllowanceSlots: [
    { slot: "PERSON_1", remainingGreenAllowanceOre: 5_000_000 },
  ],
  greenBasisMethod: "FIXED_PRICE_97_PERCENT",
  genuineFixedPrice: true,
  fixedPriceOre: 100_000,
  fixedPriceCategorySplitOre: {
    SOLAR: 100_000,
    STORAGE: 0,
    CHARGING: 0,
  },
  fixedPriceRowIds: [ROW_ID],
};

describe("TaxSettingsPanel — 97% fixed-price authoring surface", () => {
  it("renders the agreement, reconciling split, and persisted eligible row scope", () => {
    const html = renderToStaticMarkup(
      createElement(TaxSettingsPanel, {
        calculationId: "22222222-2222-4222-8222-222222222222",
        value: FIXED_PRICE_INPUT,
        fixedPriceScopeRows: [{ id: ROW_ID, label: "Solcellsinstallation" }],
      }),
    );

    expect(html).toContain("Fastprisunderlag (endast vid 97 %)");
    expect(html).toContain("inkl. moms (brutto, före 97 %)");
    expect(html).toMatch(
      /<input(?=[^>]*name="genuine_fixed_price")(?=[^>]*value="true")(?=[^>]*checked)[^>]*>/,
    );
    expect(html).toContain('name="fixed_price_kronor"');
    expect(html).toContain('name="fixed_solar_kronor"');
    expect(html).toMatch(
      new RegExp(
        `<input(?=[^>]*name="fixed_price_row_ids")(?=[^>]*value="${ROW_ID}")(?=[^>]*checked)[^>]*>`,
      ),
    );
    expect(html).not.toContain('data-testid="fixed-price-row-scope-error"');
  });
});

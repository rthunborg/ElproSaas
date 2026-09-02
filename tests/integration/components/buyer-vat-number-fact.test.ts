import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { BuyerVatNumberFact } from "@/components/quotes/BuyerVatNumberFact";

it("renders the frozen buyer VAT identifier with the requested review-surface id", () => {
  const html = renderToStaticMarkup(
    createElement(BuyerVatNumberFact, {
      value: "SE556677889901",
      testId: "preview-buyer-vat-number",
    }),
  );

  expect(html).toContain('data-testid="preview-buyer-vat-number"');
  expect(html).toContain("Köparens momsregistreringsnummer:");
  expect(html).toContain("SE556677889901");
});

it("is absent when no reverse-charge identifier was frozen", () => {
  expect(
    renderToStaticMarkup(
      createElement(BuyerVatNumberFact, {
        value: null,
        testId: "quote-buyer-vat-number",
      }),
    ),
  ).toBe("");
});

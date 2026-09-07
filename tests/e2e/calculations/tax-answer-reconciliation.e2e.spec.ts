/** Story 10.6 user-boundary acceptance journeys against the real app and local Supabase stack. */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { adminExec, closeAdminPool } from "../../factories/admin-sql";
import { extractPdfText } from "../../support/pdf-text";

interface TaxAnswerFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  readonly taxAnswer: {
    readonly reverseChargeCalc: {
      readonly id: string;
      readonly title: string;
      readonly sectionId: string;
      readonly rowIds: readonly [string, string];
      readonly buyerVatNumber: string;
      readonly expectedOre: { readonly net: number; readonly vat: number; readonly gross: number };
    };
    readonly independentPropertiesCalc: {
      readonly id: string;
      readonly title: string;
      readonly sectionId: string;
      readonly subjectRowId: string;
      readonly controlRowId: string;
      readonly expectedGrossOre: {
        readonly bothIncluded: number;
        readonly controlOnly: number;
      };
    };
  };
}

const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8"),
) as TaxAnswerFixture;

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "Logga in" });
  await waitForHydrated(submit);
  await page.getByLabel("E-post").fill(fixture.adminA.email);
  await page.getByLabel("Lösenord").fill(fixture.adminA.password);
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Wait until the client island has hydrated before triggering a server action. */
async function waitForHydrated(locator: Locator): Promise<void> {
  await locator.waitFor({ state: "visible" });
  await locator.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        const ready = () => Object.keys(element).some((key) => key.startsWith("__react"));
        const tick = () => (ready() ? resolve() : requestAnimationFrame(tick));
        tick();
      }),
  );
}

function waitForCalculationMutation(page: Page, calculationId: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/calculations/${calculationId}`),
  );
}

async function saveRow(page: Page, calculationId: string, form: Locator): Promise<void> {
  const button = form.getByRole("button", { name: "Spara rad" });
  await waitForHydrated(button);
  const response = waitForCalculationMutation(page, calculationId);
  await button.click();
  expect((await response).ok()).toBeTruthy();
  await expect(form.getByTestId("row-saved")).toBeVisible();
  // `row-saved` is the local action-state acknowledgement.  It does not prove
  // that the page-level totals have consumed the newly revalidated server
  // snapshot, and CI retries exposed stale form/totals combinations.  Reload
  // after persistence so every following assertion reads one coherent render.
  await page.reload();
  await expect(form).toHaveCount(1);
  await expect(page.getByTestId("totals-summary").first()).toBeVisible();
}

async function saveTaxSettings(
  page: Page,
  calculationId: string,
  settings: Locator,
): Promise<void> {
  const button = settings.getByRole("button", { name: "Spara skatte- och momsuppgifter" });
  await waitForHydrated(button);
  const response = waitForCalculationMutation(page, calculationId);
  await button.click();
  expect((await response).ok()).toBeTruthy();
  await expect(settings.getByRole("status")).toContainText("har sparats");
}

function rowForm(page: Page, rowId: string): Locator {
  return page
    .getByTestId("row-edit-form")
    .filter({ has: page.locator(`input[name="id"][value="${rowId}"]`) });
}

async function resetReverseChargeTaxInput(
  calculationId: string,
  buyerVatNumber: string,
): Promise<void> {
  try {
    await adminExec(
      `update public.calculations
       set tax_input_snapshot = $2::jsonb
       where id = $1`,
      [
        calculationId,
        JSON.stringify({
          schemaVersion: 2,
          documentVatType: "REVERSE_CHARGE_CONSTRUCTION",
          buyerVatNumber,
          deductionChoice: "NONE",
          paymentDate: null,
          finalPaymentDate: null,
          personAllowanceSlots: [],
          greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
          genuineFixedPrice: false,
          fixedPriceOre: null,
          fixedPriceCategorySplitOre: null,
          fixedPriceRowIds: null,
        }),
      ],
    );
  } finally {
    await closeAdminPool();
  }
}

test.describe("Story 10.6 — tax answer reconciliation", () => {
  test("[10.6-E2E-01][P1][AC3] explicit reverse charge rejects incomplete input, then PDF truth reconciles", async ({ page, request }) => {
    const calculation = fixture.taxAnswer.reverseChargeCalc;
    // The database permits only canonical buyer-VAT/document postures. Restore the valid
    // snapshot before every attempt so Playwright retries exercise the same form boundary.
    await resetReverseChargeTaxInput(calculation.id, calculation.buyerVatNumber);
    await signIn(page);
    await page.goto(`/calculations/${calculation.id}`);

    const settings = page.getByTestId("tax-document-settings");
    await expect(settings).toBeVisible();
    await expect(settings.getByLabel("Momshantering")).toHaveValue(
      "REVERSE_CHARGE_CONSTRUCTION",
    );
    const buyerVatNumber = settings.getByLabel("Köparens momsregistreringsnummer");
    await expect(buyerVatNumber).toHaveValue(calculation.buyerVatNumber);

    const readiness = page.getByTestId("readiness-summary").first();
    await expect(readiness).toHaveAttribute("data-can-create-quote", "true");

    await buyerVatNumber.fill("");
    const invalidSave = waitForCalculationMutation(page, calculation.id);
    await settings.getByRole("button", { name: "Spara skatte- och momsuppgifter" }).click();
    expect((await invalidSave).ok()).toBeTruthy();
    await expect(settings).toContainText(
      "Ange köparens momsregistreringsnummer vid omvänd betalningsskyldighet.",
    );
    await expect(readiness).toHaveAttribute("data-can-create-quote", "true");

    await settings.getByLabel("Köparens momsregistreringsnummer").fill(calculation.buyerVatNumber);
    await saveTaxSettings(page, calculation.id, settings);

    await expect(readiness).toHaveAttribute("data-can-create-quote", "true");
    await expect(page.getByTestId("readiness-blocker-MISSING_BUYER_VAT_NUMBER")).toHaveCount(0);

    await page.getByTestId("create-quote").first().click();
    const preview = page.getByTestId("pre-quote-preview").first();
    await expect(preview).toBeVisible();
    await expect(preview.getByTestId("preview-vat-category-standard")).toContainText("250,00");
    await expect(preview.getByTestId("preview-vat-category-reverse-charge")).toContainText("Omvänd betalningsskyldighet");
    await expect(preview.getByTestId("preview-net")).toContainText("3000,00");
    await expect(preview.getByTestId("preview-vat")).toContainText("250,00");
    await expect(preview.getByTestId("preview-gross")).toContainText("3250,00");
    await expect(preview.getByTestId("preview-summary-labor")).toContainText(
      "0,00 + 0,00 moms = 0,00 kr",
    );
    await expect(preview.getByTestId("preview-summary-material")).toContainText(
      "1000,00 + 250,00 moms = 1250,00 kr",
    );
    await expect(preview.getByTestId("preview-summary-other")).toContainText(
      "2000,00 + 0,00 moms = 2000,00 kr",
    );

    const quoteNavigation = page.waitForURL(/\/quotes\/[^/]+\/versions\/[^/]+$/);
    await preview.getByTestId("confirm-create-quote-version").click();
    await quoteNavigation;

    const pdfPanel = page.getByTestId("quote-pdf-status");
    await expect(pdfPanel).toHaveAttribute("data-pdf-status", "not_generated");
    const generatePdf = pdfPanel.getByRole("button", { name: /generera pdf/i });
    await waitForHydrated(generatePdf);
    const pdfResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes("/quotes/"),
    );
    await generatePdf.click();
    expect((await pdfResponse).ok()).toBeTruthy();
    await expect(pdfPanel).toHaveAttribute("data-pdf-status", "generated");

    // The generated state intentionally exposes a signed URL only after the real preview action.
    const signResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes("/quotes/"),
    );
    const previewPdf = pdfPanel.getByRole("button", { name: /förhandsgranska/i });
    await waitForHydrated(previewPdf);
    await previewPdf.click();
    expect((await signResponse).ok()).toBeTruthy();

    const download = page.getByTestId("quote-pdf-download");
    await expect(download).toBeVisible();
    const href = await download.getAttribute("href");
    expect(href).toBeTruthy();
    const downloaded = await request.get(href!);
    expect(downloaded.ok()).toBeTruthy();
    const pdfText = (await extractPdfText(new Uint8Array(await downloaded.body())))
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    expect(pdfText).toContain("Omvänd betalningsskyldighet");
    expect(pdfText).toContain(calculation.buyerVatNumber);
    expect(pdfText).toContain("Att betala: 3 250,00 kr");
    expect(pdfText).toContain("Standardmoms");
    expect(pdfText).toContain("25 %");
    expect(pdfText).toContain("netto 1 000,00 kr, moms 250,00 kr, brutto 1 250,00 kr");
    expect(pdfText).toContain("Omvänd betalningsskyldighet");
    expect(pdfText).toContain("netto 2 000,00 kr, moms 0,00 kr, brutto 2 000,00 kr");
  });

  test("[10.6-E2E-02][P1][AC2] visibility, invoice inclusion, and classification remain independent", async ({ page }) => {
    const calculation = fixture.taxAnswer.independentPropertiesCalc;
    await signIn(page);
    await page.goto(`/calculations/${calculation.id}`);

    const subject = rowForm(page, calculation.subjectRowId);
    await expect(subject).toHaveCount(1);
    const hidden = subject.getByRole("checkbox", { name: "Dold rad" });
    const included = subject.getByRole("checkbox", { name: "Ingår i fakturasumman" });
    const classification = subject.getByLabel("Avdragsklassificering");
    const gross = page.getByTestId("totals-summary").first().getByTestId("summary-gross");

    // Restore the fixture facts first so the journey is deterministic on a CI retry.
    await hidden.check();
    await included.check();
    await classification.selectOption("ROT_LABOR");
    await saveRow(page, calculation.id, subject);

    await expect(hidden).toBeChecked();
    await expect(included).toBeChecked();
    await expect(classification).toHaveValue("ROT_LABOR");
    await expect(gross).toContainText("1875,00");

    await hidden.uncheck();
    await saveRow(page, calculation.id, subject);
    await expect(included).toBeChecked();
    await expect(classification).toHaveValue("ROT_LABOR");
    await expect(gross).toContainText("1875,00");

    await included.uncheck();
    await saveRow(page, calculation.id, subject);
    await expect(hidden).not.toBeChecked();
    await expect(classification).toHaveValue("ROT_LABOR");
    await expect(gross).toContainText("625,00");

    await classification.selectOption("NONE");
    await saveRow(page, calculation.id, subject);
    await expect(hidden).not.toBeChecked();
    await expect(included).not.toBeChecked();
    await expect(gross).toContainText("625,00");
  });
});

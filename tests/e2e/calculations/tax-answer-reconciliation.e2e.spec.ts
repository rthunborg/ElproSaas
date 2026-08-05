/** Story 10.6 user-boundary acceptance journeys. Active and intentionally red before UI/seed work. */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { extractPdfText } from "../../support/pdf-text";

interface TaxAnswerFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  readonly taxAnswer: {
    readonly reverseChargeCalc: { readonly id: string; readonly buyerVatNumber: string };
    readonly independentPropertiesCalc: { readonly id: string };
  };
}

const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8"),
) as TaxAnswerFixture;

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(fixture.adminA.email);
  await page.getByLabel("Lösenord").fill(fixture.adminA.password);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

function waitForCalculationMutation(page: Page, calculationId: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/calculations/${calculationId}`),
  );
}

async function saveRow(page: Page, calculationId: string, form: Locator): Promise<void> {
  const response = waitForCalculationMutation(page, calculationId);
  await form.getByRole("button", { name: "Spara rad" }).click();
  expect((await response).ok()).toBeTruthy();
  await expect(form.getByTestId("row-saved")).toBeVisible();
}

test.describe("Story 10.6 — tax answer reconciliation", () => {
  test("[10.6-E2E-01][P1][AC3] explicit reverse charge gates readiness, then PDF truth reconciles", async ({ page, request }) => {
    const calculation = fixture.taxAnswer.reverseChargeCalc;
    await signIn(page);
    await page.goto(`/calculations/${calculation.id}`);

    const settings = page.getByTestId("tax-document-settings");
    await expect(settings).toBeVisible();
    await settings.getByLabel("Momshantering").selectOption("REVERSE_CHARGE_CONSTRUCTION");

    const firstSave = waitForCalculationMutation(page, calculation.id);
    await settings.getByRole("button", { name: "Spara skatte- och momsuppgifter" }).click();
    expect((await firstSave).ok()).toBeTruthy();

    const readiness = page.getByTestId("readiness-summary").first();
    await expect(readiness).toHaveAttribute("data-can-create-quote", "false");
    await expect(page.getByTestId("readiness-blocker-MISSING_BUYER_VAT_NUMBER").first()).toBeVisible();
    await expect(page.getByTestId("create-quote").first()).toBeDisabled();

    await settings.getByLabel("Köparens momsregistreringsnummer").fill(calculation.buyerVatNumber);
    const secondSave = waitForCalculationMutation(page, calculation.id);
    await settings.getByRole("button", { name: "Spara skatte- och momsuppgifter" }).click();
    expect((await secondSave).ok()).toBeTruthy();

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

    const quoteNavigation = page.waitForURL(/\/quotes\/[^/]+\/versions\/[^/]+$/);
    await preview.getByTestId("confirm-create-quote-version").click();
    await quoteNavigation;

    const pdfPanel = page.getByTestId("quote-pdf-status");
    const pdfResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes("/quotes/"),
    );
    await pdfPanel.getByRole("button", { name: /generera pdf/i }).click();
    expect((await pdfResponse).ok()).toBeTruthy();
    await expect(pdfPanel).toContainText(/pdf genererad/i);

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
    expect(pdfText).toMatch(/Totalt.*3 000,00.*250,00.*3 250,00/);
  });

  test("[10.6-E2E-02][P1][AC2] visibility, invoice inclusion, and classification remain independent", async ({ page }) => {
    const calculation = fixture.taxAnswer.independentPropertiesCalc;
    await signIn(page);
    await page.goto(`/calculations/${calculation.id}`);

    const subject = page.getByTestId("row-edit-form").first();
    const hidden = subject.getByRole("checkbox", { name: "Dold rad" });
    const included = subject.getByRole("checkbox", { name: "Ingår i fakturasumman" });
    const classification = subject.getByLabel("Avdragsklassificering");
    const gross = page.getByTestId("totals-summary").first().getByTestId("summary-gross");

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

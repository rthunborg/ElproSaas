/** Story 10.5 ATDD RED: retry isolation for existing mutating follow-up journeys. */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface RetryTarget { readonly id: string; readonly sentVersionId: string }
interface Fixture {
  readonly adminA: { readonly email: string; readonly password: string };
  readonly followUpQuoteAttempts?: ReadonlyArray<RetryTarget>;
  readonly completeFollowUpQuoteAttempts?: ReadonlyArray<RetryTarget>;
}

const fixturePath = path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json");
const fixture: Fixture = existsSync(fixturePath)
  ? (JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture)
  : { adminA: { email: "", password: "" } };

async function waitForHydrated(locator: Locator): Promise<void> {
  await locator.waitFor({ state: "visible" });
  await locator.evaluate((element) => new Promise<void>((resolve) => {
    const tick = () => Object.keys(element).some((key) => key.startsWith("__react"))
      ? resolve() : requestAnimationFrame(tick);
    tick();
  }));
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "Logga in" });
  await waitForHydrated(submit);
  await page.getByLabel("E-post").fill(fixture.adminA.email);
  await page.getByLabel("Lösenord").fill(fixture.adminA.password);
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.skip("[P1][10.5-E2E-02] a retry plans a follow-up on its own untouched sent quote and proves the chip", async ({ page }, testInfo) => {
  const quote = fixture.followUpQuoteAttempts?.[testInfo.retry];
  expect(quote, "global setup must seed one no-follow-up quote per Playwright attempt").toBeTruthy();
  await signIn(page);
  await page.goto(`/quotes/${quote!.id}/versions/${quote!.sentVersionId}`);
  const plan = page.getByRole("button", { name: /Planera uppföljning/i });
  await waitForHydrated(plan);
  await plan.click();
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: /Planera|Spara|Bekräfta/i });
  await expect(confirm).toBeDisabled();
  const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await dialog.getByLabel(/Förfallodatum|Datum/i).fill(due);
  await dialog.getByLabel(/Notering|Anteckning/i).fill("ring kund om beslut");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByTestId("next-follow-up-chip")).toBeVisible();
});

test.skip("[P1][10.5-E2E-03] a retry completes its own open follow-up and retains decide-here assertions", async ({ page }, testInfo) => {
  const quote = fixture.completeFollowUpQuoteAttempts?.[testInfo.retry];
  expect(quote, "global setup must seed one open-follow-up quote per Playwright attempt").toBeTruthy();
  await signIn(page);
  await page.goto(`/quotes/${quote!.id}/versions/${quote!.sentVersionId}`);
  const complete = page.getByRole("button", { name: /Klarmarkera/i });
  await waitForHydrated(complete);
  await complete.click();
  const sheet = page.getByRole("dialog");
  const confirm = sheet.getByRole("button", { name: /Klarmarkera|Spara|Bekräfta/i });
  await expect(confirm).toBeDisabled();
  await sheet.getByLabel(/Utfall|Resultat|Notering/i).fill("kund vill ha ny version");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  const jumps = page.getByTestId("follow-up-jumps");
  await expect(jumps.getByRole("button", { name: /planera nästa/i })).toBeVisible();
  await expect(jumps.getByRole("button", { name: /Markera som förlorad\/avböjd/i })).toBeVisible();
  await expect(jumps.getByRole("button", { name: /Ny version/i })).toBeVisible();
});

/** Story 10.5 ATDD RED: retry isolation for the existing lost-reason journey. */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface RetryTarget { readonly id: string; readonly sentVersionId: string }
interface Fixture {
  readonly adminA: { readonly email: string; readonly password: string };
  readonly markLostQuoteAttempts?: ReadonlyArray<RetryTarget>;
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

test.skip("[P1][10.5-E2E-01] each retry uses a fresh lost-reason target and still proves the terminal result", async ({ page }, testInfo) => {
  const quote = fixture.markLostQuoteAttempts?.[testInfo.retry];
  expect(quote, "global setup must seed one untouched sent quote per Playwright attempt").toBeTruthy();
  await signIn(page);
  await page.goto(`/quotes/${quote!.id}/versions/${quote!.sentVersionId}`);
  const markLost = page.getByRole("button", { name: /Markera som förlorad\/avböjd/i });
  await waitForHydrated(markLost);
  await markLost.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: /Avböjd/i }).check();
  await dialog.getByLabel(/Orsak|Kategori/i).selectOption({ label: "Pris" });
  await dialog.getByRole("button", { name: /Bekräfta|Markera/i }).click();
  const snapshot = page.getByTestId("quote-version-snapshot");
  await expect(snapshot.getByTestId("quote-status-badge")).toHaveText(/Förlorad\/Avböjd/i);
  await expect(page.getByTestId("quote-lost-reason")).toContainText(/Avböjd/i);
  await expect(page.getByRole("region", { name: /Händelser/i })).toContainText(/Förlorad\/Avböjd/i);
});

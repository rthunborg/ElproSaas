import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type UnsubscribeFixture = { readonly emailActivation: { readonly unsubscribe: { readonly activeToken: string; readonly revokedToken: string; readonly unknownToken: string; readonly rateLimitedToken: string } } };
let cachedFixture: UnsubscribeFixture | undefined;
function fixture(): UnsubscribeFixture { cachedFixture ??= JSON.parse(readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8")) as UnsubscribeFixture; return cachedFixture; }

test.describe("Story 13.4 Public unsubscribe capability (ATDD RED)", () => {
  test.skip("[P0] an anonymous recipient can unsubscribe through a valid scoped token without loading the authenticated shell", async ({ page }) => {
    await page.goto(`/unsubscribe/${fixture().emailActivation.unsubscribe.activeToken}`);
    await expect(page.getByRole("heading", { name: /e-postinställningar/i })).toBeVisible(); await expect(page.getByRole("button", { name: /avregistrera/i })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Huvudnavigation" })).toHaveCount(0); await expect(page.getByRole("link", { name: /logga in|dashboard|notiser/i })).toHaveCount(0);
    const completed = page.waitForResponse((response) => response.url().includes("/unsubscribe/") && response.request().method() === "POST" && response.ok());
    await page.getByRole("button", { name: /avregistrera/i }).click(); await completed;
    await expect(page.getByRole("status")).toContainText(/avregistrerad/i); await expect(page.getByRole("button", { name: /återaktivera|prenumerera igen/i })).toBeVisible();
  });

  test.skip("[P1] unknown and revoked public tokens receive one uniform inactive response with no tenant or recipient disclosure", async ({ page }) => {
    for (const token of [fixture().emailActivation.unsubscribe.unknownToken, fixture().emailActivation.unsubscribe.revokedToken]) {
      await page.goto(`/unsubscribe/${token}`); await expect(page.getByRole("heading", { name: /länken är inte längre aktiv/i })).toBeVisible();
      await expect(page.getByText(/tenant|kund|mottagare|@/i)).toHaveCount(0); await expect(page.getByRole("navigation", { name: "Huvudnavigation" })).toHaveCount(0);
    }
  });

  test.skip("[P1] a rate-limited anonymous token request gives retry guidance without exposing subscription data", async ({ page }) => {
    await page.goto(`/unsubscribe/${fixture().emailActivation.unsubscribe.rateLimitedToken}`);
    const limited = page.waitForResponse((response) => response.url().includes("/unsubscribe/") && response.status() === 429);
    await page.getByRole("button", { name: /avregistrera/i }).click(); await limited;
    await expect(page.getByRole("alert")).toContainText(/för många försök.*försök igen senare/i); await expect(page.getByText(/tenant|kund|mottagare|@/i)).toHaveCount(0);
  });
});

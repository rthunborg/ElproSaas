/** Story 11.2 ATDD RED scaffold; role-aware browser seeds land with the feature. */
import { expect, test, type Page } from "@playwright/test";

const SALJARE_EMAIL = "role-aware.saljare@example.test";
const MONTOR_EMAIL = "role-aware.montor@example.test";
const PASSWORD = "RoleAwarePass123!";
const SALJARE_GRANTED_NAV = ["/dashboard", "/customers", "/quotes"];

async function logIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord").fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();
}

test.describe("Story 11.2 rollstyrda Phase A-ytor (ATDD RED)", () => {
  test.skip("[P0] Säljare receives only matrix-granted server navigation and lands on dashboard", async ({ page }) => {
    await logIn(page, SALJARE_EMAIL);

    await expect(page).toHaveURL(/\/dashboard$/);
    const nav = page.getByRole("navigation", { name: "Huvudnavigation" }).first();
    await expect(nav).toBeVisible();
    const hrefs = await nav.getByRole("link").evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")),
    );
    expect(hrefs).toEqual(SALJARE_GRANTED_NAV);
  });

  test.skip("[P0] Montör direct navigation to active but ungranted settings has one generic denial and no data", async ({ page }) => {
    await logIn(page, MONTOR_EMAIL);
    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Ingen åtkomst" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Huvudnavigation" }).first();
    await expect(nav.getByRole("link", { name: "Inställningar" })).toHaveCount(0);
    const main = page.getByRole("main");
    await expect(main.getByRole("table")).toHaveCount(0);
    await expect(main.getByRole("textbox")).toHaveCount(0);
  });

  test.skip("[P0] Montör lands on the E15-safe dashboard fallback with monetary values withheld", async ({ page }) => {
    await logIn(page, MONTOR_EMAIL);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/SEK|kr/)).toHaveCount(0);
    await expect(page.getByText(/omsättning|marginal|intäkt/i)).toHaveCount(0);
  });

  test.skip("[P1] Säljare can open its matrix-granted customers route without receiving cost or margin", async ({ page }) => {
    await logIn(page, SALJARE_EMAIL);
    await page.goto("/customers");

    await expect(page).toHaveURL(/\/customers$/);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/självkostnad|täckningsbidrag|marginal/i)).toHaveCount(0);
  });
});

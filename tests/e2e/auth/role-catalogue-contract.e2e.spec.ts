import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// playwright-utils deviation: @seontechnologies/playwright-utils is absent from the package manifest and lockfile; use the configured Playwright package until framework adoption is approved.
type RoleFixture = { readonly email: string; readonly password: string };
type Fixture = {
  readonly adminUserManagement: {
    readonly tenantAdmin: RoleFixture;
  };
};

function getFixture(): Fixture {
  return JSON.parse(readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8"));
}

async function waitForHydrated(locator: Locator): Promise<void> {
  await locator.waitFor({ state: "visible" });
  await locator.evaluate((element) => new Promise<void>((resolve) => {
    const tick = () => Object.keys(element).some((key) => key.startsWith("__react")) ? resolve() : requestAnimationFrame(tick);
    tick();
  }));
}

async function logIn(page: Page, credentials: RoleFixture): Promise<void> {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "Logga in" });
  await waitForHydrated(submit);
  await page.getByLabel("E-post").fill(credentials.email);
  await page.getByLabel("Lösenord").fill(credentials.password);
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("Story 11.4 rollkatalogens serverpresenterade kontrakt", () => {
  test("[P1] Admin can inspect every role's Swedish catalogue card, wave, and sensitive entitlement", async ({ page }) => {
    const fixture = getFixture();
    await logIn(page, fixture.adminUserManagement.tenantAdmin);
    await page.goto("/admin/users");

    await page.getByRole("tab", { name: "Roller" }).click();

    for (const role of [
      ["Företagsadmin", "Administrerar företaget, användare och behörigheter."],
      ["Projektledare", "Planerar och driver företagets projekt och offerter."],
      ["Montör", "Har åtkomst till det arbete som rollen är behörig till."],
      ["Säljare", "Arbetar med kunder och offerter utan kostnads- och marginalvärden."],
      ["Ekonomi", "Har insyn i försäljningspriser, kostnader och marginaler."],
    ] as const) {
      const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: role[0], exact: true }) });
      await expect(card.getByText(role[1], { exact: true })).toBeVisible();
      await expect(card.getByText(/^Aktiva medlemmar: \d+$/)).toBeVisible();
    }

    const adminCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Företagsadmin", exact: true }) });
    await expect(adminCard.getByText("RBAC & Admin User Management (B1a) · Memberships.Manage", { exact: true })).toBeVisible();
    await expect(adminCard.getByText(/Känsliga fält:.*quotes\.sales_price_ore/)).toBeVisible();
  });
});

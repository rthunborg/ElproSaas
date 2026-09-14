import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// playwright-utils deviation: @seontechnologies/playwright-utils is absent from the package manifest and lockfile; use the configured Playwright package until framework adoption is approved.
type RoleFixture = { readonly email: string; readonly password: string };
type Fixture = {
  readonly adminUserManagement: {
    readonly tenantAdmin: RoleFixture;
    readonly nonAdmin: RoleFixture;
    readonly sharedAccount: RoleFixture;
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

async function openAdminUsers(page: Page): Promise<void> {
  const adminUsersDocument = page.waitForResponse((response) =>
    response.request().resourceType() === "document"
    && new URL(response.url()).pathname === "/admin/users"
    && response.ok(),
  );
  await page.goto("/admin/users");
  await adminUsersDocument;
}

test.describe("Story 11.4 Roller och effektiva behörigheter (ATDD, RED)", () => {
  test("[P1] Admin can inspect the five role cards and active-member presentation", async ({ page }) => {
    const fixture = getFixture();
    await logIn(page, fixture.adminUserManagement.tenantAdmin);
    await openAdminUsers(page);

    const rolesTab = page.getByRole("tab", { name: "Roller" });
    await waitForHydrated(rolesTab);
    await rolesTab.click();
    await expect(page.getByText(/^Aktiva medlemmar: \d+$/)).toHaveCount(5);
    await expect(page.getByText(/Arbetsledare.*inom ett jobb|inom ett jobb.*Arbetsledare/i)).toBeVisible();
    await expect(page.getByText(/beslut.*ägare|ägare.*beslut/i)).toHaveCount(0);
  });

  test("[P1] Admin can open a multi-role member's effective permissions viewer", async ({ page }) => {
    const fixture = getFixture();
    await logIn(page, fixture.adminUserManagement.tenantAdmin);
    await openAdminUsers(page);

    const sharedAccount = page.getByText(fixture.adminUserManagement.sharedAccount.email, { exact: true });
    await waitForHydrated(sharedAccount);
    await sharedAccount.click();
    const effectivePermissions = page.getByRole("button", { name: "Effektiva behörigheter" });
    await waitForHydrated(effectivePermissions);
    await effectivePermissions.click();
    await expect(page.getByRole("heading", { name: "Effektiva behörigheter" })).toBeVisible();
    await expect(page.getByText(/beviljas av/i).first()).toBeVisible();
  });

  test("[P1] Non-Admin receives neither Roles UI nor the Admin users direct route", async ({ page }) => {
    const fixture = getFixture();
    await logIn(page, fixture.adminUserManagement.nonAdmin);
    await openAdminUsers(page);

    await expect(page.getByRole("heading", { name: "Ingen åtkomst" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Roller" })).toHaveCount(0);
    await expect(page.getByText("Aktiva medlemmar", { exact: true })).toHaveCount(0);
  });
});

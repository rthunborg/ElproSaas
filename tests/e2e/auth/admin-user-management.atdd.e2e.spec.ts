import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

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

test.describe("Story 11.3 administrativ användarhantering", () => {
  test("[P0] Admin can reach Användare & roller and inspect membership history", async ({ page }) => {
    const fixture = getFixture();
    await logIn(page, fixture.adminUserManagement.tenantAdmin);
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Användare & roller" })).toBeVisible();
    const history = page.getByRole("link", { name: "Händelser" }).first();
    await expect(history).toBeVisible();
    await history.click();
    await expect(page.getByRole("heading", { name: "Händelser" })).toBeVisible();
    await expect(page.getByText(/tar bort åtkomsten för detta företag/i)).toBeVisible();
  });

  test("[P1] Non-Admin receives neither Users navigation nor the Admin users direct route", async ({ page }) => {
    const fixture = getFixture();
    await logIn(page, fixture.adminUserManagement.nonAdmin);
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Ingen åtkomst" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Användare & roller" })).toHaveCount(0);
  });

  test("[P1] Admin invite dialog validates the email before an invitation can be sent", async ({ page }) => {
    const fixture = getFixture();
    await logIn(page, fixture.adminUserManagement.tenantAdmin);
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Bjud in användare" }).click();

    const dialog = page.getByRole("dialog", { name: "Bjud in användare" });
    const email = dialog.getByLabel("E-post");
    await expect(dialog.getByLabel("Företagsadmin")).toBeVisible();
    await expect(dialog.getByLabel("Projektledare")).toBeVisible();

    await email.fill("not-an-email");
    await dialog.getByRole("button", { name: "Skicka inbjudan" }).click();
    expect(await email.evaluate((element) => (element as HTMLInputElement).checkValidity())).toBe(false);
    await expect(dialog).toBeVisible();
  });
});

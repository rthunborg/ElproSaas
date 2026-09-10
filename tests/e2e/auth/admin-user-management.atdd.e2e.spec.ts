/** Story 11.3 RED browser ATDD scaffold for the Admin-only user-management surface. */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type RoleFixture = {
  readonly email: string;
  readonly password: string;
};
type Fixture = {
  readonly adminUserManagement: {
    readonly tenantAdmin: RoleFixture;
    readonly nonAdmin: RoleFixture;
    readonly sharedAccount: RoleFixture;
  };
};

function getFixture(): Fixture {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8"),
  );
}

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
  test.skip("[P0] Admin completes the membership lifecycle and sees every server-confirmed outcome in Händelser", async ({ page }) => {
    const fixture = getFixture();
    await logIn(page, fixture.adminUserManagement.tenantAdmin);
    await page.goto("/admin/users");

    await expect(page.getByRole("heading", { name: "Användare & roller" })).toBeVisible();
    await page.getByRole("button", { name: /bjud in/i }).click();
    await page.getByLabel(/e-post/i).fill("new.member@example.test");
    await page.getByRole("button", { name: /skicka inbjudan/i }).click();
    await expect(page.getByRole("status")).toContainText(/inbjudan.*(skickad|registrerad)/i);
    await page.getByRole("button", { name: /skicka igen/i }).click();
    await expect(page.getByRole("status")).toContainText(/uppdaterad|skickad/i);
    await page.getByRole("button", { name: /återkalla/i }).click();
    await expect(page.getByRole("status")).toContainText(/återkallad/i);
    await page.getByRole("button", { name: /återställ/i }).click();
    await expect(page.getByRole("status")).toContainText(/återställ/i);
    await page.getByRole("button", { name: /inaktivera/i }).click();
    await expect(page.getByRole("status")).toContainText(/inaktiverad/i);
    await page.getByRole("button", { name: /återaktivera/i }).click();
    await expect(page.getByRole("status")).toContainText(/återaktiverad/i);
    await page.getByRole("button", { name: /ändra roller/i }).click();
    await page.getByLabel(/orsak/i).fill("Behörighetsändring");
    await page.getByRole("button", { name: /spara roller/i }).click();
    await expect(page.getByRole("status")).toContainText(/roller.*uppdaterade/i);
    await page.getByRole("button", { name: /avsluta/i }).click();
    await expect(page.getByRole("status")).toContainText(/avslutad/i);
    await expect(page.getByRole("region", { name: "Händelser" })).toContainText(
      /inbjudan|återkallad|inaktiverad|roller|avslutad/i,
    );
  });

  test.skip("[P1] Non-Admin receives neither Users navigation nor the Admin users direct route", async ({ page }) => {
    const fixture = getFixture();
    await logIn(page, fixture.adminUserManagement.nonAdmin);
    const nav = page.getByRole("navigation", { name: "Huvudnavigation" }).first();
    await expect(nav.getByRole("link", { name: "Användare & roller" })).toHaveCount(0);
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Ingen åtkomst" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("table")).toHaveCount(0);
  });

  test.skip("[P0] Server-confirmed lifecycle failure leaves the last active Admin visibly active", async ({ page }) => {
    const fixture = getFixture();
    await logIn(page, fixture.adminUserManagement.tenantAdmin);
    await page.goto("/admin/users");
    await page.getByRole("button", { name: /inaktivera/i }).click();
    await expect(page.getByRole("alert")).toContainText(/sista aktiva administratör|kan inte/i);
    await expect(page.getByRole("status")).toContainText(/aktiv/i);
    await expect(page.getByRole("region", { name: "Händelser" })).not.toContainText(/inaktiverad|avslutad/i);
  });

  test.skip("[P0] Disabling a shared account removes access only for this tenant and preserves its history", async ({ page }) => {
    const fixture = getFixture();
    await logIn(page, fixture.adminUserManagement.tenantAdmin);
    await page.goto("/admin/users");
    await page.getByRole("row", { name: /shared account/i }).getByRole("button", { name: /inaktivera/i }).click();
    await expect(page.getByRole("status")).toContainText(/inaktiverad.*detta företag/i);
    await expect(page.getByRole("region", { name: "Händelser" })).toContainText(/inaktiverad/i);
    await logIn(page, fixture.adminUserManagement.sharedAccount);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

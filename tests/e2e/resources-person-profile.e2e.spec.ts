/**
 * Story 14.1 ATDD red-phase UI scaffold. Selectors are deliberate implementation
 * contracts because the nav-less resource maintenance panel does not exist yet.
 */
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type RoleFixture = { readonly email: string; readonly password: string };
type Fixture = {
  readonly adminUserManagement: {
    readonly tenantAdmin: RoleFixture;
    readonly resourceProfileMembershipId: string;
    readonly deactivatedResourceProfileMembershipId: string;
  };
};

function getFixture(): Fixture {
  return JSON.parse(readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8"));
}

async function logIn(page: import("@playwright/test").Page, credentials: RoleFixture): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(credentials.email);
  await page.getByLabel("Lösenord").fill(credentials.password);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.skip("[P0] admin persists a same-tenant role and schedule inputs in the existing user-detail route, then reloads server state", async ({ page }) => {
  const fixture = getFixture();
  await logIn(page, fixture.adminUserManagement.tenantAdmin);
  await page.goto(`/admin/users/${fixture.adminUserManagement.resourceProfileMembershipId}`);

  await page.getByTestId("resource-default-work-role").selectOption({ label: "Elektriker" });
  await page.getByTestId("resource-weekday-1-start").fill("07:00");
  await page.getByTestId("resource-weekday-1-end").fill("16:00");
  await page.getByTestId("resource-break-1-start").fill("12:00");
  await page.getByTestId("resource-break-1-end").fill("12:30");
  await page.getByTestId("resource-exception-date").fill("2026-10-15");
  await page.getByTestId("resource-calendar-day-reduction").fill("50");
  await page.getByTestId("resource-save").click();

  await expect(page.getByTestId("resource-save-status")).toHaveText(/sparats/i);
  await page.reload();
  await expect(page.getByTestId("resource-weekday-1-start")).toHaveValue("07:00");
  await expect(page.getByTestId("resource-calendar-day-reduction")).toHaveValue("50");
});

test.skip("[P1] admin sees a deactivated profile as Inaktiverad without booking or reassignment affordances", async ({ page }) => {
  const fixture = getFixture();
  await logIn(page, fixture.adminUserManagement.tenantAdmin);
  await page.goto(`/admin/users/${fixture.adminUserManagement.deactivatedResourceProfileMembershipId}`);

  await expect(page.getByTestId("resource-profile-status")).toHaveText("Inaktiverad");
  await expect(page.getByTestId("resource-booking-action")).toHaveCount(0);
  await expect(page.getByTestId("resource-reassignment-action")).toHaveCount(0);
});

test.skip("[P0] at 360×640 a server-observable transient save failure retains unsent input and succeeds only after retry", async ({ page }) => {
  const fixture = getFixture();
  await page.setViewportSize({ width: 360, height: 640 });
  await logIn(page, fixture.adminUserManagement.tenantAdmin);
  await page.goto(`/admin/users/${fixture.adminUserManagement.resourceProfileMembershipId}?resourceSaveFailure=once`);

  await page.getByTestId("resource-weekday-1-start").fill("08:00");
  await page.getByTestId("resource-save").click();
  await expect(page.getByTestId("resource-save-error")).toHaveText(/försök igen/i);
  await expect(page.getByTestId("resource-save-status")).toHaveCount(0);
  await expect(page.getByTestId("resource-weekday-1-start")).toHaveValue("08:00");

  await page.getByTestId("resource-retry-save").click();
  await expect(page.getByTestId("resource-save-status")).toHaveText(/sparats/i);
});

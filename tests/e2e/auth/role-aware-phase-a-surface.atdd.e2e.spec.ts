/** Story 11.2 browser ATDD against the real server-derived navigation and local role fixture. */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type RoleFixture = {
  readonly email: string;
  readonly password: string;
};
type Fixture = {
  readonly roleAware: {
    readonly saljare: RoleFixture;
    readonly montor: RoleFixture;
  };
};

const fixture: Fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8"),
);

const SALJARE_GRANTED_NAV = ["/dashboard", "/customers", "/quotes"];

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
  // Login writes the cookie in the client-side callback before routing. Wait for
  // the server-confirmed landing before a test performs a direct navigation, or
  // that navigation can race the cookie write and be redirected back to /login.
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("Story 11.2 rollstyrda Phase A-ytor", () => {
  test("[P0] Säljare receives only matrix-granted server navigation and lands on dashboard", async ({ page }) => {
    await logIn(page, fixture.roleAware.saljare);

    await expect(page).toHaveURL(/\/dashboard$/);
    const nav = page.getByRole("navigation", { name: "Huvudnavigation" }).first();
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(SALJARE_GRANTED_NAV.length);
    await expect(
      nav.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ).resolves.toEqual(SALJARE_GRANTED_NAV);
  });

  test("[P0] Montör direct navigation to active but ungranted settings has one generic denial and no data", async ({ page }) => {
    await logIn(page, fixture.roleAware.montor);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/settings");

    const denial = page.getByRole("heading", { name: "Ingen åtkomst" });
    await expect(denial).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Ingen åtkomst" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Huvudnavigation" }).first();
    await expect(nav.getByRole("link", { name: "Inställningar" })).toHaveCount(0);
    const main = page.getByRole("main");
    await expect(main.getByRole("table")).toHaveCount(0);
    await expect(main.getByRole("textbox")).toHaveCount(0);
  });

  test("[P0] Montör lands on the E15-safe dashboard fallback with monetary values withheld", async ({ page }) => {
    await logIn(page, fixture.roleAware.montor);

    await expect(page).toHaveURL(/\/dashboard$/);
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    await expect(main.getByText(/SEK|kr/)).toHaveCount(0);
    await expect(main.getByText(/omsättning|marginal|intäkt/i)).toHaveCount(0);
  });

  test("[P1] Säljare can open its matrix-granted customers route without receiving cost or margin", async ({ page }) => {
    await logIn(page, fixture.roleAware.saljare);
    await page.goto("/customers");

    await expect(page).toHaveURL(/\/customers$/);
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    await expect(main.getByText(/självkostnad|täckningsbidrag|marginal/i)).toHaveCount(0);
  });
});

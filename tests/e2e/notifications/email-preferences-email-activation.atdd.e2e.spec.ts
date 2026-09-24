import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type Credentials = { readonly email: string; readonly password: string };
type EmailActivationFixture = { readonly emailActivation: { readonly preferenceUser: Credentials; readonly nonEssentialCategoryLabel: string; readonly essentialCategoryLabel: string } };
let cachedFixture: EmailActivationFixture | undefined;
function fixture(): EmailActivationFixture { cachedFixture ??= JSON.parse(readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8")) as EmailActivationFixture; return cachedFixture; }
async function waitForHydrated(locator: Locator): Promise<void> { await locator.waitFor({ state: "visible" }); await locator.evaluate((element) => new Promise<void>((resolve) => { const tick = () => Object.keys(element).some((key) => key.startsWith("__react")) ? resolve() : requestAnimationFrame(tick); tick(); })); }
async function signIn(page: Page, credentials: Credentials): Promise<void> { await page.goto("/login"); const submit = page.getByRole("button", { name: "Logga in" }); await waitForHydrated(submit); await page.getByLabel("E-post").fill(credentials.email); await page.getByLabel("Lösenord").fill(credentials.password); await submit.click(); await expect(page).toHaveURL(/\/dashboard$/); }

test.describe("Story 13.4 E-postinställningar — authenticated journey (ATDD RED)", () => {
  test.skip("[P0] a user can persist a non-essential email opt-out after the server admits synthetic sandbox delivery", async ({ page }) => {
    await signIn(page, fixture().emailActivation.preferenceUser); await page.goto("/settings/notifications");
    const category = fixture().emailActivation.nonEssentialCategoryLabel;
    const emailPreference = page.getByRole("switch", { name: `${category} e-post`, exact: true });
    await expect(emailPreference).toBeVisible(); await expect(emailPreference).toBeChecked(); await expect(emailPreference).toBeEnabled();
    const saved = page.waitForResponse((response) => response.url().endsWith("/api/notifications/preferences") && response.request().method() === "PUT" && response.ok());
    await emailPreference.uncheck(); await saved;
    await expect(page.getByRole("status")).toContainText(/sparad/i); await page.reload(); await expect(page.getByRole("switch", { name: `${category} e-post`, exact: true })).not.toBeChecked();
  });

  test.skip("[P1] an essential email category remains visibly required while a non-essential category is editable", async ({ page }) => {
    await signIn(page, fixture().emailActivation.preferenceUser); await page.goto("/settings/notifications");
    const essential = page.getByRole("switch", { name: `${fixture().emailActivation.essentialCategoryLabel} e-post`, exact: true });
    const nonEssential = page.getByRole("switch", { name: `${fixture().emailActivation.nonEssentialCategoryLabel} e-post`, exact: true });
    await expect(essential).toBeChecked(); await expect(essential).toBeDisabled(); await expect(page.getByText(/obligatorisk notis/i)).toBeVisible(); await expect(nonEssential).toBeEnabled();
  });
});

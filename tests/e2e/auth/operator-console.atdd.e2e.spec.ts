import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const fixture = JSON.parse(readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8")) as {
  operator: { email: string; password: string };
  membershiplessOperator: { email: string; password: string };
  adminA: { email: string; password: string };
  operatorConsole: { handoffTenantId: string; provisioningOrganisationNumber: string };
};

async function waitForHydrated(locator: Locator): Promise<void> {
  await locator.waitFor({ state: "visible" });
  await locator.evaluate((element) => new Promise<void>((resolve) => {
    const ready = () => Object.keys(element).some((key) => key.startsWith("__react"));
    const tick = () => (ready() ? resolve() : requestAnimationFrame(tick));
    tick();
  }));
}

async function signIn(page: Page, credentials = fixture.operator): Promise<void> {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "Logga in" });
  await waitForHydrated(submit);
  await page.getByLabel("E-post").fill(credentials.email);
  await page.getByLabel("Lösenord").fill(credentials.password);
  await submit.click();
  // The login client refreshes the cookie-bound session before its canonical
  // dashboard navigation. Wait for that navigation before testing another
  // server-rendered protected route.
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Story 12.2 operator console", () => {
  test("[P1] 12.2-E2E-001 allow-listed operators reach isolated /operator with no tenant navigation", async ({ browser, page }) => {
    // Given a cookie-bound session revalidated through is_platform_operator().
    await signIn(page); await page.goto("/operator");

    // Then the platform surface has no tenant shell or navigation.
    await expect(page.getByRole("heading", { name: /operatörskonsol/i })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    const statusLink = page.getByRole("link", { name: "Öppna provisioneringsstatus" }).first();
    await expect(statusLink).toHaveAttribute("href", /\/operator\/SE%3A[0-9]{10}$/);
    await statusLink.click();
    await expect(page).toHaveURL(/\/operator\/SE%3A[0-9]{10}$/);
    await expect(page.getByRole("status")).toBeVisible();

    const membershiplessContext = await browser.newContext();
    try {
      const membershiplessPage = await membershiplessContext.newPage();
      await signIn(membershiplessPage, fixture.membershiplessOperator);
      await membershiplessPage.goto("/operator");
      await expect(membershiplessPage.getByRole("heading", { name: /operatörskonsol/i })).toBeVisible();
      await expect(membershiplessPage.getByRole("navigation")).toHaveCount(0);
    } finally {
      await membershiplessContext.close();
    }
  });

  test("[P1] 12.2-E2E-001 tenant Admin and anonymous direct routes render one generic no-data denial", async ({ browser, page }) => {
    // Given a tenant Admin session without a platform allow-list row.
    await signIn(page, fixture.adminA);
    await page.goto("/operator");
    const tenantAdminBody = await page.locator("body").innerText();
    const anonymousContext = await browser.newContext();
    try {
      const anonymousPage = await anonymousContext.newPage();
      await anonymousPage.goto("/operator");
      const anonymousBody = await anonymousPage.locator("body").innerText();

      // Then response content cannot signal a tenant, business record, or identity distinction.
      expect(tenantAdminBody).toBe(anonymousBody);
      await expect(page.getByText(/customer|quote|file|money/i)).toHaveCount(0);
      await expect(anonymousPage.getByText(/customer|quote|file|money/i)).toHaveCount(0);
    } finally {
      await anonymousContext.close();
    }
  });

  test("[P1] 12.2-E2E-002 presents Swedish company, baseline, and first-Admin steps before opaque hash-bound approval", async ({ page }) => {
    // Given an allow-listed operator begins provisioning a new tenant.
    await signIn(page);
    await page.goto("/operator");
    await page.getByLabel("Företagsnamn").fill("E2E Operatör AB");
    await page.getByLabel("Organisationsnummer").fill(fixture.operatorConsole.provisioningOrganisationNumber);

    // Then the three specified semantic headings are presented in sequence.
    await expect(page.getByRole("heading", { name: "Företagsuppgifter" })).toBeVisible();
    await page.getByRole("button", { name: /fortsätt/i }).click();
    await expect(page.getByRole("heading", { name: "Baslinje" })).toBeVisible();
    await page.getByLabel("Avtalsstart").fill("2026-10-01");
    await page.getByRole("button", { name: /fortsätt/i }).click();
    await expect(page.getByRole("heading", { name: "Bjud in första Admin" })).toBeVisible();
    await page.getByRole("textbox", { name: "Namn", exact: true }).fill("E2E Admin");
    await page.getByLabel("E-post").fill("e2e-admin@example.test");
    await page.getByRole("button", { name: "Förhandsgranska" }).click();
    await expect(page.getByRole("status")).toContainText("Förhandsgranskningen är klar");
    await expect(page.getByRole("button", { name: "Godkänn provisionering" })).toBeVisible();
    await expect(page.locator("input[name=request], input[name=previewHash]")).toHaveCount(0);
    await expect(page.locator("input[name=approvalHandle]")).toHaveCount(1);
    const firstHandle = await page.locator("input[name=approvalHandle]").inputValue();

    // A second tab shares the authenticated browser cookie jar but receives a
    // distinct opaque approval handle; preview A remains bound to its own form.
    const secondTab = await page.context().newPage();
    try {
      await secondTab.goto("/operator");
      await secondTab.getByLabel("Företagsnamn").fill("E2E Andra fliken AB");
      await secondTab.getByLabel("Organisationsnummer").fill(fixture.operatorConsole.provisioningOrganisationNumber);
      await secondTab.getByRole("button", { name: /fortsätt/i }).click();
      await secondTab.getByLabel("Avtalsstart").fill("2026-10-01");
      await secondTab.getByRole("button", { name: /fortsätt/i }).click();
      await secondTab.getByRole("textbox", { name: "Namn", exact: true }).fill("E2E Andra Admin");
      await secondTab.getByLabel("E-post").fill("andra-admin@example.test");
      await secondTab.getByRole("button", { name: "Förhandsgranska" }).click();
      const secondHandle = await secondTab.locator("input[name=approvalHandle]").inputValue();
      expect(secondHandle).not.toBe(firstHandle);
      await expect(page.locator("input[name=approvalHandle]")).toHaveValue(firstHandle);
    } finally {
      await secondTab.close();
    }
    await page.getByRole("button", { name: "Godkänn provisionering" }).click();
    await expect(page.getByText("Provisioneringen har bekräftats.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Godkänn provisionering" }).click();
    await expect(page.getByText("Åtgärden kunde inte genomföras.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(`SE:${fixture.operatorConsole.provisioningOrganisationNumber}`)).toBeVisible();
  });

  test("[P1] 12.2-E2E-002 reload and a new context reconstruct durable handoff labels", async ({ browser, page }) => {
    // Given a server-confirmed persisted provisioning/handoff state and safe detail URL.
    await signIn(page);
    await page.goto(`/operator/${fixture.operatorConsole.handoffTenantId}`);
    await expect(page.getByRole("status")).toContainText(/okänd/i);
    await expect(page.getByRole("button", { name: "Kontrollera status" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("status")).toContainText(/okänd/i);
    await expect(page.getByRole("button", { name: "Kontrollera status" })).toBeVisible();

    const resumedContext = await browser.newContext();
    try {
      const resumedPage = await resumedContext.newPage();
      await signIn(resumedPage);
      await resumedPage.goto(page.url());
      await expect(resumedPage.getByRole("status")).toContainText(/okänd/i);
      await expect(resumedPage.getByRole("button", { name: "Kontrollera status" })).toBeVisible();
      await expect(resumedPage.getByText(/email delivery/i)).toHaveCount(0);
    } finally {
      await resumedContext.close();
    }

    // The unknown state must reconcile before a retry can become available.
    await expect(page.getByRole("button", { name: "Försök igen" })).toHaveCount(0);
    await page.getByRole("button", { name: "Kontrollera status" }).click();
    await expect(page.getByText("Status har kontrollerats. Du kan nu begära ett nytt försök.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Försök igen" }).click();
    await expect(page.getByText("Inbjudan har hanterats.", { exact: true })).toBeVisible();
  });

  test("[P2] 12.2-E2E-003 provides semantic validation focus and keyboard progression", async ({ page }) => {
    // Given an allow-listed operator submits an incomplete first wizard step with the keyboard.
    await signIn(page);
    await page.goto("/operator");
    await page.getByRole("button", { name: /fortsätt/i }).press("Enter");

    // Then feedback is accessible and no client click history is treated as success.
    await expect(page.getByText("Fyll i de obligatoriska uppgifterna innan du fortsätter.")).toBeFocused();
    await expect(page.getByRole("heading", { name: "Företagsuppgifter" })).toBeVisible();
    await page.getByLabel("Företagsnamn").fill("E2E Tangentbord AB");
    await page.getByLabel("Organisationsnummer").fill(fixture.operatorConsole.provisioningOrganisationNumber);
    await page.getByRole("button", { name: /fortsätt/i }).press("Enter");
    await expect(page.getByRole("heading", { name: "Baslinje" })).toBeVisible();
  });
});

/**
 * Story 3.2 — CRM tenant-admin UX E2E (browser journeys) against the REAL app + local
 * Supabase stack + the two-tenant fixture (with seeded CRM rows). Run by the `e2e` CI job.
 *
 * COVERAGE (Story 3.2 Test Requirements / AC1-AC7):
 *   AC1 → /customers renders the populated list; search/filter narrows it; no-results state.
 *   AC4 → creating a customer via the dialog persists (round-trips createCustomer 3.1).
 *   AC3 → a validation failure shows a FIELD-ASSOCIATED error + summary and PRESERVES input.
 *   AC3 → dialog open moves focus IN; Escape/close returns focus to the trigger.
 *   AC6 → the shell shows exactly the active manifest nav and none of the deferred labels.
 *   AC5 → anonymous /customers and /customers/<id> redirect to /login.
 *   P0  → the /customers LIST never contains a personnummer; the detail shows it masked.
 *
 * Reuses the `signIn`/`waitForHydrated` helpers (client islands must be HYDRATED before
 * interaction — poll for `__react*` keys; clicking pre-hydration native-submits).
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expectActiveAdminNavigation } from "../support/active-admin-navigation";

interface CrmFixture {
  readonly tenantA: { readonly name: string };
  readonly adminA: { readonly email: string; readonly password: string };
  readonly crm: {
    readonly company: { readonly id: string; readonly displayName: string; readonly orgNr: string };
    readonly private: {
      readonly id: string;
      readonly displayName: string;
      readonly personnummer: string;
    };
    readonly facilityId: string;
  };
}

const fixture: CrmFixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"),
    "utf8",
  ),
);

/** Poll for React hydration before interacting (see auth spec for rationale). */
async function waitForHydrated(locator: Locator): Promise<void> {
  await locator.waitFor({ state: "visible" });
  await locator.evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        const ready = () => Object.keys(el).some((k) => k.startsWith("__react"));
        const tick = () => (ready() ? resolve() : requestAnimationFrame(tick));
        tick();
      }),
  );
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "Logga in" });
  await waitForHydrated(submit);
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord").fill(password);
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard/);
}

const DEFERRED_LABELS = [
  "Pilotstöd",
  "Migrering",
  "Fortnox",
  "Leverantör",
  "Uthyrning",
  "Tillgångar",
];

test.describe("CRM tenant-admin UX (Story 3.2 E2E)", () => {
  test("AC5: an anonymous visitor to /customers and /customers/<id> is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/customers");
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await page.goto(`/customers/${fixture.crm.company.id}`);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("AC1: /customers renders the populated list; search narrows it; no-results state appears", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/customers");

    await expect(page.getByRole("heading", { name: "Kunder", level: 1 })).toBeVisible();
    // Both seeded customers are present in the populated list.
    await expect(page.getByText(fixture.crm.company.displayName)).toBeVisible();
    await expect(page.getByText(fixture.crm.private.displayName)).toBeVisible();

    // Search narrows to the company by name.
    const search = page.getByLabel("Sök kund");
    await waitForHydrated(search);
    await search.fill(fixture.crm.company.displayName);
    await expect(page.getByText(fixture.crm.company.displayName)).toBeVisible();
    await expect(page.getByText(fixture.crm.private.displayName)).toHaveCount(0);

    // A non-matching search reaches the DISTINCT no-results state.
    await search.fill("zzz-no-such-customer-zzz");
    await expect(page.getByTestId("customers-no-results")).toBeVisible();
  });

  test("AC1 search by org_nr: the company is findable by its org number", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/customers");
    const search = page.getByLabel("Sök kund");
    await waitForHydrated(search);
    await search.fill(fixture.crm.company.orgNr);
    await expect(page.getByText(fixture.crm.company.displayName)).toBeVisible();
  });

  test("AC1 filter by type: filtering to Privatperson hides the company customer", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/customers");
    const filter = page.getByLabel("Filtrera typ");
    await waitForHydrated(filter);
    await filter.selectOption("private");
    await expect(page.getByText(fixture.crm.private.displayName)).toBeVisible();
    await expect(page.getByText(fixture.crm.company.displayName)).toHaveCount(0);
  });

  test("P0: the /customers LIST never contains a personnummer value", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/customers");
    await expect(page.getByText(fixture.crm.private.displayName)).toBeVisible();
    // The full DOM + the page source must NOT contain the seeded personnummer.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain(fixture.crm.private.personnummer);
    const html = await page.content();
    expect(html).not.toContain(fixture.crm.private.personnummer);
  });

  test("P0/AC2: the private customer DETAIL shows the personnummer MASKED (not clear-text by default)", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/customers/${fixture.crm.private.id}`);
    await expect(
      page.getByRole("heading", { name: fixture.crm.private.displayName, level: 1 }),
    ).toBeVisible();
    const pnr = page.getByTestId("customer-personnummer");
    await expect(pnr).toBeVisible();
    // Masked by default: the clear-text value is NOT shown, but the last 4 digits are.
    await expect(pnr).not.toHaveText(fixture.crm.private.personnummer);
    await expect(pnr).toContainText(fixture.crm.private.personnummer.slice(-4));
    // Reveal-on-click surfaces the full value (the access-controlled detail surface).
    const reveal = page.getByRole("button", { name: "Visa" });
    await waitForHydrated(reveal);
    await reveal.click();
    await expect(pnr).toHaveText(fixture.crm.private.personnummer);
  });

  test("AC4: creating a customer via the dialog persists and appears in the list", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/customers");

    const newName = `Created Co ${Date.now().toString(36)}`;
    const openBtn = page.getByTestId("new-customer-button");
    await waitForHydrated(openBtn);
    await openBtn.click();

    const dialog = page.getByRole("dialog", { name: "Ny kund" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Kundtyp").selectOption("company");
    await dialog.getByLabel("Visningsnamn").fill(newName);
    await dialog.getByLabel("Organisationsnummer").fill("556000-1234");
    await dialog.getByRole("button", { name: "Spara" }).click();

    // The dialog closes and the new customer appears in the revalidated list.
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(newName)).toBeVisible();
  });

  test("AC3: a validation failure shows a field-associated error + summary and preserves input", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/customers");

    const openBtn = page.getByTestId("new-customer-button");
    await waitForHydrated(openBtn);
    await openBtn.click();
    const dialog = page.getByRole("dialog", { name: "Ny kund" });
    await expect(dialog).toBeVisible();

    // Company type, fill display_name, but LEAVE org_nr blank → validation failure.
    await dialog.getByLabel("Kundtyp").selectOption("company");
    const nameInput = dialog.getByLabel("Visningsnamn");
    await nameInput.fill("Incomplete Co");
    await dialog.getByRole("button", { name: "Spara" }).click();

    // Field-associated error: the org_nr input is aria-invalid and describedby its error.
    const orgInput = dialog.getByLabel("Organisationsnummer");
    await expect(orgInput).toHaveAttribute("aria-invalid", "true");
    const describedBy = await orgInput.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(dialog.locator(`#${describedBy}`)).toBeVisible();
    // The blocking summary is present and the dialog stayed open with input preserved.
    await expect(dialog.getByTestId("form-error-summary")).toContainText(/.+/);
    await expect(nameInput).toHaveValue("Incomplete Co");
  });

  test("AC3: opening a dialog moves focus IN; Escape closes and returns focus to the trigger", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/customers");

    const openBtn = page.getByTestId("new-customer-button");
    await waitForHydrated(openBtn);
    await openBtn.click();
    const dialog = page.getByRole("dialog", { name: "Ny kund" });
    await expect(dialog).toBeVisible();

    // Focus moved INTO the dialog (the first field — Kundtyp select).
    await expect(dialog.getByLabel("Kundtyp")).toBeFocused();

    // Escape closes and returns focus to the invoking trigger (predictable focus).
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(openBtn).toBeFocused();
  });

  test("AC6: the shell shows EXACTLY the active manifest nav and NONE of the deferred labels", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/customers");

    const nav = page.getByRole("navigation", { name: "Huvudnavigation" }).first();
    await expectActiveAdminNavigation(nav);

    // No deferred-module label appears anywhere on the page (nav, body, or detail).
    const body = await page.locator("body").innerText();
    for (const deferred of DEFERRED_LABELS) {
      expect(body).not.toContain(deferred);
    }
  });

  test("AC2: the detail hub shows honest 'not yet built' areas and NO deferred-module section", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/customers/${fixture.crm.company.id}`);
    await expect(
      page.getByRole("heading", { name: fixture.crm.company.displayName, level: 1 }),
    ).toBeVisible();
    // Facilities + Contacts sub-sections are present and populated (seeded).
    await expect(page.getByRole("heading", { name: "Anläggningar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kontakter" })).toBeVisible();
    // Honest "not yet built" related areas exist; no deferred-module label leaks.
    await expect(page.getByTestId("not-built-area").first()).toBeVisible();
    const body = await page.locator("body").innerText();
    for (const deferred of DEFERRED_LABELS) {
      expect(body).not.toContain(deferred);
    }
  });

  test("AC2: a non-existent / other-tenant customer id renders a GENERIC not-found (no leakage)", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    // A random UUID the caller does not own → invisible under RLS → generic not-found.
    await page.goto("/customers/00000000-0000-0000-0000-000000000000");
    await expect(page.getByTestId("customer-not-found")).toBeVisible();
  });
});

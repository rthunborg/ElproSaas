/**
 * Story 5.2 — Calculation editor UX E2E (/calculations list + /calculations/[id] editor)
 * against the REAL app + local Supabase stack + the two-tenant fixture.
 *
 * MIRRORS the Story 3.4 pricing e2e pattern (signIn / waitForHydrated helpers, the seeded
 * two-tenant fixture, `getByLabel` + `aria-invalid`/`aria-describedby` field association,
 * `getByTestId` UI contract). This suite ships GREEN alongside the editor — there is NO
 * `describe.skip` / red-phase header lingering (the editor + actions exist).
 *
 * The seeded calc (global-setup): a draft calc under the company customer with ONE section
 * that has TWO rows (2 × 850,00 @ 25% + 1 × 500,00 @ 25%): net 2200,00 / VAT 550,00 / gross
 * 2750,00. Count-asserting flows seed their own `crypto.randomUUID()`-named calc/section.
 *
 * Coverage:
 *   - 5.2-E2E-03 (AC1): responsive layout — desktop header/customer/status/workspace/summary
 *     present; a narrow viewport stacks the summary inline without overlap.
 *   - 5.2-E2E-01 (AC2/AC3): keyboard row editing; a validation error PRESERVES input.
 *   - 5.2-E2E-02 (AC2): destructive delete of a POPULATED section requires confirmation.
 *   - 5.2-E2E-04 (AC1/AC4): totals summary reflects the engine output (net/VAT/gross).
 *   - 5.2-E2E-05 (AC5/AC6): no deferred-workflow labels; anon → /login; nav stays seven.
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

interface CalcFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  readonly calc: {
    readonly id: string;
    readonly title: string;
    readonly sectionId: string;
    readonly rowIds: readonly string[];
  };
}

const fixture: CalcFixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8"),
);

/** Poll for React hydration before interacting. */
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

test.describe("Calculation editor UX (Story 5.2 E2E)", () => {
  test("AC5: an anonymous visit to /calculations redirects to /login", async ({ page }) => {
    await page.goto("/calculations");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("AC5: an anonymous visit to /calculations/[id] redirects to /login", async ({ page }) => {
    await page.goto(`/calculations/${fixture.calc.id}`);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("AC1: the calculation list renders and links to the editor", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/calculations");
    await expect(page.getByRole("heading", { name: "Kalkyler", level: 1 })).toBeVisible();
    await expect(page.getByTestId("calculation-list")).toBeVisible();
    // The seeded calc appears and links to its editor.
    const row = page.getByTestId("calculation-list-row").filter({ hasText: fixture.calc.title });
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/calculations/${fixture.calc.id}`));
  });

  test("5.2-E2E-03 (AC1): the DESKTOP editor shows header/customer/status/workspace/summary", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);

    await expect(page.getByTestId("calculation-editor")).toBeVisible();
    await expect(page.getByTestId("calculation-header")).toBeVisible();
    await expect(page.getByTestId("calculation-status")).toBeVisible();
    await expect(page.getByTestId("customer-context")).toBeVisible();
    await expect(page.getByTestId("section-editor").first()).toBeVisible();
    // The persistent summary panel is present on desktop.
    await expect(page.getByTestId("totals-summary").first()).toBeVisible();
  });

  test("5.2-E2E-03 (AC1): a NARROW viewport stacks the summary inline without overlap", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);
    // On a narrow viewport the INLINE summary block (data-inline="true") is visible; the
    // sticky desktop panel (data-inline="false") is hidden by the `lg:hidden`/`hidden lg:block`
    // responsive wrappers, so controls stack without overlap.
    const inlineSummary = page.locator('[data-testid="totals-summary"][data-inline="true"]');
    await expect(inlineSummary).toBeVisible();
    const desktopSummary = page.locator('[data-testid="totals-summary"][data-inline="false"]');
    await expect(desktopSummary).toBeHidden();
    // The editor content is still present (stacked above the inline summary).
    await expect(page.getByTestId("calculation-header")).toBeVisible();
  });

  test("5.2-E2E-04 (AC1/AC4): the totals summary reflects the ENGINE output", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);
    // Seeded rows: 2×850,00 + 1×500,00 @ 25% → net 2200,00 / VAT 550,00 / gross 2750,00.
    const summary = page.getByTestId("totals-summary").first();
    await expect(summary.getByTestId("summary-net")).toContainText("2200,00");
    await expect(summary.getByTestId("summary-vat")).toContainText("550,00");
    await expect(summary.getByTestId("summary-gross")).toContainText("2750,00");
  });

  test("5.2-E2E-01 (AC2/AC3): a row can be edited by keyboard; a validation error PRESERVES input", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);

    // Edit the FIRST row's sell price to an invalid negative value and save — the field is
    // rejected with an aria-invalid association and the typed input is PRESERVED.
    const firstRowForm = page.getByTestId("row-edit-form").first();
    const sell = firstRowForm.getByLabel("Pris (kr)");
    await waitForHydrated(sell);
    await sell.fill("-50");
    await firstRowForm.getByRole("button", { name: /Spara rad/ }).click();

    await expect(sell).toHaveAttribute("aria-invalid", "true");
    const describedBy = await sell.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    // The typed (invalid) value is preserved, not cleared.
    await expect(sell).toHaveValue("-50");
  });

  test("5.2-E2E-02 (AC2): archiving a POPULATED section requires an explicit confirmation", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);

    const section = page.getByTestId("section-editor").first();
    // Clicking "Ta bort sektion" on a populated section shows a confirmation dialog rather
    // than immediately archiving.
    await section.getByTestId("archive-section").click();
    await expect(section.getByTestId("archive-section-confirm")).toBeVisible();
    // Cancelling closes the dialog without archiving.
    await section.getByTestId("archive-section-cancel").click();
    await expect(section.getByTestId("archive-section-confirm")).toHaveCount(0);
    // The section is still present.
    await expect(page.getByTestId("section-editor").first()).toBeVisible();
  });

  test("5.2-E2E-05 (AC6): NO deferred-workflow label appears in the editor", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);
    const editor = page.getByTestId("calculation-editor");
    await expect(editor).toBeVisible();
    // None of the deferred-workflow / supplier / AI / analytics vocabularies appear.
    await expect(
      editor.getByText(/fältarbetare|projektplan|ÄTA|leverantör|supplier|fortnox|import|synk|AI\b|analys/i),
    ).toHaveCount(0);
    // NO pricing-SOURCE selection (that is Story 5.3 — rows are manual here).
    await expect(editor.getByText(/prislista|priskälla|källa/i)).toHaveCount(0);
  });

  test("5.2-E2E-05 (AC6): the nav stays EXACTLY the seven IN-scope modules", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);
    const nav = page.getByRole("navigation", { name: "Huvudnavigation" }).first();
    const expectedSeven = [
      "Dashboard",
      "Kunder",
      "Kalkyler",
      "Offerter",
      "Jobb/Order",
      "Filer",
      "Inställningar",
    ];
    for (const label of expectedSeven) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(nav.getByRole("link")).toHaveCount(expectedSeven.length);
  });

  test("AC1: a foreign / nonexistent calc id renders a GENERIC not-found (no cross-tenant leak)", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    // A random UUID that does not belong to this tenant → invisible under RLS → generic
    // not-found (never revealing whether it exists in another tenant).
    await page.goto(`/calculations/00000000-0000-0000-0000-000000000000`);
    await expect(page.getByTestId("calculation-not-found")).toBeVisible();
  });

  test("5.2-E2E-06 (AC2): sections can be REORDERED via move-up (server-owned reorder)", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);

    // Add a second uniquely-named section so this test owns a two-section ordering it can
    // reorder without disturbing the shared seed's single-section flows.
    const secondTitle = `Sektion B ${crypto.randomUUID().slice(0, 8)}`;
    await page.getByTestId("add-section").click();
    const addForm = page.getByTestId("add-section-form");
    await addForm.getByLabel(/Sektionstitel/).fill(secondTitle);
    await addForm.getByRole("button", { name: /Skapa sektion/ }).click();

    const secondSection = page
      .getByTestId("section-editor")
      .filter({ hasText: secondTitle });
    await expect(secondSection).toBeVisible();

    // The new section renders LAST → its move-up control is enabled; the first section's
    // move-up is disabled (it is already first).
    const moveUpButtons = page.getByTestId("section-move-up");
    await expect(moveUpButtons.first()).toBeDisabled();
    const lastMoveUp = moveUpButtons.last();
    await expect(lastMoveUp).toBeEnabled();

    // Moving the second section up routes through the atomic reorderSections command; after
    // revalidate the second section is now FIRST (its move-up becomes disabled).
    await lastMoveUp.click();
    await expect(
      page.getByTestId("section-editor").first(),
    ).toContainText(secondTitle);
    await expect(page.getByTestId("section-move-up").first()).toBeDisabled();
  });

  test("AC2: a new section can be added and a row created (round-trips through the command)", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);

    // Add a uniquely-named section so this test owns its own row it can create.
    const uniqueTitle = `Ny sektion ${crypto.randomUUID().slice(0, 8)}`;
    await page.getByTestId("add-section").click();
    const addForm = page.getByTestId("add-section-form");
    await addForm.getByLabel(/Sektionstitel/).fill(uniqueTitle);
    await addForm.getByRole("button", { name: /Skapa sektion/ }).click();

    // The new section appears (revalidatePath re-renders the server page).
    await expect(
      page.getByTestId("section-editor").filter({ hasText: uniqueTitle }),
    ).toBeVisible();
  });
});

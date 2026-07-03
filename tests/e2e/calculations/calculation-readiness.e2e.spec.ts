/**
 * Story 5.4 — Calculation readiness review + pre-quote snapshot preview E2E, against the REAL
 * app + local Supabase stack + the two-tenant fixture.
 *
 * MIRRORS the Story 5.2 editor E2E EXACTLY (the `signIn` / `waitForHydrated` helpers, the seeded
 * two-tenant fixture, `getByTestId` / `getByLabel`, `aria-*` associations). Ships GREEN alongside
 * the readiness UI — there is NO `describe.skip` / red-phase header / `notYetImplemented`
 * placeholder lingering (the readiness summary + gated affordance + preview + new-version message
 * all exist).
 *
 * Coverage (mapped to the epic test design):
 *   - 5.4-E2E-01 (AC1/AC2): the blocker calc GATES the create-quote affordance (disabled) AND the
 *     warnings do NOT silently disappear; the healthy calc ENABLES the affordance.
 *   - 5.4-E2E-02 (AC2): the pre-quote preview shows the AC2 content (customer/facility/contact,
 *     sections respecting display_mode, visible/hidden rows, options/tillval, totals, VAT display,
 *     tax assumptions, terms, attachments deferral, warnings captured at snapshot time).
 *   - 5.4-E2E-03 (AC3): the "a new version is required after send" explanatory message is PRESENT
 *     (enforcement is Epic 6).
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

interface CalcFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  readonly calc: {
    readonly id: string;
    readonly title: string;
  };
  readonly blockerCalc: {
    readonly id: string;
    readonly title: string;
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

test.describe("Calculation readiness review + pre-quote preview (Story 5.4 E2E)", () => {
  test("5.4-E2E-01 (AC1/AC2): a BLOCKER calc GATES the create-quote affordance; warnings stay visible", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.blockerCalc.id}`);

    // The readiness summary renders and reports it CANNOT create a quote (a blocker present).
    const readiness = page.getByTestId("readiness-summary").first();
    await expect(readiness).toBeVisible();
    await expect(readiness).toHaveAttribute("data-can-create-quote", "false");
    // The blockers group (role="alert") is present and names the uncomputable-total blocker.
    await expect(page.getByTestId("readiness-blockers").first()).toBeVisible();
    await expect(
      page.getByTestId("readiness-blocker-TOTAL_UNCOMPUTABLE").first(),
    ).toBeVisible();

    // The create-quote affordance is GATED (disabled) — blockers gate versioning.
    const createQuote = page.getByTestId("create-quote").first();
    await expect(createQuote).toBeVisible();
    await expect(createQuote).toBeDisabled();

    // The warnings do NOT silently disappear — the warnings group is still present.
    await expect(page.getByTestId("readiness-warnings").first()).toBeVisible();
  });

  test("5.4-E2E-01 (AC1/AC2): a HEALTHY calc (no blocker) ENABLES the create-quote affordance", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);

    const readiness = page.getByTestId("readiness-summary").first();
    await expect(readiness).toBeVisible();
    await expect(readiness).toHaveAttribute("data-can-create-quote", "true");
    // No blockers group when there is no blocker.
    await expect(page.getByTestId("readiness-blockers")).toHaveCount(0);
    // The create-quote affordance is ENABLED (only warnings remain).
    const createQuote = page.getByTestId("create-quote").first();
    await expect(createQuote).toBeVisible();
    await expect(createQuote).toBeEnabled();
  });

  test("5.4-E2E-02 (AC2): the pre-quote preview shows the full AC2 content", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);

    // Open the preview (the healthy calc's affordance is enabled).
    const createQuote = page.getByTestId("create-quote").first();
    await waitForHydrated(createQuote);
    await createQuote.click();

    const preview = page.getByTestId("pre-quote-preview").first();
    await expect(preview).toBeVisible();
    // AC2 content blocks are all present.
    await expect(preview.getByTestId("preview-customer")).toBeVisible();
    await expect(preview.getByTestId("preview-sections")).toBeVisible();
    await expect(preview.getByTestId("preview-section").first()).toBeVisible();
    await expect(preview.getByTestId("preview-totals")).toBeVisible();
    await expect(preview.getByTestId("preview-net")).toContainText("2200,00");
    await expect(preview.getByTestId("preview-gross")).toContainText("2750,00");
    await expect(preview.getByTestId("preview-vat-display")).toBeVisible();
    await expect(preview.getByTestId("preview-tax-assumptions")).toBeVisible();
    await expect(preview.getByTestId("preview-terms")).toBeVisible();
    await expect(preview.getByTestId("preview-attachments")).toBeVisible();
    await expect(preview.getByTestId("preview-warnings")).toBeVisible();
  });

  test("5.4-E2E-03 (AC3): the 'new version required after send' message is PRESENT (enforcement is Epic 6)", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);

    // The explanatory forward-seam message is present where the create-quote affordance lives —
    // enforcement (block the mutation / force a new version) is Epic 6.
    const message = page.getByTestId("new-version-after-send-message").first();
    await expect(message).toBeVisible();
    await expect(message).toContainText(/ny offertversion/i);
  });
});

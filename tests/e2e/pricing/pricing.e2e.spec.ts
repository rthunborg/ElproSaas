/**
 * Story 3.4 — ATDD RED-PHASE scaffold: Pricing UI E2E (/settings/pricing —
 * Prissättning: work roles + optional articles) against the REAL app + local Supabase
 * stack + the two-tenant fixture.
 *
 * 🔴 RED PHASE — the whole suite is `test.describe.skip(...)` so the green `e2e` CI job
 * is UNPERTURBED until dev ships `/settings/pricing` (force-dynamic server page), the
 * `src/components/pricing/**` editors (work-role + article forms with the kronor↔öre
 * money input), and the `src/features/pricing/actions.ts` `"use server"` actions
 * delegating to the commands. Un-skip in the GREEN phase.
 *
 * MIRRORS the Story 3.3 settings e2e pattern EXACTLY (signIn / waitForHydrated helpers,
 * the seeded two-tenant fixture, `getByLabel` + `aria-invalid`/`aria-describedby` field
 * association). The data-testids / Swedish labels asserted below are the UI CONTRACT dev
 * must implement to turn these GREEN.
 *
 * The LOAD-BEARING contracts these tests pin (the story encodes them):
 *   - Money input validation (P0, AC2/AC5): a NEGATIVE/FLOAT rate is rejected with a
 *     FIELD-ASSOCIATED error (aria-invalid + aria-describedby → error node) and the
 *     input is PRESERVED. The money input DISPLAYS kronor ("850,00") but STORES öre.
 *   - Round-trip (P0, AC5): a valid work role + a valid article SAVE and round-trip
 *     through the envelope command on reload.
 *   - No-supplier-scope in the UI (P0, AC3): NO supplier/sync/import control appears in
 *     the article editor.
 *   - Route auth + nav (P0, AC5): anon → /login; nav stays EXACTLY the seven IN-scope
 *     modules — pricing adds NO new nav item (it lives under the existing Inställningar
 *     hub), so "Prissättning" is reachable from /settings but is NOT a top-nav link.
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

interface PricingFixture {
  readonly adminA: { readonly email: string; readonly password: string };
}

const fixture: PricingFixture = JSON.parse(
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

test.describe("Pricing UI — Work roles + Articles (Story 3.4 E2E)", () => {
  test("AC5: an anonymous visit to /settings/pricing redirects to /login", async ({ page }) => {
    await page.goto("/settings/pricing");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("AC5: the Pricing screen renders (Prissättning) with work-role + article editors", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/settings/pricing");
    await expect(page.getByRole("heading", { name: "Prissättning", level: 1 })).toBeVisible();
    // Both editors are present (the work-role list + the article list).
    await expect(page.getByTestId("work-roles-editor")).toBeVisible();
    await expect(page.getByTestId("articles-editor")).toBeVisible();
  });

  test("AC2/AC5: a NEGATIVE work-role rate is rejected with a FIELD-ASSOCIATED error and input is preserved", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/settings/pricing");

    const name = page.getByLabel("Benämning");
    await waitForHydrated(name);
    await name.fill("Montör");
    const sell = page.getByLabel("Pris (kr/tim)");
    await sell.fill("-50"); // a negative price — must be rejected
    await page.getByRole("button", { name: "Spara roll" }).click();

    // Field-associated error: the price input is aria-invalid + describedby its error node.
    await expect(sell).toHaveAttribute("aria-invalid", "true");
    const describedBy = await sell.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toBeVisible();
    // The blocking summary is present and the previously-entered input is PRESERVED.
    // Scope to the work-roles editor — the page has two editors, each with its own
    // form-error-summary region (the article editor's stays empty on a work-role submit).
    await expect(
      page.getByTestId("work-roles-editor").getByTestId("form-error-summary"),
    ).toContainText(/.+/);
    await expect(name).toHaveValue("Montör");
    await expect(sell).toHaveValue("-50");
  });

  test("AC2/AC5: a FLOAT-with-too-many-decimals rate is rejected (öre precision, field-associated)", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/settings/pricing");
    const name = page.getByLabel("Benämning");
    await waitForHydrated(name);
    await name.fill("Elektriker");
    await page.getByLabel("Pris (kr/tim)").fill("850,005"); // sub-öre precision
    await page.getByRole("button", { name: "Spara roll" }).click();
    await expect(page.getByLabel("Pris (kr/tim)")).toHaveAttribute("aria-invalid", "true");
  });

  test("AC5: a valid work role SAVES and round-trips (kronor display, öre stored)", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/settings/pricing");
    const name = page.getByLabel("Benämning");
    await waitForHydrated(name);
    const roleName = `Montör ${Date.now().toString(36)}`;
    await name.fill(roleName);
    await page.getByLabel("Pris (kr/tim)").fill("850,00"); // Swedish comma → 85000 öre
    const editor = page.getByTestId("work-roles-editor");
    await page.getByRole("button", { name: "Spara roll" }).click();
    await expect(editor.getByTestId("settings-saved")).toBeVisible();

    // Reload reads the persisted value via the RLS client (force-dynamic). The saved role
    // row shows the kronor display "850,00 kr/tim" — match the role row inside the editor
    // (page-level "850,00" is ambiguous with the input-hint text).
    await page.reload();
    await expect(editor.getByText(roleName)).toBeVisible();
    await expect(editor.getByText("850,00 kr/tim")).toBeVisible(); // displayed as kronor
  });

  test("AC3/AC5: a valid article SAVES and round-trips; NO supplier control appears in the article editor", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/settings/pricing");
    const editor = page.getByTestId("articles-editor");
    const articleName = page.getByLabel("Artikelnamn");
    await waitForHydrated(articleName);
    const name = `Kabel ${Date.now().toString(36)}`;
    await articleName.fill(name);
    await page.getByLabel("Enhetspris (kr)").fill("12,50");
    await page.getByRole("button", { name: "Spara artikel" }).click();
    await expect(editor.getByTestId("settings-saved")).toBeVisible();

    // HARD no-supplier-scope: NO supplier/sync/import control is rendered in the editor.
    await expect(editor.getByLabel(/leverantör|supplier/i)).toHaveCount(0);
    await expect(editor.getByLabel(/synk|sync|import|fortnox/i)).toHaveCount(0);

    await page.reload();
    await expect(page.getByText(name)).toBeVisible();
  });

  test("AC5: the nav stays EXACTLY the seven IN-scope modules — pricing adds NO new top-nav item", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/settings/pricing");
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
    // Prissättning lives UNDER Inställningar — it is NOT a top-nav link.
    await expect(nav.getByRole("link", { name: "Prissättning" })).toHaveCount(0);
  });

  test("AC5: the Inställningar hub links to /settings/pricing (Prissättning) — the 3.3 hub omitted it", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/settings");
    await expect(page.getByRole("link", { name: "Prissättning" })).toBeVisible();
  });
});

/**
 * Story 3.3 — ATDD RED-PHASE scaffold: Settings UI E2E (Company settings + Quote
 * terms) against the REAL app + local Supabase stack + the two-tenant fixture.
 *
 * 🔴 RED PHASE — the whole suite is `test.describe.skip(...)` so the green `e2e` CI
 * job is UNPERTURBED until dev ships `/settings/company` + `/settings/quote-terms`
 * (force-dynamic server pages), the `src/components/settings/**` forms, and the
 * `src/features/settings/actions.ts` `"use server"` actions delegating to the
 * commands. Un-skip in the GREEN phase.
 *
 * MIRRORS the Story 3.2 CRM e2e pattern EXACTLY (signIn / waitForHydrated helpers,
 * the seeded two-tenant fixture, `getByLabel` + `aria-invalid`/`aria-describedby`
 * field-association assertions). The data-testids / Swedish labels asserted below are
 * the UI CONTRACT dev must implement to turn these GREEN.
 *
 * The LOAD-BEARING contracts these tests pin (the story encodes them):
 *   - Sign-off WARNING (P0, AC2): a NOT-approved quote_terms record renders a clear,
 *     non-color-only WARNING ("kräver godkännande av ägare/juridik"); saving the terms
 *     TEXT does NOT approve them — only the deliberate "Markera som godkänd" action
 *     does; an approved record shows "Godkänd av …" with who+when.
 *   - VAT rate validation (P0, AC4): an out-of-range VAT rate is rejected with a
 *     FIELD-ASSOCIATED error (aria-invalid + aria-describedby → error node) and the
 *     input is PRESERVED on failure. The rate displays as a percent but stores basis
 *     points; no VAT CALCULATION is performed (Epic 4).
 *   - Route auth + nav (P0, AC4): anon → /login; nav stays EXACTLY the seven IN-scope
 *     modules (no new settings nav item; no /settings/pricing — Story 3.4).
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

interface SettingsFixture {
  readonly adminA: { readonly email: string; readonly password: string };
}

const fixture: SettingsFixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"),
    "utf8",
  ),
);

/** Poll for React hydration before interacting (CRM-spec rationale). */
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

test.describe("Settings UI — Company + Quote terms (Story 3.3 E2E)", () => {
  test("AC4: anonymous visits to /settings/company and /settings/quote-terms redirect to /login", async ({
    page,
  }) => {
    await page.goto("/settings/company");
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await page.goto("/settings/quote-terms");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("AC4: the Company settings screen renders (Företagsinställningar) with a VAT-rate field", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/settings/company");
    await expect(
      page.getByRole("heading", { name: "Företagsinställningar", level: 1 }),
    ).toBeVisible();
    await expect(page.getByLabel("Företagsnamn")).toBeVisible();
    await expect(page.getByLabel("Momssats")).toBeVisible();
  });

  test("AC4/AC5: an out-of-range VAT rate is rejected with a FIELD-ASSOCIATED error and input is preserved", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/settings/company");

    const name = page.getByLabel("Företagsnamn");
    await waitForHydrated(name);
    await name.fill("Elpro Pilot AB");
    const vat = page.getByLabel("Momssats");
    await vat.fill("250"); // 250 % — out of the [0,100] % range (> 10000 bp)
    await page.getByRole("button", { name: "Spara" }).click();

    // Field-associated error: the VAT input is aria-invalid + describedby its error node.
    await expect(vat).toHaveAttribute("aria-invalid", "true");
    const describedBy = await vat.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toBeVisible();
    // The blocking summary is present and the previously-entered input is PRESERVED.
    await expect(page.getByTestId("form-error-summary")).toContainText(/.+/);
    await expect(name).toHaveValue("Elpro Pilot AB");
    await expect(vat).toHaveValue("250");
  });

  test("AC4: a valid Company settings save round-trips (the rate persists as a percent display)", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/settings/company");
    const name = page.getByLabel("Företagsnamn");
    await waitForHydrated(name);
    await name.fill("Elpro Pilot AB");
    await page.getByLabel("Momssats").fill("25");
    await page.getByRole("button", { name: "Spara" }).click();
    await expect(page.getByTestId("settings-saved")).toBeVisible();

    // Reload reads the persisted value via the RLS client (force-dynamic).
    await page.reload();
    await expect(page.getByLabel("Företagsnamn")).toHaveValue("Elpro Pilot AB");
    await expect(page.getByLabel("Momssats")).toHaveValue("25");
  });

  test("AC2: the Quote-terms screen shows the NOT-approved WARNING by default (sign-off status, non-color-only)", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/settings/quote-terms");
    await expect(
      page.getByRole("heading", { name: "Offertvillkor", level: 1 }),
    ).toBeVisible();
    // The not-approved WARNING is a TESTED contract, not just copy. It carries TEXT
    // (not color alone) and names the owner/legal sign-off requirement.
    const warning = page.getByTestId("quote-terms-signoff-warning");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(/godkännande av ägare\/juridik/i);
  });

  test("AC2: saving the terms TEXT does NOT approve them — the WARNING persists after an edit-save", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/settings/quote-terms");
    const terms = page.getByLabel("Offertvillkor");
    await waitForHydrated(terms);
    await terms.fill(`Villkor ${Date.now().toString(36)} (platshållartext)`);
    await page.getByRole("button", { name: "Spara villkor" }).click();
    await expect(page.getByTestId("settings-saved")).toBeVisible();

    // Editing/saving the wording must NEVER auto-approve: the not-approved WARNING
    // is STILL shown, and there is no "Godkänd av …" status from a mere text save.
    await expect(page.getByTestId("quote-terms-signoff-warning")).toBeVisible();
    await expect(page.getByTestId("quote-terms-approved-status")).toHaveCount(0);
  });

  test("AC2: the deliberate 'Markera som godkänd' action transitions to an APPROVED status (who + when)", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/settings/quote-terms");
    // Ensure a saved terms record exists first.
    const terms = page.getByLabel("Offertvillkor");
    await waitForHydrated(terms);
    await terms.fill("Villkor att godkänna (platshållartext)");
    await page.getByRole("button", { name: "Spara villkor" }).click();
    await expect(page.getByTestId("settings-saved")).toBeVisible();

    // The deliberate human sign-off action — the ONLY path to approval.
    const approve = page.getByRole("button", { name: "Markera som godkänd" });
    await waitForHydrated(approve);
    await approve.click();

    // Approved status now shows who + when; the not-approved warning is gone.
    await expect(page.getByTestId("quote-terms-approved-status")).toContainText(
      /Godkänd av/i,
    );
    await expect(page.getByTestId("quote-terms-signoff-warning")).toHaveCount(0);
  });

  test("AC4: the nav stays EXACTLY the seven IN-scope modules — no new settings nav item, no /settings/pricing", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/settings/company");
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
    // /settings/pricing belongs to Story 3.4 — it must NOT be reachable/linked here.
    await expect(nav.getByRole("link", { name: "Prissättning" })).toHaveCount(0);
  });
});

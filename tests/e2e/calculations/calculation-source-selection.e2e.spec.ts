/**
 * Story 5.3 — pricing-SOURCE selection in the row editor (AC6, P1/P2 E2E —
 * test-design-epic-5.md 5.2-E2E-05 deferred-label absence continues to hold). GREEN.
 *
 * MIRRORS `tests/e2e/calculations/calculations.e2e.spec.ts` (the Story 5.2 editor E2E) EXACTLY:
 * the same `signIn`/`waitForHydrated` helpers, the same seeded two-tenant fixture read from
 * `tests/e2e/.auth/fixture.json`, the same `getByTestId`/`getByLabel` UI contract, Swedish
 * labels. This suite asserts the AC6 source-selection affordance: choosing a work role on a
 * labor row / an article on a material row PREFILLS the row price + shows a provenance line;
 * a manual (no-source) row still saves; NO supplier/import/API/deferred-workflow label
 * appears; the nav stays exactly aligned with active manifest modules.
 *
 * The global-setup fixture seeds ONE active work role + ONE active article in adminA's tenant
 * and exposes their names (`fixture.workRole.displayName` / `fixture.article.name`) so the
 * source pick is deterministic.
 *
 * Runs against the REAL app + local Supabase stack + the two-tenant fixture (Playwright).
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expectActiveAdminNavigation } from "../support/active-admin-navigation";

interface CalcFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  readonly calc: {
    readonly id: string;
    readonly title: string;
    readonly sectionId: string;
    readonly rowIds: readonly string[];
  };
  // Story 5.3 dev extends the fixture with an active work role + article to select. Read
  // defensively (optional) so this scaffold type-checks against today's fixture shape.
  readonly workRole?: { readonly id: string; readonly displayName: string };
  readonly article?: { readonly id: string; readonly name: string };
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

test.describe("Calculation row pricing-source selection (Story 5.3 E2E / AC6)", () => {
  test("5.3-E2E-01 (AC1/AC6): selecting a WORK ROLE on a labor row prefills the price + shows provenance", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);

    // The first row (a labor row in the seed) exposes a source-selection <select>.
    const firstRowForm = page.getByTestId("row-edit-form").first();
    const sourceSelect = firstRowForm.getByTestId("row-source-select");
    await waitForHydrated(sourceSelect);

    // Choose the seeded active work role by its display name (Swedish label, no jargon).
    const roleName = fixture.workRole?.displayName ?? "Elektriker";
    await sourceSelect.selectOption({ label: roleName });

    // The row's kronor price PREFILLS from the source rate (via the öre→kronor boundary);
    // the field stays editable (the row price is authoritative).
    const price = firstRowForm.getByLabel("Pris (kr)");
    await expect(price).not.toHaveValue("");
    await expect(price).toBeEditable();

    // A small provenance indicator shows the captured source name + rate + version.
    const provenance = firstRowForm.getByTestId("row-source-provenance");
    await expect(provenance).toBeVisible();
    await expect(provenance).toContainText(roleName);
    await expect(provenance).toContainText(/Källa/i);
  });

  test("5.3-E2E-02 (AC2/AC6): selecting an ARTICLE on a material row prefills + shows provenance", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);

    // Add a uniquely-named section + a material row this test owns (does not disturb the
    // shared single-section seed flows).
    const uniqueTitle = `Material ${crypto.randomUUID().slice(0, 8)}`;
    await page.getByTestId("add-section").click();
    const addForm = page.getByTestId("add-section-form");
    await addForm.getByLabel(/Sektionstitel/).fill(uniqueTitle);
    await addForm.getByRole("button", { name: /Skapa sektion/ }).click();
    const section = page.getByTestId("section-editor").filter({ hasText: uniqueTitle });
    await expect(section).toBeVisible();

    // Open the add-row form in the new (empty) section — it is the create-row RowEditor.
    await section.getByTestId("add-row").click();
    const rowForm = section.getByTestId("row-create-form").first();
    // Switch the row to a material type so the ARTICLE source list is offered.
    await rowForm.getByLabel(/Typ|Radtyp/).selectOption({ value: "material" });
    const sourceSelect = rowForm.getByTestId("row-source-select");
    await waitForHydrated(sourceSelect);
    const articleName = fixture.article?.name ?? "Kabel 3G1.5";
    await sourceSelect.selectOption({ label: articleName });

    const price = rowForm.getByLabel("Pris (kr)");
    await expect(price).not.toHaveValue("");
    const provenance = rowForm.getByTestId("row-source-provenance");
    await expect(provenance).toBeVisible();
    await expect(provenance).toContainText(articleName);
  });

  test("5.3-E2E-03 (AC1/AC6): a MANUAL row (source = 'manual / no source') still saves", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);

    const firstRowForm = page.getByTestId("row-edit-form").first();
    const sourceSelect = firstRowForm.getByTestId("row-source-select");
    await waitForHydrated(sourceSelect);
    // The "manual / no source" option is always available and is the default; it submits
    // an empty value (no source_kind/source_id) — a manual row (isPresent('')===false).
    await sourceSelect.selectOption({ value: "" });

    const price = firstRowForm.getByLabel("Pris (kr)");
    await price.fill("750");
    await firstRowForm.getByRole("button", { name: /Spara rad/ }).click();

    // The manual save round-trips (no aria-invalid); no provenance indicator is shown.
    await expect(price).not.toHaveAttribute("aria-invalid", "true");
    await expect(firstRowForm.getByTestId("row-source-provenance")).toHaveCount(0);
  });

  test("5.3-E2E-04 (AC6): the source affordance shows NO supplier/import/API/deferred label", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);
    const editor = page.getByTestId("calculation-editor");
    await expect(editor).toBeVisible();
    // The source selection introduces provenance vocabulary (prislista/källa) but NEVER a
    // supplier/import/API/sync/fortnox/deferred-workflow control or label (5.2-E2E-05 holds).
    await expect(
      editor.getByText(/leverantör|supplier|fortnox|import|synk|api\b|kreditiv|credential/i),
    ).toHaveCount(0);
    await expect(
      editor.getByText(/fältarbetare|projektplan|ÄTA|AI\b/i),
    ).toHaveCount(0);
  });

  test("5.3-E2E-05 (AC6): the nav stays EXACTLY aligned with active manifest modules", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/calculations/${fixture.calc.id}`);
    const nav = page.getByRole("navigation", { name: "Huvudnavigation" }).first();
    await expectActiveAdminNavigation(nav);
  });
});

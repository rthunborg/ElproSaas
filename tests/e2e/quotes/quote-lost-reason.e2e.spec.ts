/**
 * Story 10.2 — ATDD RED-PHASE scaffold: the `Markera som förlorad/avböjd` dialog + terminal badge +
 * reason surfacing (10.2-E2E-01, P1, AC1/AC2/AC4, R-1050).
 *
 * STATES + MESSAGING ONLY — the append-only / status-only ENFORCEMENT is INT/RLS territory (a test
 * that only drives the UI is NOT immutability evidence; architecture §9). Do NOT assert DB rejection
 * here. Two-runner discipline (epic-10 retro): the pure transition map + validator are node:test
 * UNIT, the migration/RPC/RLS are Vitest INT/RLS — ONLY the dialog is Playwright E2E. No browser
 * recording was run to author this scaffold (the surface does not exist yet).
 *
 * Coverage (the story's AC1/AC2/AC4 UI contract):
 *   - On a SENT version, `Markera som förlorad/avböjd` is offered ALONGSIDE `Registrera accept`
 *     (and is NOT offered on a draft/accepted/lost version).
 *   - The dialog REQUIRES an outcome (`Förlorad` | `Avböjd`) AND a structured reason: a category from
 *     the strawman (`Pris`, `Konkurrent`, `Tidplan`, `Uteblivet svar`, `Annat`) PLUS a free-text note;
 *     the note is REQUIRED (client-validated) when the category is `Annat`; confirm is blocked until
 *     outcome + a valid reason are supplied.
 *   - The confirmation copy states plainly: append-only lifecycle event, the SENT SNAPSHOT DOES NOT
 *     CHANGE, and a NEW VERSION can still revive the deal (explicit confirm — never undo-based, UX l.432).
 *   - After confirm, the version badge renders the terminal `Förlorad/Avböjd` style DISTINCT from
 *     `Accepterad`, with the specific outcome + reason visible on the version card and the `lost` event
 *     visible in `Händelser`.
 *   - The quote list exposes a `Förlorad/Avböjd` status-filter value (→ status='lost') and a
 *     `Förlustorsak` column in that filter view (AC4).
 *
 * ── WHY `test.describe.skip` (RED PHASE) ──────────────────────────────────────────────────────────
 * `MarkLostButton.tsx` + the server action + the list surfacing do NOT exist yet (Task 5 is the DEV
 * phase), and the two-tenant fixture is not yet extended with a dedicated lost-target sent version.
 * The suite is `test.describe.skip` so it cannot fail CI before the surface exists. GREEN phase:
 *   1. extend `global-setup.ts` to seed a `markLostQuote` (a sent version dedicated to the flip) +
 *      expose its ids on `fixture.json`;
 *   2. implement Task 5 (dialog + action + card/list surfacing) with stable `getByTestId`/`getByRole`
 *      handles matching the selectors below;
 *   3. remove `.skip`. The assertions are the CONTRACT — do not weaken them.
 *
 * Mirrors `quote-sent-lock.e2e.spec.ts` (6.4) signIn/waitForHydrated helpers + the `getByTestId`/
 * `getByRole` UI contract; two-tenant fixture, `crypto.randomUUID()` seeds.
 *
 * [Source: story 10.2 AC1/AC2/AC4 + Task 5 + Dev Notes "Oracle terminology (resolved)";
 *  test-design-epic-10.md#10.2-E2E-01, R-1050; ux-design-specification-phase-b.md ll.163-169 / l.432;
 *  tests/e2e/quotes/quote-sent-lock.e2e.spec.ts (the fixture + helpers to mirror)]
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface QuoteFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  /** GREEN: a dedicated quote whose current version is SENT and mark-lost-able. */
  readonly markLostQuote?: {
    readonly id: string;
    readonly sentVersionId: string;
  };
}

// Guarded read — an absent/legacy fixture (RED phase, before global-setup seeds markLostQuote) must
// not throw at collection. The suite is skipped regardless.
const FIXTURE_PATH = path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json");
const fixture: QuoteFixture = existsSync(FIXTURE_PATH)
  ? (JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as QuoteFixture)
  : ({ adminA: { email: "", password: "" } } as QuoteFixture);

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

test.describe.skip("Quote Förlorad/Avböjd dialog + terminal badge (Story 10.2 E2E)", () => {
  test("10.2-E2E-01: the dialog requires outcome + a structured reason (note required on Annat), confirm blocked until valid", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.markLostQuote!.id}/versions/${fixture.markLostQuote!.sentVersionId}`);

    // The affordance appears on a SENT version alongside the accept affordance.
    const markLost = page.getByRole("button", { name: /Markera som förlorad\/avböjd/i });
    await waitForHydrated(markLost);
    await expect(page.getByRole("button", { name: /Registrera accept/i })).toBeVisible();
    await markLost.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Confirm is disabled until an outcome + a valid reason are supplied.
    const confirm = dialog.getByRole("button", { name: /Bekräfta|Markera/i });
    await expect(confirm).toBeDisabled();

    // Choosing Annat requires a free-text note before confirm enables.
    await dialog.getByRole("radio", { name: /Förlorad/i }).check();
    await dialog.getByLabel(/Orsak|Kategori/i).selectOption({ label: "Annat" });
    await expect(confirm).toBeDisabled(); // note still empty on Annat
    await dialog.getByLabel(/Notering|Fritext/i).fill("kunden valde en annan leverantör");
    await expect(confirm).toBeEnabled();

    // The confirmation copy states the append-only / snapshot-unchanged / revive-via-new-version rule.
    await expect(dialog).toContainText(/ändrar inte det skickade|snapshot|ny version/i);
  });

  test("10.2-E2E-01: after confirm, the terminal Förlorad/Avböjd badge is DISTINCT from Accepterad and the reason shows on the card + in Händelser", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.markLostQuote!.id}/versions/${fixture.markLostQuote!.sentVersionId}`);

    const markLost = page.getByRole("button", { name: /Markera som förlorad\/avböjd/i });
    await waitForHydrated(markLost);
    await markLost.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /Avböjd/i }).check();
    await dialog.getByLabel(/Orsak|Kategori/i).selectOption({ label: "Pris" });
    await dialog.getByRole("button", { name: /Bekräfta|Markera/i }).click();

    // The terminal badge conveys status as TEXT (Förlorad/Avböjd), visually distinct from Accepterad.
    const badge = page.getByTestId("quote-version-status-badge");
    await expect(badge).toHaveText(/Förlorad\/Avböjd/i);
    // The specific outcome + reason are surfaced on the version card and in the event timeline.
    await expect(page.getByTestId("quote-lost-reason")).toContainText(/Avböjd/i);
    await expect(page.getByTestId("quote-lost-reason")).toContainText(/Pris/i);
    await expect(page.getByRole("region", { name: /Händelser/i })).toContainText(/Förlorad\/Avböjd/i);
  });

  test("10.2-E2E-01 (AC4): the quote list exposes a Förlorad/Avböjd status filter + a Förlustorsak column", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/quotes");

    // The status filter offers Förlorad/Avböjd (mapping to status='lost').
    await page.getByLabel(/Status/i).selectOption({ label: "Förlorad/Avböjd" });
    // In that filter view a Förlustorsak column surfaces the joined reason.
    await expect(page.getByRole("columnheader", { name: /Förlustorsak/i })).toBeVisible();
  });
});

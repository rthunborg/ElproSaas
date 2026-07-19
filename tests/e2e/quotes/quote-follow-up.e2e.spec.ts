/**
 * Story 10.3 — ATDD RED-PHASE scaffold: the `Planera uppföljning` dialog + next-follow-up chip +
 * overdue badge + `Klarmarkera` completion sheet with the decide-here jumps (10.3-E2E-01, P1,
 * AC1/AC2/AC3; test-design-epic-10.md R-1050-class).
 *
 * SURFACES + MESSAGING ONLY — the one-open enforcement, the audit rows, and the Europe/Stockholm
 * boundary math are INT/UNIT territory (a test that only drives the UI is NOT enforcement evidence;
 * architecture §9). Do NOT assert DB rejection or audit here. Two-runner discipline (epic-10 retro):
 * the pure due/overdue + selection logic + validators are node:test UNIT, the migration/commands/RLS
 * are Vitest INT/RLS — ONLY the dialog/sheet/chip/badge/filters are Playwright E2E. No browser
 * recording was run to author this scaffold (the surface does not exist yet).
 *
 * Coverage (the story's AC1/AC2/AC3 UI contract):
 *   - On a SENT version, `Planera uppföljning` is offered alongside accept / mark-lost; the dialog takes
 *     a DUE DATE + a note and confirms; afterwards the detail header shows the next-follow-up chip.
 *   - An OVERDUE open follow-up escalates the chip/badge visually (StatusBadge/ConnectionChip contract).
 *   - `Klarmarkera` opens the completion sheet: an outcome note + confirm; after completion the sheet
 *     offers `planera nästa` (re-open the plan dialog), `Markera som förlorad/avböjd` (the shipped 10.2
 *     dialog), and `Ny version`.
 *   - The quote list exposes the `Har uppföljning` + `Försenad uppföljning` filters and an overdue badge
 *     on rows with an overdue open follow-up.
 *
 * ── WHY `test.describe.skip` (RED PHASE) ──────────────────────────────────────────────────────────
 * `PlanFollowUpButton.tsx` + `FollowUpSheet.tsx` + the server actions + the chip/list surfacing do NOT
 * exist yet (Task 5 is the DEV phase), and the two-tenant fixture is not yet extended with a
 * follow-up-target sent version (open + overdue seeds). The suite is `test.describe.skip` so it cannot
 * fail CI before the surface exists. GREEN phase:
 *   1. extend `global-setup.ts` to seed a `followUpQuote` (a sent version) + an overdue open follow-up +
 *      expose their ids on `fixture.json`;
 *   2. implement Task 5 (dialog + sheet + chip + list filters/badge) with stable `getByTestId`/
 *      `getByRole` handles matching the selectors below;
 *   3. remove `.skip`. The assertions are the CONTRACT — do not weaken them.
 *
 * Mirrors `quote-lost-reason.e2e.spec.ts` (10.2) signIn/waitForHydrated helpers + the guarded-fixture
 * read; two-tenant fixture, `crypto.randomUUID()` seeds; anonymized shape-only follow-up notes.
 *
 * [Source: story 10.3 AC1/AC2/AC3 + Task 5 + Dev Notes "Reuse — StatusBadge/ConnectionChip";
 *  ux-design-specification-phase-b.md ll.171-176 (Planera/Klarmarkera/planera nästa/jumps/overdue);
 *  tests/e2e/quotes/quote-lost-reason.e2e.spec.ts (the fixture + helpers to mirror)]
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface QuoteFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  /** GREEN: a dedicated quote whose current version is SENT + follow-up-able. */
  readonly followUpQuote?: {
    readonly id: string;
    readonly sentVersionId: string;
    /** An OPEN follow-up on this quote whose due date is in the past (overdue badge). */
    readonly overdueFollowUpId: string;
  };
}

// Guarded read — an absent/legacy fixture (RED phase, before global-setup seeds followUpQuote) must not
// throw at collection. The suite is skipped regardless.
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

test.describe.skip("Quote follow-up dialog + chip + completion sheet (Story 10.3 E2E)", () => {
  test("10.3-E2E-01: Planera uppföljning takes a due date + note and renders the next-follow-up chip", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.followUpQuote!.id}/versions/${fixture.followUpQuote!.sentVersionId}`);

    const planBtn = page.getByRole("button", { name: /Planera uppföljning/i });
    await waitForHydrated(planBtn);
    await planBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole("button", { name: /Planera|Spara|Bekräfta/i });
    await expect(confirm).toBeDisabled(); // blocked until a due date is supplied
    await dialog.getByLabel(/Förfallodatum|Datum/i).fill("2026-09-01");
    await dialog.getByLabel(/Notering|Anteckning/i).fill("ring kund om beslut");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // The detail header now shows the next-follow-up chip (ConnectionChip contract).
    await expect(page.getByTestId("next-follow-up-chip")).toBeVisible();
  });

  test("10.3-E2E-01: an OVERDUE open follow-up escalates the chip/badge visually", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.followUpQuote!.id}/versions/${fixture.followUpQuote!.sentVersionId}`);

    const chip = page.getByTestId("next-follow-up-chip");
    await expect(chip).toBeVisible();
    // The overdue state surfaces as an escalated badge (text + a data attribute the StatusBadge sets).
    await expect(chip).toContainText(/Försenad|Överfallen|Överdue|Försenad uppföljning/i);
    await expect(chip).toHaveAttribute("data-overdue", "true");
  });

  test("10.3-E2E-01: Klarmarkera records an outcome and the sheet offers planera nästa + the decide-here jumps", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.followUpQuote!.id}/versions/${fixture.followUpQuote!.sentVersionId}`);

    const klarBtn = page.getByRole("button", { name: /Klarmarkera/i });
    await waitForHydrated(klarBtn);
    await klarBtn.click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const confirm = sheet.getByRole("button", { name: /Klarmarkera|Spara|Bekräfta/i });
    await expect(confirm).toBeDisabled(); // outcome note required
    await sheet.getByLabel(/Utfall|Resultat|Notering/i).fill("kund vill ha ny version");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // After completion the sheet offers the decide-here affordances.
    await expect(page.getByRole("button", { name: /planera nästa/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Markera som förlorad\/avböjd/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Ny version/i })).toBeVisible();
  });

  test("10.3-E2E-01 (AC2): the quote list exposes Har uppföljning + Försenad uppföljning filters + an overdue badge", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/quotes");

    // The follow-up attribute filters return the correct rows (functional, not decorative).
    await page.getByRole("button", { name: /Har uppföljning/i }).click();
    await expect(page.getByTestId("quote-row-overdue-follow-up-badge").first()).toBeVisible();
    await page.getByRole("button", { name: /Försenad uppföljning/i }).click();
    // In the overdue-filter view every visible row carries the overdue follow-up badge.
    await expect(page.getByTestId("quote-row-overdue-follow-up-badge").first()).toBeVisible();
  });
});

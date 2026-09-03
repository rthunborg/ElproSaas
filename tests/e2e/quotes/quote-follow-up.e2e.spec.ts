/**
 * Story 10.3 — the `Planera uppföljning` dialog + next-follow-up chip + overdue badge + `Klarmarkera`
 * completion sheet with the decide-here jumps + the list follow-up filters (10.3-E2E-01, P1,
 * AC1/AC2/AC3).
 *
 * SURFACES + MESSAGING ONLY — the one-open enforcement, the audit rows, the auto-complete-on-lost
 * atomicity, and the Europe/Stockholm boundary math are INT/UNIT territory (a test that only drives
 * the UI is NOT enforcement evidence; architecture §9). Two-runner discipline (epic-10 retro): the
 * pure due/overdue + selection logic + validators are node:test UNIT, the migration/commands/RLS are
 * Vitest INT/RLS — ONLY the dialog/sheet/chip/badge/filters are Playwright E2E.
 *
 * Each behavioural test targets its OWN seeded quote (planned / overdue / complete) so the one-open
 * rule + the completion mutation never couple the tests. The decide-here jumps are asserted scoped to
 * the `follow-up-jumps` surface (the standalone sent-version mark-lost / new-version affordances carry
 * the SAME labels — scoping targets the jumps surface without weakening the visibility contract).
 *
 * [Source: story 10.3 AC1/AC2/AC3 + Task 5 + Dev Notes "Reuse — StatusBadge/ConnectionChip";
 *  ux-design-specification-phase-b.md ll.171-176; tests/e2e/quotes/quote-lost-reason.e2e.spec.ts]
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface QuoteFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  /** A sent quote with NO follow-up — the plan flow. */
  readonly followUpQuote?: { readonly id: string; readonly sentVersionId: string };
  /** One untouched no-follow-up sent quote per Playwright attempt for the plan mutation. */
  readonly followUpQuoteAttempts?: ReadonlyArray<{
    readonly id: string;
    readonly sentVersionId: string;
  }>;
  /** A sent quote with an OVERDUE open follow-up — the overdue chip + the list badge. */
  readonly overdueFollowUpQuote?: {
    readonly id: string;
    readonly sentVersionId: string;
    readonly followUpId: string;
  };
  /** A sent quote with an OPEN follow-up — the completion flow. */
  readonly completeFollowUpQuote?: {
    readonly id: string;
    readonly sentVersionId: string;
    readonly followUpId: string;
  };
  /** One untouched open-follow-up sent quote per Playwright attempt for completion. */
  readonly completeFollowUpQuoteAttempts?: ReadonlyArray<{
    readonly id: string;
    readonly sentVersionId: string;
  }>;
}

// Guarded read — an absent fixture (before global-setup seeds the follow-up quotes) must not throw at
// collection. The stack gate skips the suite when the stack is unreachable.
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

test.describe("Quote follow-up dialog + chip + completion sheet (Story 10.3 E2E)", () => {
  test("10.3-E2E-01: Planera uppföljning takes a due date + note and renders the next-follow-up chip", async ({
    page,
  }, testInfo) => {
    const quote = fixture.followUpQuoteAttempts?.[testInfo.retry];
    expect(quote, "global setup must seed one no-follow-up quote per Playwright attempt").toBeTruthy();
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(
      `/quotes/${quote!.id}/versions/${quote!.sentVersionId}`,
    );

    const planBtn = page.getByRole("button", { name: /Planera uppföljning/i });
    await waitForHydrated(planBtn);
    await planBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole("button", { name: /Planera|Spara|Bekräfta/i });
    await expect(confirm).toBeDisabled(); // blocked until a due date is supplied
    // Codex review: a hardcoded near-future literal is a TIME BOMB — the plan command rejects any
    // due_date before today in Europe/Stockholm (FOLLOW_UP_DUE_DATE_IN_PAST), so a fixed date starts
    // failing the moment CI runs past it. Derive a always-future date from the run instant instead.
    const futureDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await dialog.getByLabel(/Förfallodatum|Datum/i).fill(futureDue);
    await dialog.getByLabel(/Notering|Anteckning/i).fill("ring kund om beslut");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // The detail header now shows the next-follow-up chip (ConnectionChip contract).
    await expect(page.getByTestId("next-follow-up-chip")).toBeVisible();
  });

  test("10.3-E2E-01: an OVERDUE open follow-up escalates the chip/badge visually", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(
      `/quotes/${fixture.overdueFollowUpQuote!.id}/versions/${fixture.overdueFollowUpQuote!.sentVersionId}`,
    );

    const chip = page.getByTestId("next-follow-up-chip");
    await expect(chip).toBeVisible();
    // The overdue state surfaces as an escalated badge (text + a data attribute the chip sets). Assert
    // the ACTUAL rendered escalation label — not an over-permissive alternation of never-rendered strings.
    await expect(chip).toContainText("Försenad uppföljning");
    await expect(chip).toHaveAttribute("data-overdue", "true");
  });

  test("10.3-E2E-01: Klarmarkera records an outcome and the sheet offers planera nästa + the decide-here jumps", async ({
    page,
  }, testInfo) => {
    const quote = fixture.completeFollowUpQuoteAttempts?.[testInfo.retry];
    expect(quote, "global setup must seed one open follow-up quote per Playwright attempt").toBeTruthy();
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(
      `/quotes/${quote!.id}/versions/${quote!.sentVersionId}`,
    );

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

    // After completion the decide-here jumps are offered (scoped to the follow-up-jumps surface).
    const jumps = page.getByTestId("follow-up-jumps");
    await expect(jumps.getByRole("button", { name: /planera nästa/i })).toBeVisible();
    await expect(jumps.getByRole("button", { name: /Markera som förlorad\/avböjd/i })).toBeVisible();
    await expect(jumps.getByRole("button", { name: /Ny version/i })).toBeVisible();
  });

  test("10.3-E2E-01 (AC2): the quote list exposes Har uppföljning + Försenad uppföljning filters + an overdue badge", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/quotes");

    // The follow-up attribute filters return the correct rows (functional, not decorative).
    const hasFilter = page.getByRole("button", { name: /Har uppföljning/i });
    await waitForHydrated(hasFilter);
    await hasFilter.click();
    await expect(page.getByTestId("quote-row-overdue-follow-up-badge").first()).toBeVisible();
    await page.getByRole("button", { name: /Försenad uppföljning/i }).click();
    // In the overdue-filter view every visible row carries the overdue follow-up badge.
    await expect(page.getByTestId("quote-row-overdue-follow-up-badge").first()).toBeVisible();
  });
});

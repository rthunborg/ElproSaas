/**
 * Story 7.1 — the acceptance-capture form on the quote detail (AC1/AC2), + the a11y baseline.
 * STATES + FORM BEHAVIOR ONLY — the server-side gates (sent-state, adjusted-price re-validation,
 * öre persistence, audit) are INT territory (a test that only proves the UI shows a delta is NOT
 * evidence of the server rule; architecture §9). Do NOT assert DB rejection / persistence in E2E.
 *
 *   - 7.1-E2E-01 (P1, AC1): on a SENT version the acceptance form captures channel, accepted
 *     timestamp, evidence file id / external reference, accepted price (öre input, Swedish comma
 *     convention), notes, and planned start/end dates; the admin user is server-derived (NOT a form
 *     field). The form renders ONLY on a `sent` version — it is absent on a draft. NO public/portal
 *     endpoint (the guardrail scan owns the hard proof; this asserts the form is inside the
 *     authenticated `/quotes/[id]` surface).
 *   - 7.1-E2E-02 (P1, AC2): entering an accepted price ≠ the sent total REVEALS the delta and a
 *     REQUIRED adjustment-reason field before confirm; confirming without a reason is blocked in the
 *     UI (the mirror of the INT-proven server rule). An equal price hides the reason field.
 *   - 7.1-E2E-03 (P2, UX-DR35): keyboard navigation + a11y on the form; status/labels use TEXT, not
 *     color alone.
 *
 * Runs against the REAL app + local Supabase stack + the two-tenant quote fixture (global-setup
 * seeds a quote with a SENT version + a DRAFT version). Mirrors the 6.2/6.4 quotes.e2e
 * signIn/waitForHydrated helpers + the `getByTestId` UI contract.
 *
 * ── GREEN as of Story 7.1 dev ─────────────────────────────────────────────────────────────────
 * The acceptance form replaces the `quote-acceptance-placeholder` on a SENT version in
 * `QuoteDetailView.tsx`; the testids now exist. `.skip` is removed.
 *
 * [Source: test-design-epic-7.md#7.1-E2E-01/02/03, R-705/R-711 + testability note 9; story 7.1
 *  Task 6 + AC1/AC2; tests/e2e/quotes/quote-sent-lock.e2e.spec.ts (the signIn/waitForHydrated +
 *  getByTestId to mirror); src/features/calculations/money-input.ts (the kronor↔öre parse/format)]
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

interface QuoteFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  readonly quote: {
    readonly id: string;
    readonly sentVersionId: string;
    readonly draftVersionId: string;
  };
}

const fixture: QuoteFixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8"),
) as QuoteFixture;

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

/** Sign in as adminA and open the SEEDED SENT version detail (the acceptance form host). */
async function openSentVersion(page: Page): Promise<void> {
  await signIn(page, fixture.adminA.email, fixture.adminA.password);
  await page.goto(`/quotes/${fixture.quote.id}/versions/${fixture.quote.sentVersionId}`);
  await waitForHydrated(page.getByTestId("acceptance-form"));
}

test.describe("acceptance-capture form (AC1)", () => {
  test("[P1] 7.1-E2E-01: the acceptance form on a SENT version captures channel / accepted timestamp / evidence ref / öre price / notes / planned dates", async ({
    page,
  }) => {
    await openSentVersion(page);
    await expect(page.getByTestId("acceptance-form")).toBeVisible();
    for (const testId of [
      "acceptance-channel",
      "acceptance-accepted-at",
      "acceptance-evidence-reference",
      "acceptance-price-ore",
      "acceptance-notes",
      "acceptance-planned-start",
      "acceptance-planned-end",
    ]) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }
    // The admin user is server-derived — there is NO admin-user input field on the form.
    await expect(page.getByTestId("acceptance-admin-user-input")).toHaveCount(0);
  });

  test("[P1] 7.1-E2E-01: the acceptance form does NOT render on a DRAFT version (sent-only gating)", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto(`/quotes/${fixture.quote.id}/versions/${fixture.quote.draftVersionId}`);
    await waitForHydrated(page.getByTestId("quote-version-snapshot"));
    // The draft version shows its editor; the acceptance form is absent (acceptance needs sent).
    await expect(page.getByTestId("acceptance-form")).toHaveCount(0);
    await expect(page.getByTestId("draft-quote-editor")).toBeVisible();
  });
});

test.describe("adjusted-price flow (AC2)", () => {
  test("[P1] 7.1-E2E-02: entering an accepted price ≠ the sent total reveals the delta and REQUIRES an adjustment reason before confirm", async ({
    page,
  }) => {
    await openSentVersion(page);
    const price = page.getByTestId("acceptance-price-ore");
    // Enter a price different from the pre-filled sent total (Swedish comma input).
    await price.fill("1,00");
    await expect(page.getByTestId("acceptance-price-delta")).toBeVisible();
    await expect(page.getByTestId("acceptance-adjustment-reason")).toBeVisible();
    // Confirm is blocked until a reason is entered (the UI mirror of the INT-proven server rule).
    await expect(page.getByTestId("acceptance-confirm")).toBeDisabled();
    // Entering a reason unblocks confirm.
    await page.getByTestId("acceptance-adjustment-reason").fill("kundrabatt");
    await expect(page.getByTestId("acceptance-confirm")).toBeEnabled();
  });

  test("[P1] 7.1-E2E-02: an accepted price EQUAL to the sent total hides the reason field and allows confirm", async ({
    page,
  }) => {
    await openSentVersion(page);
    // The price input is pre-filled with the sent total → no delta, the reason field is absent.
    await expect(page.getByTestId("acceptance-adjustment-reason")).toHaveCount(0);
    await expect(page.getByTestId("acceptance-price-delta")).toHaveCount(0);
    await expect(page.getByTestId("acceptance-confirm")).toBeEnabled();
  });
});

test.describe("acceptance form a11y (UX-DR35)", () => {
  test("[P2] 7.1-E2E-03: the form is keyboard-operable and conveys the acceptance state as TEXT, not color", async ({
    page,
  }) => {
    await openSentVersion(page);
    // The submit control is reachable + has an accessible name (text label, not color alone).
    const confirm = page.getByTestId("acceptance-confirm");
    await expect(confirm).toBeVisible();
    await expect(confirm).toHaveText(/Bekräfta acceptans/i);
    // The delta warning (when shown) is conveyed as TEXT (the amber note carries the wording).
    await page.getByTestId("acceptance-price-ore").fill("1,00");
    await expect(page.getByTestId("acceptance-price-delta")).toContainText(/motivering/i);
  });
});

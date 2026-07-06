/**
 * Story 7.2 — the acceptance UI RE-POINTED at the transactional path (Task 4) + the affordance-gating
 * carry (Task 5). STATES + UI BEHAVIOR ONLY — the transaction's idempotency/atomicity/cross-tenant
 * guarantees are INT territory (`accept-quote-and-create-job.int.test.ts`); a test that only proves
 * the UI shows the accepted state is NOT evidence of the server rule (architecture §9). Do NOT assert
 * DB idempotency/persistence in E2E.
 *
 *   - 7.2-E2E-01 (AC1, UX-DR24): confirming acceptance on a SENT version runs the transactional
 *     `acceptQuoteAndCreateJob` (records the acceptance + creates the job in one atomic call). After
 *     success the version reads as `accepted`. A REPEAT attempt (reload / re-open) shows the EXISTING
 *     accepted state — NOT a fresh acceptance form, NOT an error, NOT a duplicate (the idempotent UX
 *     mirror; the deep job-view lands in 7.3).
 *   - 7.2-E2E-02 (Task 5, epic-6 gate carry): on an ACCEPTED version the new-version + PDF-retry
 *     affordances are GATED OFF — `create-new-version` and the PDF-retry control do NOT mount on an
 *     accepted version (architecture §12 scopes PDF retry + new-version to draft/sent, never accepted).
 *     7.2 is the first story that makes `accepted` reachable, so 7.2 owns this gating.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * GREEN as of Story 7.2 dev. The acceptance form is re-pointed at `acceptQuoteAndCreateJob` (Task 4)
 * and the accepted-version affordance-gating (Task 5) lands; `.skip` removed. Runs against a
 * DEDICATED `acceptQuote` fixture (global-setup) whose single SENT version this flow permanently
 * ACCEPTS — so it never disturbs the shared 6.2/7.1 quote whose sent version the acceptance-FORM
 * tests need to stay `sent`.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Runs against the REAL app + local Supabase stack + the two-tenant quote fixture. Mirrors
 * `quote-acceptance-capture.e2e.spec.ts` signIn/waitForHydrated + the `getByTestId` UI contract. NO
 * public/portal/webhook route (the guardrail scan owns the hard proof; this asserts the flow stays
 * inside the authenticated `/quotes/[id]` surface).
 *
 * [Source: test-design-epic-7.md#7.2 (AC1/UX-DR24) + the affordance-gating carry (deferred-work
 *  epic-6 review → Epic 7); story 7.2 Task 4 + Task 5; tests/e2e/quotes/quote-acceptance-capture.
 *  e2e.spec.ts (the form host + signIn helpers to mirror); tests/e2e/quotes/quote-new-version.e2e.
 *  spec.ts (`create-new-version` testid); tests/e2e/quotes/quote-pdf-states.e2e.spec.ts
 *  (`quote-pdf-status` testid)]
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

interface QuoteFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  readonly acceptQuote: {
    readonly id: string;
    readonly sentVersionId: string;
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

async function openSentVersion(page: Page): Promise<void> {
  await signIn(page, fixture.adminA.email, fixture.adminA.password);
  await page.goto(
    `/quotes/${fixture.acceptQuote.id}/versions/${fixture.acceptQuote.sentVersionId}`,
  );
  await waitForHydrated(page.getByTestId("acceptance-form"));
}

/** Open the (now-accepted) version directly, waiting for the snapshot block (no sent form). */
async function openAcceptedVersion(page: Page): Promise<void> {
  await signIn(page, fixture.adminA.email, fixture.adminA.password);
  await page.goto(
    `/quotes/${fixture.acceptQuote.id}/versions/${fixture.acceptQuote.sentVersionId}`,
  );
  await waitForHydrated(page.getByTestId("quote-version-snapshot"));
}

// SERIAL: the dedicated acceptQuote sent version is a ONE-SHOT resource — the first test
// PERMANENTLY flips it to `accepted` + creates the job, and the later tests operate on the now-
// accepted version. Ordering matters, so the whole flow is `.serial`.
test.describe.serial("accept + create job — transactional confirm + accepted gating (AC1, UX-DR24, Task 5)", () => {
  test("[P1] 7.2-E2E-01: confirming acceptance on a SENT version accepts it and the version reads as accepted (the transactional path)", async ({
    page,
  }) => {
    await openSentVersion(page);
    // Supply the REQUIRED accepted moment (H1 — an explicit input, not a wall-clock). The price is
    // pre-filled with the sent total, so no adjustment reason is required and confirm is enabled.
    await page.getByTestId("acceptance-accepted-at").fill("2026-07-10T08:30");
    // The confirm control runs acceptQuoteAndCreateJob (records acceptance + creates the job atomically).
    const confirm = page.getByTestId("acceptance-confirm");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    // After success the version surfaces its accepted state (the acceptance form is no longer offered).
    await expect(page.getByTestId("quote-acceptance-accepted")).toBeVisible();
    await expect(page.getByTestId("acceptance-form")).toHaveCount(0);
  });

  test("[P1] 7.2-E2E-01: a REPEAT attempt (re-open) shows the EXISTING accepted state — no duplicate form, no error (idempotent UX mirror)", async ({
    page,
  }) => {
    // The version is already accepted (previous serial test) — re-opening shows the existing state.
    await openAcceptedVersion(page);
    await expect(page.getByTestId("quote-acceptance-accepted")).toBeVisible();
    await expect(page.getByTestId("acceptance-form")).toHaveCount(0);
    // No error surface presented on the repeat.
    await expect(page.getByTestId("acceptance-error")).toHaveCount(0);
  });

  test("[P1] 7.2-E2E-02: on the ACCEPTED version the new-version + PDF-retry affordances are NOT mounted (Task 5)", async ({
    page,
  }) => {
    await openAcceptedVersion(page);
    await expect(page.getByTestId("quote-acceptance-accepted")).toBeVisible();
    // Architecture §12: PDF retry + new-version are scoped to draft/sent, NEVER accepted.
    await expect(page.getByTestId("create-new-version")).toHaveCount(0);
    await expect(page.getByTestId("quote-pdf-status")).toHaveCount(0);
  });
});

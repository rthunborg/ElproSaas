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
 * RED PHASE (ATDD, Story 7.2). The acceptance form is NOT yet re-pointed at `acceptQuoteAndCreateJob`
 * and the accepted-version affordance-gating does NOT exist. This whole spec is `test.describe.skip`
 * until the Task-4 re-point + Task-5 gating land; the GREEN pass removes `.skip`. Each test asserts
 * the EXPECTED post-implementation behaviour — do NOT weaken an assertion to pass early.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Runs against the REAL app + local Supabase stack + the two-tenant quote fixture (global-setup seeds
 * a quote with a SENT version). Mirrors `quote-acceptance-capture.e2e.spec.ts` signIn/waitForHydrated
 * + the `getByTestId` UI contract. NO public/portal/webhook route (the guardrail scan owns the hard
 * proof; this asserts the flow stays inside the authenticated `/quotes/[id]` surface).
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

async function openSentVersion(page: Page): Promise<void> {
  await signIn(page, fixture.adminA.email, fixture.adminA.password);
  await page.goto(`/quotes/${fixture.quote.id}/versions/${fixture.quote.sentVersionId}`);
  await waitForHydrated(page.getByTestId("acceptance-form"));
}

test.describe.skip("accept + create job — transactional confirm (AC1, UX-DR24)", () => {
  test("[P1] 7.2-E2E-01: confirming acceptance on a SENT version accepts it and the version reads as accepted (the transactional path)", async ({
    page,
  }) => {
    await openSentVersion(page);
    // The confirm control runs acceptQuoteAndCreateJob (records acceptance + creates the job atomically).
    const confirm = page.getByTestId("acceptance-confirm");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    // After success the version surfaces its accepted state (the acceptance form is no longer offered).
    await expect(page.getByTestId("quote-acceptance-accepted")).toBeVisible();
    await expect(page.getByTestId("acceptance-form")).toHaveCount(0);
  });

  test("[P1] 7.2-E2E-01: a REPEAT attempt (reload) shows the EXISTING accepted state — no duplicate form, no error", async ({
    page,
  }) => {
    await openSentVersion(page);
    await page.getByTestId("acceptance-confirm").click();
    await expect(page.getByTestId("quote-acceptance-accepted")).toBeVisible();
    // Re-open the SAME version — the UI shows the existing accepted state (idempotent UX mirror).
    await page.reload();
    await expect(page.getByTestId("quote-acceptance-accepted")).toBeVisible();
    await expect(page.getByTestId("acceptance-form")).toHaveCount(0);
    // No error surface presented on the repeat.
    await expect(page.getByTestId("acceptance-error")).toHaveCount(0);
  });
});

test.describe.skip("accepted-version affordance gating (Task 5, epic-6 gate carry)", () => {
  test("[P1] 7.2-E2E-02: on an ACCEPTED version the new-version + PDF-retry affordances are NOT mounted", async ({
    page,
  }) => {
    await openSentVersion(page);
    await page.getByTestId("acceptance-confirm").click();
    await expect(page.getByTestId("quote-acceptance-accepted")).toBeVisible();
    // Architecture §12: PDF retry + new-version are scoped to draft/sent, NEVER accepted.
    await expect(page.getByTestId("create-new-version")).toHaveCount(0);
    await expect(page.getByTestId("quote-pdf-status")).toHaveCount(0);
  });
});

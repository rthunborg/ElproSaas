/**
 * Story 8.5 — 8.5-E2E-01 (P2, AC1 guardrail; R-816): the LIMITED `Filer` (`/files`) index renders
 * ONLY the Phase A owner-category surface and NEVER a document-center / deferred-module surface. This
 * is the absence-of-forbidden-token discipline (mirrors `job-non-scope.test.ts` / the nav
 * deferred-module assertion), applied to the RENDERED page rather than the source tree — a live
 * assertion that the index cannot grow toward a broad document library (the 8.5 STOP boundary).
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * RED PHASE (ATDD) — every test is `test.skip`. `src/app/(app)/files/page.tsx` is still the
 * `PagePlaceholder` stub ("Den här modulen byggs i Epic 8"); the `FileIndexList` island + the
 * `data-testid="file-index"` root do NOT render yet. Story 8.5 Tasks 1.2/1.3 REPLACE the stub with the
 * `force-dynamic` server component → `FileIndexList`; Task 3.4 owns this guardrail. Remove `test.skip`
 * in dev-story green phase once the index renders. Kept skipped so the every-PR E2E gate stays green.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Coverage (STATES + STRUCTURE only — no DB assertion; enforcement/isolation is the INT/RLS suite's):
 *   - AC1: `/files` renders the limited index root (`file-index`) after sign-in.
 *   - AC1/R-816: NO deferred-module / document-center grouping or analytics label appears anywhere on
 *     the page — `toHaveCount(0)` for every forbidden deferred-file-category token (Fortnox, HR,
 *     uthyrning, tillgångar/QR, DoU, upphandling, "dokumentbibliotek", "dokumentcenter", analytics).
 *   - AC1: ONLY the fixed Phase A owner-category labels are used for grouping/filtering
 *     (Kund/Anläggning/Kontakt/Kalkyl/Offert/Acceptans/Jobb).
 *
 * Runs against the REAL app + the shared E2E global-setup fixture (adminA signs in as a real
 * `tenant_admin`). Per-run-unique keys via `crypto.randomUUID()` in any fixture seeding (the epic-3
 * flake lesson — NEVER `Date.now()`); this spec itself only reads the pre-seeded adminA.
 *
 * [Source: story 8.5 AC1 + Task 1.2/1.3/3.4; test-design-epic-8.md#R-816 (index scope creep, the 8.5
 *  STOP); architecture.md#14 (a limited file index may exist — broad document-center behavior is not
 *  Phase A); owner-decisions-applied-2026-06-18.md#Epic 8·8.5 ("keep limited for the pilot");
 *  tests/unit/guardrails/job-non-scope.test.ts (the forbidden-token discipline to mirror);
 *  tests/e2e/files/file-lock-panel.e2e.spec.ts (the sign-in + hydration helpers to reuse)]
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

interface AdminFixture {
  readonly adminA: { readonly email: string; readonly password: string };
}

const fixture: AdminFixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8"),
);

/** Deferred-module / document-center category tokens that must NEVER surface in the limited index. */
const FORBIDDEN_DEFERRED_LABELS = [
  /fortnox/i,
  /\bHR\b/,
  /uthyrning/i, // rentals
  /tillgång/i, // assets
  /\bQR\b/,
  /\bDoU\b/i, // drift & underhåll automation
  /upphandling/i, // tender/FKU
  /dokumentbibliotek/i, // "document library"
  /dokumentcenter/i, // "document center"
  /leverantör/i, // supplier
  /analys(er)?/i, // cross-module analytics/dashboards
];

/** The fixed Phase A owner-category labels the limited index is allowed to group/filter by. */
const ALLOWED_CATEGORY_LABELS = [
  "Kund",
  "Anläggning",
  "Kontakt",
  "Kalkyl",
  "Offert",
  "Acceptans",
  "Jobb",
];

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

test.describe("Limited Filer index scope guardrail (Story 8.5 E2E)", () => {
  test("8.5-E2E-01 (AC1): the /files index renders the limited index root", async ({ page }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/files");

    // The limited index island renders (replacing the PagePlaceholder stub).
    await expect(page.getByTestId("file-index")).toBeVisible();
  });

  test("8.5-E2E-01 (AC1/R-816): NO deferred-module / document-center label appears on the index", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/files");
    await expect(page.getByTestId("file-index")).toBeVisible();

    // The absence-of-forbidden-token discipline: no deferred file-category / document-center /
    // cross-module-analytics label may appear anywhere on the rendered index (the 8.5 STOP boundary).
    const body = page.locator("body");
    for (const forbidden of FORBIDDEN_DEFERRED_LABELS) {
      await expect(body).not.toHaveText(forbidden);
    }
  });

  test("8.5-E2E-01 (AC1): ONLY the fixed Phase A owner-category labels are used for grouping/filtering", async ({
    page,
  }) => {
    await signIn(page, fixture.adminA.email, fixture.adminA.password);
    await page.goto("/files");
    const index = page.getByTestId("file-index");
    await expect(index).toBeVisible();

    // The owner-category filter control exposes ONLY the seven Phase A categories — a deferred module
    // can never appear as a grouping option. (The filter control is keyboard-reachable; a11y baseline.)
    const filter = page.getByTestId("file-index-category-filter");
    await expect(filter).toBeVisible();
    for (const label of ALLOWED_CATEGORY_LABELS) {
      await expect(filter).toContainText(label);
    }
  });
});

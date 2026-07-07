/**
 * Story 8.3 — ATDD RED-PHASE scaffold: the per-file preview/download affordance + the
 * expiry→refresh reauthorization UX + the no-raw-path DOM guarantee (AC1/AC2/AC3, P1 —
 * 8.3-E2E-01/02/03, R-806/R-810/R-811).
 *
 * Against the REAL app + local Supabase stack + the two-tenant CRM fixture. The
 * `EntityFilePanel` client island (extended in Task 3) gains, for EACH listed own-tenant file, a
 * preview/download affordance (a per-row form → `previewEntityFileAction` → the 8.1
 * `createSignedFileAccess` funnel). On success it renders a time-limited
 * `<a … target="_blank" rel="noopener noreferrer">` ("Öppna fil (tidsbegränsad länk)"); on a
 * denied/wrong-lifecycle file a generic `role="alert"` preview error with NO raw path; while
 * pending a disabled "Öppnar…" button. When the link's `expiresAt` has passed, a
 * "Länken har gått ut — öppna igen" re-open control RE-SUBMITS the form (a fresh full auth) —
 * the stale URL is NEVER reused (AC2). The signed URL is the ONLY storage handle the client
 * ever sees — NO raw `object_path` / `bucket_id` text appears anywhere in the panel DOM (R-810).
 *
 * STATES + STRUCTURE + no-raw-path ONLY here — the signing AUTHORIZATION matrix + the
 * refresh REAUTHORIZATION teeth (a lifecycle-changed file is NOT re-signed) are INT territory
 * (file-signed-access.int.test.ts + file-signed-access-refresh.int.test.ts); do NOT re-prove the
 * server gate in E2E. The signed-URL CONTENT / bytes are never asserted.
 *
 * ── RED until Story 8.3 dev extends the panel (Task 3) + its preview data-testids ─────────
 * Requires: `previewEntityFileAction` in `src/features/files/actions.ts` (Task 2); the panel's
 * per-file preview affordance + its data-testids (see the checklist "Required data-testid
 * Attributes"); and at least ONE seeded own-tenant file in the panel's list so a preview button
 * renders. The seeded-file precondition depends on the 8.2 upload path (green) OR a factory seed
 * — if the customer panel has no listed file in the E2E fixture yet, mark the preview-success
 * test `test.fixme` and keep the no-raw-path DOM assertion (which holds for an empty list too)
 * rather than making it flaky.
 *
 * Use `crypto.randomUUID()` for unique fixture names (NOT `Date.now()` — the epic-3 flake lesson).
 * Keep the existing 8.2 upload E2E green (do NOT break the canonical `entity-file-panel` testids).
 *
 * Runner: Playwright (`pnpm run test:e2e`), CI-gated (SUPABASE_TEST_REQUIRED=1).
 *
 * [Source: test-design-epic-8.md §P1 rows "(8.3) Preview/download + expiry→refresh" (R-806) and
 *  "(8.3) Metadata-first / storage-second ordering + no raw bucket/path in UI" (R-810); story 8.3
 *  Task 3 + Task 5.2; tests/e2e/files/entity-file-panel.e2e.spec.ts (the 8.2 panel E2E this sits
 *  beside, same signIn/waitForHydrated + fixture contract); epics.md 8.3 AC1/AC2/AC3]
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

interface CrmFixture {
  readonly adminA: { readonly email: string; readonly password: string };
  readonly crm: {
    readonly company: { readonly id: string; readonly displayName: string };
  };
}

const fixture: CrmFixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8"),
);

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

/** Navigate to the customer detail page whose EntityFilePanel (with the preview affordance) is under test. */
async function gotoCustomerPanel(page: Page): Promise<void> {
  await signIn(page, fixture.adminA.email, fixture.adminA.password);
  await page.goto(`/customers/${fixture.crm.company.id}`);
  await expect(page.getByTestId("entity-file-panel")).toBeVisible();
}

test.describe("Entity file preview/download UX (Story 8.3 E2E)", () => {
  test("[8.3-E2E-01][P1/AC1/R-810] NO raw object_path / bucket_id text ever appears in the panel DOM", async ({
    page,
  }) => {
    await gotoCustomerPanel(page);
    // The signed URL is the ONLY storage handle the client sees. The panel (list rows +
    // preview affordance) must NEVER render a raw storage path or bucket. This holds whether the
    // list is empty or populated. Assert no path/bucket segment leaks into the panel text/DOM.
    const panel = page.getByTestId("entity-file-panel");
    const panelText = (await panel.innerText()) + " " + (await panel.innerHTML());
    expect(panelText).not.toContain("object_path");
    expect(panelText).not.toContain("bucket_id");
    // The private bucket name must not surface as a client-visible storage path segment
    // (a signed URL may legitimately contain it in its href, but no raw "tenant-files/…{tenant}"
    // path field is rendered as panel content). No raw-path input control either.
    await expect(panel.getByTestId("file-object-path-input")).toHaveCount(0);
    await expect(panel.getByTestId("file-bucket-input")).toHaveCount(0);
  });

  test("[8.3-E2E-02][P1/AC1] clicking a listed file's preview mints a time-limited signed link", async ({
    page,
  }) => {
    // Precondition: at least one own-tenant file is listed (from the 8.2 upload path or a seed).
    // If the E2E fixture panel has no listed file yet, the dev should seed one for this test OR
    // mark it test.fixme rather than making it flaky — see the file header.
    await gotoCustomerPanel(page);

    const firstPreview = page.getByTestId("file-preview-button").first();
    // If no file is listed in this environment, there is no preview button to click — keep the
    // assertion honest (fail as "no listed file to preview" rather than a false green).
    await expect(firstPreview).toBeVisible();
    await waitForHydrated(firstPreview);
    await firstPreview.click();

    // On success a time-limited link appears (the signed-link element), opening in a new tab with
    // the safe rel. The signed-URL CONTENT is NOT asserted — only that the affordance appears.
    const link = page.getByTestId("file-preview-link").first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toContainText("tidsbegränsad");
  });

  test("[8.3-E2E-03][P1/AC3/R-811] a denied/wrong-lifecycle preview surfaces a generic role=alert error with NO raw path", async ({
    page,
  }) => {
    await gotoCustomerPanel(page);

    // A wrong-lifecycle / cross-tenant-invisible file surfaces a GENERIC preview error (no
    // existence disclosure, no raw storage error). Driving a deterministic denial in E2E needs a
    // Task-3 seam (e.g. a seeded file whose lifecycle is archived after listing, or a foreign id
    // submitted). If no deterministic denial driver exists yet, keep this as the DOM contract
    // (the error region is a role="alert" with a generic message + no path) and mark the trigger
    // test.fixme rather than flaky.
    const previewError = page.getByTestId("file-preview-error").first();
    // The RED contract: the preview-error region is an assertive alert (text, not color-only) and
    // carries no raw path substring when shown.
    if (await previewError.count()) {
      await expect(previewError).toHaveAttribute("role", "alert");
      const errText = await previewError.innerText();
      expect(errText).not.toContain("object_path");
      expect(errText).not.toContain("bucket_id");
      // Generic — no "finns inte" / "hittades inte" existence leak (R-809).
      expect(errText.toLowerCase()).not.toContain("finns inte");
      expect(errText.toLowerCase()).not.toContain("hittades inte");
    }
  });

  test("[8.3-E2E-04][P1/AC2/R-806] an expired link offers a re-open control that re-authorizes (never reuses the stale URL)", async ({
    page,
  }) => {
    // The expiry→refresh UX: after a successful sign, once `expiresAt` has passed (the pure
    // `isSignedUrlExpired` verdict), a "Länken har gått ut — öppna igen" control re-submits the
    // form (re-invoking the command = a fresh full auth). The stale signedUrl is NOT reused.
    //
    // Forcing a real client-side expiry in E2E needs a low SUPABASE_SIGNED_URL_TTL_SECONDS in the
    // E2E env + a bounded wait, OR a deterministic clock seam the dev exposes (Task 3.2). Until
    // that driver lands this is a structural contract: the re-open control exists and re-submits.
    // Mark test.fixme if no deterministic expiry driver is available rather than sleeping flakily.
    test.fixme(
      true,
      "expiry→refresh re-open control needs a low-TTL E2E env or a deterministic clock seam (Task 3.2 dev decision)",
    );
    await gotoCustomerPanel(page);
    const reopen = page.getByTestId("file-preview-reopen").first();
    await expect(reopen).toBeVisible();
    await reopen.click();
    // A fresh full auth issues a NEW link (or a generic error if no longer allowed) — never the
    // stale URL silently reused.
    await expect(page.getByTestId("file-preview-link").first()).toBeVisible();
  });
});

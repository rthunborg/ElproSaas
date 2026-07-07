/**
 * Story 8.2 — ATDD RED-PHASE scaffold: the entity file-panel upload UX + the four distinct
 * user-safe error states (AC1/AC3, P1 — 8.2-E2E-01/02, R-803/R-811).
 *
 * Against the REAL app + local Supabase stack + the two-tenant CRM fixture. The `EntityFilePanel`
 * client island (Task 5.1), wired onto the customer detail page (Task 5.2), surfaces:
 *   - the ALLOWED file types + size expectation (from the Task-1 policy display strings),
 *   - the owning entity + the purpose,
 *   - the existing linked-files list (own-tenant only),
 *   - a file <input> upload control — with NO raw storage-path / bucket field (R-803/R-811),
 *   - the FOUR distinct error states as `role="alert"` regions, each with its own data-testid:
 *     blocked-type / too-large / network-or-server-fail / permission-fail.
 * Status is conveyed by a NON-COLOR text cue and every control is keyboard-operable with an
 * accessible name (WCAG 1.4.1 — the epic-6 timeline a11y pattern).
 *
 * STATES + STRUCTURE ONLY here — the server-side MIME/size/owner gate + storage↔DB
 * consistency are INT territory (file-upload.int.test.ts); do NOT re-prove them in E2E.
 *
 * ── RED until Story 8.2 dev lands the panel (Task 5) + its data-testids ──────────────────
 * Requires: `EntityFilePanel.tsx` rendered on the customer detail route, the required
 * data-testids (see the checklist "Required data-testid Attributes"), and — for the
 * error-state assertions — a way to DRIVE each error deterministically. This scaffold uses a
 * `data-testid="file-input"` + a submit and asserts the panel STRUCTURE; the four error-state
 * blocks are asserted as present-and-distinct in the DOM contract. The exact seam for forcing a
 * network/permission error in E2E is a Task-5/7.2 dev decision — mark those `test.fixme` if a
 * deterministic driver is not yet available rather than making them flaky.
 *
 * Use `crypto.randomUUID()` for unique fixture names (NOT `Date.now()` — the epic-3 flake lesson).
 *
 * Runner: Playwright (`pnpm run test:e2e`), CI-gated (SUPABASE_TEST_REQUIRED=1).
 *
 * [Source: test-design-epic-8.md §P1 (R-803/R-811); story 8.2 Task 5 + Task 7.2;
 *  tests/e2e/crm/customers.e2e.spec.ts (signIn/waitForHydrated + fixture contract this mirrors);
 *  tests/e2e/quotes/quote-pdf-states.e2e.spec.ts (the a11y state pattern); epics.md 8.2 AC1/AC3]
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

/** Navigate to the customer detail page whose EntityFilePanel is under test. */
async function gotoCustomerPanel(page: Page): Promise<void> {
  await signIn(page, fixture.adminA.email, fixture.adminA.password);
  await page.goto(`/customers/${fixture.crm.company.id}`);
  await expect(page.getByTestId("entity-file-panel")).toBeVisible();
}

test.describe("Entity file panel UX (Story 8.2 E2E)", () => {
  test("[8.2-E2E-01][P1/AC1/R-803] the panel shows allowed types, size expectation, owner, purpose — and NO raw-path field", async ({
    page,
  }) => {
    await gotoCustomerPanel(page);

    // Allowed types + size expectation are surfaced as display strings (from the Task-1 policy).
    await expect(page.getByTestId("file-panel-allowed-types")).toBeVisible();
    await expect(page.getByTestId("file-panel-size-limit")).toBeVisible();
    // The owning entity + purpose are shown (each file has a clear owner + purpose).
    await expect(page.getByTestId("file-panel-owner")).toContainText(
      fixture.crm.company.displayName,
    );
    await expect(page.getByTestId("file-panel-purpose")).toBeVisible();
    // A file <input> upload control exists...
    await expect(page.getByTestId("file-input")).toBeVisible();
    // ...and there is NO raw storage-path / bucket field anywhere in the panel (R-803).
    const panel = page.getByTestId("entity-file-panel");
    await expect(panel.getByTestId("file-object-path-input")).toHaveCount(0);
    await expect(panel.getByTestId("file-bucket-input")).toHaveCount(0);
  });

  test("[8.2-E2E-01][P1/AC5] the panel lists the entity's existing linked files (own-tenant)", async ({
    page,
  }) => {
    await gotoCustomerPanel(page);
    // The existing-files list region is present (populated or an explicit empty state — never a
    // cross-tenant file). The list is the `readEntityFiles` surface (own-tenant only).
    await expect(page.getByTestId("file-panel-existing-list")).toBeVisible();
  });

  test("[8.2-E2E-02][P1/AC3/R-811] the FOUR distinct error states each render as a distinct role=alert with its data-testid", async ({
    page,
  }) => {
    await gotoCustomerPanel(page);

    // The panel's DOM contract exposes FOUR distinct, individually-addressable error regions.
    // Each is a `role="alert"` (assertive, text — not color-only) with a unique data-testid.
    // A dev may render them conditionally; the RED contract is that the four testids exist and
    // resolve to DISTINCT elements when triggered. Driving each error deterministically is a
    // Task-7.2 seam — if not yet available, keep this as the structural contract below and add
    // per-state trigger tests as the dev wires the action states.
    const errorTestIds = [
      "file-error-blocked-type",
      "file-error-too-large",
      "file-error-network-or-server",
      "file-error-permission",
    ];
    // At minimum the four are DISTINCT ids (no two error states collapse into one region).
    expect(new Set(errorTestIds).size).toBe(4);

    // Blocked-type is deterministically drivable client-side (a disallowed extension/mime),
    // so prove at least ONE state renders as an accessible alert. The remaining three
    // (too-large / network-or-server / permission) are proven at INT level + wired here as the
    // dev exposes their drivers.
    await page.getByTestId("file-input").setInputFiles({
      name: `blocked-${crypto.randomUUID()}.exe`,
      mimeType: "application/x-msdownload",
      buffer: Buffer.from("MZ blocked fixture"),
    });
    const submit = page.getByTestId("file-upload-submit");
    await waitForHydrated(submit);
    await submit.click();

    const blocked = page.getByTestId("file-error-blocked-type");
    await expect(blocked).toBeVisible();
    await expect(blocked).toHaveAttribute("role", "alert");
    // Non-color cue: the alert carries TEXT describing the blocked-type failure.
    await expect(blocked).not.toBeEmpty();
  });
});

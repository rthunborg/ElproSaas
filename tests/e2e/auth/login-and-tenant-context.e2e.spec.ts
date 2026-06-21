/**
 * ATDD RED-PHASE SCAFFOLD — Story 2.1, E2E acceptance (browser journeys).
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GATED — DOES NOT RUN IN STORY 2.1.                                       ║
 * ║                                                                          ║
 * ║  Needs BOTH:                                                              ║
 * ║    - a browser E2E runner (Playwright) — NOT configured yet; the runner   ║
 * ║      decision is the TEA `testarch-framework` step (Epic 2). No           ║
 * ║      `playwright.config.ts` exists. Do NOT add one as a side effect of    ║
 * ║      this scaffold.                                                       ║
 * ║    - real authenticated tenant_admin users seeded via Story 2.2's         ║
 * ║      two-tenant factories / local Supabase stack (password-based, B2).    ║
 * ║                                                                          ║
 * ║  Carried forward as the red-phase spec so the UI acceptance for AC1/AC2/  ║
 * ║  AC3 is pinned and hand-off to 2.2 is traceable. Marked `.skip`; keep it  ║
 * ║  skipped under Story 2.1.                                                 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * COVERAGE (test-design-epic-2.md):
 *   AC1 → "Active tenant/company context is displayed in the UI" (P1 E2E, R-004)
 *   AC2 → "No active membership → denied, no tenant data" (P0 E2E, R-004)
 *   AC3 → "Anonymous cannot reach protected route (redirect to /login)" (P0 E2E, R-003)
 *
 * SELECTOR / UI ANCHORS the implementer must satisfy (Story Tasks 3 & 4):
 *   - `/login` page (route group `(auth)`) with email + password fields and a submit
 *     control (password-based auth, test-design B2).
 *   - The slim top bar's tenant/user region — TODAY an EMPTY
 *     `data-slot="primary-action"` div (AppShell.tsx:236-238). Task 4 fills it with
 *     the resolved tenant/company name + current user. Tests should target a stable
 *     test id the implementer adds (e.g. `data-testid="tenant-context"` and
 *     `data-testid="current-user"`), NOT brittle text — selector-resilience.
 *   - A sign-out affordance in the top-bar user region (Task 3.3) to make the
 *     login/logout loop testable.
 *
 * GREEN-PHASE: configure Playwright (framework step), seed real users via 2.2
 * factories, replace the `gated()` guards with real `page` interactions, remove
 * `.skip`, run headed/CI, make GREEN. Verify focus behavior of the login form +
 * sign-out control in a REAL browser (epic-1-retro Action Item 3 — headless :focus
 * is unreliable here).
 */

function gated(): never {
  throw new Error(
    "GATED: E2E runner (Playwright, via TEA testarch-framework) + Story 2.2 seeded " +
      "tenant_admin users are required. Intentionally skipped under Story 2.1.",
  );
}

describe.skip("Login + tenant-context display (Story 2.1 E2E — GATED on framework + 2.2 factories)", () => {
  it("AC3: an anonymous visitor to a protected (app) route is redirected to /login", async () => {
    gated();
    // await page.goto("/dashboard");
    // await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  it("AC1: a tenant_admin can sign in with email + password and lands in the (app) shell", async () => {
    gated();
    // await page.goto("/login");
    // await page.getByLabel(/e-?post|email/i).fill(adminA.email);
    // await page.getByLabel(/lösenord|password/i).fill(adminA.password);
    // await page.getByRole("button", { name: /logga in|sign in/i }).click();
    // await expect(page).toHaveURL(/\/dashboard/);
  });

  it("AC1: after sign-in, the top bar displays the resolved active tenant/company context and current user", async () => {
    gated();
    // await signInAs(page, adminA);
    // await expect(page.getByTestId("tenant-context")).toContainText(tenantA.name);
    // await expect(page.getByTestId("current-user")).toContainText(adminA.email);
  });

  it("AC2: an authenticated user WITHOUT active membership sees a user-safe no-access state and ZERO tenant data", async () => {
    gated();
    // await signInAs(page, orphanUser);
    // await expect(page.getByRole("alert")).toContainText(/access|åtkomst/i);
    // // The generic message must not leak whether a specific tenant/user exists
    // // (ux-design-specification §11). No tenant-owned data is rendered.
  });

  it("login/logout loop: signing out returns to /login and a protected route again redirects (AC1 + AC3 round-trip)", async () => {
    gated();
    // await signInAs(page, adminA);
    // await page.getByRole("button", { name: /logga ut|sign out/i }).click();
    // await expect(page).toHaveURL(/\/login(\?|$)/);
    // await page.goto("/dashboard");
    // await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});

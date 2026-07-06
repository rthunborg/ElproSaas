/**
 * Story 7.1 — the acceptance-capture form on the quote detail (AC1/AC2), + the a11y baseline.
 * STATES + FORM BEHAVIOR ONLY — the server-side gates (sent-state, adjusted-price re-validation,
 * öre persistence, audit) are INT territory (a test that only proves the UI shows a delta is NOT
 * evidence of the server rule; architecture §9). Do NOT assert DB rejection / persistence in E2E.
 *
 *   - 7.1-E2E-01 (P1, AC1): on a SENT version the acceptance form captures channel, accepted
 *     timestamp, evidence file id / external reference, accepted price (öre input, Swedish comma
 *     convention), notes, and planned start/end dates; the admin user is server-derived (NOT a form
 *     field). The form renders ONLY on a `sent` version (mirror the MarkSentButton/DraftQuoteEditor
 *     gating) — it is absent on a draft. NO public/portal endpoint (the guardrail scan owns the
 *     hard proof; this asserts the form is inside the authenticated `/quotes/[id]` surface).
 *   - 7.1-E2E-02 (P1, AC2): entering an accepted price ≠ the sent total REVEALS the delta and a
 *     REQUIRED adjustment-reason field before confirm; confirming without a reason is blocked in the
 *     UI (the mirror of the INT-proven server rule). An equal price hides the reason field.
 *   - 7.1-E2E-03 (P2, UX-DR35): keyboard navigation + a11y on the form + confirm dialog; focus moves
 *     predictably on completing acceptance; status/labels use TEXT, not color alone.
 *
 * Runs against the REAL app + local Supabase stack + the two-tenant quote fixture (global-setup
 * seeds a quote with a SENT version). Mirrors the 6.2/6.4 quotes.e2e signIn/waitForHydrated helpers
 * + the `getByTestId` UI contract. `crypto.randomUUID()` seeds for any count-asserting flow.
 *
 * ── RED PHASE (Story 7.1 not yet implemented) ─────────────────────────────────────────────────
 * The acceptance form replaces the `quote-acceptance-placeholder` section ("Ej accepterad ännu.
 * Acceptans hanteras i Epic 7.") in `QuoteDetailView.tsx`; the testids below do not exist yet. The
 * whole file is `test.describe.skip("... [ATDD red phase — Story 7.1 not implemented]")` (mirrors
 * the 6.4 no-lingering-red-header discipline — CLEAR the header when green). GREEN: add the form +
 * testids + the "use server" action, extend global-setup to expose a sent version as accept-able,
 * remove the `.skip`.
 *
 * [Source: test-design-epic-7.md#7.1-E2E-01/02/03, R-705/R-711 + testability note 9; story 7.1
 *  Task 6 + AC1/AC2; tests/e2e/quotes/quote-sent-lock.e2e.spec.ts (the two-tenant fixture +
 *  signIn/waitForHydrated + getByTestId to mirror); src/components/quotes/QuoteDetailView.tsx:399
 *  (the quote-acceptance-placeholder to replace); src/features/calculations/money-input.ts (the
 *  kronor↔öre parse/format the öre price input reuses); MEMORY (preview-harness focus limitation)]
 */
import { test, expect, type Page } from "@playwright/test";
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

/** Sign in as adminA and land on the seeded quote detail (green-phase helper — mirror 6.4). */
async function openSentVersion(page: Page): Promise<void> {
  // GREEN PHASE: reuse the 6.2/6.4 signIn + waitForHydrated helpers, then goto the SENT version.
  await page.goto(`/quotes/${fixture.quote.id}`);
  // (green phase: signIn(page, fixture.adminA) BEFORE goto; open fixture.quote.sentVersionId.)
}

// ── 7.1-E2E-01 (AC1) — the acceptance form fields + gating ────────────────────────────────────

test.describe.skip("acceptance-capture form (AC1) [ATDD red phase — Story 7.1 not implemented]", () => {
  test("[P1] 7.1-E2E-01: the acceptance form on a SENT version captures channel / accepted timestamp / evidence ref / öre price / notes / planned dates", async ({
    page,
  }) => {
    await openSentVersion(page);
    // getByTestId("acceptance-form") visible; the fields exist:
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
    await openSentVersion(page); // green phase: navigate to the DRAFT version instead
    await expect(page.getByTestId("acceptance-form")).toHaveCount(0);
    // The draft still shows its editor; acceptance is unavailable until sent.
  });
});

// ── 7.1-E2E-02 (AC2) — the adjusted-price delta + reason gate (UI mirror) ─────────────────────

test.describe.skip("adjusted-price flow (AC2) [ATDD red phase — Story 7.1 not implemented]", () => {
  test("[P1] 7.1-E2E-02: entering an accepted price ≠ the sent total reveals the delta and REQUIRES an adjustment reason before confirm", async ({
    page,
  }) => {
    await openSentVersion(page);
    // Enter a price different from the displayed sent total (Swedish comma input) → the delta
    // display + the required adjustment-reason field appear; confirm is blocked until a reason is
    // entered (the UI mirror of the INT-proven server rule).
    await expect(page.getByTestId("acceptance-price-delta")).toBeVisible();
    await expect(page.getByTestId("acceptance-adjustment-reason")).toBeVisible();
    await expect(page.getByTestId("acceptance-confirm")).toBeDisabled();
  });

  test("[P1] 7.1-E2E-02: an accepted price EQUAL to the sent total hides the reason field and allows confirm", async ({
    page,
  }) => {
    await openSentVersion(page);
    // Enter the exact sent total → no delta, the reason field is absent, confirm is enabled.
    await expect(page.getByTestId("acceptance-adjustment-reason")).toHaveCount(0);
    await expect(page.getByTestId("acceptance-confirm")).toBeEnabled();
  });
});

// ── 7.1-E2E-03 (UX-DR35) — a11y baseline on the form + confirm dialog ─────────────────────────

test.describe.skip("acceptance form a11y (UX-DR35) [ATDD red phase — Story 7.1 not implemented]", () => {
  test("[P2] 7.1-E2E-03: the form + confirm dialog are keyboard-operable, focus moves predictably on completing acceptance, status uses text not color", async ({
    page,
  }) => {
    await openSentVersion(page);
    // Tab through the fields (visible focus ring); the confirm dialog traps + restores focus;
    // on a completed acceptance focus moves to the acceptance result banner
    // (role="status"/role="alert"); the status is conveyed as TEXT ("Accepterad"), not color alone
    // (prefer event-driven focus assertion per MEMORY: preview-harness focus limitation).
    await expect(page.getByTestId("acceptance-status")).toBeVisible();
  });
});

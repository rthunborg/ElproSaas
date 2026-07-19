/**
 * Story 10.3 — REGRESSION for the code-review Med finding (2026-07-19): the plan/complete error +
 * retry banners must render INSIDE the Dialog, not in the section body behind the fixed `inset-0
 * z-50` overlay.
 *
 * On a failed completion the sheet's dialog stays open (`dialogOpen = open && status !== "success"`),
 * and the shared `Dialog` paints a full-screen `bg-black/40` overlay (`fixed inset-0 z-50`,
 * body-scroll-locked) over the page. Before the fix the `complete-follow-up-error` / "Försök igen."
 * banners lived in the section body BEHIND that overlay — present in the DOM but occluded, so the
 * AC3-required clear message was invisible exactly when it mattered. The fix relocates them into the
 * Dialog form (inside the `z-10` panel) so they paint ABOVE the overlay.
 *
 * WHY a render-tree assertion (not Playwright): the reachable error paths (the "Uppföljningen är
 * redan avslutad." race, a transient SERVER_ERROR) are impractical to inject deterministically in the
 * live E2E without a second-page race + a dedicated seed, and the fault the finding describes is a
 * pure RENDER-TREE placement fact — the banner's position relative to the Dialog. This asserts exactly
 * that structural invariant. `FollowUpSheet` is props-driven (its action state is a prop, it imports
 * no server-only module), so it renders cleanly under `react-dom/server` with NO DOM and NO DB — it
 * runs in this Vitest suite regardless of the local Supabase stack.
 *
 * `PlanFollowUpButton` got the SAME relocation but transitively imports the server action
 * (`next/headers`/`revalidatePath`), so it is not statically renderable here; its fix is identical in
 * shape and is exercised by the same live dialog the E2E drives.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { FollowUpSheet } from "@/components/quotes/FollowUpSheet";
import type { FollowUpActionState } from "@/features/quotes/follow-up-action-state";

const BASE_PROPS = {
  quoteId: "11111111-1111-4111-8111-111111111111",
  quoteVersionId: "22222222-2222-4222-8222-222222222222",
  followUpId: "33333333-3333-4333-8333-333333333333",
  formAction: () => {},
  pending: false,
  // Deterministic render seam: start with the completion dialog open so the dialog-open error state
  // is rendered (the live sheet opens it on the `Klarmarkera` click, which a static render can't do).
  autoOpen: true,
} as const;

function renderSheet(state: FollowUpActionState): string {
  return renderToStaticMarkup(createElement(FollowUpSheet, { ...BASE_PROPS, state }));
}

describe("FollowUpSheet — error/retry banners render inside the Dialog (10.3 review Med fix)", () => {
  it("renders the completion error banner INSIDE the open Dialog, not in the section body behind the overlay", () => {
    const state: FollowUpActionState = {
      status: "error",
      code: "VALIDATION_FAILED",
      formError: "Uppföljningen är redan avslutad.",
      targetId: null,
    };

    const html = renderSheet(state);

    // The Dialog is open (its fixed inset-0 z-50 overlay is on the page).
    const dialogIdx = html.indexOf('role="dialog"');
    expect(dialogIdx).toBeGreaterThanOrEqual(0);

    // The error banner exists exactly ONCE and is positioned AFTER the dialog panel opens — i.e. it
    // is a descendant of the Dialog (inside the z-10 panel), above the overlay. A regression that put
    // it back in the section body would place it BEFORE `role="dialog"` (the Dialog is the section's
    // last child) and/or leave the section-body copy behind.
    const errorIdx = html.indexOf('data-testid="complete-follow-up-error"');
    expect(errorIdx).toBeGreaterThan(dialogIdx);
    expect(html.indexOf('data-testid="complete-follow-up-error"')).toBe(
      html.lastIndexOf('data-testid="complete-follow-up-error"'),
    );

    // The section body (everything BEFORE the dialog panel opens) must NOT carry the error banner.
    expect(html.slice(0, dialogIdx)).not.toContain("complete-follow-up-error");

    // The user-safe message itself is rendered (the AC3 "clear message").
    expect(html).toContain("Uppföljningen är redan avslutad.");
  });

  it("renders the retry banner INSIDE the open Dialog on a transient SERVER_ERROR", () => {
    const state: FollowUpActionState = {
      status: "error",
      code: "SERVER_ERROR",
      formError: "Ett tillfälligt fel uppstod.",
      targetId: null,
    };

    const html = renderSheet(state);
    const dialogIdx = html.indexOf('role="dialog"');
    expect(dialogIdx).toBeGreaterThanOrEqual(0);

    // "Försök igen." is the retryable-error affordance (SERVER_ERROR) — it must render above the
    // overlay too, so it lives after the dialog panel opens.
    const retryIdx = html.indexOf("Försök igen.");
    expect(retryIdx).toBeGreaterThan(dialogIdx);
    expect(html.slice(0, dialogIdx)).not.toContain("Försök igen.");
  });
});

/**
 * Epic 10 iteration-2 integration review — REGRESSION for two follow-up-dialog robustness fixes:
 *
 *   (Patch/Low) Cancel-mid-flight was only half-blocked: the three follow-up dialogs disabled their
 *   Avbryt button while `pending`, but the shared `Dialog`'s OWN chrome close paths (Escape, backdrop
 *   click, header X) had NO pending guard — so a user could dismiss a dialog mid-flight through those
 *   paths, resetting the entered fields (and re-arming a banner) while the server action was still in
 *   flight. The fix threads a `busy` prop into the shared `Dialog` that gates every chrome close path
 *   AND renders the close controls `disabled`. This is a RENDER-TREE fact (the disabled attribute on
 *   the backdrop + header-X close controls when busy), so it is asserted here under `react-dom/server`
 *   on `FollowUpSheet` — the one dialog that renders cleanly with no DOM and no server-action import.
 *
 *   (Patch/Med) Stale error banners re-appeared on REOPEN: `MarkLostButton` re-armed the banner via
 *   `setBannerDismissed(false)` in its OPEN handler, and `FollowUpSheet`/`PlanFollowUpButton` had NO
 *   dismissal mechanism at all — so a prior failed submit's banner re-appeared the moment the dialog
 *   was reopened (the `useActionState` error persists across close/reopen). The fix removes the
 *   open-handler re-arm and makes the banner dismissal SUBMIT-scoped in all three. The reopen cycle is
 *   a stateful DOM interaction (open → fail submit → close → reopen) that the react-dom/server lane
 *   CANNOT drive (it renders one static pass) and the reachable errors are impractical to inject in the
 *   live E2E (the reviewers' own note). So the exact defect — the banner gate is wired to a dismissal
 *   flag that is NEVER re-armed on open, and IS re-armed only on submit — is pinned STRUCTURALLY here,
 *   the same source-assertion technique the read-model isolation floor uses.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { FollowUpSheet } from "@/components/quotes/FollowUpSheet";
import {
  FOLLOW_UP_ACTION_INITIAL,
  type FollowUpActionState,
} from "@/features/quotes/follow-up-action-state";

const IDLE_STATE: FollowUpActionState = FOLLOW_UP_ACTION_INITIAL;

const BASE_PROPS = {
  quoteId: "11111111-1111-4111-8111-111111111111",
  quoteVersionId: "22222222-2222-4222-8222-222222222222",
  followUpId: "33333333-3333-4333-8333-333333333333",
  formAction: () => {},
  state: IDLE_STATE,
  autoOpen: true, // render the dialog open so its close controls are in the tree
} as const;

function renderSheet(pending: boolean): string {
  return renderToStaticMarkup(createElement(FollowUpSheet, { ...BASE_PROPS, pending }));
}

/** The opening `<button …>` tag that carries the given accessible name (for a disabled-attr check). */
function buttonTagWithLabel(html: string, label: string): string {
  const idx = html.indexOf(`aria-label="${label}"`);
  expect(idx, `a control with aria-label "${label}" is rendered`).toBeGreaterThanOrEqual(0);
  const start = html.lastIndexOf("<button", idx);
  const end = html.indexOf(">", idx);
  return html.slice(start, end + 1);
}

describe("Dialog pending-close gate (iteration-2 review — cancel-mid-flight blocked on EVERY path)", () => {
  it("busy: the backdrop and header-X close controls render DISABLED while a submit is in flight", () => {
    const html = renderSheet(true);
    // The Dialog is open (its chrome is on the page).
    expect(html).toContain('role="dialog"');
    // Both chrome dismiss paths are gated: a mid-flight backdrop click or X press cannot fire onClose.
    // Match the rendered boolean ATTRIBUTE `disabled=""` (not the `disabled:opacity-60` Tailwind class).
    expect(buttonTagWithLabel(html, "Stäng dialogruta")).toContain('disabled=""'); // backdrop
    expect(buttonTagWithLabel(html, "Stäng")).toContain('disabled=""'); // header X
  });

  it("not busy: the same close controls are ENABLED (no over-gating when idle)", () => {
    const html = renderSheet(false);
    expect(html).toContain('role="dialog"');
    expect(buttonTagWithLabel(html, "Stäng dialogruta")).not.toContain('disabled=""'); // backdrop
    expect(buttonTagWithLabel(html, "Stäng")).not.toContain('disabled=""'); // header X
  });
});

// ── Fix 2 (stale banner on reopen) — structural regression over the three dialog sources ────────────
// The reopen cycle is a stateful interaction the static render-tree lane can't drive; the reachable
// errors are impractical to inject in E2E. So pin the fix's exact shape at the source: the error banner
// is gated by a `bannerDismissed` flag that is (a) NEVER cleared on the OPEN handler and (b) cleared
// ONLY by the form `onSubmit`, and set on `closeDialog`. A regression that re-armed the banner on open
// (the original defect) or dropped the gate would fail these.
const DIALOGS = [
  { name: "MarkLostButton", openTestId: "mark-lost-open", errorTestId: "mark-lost-error" },
  { name: "FollowUpSheet", openTestId: "complete-follow-up-open", errorTestId: "complete-follow-up-error" },
  { name: "PlanFollowUpButton", openTestId: "plan-follow-up-open", errorTestId: "plan-follow-up-error" },
] as const;

function readComponent(name: string): string {
  const file = path.join(process.cwd(), "src", "components", "quotes", `${name}.tsx`);
  expect(existsSync(file), `${name}.tsx exists`).toBe(true);
  return readFileSync(file, "utf8");
}

describe("stale banner on reopen (iteration-2 review — submit-scoped dismissal, never re-armed on open)", () => {
  for (const { name, openTestId, errorTestId } of DIALOGS) {
    it(`${name}: the error banner is gated by !bannerDismissed and reset only on submit, never on open`, () => {
      const src = readComponent(name);

      // (1) The error banner is gated by the dismissal flag (the fix wired the flag into ALL three).
      const bannerLine = src
        .split("\n")
        .find((l) => l.includes(errorTestId) || l.includes(`data-testid="${errorTestId}"`));
      // The gate lives on the render line just above the banner's <p>; assert the flag guards the block.
      expect(src).toContain("!bannerDismissed && state.status === \"error\"");
      expect(bannerLine, `${name} renders its error banner`).toBeTruthy();

      // (2) The dismissal is RE-ARMED only by the form onSubmit — the submit-scoped reset.
      expect(src).toContain("onSubmit={() => setBannerDismissed(false)}");

      // (3) closeDialog retires the banner (so a reopen starts clean).
      expect(src).toMatch(/const closeDialog = \(\) => \{[\s\S]*setBannerDismissed\(true\)/);

      // (4) The OPEN trigger must NOT re-arm the banner (the exact MarkLostButton defect). Extract the
      // open button's element and assert it carries no setBannerDismissed call.
      const openIdx = src.indexOf(`data-testid="${openTestId}"`);
      expect(openIdx, `${name} has an open trigger`).toBeGreaterThanOrEqual(0);
      // Look at the handler region around the open trigger (its onClick is on the same element).
      const openRegion = src.slice(Math.max(0, openIdx - 200), openIdx + 200);
      expect(openRegion, `${name} open handler must not re-arm the banner`).not.toContain(
        "setBannerDismissed",
      );
    });
  }
});

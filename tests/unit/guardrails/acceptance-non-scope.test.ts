/**
 * Story 7.1 — 7.x-E2E-01 (P1, AC1 guardrail): NO public/unauthenticated acceptance endpoint,
 * customer-portal route, webhook, or cron exists for the acceptance flow. Acceptance is an
 * ADMIN-ONLY, authenticated, off-system-evidence capture — there is NO customer-facing acceptance
 * surface in Phase A (architecture §5). A cheap `node --test` route/surface presence-scan (mirrors
 * the 6.2-E2E-03 pattern), NOT a behavioral test — a forbidden route directory or surface symbol
 * fails loud on every PR, no browser/DB needed.
 *
 * ── RED PHASE (Story 7.1 not yet implemented) ─────────────────────────────────────────────────
 * These assertions are TRUE TODAY (no acceptance surface exists) and must STAY true as 7.1 lands
 * the acceptance form + command. Rather than `.skip`, this scaffold runs LIVE from the red phase —
 * it is the standing guardrail that 7.1's implementation must not violate (the form is an
 * authenticated affordance inside `/quotes/[quoteId]`, never a new public route). If the green
 * phase adds any forbidden segment/token, this test fails immediately.
 *
 * ── GREEN-PHASE NOTE (a REQUIRED reconciliation, do not skip) ──────────────────────────────────
 * The EXISTING 6.2 guardrail `tests/unit/guardrails/quote-non-scope.test.ts` scans
 * `src/server/commands/quotes` for the tokens `acceptQuote` and `createJob` and asserts they are
 * ABSENT (Epic-6 non-scope). Story 7.1 LEGITIMATELY introduces the acceptance command in exactly
 * that directory (`captureQuoteAcceptance`; `createJob` remains 7.2/7.3). The green phase MUST
 * update the 6.2 guardrail so it no longer forbids the sanctioned 7.1 acceptance command surface
 * while STILL forbidding a public/email/portal mechanism and the not-yet-scoped `createJob` — i.e.
 * narrow the forbidden-token set to the still-out-of-scope items, and move the acceptance-surface
 * scope assertions here. (Recorded so the epic trace treats it as an Epic-7 obligation.)
 *
 * [Source: test-design-epic-7.md#7.x-E2E-01, architecture §5; story 7.1 Task 7 + AC1;
 *  tests/unit/guardrails/quote-non-scope.test.ts (the 6.2 guardrail to mirror + reconcile)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const REPO = process.cwd();
const APP_DIR = path.join(REPO, "src", "app");

/** Recursively collect every directory segment name under a route root (lowercased). */
function collectRouteSegments(dir: string, acc: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      acc.push(entry.toLowerCase());
      collectRouteSegments(full, acc);
    }
  }
  return acc;
}

/** Recursively collect every .ts/.tsx file path under a directory. */
function collectFiles(dir: string, acc: string[]): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collectFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

const FORBIDDEN_ROUTE_SEGMENTS = [
  "portal",
  "customer-portal",
  "accept", // a public acceptance endpoint
  "acceptance",
  "webhook",
  "webhooks",
  "cron",
  "public",
];

test("7.x-E2E-01: NO public acceptance / portal / webhook / cron route segment exists under src/app", () => {
  const segments = collectRouteSegments(APP_DIR, []);
  for (const forbidden of FORBIDDEN_ROUTE_SEGMENTS) {
    assert.equal(
      segments.includes(forbidden),
      false,
      `a forbidden Epic-7-non-scope route segment "${forbidden}" exists under src/app (acceptance is authenticated admin-only)`,
    );
  }
});

test("7.x-E2E-01: no acceptance surface wires a public/webhook/portal/email acceptance mechanism", () => {
  // The acceptance command + form live in the quote feature/command dirs — scan them for
  // PUBLIC/UNAUTHENTICATED mechanism tokens only (the authenticated captureQuoteAcceptance command
  // itself is sanctioned and must NOT be forbidden here).
  const surfaces = [
    ...collectFiles(path.join(REPO, "src", "features", "quotes"), []),
    ...collectFiles(path.join(REPO, "src", "components", "quotes"), []),
    ...collectFiles(path.join(REPO, "src", "server", "commands", "quotes"), []),
  ];
  const forbiddenTokens = [
    "customerPortal",
    "customer_portal",
    "publicAccept",
    "webhook",
    "cronAccept",
    "sendEmail",
    "nodemailer",
    "smtp",
  ];
  for (const file of surfaces) {
    const src = readFileSync(file, "utf8");
    for (const token of forbiddenTokens) {
      assert.equal(
        src.includes(token),
        false,
        `forbidden public-acceptance mechanism token "${token}" found in ${path.relative(REPO, file)}`,
      );
    }
  }
});

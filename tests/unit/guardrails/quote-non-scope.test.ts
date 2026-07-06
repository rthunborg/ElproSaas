/**
 * Story 6.2 — 6.2-E2E-03 (guardrail): NO email-send route, NO customer-portal route/surface,
 * NO public/unauthenticated acceptance endpoint exists (a cheap route/surface presence-scan,
 * NOT a behavioral test). This is the Epic-6-non-scope guardrail — acceptance on the detail is
 * a PLACEHOLDER (Epic 7 owns real acceptance); there is no customer portal or public acceptance
 * endpoint in Phase A.
 *
 * Implemented as a `node --test` fast-gate scan of the app route tree + the quote feature /
 * component surfaces. A forbidden route directory or a forbidden surface symbol failing the
 * scan is a hard fail on every PR — no browser / DB needed. [Source: test-design-epic-6.md
 * #6.2-E2E-03; epics.md#Story 6.2 Stop Conditions; ux §6.]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const REPO = process.cwd();
const APP_DIR = path.join(REPO, "src", "app");

/** Recursively collect every directory segment name under `src/app`. */
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

/** Recursively collect every source file path under a directory. */
function collectFiles(dir: string, acc: string[]): string[] {
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
  "email",
  "send-email",
  "public",
];

test("6.2-E2E-03: NO forbidden route segment exists under src/app (no portal/public-accept/email route)", () => {
  const segments = collectRouteSegments(APP_DIR, []);
  for (const forbidden of FORBIDDEN_ROUTE_SEGMENTS) {
    assert.equal(
      segments.includes(forbidden),
      false,
      `a forbidden Epic-6-non-scope route segment "${forbidden}" exists under src/app`,
    );
  }
});

test("6.2-E2E-03: the quote routes are exactly the in-scope list/detail/version routes", () => {
  const quotesDir = path.join(APP_DIR, "(app)", "quotes");
  const segments = collectRouteSegments(quotesDir, []).sort();
  // Only the dynamic quote id + its versions subroute exist under /quotes.
  assert.deepEqual(segments, ["[quoteid]", "[versionid]", "versions"]);
});

test("6.2-E2E-03: no quote surface references an email-send / portal / public-accept mechanism", () => {
  const surfaces = [
    ...collectFiles(path.join(REPO, "src", "features", "quotes"), []),
    ...collectFiles(path.join(REPO, "src", "components", "quotes"), []),
    ...collectFiles(path.join(REPO, "src", "server", "commands", "quotes"), []),
  ];
  // A conservative token scan: the 6.2 surface must not wire an email send, a customer portal,
  // or a public/unauthenticated acceptance endpoint. (The acceptance PLACEHOLDER copy stays —
  // it is a disclosure, not an affordance — so we scan for the mechanism tokens, not the word
  // "acceptans" alone.)
  const forbiddenTokens = [
    "sendEmail",
    "send_email",
    "nodemailer",
    "smtp",
    "customerPortal",
    "customer_portal",
    "publicAccept",
    "acceptQuote", // the accept command is Epic 7 — must not appear in a 6.2 surface
    "createJob",
  ];
  for (const file of surfaces) {
    const src = readFileSync(file, "utf8");
    for (const token of forbiddenTokens) {
      assert.equal(
        src.includes(token),
        false,
        `forbidden non-scope token "${token}" found in ${path.relative(REPO, file)}`,
      );
    }
  }
});

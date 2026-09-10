/**
 * Story 7.3 — 7.3-E2E-03 (P1, AC2 guardrail; R-711): NO field-worker / schedule / time-material /
 * deviation / ÄTA / project-analytics / invoice / billing / Fortnox / supplier surface appears
 * ANYWHERE in the job/order module, and the shell nav stays EXACTLY seven items (no eighth module,
 * no new nav entry — "Jobb/Order → /jobs" already exists). A cheap `node --test` route-segment +
 * surface-token presence-scan (mirrors `acceptance-non-scope.test.ts` / `quote-non-scope.test.ts`),
 * NOT a behavioral test — a forbidden route directory or surface symbol fails loud on every PR, no
 * browser/DB needed.
 *
 * ── RED PHASE (Story 7.3 not yet implemented) ─────────────────────────────────────────────────
 * These assertions are TRUE TODAY (the `/jobs` route is a PagePlaceholder; the job feature/command/
 * component dirs do not yet exist) and must STAY true as 7.3 lands the `/jobs` list + `/jobs/[jobId]`
 * detail + the `updateJob` command + `JobList`/`JobDetailView`. Rather than `.skip`, this scaffold
 * runs LIVE from the red phase — it is the standing guardrail that 7.3's implementation must not
 * violate. The job/order record is a MINIMAL accepted-work surface (traceability + Phase-A-safe
 * edits only); field workflow is a SEAM/BOUNDARY only (architecture §"Field Workflow", ADR-A008).
 * If the green phase adds any forbidden segment/token, this test fails immediately.
 *
 * NOTE (green-phase scope-token allow-list): the job status set is `created|in_progress|done|
 * cancelled` — a Phase-A order lifecycle, NOT field-worker states. The forbidden tokens below are
 * chosen to NOT collide with those legitimate status values (no `scheduled`/`dispatched`/`on-site`).
 *
 * [Source: test-design-epic-7.md#7.3-E2E-03, #Risk R-711, #Non-scope (field-worker/invoicing/Fortnox
 *  boundaries); story 7.3 Task 6 + AC2; architecture §4 (/jobs "basic accepted-work list only") +
 *  §"Field Workflow" (seam only) + FR61 (no dormant deferred UI); src/components/app-shell/
 *  nav-items.ts (seven-item shell — "Jobb/Order" already present, no new nav item);
 *  tests/unit/guardrails/acceptance-non-scope.test.ts (the scan pattern to mirror)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPO = process.cwd();
const APP_DIR = path.join(REPO, "src", "app");

/** Recursively collect every directory segment name under a route root (lowercased). */
function collectRouteSegments(dir: string, acc: string[]): string[] {
  if (!existsSync(dir)) return acc;
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

// Deferred-module route segments that must NEVER appear under src/app (as routes or placeholders).
const FORBIDDEN_ROUTE_SEGMENTS = [
  "field-worker",
  "fieldworker",
  "schedule",
  "scheduling",
  "timesheet",
  "time-material",
  "deviation",
  "ata", // ÄTA
  "fortnox",
  "invoice",
  "invoices",
  "invoicing",
  "billing",
  "analytics",
  "supplier",
  "suppliers",
];

// Deferred-scope surface tokens that must NEVER appear in the job module source. Chosen to NOT
// collide with the legitimate Phase-A status set (created|in_progress|done|cancelled) or the
// allowed edit fields (title/status/planned_start_date/planned_end_date).
const FORBIDDEN_SURFACE_TOKENS = [
  "fieldWorker",
  "field_worker",
  "timeMaterial",
  "time_material",
  "timesheet",
  "deviation",
  "fortnox",
  "invoice",
  "billing",
  "projectAnalytics",
  "project_analytics",
  "supplierApi",
  "supplier_api",
  "ÄTA",
  "dispatched",
  "onSite",
  "on_site",
];

test("7.3-E2E-03: NO deferred-module route segment (field-worker/schedule/time-material/deviation/ÄTA/invoice/fortnox/analytics/supplier) exists under src/app", () => {
  const segments = collectRouteSegments(APP_DIR, []);
  for (const forbidden of FORBIDDEN_ROUTE_SEGMENTS) {
    assert.equal(
      segments.includes(forbidden),
      false,
      `a forbidden Epic-7-non-scope route segment "${forbidden}" exists under src/app (the job/order module is accepted-work traceability only)`,
    );
  }
});

test("7.3-E2E-03: NO deferred-scope surface token appears in the job feature/command/component dirs", () => {
  const surfaces = [
    ...collectFiles(path.join(REPO, "src", "app", "(app)", "jobs"), []),
    ...collectFiles(path.join(REPO, "src", "features", "jobs"), []),
    ...collectFiles(path.join(REPO, "src", "components", "jobs"), []),
    ...collectFiles(path.join(REPO, "src", "server", "commands", "jobs"), []),
  ];
  for (const file of surfaces) {
    const src = readFileSync(file, "utf8");
    for (const token of FORBIDDEN_SURFACE_TOKENS) {
      assert.equal(
        src.includes(token),
        false,
        `forbidden deferred-scope surface token "${token}" found in ${path.relative(REPO, file)} (field-worker/invoice/Fortnox/analytics/supplier UI is Epic-7-non-scope)`,
      );
    }
  }
});

test("7.3-E2E-03: the shell nav stays EXACTLY seven items — 7.3 adds NO new nav item / eighth module", async () => {
  // "Jobb/Order → /jobs" ALREADY exists in the seven-item shell; 7.3 fills in its two routes behind
  // the existing entry. Adding an eighth nav item (or a deferred-module placeholder) is forbidden
  // (FR61, UX-DR3, architecture §4). Assert the count and the presence of the existing /jobs entry.
  const mod = (await import(
    pathToFileURL(path.join(REPO, "src", "components", "app-shell", "nav-items.ts")).href
  )) as { navItems: ReadonlyArray<{ href: string }> };
  assert.equal(
    mod.navItems.length,
    8,
    `the shell nav must include the approved RBAC Admin Users entry — found ${mod.navItems.length}`,
  );
  assert.equal(
    mod.navItems.some((n) => n.href === "/jobs"),
    true,
    'the existing "Jobb/Order → /jobs" nav item must remain (7.3 fills its routes, does not add a new entry)',
  );
});

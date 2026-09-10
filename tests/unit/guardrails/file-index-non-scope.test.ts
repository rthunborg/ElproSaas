/**
 * Story 8.5 — 8.5-UNIT-02 (P2, AC1 guardrail; R-816): the limited `Filer` index MUST NOT grow into a
 * broad document center. A cheap `node --test` source-token presence-scan (mirrors
 * `job-non-scope.test.ts` / `acceptance-non-scope.test.ts`), NOT a behavioral test — a forbidden
 * deferred-module / document-library surface token in the file-index sources fails loud on every PR,
 * no browser/DB needed. This is the source-tree half of the R-816 STOP boundary (the rendered-page
 * half lives in `tests/e2e/files/file-index-scope.e2e.spec.ts`).
 *
 * ── RED PHASE (Story 8.5 not yet implemented) ─────────────────────────────────────────────────────
 * These assertions are TRUE TODAY (`/files` is still a `PagePlaceholder`; `FileIndexList`/`file-index.ts`
 * do not exist yet) and must STAY true as 8.5 lands the limited index (`readFileIndex` + `FileIndexList`
 * + the pure `file-index.ts`). Rather than `.skip`, this scaffold runs LIVE from the red phase — it is
 * the standing guardrail that 8.5's implementation must not violate: the index lists ONLY the seven
 * Phase A owner categories with a flat search/filter; NO deferred-module grouping / cross-module
 * analytics / broad document-center workflow. If the green phase adds any forbidden token, this test
 * fails immediately.
 *
 * NOTE (allow-list): the Phase A owner-category labels (Kund/Anläggning/Kontakt/Kalkyl/Offert/Acceptans/
 * Jobb) and the ACTIVE owner types are legitimate — the forbidden tokens below are chosen NOT to collide
 * with them. `analys`/`analytics` is forbidden as a cross-module-analytics surface (the index is a flat
 * list, never a dashboard).
 *
 * [Source: story 8.5 AC1 + Task 1.2/1.3/1.4/3.4; test-design-epic-8.md#R-816 (index scope creep, the
 *  8.5 STOP); architecture.md#14 (a limited file index may exist — broad document-center behavior is
 *  not Phase A); owner-decisions-applied-2026-06-18.md#Epic 8·8.5;
 *  tests/unit/guardrails/job-non-scope.test.ts (the forbidden-token scan to mirror);
 *  src/components/app-shell/nav-items.ts (the seven-item frozen nav — no eighth module)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPO = process.cwd();

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

/**
 * Deferred-module / document-center surface tokens that must NEVER appear in the file-index sources.
 * Chosen to NOT collide with the legitimate Phase A owner categories, the ACTIVE owner types, or the
 * flat search/filter vocabulary.
 */
const FORBIDDEN_INDEX_TOKENS = [
  "documentCenter",
  "document_center",
  "documentLibrary",
  "document_library",
  "dokumentbibliotek",
  "dokumentcenter",
  "fortnox",
  "uthyrning", // rentals
  "supplierApi",
  "supplier_api",
  "crossModuleAnalytics",
  "projectAnalytics",
  "project_analytics",
  "fileAnalytics",
  "file_analytics",
];

/** The file-index surfaces 8.5 introduces or replaces — scanned for the forbidden tokens above. */
function indexSurfaceFiles(): string[] {
  return [
    ...collectFiles(path.join(REPO, "src", "app", "(app)", "files"), []),
    // Only the index-specific sources under src/features/files (readFileIndex + file-index.ts) and the
    // index island; the whole files feature dir includes 8.1-8.4 surfaces we do not want to over-scan.
    path.join(REPO, "src", "features", "files", "file-index.ts"),
    path.join(REPO, "src", "components", "files", "FileIndexList.tsx"),
  ].filter((f) => existsSync(f));
}

test("8.5-UNIT-02: NO document-center / deferred-module surface token appears in the file-index sources (R-816)", () => {
  const surfaces = indexSurfaceFiles();
  for (const file of surfaces) {
    const src = readFileSync(file, "utf8");
    for (const token of FORBIDDEN_INDEX_TOKENS) {
      assert.equal(
        src.includes(token),
        false,
        `forbidden document-center/deferred-module token "${token}" found in ${path.relative(REPO, file)} (the Filer index is a LIMITED Phase-A list, not a broad document library — R-816 STOP)`,
      );
    }
  }
});

test("8.5-UNIT-02: NO deferred-module route segment appears under src/app/(app)/files", () => {
  const filesRoute = path.join(REPO, "src", "app", "(app)", "files");
  if (!existsSync(filesRoute)) return; // route not yet materialized in red phase
  const segments: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        segments.push(entry.toLowerCase());
        walk(full);
      }
    }
  };
  walk(filesRoute);
  for (const forbidden of ["library", "center", "analytics", "fortnox", "supplier"]) {
    assert.equal(
      segments.includes(forbidden),
      false,
      `a forbidden document-center route segment "${forbidden}" exists under src/app/(app)/files (the index is a single flat page — R-816)`,
    );
  }
});

test("8.5-UNIT-02: the shell nav stays EXACTLY seven items — 8.5 adds NO new nav item (Filer already exists)", async () => {
  // "Filer → /files" ALREADY exists in the seven-item shell; 8.5 replaces its stub page, it does NOT add
  // an eighth nav item (the nav is frozen — the story explicitly forbids touching nav-items.ts).
  const mod = (await import(
    pathToFileURL(path.join(REPO, "src", "components", "app-shell", "nav-items.ts")).href
  )) as { navItems: ReadonlyArray<{ href: string }> };
  assert.equal(
    mod.navItems.length,
    8,
    `the shell nav must include the approved RBAC Admin Users entry — found ${mod.navItems.length}`,
  );
  assert.equal(
    mod.navItems.some((n) => n.href === "/files"),
    true,
    'the existing "Filer → /files" nav item must remain (8.5 fills its page, does not add a new entry)',
  );
});

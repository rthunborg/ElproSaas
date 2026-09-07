/**
 * Story 10.1 AC2 (typed scope manifest) + Task 1.3 uniqueness invariant.
 *
 * ── GREEN (Story 10.1 shipped) ─────────────────────────────────────────────────────────────────
 * `src/scope/manifest.ts` (the `SCOPE_MANIFEST` constant, `satisfies ScopeManifest`-guarded) and
 * `src/scope/manifest-schema.ts` (the `ScopeManifest`/`ScopeModule` types + pure selectors
 * `activeModules` / `pendingModules` / `navRoutesFromManifest(m)` / `tenantTablesFromManifest(m)` /
 * `fileOwnerTypesFromManifest(m)`) are landed; the suite imports the REAL modules, is unskipped, and
 * runs green. The assertions are the CONTRACT — do not weaken them.
 *
 * These assertions encode AC2's concrete numbers (7 nav / 27 tenant tables / 7 file owner types in
 * the current active set, every Phase B module `pending`) + the per-module field
 * shape + the cross-module uniqueness invariant (Task 1.3 — the `READINESS_CODES` uniqueness gap
 * the manifest must NOT repeat). Grounded against PINNED Phase-A literals (non-circular per Dev
 * Notes), never against another manifest-derived value.
 *
 * [Source: story 10.1 AC2, Task 1.1/1.3, Task 2; architecture-phase-b.md §5.2; Persistent Facts
 *  (7/24/7 baseline, plus the governed Epic 10 enrollments); Constraints
 *  (READINESS_CODES uniqueness gap → add uniqueness assertion).]
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// PINNED Phase-A baselines (the independent ground truth the derivations must reproduce).
const PINNED_NAV_ROUTES = [
  "/dashboard",
  "/customers",
  "/calculations",
  "/quotes",
  "/jobs",
  "/files",
  "/settings",
];
const PINNED_OWNER_TYPES = [
  "customer",
  "facility",
  "contact",
  "calculation",
  "quote_version",
  "quote_acceptance",
  "job",
];
const PINNED_TENANT_TABLES = [
  "tenants",
  "tenant_memberships",
  "membership_roles",
  "audit_events",
  "customers",
  "facilities",
  "contacts",
  "company_settings",
  "quote_terms",
  "work_roles",
  "articles",
  "calculations",
  "calculation_sections",
  "calculation_rows",
  "files",
  "file_links",
  "tenant_counters",
  "quotes",
  "quote_versions",
  "quote_version_lines",
  "quote_version_attachments",
  "quote_events",
  "quote_acceptances",
  // Story 10.2 enrols the Förlorad/Avböjd reason table into the ACTIVE quotes module (epic-10
  // activation seam) — the Phase-A baseline active set grows 24 → 25 in the same PR as its migration.
  "quote_lost_reasons",
  // Story 10.3 enrols the follow-up workflow table into the same ACTIVE quotes module (epic-10
  // activation seam) — the active set grows 25 → 26 in the same PR as its migration.
  "quote_follow_ups",
  // Story 10.8 enrols one-time quote review authority into that same already-active module.
  "quote_review_authorizations",
  "jobs",
  "job_events",
];
const WAVES = new Set(["A", "B1a", "B1b", "B2", "B3"]);
const PUBLIC_SURFACE_CLOSED_SET = new Set([
  "calendar_feed",
  "asset_qr",
  "unsubscribe",
]);

type AnyModule = {
  id: string;
  label: string;
  wave: string;
  status: "active" | "pending";
  epic?: string;
  activatedAt?: string;
  navItems: { route: string; group?: string; requiredCapability?: string }[];
  tenantTables: string[];
  widgets: string[];
  notificationCategories: string[];
  publicSurfaces: string[];
  fileOwnerTypes: string[];
};

async function loadManifest(): Promise<{ modules: AnyModule[] }> {
  const mod = (await import("@/scope/manifest")) as {
    SCOPE_MANIFEST: { modules: AnyModule[] };
  };
  return mod.SCOPE_MANIFEST;
}

const sortedUnique = (xs: string[]) => [...new Set(xs)].sort();

test("10.1-UNIT-SHAPE-01 (AC2): SCOPE_MANIFEST exists and every module carries the §5.2 field shape", async () => {
  const manifest = await loadManifest();
  assert.ok(Array.isArray(manifest.modules) && manifest.modules.length > 0);
  for (const m of manifest.modules) {
    assert.equal(typeof m.id, "string", `module ${m.id}: id`);
    assert.equal(typeof m.label, "string", `module ${m.id}: label`);
    assert.ok(WAVES.has(m.wave), `module ${m.id}: wave "${m.wave}" not in A/B1a/B1b/B2/B3`);
    assert.ok(m.status === "active" || m.status === "pending", `module ${m.id}: status`);
    assert.ok(Array.isArray(m.navItems), `module ${m.id}: navItems array`);
    assert.ok(Array.isArray(m.tenantTables), `module ${m.id}: tenantTables array`);
    assert.ok(Array.isArray(m.widgets), `module ${m.id}: widgets array`);
    assert.ok(Array.isArray(m.notificationCategories), `module ${m.id}: notificationCategories array`);
    assert.ok(Array.isArray(m.publicSurfaces), `module ${m.id}: publicSurfaces array`);
    assert.ok(Array.isArray(m.fileOwnerTypes), `module ${m.id}: fileOwnerTypes array`);
  }
});

test("10.1-UNIT-SHAPE-02 (AC2): every `active` module has an epic reference + an activatedAt date", async () => {
  const manifest = await loadManifest();
  const active = manifest.modules.filter((m) => m.status === "active");
  assert.ok(active.length > 0, "expected at least one active (Phase A) module");
  for (const m of active) {
    assert.ok(m.epic && m.epic.length > 0, `active module ${m.id} must carry an epic reference`);
    assert.ok(m.activatedAt && m.activatedAt.length > 0, `active module ${m.id} must carry an activatedAt date`);
    assert.equal(m.wave, "A", `Phase A active module ${m.id} must be wave A`);
  }
});

test("10.1-UNIT-SHAPE-03 (AC2): the `active` set reproduces exactly the 7 Phase-A nav routes (pinned, non-circular)", async () => {
  const manifest = await loadManifest();
  const routes = manifest.modules
    .filter((m) => m.status === "active")
    .flatMap((m) => m.navItems.map((n) => n.route));
  assert.deepEqual(sortedUnique(routes), sortedUnique(PINNED_NAV_ROUTES));
});

test("10.1-UNIT-SHAPE-04 (AC2): the `active` set reproduces exactly the 28 tenant tables (pinned, non-circular)", async () => {
  // Baseline was 24 (Phase A); Story 10.2 enrolled quote_lost_reasons (→ 25) and Story 10.3 enrols
  // quote_follow_ups (→ 26); Story 10.8 adds quote_review_authorizations (→ 27), and Story 11.1
  // enrolls membership_roles under the active foundation module (→ 28), each with its migration.
  const manifest = await loadManifest();
  const tables = manifest.modules
    .filter((m) => m.status === "active")
    .flatMap((m) => m.tenantTables);
  assert.equal(tables.length, 28, "the active tenant-table union must total exactly 28 (no dup, no gap)");
  assert.deepEqual(sortedUnique(tables), sortedUnique(PINNED_TENANT_TABLES));
});

test("10.1-UNIT-SHAPE-05 (AC2): the `active` set reproduces exactly the 7 Phase-A file owner types (pinned, non-circular)", async () => {
  const manifest = await loadManifest();
  const owners = manifest.modules
    .filter((m) => m.status === "active")
    .flatMap((m) => m.fileOwnerTypes);
  assert.deepEqual(sortedUnique(owners), sortedUnique(PINNED_OWNER_TYPES));
});

test("10.1-UNIT-SHAPE-06 (AC2): every Phase B module is `pending` (no live Phase B surface shipped in 10.1)", async () => {
  const manifest = await loadManifest();
  const phaseB = manifest.modules.filter((m) => m.wave !== "A");
  assert.ok(phaseB.length > 0, "expected Phase B pending modules to be modeled");
  for (const m of phaseB) {
    assert.equal(m.status, "pending", `Phase B module ${m.id} must be pending in 10.1`);
    assert.equal(m.navItems.length, 0, `pending module ${m.id} must wire no nav route`);
    assert.equal(m.tenantTables.length, 0, `pending module ${m.id} must enroll no tenant table`);
    assert.equal(m.widgets.length, 0, `pending module ${m.id} must render no widget`);
  }
});

test("10.1-UNIT-SHAPE-07 (AC2): the public-surface union stays inside the ADR-B004 closed set of three", async () => {
  const manifest = await loadManifest();
  const surfaces = manifest.modules.flatMap((m) => m.publicSurfaces);
  for (const s of surfaces) {
    assert.ok(PUBLIC_SURFACE_CLOSED_SET.has(s), `public surface "${s}" is outside the closed set of three`);
  }
  assert.ok(new Set(surfaces).size <= 3, "the public-surface union must not exceed three");
});

test("10.1-UNIT-SHAPE-08 (Task 1.3 uniqueness invariant): no tenant table / nav route / file owner type is declared by two modules", async () => {
  // Learn from the READINESS_CODES gap: membership guards do NOT catch a duplicated literal that
  // silently inflates a derived union. Assert cross-module uniqueness explicitly.
  const manifest = await loadManifest();
  const dupOf = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);
  const tables = manifest.modules.flatMap((m) => m.tenantTables);
  const routes = manifest.modules.flatMap((m) => m.navItems.map((n) => n.route));
  const owners = manifest.modules.flatMap((m) => m.fileOwnerTypes);
  assert.deepEqual(dupOf(tables), [], `duplicate tenant table(s) across modules: ${dupOf(tables).join(", ")}`);
  assert.deepEqual(dupOf(routes), [], `duplicate nav route(s) across modules: ${dupOf(routes).join(", ")}`);
  assert.deepEqual(dupOf(owners), [], `duplicate file owner type(s) across modules: ${dupOf(owners).join(", ")}`);
});

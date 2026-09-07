/**
 * Story 10.1 AC3 (the four authored guardrail copies now DERIVE from the manifest, proven byte-equal
 * to today's Phase-A values — zero drift).
 *
 * ── GREEN (Story 10.1 shipped) ─────────────────────────────────────────────────────────────────
 * The manifest (`@/scope/manifest`), its selector helpers (`@/scope/manifest-schema`), and the nav
 * registry (`@/scope/nav-registry`) are landed and the four consumers derive from the manifest; the
 * suite imports the REAL modules, is unskipped, and runs green.
 *
 * NON-CIRCULAR PROOF (Dev Notes "circular-derivation trap"): each derivation is proven equal to an
 * INDEPENDENT ground truth — a PINNED Phase-A literal here, plus the still-authored `navItems` /
 * `FORBIDDEN_DEFERRED_CATEGORIES` live imports — never against another manifest-derived value.
 *
 * Intended selector contract (dev-story implements on `@/scope/manifest-schema`):
 *   navRoutesFromManifest(m)        -> active modules' navItems routes
 *   tenantTablesFromManifest(m)     -> union of active modules' tenantTables
 *   deferredFileTokensFromManifest(m) -> union of pending modules' file-index deferred tokens
 * And `@/scope/nav-registry` exports `EXPECTED_NAV_ROUTES` (the manifest-derived active nav routes).
 *
 * [Source: story 10.1 AC3, Tasks 4/5/6; architecture-phase-b.md §5.3 (the four derivations);
 *  Dev Notes (circular-derivation trap, deny-list derivation nuance).]
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const sortedUnique = (xs: string[]) => [...new Set(xs)].sort();

// PINNED Phase-A ground truths (independent of the manifest).
const PINNED_DENY_TOKENS = ["fortnox", "supplier", "asset", "rental", "hr", "dou", "upphandling"];
const PINNED_NAV_ROUTES = [
  "/dashboard",
  "/customers",
  "/calculations",
  "/quotes",
  "/jobs",
  "/files",
  "/settings",
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
  "quote_review_authorizations",
  "quote_acceptances",
  // Story 10.2 — the Förlorad/Avböjd reason table joins the active quotes module (activation seam).
  "quote_lost_reasons",
  // Story 10.3 — the follow-up workflow table joins the same active quotes module (activation seam).
  "quote_follow_ups",
  "jobs",
  "job_events",
];

type AnyModule = {
  status: "active" | "pending";
  navItems: { route: string }[];
  tenantTables: string[];
};

async function loadManifest() {
  return (await import("@/scope/manifest")) as { SCOPE_MANIFEST: { modules: AnyModule[] } };
}
async function loadSchema() {
  return (await import("@/scope/manifest-schema")) as {
    navRoutesFromManifest: (m: { modules: AnyModule[] }) => string[];
    tenantTablesFromManifest: (m: { modules: AnyModule[] }) => string[];
    deferredFileTokensFromManifest: (m: { modules: AnyModule[] }) => string[];
  };
}

// ── Derivation 1: the deferred deny-list (Task 4) ─────────────────────────────────────────────
test("10.1-UNIT-DERIVE-01 (AC3): FORBIDDEN_DEFERRED_CATEGORIES derives from `pending` modules == the pinned 7 tokens", async () => {
  const { SCOPE_MANIFEST } = await loadManifest();
  const { deferredFileTokensFromManifest } = await loadSchema();
  const derived = deferredFileTokensFromManifest(SCOPE_MANIFEST);
  assert.deepEqual(
    sortedUnique(derived),
    sortedUnique(PINNED_DENY_TOKENS),
    "the manifest-derived deferred file tokens must equal exactly the 7 authored deny tokens (no drift)",
  );
});

test("10.1-UNIT-DERIVE-02 (AC3): the LIVE deny-list export equals the manifest derivation (grounded on the pinned 7)", async () => {
  // Grounds the refactor: the module the app consumes must expose the derived-and-proven set.
  const live = (await import("@/features/files/deferred-categories")) as {
    FORBIDDEN_DEFERRED_CATEGORIES: readonly string[];
  };
  assert.deepEqual(
    sortedUnique([...live.FORBIDDEN_DEFERRED_CATEGORIES]),
    sortedUnique(PINNED_DENY_TOKENS),
    "FORBIDDEN_DEFERRED_CATEGORIES must still equal the pinned 7 tokens after deriving from the manifest",
  );
});

// ── Derivation 2: the nav guardrail expected set (Task 5) ─────────────────────────────────────
test("10.1-UNIT-DERIVE-03 (AC3): the nav registry derives the expected route set from the manifest == the pinned 7 routes", async () => {
  const registry = (await import("@/scope/nav-registry")) as { EXPECTED_NAV_ROUTES: readonly string[] };
  assert.deepEqual(
    sortedUnique([...registry.EXPECTED_NAV_ROUTES]),
    sortedUnique(PINNED_NAV_ROUTES),
    "the manifest-derived expected nav routes must equal the 7 Phase-A routes",
  );
});

test("10.1-UNIT-DERIVE-04 (AC3): the manifest-derived nav routes equal the AUTHORED nav-items hrefs (non-circular grounding)", async () => {
  const { SCOPE_MANIFEST } = await loadManifest();
  const { navRoutesFromManifest } = await loadSchema();
  const authored = (await import("@/components/app-shell/nav-items")) as {
    navItems: ReadonlyArray<{ href: string }>;
  };
  assert.deepEqual(
    sortedUnique(navRoutesFromManifest(SCOPE_MANIFEST)),
    sortedUnique(authored.navItems.map((n) => n.href)),
    "manifest-derived routes must equal the still-authored nav-items hrefs (icons stay authored; routes derive)",
  );
});

// ── Derivation 3: the H4 tenant-table inventory expectation (Task 6) ──────────────────────────
test("10.1-UNIT-DERIVE-05 (AC3): TENANT_TABLES derives as the union of active modules' tenantTables == the pinned 28", async () => {
  // Baseline was 24; Story 10.2's quote_lost_reasons enrolment grew the active union to 25, and Story
  // 10.3's quote_follow_ups enrolment grows it to 26; Story 10.8's review authority makes 27.
  const { SCOPE_MANIFEST } = await loadManifest();
  const { tenantTablesFromManifest } = await loadSchema();
  const derived = tenantTablesFromManifest(SCOPE_MANIFEST);
  assert.equal(derived.length, 28, "the derived tenant-table union must total exactly 28");
  assert.deepEqual(
    sortedUnique(derived),
    sortedUnique(PINNED_TENANT_TABLES),
    "the manifest-derived tenant tables must equal exactly the 28 authored H4-enrolled tables (no drift)",
  );
});

// ── Fail-loud retained (AC3 final clause / architecture §16, AC-PH-4) ─────────────────────────
test("10.1-UNIT-DERIVE-06 (AC3 fail-loud): a surface NOT listed in the manifest is not silently admitted by the derivation", async () => {
  // The derivations are the CLOSED union of manifest-listed surfaces — an unlisted table/route can
  // never appear in the derived set. Prove the derived sets are pure functions of the manifest:
  // an arbitrary non-manifest token is absent from every derived union.
  const { SCOPE_MANIFEST } = await loadManifest();
  const { tenantTablesFromManifest, navRoutesFromManifest } = await loadSchema();
  assert.ok(
    !tenantTablesFromManifest(SCOPE_MANIFEST).includes("supplier_invoices"),
    "an unlisted table must never appear in the derived tenant-table union",
  );
  assert.ok(
    !navRoutesFromManifest(SCOPE_MANIFEST).includes("/fortnox"),
    "an unlisted route must never appear in the derived nav route set",
  );
});

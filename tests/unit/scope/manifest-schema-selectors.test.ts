/**
 * Coverage expansion — Story 10.1 `src/scope/manifest-schema.ts` (bmad-testarch-automate).
 *
 * The ATDD suite (`manifest-shape` / `manifest-coherence` / `manifest-derivations`) proves the
 * ACs against the real manifest, but several SHIPPED code paths in `manifest-schema.ts` had no
 * direct coverage:
 *   - the pure selectors `activeModules` / `pendingModules` / `fileOwnerTypesFromManifest`
 *     (0 direct tests) and the `uniqueInOrder` dedup contract shared by every selector;
 *   - the coherence validator's `duplicate-surface` rule (the Task-1.3 uniqueness invariant, the
 *     improvement over the ledgered `READINESS_CODES` gap) — the ATDD `manifest-shape` test only
 *     asserts the REAL manifest has no duplicates; it never proves `validateManifestCoherence`
 *     itself FIRES on an injected duplicate, so the whole `flagDuplicates` branch was un-exercised;
 *   - the orphan rule for the SOFT surfaces (notification category / file owner type / public
 *     surface) as DISTINCT from `pending-module-live-surface` — the ATDD negatives use loose
 *     `orphan || pending-live` OR-assertions, so the soft-surface branch of the A22 traceability
 *     rule was never pinned;
 *   - the validator's defensive edge behaviour (empty manifest, no active modules).
 *
 * These are green (automate / post-implementation) — synthetic fixtures over the pure functions.
 *
 * [Source: story 10.1 AC3/AC4, Task 1.2/1.3; architecture-phase-b.md §5.3 (selectors), §5.4
 *  (coherence + A22 lesson + uniqueness invariant); Constraints (READINESS_CODES uniqueness gap).]
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  activeModules,
  pendingModules,
  navRoutesFromManifest,
  tenantTablesFromManifest,
  fileOwnerTypesFromManifest,
  deferredFileTokensFromManifest,
  validateManifestCoherence,
} from "@/scope/manifest-schema";
import type {
  ScopeManifest,
  ScopeModule,
  CoherenceViolation,
} from "@/scope/manifest-schema";

/** Minimal coherent active module; override per case. Cast at the call site where a fixture is
 *  deliberately incoherent (matches the manifest-coherence ATDD fixture pattern). */
function mod(over: Partial<ScopeModule> = {}): ScopeModule {
  return {
    id: "m",
    label: "Module",
    wave: "A",
    status: "active",
    epic: "E1",
    activatedAt: "2026-01-01",
    navItems: [],
    tenantTables: [],
    widgets: [],
    notificationCategories: [],
    publicSurfaces: [],
    fileOwnerTypes: [],
    ...over,
  };
}
const manifestOf = (...modules: ScopeModule[]): ScopeManifest => ({ modules });
const ruleSet = (vs: CoherenceViolation[]) => new Set(vs.map((v) => v.rule));

// ── Selectors: active/pending partition ───────────────────────────────────────────────────────
test("10.1-UNIT-SEL-01: activeModules / pendingModules partition by status (pure, exhaustive)", () => {
  const a = mod({ id: "a", status: "active" });
  const b = mod({ id: "b", status: "pending", epic: undefined, activatedAt: undefined });
  const c = mod({ id: "c", status: "active" });
  const m = manifestOf(a, b, c);
  assert.deepEqual(activeModules(m).map((x) => x.status), ["active", "active"]);
  assert.deepEqual(pendingModules(m).map((x) => x.status), ["pending"]);
  // Every module lands in exactly one partition (no drop, no double-count).
  assert.equal(activeModules(m).length + pendingModules(m).length, m.modules.length);
});

// ── Selectors: unions are scoped to the right status ──────────────────────────────────────────
test("10.1-UNIT-SEL-02: nav/table/owner selectors read ACTIVE modules only; deny-token reads PENDING only", () => {
  const active = mod({
    id: "act",
    navItems: [{ route: "/x" }],
    tenantTables: ["t_active"],
    fileOwnerTypes: ["owner_active"],
  });
  const pending = mod({
    id: "pen",
    status: "pending",
    epic: undefined,
    activatedAt: undefined,
    // A pending module's surfaces must NOT bleed into the active-side derivations.
    navItems: [{ route: "/pending" }],
    tenantTables: ["t_pending"],
    fileOwnerTypes: ["owner_pending"],
    deferredFileToken: "tok",
  });
  const m = manifestOf(active, pending);
  assert.deepEqual(navRoutesFromManifest(m), ["/x"]);
  assert.deepEqual(tenantTablesFromManifest(m), ["t_active"]);
  assert.deepEqual(fileOwnerTypesFromManifest(m), ["owner_active"]);
  assert.deepEqual(deferredFileTokensFromManifest(m), ["tok"]);
});

// ── Selectors: uniqueInOrder dedup contract (the shared helper behind every selector) ─────────
test("10.1-UNIT-SEL-03: derivations de-duplicate across modules, preserving first-seen order", () => {
  const m = manifestOf(
    mod({ id: "a", tenantTables: ["shared", "a_only"], fileOwnerTypes: ["o1"], navItems: [{ route: "/dup" }] }),
    mod({ id: "b", tenantTables: ["shared", "b_only"], fileOwnerTypes: ["o1", "o2"], navItems: [{ route: "/dup" }] }),
  );
  assert.deepEqual(tenantTablesFromManifest(m), ["shared", "a_only", "b_only"]);
  assert.deepEqual(fileOwnerTypesFromManifest(m), ["o1", "o2"]);
  assert.deepEqual(navRoutesFromManifest(m), ["/dup"]);
});

test("10.1-UNIT-SEL-04: deferredFileTokensFromManifest de-duplicates repeated tokens across pending modules", () => {
  const p = (id: string, token: string): ScopeModule =>
    mod({ id, status: "pending", epic: undefined, activatedAt: undefined, deferredFileToken: token });
  const m = manifestOf(p("a", "dup"), p("b", "dup"), p("c", "other"));
  assert.deepEqual(deferredFileTokensFromManifest(m), ["dup", "other"]);
});

test("10.1-UNIT-SEL-05: selectors are total over an empty manifest (no throw, empty unions)", () => {
  const empty = manifestOf();
  assert.deepEqual(activeModules(empty), []);
  assert.deepEqual(pendingModules(empty), []);
  assert.deepEqual(navRoutesFromManifest(empty), []);
  assert.deepEqual(tenantTablesFromManifest(empty), []);
  assert.deepEqual(fileOwnerTypesFromManifest(empty), []);
  assert.deepEqual(deferredFileTokensFromManifest(empty), []);
});

// ── Validator: the duplicate-surface rule (Task 1.3) — one biting negative per surface kind ────
test("10.1-UNIT-COH-EXT-01 (Task 1.3): a tenant table declared by two modules is flagged duplicate-surface (and NOTHING else)", () => {
  const m = manifestOf(
    mod({ id: "a", tenantTables: ["customers"] }),
    mod({ id: "b", tenantTables: ["customers"] }),
  );
  assert.deepEqual([...ruleSet(validateManifestCoherence(m))], ["duplicate-surface"]);
});

test("10.1-UNIT-COH-EXT-02 (Task 1.3): a nav route declared by two modules is flagged duplicate-surface", () => {
  const m = manifestOf(
    mod({ id: "a", navItems: [{ route: "/dashboard" }] }),
    mod({ id: "b", navItems: [{ route: "/dashboard" }] }),
  );
  assert.deepEqual([...ruleSet(validateManifestCoherence(m))], ["duplicate-surface"]);
});

test("10.1-UNIT-COH-EXT-03 (Task 1.3): a file owner type declared by two modules is flagged duplicate-surface", () => {
  const m = manifestOf(
    mod({ id: "a", fileOwnerTypes: ["customer"] }),
    mod({ id: "b", fileOwnerTypes: ["customer"] }),
  );
  assert.deepEqual([...ruleSet(validateManifestCoherence(m))], ["duplicate-surface"]);
});

test("10.1-UNIT-COH-EXT-04 (Task 1.3): a widget declared by two modules is flagged duplicate-surface", () => {
  const m = manifestOf(
    mod({ id: "a", widgets: ["w"] }),
    mod({ id: "b", widgets: ["w"] }),
  );
  assert.deepEqual([...ruleSet(validateManifestCoherence(m))], ["duplicate-surface"]);
});

test("10.1-UNIT-COH-EXT-05 (Task 1.3): a token duplicated within ONE module's array is still flagged once", () => {
  // A single module carrying the same table twice would silently inflate a derived union — the exact
  // READINESS_CODES failure mode. The uniqueness rule must catch intra-module dups too.
  const m = manifestOf(mod({ id: "a", tenantTables: ["dup", "dup"] }));
  const vs = validateManifestCoherence(m);
  assert.deepEqual([...ruleSet(vs)], ["duplicate-surface"]);
  assert.equal(vs.length, 1, "a duplicate must be reported exactly once, not once per extra occurrence");
});

// ── Validator: soft-surface orphan is DISTINCT from pending-live (the A22 traceability gap) ────
test("10.1-UNIT-COH-EXT-06 (AC4 rule 2): a pending module's file owner type orphans WITHOUT tripping pending-live-surface", () => {
  // fileOwnerTypes is a SOFT surface (not nav/table/widget) — it must trace-fail (orphan) but must
  // NOT count as the pending module carrying LIVE surface. Pins the two rules as independent.
  const m = manifestOf(
    mod({ id: "core", tenantTables: ["tenants"] }),
    mod({ id: "ghost", status: "pending", epic: undefined, activatedAt: undefined, fileOwnerTypes: ["ghost_owner"] }),
  );
  const flagged = ruleSet(validateManifestCoherence(m));
  assert.ok(flagged.has("orphan-surface"), "soft-surface on a pending module must orphan");
  assert.ok(!flagged.has("pending-module-live-surface"), "a soft surface must NOT trip the live-surface rule");
});

test("10.1-UNIT-COH-EXT-07 (AC4 rule 2): a pending module's notification category orphans (traceability closes all six surface kinds)", () => {
  const m = manifestOf(
    mod({ id: "core", tenantTables: ["tenants"] }),
    mod({ id: "ghost", status: "pending", epic: undefined, activatedAt: undefined, notificationCategories: ["ghost_cat"] }),
  );
  const flagged = ruleSet(validateManifestCoherence(m));
  assert.ok(flagged.has("orphan-surface"));
  assert.ok(!flagged.has("pending-module-live-surface"));
});

test("10.1-UNIT-COH-EXT-08 (AC4 rule 2 vs 4): a VALID public surface on a pending module orphans but does NOT trip the closed-set rule", () => {
  // calendar_feed is inside the ADR-B004 closed set, so rule 4 stays silent — but it is on a PENDING
  // module, so rule 2 (untraceable to an active module) must still fire. A pending module carries no
  // declared public surface until activation (§5.5).
  const m = manifestOf(
    mod({ id: "core", tenantTables: ["tenants"] }),
    mod({ id: "sched", status: "pending", epic: undefined, activatedAt: undefined, publicSurfaces: ["calendar_feed"] }),
  );
  const flagged = ruleSet(validateManifestCoherence(m));
  assert.ok(flagged.has("orphan-surface"));
  assert.ok(!flagged.has("public-surface-exceeds-closed-set"), "an in-set public surface must not trip rule 4");
});

// ── Validator: defensive edge cases ───────────────────────────────────────────────────────────
test("10.1-UNIT-COH-EXT-09: an empty manifest is vacuously coherent (defensive `?? []` guard)", () => {
  assert.deepEqual(validateManifestCoherence(manifestOf()), []);
});

test("10.1-UNIT-COH-EXT-10: a manifest with only clean pending modules (all surfaces empty) is coherent", () => {
  const p = (id: string): ScopeModule =>
    mod({ id, status: "pending", epic: undefined, activatedAt: undefined });
  assert.deepEqual(validateManifestCoherence(manifestOf(p("a"), p("b"))), []);
});

test("10.1-UNIT-COH-EXT-11 (AC4 rule 4): a public surface OUTSIDE the closed set fires even when the union size is <= 3", () => {
  // Guards that rule 4 keys on membership, not only on count (a single rogue token must fail).
  const m = manifestOf(mod({ id: "a", publicSurfaces: ["rogue_surface"] as unknown as ScopeModule["publicSurfaces"] }));
  assert.ok(ruleSet(validateManifestCoherence(m)).has("public-surface-exceeds-closed-set"));
});

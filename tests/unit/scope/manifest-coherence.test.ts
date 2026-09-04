/**
 * Story 10.1 AC4 (manifest coherence validator: presence AND coherence).
 *
 * ── GREEN (Story 10.1 shipped; extended by the 10.4 integration review) ────────────────────────
 * `src/scope/manifest-schema.ts` (`validateManifestCoherence`) and `src/scope/manifest.ts`
 * (`SCOPE_MANIFEST`) are landed; the suite imports the REAL modules and runs green. The 10.4 review
 * added the `missing-activation-date` / `duplicate-module-id` / `duplicate-soft-surface` rules with
 * biting negatives below so the validator matches the docstring/AGENTS.md "presence AND coherence".
 *
 * The contract the validator implements:
 *   `validateManifestCoherence(manifest): CoherenceViolation[]`
 *     - pure function, input = a manifest object, output = a list of violations (empty = coherent).
 *     - `CoherenceViolation = { rule: CoherenceRule; detail: string }`
 *     - `CoherenceRule` includes the four 10.1 rules (AC4):
 *         "active-module-missing-epic"
 *         "orphan-surface"                    (a nav/table/widget/notification-category/file-owner-
 *                                              type/public-surface not traceable to an active module)
 *         "pending-module-live-surface"       (a pending module carrying nav/table/widget)
 *         "public-surface-exceeds-closed-set" (> the ADR-B004 closed set of three)
 *     - plus "duplicate-surface" (Task 1.3 uniqueness) — exercised in manifest-shape.test.ts.
 *   NOTE (EB-A5 carve-out): the "activation without permission-matrix rows fails" rule is wired at
 *   Story 11.1, NOT here. This suite deliberately does NOT assert it.
 *
 * "A22 lesson" (architecture §5.4): the validator must check coherence, not just presence — so each
 * NEGATIVE case injects an incoherent fixture and asserts the SPECIFIC rule fires (proves the guard
 * BITES; no vacuous green).
 *
 * [Source: story 10.1 AC4, Task 1.2, Task 3.2; architecture-phase-b.md §5.4 (A22 lesson);
 *  Constraints EB-A5 (matrix-row rule → 11.1, not here).]
 */
import { test } from "node:test";
import assert from "node:assert/strict";

type NavSpec = { route: string; group?: string; requiredCapability?: string };
type FixtureModule = {
  id: string;
  label: string;
  wave: string;
  status: "active" | "pending";
  epic?: string;
  activatedAt?: string;
  navItems: NavSpec[];
  tenantTables: string[];
  widgets: string[];
  notificationCategories: string[];
  publicSurfaces: string[];
  fileOwnerTypes: string[];
  /** PENDING-only governance metadata — the deny-list derives from it; activation must drop it. */
  deferredFileToken?: string;
};
type Violation = { rule: string; detail: string };

/** Minimal coherent active-module fixture; override fields per negative case. */
function makeModule(over: Partial<FixtureModule> = {}): FixtureModule {
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

async function loadValidator(): Promise<(m: { modules: FixtureModule[] }) => Violation[]> {
  const mod = (await import("@/scope/manifest-schema")) as {
    validateManifestCoherence: (m: { modules: FixtureModule[] }) => Violation[];
  };
  return mod.validateManifestCoherence;
}

async function loadRealManifest(): Promise<{ modules: FixtureModule[] }> {
  const mod = (await import("@/scope/manifest")) as {
    SCOPE_MANIFEST: { modules: FixtureModule[] };
  };
  return mod.SCOPE_MANIFEST;
}

const rules = (vs: Violation[]) => new Set(vs.map((v) => v.rule));

// ── POSITIVE ────────────────────────────────────────────────────────────────────────────────
test("10.1-UNIT-COH-00 (AC4 positive): the REAL manifest is coherent (validator returns zero violations)", async () => {
  const validate = await loadValidator();
  const manifest = await loadRealManifest();
  const violations = validate(manifest);
  assert.deepEqual(violations, [], `real manifest must be coherent, got: ${JSON.stringify(violations)}`);
});

// ── NEGATIVE: one biting case per AC4 rule ────────────────────────────────────────────────────
test("10.1-UNIT-COH-01 (AC4 rule 1): an `active` module WITHOUT an epic reference is flagged", async () => {
  const validate = await loadValidator();
  const manifest = {
    modules: [makeModule({ id: "no-epic", epic: undefined })],
  };
  assert.ok(
    rules(validate(manifest)).has("active-module-missing-epic"),
    "validator must flag an active module missing its epic reference",
  );
});

test("10.1-UNIT-COH-02 (AC4 rule 2): an ORPHAN nav item not traceable to an active module is flagged", async () => {
  const validate = await loadValidator();
  // A pending module declaring a nav route it does not own live, with no active owner → orphan.
  const manifest = {
    modules: [makeModule({ id: "a", navItems: [{ route: "/dashboard" }] })],
  };
  // Inject an orphan surface via a stray pending module claiming a live nav route no active owns.
  manifest.modules.push(
    makeModule({ id: "ghost", status: "pending", wave: "B2", epic: undefined, activatedAt: undefined, navItems: [{ route: "/ghost" }] }),
  );
  const flagged = rules(validate(manifest));
  assert.ok(
    flagged.has("orphan-surface") || flagged.has("pending-module-live-surface"),
    "a nav route not traceable to an active module must be flagged",
  );
});

test("10.1-UNIT-COH-03 (AC4 rule 2): an ORPHAN tenant table not traceable to an active module is flagged", async () => {
  const validate = await loadValidator();
  // Trace surface only when its module is active AND present; a table on a pending module is not
  // traceable to an active module.
  const manifest = {
    modules: [
      makeModule({ id: "core", tenantTables: ["tenants"] }),
      makeModule({ id: "ghost", status: "pending", wave: "B2", epic: undefined, activatedAt: undefined, tenantTables: ["ghost_table"] }),
    ],
  };
  const flagged = rules(validate(manifest));
  assert.ok(
    flagged.has("orphan-surface") || flagged.has("pending-module-live-surface"),
    "a tenant table not traceable to an active module must be flagged",
  );
});

test("10.1-UNIT-COH-04 (AC4 rule 3): a `pending` module carrying LIVE surface (nav/table/widget) is flagged", async () => {
  const validate = await loadValidator();
  const manifest = {
    modules: [
      makeModule({
        id: "premature",
        status: "pending",
        wave: "B1b",
        epic: undefined,
        activatedAt: undefined,
        widgets: ["premature_widget"],
      }),
    ],
  };
  assert.ok(
    rules(validate(manifest)).has("pending-module-live-surface"),
    "a pending module carrying live surface must be flagged",
  );
});

test("10.1-UNIT-COH-05 (AC4 rule 4): a public-surface union EXCEEDING the closed set of three is flagged", async () => {
  const validate = await loadValidator();
  const manifest = {
    modules: [
      makeModule({ id: "a", publicSurfaces: ["calendar_feed", "asset_qr"] }),
      makeModule({ id: "b", publicSurfaces: ["unsubscribe", "rogue_surface"] }),
    ],
  };
  const flagged = rules(validate(manifest));
  assert.ok(
    flagged.has("public-surface-exceeds-closed-set") || flagged.has("orphan-surface"),
    "a public-surface union of four (outside the ADR-B004 closed set) must be flagged",
  );
});

test("10.1-UNIT-COH-07 (AC4): an `active` module WITHOUT an activatedAt date is flagged (missing-activation-date)", async () => {
  const validate = await loadValidator();
  const manifest = {
    modules: [makeModule({ id: "live-no-date", activatedAt: undefined })],
  };
  assert.ok(
    rules(validate(manifest)).has("missing-activation-date"),
    "an active module without an activatedAt date must be flagged (it went live but recorded no activation date)",
  );
});

test("10.1-UNIT-COH-11 (Codex review): an `active` module with a MALFORMED activatedAt is flagged (missing-activation-date)", async () => {
  const validate = await loadValidator();
  // Presence alone let a mistyped/impossible date claim valid activation provenance. Each of these
  // is non-empty (so the old presence check passed) but is not a real ISO calendar date.
  for (const bad of ["soon", "2026-13-01", "2026-02-30", "26-07-20", "2026/07/20", "2026-07-20T00:00:00Z"]) {
    const manifest = { modules: [makeModule({ id: "crm", activatedAt: bad })] };
    assert.ok(
      rules(validate(manifest)).has("missing-activation-date"),
      `activatedAt ${JSON.stringify(bad)} must be flagged as not a real ISO YYYY-MM-DD date`,
    );
  }
});

test("10.1-UNIT-COH-11 (Codex review): a WELL-FORMED activatedAt is NOT flagged (non-vacuity)", async () => {
  const validate = await loadValidator();
  // The other half: a real date must pass, or the rule would reject the live manifest.
  for (const good of ["2026-07-20", "2026-02-28", "2024-02-29"]) {
    const manifest = { modules: [makeModule({ id: "crm", activatedAt: good })] };
    assert.ok(
      !rules(validate(manifest)).has("missing-activation-date"),
      `activatedAt ${JSON.stringify(good)} is a real calendar date and must NOT be flagged`,
    );
  }
});

test("10.1-UNIT-COH-10 (Codex review): an `active` module RETAINING a deferredFileToken is flagged (active-module-retains-deferred-token)", async () => {
  const validate = await loadValidator();
  // The realistic regression: an activation PR flips only `status` and forgets to drop the token.
  // The deny-list derives from pending tokens, so a retained token on an active module would block
  // that shipped module's OWN files. Nothing else catches it (the orphan pass skips active modules).
  const manifest = {
    modules: [makeModule({ id: "rentals", deferredFileToken: "rental" })],
  };
  assert.ok(
    rules(validate(manifest)).has("active-module-retains-deferred-token"),
    "an active module still carrying a deferredFileToken must be flagged — activation has to drop it",
  );
});

test("10.1-UNIT-COH-10 (Codex review): a PENDING module carrying a deferredFileToken is NOT flagged (pending-only metadata is the intended baseline)", async () => {
  const validate = await loadValidator();
  // The non-vacuity half: the rule must not fire on the CORRECT shape, or it would reject the real
  // manifest (all seven current tokens sit on pending modules and feed the deny-list).
  const manifest = {
    modules: [
      makeModule({
        id: "rentals",
        status: "pending",
        epic: undefined,
        activatedAt: undefined,
        deferredFileToken: "rental",
      }),
    ],
  };
  assert.ok(
    !rules(validate(manifest)).has("active-module-retains-deferred-token"),
    "a pending module's deferredFileToken is the intended baseline and must NOT be flagged",
  );
});

test("10.1-UNIT-COH-08 (AC4): a module `id` declared by TWO modules is flagged (duplicate-module-id)", async () => {
  const validate = await loadValidator();
  const manifest = {
    modules: [
      makeModule({ id: "crm", navItems: [{ route: "/customers" }] }),
      // A second module reusing the same id — activeModules/pendingModules key by status, not id, so a
      // duplicate id would collapse two modules' derived surface onto one key. Distinct routes so the
      // ONLY violation is the duplicate id (not a duplicate nav route).
      makeModule({ id: "crm", navItems: [{ route: "/facilities" }] }),
    ],
  };
  assert.ok(
    rules(validate(manifest)).has("duplicate-module-id"),
    "a module id declared by more than one module must be flagged",
  );
});

test("10.1-UNIT-COH-09 (AC4): a SOFT surface declared by TWO modules is flagged (duplicate-soft-surface)", async () => {
  const validate = await loadValidator();
  // Two ACTIVE modules (so neither is an orphan) each declare the SAME notification category — the
  // soft-surface uniqueness invariant the hard nav/table/widget `duplicate-surface` rule doesn't cover.
  const manifest = {
    modules: [
      makeModule({ id: "a", notificationCategories: ["job.reminder"] }),
      makeModule({ id: "b", notificationCategories: ["job.reminder"] }),
    ],
  };
  const flagged = rules(validate(manifest));
  assert.ok(
    flagged.has("duplicate-soft-surface"),
    "a notification category declared by two modules must be flagged as a duplicate soft surface",
  );
  assert.ok(!flagged.has("orphan-surface"), "two active modules own their own surface — never orphans");
});

test("10.1-UNIT-COH-06 (EB-A5 carve-out): the validator does NOT implement the permission-matrix-row rule (wired at 11.1)", async () => {
  // An active module with no permission-matrix rows must NOT, on its own, produce a violation in
  // 10.1 — that rule lands at Story 11.1. A coherent module (with epic + traceable surface) is
  // coherent here regardless of any matrix source.
  const validate = await loadValidator();
  const manifest = {
    modules: [makeModule({ id: "crm", navItems: [{ route: "/customers" }], tenantTables: ["customers"] })],
  };
  const flagged = rules(validate(manifest));
  assert.ok(
    !flagged.has("active-module-missing-permission-matrix"),
    "the matrix-row rule must not be implemented in 10.1 (EB-A5 → 11.1)",
  );
});

test.skip("[P0] 11.1 coherence: missing matrix coverage for an active module emits the dedicated violation while the real matrix remains green", async () => {
  const validate = await loadValidator();
  const { PERMISSION_MATRIX } = await import("@/server/authz/permission-matrix");
  const missing = { modules: [makeModule({ id: "foundation" })] };
  assert.ok(
    rules(validate(missing, { permissionMatrix: {} })).has("active-module-missing-permission-matrix"),
  );
  assert.deepEqual(validate(await loadRealManifest(), { permissionMatrix: PERMISSION_MATRIX }), []);
});

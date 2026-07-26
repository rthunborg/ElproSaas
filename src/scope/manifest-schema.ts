/**
 * The typed scope-manifest schema + its pure derivation selectors + the coherence validator
 * (Story 10.1, ADR-B003 §5.2–§5.4). The manifest itself (the `SCOPE_MANIFEST` constant) lives in
 * the sibling `manifest.ts`; this module holds the TYPES it is `satisfies`-guarded against, the pure
 * selector helpers the four guardrail derivations consume (§5.3), and the presence-AND-coherence
 * validator (§5.4, the Epic 9 `A22` lesson).
 *
 * WHY A TYPED TS MODULE (ADR-B003 §5.1 / EB-A6): the manifest is the single machine-readable scope
 * source that runtime code (nav registry, deny-list, future widget/producer registries) imports; a
 * TS module is importable everywhere with zero parsing and gives compile-time coherence for free
 * (literal-union `wave`/`publicSurface` typo-checks). It mirrors the repo's proven `READINESS_CODES`
 * `satisfies`-guard single-source pattern — and IMPROVES on it by adding a cross-module UNIQUENESS
 * invariant (the ledgered `READINESS_CODES` gap: its exhaustiveness guard checked membership but NOT
 * uniqueness, so a duplicated literal compiled fine and silently inflated a derived union).
 *
 * SCOPE (Story 10.1 only): this ships the schema, the four §5.3 derivations' selectors, and the
 * coherence validator's four 10.1 rules + the uniqueness invariant. It does NOT wire the widget
 * registry, producer registry, `owner_type`-union derivation, or public-surface closed-set
 * derivation (those are "later derivations as they land" per §5.3), and it does NOT implement the
 * permission-matrix-row coherence rule (EB-A5 → wired at Story 11.1; wiring it now would self-fail
 * against a matrix source that does not exist yet).
 *
 * [Source: architecture-phase-b.md §5.2 (schema), §5.3 (derivations), §5.4 (coherence + A22 lesson),
 *  §5.5 (activation); ADR-B004 §6.1 (public-surface closed set of three); story 10.1 AC2/AC3/AC4,
 *  Tasks 1/4/5/6; Constraints (READINESS_CODES uniqueness gap → add uniqueness; EB-A5 → matrix rule
 *  at 11.1; EB-A10 → a platform-scoped entry must be expressible).]
 */

/**
 * Delivery wave tag. Phase A is `A`; Phase B is delivered across `B1a`/`B1b`/`B2`/`B3` (ratified
 * party-session §2 waves). A literal union so `tsc` typo-checks each module's wave.
 */
export type Wave = "A" | "B1a" | "B1b" | "B2" | "B3";

/**
 * The ADR-B004 CLOSED set of exactly three unauthenticated surfaces (§6.1). A literal union so the
 * compiler rejects a fourth value at authoring time; the coherence validator additionally enforces
 * the union stays ⊆ this set at runtime (defence-in-depth for a loosely-typed activation).
 */
export type PublicSurface = "calendar_feed" | "asset_qr" | "unsubscribe";

/**
 * An epic reference (`E1`..`E34`). Architecture §5.2 illustrates the Phase B range `E10..E34`; Phase
 * A active modules carry their real delivering epic (`E1`..`E9`) — Open Question 1's applied default.
 * A template-literal type so a typo (`E`-prefixed number required) is a compile error while both the
 * Phase A and Phase B ranges are admitted (the validator only checks PRESENCE when a module is
 * active; §5.4 first bullet).
 */
export type EpicRef = `E${number}`;

/**
 * A single nav entry a module owns (§5.2). Carries the ROUTE (the derivation input), the sidebar
 * GROUP, and the future `requiredCapability` (the §15.1 nav-registry `manifest × permission-matrix`
 * derivation — the matrix half lands at Story 11.1; Phase A is admin-only so it is left unset here).
 * Icons/labels stay AUTHORED in `nav-items.ts` (Story 10.1 derives only the route expectation).
 */
export interface ScopeNavItem {
  /** The English route path (e.g. `/customers`). The nav-guardrail derivation input. */
  readonly route: string;
  /** The sidebar group the item renders under (the §15.1 grouped model). */
  readonly group?: string;
  /** The capability gating the item — wired at Story 11.1 (§15.1 matrix half); unset in 10.1. */
  readonly requiredCapability?: string;
}

/**
 * The scope class of a module (EB-A10). Almost every module is `tenant`-scoped; the E12 operator
 * console + `platform_operators` are an enumerated PLATFORM-scoped exception class. Optional
 * (defaults to tenant) so the schema can EXPRESS a future platform-scoped entry without any 10.1
 * module using it (E12 is pending).
 */
export type ModuleScope = "tenant" | "platform";

/**
 * A single scope module (§5.2). An `active` module's declared surface is LIVE (rendered/enrolled)
 * and MUST carry an `epic` + `activatedAt`; a `pending` module carries NO live surface (every
 * surface array empty) — only its `deferredFileToken` future-surface metadata — until its epic's
 * first story flips it `pending → active` in the same PR as its first schema/nav change (§5.5).
 */
export interface ScopeModule {
  /** Stable module id (e.g. `crm`, `fortnox`). Unique across the manifest. */
  readonly id: string;
  /** Human label (Swedish/English display name). */
  readonly label: string;
  /** Delivery wave (§5.2). */
  readonly wave: Wave;
  /** `active` = live Phase A surface; `pending` = declared future Phase B surface, not yet live. */
  readonly status: "active" | "pending";
  /**
   * The delivering (active) / authorizing (pending) epic. REQUIRED when `active` (§5.4 rule 1 — the
   * validator enforces presence); optional on `pending` (carried as activation metadata).
   */
  readonly epic?: EpicRef;
  /** The ISO date the module went live. REQUIRED when `active` (§5.2). */
  readonly activatedAt?: string;
  /** Scope class (EB-A10); defaults to tenant when omitted. */
  readonly scope?: ModuleScope;
  /** The module's nav entries (empty for a nav-less or pending module). */
  readonly navItems: ScopeNavItem[];
  /** The tenant-owned tables the module enrolls (empty for a pending module). */
  readonly tenantTables: string[];
  /** The dashboard widget ids the module owns (empty in 10.1 — widget registry is a later derivation). */
  readonly widgets: string[];
  /** The notification categories the module produces (empty in 10.1). */
  readonly notificationCategories: string[];
  /** The unauthenticated public surfaces the module owns — ⊆ the ADR-B004 closed set (empty in Phase A). */
  readonly publicSurfaces: PublicSurface[];
  /** The file `owner_type` values the module owns (empty for a pending module). */
  readonly fileOwnerTypes: string[];
  /**
   * The file-index deferred-category deny token this PENDING module contributes to
   * `FORBIDDEN_DEFERRED_CATEGORIES` (Task 4 derivation). Present ONLY on a pending module whose
   * future file surface must be denied in the limited Phase-A `Filer` index until activation (e.g.
   * `fortnox`, `supplier`, `asset`, `rental`, `hr`, `dou`, `upphandling`). Active modules and pending
   * modules without a file surface omit it. On activation the module flips to `active` and its token
   * drops out of the derived deny-list automatically (§5.5).
   */
  readonly deferredFileToken?: string;
}

/** The scope manifest: the ordered list of every Phase A + Phase B module. */
export interface ScopeManifest {
  readonly modules: ScopeModule[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure derivation selectors (§5.3) — consumed by the four guardrail derivations.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The minimal structural module shape the pure derivations READ. Kept permissive (only the read
 * fields, the rest optional) so any manifest-like object satisfies it — the real `ScopeModule` does,
 * and so does a thinner caller/test module. The selectors are pure structural functions over this.
 */
export interface ManifestModuleInput {
  readonly status: string;
  readonly navItems: readonly { readonly route: string }[];
  readonly tenantTables: readonly string[];
  readonly fileOwnerTypes?: readonly string[];
  readonly deferredFileToken?: string;
}

/** A manifest-like object the pure derivations accept (the real `ScopeManifest` satisfies it). */
export interface ManifestInput {
  readonly modules: readonly ManifestModuleInput[];
}

/** The `active` modules (Phase A live surface). */
export function activeModules(manifest: ManifestInput): ManifestModuleInput[] {
  return manifest.modules.filter((m) => m.status === "active");
}

/** The `pending` modules (declared future Phase B surface). */
export function pendingModules(manifest: ManifestInput): ManifestModuleInput[] {
  return manifest.modules.filter((m) => m.status === "pending");
}

/** De-duplicate preserving first-seen order (the derivations are order-insensitive but stable). */
function uniqueInOrder(xs: readonly string[]): string[] {
  return [...new Set(xs)];
}

/**
 * Derivation 2 (§5.3): the nav-guardrail expected route set — the routes of every `active` module's
 * nav items. Grounded non-circularly against the still-authored `nav-items.ts` hrefs (Task 5).
 */
export function navRoutesFromManifest(manifest: ManifestInput): string[] {
  return uniqueInOrder(
    activeModules(manifest).flatMap((m) => m.navItems.map((n) => n.route)),
  );
}

/**
 * Derivation 3 (§5.3): the H4 tenant-table inventory EXPECTED enrollment set — the union of every
 * `active` module's tenant tables. Grounded non-circularly by the H4 gate introspecting the LIVE DB
 * schema (Task 6): the DB itself is the ground truth, not another authored copy.
 */
export function tenantTablesFromManifest(manifest: ManifestInput): string[] {
  return uniqueInOrder(activeModules(manifest).flatMap((m) => [...m.tenantTables]));
}

/**
 * The file `owner_type` union of the `active` modules. Provided for coherence/traceability; 10.1
 * does NOT re-source the runtime `OWNER_TYPES` union off this (that is a §5.3 "later derivation").
 */
export function fileOwnerTypesFromManifest(manifest: ManifestInput): string[] {
  return uniqueInOrder(
    activeModules(manifest).flatMap((m) => [...(m.fileOwnerTypes ?? [])]),
  );
}

/**
 * Derivation 1 (§5.3): the deferred deny-list — the union of every `pending` module's file-index
 * deferred token. Consumed by `deferred-categories.ts` so `FORBIDDEN_DEFERRED_CATEGORIES` derives
 * from the manifest (Task 4). Grounded non-circularly against a PINNED literal of the 7 authored
 * tokens (Task 4.2). A module activating drops its token from this set automatically (§5.5).
 */
export function deferredFileTokensFromManifest(manifest: ManifestInput): string[] {
  return uniqueInOrder(
    pendingModules(manifest).flatMap((m) =>
      m.deferredFileToken ? [m.deferredFileToken] : [],
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Coherence validator (§5.4) — presence AND coherence (the A22 lesson).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The coherence rules the validator enforces at Story 10.1. The `active-module-missing-permission-
 * matrix` rule (§5.4 fifth bullet) is DELIBERATELY absent — it is wired at Story 11.1 (EB-A5), when
 * the permission-matrix source exists; wiring it here would self-fail.
 */
export type CoherenceRule =
  /** An `active` module without an `epic` reference (§5.4 rule 1). */
  | "active-module-missing-epic"
  /** An `active` module without an `activatedAt` date (§5.2 — an active module went live on a date). */
  | "missing-activation-date"
  /** An `active` module RETAINING a `deferredFileToken` — pending-only governance metadata that
   *  activation must drop, or the derived deny-list blocks the shipped module's own files. */
  | "active-module-retains-deferred-token"
  /** A surface (nav/table/widget/notification-category/file-owner-type/public-surface) not
   *  traceable to an `active` module (§5.4 rule 2 — the A22 lesson: presence is not enough). */
  | "orphan-surface"
  /** A `pending` module carrying LIVE surface (nav/table/widget) (§5.4 rule 3). */
  | "pending-module-live-surface"
  /** The public-surface union exceeding the ADR-B004 closed set of three (§5.4 rule 4). */
  | "public-surface-exceeds-closed-set"
  /** A tenant table / nav route / file owner type / widget declared by two modules
   *  (Task 1.3 uniqueness invariant — the improvement over the `READINESS_CODES` gap). */
  | "duplicate-surface"
  /** A module `id` declared by two modules (a duplicate id collapses two modules' derived
   *  surface into one key — the module-identity half of the uniqueness invariant). */
  | "duplicate-module-id"
  /** A SOFT surface (notification category / file owner type / public surface / deferred file
   *  token) declared by two modules — the uniqueness invariant extended to the soft surfaces the
   *  `duplicate-surface` (hard nav/table/widget) rule does not cover. */
  | "duplicate-soft-surface";

/** A single coherence violation: the rule that fired + a developer-facing detail. */
export interface CoherenceViolation {
  readonly rule: CoherenceRule;
  readonly detail: string;
}

/** The ADR-B004 closed set of three (kept as a `string` Set so the runtime check accepts any token). */
const PUBLIC_SURFACE_CLOSED_SET: ReadonlySet<string> = new Set<string>([
  "calendar_feed",
  "asset_qr",
  "unsubscribe",
]);

/**
 * Validate the manifest for PRESENCE AND COHERENCE (§5.4). Pure: input = the manifest, output = the
 * list of violations (empty = coherent). Encodes the Story-10.1 rules + the full uniqueness
 * invariant; NOT the permission-matrix rule (EB-A5 → 11.1).
 *
 * The rules enforced: an `active` module carries an `epic` AND an `activatedAt` date; every surface is
 * traceable to an `active` module (the A22 lesson — presence is not enough); `pending` modules carry no
 * live surface; the public-surface union stays within the ADR-B004 closed set; module ids are unique;
 * and NO nav route / tenant table / widget / file owner type (hard) NOR notification category / public
 * surface / deferred file token (soft) is declared by two modules. Each rule is exercised by a biting
 * negative case in `tests/unit/scope/manifest-coherence.test.ts`.
 */
/**
 * True only for a REAL ISO `YYYY-MM-DD` calendar date. Round-trips through Date so an impossible
 * day (2026-02-30, 2026-13-01) is rejected rather than silently rolled over by the Date parser.
 */
function isCalendarDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function validateManifestCoherence(
  manifest: ScopeManifest,
): CoherenceViolation[] {
  const violations: CoherenceViolation[] = [];
  const modules = manifest.modules ?? [];

  // ── Rule 1: an `active` module must carry an `epic` reference (§5.4 rule 1) AND an activation
  // date (§5.2 — an active module went live on a specific date; a missing date is an incoherent
  // "live but never activated" record). ──
  for (const m of modules) {
    if (m.status !== "active") continue;
    if (!m.epic || String(m.epic).length === 0) {
      violations.push({
        rule: "active-module-missing-epic",
        detail: `active module "${m.id}" has no epic reference (an active module must name its delivering epic)`,
      });
    }
    if (!m.activatedAt || String(m.activatedAt).length === 0) {
      violations.push({
        rule: "missing-activation-date",
        detail: `active module "${m.id}" has no activatedAt date (an active module must record the date it went live)`,
      });
    } else if (!isCalendarDate(String(m.activatedAt))) {
      // Presence alone let a mistyped/impossible date ("2026-13-45", "soon") pass the gate while
      // claiming valid activation provenance (Codex review). Require the documented YYYY-MM-DD shape
      // AND a real calendar date (round-tripped, so 2026-02-30 is rejected rather than rolled over).
      violations.push({
        rule: "missing-activation-date",
        detail: `active module "${m.id}" has activatedAt "${m.activatedAt}", which is not a real ISO YYYY-MM-DD calendar date`,
      });
    }
    // `deferredFileToken` is PENDING-only governance metadata (AGENTS.md): the file-index deny-list
    // is DERIVED from pending tokens, so a token retained on an ACTIVE module would make the
    // deny-list block a SHIPPED module's own files. Activation must drop it. Without this rule an
    // activation that flips only `status` passes coherence while carrying the stale token — the
    // orphan-surface pass skips active modules, so nothing else catches it (Codex review).
    if (m.deferredFileToken && String(m.deferredFileToken).length > 0) {
      violations.push({
        rule: "active-module-retains-deferred-token",
        detail: `active module "${m.id}" still carries deferredFileToken "${m.deferredFileToken}" (a deferred token is pending-only metadata — activation must drop it, or the deny-list will block this module's own files)`,
      });
    }
  }

  // ── Module-id uniqueness: a module `id` declared by two modules collapses their derived surface
  // onto one key (activeModules/pendingModules filter by status, not id) — the module-identity half
  // of the uniqueness invariant the READINESS_CODES gap taught us to enforce. ──
  {
    const seen = new Set<string>();
    const reported = new Set<string>();
    for (const m of modules) {
      if (seen.has(m.id) && !reported.has(m.id)) {
        reported.add(m.id);
        violations.push({
          rule: "duplicate-module-id",
          detail: `module id "${m.id}" is declared by more than one module (module ids must be unique across the manifest)`,
        });
      }
      seen.add(m.id);
    }
  }

  // ── Rule 2 + Rule 3: traceability + pending-liveness. A pending module owns NO surface; any
  // surface it declares is an ORPHAN (not traceable to an active module) — and its nav/table/widget
  // additionally trips the pending-live rule. Active modules own their own surface (traceable to
  // themselves), so they are never orphans. ──
  for (const m of modules) {
    if (m.status === "active") continue;
    // Rule 3: a pending module carrying LIVE surface (nav/table/widget).
    if (
      m.navItems.length > 0 ||
      m.tenantTables.length > 0 ||
      m.widgets.length > 0
    ) {
      violations.push({
        rule: "pending-module-live-surface",
        detail: `pending module "${m.id}" carries live surface (nav/table/widget) — a pending module must wire no route, enroll no table, and render no widget until activation`,
      });
    }
    // Rule 2: EVERY surface element on a non-active module is an orphan (not traceable to an active
    // module) — covers the softer surfaces (notification categories, file owner types, public
    // surfaces) too, so the A22 traceability gap is closed for all six surface kinds.
    const orphans: Array<{ kind: string; el: string }> = [
      ...m.navItems.map((n) => ({ kind: "nav route", el: n.route })),
      ...m.tenantTables.map((t) => ({ kind: "tenant table", el: t })),
      ...m.widgets.map((w) => ({ kind: "widget", el: w })),
      ...m.notificationCategories.map((c) => ({ kind: "notification category", el: c })),
      ...m.fileOwnerTypes.map((o) => ({ kind: "file owner type", el: o })),
      ...m.publicSurfaces.map((p) => ({ kind: "public surface", el: p })),
    ];
    for (const { kind, el } of orphans) {
      violations.push({
        rule: "orphan-surface",
        detail: `${kind} "${el}" on non-active module "${m.id}" is not traceable to an active module`,
      });
    }
  }

  // ── Rule 4: the public-surface union across ALL modules must stay ⊆ the ADR-B004 closed set of
  // three (§5.4 rule 4). A value outside the set OR a union larger than three fails. ──
  const allPublic = modules.flatMap((m) => m.publicSurfaces as readonly string[]);
  const uniquePublic = [...new Set<string>(allPublic)];
  const outOfSet = uniquePublic.filter((s) => !PUBLIC_SURFACE_CLOSED_SET.has(s));
  // Bound against the CLOSED-SET's own size, not a driftable literal `3` — the exact invariant the
  // manifest initiative exists to remove (a duplicated magic number is the READINESS_CODES gap).
  if (outOfSet.length > 0 || uniquePublic.length > PUBLIC_SURFACE_CLOSED_SET.size) {
    violations.push({
      rule: "public-surface-exceeds-closed-set",
      detail: `the public-surface union ${JSON.stringify(uniquePublic)} exceeds the ADR-B004 closed set {calendar_feed, asset_qr, unsubscribe}`,
    });
  }

  // ── Uniqueness invariant (Task 1.3): no tenant table / nav route / file owner type / widget may
  // be declared by two modules — so a derived union can never silently double-count (the ledgered
  // `READINESS_CODES` uniqueness gap this manifest must not repeat). ──
  const flagDuplicates = (label: string, xs: readonly string[]): void => {
    const seen = new Set<string>();
    const reported = new Set<string>();
    for (const x of xs) {
      if (seen.has(x) && !reported.has(x)) {
        reported.add(x);
        violations.push({
          rule: "duplicate-surface",
          detail: `${label} "${x}" is declared by more than one module (cross-module uniqueness invariant)`,
        });
      }
      seen.add(x);
    }
  };
  flagDuplicates("tenant table", modules.flatMap((m) => m.tenantTables));
  flagDuplicates("nav route", modules.flatMap((m) => m.navItems.map((n) => n.route)));
  flagDuplicates("file owner type", modules.flatMap((m) => m.fileOwnerTypes));
  flagDuplicates("widget", modules.flatMap((m) => m.widgets));

  // ── SOFT-surface uniqueness: the `duplicate-surface` rule above covers the HARD nav/table/widget
  // surfaces (+ file owner type). Extend the same invariant to the remaining SOFT surfaces
  // (notification categories, public surfaces, deferred file tokens) so a value declared by two
  // modules can never silently double-count in a derived union — the docstring/AGENTS.md
  // "cross-module uniqueness of publicSurfaces/notificationCategories/deferredFileToken" claim. ──
  const flagSoftDuplicates = (label: string, xs: readonly string[]): void => {
    const seen = new Set<string>();
    const reported = new Set<string>();
    for (const x of xs) {
      if (seen.has(x) && !reported.has(x)) {
        reported.add(x);
        violations.push({
          rule: "duplicate-soft-surface",
          detail: `${label} "${x}" is declared by more than one module (cross-module soft-surface uniqueness invariant)`,
        });
      }
      seen.add(x);
    }
  };
  flagSoftDuplicates("notification category", modules.flatMap((m) => m.notificationCategories));
  flagSoftDuplicates("public surface", modules.flatMap((m) => m.publicSurfaces as readonly string[]));
  flagSoftDuplicates(
    "deferred file token",
    modules.flatMap((m) => (m.deferredFileToken ? [m.deferredFileToken] : [])),
  );

  return violations;
}

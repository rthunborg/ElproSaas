# Story 10.1: Phase B Governance Re-Baseline and Scope Manifest

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an implementation lead,
I want the Phase B scope re-baseline and the single machine-readable scope manifest landed in one story before any module story,
so that all ~15–25 Phase B scope changes flow through one derived, validated source of truth instead of four drifting authored copies.

## Story Context

- **Epic 10 [Wave B1a]:** Quote Lifecycle Completion (+ Phase B Governance Re-Baseline). Deliberately small first epic (PB-D3) to warm up the Phase B pipeline.
- **This is the FIRST delivered story of Phase B** and it **blocks every other Phase B story** (10.2, 10.3, 10.4, and all of Epic 11+). Get the governance foundation right; everything downstream inherits it.
- **Nature of the work:** docs-heavy re-baseline + a focused code refactor. **No database schema, no migration, no new dependency, no money/tax/quote logic, no RLS change.** (Explicit per epics §Story 10.1 impact statements and architecture ADR-B003 §5.5.)
- **Design authority (read these — they govern):** `architecture-phase-b.md` §5 (ADR-B003, DECIDED) is the design authority; `prd-phase-b.md` §13 fixes the story content; `prd-phase-b.md` §14 is the Phase C ledger (the new deferred set). `architecture-phase-b.md` §17 lists the exact `src/scope/` files 10.1 adds.
- **The problem this solves (Epic 9 retro theme):** scope truth today lives in **four independently-authored copies** — the file-index deny-list, the nav guardrail, the H4 tenant-table inventory, and the deferred-token scope scans — which drift. 10.1 collapses them to one derived source (PRD §13 item 3).

## Acceptance Criteria

### AC1 — Re-baseline the authored governance docs to Phase B (one ADR-backed change)

**Given** the ratified Phase B planning package (PRD, architecture ADR-B003)
**When** the re-baseline change lands
**Then** the `AGENTS.md` phase statement and deferral list are rewritten to Phase B scope with the Phase C ledger (PRD §14) as the deferred set
**And** `docs/process` scope statements and the `phase-scope-reviewer` agent are updated to review against the manifest, all in one ADR-backed change.

### AC2 — Introduce the typed scope manifest at `src/scope/manifest.ts`

**Given** the scope manifest is introduced at `src/scope/manifest.ts`
**When** it is type-checked and imported
**Then** it is a typed, `satisfies ScopeManifest`-guarded constant listing per module: `id`, `label`, `wave` (`A`/`B1a`/`B1b`/`B2`/`B3`), `status` (`active`/`pending` — with an **epic reference + date required when `active`**), `navItems`, `tenantTables`, `widgets`, `notificationCategories`, `publicSurfaces`, and `fileOwnerTypes`
**And** Phase A's shipped surface (**7 nav items, 24 tenant tables, 7 file owner types**) is the initial `active` set under wave `A`, with every Phase B module `pending`.

### AC3 — Refactor the four authored guardrail copies to derive from the manifest, with proven zero drift

**Given** the derivation refactor
**When** the guardrail suites run
**Then** the deferred deny-list (`src/features/files/deferred-categories.ts`), the nav guardrail expected set, the tenant-table inventory expectation (H4 expected enrollment), and the deferred-token scope scans **derive their expected values from the manifest**
**And** the derived expected values are **identical to the previously authored Phase A values** (proving no drift during the refactor)
**And** fail-loud is retained: any surface not manifest-listed still fails CI (FR129, FR130).

### AC4 — Ship the manifest coherence validator (presence AND coherence)

**Given** the manifest coherence validator
**When** an incoherent manifest state is introduced in test
**Then** the suite fails for **each** of:
- an `active` module without an epic reference;
- a nav item, tenant table, widget, notification category, file owner type, or public surface **not traceable to an `active` module**;
- a `pending` module with **live surface** (nav/table/widget);
- a public-surface union **exceeding the ADR-B004 closed set of three** (`calendar_feed`, `asset_qr`, `unsubscribe`).

> **Scope carve-out (EB-A5):** the coherence rule *"activating a module without permission-matrix rows fails"* (§5.4 fifth bullet) is **wired at Story 11.1**, NOT here — the permission-matrix source does not exist until 11.1, and wiring it now would produce a self-failing validator. **All OTHER validator rules land in 10.1.** Do not implement the matrix-row rule in this story.

## Tasks / Subtasks

- [ ] **Task 1 — Author the manifest schema + coherence validator (AC2, AC4)**
  - [ ] 1.1 Create `src/scope/manifest-schema.ts`: the `ScopeManifest` / `ScopeModule` types. Per-module shape (architecture §5.2): `{ id, label, wave: 'A'|'B1a'|'B1b'|'B2'|'B3', status: 'active'|'pending', epic?: <epic-ref> (required when active), activatedAt?: <ISO date> (required when active), navItems: { route, group, requiredCapability }[], tenantTables: string[], widgets: string[], notificationCategories: string[], publicSurfaces: ('calendar_feed'|'asset_qr'|'unsubscribe')[], fileOwnerTypes: string[] }`. Use literal-union types for `wave`, module `id`, and `publicSurfaces` so `tsc` typo-checks them (the proven `READINESS_CODES` `satisfies`-guard shape — see Dev Notes).
  - [ ] 1.2 Write the coherence validator as a pure function over the manifest (input = the manifest constant, output = a list of coherence violations, empty = coherent). Encode the four 10.1 rules from AC4. **Do NOT encode the matrix-row rule (11.1, EB-A5).**
  - [ ] 1.3 Add a compile-time `satisfies ScopeManifest` guard on the manifest constant AND a uniqueness invariant: no duplicate table / nav route / file-owner-type / widget id across modules (learn from the deferred `READINESS_CODES` gap — its exhaustiveness guard checked membership but NOT uniqueness; a dup compiles fine and silently inflates a union — see Constraints).
- [ ] **Task 2 — Author `src/scope/manifest.ts` with the Phase A active set + Phase B pending stubs (AC2)**
  - [ ] 2.1 Model the **Phase A active modules** (wave `A`, status `active`) partitioning the **exact 24 tenant tables** enrolled in `TENANT_TABLES` today, the **7 nav items** from `nav-items.ts`, and the **7 file owner types** from `OWNER_TYPES`. See the RECOMMENDED partition in Dev Notes (24/7/7 verified). Assign each active module a real delivering-epic reference + an `activatedAt` date (see Open Question 1 default).
  - [ ] 2.2 Model the **Phase B pending modules** (status `pending`) at least enough to (a) satisfy the deny-list derivation (the 7 deferred file-index tokens must be reproducible from `pending` modules — see Task 4) and (b) leave a clean seam for per-epic activation. Pending modules carry NO live surface (no nav route wired, no table enrolled, no widget rendered) — only their declared future surface metadata.
  - [ ] 2.3 Verify the manifest is coherent: run the Task 1 validator against it and confirm zero violations; confirm `tsc` passes.
- [ ] **Task 3 — Ship the coherence validator unit suite (AC4)**
  - [ ] 3.1 Create `tests/unit/scope/` suite. Positive: the real manifest is coherent (validator returns zero violations) and `satisfies`-guarded (typecheck is the compile-time half).
  - [ ] 3.2 Negative: one focused case per AC4 rule — inject an incoherent manifest fixture (active module missing epic ref; an orphan nav item / tenant table / widget / notification category / file owner type / public surface not traceable to an active module; a pending module carrying live surface; a public-surface union of four) and assert the validator flags each. Prove the validator BITES (anti-vacuous).
- [ ] **Task 4 — Derive `FORBIDDEN_DEFERRED_CATEGORIES` from the manifest (AC3)**
  - [ ] 4.1 Refactor `src/features/files/deferred-categories.ts` so `FORBIDDEN_DEFERRED_CATEGORIES` is **derived from `pending` modules** (their file-index deferred tokens), not authored.
  - [ ] 4.2 **Prove equality against a PINNED Phase-A baseline (non-circular):** the derived set must equal exactly the current 7 authored tokens `["fortnox","supplier","asset","rental","hr","dou","upphandling"]` (order-insensitive). Assert against a **pinned literal** of these 7 (not against the derivation itself — see the circular-derivation trap in Dev Notes). If the derivation does NOT reproduce exactly these 7, that is the Stop Condition signal — reconcile (do not paper over); escalate only if it reveals genuine unresolvable pre-existing drift (see Constraints / Stop Conditions).
  - [ ] 4.3 Confirm the downstream deferred-token scope scan (`tests/unit/docs/acceptance-gate-report-validators.test.ts`, which imports `FORBIDDEN_DEFERRED_CATEGORIES` LIVE) still passes — it now derives from the manifest transitively through the deny-list, with no change to its own scan regex (see Constraints re: the scan-regex hardening deferral).
- [ ] **Task 5 — Derive the nav guardrail expected set from the manifest (AC3)**
  - [ ] 5.1 Create `src/scope/nav-registry.ts` deriving the expected nav route set from the manifest's `active` modules' `navItems` (architecture §17 lists this as a 10.1 addition; the `× permission matrix` half of §15.1's derivation lands at 11.1 — for now derive from the manifest alone, no matrix).
  - [ ] 5.2 Wire the nav guardrail so its expected set is the manifest-derived routes and **prove equality (non-circular)**: keep `src/components/app-shell/nav-items.ts` as the AUTHORED rendered source (icons + labels + hrefs) and assert the manifest-derived active-nav route set equals the authored `navItems` hrefs (OR a pinned literal of the 7 routes: `/dashboard`, `/customers`, `/calculations`, `/quotes`, `/jobs`, `/files`, `/settings`). Do NOT refactor `nav-items.ts` to import routes from the manifest and then assert derived == derived (vacuous). The manifest carries `route`/`group`/`requiredCapability`, not icons. The existing `.length === 7` assertions in the guardrail suites (`job-non-scope.test.ts`, `file-index-non-scope.test.ts`) must stay green.
- [ ] **Task 6 — Derive the H4 tenant-table inventory expectation from the manifest (AC3)**
  - [ ] 6.1 Refactor `tests/integration/rls/tenant-table-inventory.ts` so `TENANT_TABLES` (the H4 **expected** enrollment set) is derived as the **union of active modules' `tenantTables`**, and **prove equality** with the current 24-table authored list. Non-circular by construction here: the H4 gate (`rls-inventory-gate.int.test.ts`) independently introspects the LIVE DB schema and asserts the manifest-derived `TENANT_TABLES` equals the real 24 enrolled tables — so the DB itself is the ground truth, not another authored copy. (Optionally also pin a Phase-A literal snapshot for a fast unit-level equality check that does not need the stack.)
  - [ ] 6.2 **Do NOT touch the introspection side** (`introspectTenantOwnedTables`) — that is a separately-ledgered, deliberately-deferred concern (see Constraints). 10.1 only re-sources the EXPECTED set; the ACTUAL-side introspection stays exactly as-is (it fails closed on any unknown schema).
- [ ] **Task 7 — Re-baseline the authored governance docs (AC1)**
  - [ ] 7.1 Rewrite `AGENTS.md`: the "Current project phase" statement → Phase B / Legacy Parity Release; the deferral list → the Phase C ledger (PRD §14). Point scope enforcement at the manifest (`src/scope/manifest.ts`). Keep the mandatory rules that still hold (oracle-only Lovable policy, no service-role from client, no unauthenticated privileged functions, migration flow). Update the "no migrations / no deps / no app code for process-only tasks" line to reflect that Phase B module stories DO ship those under manifest governance.
  - [ ] 7.2 Rewrite `.claude/agents/phase-scope-reviewer.md` AND `.codex/agents/phase-scope-reviewer.toml` (both — the coexistence model keeps `.codex/*.toml` as source of truth and `.claude/*.md` materialized; they must not drift): review against the **manifest** + Phase C ledger, not the frozen Phase A deferral list. Update the description, the "Phase A is ONLY" and "Deferred unless re-approved" sections to Phase B scope + the manifest as the review baseline.
  - [ ] 7.3 Update `docs/process/agent-workflow.md` scope statements (the scope-check step, "Keep Phase A small", and the deferred-scope activation flag list at ~line 82) to Phase B + the manifest. Also update `CLAUDE.md` (the phase-note + its reviewer table line "phase-scope-reviewer | review diff against Phase A scope + deferrals in AGENTS.md") and `docs/process/claude-code-coexistence.md` if it restates the phase-scope-reviewer's Phase A baseline. **Do NOT rely solely on this enumeration** — grep the GOVERNANCE docs for residual scope statements (`rg -n "Phase A" AGENTS.md CLAUDE.md docs/process/`) and re-baseline each *enforcement/scope* statement to Phase B (leaving historical/record prose intact per 7.4). Do NOT weaken the `.claude/settings.json` deny set, the `guard.ps1` hook, or the "no service-role from client / no unauthenticated privileged surface" invariants (Stop Condition).
  - [ ] 7.4 Do **NOT** rewrite historical/record docs: `docs/migration/*` (they document completed Phase A migration work), `docs/planning/saas-rebuild-phased-plan-*` and `post-phase-a-plan-*` (append-only records), and Phase A planning artifacts (never edited — PRD §13). Re-baseline only the *governance/enforcement* scope statements.
- [ ] **Task 8 — Verify the full gate (AC3 fail-loud + regressions)**
  - [ ] 8.1 Run typecheck + lint + the full unit/integration suites (the H4 gate and the DB-backed inventory suites need the local Supabase stack — see Testing). Confirm every derived guardrail is green with derived == authored proven, and the coherence validator suite passes.
  - [ ] 8.2 Confirm fail-loud is retained end-to-end: a surface not in the manifest still fails CI (the H4 gate, the deny-list scan, the nav guardrail). The unit gate count grows and never shrinks (architecture §16, AC-PH-4).

## Dev Notes

### What this story is (and is NOT)

- **IS:** create the typed manifest + its coherence validator; collapse four authored scope copies into manifest derivations proven byte-equal to today's values; re-baseline the authored governance docs to Phase B.
- **IS NOT:** any DB schema/migration; any new dependency; any nav item add/remove (the 7 stay 7); any tenant table add/remove (the 24 stay 24); any money/tax/quote/RLS logic; the widget registry, producer/category registry, file `owner_type`-union derivation, or public-surface closed-set derivation — those are **"later derivations as they land"** per architecture §5.3, NOT 10.1. The manifest *lists* `widgets`/`notificationCategories`/`publicSurfaces`/`fileOwnerTypes` per module (schema §5.2) and the validator checks their coherence, but 10.1 does **not** re-wire the runtime `OWNER_TYPES` union or a widget registry off the manifest.

### The four derivations 10.1 must build (architecture §5.3, verbatim scope)

At Story 10.1, derive from the manifest: (1) the deferred deny-list (`deferred-categories.ts` re-derives `FORBIDDEN_DEFERRED_CATEGORIES` from `pending` modules); (2) the nav guardrail expected set; (3) the tenant-table inventory expectation (H4's expected enrollment set — `TENANT_TABLES` must equal the union of active modules' `tenantTables`); (4) the deferred-token scope scans; plus (5) `phase-scope-reviewer`'s review baseline (a docs reference to the manifest). Fail-loud is retained: any surface not manifest-listed fails CI.

### RECOMMENDED Phase A active-module partition (24 tables / 7 nav / 7 owner types — verified)

The dev owns the final module boundaries; this partition is a concrete, verified starting point. Constraints: unions MUST equal the Phase A authored values exactly; each active module MUST have an epic ref + date; the `quotes` module must be shaped so 10.2/10.3 can enroll their new tables into it in the same PR (see Constraints / forward seam).

| Module `id` | wave | nav route (label) | `tenantTables` | `fileOwnerTypes` |
| --- | --- | --- | --- | --- |
| `foundation` | A | — (no nav) | `tenants`, `tenant_memberships`, `audit_events` | — |
| `dashboard` | A | `/dashboard` (Dashboard) | — | — |
| `crm` | A | `/customers` (Kunder) | `customers`, `facilities`, `contacts` | `customer`, `facility`, `contact` |
| `settings` | A | `/settings` (Inställningar) | `company_settings`, `quote_terms`, `work_roles`, `articles` | — |
| `calculations` | A | `/calculations` (Kalkyler) | `calculations`, `calculation_sections`, `calculation_rows` | `calculation` |
| `quotes` | A | `/quotes` (Offerter) | `tenant_counters`, `quotes`, `quote_versions`, `quote_version_lines`, `quote_version_attachments`, `quote_events`, `quote_acceptances` | `quote_version`, `quote_acceptance` |
| `jobs` | A | `/jobs` (Jobb/Order) | `jobs`, `job_events` | `job` |
| `files` | A | `/files` (Filer) | `files`, `file_links` | — |

Counts: tables `3+3+4+3+7+2+2 = 24` ✓; nav routes `dashboard, customers, settings, calculations, quotes, jobs, files = 7` ✓; owner types `customer, facility, contact, calculation, quote_version, quote_acceptance, job = 7` ✓. Note `work_roles`/`articles` (pricing) live under the `/settings/pricing` sub-route, so they sit in the `settings` module (or split into a nav-less `pricing` module — either yields 24). `tenant_counters` is the easy-to-forget quote-numbering table.

### The proven single-source pattern to mirror (`READINESS_CODES`)

`src/features/calculations/readiness.ts` is the repo's proven `satisfies`-guard single-source pattern that ADR-B003 §5.1 explicitly cites. Study it: an `as const` array + `satisfies readonly ReadinessCode[]` (rejects EXTRA/invalid members) + a `_ReadinessCodeExhaustive` conditional type that forces a COMPILE error on an OMITTED member. Mirror this shape for the manifest's typed unions. **Improve on it:** that pattern's exhaustiveness guard checks membership but NOT uniqueness (a known deferral — see Constraints) — the manifest validator MUST also assert no duplicate table/nav/owner-type/widget across modules.

### Current state of the files being modified (READ before editing)

- **`src/features/files/deferred-categories.ts`** (28 lines): exports `FORBIDDEN_DEFERRED_CATEGORIES = ["fortnox","supplier","asset","rental","hr","dou","upphandling"]` + `isForbiddenDeferredCategory()`. This module is deliberately kept SEPARATE from the file-index so the source-token guardrail does not trip on the deny-list's own tokens; it is NOT scanned by that guardrail. Preserve that property after the refactor (the derived deny-list must still not be scanned).
- **`src/components/app-shell/nav-items.ts`** (87 lines): exports `navItems` — 7 items, each `{ label, href, iconPaths }`. The single source of truth for shell nav. Comments emphasize "exactly these seven ... MUST NOT appear here as routes or placeholders." Keep icons here; derive the route/label expectation from the manifest.
- **`tests/integration/rls/tenant-table-inventory.ts`** (72 KB): exports `TENANT_TABLES` (the 24-table `as const`, the H4 single source of truth), `TENANT_ROOT_TABLE`, `TenantTableName`, `INVENTORY_MODULE_PATH`, the per-table cross-tenant/anon metadata helpers, and `introspectTenantOwnedTables` (the ACTUAL-side H4 introspection). Consumers: `cross-tenant-isolation.rls.test.ts`, `anon-path-isolation.rls.test.ts`, `rls-inventory-gate.int.test.ts`, `audit-anon-mutation-enrollment.rls.test.ts`, `settings-rls.int.test.ts`. **Only `TENANT_TABLES` (the expected set) changes source; leave the introspection and all metadata helpers untouched.**
- **`src/server/commands/files/validation.ts`** (owner types): `OWNER_TYPES` = 7 (`customer, facility, contact, calculation, quote_version, quote_acceptance, job`); `ACTIVE_OWNER_TYPES` = 6 (command-layer active). The manifest's `fileOwnerTypes` union must equal the 7 `OWNER_TYPES`. **10.1 does NOT re-derive `OWNER_TYPES` from the manifest** (that's the §5.3 "later derivation"); it only lists them per active module so the coherence validator can trace each to an active module.
- **`.claude/agents/phase-scope-reviewer.md` + `.codex/agents/phase-scope-reviewer.toml`**: both hardcode "Phase A / Internal Pilot MVP" scope and the frozen deferral list; both must be re-baselined to Phase B + the manifest baseline.
- **`AGENTS.md`**: "Current project phase: Phase A / Internal Pilot MVP." + the deferral list + the "no migrations/deps/app-code for process-only tasks" rule.
- **`docs/process/agent-workflow.md`**: scope-check step, "Keep Phase A small", deferred-scope flag list (~line 82).

### The deny-list derivation nuance (highest implementation risk — read carefully)

`FORBIDDEN_DEFERRED_CATEGORIES` must derive from `pending` modules and yet equal EXACTLY the 7 current tokens. The 7 tokens are a mix: some map to genuine Phase B pending modules (Fortnox = E33; assets = B2; supplier file-import; HR = N-10), and some map to Phase C ledger hard-exclusions (DoU automation and tender/FKU are AI-family, Phase C per PRD §14). The clean model: each `pending` module that has a *file-index* surface declares a deferred file-index token; the deny-list = the union of those tokens. Model exactly the seven token-bearing modules so the union equals the seven authored tokens and NO OTHER pending module (RBAC, notifications, scheduling, widgets) contributes a file token. If your derivation naturally yields a different set, that is the AC3 "prove no drift" gate biting — reconcile the model, do not loosen the equality assertion. This is the crux of the story and the primary Stop-Condition trigger.

### The circular-derivation trap (AC3 "prove no drift" must be non-vacuous)

The AC3 proof "derived == previously authored" is only meaningful if it compares the manifest against an INDEPENDENT ground truth — not against another value already derived from the manifest. Ground each derivation:
- **Tenant tables:** grounded by the H4 gate introspecting the LIVE DB schema (the real 24 tables) — strongest.
- **Nav routes:** grounded against the AUTHORED `nav-items.ts` (kept authored) or a pinned literal of the 7 Phase-A routes.
- **Deny-list tokens:** grounded against a pinned literal of the 7 Phase-A tokens.
Never refactor the consumer to import from the manifest AND assert equality against that same manifest-derived value (derived == derived is vacuously green and defeats the whole no-drift guarantee).

### Coherence validator — the "A22 lesson" (architecture §5.4)

The validator checks **presence AND coherence**, not just presence — the Epic 9 `A22` lesson was that a validator checking only membership missed a real gap. Concretely: it is not enough that every listed surface exists; every surface must be *traceable to an `active` module*, `pending` modules must carry *no live surface*, and the public-surface union must stay ≤ 3. Make each negative test prove the rule BITES (inject the incoherent fixture, assert the specific violation) — avoid vacuous green.

### Epic reference for Phase A active modules — resolution

`epic?` is "required when active"; the validator's only check is presence (a non-empty ref). Architecture §5.2 shows `'E10'..'E34'` as the common (Phase B) case, but Phase A modules were delivered in epics 1–9. **Default (Open Question 1):** give each Phase A active module its real Phase A delivering-epic ref (foundation→E2, dashboard/shell→E1, crm/settings→E3, calculations→E5, quotes→E6, acceptance/jobs→E7, files→E8) with `wave: 'A'` and an `activatedAt` Phase A baseline date, and widen the `epic` type to admit Phase A epic refs. This keeps the ref honest/traceable and satisfies the presence check. Proceed on this default; it does not change any external outcome.

## Constraints

- **[Stop Condition — architecture §5.5 / epics]** STOP for human approval if any derived guardrail expectation diverges from the shipped Phase A surface during the refactor (indicates existing drift that must be resolved, not papered over), OR if the re-baseline would require weakening a `deny`/hook enforcement path (`.claude/settings.json` deny set, `guard.ps1`). Do NOT loosen an equality assertion to make a derivation "pass."
- **[Retro / forward seam — epic-10 retro note]** The `quotes` active module must be modeled so Story 10.2 (`quote_lost_reasons`) and Story 10.3 (`quote_follow_ups`) can enroll their new tenant tables into it **in the same PR** as their schema change (epics §Activation: "10.2/10.3 enroll the new quote tables under the active quotes module"). Keep the `quotes` module boundary clean and obvious. (The epic-10 retro note about the Förlorad/Avböjd lifecycle-token model is a **10.2** create-story decision — not this story — but it depends on the `quotes` module seam you establish here.)
- **[Deferred-work — H4 introspection, deferred-work.md "H4 introspection still has coverage gaps"]** `introspectTenantOwnedTables` in `tenant-table-inventory.ts` has KNOWN, DELIBERATELY-DEFERRED coverage gaps (views / transitively-scoped / non-`public` tenant tables). Disposition G-8b: STAYS OPEN, extend only WHEN the first non-conforming tenant table is proposed; the gate fails closed on any unknown schema meanwhile. **10.1 must NOT reopen or extend the introspection** — it only re-sources the EXPECTED set (`TENANT_TABLES`) to derive from the manifest. Leave the ACTUAL-side introspection exactly as-is.
- **[Deferred-work — scope-scan regex, deferred-work.md epic-9 iter-2 "scope-scan whole-word regex ... concatenated deferred-module token"]** `scanSurfaceForDeferred`'s whole-word regex has a known concatenation gap (`assetregistry` for `asset`), owned by a separate future scanner-hardening pass. **10.1 must NOT fix the scan regex** — it only re-sources the token LIST (the deny-list it already imports live). Do not reopen the regex hardening.
- **[Deferred-work — `READINESS_CODES` uniqueness gap, deferred-work.md epic-9 iter-2]** The `satisfies`+exhaustiveness pattern 10.1 mirrors has a ledgered gap: it checks membership but NOT uniqueness (a duplicated literal compiles and silently inflates `.length`). **Learn from it:** the manifest coherence validator MUST assert uniqueness (no duplicate tenant table / nav route / file-owner-type / widget id across modules), so the derived unions can never silently double-count.
- **[EB-A5]** The coherence rule "activation without permission-matrix rows fails" is wired at **11.1**, not 10.1. Implement the other four AC4 rules only.
- **[EB-A10]** E12's operator console + `platform_operators` are recorded in the manifest as **platform-scoped** entries (an enumerated exception class), not a tenant-module flip. Not a live 10.1 concern (E12 is pending), but shape the schema so a future platform-scoped entry is expressible.
- **[Coexistence — CLAUDE.md / AGENTS.md]** `AGENTS.md` is the single shared source of truth for Codex + Claude Code; edit governance rules there, and mirror the reviewer-agent change in BOTH `.codex/agents/phase-scope-reviewer.toml` (source of truth) and `.claude/agents/phase-scope-reviewer.md` (materialized). Do not let them drift.
- **[Do not run git]** The orchestrator owns all git/PR work.

## Persistent Facts

- **PRD §13 says the manifest location was illustrated as "e.g. `docs/scope/phase-b-scope.<yaml|ts>`" — this is SUPERSEDED.** The later, authoritative ADR-B003 §5.1 fixes it to **TypeScript at `src/scope/manifest.ts`** (runtime-importable; AB-A6). Use `src/scope/`, not `docs/scope/`, and TypeScript, not YAML.
- Phase A shipped surface baseline (the numbers the derivations must reproduce): **7 nav items, 24 tenant tables, 7 file owner types** (architecture §5.2, §9 baseline, project-context.md).
- The 7 authored deny tokens: `fortnox, supplier, asset, rental, hr, dou, upphandling` (order-insensitive equality target).
- The Phase C ledger (AGENTS.md deferral rewrite source, PRD §14): all AI flows; live supplier vendor APIs (file import only in B); customer portal / online acceptance (BankID); bookkeeping beyond Fortnox; the public anonymous suggestion endpoint (P70); net-new features beyond parity + the two sanctioned additions (Fortnox, multi-tenant productization); full-release legal/GDPR program; native mobile app; self-serve tenant signup (until N-2). No exceptions without a new owner decision.
- Naming/format conventions carry from Phase A §22 unchanged (snake_case SQL / camelCase TS / `_ore` money suffixes / stable error codes). The manifest is TS: camelCase fields.
- `file:{project-root}/_bmad-output/project-context.md` — the durable AI-rules doc; it enumerates the Phase A active surface (the derivation baseline). It is refreshed AFTER 10.1 merges (document-plan item 10), not by this story.

## Testing Requirements

- **New suite:** `tests/unit/scope/` — the manifest coherence validator suite. Positive (real manifest coherent + `satisfies`-guarded) + one biting negative per AC4 rule (missing epic ref; orphan nav/table/widget/notification-category/file-owner-type/public-surface; pending module with live surface; public-surface union > 3). Prove each negative FIRES (anti-vacuous).
- **Refactored, must stay green with derived == authored PROVEN equal:**
  - the H4 inventory gate + DB-backed cross-tenant/anon suites (`rls-inventory-gate.int.test.ts`, `cross-tenant-isolation.rls.test.ts`, `anon-path-isolation.rls.test.ts`, `audit-anon-mutation-enrollment.rls.test.ts`, `settings-rls.int.test.ts`) — these consume `TENANT_TABLES`; require the local Supabase stack (`supabase db reset` then the `db` test job — the INT suites probe stack reachability but do NOT auto-reset). The derived union must equal the 24 authored tables.
  - the nav guardrails (`tests/unit/guardrails/job-non-scope.test.ts`, `file-index-non-scope.test.ts`) — `navItems.length === 7` + specific-route presence must stay green.
  - the deferred-token scope scan (`tests/unit/docs/acceptance-gate-report-validators.test.ts`) — imports `FORBIDDEN_DEFERRED_CATEGORIES` LIVE; must stay green as the deny-list now derives from the manifest.
  - the file-index deny-list unit tests + the owner-type pins (`tests/unit/features/files/file-index.test.ts`, `tests/unit/server/commands/file-validation.test.ts`, `tests/unit/components/files/entity-file-panel-owner-type.test.ts`).
- **Docs validators / scope-scan CI checks** for the rewritten `AGENTS.md`/`docs/process` statements must pass. If a docs validator hardcodes a Phase A phrase that the rewrite changes, update the validator in the same PR (in-scope for the re-baseline).
- **The unit gate count grows and never shrinks** (architecture §16, AC-PH-4). Add the `tests/unit/scope/` suite to whatever runs the `node --test` / vitest unit gate (mirror how the other `tests/unit/**` suites are registered).
- **Test type note:** the manifest + validator are pure TS → fast `tests/unit/scope/` (no DB). Only the H4 inventory regression needs the DB stack.

### Project Structure Notes

- New files (architecture §17 repo-structure delta): `src/scope/manifest.ts`, `src/scope/manifest-schema.ts`, `src/scope/nav-registry.ts`, `tests/unit/scope/*`. (`src/scope/widget-registry.ts` and `src/server/jobs/producers.ts` from §17 are LATER stories — not 10.1.)
- `src/scope/` is a NEW top-level runtime module directory. Confirm the `@/scope/*` path alias resolves (tsconfig `paths` + the test alias hook `tests/support/alias-hook.mjs`) so both app code and tests can import it. If `@/scope` is not yet mapped, add it (additive, in-scope).
- Placement rationale (§5.1): `src/scope/` (not `docs/scope/`) keeps the runtime import path clean — the nav registry, deny-list, and future widget/producer registries are runtime code that imports the manifest.

### References

- [Source: _bmad-output/planning-artifacts/epics-phase-b.md#Story 10.1] — user story, AC1–AC4, Technical/Test/Security/Money/Migration notes, dependencies, Stop Conditions.
- [Source: _bmad-output/planning-artifacts/epics-phase-b.md#Epic 10 Activation] — "10.2/10.3 enroll the new quote tables under the active quotes module in the same PRs."
- [Source: _bmad-output/planning-artifacts/architecture-phase-b.md#5 ADR-B003] — §5.1 TS-not-YAML + `src/scope/manifest.ts`; §5.2 manifest content schema; §5.3 the four 10.1 derivations + "later derivations"; §5.4 coherence validator rules + the A22 lesson; §5.5 activation protocol + the one-time re-baseline.
- [Source: _bmad-output/planning-artifacts/architecture-phase-b.md#15.1] — nav registry derivation (manifest × matrix; matrix half lands 11.1).
- [Source: _bmad-output/planning-artifacts/architecture-phase-b.md#17] — repo-structure delta (`src/scope/` files 10.1 adds).
- [Source: _bmad-output/planning-artifacts/architecture-phase-b.md#Epic-boundary assumptions] — EB-A5 (matrix-row rule at 11.1), EB-A6 (TS over YAML), EB-A10 (platform-scoped operator entries).
- [Source: _bmad-output/planning-artifacts/prd-phase-b.md#13] — Story 10.1 content (three numbered steps); per-epic activation; downstream document plan.
- [Source: _bmad-output/planning-artifacts/prd-phase-b.md#14] — the Phase C ledger (AGENTS.md deferral rewrite source).
- [Source: src/features/calculations/readiness.ts#95-123] — the `READINESS_CODES` `satisfies`-guard + exhaustiveness pattern to mirror (and improve with uniqueness).
- [Source: src/features/files/deferred-categories.ts] — current `FORBIDDEN_DEFERRED_CATEGORIES` (7 tokens) to derive.
- [Source: src/components/app-shell/nav-items.ts] — the 7 authored nav items.
- [Source: tests/integration/rls/tenant-table-inventory.ts#75-170] — `TENANT_TABLES` (24) + `introspectTenantOwnedTables` (do-not-touch).
- [Source: src/server/commands/files/validation.ts#33-64] — `OWNER_TYPES` (7) / `ACTIVE_OWNER_TYPES` (6).
- [Source: .claude/agents/phase-scope-reviewer.md + .codex/agents/phase-scope-reviewer.toml] — the reviewer agent to re-baseline.
- [Source: AGENTS.md; docs/process/agent-workflow.md] — the authored scope statements to rewrite.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — the H4 introspection deferral (G-8b, do-not-reopen), the scope-scan regex concatenation deferral (do-not-fix), and the `READINESS_CODES` uniqueness gap (learn from → add uniqueness assertion).

## Open Questions

1. **Epic reference format for Phase A active modules** (architecture §5.2 shows `'E10'..'E34'`; Phase A modules delivered in E1–E9). **Default applied:** assign each active module its real Phase A delivering epic + `wave: 'A'` + a baseline `activatedAt` date, widening the `epic` type to admit Phase A refs. Low risk (validator only checks presence); proceeding on the default — no blocker.
2. **`settings` vs `settings`+`pricing` module split** — `work_roles`/`articles` (pricing) sit under `/settings/pricing`. Either one `settings` module (4 tables) or a `settings` (2) + nav-less `pricing` (2) split yields 24. **Default:** single `settings` module unless the derivation reads cleaner split; either is coherent. No blocker.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

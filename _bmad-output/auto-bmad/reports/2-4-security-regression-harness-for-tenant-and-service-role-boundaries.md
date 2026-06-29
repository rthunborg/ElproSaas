# auto-bmad report log — 2-4-security-regression-harness-for-tenant-and-service-role-boundaries

## Report — 2026-06-29T19:06:40Z (final)

**Story:** `2-4-security-regression-harness-for-tenant-and-service-role-boundaries` (epic 2, story 4) — last-in-epic.
**Branch:** `story/2-4-security-regression-harness-for-tenant-and-service-role-boundaries` (HEAD `a2c1bd6`).
**Pipeline status:** Clean completion — code review converged (2 iterations + 1 user-extended verifying pass; 0 Critical/High; dedicated security review clean on all 3 passes). Story implemented, all 6 ACs satisfied, suites green (unit 146, integration 89). Epic-2 end gates: trace CONCERNS (advisory — P1 coverage gap, deferred with owners), NFR PASS, test-review 91/100 Grade A. Last story of epic 2 — epic closed out (project-context refreshed, 9 deferrals archived, retrospective written).
**Continues:** (none — first run)

**Timing:** started 2026-06-29T14:28:50Z; completed in progress — elapsed 4h 37m (≈1h 52m AI-run, ≈2h 45m human/idle wait).

**Phases run:** 0 preflight+TEA triage; 1 branch; 3 create-story (ab-deep); 4 ATDD scaffolds (ab-standard); 5 dev-story (ab-deep); 6 automate coverage (ab-standard); 7 code-review loop — 2 iterations + 1 user-extended (primary ab-deep + secondary ab-alt-deep lenses, ab-security, ab-deep triage, ab-standard fixes); 8 epic-end (trace ab-deep, NFR+test-review ab-standard, project-context ab-standard, deferred-reconcile ab-standard, archive, retrospective ab-alt-standard); 9 finalize (uat ab-standard)
**Skipped:** 2 epic-start setup (not first-in-epic; project-context already existed)

**Overrides:** none

**TEA:** High risk -> [atdd, automate]. ATDD: 14 red-phase scaffolds (green-by-skip, repo-native describe.skip). Automate: +10 unit tests (131->141). Per-story trace advisory: not selected (last story of a short epic). Epic-end gates (last story): trace gate CONCERNS (P0 100% 14/14, overall 89%, P1 80% vs 90% target — the two P1 gaps are gated-Playwright E2E UI/redirect proof + a DB-backed disabled-membership fixture, both deferred with named owners; no tenant-isolation hole); NFR audit PASS (advisory); test-review 91/100 Grade A (one known repeat-run flake, CI unaffected).

**Code review:** 3 passes (2 + 1 user-extended). Roster: primary ab-deep + secondary ab-alt-deep (3 lenses each) + dedicated ab-security; ab-deep triage. Iter 1: Approve — Critical 0 / High 0 / Medium 3 / Low 5; 6 non-deferred fixed (2 Decisions resolved Fix, 4 Patches), 2 deferred. Iter 2: Changes Requested — Critical 0 / High 0 / Medium 1 / Low 8; 5 non-deferred fixed (1 Decision resolved Fix = exhaustive switch/assertNever on the per-table metadata helpers, 4 Patches), 4 deferred; exited at iteration cap unconverged (final pass raised a Medium). HITL halt -> user chose Run another review iteration. Iter 3 (extended): Approve — converged, 0 new findings; every claimed High verified against the real code and dismissed as false-positive (/g regex uses stateless .match(); USE_CLIENT_RE is /m; FK query already excludes partitions; no service-role surface). Security review clean (0 findings) on all 3 passes. End-of-loop HITL halt then auto-skipped (clean convergence).

**UAT:**
1. Install deps clean: pnpm install --frozen-lockfile -> no lockfile/peer errors.
2. Lockfile guard: pnpm run verify:lockfiles -> exits 0.
3. Source-level service-role guard: pnpm run verify:service-role-containment -> exits 0 (no leaks in src/app/scripts/tests + next.config.*).
4. Typecheck incl. exhaustiveness: pnpm typecheck -> exits 0, no 'not assignable to never' (every enrolled TENANT_TABLES entry has a metadata branch).
5. Lint: pnpm lint -> exits 0.
6. Unit suite: pnpm run test:unit -> all pass, 0 skipped (~146).
7. Inventory-gate bite (no DB): unit run includes tests/unit/rls/inventory-gate-core.test.ts green — findUnenrolledTenantTables returns the omitted table when the enrolled set is shrunk.
8. Bundle-check bite (no build): unit run includes tests/unit/scripts/verify/bundle-containment.test.ts green — scanBuiltBundle is GREEN clean / RED on planted service-role NAME, LOCAL_SUPABASE_SERVICE_ROLE_KEY symbol, NEXT_PUBLIC_*SERVICE_ROLE*, or local-demo JWT VALUE, and THROWS when .next is absent.
9. Produce the build: pnpm build -> produces .next/.
10. Authoritative R-002 bundle containment on the real bundle: pnpm run verify:bundle-containment -> exits 0 (zero service-role hits in .next).
11. Fails LOUD on un-built tree: delete .next then pnpm run verify:bundle-containment -> exits 1 with the requires-a-prior-next-build message (no vacuous green); re-run pnpm build to restore.
12. Bites on a planted leak: create .next/static/chunks/_scratch.js containing a SUPABASE_SERVICE_ROLE_KEY string literal, run pnpm run verify:bundle-containment -> exits 1 naming _scratch.js + the token; delete the scratch file to return green.
13. Start local Supabase: supabase start (Docker) -> stack boots.
14. Reset DB: supabase db reset -> applies migrations + seed cleanly (also avoids the cross-run accumulation flake).
15. DB-backed harness, required-stack mode: SUPABASE_TEST_REQUIRED=1 pnpm run test:int -> all pass, 0 skipped (~15 files / ~89); a missing stack is a HARD failure, never a skip.
16. H4 inventory gate live: rls-inventory-gate.int.test.ts passes — live tenant-owned set is exactly {tenants, tenant_memberships, audit_events}; tenants survives despite having no tenant_id column; enrolled-set difference empty.
17. Cross-tenant negatives by mechanism: cross-tenant-isolation.rls.test.ts passes for all 3 tables x SELECT/INSERT/UPDATE/DELETE — denial via SQLSTATE 42501 + independent re-read (not a vacuous empty set).
18. Anonymous negatives incl. audit_events + privileged RPCs: anon-path-isolation.rls.test.ts passes — anon SELECT/INSERT/UPDATE/DELETE denied for all enrolled tables (incl. audit_events); anon EXECUTE denied (42501) for is_active_tenant_member / is_tenant_admin / record_audit_event.
19. H4 gate bites end-to-end: in tenant-table-inventory.ts temporarily remove audit_events from TENANT_TABLES, run SUPABASE_TEST_REQUIRED=1 pnpm run test:int -> inventory gate RED naming audit_events; restore the line and re-run -> green (documented AC4 scratch verification).
20. Whole-pipeline parity: pnpm test (scripts/run-tests.mjs) -> runs unit + int Windows-safely, overall green.
21. CI wiring sanity (review, not execute): in .github/workflows/ci.yml confirm verify:bundle-containment runs in the verify job AFTER pnpm build (order load-bearing), and the db job sets SUPABASE_TEST_REQUIRED=1 + runs supabase db reset -> test:int, with no existing gate weakened/reordered.

**Open questions:** (none)

**Deferred work:**
1. Story 2.3 test-isolation flake: envelope-audit-write.int.test.ts hardcodes correlationId and accumulates rows across repeated non-reset local test:int runs; CI unaffected (resets once). One-line fix (per-run crypto.randomUUID()) -> test-hardening pass. (deferred-work.md)
2. Retro-surfaced: the audit_events append-only trigger blocks tenant ON DELETE CASCADE in cleanupFixture — a non-obvious factory-teardown interaction; resolve before Epic 3 factory teardown. (epic-2-retro-2026-06-29.md)
3. 6 code-review Low deferrals from iters 1-2 logged to deferred-work.md: H4 introspection coverage edges (views/transitive-FK/non-public schemas), bundle-scanner swallowed read errors, enrollment-message anon-helper omission, cross-tenant audit-seed vacuity guard, exact-42501 pin brittleness, dev-side vacuous-skip on no-Docker — forward-looking gate/scanner DX hardening; none bite Phase A's 3 tenant tables.
4. Epic trace-gate P1 gap (advisory): un-skip the gated Playwright E2E (UI tenant-context display + anon route redirect) and add a DB-backed disabled-membership fixture -> lifts P1 80%->90% (PASS). Both deferred with owners.
Phase 8 reconcile marked 0 (all of 2-4 deliverables were already RESOLVED in the ledger); archived 9 fully-resolved deferrals -> deferred-work-resolved.md (top-bar region 2-1, runner reconciliation 2-2, SERVER_ERROR taxonomy 2-2, lexicographic-order fix 2-2, service-role guard 2-1, built-bundle grep 2-4, H4 gate + shared inventory 2-4, re-export-symbol catch 2-4, audit_events anon enrollment 2-4).

**Planning drift:** Detail-level only (no structural drift, no PRD/epic re-sync): architecture.md §15 left actor_user_id FK-on-actor-delete unspecified (2-3 chose ON DELETE SET NULL + nullable so the audit trail survives a deleted actor); architecture.md §18 implies a single test runner, but the standing convention is now a deliberate dual runner (node:test pure units + Vitest DB-backed). Fold both into architecture.md at the next docs refresh.

**⚠️ Needs human:**
1. Optional (does NOT gate done): merge the open PR to land Epic 2 security baseline — offered in the merge prompt below.
2. Heads-up before Epic 3: resolve the audit_events append-only trigger vs ON DELETE CASCADE interaction in cleanupFixture before building Epic 3 factory teardown (retro-surfaced).
3. Optional epic-quality lift: wire the gated Playwright E2E + DB-backed disabled-membership fixture to move the epic trace gate CONCERNS -> PASS.

**Next:** Epic 2 completes when 2-4 lands. Next actionable: Epic 3 first story — run /auto-bmad to create + implement it (preview only; not started).

---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests']
lastStep: 'step-03-generate-tests'
lastSaved: '2026-06-29'
inputDocuments:
  - _bmad-output/implementation-artifacts/2-4-security-regression-harness-for-tenant-and-service-role-boundaries.md
  - _bmad-output/test-artifacts/test-design-epic-2.md
  - tests/integration/rls/tenant-table-inventory.ts
  - tests/integration/rls/rls-inventory-gate.int.test.ts
  - scripts/verify/check-bundle-containment.mjs
  - scripts/verify/check-service-role-containment.mjs
  - tests/unit/rls/inventory-gate-core.test.ts
  - tests/unit/scripts/verify/bundle-containment.test.ts
  - tests/unit/scripts/verify/service-role-containment.test.ts
---

# Test Automation Expansion — Story 2.4 (Security Regression Harness)

## Mode & Stack

- **Mode:** BMad-Integrated (story 2.4 + test-design-epic-2 loaded).
- **Detected stack:** backend/fullstack — bare-Node verify scripts + a pure inventory-gate core (`node --test`) over a DB-backed RLS harness (Vitest + local Supabase).
- **Framework:** present — dual runner (`pnpm run test:unit` = `node --test`; `pnpm run test:int` = Vitest). No framework HALT.
- **Baseline:** 131 unit + 89 DB-backed integration tests, all green.

## Scope of this run

Expand coverage for genuine gaps in THIS story's new/changed code only — the inventory-gate core, the bundle-containment scanner, and the broadened source guard. Do NOT duplicate the existing live INT coverage (cross-tenant/anon negatives, the DB-backed inventory gate, the bite proofs).

## Existing coverage (do NOT duplicate)

- `findUnenrolledTenantTables` pure comparison: shrunk-set bite, fully-enrolled→0, new-schema-table, over-enrollment, sorted/de-dup (`inventory-gate-core.test.ts`).
- DB-backed H4 gate: live tenant-owned set == {tenants, tenant_memberships, audit_events}, set-difference empty, live BITES, DX message (`rls-inventory-gate.int.test.ts`).
- Bundle scanner: clean→0, key-name / re-export-symbol / NEXT_PUBLIC_ / demo-JWT / non-demo-JWT → ≥1, absent-`.next`→throws (`bundle-containment.test.ts`).
- Source guard: NEXT_PUBLIC_ name, `"use client"` key ref, re-export-symbol client ref (RED); declaring module + server-only ref (GREEN) (`service-role-containment.test.ts`).
- Generalized cross-tenant + anon negatives (all four verbs + privileged EXECUTE, `42501` mechanism) — live INT, unchanged.

## Coverage gaps closed (this run — 10 new unit tests, P1/P3)

1. **`introspectTenantOwnedTables` off-DB branch coverage (4 tests, P1/P3, AC3).** The function takes an `AdminQueryFn` so its branches are unit-testable with a fake — but no unit fed it one (only the live INT case, which skips without Docker). Added: the carrier∪`tenants` union (load-bearing edge case — `tenants` has no `tenant_id` column and must survive); `tenants` absent → NOT added (no phantom); a future `tenant_counters` carrier picked up end-to-end through the comparison; the DX message names every table + the module path + cites architecture §18.
2. **Bundle scanner file-selection branches (3 tests, P1, Task 2.1).** `shouldScanFile`/`SCANNED_EXTENSIONS`/`SCANNED_BASENAMES` had no assertions: a SERVICE_ROLE byte-sequence in a binary `.woff`/`.png` must NOT fire (noise-avoidance); an extensionless `BUILD_ID` build manifest MUST be scanned by basename; `walk()` recurses into nested `.next/server/...` and AGGREGATES one violation per offending file.
3. **Source-guard broadened roots (3 tests, Task 2.2).** The Task 2.2 broadening added the `app/**` tree outside `src/` and `next.config.*` to the scanned roots — untested. Added: a `"use client"` leak under root `app/**` (RED), a `NEXT_PUBLIC_*SERVICE_ROLE*` inlined via `next.config.ts` (RED), and a benign `next.config.ts` (GREEN, no over-fire).

## Test levels & priorities

- **Unit (`node --test`):** all 10 additions — pure-logic / file-selection / fake-injected introspection. P1 for the security-bearing branches, P3 for the DX-message contract.
- **Integration (Vitest):** no additions — the live RLS/anon/gate coverage already exists; adding more would duplicate.

## Result

- `pnpm run test:unit` → **141 pass, 0 fail, 0 skip** (was 131).
- `pnpm typecheck` clean; `pnpm lint` clean.
- Integration suite unchanged (89 pass) — no INT tests added, no behavior touched.

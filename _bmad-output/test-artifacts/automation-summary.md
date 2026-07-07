---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
  - 'step-03c-aggregate'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-07-07'
workflowType: testarch-automate
story: 8.3 Tenant-Authorized Signed File Access
detectedStack: fullstack
executionMode: sequential (pure fast-gate + INT refresh-matrix coverage expansion)
inputDocuments:
  - _bmad-output/implementation-artifacts/8-3-tenant-authorized-signed-file-access.md
  - _bmad-output/test-artifacts/test-design-epic-8.md
  - _bmad/tea/config.yaml
  - src/features/files/signed-access-state.ts
  - src/features/files/actions.ts
  - src/components/files/EntityFilePanel.tsx
  - src/server/storage/lifecycle.ts
  - tests/unit/features/files/signed-access-state.test.ts
  - tests/integration/commands/file-signed-access-refresh.int.test.ts
  - tests/integration/commands/file-signed-access.int.test.ts
  - tests/integration/rls/storage-object-isolation.rls.test.ts
  - tests/e2e/files/entity-file-preview.e2e.spec.ts
---

# Test Automation Expansion — Story 8.3 (Tenant-Authorized Signed File Access)

## Mode & Context

- **Mode:** BMad-Integrated (story + `test-design-epic-8.md` provided). Create mode.
- **Detected stack:** `fullstack` (Next.js 16 / React 19 client island + `"use server"` feature action + Supabase/Postgres command layer).
- **Frameworks (verified present):** `node --test` two-runner for pure `.ts` units (`tests/unit/**`, `@/*` alias via `tests/support/register.mjs`), Vitest (`test:int`, DB-backed under `SUPABASE_TEST_REQUIRED=1`), Playwright (`test:e2e`). No `framework` scaffolding needed.
- **TEA flags:** `tea_use_playwright_utils: true`, `test_stack_type: auto`, `risk_threshold: p1`, `tea_execution_mode: auto`.
- **Story state:** `review` — dev-story landed GREEN (unit 1183, INT 663, E2E 6 pass / 1 pre-marked `test.fixme`). This pass EXPANDS the fast `node --test` gate + the INT refresh matrix; it does NOT re-author passing suites or touch product code.

## Coverage Assessment (what Story 8.3 already had)

Dev-story landed comprehensive coverage across levels via the ATDD scaffolds, all green:
- **Pure (`node --test`):** `signed-access-state.test.ts` — 11 cases pinning `SIGNED_ACCESS_INITIAL`, the success-vs-error shape (R-809/R-810: no url on error), and `isSignedUrlExpired` / `shouldReauthorize` core branches (null / past / future / exactly-at-boundary).
- **INT (Vitest, DB-backed):** `file-signed-access.int.test.ts` (8.1 base auth matrix + expiry) and `file-signed-access-refresh.int.test.ts` (8.3 refresh: archive-on-retry → `FILE_ACCESS_DENIED`, twice-signed determinism, foreign/non-existent id → `TENANT_ACCESS_DENIED`, no-raw-path projection).
- **RLS:** `storage-object-isolation.rls.test.ts` (cross-tenant list/read/sign, spoof, malformed-segment, anon, expired-URL).
- **E2E (Playwright):** `entity-file-preview.e2e.spec.ts` (per-file preview mint, generic `role="alert"` denial, no-raw-path DOM guarantee; the low-TTL expiry→reopen case is pre-marked `test.fixme`).

The genuine, non-duplicative gaps were narrow ROBUSTNESS branches in the shipped code, exercised nowhere:

1. **`isSignedUrlExpired` fail-toward-expired branch** (`!Number.isFinite(expiryMs || nowMs) ⇒ return true`) — an unparseable / empty-string `expiresAt`, and an unparseable `nowIso`, were untested. This is load-bearing security behavior: a malformed/missing expiry must fail toward "expired / re-authorize", NEVER fail-open (silently serving a stale signed URL past its window — R-806/R-810).
2. **`shouldReauthorize` on a `success` state with a NULL / unparseable / exactly-at-boundary `expiresAt`** — the existing units covered a `success` with a concrete past/future expiry, but not the defensive delegation paths (a success carrying no verifiable window must still offer re-authorize).
3. **The `deleted` lifecycle transition on the refresh path** — the INT refresh matrix exercised only `archived`-on-retry. `isAccessEligibleLifecycle` rejects BOTH `archived` and `deleted`; only the first ineligible branch was proven through the actual 8.3 refresh entry point (coverage-inversion risk per the epic-8 retro).

Note: `previewEntityFileAction` (the `"use server"` mapper) is intentionally NOT unit-mocked — the project uses no `vi.mock` anywhere, its sibling preview actions (`previewJobEvidenceAction`, `previewQuotePdfAction`) are likewise covered by command-INT + E2E, and the action has no DI seam (hard-calls `createSupabaseServerClient` + `runCommand`). Adding a mock harness would break project convention and require a production refactor — out of scope for a test-only expansion.

## Coverage Plan (this expansion)

| Target | Level | Priority | Test IDs | Justification |
| --- | --- | --- | --- | --- |
| `isSignedUrlExpired` unparseable/empty/bad-clock branch | Unit (`node --test`) | P1 | 8.3-UNIT-01l/01m/01n | Pins fail-toward-expired (never fail-open on a malformed window) — R-806/R-810 |
| `shouldReauthorize` null / boundary / unparseable success expiry | Unit (`node --test`) | P1 | 8.3-UNIT-01o/01p/01q | Closes the defensive-delegation gap on the re-open verdict (AC2) |
| `deleted`-lifecycle transition through the refresh entry point | INT (Vitest, DB-backed) | P0 | 8.3-INT-01a2 | Proves the SECOND ineligible branch is rejected on refresh, not just `archived` (AC2/R-806) |

Scope: **selective expansion** — 6 fast-gate units + 1 DB-backed INT case. No new E2E/RLS (already comprehensive; adding there would duplicate). No framework/CI change. No product code, migration, or dependency touched — test-only.

## Files Changed

- `tests/unit/features/files/signed-access-state.test.ts` (modified) — +6 cases (`8.3-UNIT-01l..01q`): `isSignedUrlExpired` fails toward expired on an unparseable / empty-string `expiresAt` and on an unparseable `nowIso`; `shouldReauthorize` offers re-authorize on a `success` with a null / exactly-at-boundary / unparseable `expiresAt`.
- `tests/integration/commands/file-signed-access-refresh.int.test.ts` (modified) — +1 case (`8.3-INT-01a2`): a file `deleted` between the first sign and the retry is NOT re-signed (`FILE_ACCESS_DENIED`, no url payload), with lifecycle restored for ordering independence.

## Verification

- Pure suite (the extended file): **17 pass / 0 fail** (`node --test`; was 11). Full `pnpm test:unit`: **1189 pass** (was 1183), no regressions.
- INT under `SUPABASE_TEST_REQUIRED=1` (local Supabase stack up): `file-signed-access-refresh` **6 pass** (was 5), `file-signed-access` + `storage-object-isolation` unchanged green — **19 pass across the 3 signed-access/storage suites**.
- `pnpm typecheck`: clean. `eslint` on the two changed files: 0 errors.

## Validation (step 4)

- **Framework readiness:** ✅ (node --test / Vitest / Playwright all present).
- **Coverage mapping:** ✅ tests carry `8.3-UNIT-01l..01q` and `8.3-INT-01a2` IDs mapping to AC2/AC3 and R-806/R-809/R-810.
- **Test quality/structure:** ✅ new units are pure (no DB / no PII / no wall-clock read — both instants passed in), runner-glob-safe under `tests/unit/**` (no `.tsx`); the INT case reuses the enrolled two-tenant fixture + admin lifecycle helper (no ad-hoc isolation test), skips visibly when the local stack/storage is unreachable.
- **Fixtures/factories/helpers:** none added — reuse existing exports + the suite's `adminSetLifecycle` helper.
- **CLI sessions:** none opened (source-analysis path, no browser exploration; no orphaned processes).
- **Temp artifacts:** this summary lives under `_bmad-output/test-artifacts/`.

## Assumptions & Risks

- E2E (Playwright) was **not re-run** in this pass — untouched; the dev-story ran it green (1 case pre-marked `test.fixme` for a low-TTL expiry driver, unchanged and out of scope here). No new E2E authored.
- No product code, migration, or dependency modified — pure test-only expansion; the anon+RLS / no-service-role posture and the signing-funnel reuse (R-814) are unaffected.

## Next Recommended Workflow

- `trace` (refresh the Epic-8 traceability matrix to record the added fast-gate + refresh-matrix coverage for AC2/AC3), or `test-review` (validate the new tests against best-practices). Neither is blocking — the story remains `review` and green across all tiers.

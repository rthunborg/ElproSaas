---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-07-05'
inputDocuments:
  - '_bmad-output/implementation-artifacts/6-1-quote-snapshot-schema-and-server-side-version-creation.md'
  - 'src/lib/quote-snapshot/build.ts'
  - 'src/lib/quote-snapshot/types.ts'
  - 'src/server/commands/quotes/quotes.ts'
  - 'src/server/commands/quotes/validation.ts'
  - 'tests/unit/lib/quote-snapshot/build.test.ts'
  - 'tests/unit/lib/quote-snapshot/golden-pack.test.ts'
  - 'tests/integration/commands/quote-version.int.test.ts'
  - 'tests/unit/server/commands/file-validation.test.ts'
---

# Test Automation Expansion — Story 6.1 (Quote Snapshot Schema + Server-Side Version Creation)

## Step 1 — Preflight & Context

- **Stack:** fullstack (Next.js 16 + Supabase). Frameworks present: Vitest 4.1.9 (`test:int`),
  `node --test` + TS strip-types (`test:unit`), Playwright (`test:e2e`). No framework scaffolding
  missing — no HALT.
- **Mode:** BMad-Integrated (story + epic test-design available).
- **Config:** `_bmad/bmm/config.yaml` (English; implementation_artifacts under `_bmad-output`).

## Step 2 — Identify Targets

Story 6.1 already ships thorough P0 coverage: `build.test.ts` (purity/freeze/öre/internal-exclusion),
`golden-pack.test.ts` (origin-labelled behavioral golden + privacy scan), `quote-version.int.test.ts`
(6.1-INT-02..06 cross-tenant rejection, snapshot completeness, behavioral freeze, numbering
concurrency, atomic rollback, audit), plus the RLS/H4/migration-reset suites. Expansion therefore
targets genuine, non-duplicative gaps — pure DB-free logic that the existing suites only reach
implicitly through the DB-backed path.

| # | Target | Level | Priority | Justification |
|---|--------|-------|----------|---------------|
| 1 | `validateCreateQuoteVersionFromCalculation` (pure input validator) | Unit (`node --test`) | P1 | The ONLY command domain lacking a validation unit test (calc/crm/files/pricing/settings all have one). Exercised today only via DB-backed INT. Guards the input boundary (calc_id UUID, optional bounded attachment array, tenant_id stripping) — cheap, exhaustive branch coverage. |
| 2 | `buildQuoteVersionSnapshot` boundary shapes | Unit (`node --test`) | P1/P2 | `build.test.ts` covers one populated fixture. Under-tested: empty composite children, null terms (`?? null` branch), copy-by-value at ARRAY depth (mutate a source line/attachment/warning element after build), all-null tenant, multi-line order/freeze. |

Coverage scope: **selective** (targeted gap-fill on top of an already-comprehensive P0 suite).
No E2E/component targets — 6.1 is schema+command only, renders nothing (UI is 6.2).

## Step 3 — Generate Tests

**Created:**
- `tests/unit/server/commands/quote-validation.test.ts` — 11 tests: happy paths (with/without
  attachments, uppercase-uuid), optional null/undefined/empty narrowing, non-record rejection,
  missing/non-uuid/over-length calc_id, non-array/non-uuid-element/over-100 attachment lists, the
  exact 100-vs-101 bound, tenant_id stripping, and validated-array copy independence.
- `tests/unit/lib/quote-snapshot/build-edges.test.ts` — 7 tests: empty frozen children, null-terms
  branch, all-null verbatim capture, array-depth copy-by-value for lines/attachments/warnings,
  multi-line order + per-element freeze, deterministic injected clock on the minimal input.

**Verification (local gates run):**
- `pnpm run test:unit` → **905 pass / 0 fail** (was 887; +18 new).
- `pnpm typecheck` → clean.
- `pnpm lint` → 0 errors (1 pre-existing unrelated warning in `money/vat.test.ts`).
- DB-backed suites untouched (pure unit additions only) — no `supabase db reset` required.

## Step 4 — Validate & Summarize

**Checklist:** framework ready ✔ | coverage mapped to AC2/AC3 ✔ | test quality/structure follows the
`file-validation.test.ts` / `*-edges.test.ts` conventions ✔ | fixtures are in-memory DB-free helpers
(no factory/CLI changes) ✔ | no CLI/browser sessions opened (no orphaned browsers) ✔ | artifact stored
in `test-artifacts/` ✔.

**Files created (2):**
- `tests/unit/server/commands/quote-validation.test.ts`
- `tests/unit/lib/quote-snapshot/build-edges.test.ts`

**Assumptions / risks:** the two new suites are pure (no DB) — they run on the fast `node --test`
gate on every PR. They complement, not replace, the DB-backed 6.1-INT-02 ownership proofs (which
remain the authority for the cross-tenant/attachment denial behaviour). No new dependency; no
product-code change; no migration touched.

**Next recommended workflow:** `bmad-testarch-trace` (refresh the 6.1 traceability matrix so the
new validator/builder-edge coverage is reflected) or `bmad-testarch-test-review` (quality pass on
the expanded suite).

---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-07-08'
inputDocuments:
  - '_bmad-output/implementation-artifacts/9-5-phase-a-acceptance-gate-report.md'
  - '_bmad-output/test-artifacts/test-design-epic-9.md'
  - 'docs/migration/phase-a-acceptance-gate.md'
  - 'docs/migration/pilot-fallback-cutover.md'
  - '.github/workflows/ci.yml'
  - 'package.json'
  - 'src/features/files/deferred-categories.ts'
  - 'src/components/app-shell/nav-items.ts'
  - 'tests/integration/rls/tenant-table-inventory.ts'
  - 'src/features/calculations/readiness.ts'
  - 'tests/unit/docs/acceptance-gate-report-validators.test.ts'
---

# Test Automation Expansion — Story 9.5 (Phase A Acceptance Gate Report)

## Preflight & Context (step-01)

- **Stack:** `fullstack` (Next.js frontend + Supabase backend). Framework present
  (`playwright.config.ts`, `vitest`, `node --test` unit runner). No `framework` re-run needed.
- **Mode:** BMad-Integrated — story + `test-design-epic-9.md` present.
- **Execution mode:** `sequential`. Story 9.5 is docs + a single `tests/unit/**` docs-invariant
  validator (no product `src/**`, no schema, no DB, no browser). The step-03 API/E2E/backend
  subagent split is designed for product-code generation and is N/A here — the deliverable is a
  single `node --test` file, exactly per the story's own Testing Standards and the epic-9 retro
  constraint ("docs-validator = single node --test scaffold, not E2E"). Sequential in-file
  generation preserves the output contract.
- **"Code" under test:** the docs-invariant validator
  `tests/unit/docs/acceptance-gate-report-validators.test.ts` and its pure models —
  `evaluateGateHonesty`, `scanSurfaceForDeferred`, the `parseReportedGates` /
  `registerBlockingIds` parsers, and the whole-directory PII scan.

## Identify Targets & Coverage Plan (step-02)

Baseline: 18 passing validators covering AC1 (gate-honesty), AC2 (scope-scan), AC3 (readiness
reconciliation), EVID/docs-structure, representativeness, doc-hygiene, and a clean-docs PII scan.
Each of the two epic-blocker models had exactly ONE seeded negative. Gap analysis surfaced
untested edge cases / negative paths — all unit-level, all P0/P1 (the models are the epic-blocker
teeth):

| Target | Level | Priority | Gap closed |
| --- | --- | --- | --- |
| PII scan FIRES on seeded PII | unit | P0 | R-904 vacuous-green: the scan only proved docs are clean today; never proved the regexes actually catch a personnummer/orgnr/email/SE-phone/secret. Extracted `scanTextForPii` and drove it over seeded synthetic PII (each family fires) + a masked-placeholder/test-domain string (no false-positive). |
| `scanSurfaceForDeferred` whole-word matching | unit | P0 | R-903 substring-token trap: the word-boundary claim was prose-only. Now proven — benign tokens brushing short categories (`chars`/`threshold`/`shredder`/`assessment`/`doubt`, real tables) do NOT false-positive. |
| Every deny-list category trips (not just fortnox/supplier) | unit | P0 | Parametric over the LIVE deny-list — a newly added category is auto-covered, never a drifting subset. |
| Case-insensitive scope scan | unit | P1 | `/Fortnox`, `HR_Report`, `SUPPLIER_APIS` all trip. |
| `evaluateGateHonesty` full status vocabulary + `invalidStatus` | unit | P1 | Clean mixed pass/fail/skipped-with-reason report → zero findings; a bare `skipped` (not `-with-reason`) → `invalidStatus` even when it carries a reason; the reason is load-bearing (same gate with/without reason). |
| `parseReportedGates` fidelity on the real report | unit | P1 | The parser actually extracts the mandatory core gate rows from real §2 with valid statuses (else the honesty model runs on air). |
| `registerBlockingIds` fidelity | unit | P1 | Parses the digit-led blocking owning IDs from register §4, excludes section-reference tokens, returns only ID-shaped tokens. |

Justification: **selective/critical-paths** — no browser/DB level added (the surface has none);
coverage deepens the two epic-blocker pure models where the scaffold was single-example.

## Files Created / Updated (step-03 + aggregate)

- **Updated:** `tests/unit/docs/acceptance-gate-report-validators.test.ts` — extracted the PII scan
  into a pure `scanTextForPii(text) => violations[]` helper (existing whole-directory test now
  consumes it), and appended a `COVERAGE EXPANSION` section of 10 new unit tests (see plan). No
  new file needed — the docs-validator shape is a single `node --test` file (project Testing Rule:
  under the `tests/unit/**` glob, never `tests/golden/**`; no `describe.skip`).
- No source (`src/**`), schema, migration, dependency, `.env`, nav item, or golden fixture touched.

## Validation & Results (step-04)

- `pnpm test:unit` (acceptance-gate file): **28 pass / 0 fail** (18 baseline + 10 new).
- `pnpm test:unit` (whole suite): **1370 pass / 86 suites / 0 fail** (was 1360 → +10; no regression).
- `pnpm typecheck`: exit 0. `pnpm lint`: 0 errors (1 pre-existing unrelated warning in
  `tests/unit/lib/money/vat.test.ts`, already noted in the story Debug Log).
- Checklist: framework ready; coverage mapped to AC1/AC2/AC3; tests are pure-logic, deterministic,
  no self-disabling skips; no CLI/browser sessions opened (none needed); artifacts under
  `_bmad-output/test-artifacts/`.

## Key Assumptions & Risks

- **`registerBlockingIds` scope-of-parse finding (worth the epic retro).** The parser's ID regex
  only recognises digit-led / letter-prefixed-digit tokens (`A20`/`8.1`/`7.1`), so the dotted
  blocking IDs `A.1`/`A.2`/`B.1-B.4`/`C.1-C.3` in register §4 are NOT returned by
  `registerBlockingIds`. The AC3 no-drift reconciliation (`readiness.includes(id)`) therefore only
  actually cross-checks the digit-led subset against the register; the dotted families are present
  in the report §6 by authoring but are not machine-reconciled as blocking. This is the pre-existing
  9-4 "register-traceability substring-vs-row-status" weakness (ledgered as awareness for this
  story), NOT a defect introduced here — left unchanged deliberately (out of this coverage pass's
  scope). Flagged so the epic close can decide whether to tighten the parser.

## Next Recommended Workflow

`test-review` (validate the expanded validator's quality) or `trace` (Epic-9 boundary traceability
matrix), both already scheduled for the epic close.

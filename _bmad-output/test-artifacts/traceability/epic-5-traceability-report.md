---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-07-03'
workflowType: testarch-trace
gateType: epic
epicNum: 5
decisionMode: deterministic
coverageBasis: acceptance_criteria
oracleConfidence: high
oracleResolutionMode: formal_requirements
externalPointerStatus: not_used
tempCoverageMatrixPath: 'scratchpad/tea-trace-coverage-matrix-epic5.json'
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-5.md (16 risks R-501..R-516; P0-P3 test IDs; 8 non-negotiable epic blockers)
  - _bmad-output/planning-artifacts/epics.md (Epic 5, lines 1026-1211)
  - _bmad-output/implementation-artifacts/5-1..5-5 story files (all Status: review)
  - _bmad-output/test-artifacts/automation-summary{,-5-1,-5-3,-5-4,-5-5}.md
  - supabase/migrations/20260702120000_calculation_data_model.sql (3 calc tables + RLS + reorder RPCs)
  - supabase/migrations/20260703120000_calculation_row_pricing_source.sql (frozen source_* snapshot columns)
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES: all 3 calc tables enrolled with spoof/filter/mutation metadata)
  - tests/unit/features/calculations/**, tests/unit/server/commands/calc*, tests/integration/commands/calculation*, tests/e2e/calculations/**
  - src/lib/money/** (Epic 4 engine — every total routes through it); src/features/calculations/{totals,readiness,vat-posture,ordering,form-parsing}.ts
---

# Traceability Report — Epic 5: Calculation Workspace And Quote Readiness

**Date:** 2026-07-03
**Author:** Rasmus (via BMad TEA — Master Test Architect)
**Gate Type:** Epic-level (Phase 4, epic boundary)
**Decision Mode:** Deterministic (rule-based: P0 100% / P1 ≥90% PASS · 80–89% CONCERNS / overall ≥80%)
**Coverage Oracle:** formal requirements (Epic 5 acceptance criteria + the 16-risk / 8-blocker Epic 5
test design) — **high confidence** (formal, non-synthetic; active test cases present)

---

## Gate Decision: PASS

**Rationale:** P0 coverage is 100% (15/15 epic P0 requirement groups) and P1 coverage is 100% (8/8), so
overall coverage is 100% (26/26 mapped requirements FULL). All eleven high-priority risks (score ≥6:
R-501, R-502, R-503, R-504, R-505, R-506, R-507, R-508, R-509, R-511, R-516) are mitigated and proven by
real, in-source, active tests, and **every one of the eight Non-Negotiable epic blockers** in the Epic 5
test design is met and verified against the actual migration, RLS inventory, RPC definitions, and test
source (not merely the story records):

1. Every calc table has direct `tenant_id` + enable+**force** RLS + own-tenant policies + `anon → none`
   + **`TENANT_TABLES` enrollment** — verified: `calculations`, `calculation_sections`, `calculation_rows`
   all carry `enable/force row level security`, own-tenant `is_tenant_admin` select/insert/update
   policies, GRANTs only to `authenticated`/`service_role` (no anon grant), and are enrolled in
   `tenant-table-inventory.ts` with full spoof/filter/mutation metadata (the H4 gate FAILS CI on an
   unenrolled tenant table — this is R-501's automated backstop, not reviewer diligence).
2. No cross-tenant customer/facility/contact/work-role/article link accepted — verified: composite
   same-tenant FKs `(child, tenant_id) → parent(id, tenant_id)` at the DB for every parent + source
   reference, plus command-layer re-validation (`calculation-parent-ownership.int.test.ts`,
   `calculation-row-source.int.test.ts` both-layers spoof → `TENANT_ACCESS_DENIED`).
3. Every customer-visible total/VAT/deduction routes through `@/lib/money` — no inline money math, no
   forked öre/rounding/VAT rule — verified: `totals.test.ts` 5.2-UNIT-01 pins editor total == engine
   total incl. `{ok:false}` failure propagation; the calc golden coverage pack drives the real engine.
4. Multi-row reorder/save is **atomic** — verified: two narrow `SECURITY INVOKER` Postgres RPCs
   (`reorder_calculation_rows`, `reorder_calculation_sections`, fixed empty search_path, single
   commit-or-rollback transaction, PUBLIC execute revoked) per ADR-A009; `5.1-INT-03` proves a
   mid-transaction failure rolls back fully — NO client-side multi-step consistency boundary.
5. Pricing-source row snapshots are **frozen** — verified: additive `source_*` columns are DELIBERATELY
   no-FK copy-by-value captures (`source_id` is a captured value, not a referential FK);
   `5.3-INT-02` proves mutating/archiving the source AFTER capture does NOT change the prior row.
6. Hidden-row / selected-tillval totals **match the 2026-06-18 inclusion pin** (unselected never summed)
   — verified: `5.4-GOLDEN-01` + `calc-golden-pack-coverage.test.ts` GAP-A drive the frozen
   `options-tillval.json` öre; an unselected option is proven NEVER summed and a hidden row IS counted.
7. Readiness **blockers gate** the create-quote affordance; tax warnings framed as estimate +
   `requiresSignOff`, never legally-final — verified: pure classifier `readiness.ts` (5.4-UNIT-01/02/03/04,
   45 unit cases), `5.4-E2E-01` gates the affordance, `5.4-UNIT-02` asserts NO path renders a deduction
   approved/legally-final.
8. **No real PII/secret** in any calc golden fixture; no personnummer into the engine/rows — verified:
   `calc-golden-pack.test.ts` 5.5-UNIT-01 runs the extended PII/secret scan (personnummer `\d{6}-\d{4}`,
   orgnr, non-`example.test` email, secret/password/api_key, phone, address) over `calc-rows.json`; the
   engine takes an eligibility POSTURE, never PII.

The full Epic 5 suite runs green — **850 `node --test` unit/golden tests pass, 0 fail, 0 skip, 0 todo**
(per the 5.5 automation verification, the latest run), with INT/RLS (Vitest, local Supabase,
`SUPABASE_TEST_REQUIRED=1`) and Playwright E2E gated in CI. There are **no `.skip`/`.only`/`fixme` in any
active Epic 5 test** (the RED-phase `notYetImplemented()` placeholder in `calc-validation.test.ts` now
binds the REAL validators; matches in the skip scan are all in comments explaining the historical
pattern). No P0/P1 gap and no open high-priority (≥6) risk is unmitigated. The remaining items — the two
standing NFR CONCERNS (no `pnpm audit` CI gate, no coverage reporter), the required-file readiness check
gated on unlanded Story 8.1, the `persons` flat-cap placeholder, and the owner/accounting/legal tax
sign-offs — are **surfaced-for-decision items, not coverage gaps**: the test design explicitly classifies
each as a documented deferral / schedule-or-accept, and the code ships tax constants as UNAPPROVED
conservative assumptions + `requiresSignOff` warnings, which is exactly what the design requires.

---

## Coverage Summary

- **Total requirements mapped:** 26 (5 stories × epic-relevant AC/risk groups + heuristic checks)
- **Fully covered (FULL):** 26 (100%)
- **Partial / Unit-only / None:** 0
- **P0 coverage:** 100% (15/15) — every SEC (isolation) / DATA (math-via-engine, öre, atomic reorder,
  source freeze) / BUS (readiness classification, inclusion pin, fixture privacy) critical criterion
- **P1 coverage:** 100% (8/8)
- **P2 coverage:** 100% (2/2) · **P3 coverage:** 100% (1/1)
- **High-priority risks (score ≥6):** 11/11 mitigated + test-proven (R-501, R-502, R-503, R-504, R-505,
  R-506, R-507, R-508, R-509, R-511, R-516)

**Test inventory discovered** (all active — no skip/only/fixme in executable Epic 5 code):

- **UNIT** (`node --test`) under `tests/unit/features/calculations/`: `totals.test.ts`,
  `form-parsing.test.ts`, `money-input.test.ts`, `ordering.test.ts`, `action-state.test.ts`,
  `readiness.test.ts` (45 cases), `readiness-inclusion.golden.test.ts`, `source-options.test.ts`,
  `source-select.test.ts`, `calc-golden-pack.test.ts` (14), `calc-golden-pack-coverage.test.ts` (5 GAP tests)
- **UNIT** command validators under `tests/unit/server/commands/`: `calc-validation.test.ts`,
  `calc-validation-coverage.test.ts` (29), `calc-source-validation.test.ts`
- **INT** (Vitest/DB) under `tests/integration/commands/`: `calculation-commands.int.test.ts`,
  `calculation-parent-ownership.int.test.ts`, `calculation-row-source.int.test.ts` (8, incl. clear/replace)
- **RLS / migration** under `tests/integration/rls/`: `calc-tables-migration-reset.int.test.ts`, the
  data-driven cross-tenant + anon-path suites reading the shared `tenant-table-inventory.ts` (3 calc tables
  enrolled), the H4 inventory gate
- **E2E** (Playwright) under `tests/e2e/calculations/`: `calculations.e2e.spec.ts`,
  `calculation-readiness.e2e.spec.ts`, `calculation-source-selection.e2e.spec.ts`
- **GOLDEN fixture:** `tests/fixtures/golden/money/calc-rows.json` (anonymized, extends the Epic 4
  `options-tillval.json` inclusion pin — does not fork the rule)

**Local run confirmation (from the story/automation records, verified against in-source test presence):**
`pnpm run test:unit` → **850 pass / 0 fail / 0 skip / 0 todo** (658 after 5.1, 747 after 5.2, 782 after
5.3, 831 after 5.4, 850 after 5.5); `pnpm typecheck`/`lint`/`build`/`verify:service-role-containment`/
`verify:bundle-containment` all green; INT source suite 8/8 confirmed RAN (not skipped) under
`SUPABASE_TEST_REQUIRED=1`.

---

## Traceability Matrix

Coverage legend: **FULL** = criterion covered at the appropriate level(s) with mechanism-asserting tests;
test IDs cite the covering file. All IDs below were verified present in-source (file existence +
enrollment + no active skip) at trace time.

### Story 5.1 — Tenant-Owned Calculation Schema And Server Commands

| AC / Requirement | Risk | Priority | Coverage | Covering tests (verified) |
| --- | --- | --- | --- | --- |
| AC1 Migration reset creates 3 calc tables with tenant ownership, composite same-tenant parent FKs, lifecycle/status, ordering, integer-öre money; no deferred job/project/field table | R-501, R-506 | P0 | FULL | `calc-tables-migration-reset.int.test.ts` 5.1-INT-01 (per-table policy enumeration; absence of deferred tables); migration `20260702120000` enable+force RLS + composite FKs + `_ore bigint CHECK >= 0` |
| AC2 Command validation: closed row-type union, qty>0 + unit, öre money, VAT assumption, lifecycle state machine; raw value never echoed | R-504 | P0 | FULL | `calc-validation.test.ts` 5.1-UNIT-01 (real validators bound), `calc-validation-coverage.test.ts` (29 cases: all 6 previously-untested validators + reorder input contract); `calculation-commands.int.test.ts` 5.1-INT-04 (6 VALIDATION_FAILED paths) |
| AC3 Cross-tenant read/write rejected on all 3 tables; anon path none; foreign customer/facility/contact parent rejected | R-501, R-502 | P0 | FULL | `tenant-table-inventory.ts` 5.1-RLS-01/02 (3 calc tables enrolled; cross-tenant + anon + H4 gate data-driven); `calculation-parent-ownership.int.test.ts` 5.1-INT-02 (foreign parent → `TENANT_ACCESS_DENIED`; client tenant_id ignored) |
| Atomic multi-row reorder/save (tech note, ADR-A009) — mid-transaction failure rolls back fully; server-owned ordering | R-503 | P0 | FULL | `calculation-commands.int.test.ts` 5.1-INT-03 (reorder rows/sections commit + rollback); migration RPCs `reorder_calculation_rows`/`reorder_calculation_sections` (SECURITY INVOKER, single txn, PUBLIC execute revoked) |
| Öre discipline on new money columns via canonical `isOreAmount`/`ORE_AMOUNT_MAX`; float/negative/overflow rejected | R-506 | P0 | FULL | `calc-validation.test.ts` 5.1-UNIT-02; DB `CHECK (..._ore >= 0)` belt-and-braces (migration) |
| Archive (soft-delete) via UPDATE; no hard-delete grant/policy | R-501 | P1 | FULL | `calculation-commands.int.test.ts` 5.1-INT-05 (archive soft-delete); migration: no delete policy, DELETE granted only to service_role |

### Story 5.2 — Calculation Editor UX For Sections And Rows

| AC / Requirement | Risk | Priority | Coverage | Covering tests (verified) |
| --- | --- | --- | --- | --- |
| Editor totals == `@/lib/money` engine totals; calc/display logic extracted into pure functions; no inline money math | R-505 | P0 | FULL | `totals.test.ts` 5.2-UNIT-01 (engine-failure propagation → typed `{ok:false}`, never NaN; hidden row lands in section sum; `computeLineVat` byte-parity with `lineVatOre`); logic extracted from the `"use client"` island |
| Keyboard editing of all 5 row types; validation errors PRESERVE unsaved input; destructive delete confirm | R-515 | P1 | FULL | `calculations.e2e.spec.ts` 5.2-E2E-01/02; `form-parsing.test.ts` (AC2 `values` echo-back preserve-on-failure) |
| Section/row ordering (create/rename/reorder/duplicate/delete) extracted + unit-pinned; stable order | R-515 | P1 | FULL | `ordering.test.ts` 5.2-UNIT-02 (moveDown out-of-range no-op; append-to-empty; reorderTo identity) |
| Responsive layout stacks safely; totals/readiness refresh on edit | R-505, R-515 | P1 | FULL | `calculations.e2e.spec.ts` 5.2-E2E-03/04 (viewport matrix; totals reflect engine output live) |
| Row visibility/option flag persistence; VAT display (excl/incl/both) presentation-only | R-508, R-505 | P2 | FULL | `form-parsing.test.ts` 5.2-UNIT-03 (flags round-trip through command); `readiness.test.ts` / `selectVatDisplay` 5.2-UNIT-04 |
| Absence of deferred-workflow labels (field-worker/project/ÄTA/supplier/AI) | — | P2 | FULL | `calculations.e2e.spec.ts` 5.2-E2E-05 (guardrail; nav stays seven) |

### Story 5.3 — Pricing Source Selection And Row Snapshots

| AC / Requirement | Risk | Priority | Coverage | Covering tests (verified) |
| --- | --- | --- | --- | --- |
| AC1/AC2 Labor row stores frozen work-role snapshot; article row stores frozen article snapshot (id/name/öre/updated_at "version"/tenant); no supplier field | R-507 | P0 | FULL | `calculation-row-source.int.test.ts` 5.3-INT-01 (store frozen snapshot); migration `20260703120000` additive no-FK `source_*` columns (`source_id` = captured value, not FK) + öre CHECK |
| AC3 Mutating/archiving the source AFTER capture does NOT change the prior row snapshot; row stays explainable | R-507 | P0 | FULL | `calculation-row-source.int.test.ts` 5.3-INT-02 (behavioral freeze proof), 5.3-INT-04 (explainable from row fields after archive) |
| Cross-tenant work-role/article source id rejected at both layers (`TENANT_ACCESS_DENIED`) | R-502 | P0 | FULL | `calculation-row-source.int.test.ts` 5.3-INT-03 (source-spoof negative, both layers) |
| Source clear/replace round-trip (all `source_*` null together on clear; wholesale move on replace) | R-507 | P1 | FULL | `calculation-row-source.int.test.ts` 5.3-INT-05/06; `source-select.test.ts` (encode/decode + malformed branches, pure helpers extracted from RowEditor) |

### Story 5.4 — Calculation Readiness Review And Snapshot Preview

| AC / Requirement | Risk | Priority | Coverage | Covering tests (verified) |
| --- | --- | --- | --- | --- |
| AC1 Pure classifier separates BLOCKERS from WARNINGS per an explicit rule table; tax warnings carry `requiresSignOff` + non-final framing; NO deduction rendered approved/legally-final | R-509 | P0 | FULL | `readiness.test.ts` 5.4-UNIT-01 (one case per condition), 5.4-UNIT-02 (behavioral non-final framing; no `approved:true` path), 45 unit cases total |
| AC1/AC2 Blockers gate the "create quote version" affordance; warnings do not silently disappear | R-509 | P0 | FULL | `calculation-readiness.e2e.spec.ts` 5.4-E2E-01 (both gate states); `calc-golden-pack-coverage.test.ts` GAP-B/GAP-C (`TOTAL_UNCOMPUTABLE`/`MISSING_CUSTOMER` blockers, `canCreateQuote===false`, fail-open warning never gates) |
| AC/5.5 AC1 Hidden rows + selected tillval COUNT toward basis/net/VAT/deduction; unselected option NEVER summed — matches the 2026-06-18 pin | R-508 | P0 | FULL | `readiness-inclusion.golden.test.ts` 5.4-GOLDEN-01 (drives frozen `options-tillval.json`); `calc-golden-pack-coverage.test.ts` GAP-A (section-total exclusion of unselected option) |
| AC1 Warnings cover the full list (low margin, missing customer/facility/contact, empty section, zero-price row, missing work role on labor row, unresolved VAT/tax, ROT/grön sign-off, hidden rows, missing required files) | R-509 | P1 | FULL | `readiness.test.ts` 5.4-UNIT-03 (breadth; message/severity invariant; no öre/bp jargon leak; per-section multiplicity; persons flat-cap discipline R-512) |
| AC2 Pre-quote preview content (customer/facility/contact, sections, visible/hidden, options/tillval, totals, VAT, tax assumptions, terms, selected attachments, warnings at snapshot time) | R-509 | P1 | FULL | `calculation-readiness.e2e.spec.ts` 5.4-E2E-02 (preview content) |
| AC3 With a sent quote existing, UI EXPLAINS a new version is required (message present; enforcement is Epic 6) | R-514 | P1 | FULL | `calculation-readiness.e2e.spec.ts` 5.4-E2E-03 (forward-seam message present) |
| Empty-section / zero-price-row edge classification (warning vs blocker) | R-509 | P2 | FULL | `readiness.test.ts` 5.4-UNIT-04 (boundary edges) |

### Story 5.5 — Calculation Golden Tests For Options, Hidden Rows, And Tax Warnings

| AC / Requirement | Risk | Priority | Coverage | Covering tests (verified) |
| --- | --- | --- | --- | --- |
| AC1 Golden pack covers all 5 row types, fractional qty, margins, options/tillval, hidden rows, detailed/summary/text-only modes, VAT display, ROT/grön warnings, attachment-readiness; drives the REAL engine | R-508, R-505 | P0 | FULL | `calc-golden-pack.test.ts` 5.5-GOLDEN-01 (coverage manifest + labelling + behavioral live-oracle + schema-shape, 14 tests); `calc-golden-pack-coverage.test.ts` (GAP-A..E, 5 negative/edge live-oracle tests) |
| AC3 Fixture privacy: no real names/emails/phones/addresses/personnummer/orgnr/secrets/raw files; no PII into `@/lib/money`/a row snapshot | R-516 | P0 | FULL | `calc-golden-pack.test.ts` 5.5-UNIT-01 (extended PII/secret scan over `calc-rows.json` DATA payload; engine takes a POSTURE, never a personnummer; non-vacuous — every öre kept < 10 digits to avoid the orgnr false-positive trap) |
| AC2 Documented old/new delta labelling (expected-simplification / bug-fix / unresolved-assumption); a golden failure points to the affected assumption | R-508 | P1 | FULL | `calc-golden-pack.test.ts` 5.5-UNIT-02 (labelling + schema-shape guards enforce three-way origin discipline; ready to absorb a real Lovable delta when Epic 9 captures one) |
| 5.5-UNIT-03 Property/invariant: `gross === net + VAT` per line; section-net === engine sum-of-rounded (exploratory) | R-505 | P3 | FULL | `calc-golden-pack-coverage.test.ts` GAP-E (pure engine-vs-engine invariant, no pinned magic number) |

### Coverage Heuristics (Step 2/4 blind-spot checks)

| Heuristic | Result |
| --- | --- |
| API endpoint / command coverage | COVERED — every new calc command (create/edit calc/section/row, reorder, archive) has an INT test; the two reorder RPCs have rollback INT coverage; no command-without-test gap |
| Auth/authz negative paths | COVERED — cross-tenant read/write negatives on all 3 tables (via enrolled `TENANT_TABLES`), anon-path isolation, foreign parent + foreign source spoofs → `TENANT_ACCESS_DENIED`; the H4 inventory gate is the compile-exhaustive completeness backstop |
| Error-path (validation/rejection) coverage | COVERED — typed `VALIDATION_FAILED` for invalid row type/qty/unit/öre/VAT/lifecycle (raw value never echoed); engine `{ok:false}` propagation in totals; `TOTAL_UNCOMPUTABLE` blocker; reorder RPC rejects the whole payload on a bad id (23514) |
| UI journey E2E coverage | COVERED — editor keyboard editing, destructive-confirm, ordering, responsive stacking, totals refresh, source selection/provenance, blockers-gate-create-quote, preview content, new-version message — all in the 3 Playwright specs |
| UI state coverage (loading/empty/validation/error/permission) | COVERED — validation-preserves-input, empty-section/zero-price edges, gated-affordance state, warnings-do-not-disappear; happy-path-only NOT detected |
| Happy-path-only criteria | NONE detected — every correctness criterion carries boundary/negative cases (unselected-not-summed negative oracle, engine-reject blocker, cross-tenant/anon negatives, source-freeze-after-mutation, reorder rollback) |
| Determinism / clock | COVERED — snapshot builders take injected `capturedAt` (`source_captured_at`, no wall-clock read); count-asserting tests seed `crypto.randomUUID()`; goldens live under `tests/unit/**` (not the `tests/golden/**` runner-glob vacuous-green trap) |

---

## Gaps & Uncovered Requirements

**None.** No P0, P1, P2, or P3 acceptance criterion is uncovered, partial, or unit-only where a higher
level is warranted. Every Epic 5 test-design test ID (`5.1-INT-01..05`, `5.1-RLS-01/02`,
`5.1-UNIT-01..03`, `5.2-UNIT-01..04`, `5.2-E2E-01..05`, `5.3-INT-01..06`, `5.4-UNIT-01..04`,
`5.4-E2E-01..03`, `5.4-GOLDEN-01`, `5.5-GOLDEN-01`, `5.5-UNIT-01..03`) has a corresponding in-source,
active test; every high-priority risk (R-501..R-509, R-511, R-516) has an executable mitigation test; and
every one of the eight Non-Negotiable epic blockers is met and verified against the real
migration/RPC/inventory/test source.

### Documented, sanctioned scope decisions (NOT coverage gaps)

These were triaged in-story / in-design as accepted deferrals and do not change the gate:

- **Required-file readiness check gated on Story 8.1 (R-513):** Story 8.1 (file-metadata foundation) has
  NOT landed, so 5.4 ships the "missing required files" check as a `REQUIRED_FILES_DEFERRED` documented
  deferral surfaced in the readiness output (never a silent omission) — a fail-open WARNING that never
  gates. To be wired when 8.1 lands (no rule-shape change). This is the exact contingency the test design
  planned for.
- **`persons` per-person ROT cap = flat `capOre` (R-512):** the deduction uses a single flat cap;
  `persons` is threaded into fixtures but does NOT scale the cap (owner-gated under Epic 4 Sign-Off Q3).
  `readiness.test.ts` explicitly asserts NO per-person-cap implication is emitted — the placeholder is
  pinned, not silently assumed implemented.
- **No `documented-delta`/`old-lovable` calc case yet:** no anonymized Lovable calc oracle is available
  (AGENTS.md — behavioral oracle only, no data copy). The labelling + schema-shape guards still enforce
  the three-way origin discipline, so the pack is ready to absorb a real delta when Epic 9 captures one.
  Not fabricated. The 5.5-UNIT-02 requirement is covered at the guard/shape level, which is the correct
  level for a not-yet-available oracle.
- **`is_selected boolean | null` read-type inconsistency (5.2 Low deferral):** a future editor-polish
  item; `rowCountsTowardTotal` treats `null`/`false` identically, so it does not affect classification or
  totals — confirmed by the new 5.4 tests.

### Standing NFR CONCERNS (surface-for-decision, NOT a coverage gap) — R-510

Two NFR concerns have been carried since Epic 2 and reach the first UI+DB epic since Epic 3. The Epic 5
test design explicitly instructs surfacing them to the owner in this epic's gate for **schedule-or-accept
— do not keep silently carrying them**:

1. **No `pnpm audit` CI dependency-scan gate** — a supply-chain scan is not wired into CI.
2. **No coverage reporter** — the suite runs green but emits no coverage percentage artifact.

These are process/tooling gaps, not Epic 5 requirement-coverage gaps; they do not affect the deterministic
gate math (P0 100% / P1 100% / overall 100%). They are routed to the owner below.

---

## High-Priority Risk → Mitigation Verification (score ≥6)

| Risk | Mitigation proven by |
| --- | --- |
| R-501 new calc table isolation gap | 3 tables enrolled in `TENANT_TABLES` (spoof/filter/mutation metadata) → `5.1-RLS-01/02` cross-tenant + anon + H4 gate; migration enable+force RLS + own-tenant policies + `anon → none` + `5.1-INT-01` reset |
| R-502 cross-tenant parent/source link | Composite same-tenant FKs at DB; `5.1-INT-02` (foreign parent) + `5.3-INT-03` (foreign source) → `TENANT_ACCESS_DENIED` at both layers |
| R-503 non-atomic multi-row reorder/save | Narrow `SECURITY INVOKER` RPCs (`reorder_calculation_rows`/`_sections`, single txn, PUBLIC execute revoked); `5.1-INT-03` mid-transaction failure rolls back fully; ordering server-owned |
| R-504 row validation gaps | `5.1-UNIT-01` + `calc-validation-coverage.test.ts` (all 6 validators + reorder input); `5.1-INT-04` command-layer `VALIDATION_FAILED`; raw value never echoed |
| R-505 totals re-derived inline | `5.2-UNIT-01` editor total == engine total + failure propagation; `calc-golden-pack-coverage.test.ts` drives the real engine; TB% is a pure öre ratio, any öre op delegates to `@/lib/money`/`totals.ts` |
| R-506 öre discipline broken | `5.1-UNIT-02` canonical `isOreAmount`/`ORE_AMOUNT_MAX` (no fork); DB `_ore bigint CHECK >= 0` on all money + source columns |
| R-507 pricing-source snapshot recomputes | `5.3-INT-02` mutate/archive source after capture ⇒ prior row unchanged; `5.3-INT-04` explainable from row; migration `source_*` are no-FK copy-by-value captures |
| R-508 hidden-row/tillval inclusion diverges | `5.4-GOLDEN-01` + `calc-golden-pack-coverage.test.ts` GAP-A against the frozen `options-tillval.json` pin (unselected NEVER summed; hidden IS counted); no re-pin |
| R-509 readiness misclassification / tax-final | `5.4-UNIT-01/02/03/04` (rule-table classifier, non-final framing, breadth, edges); `5.4-E2E-01` blockers gate the affordance; GAP-B/C blocker + fail-open discipline |
| R-511 rounding/discount/negative invented | Line-level rounding only via engine sum-of-rounded; no document-level/discount/negative path added (scope-guard sweep in 5.4 Task 5.2; engine-driven goldens) — a genuine need is escalated, not coded |
| R-516 calc fixture / row PII leak | `5.5-UNIT-01` extended PII/secret scan over `calc-rows.json` (personnummer/orgnr/email/secret/phone/address); engine takes a POSTURE, never PII; non-vacuous negative-check |

**Medium/Low risks:** R-514 (new-version message) covered by `5.4-E2E-03`; R-515 (editor UX defects) by
the 5.2 E2E matrix + extracted pure ordering/validation units; R-512 (persons flat cap) pinned by the
readiness "no per-person-cap implication" assertion; R-513 (required-file 8.1 sequencing) is a documented
deferral surfaced in the readiness output; R-510 (calc-at-scale perf + the two standing NFR gaps) is a
documented residual routed to the owner below — not a gate blocker.

---

## Non-Negotiable Epic Blockers (test-design gate) — all MET

| Blocker | Status | Proven by (verified in-source) |
| --- | --- | --- |
| Every calc table: direct `tenant_id` + enable+force RLS + own-tenant policies + `anon → none` + `TENANT_TABLES` enrollment (H4 gate) | MET | migration `20260702120000` (3× enable/force RLS + policies + no anon grant); `tenant-table-inventory.ts` (3 tables enrolled with metadata); `5.1-RLS-01/02` |
| No cross-tenant customer/facility/contact/work-role/article link accepted | MET | composite same-tenant FKs; `5.1-INT-02` + `5.3-INT-03` |
| Every customer-visible total/VAT/deduction routes through `@/lib/money` — no inline math, no forked rule | MET | `5.2-UNIT-01`; calc golden coverage pack; scope-guard sweep |
| Multi-row reorder/save is atomic (narrow RPC / server txn) — no client-side consistency boundary | MET | `reorder_calculation_rows`/`_sections` RPCs; `5.1-INT-03` rollback |
| Pricing-source row snapshots frozen (no silent recompute on source archive/rate change) | MET | `5.3-INT-02`; no-FK `source_*` copy-by-value columns |
| Hidden-row / selected-tillval totals match the 2026-06-18 inclusion pin (unselected never summed) | MET | `5.4-GOLDEN-01`; `calc-golden-pack-coverage.test.ts` GAP-A |
| Readiness blockers gate the create-quote affordance; tax warnings framed as estimate + `requiresSignOff`, never legally-final | MET | `5.4-UNIT-01/02`, `5.4-E2E-01`, GAP-B/C |
| No real PII/secret in any calc golden fixture; no personnummer into the engine/rows | MET | `5.5-UNIT-01` extended PII scan; engine takes a POSTURE |

---

## Gate Criteria Evaluation (deterministic)

| Criterion | Required | Actual | Status |
| --- | --- | --- | --- |
| P0 coverage | 100% | 100% (15/15) | MET |
| P1 coverage | ≥90% (PASS), 80–89% (CONCERNS) | 100% (8/8) | MET |
| Overall coverage | ≥80% | 100% (26/26) | MET |
| High-risk (≥6) mitigations | 100% complete/waived | 11/11 complete | MET |
| 3 calc tables enrolled + isolation proven | yes | proven (`5.1-RLS-01/02`, H4 gate) | MET |
| No cross-tenant parent/source link accepted | yes | proven (`5.1-INT-02`, `5.3-INT-03`) | MET |
| Math routes through `@/lib/money` (no inline math) | yes | proven (`5.2-UNIT-01`) | MET |
| Atomic multi-row reorder (RPC, rollback) | yes | proven (`5.1-INT-03` + RPCs) | MET |
| Pricing-source snapshot frozen | yes | proven (`5.3-INT-02`) | MET |
| Inclusion pin matched (unselected never summed) | yes | proven (`5.4-GOLDEN-01`, GAP-A) | MET |
| Readiness blockers gate; tax not legally-final | yes | proven (`5.4-UNIT-01/02`, `5.4-E2E-01`) | MET |
| No real PII/secret in calc fixtures | yes | proven (`5.5-UNIT-01`) | MET |
| Epic 5 suite green | 100% pass | 850/850 unit+golden pass (0 fail, 0 skip); INT/RLS/E2E CI-gated | MET |

→ **Decision Rule matched:** P0 = 100% AND overall ≥ 80% AND P1 ≥ 90% ⇒ **PASS**. Oracle is formal (not
synthetic), high confidence, active test cases present ⇒ no confidence-overlay downgrade. **Gate: PASS.**

---

## Next Actions

- **PASS — epic may proceed.** No remediation required for the gate. All five stories (5.1–5.5) are in
  `review` with tasks complete and the full calc suite green.
- **Sprint-status hygiene (non-gating, orchestrator note):** `sprint-status.yaml` lists
  `5-1-tenant-owned-calculation-schema-and-server-commands: in-progress`, but the 5.1 story file is
  `Status: review` with a green dev/automation record (658→850 units) and its schema/commands are
  consumed by 5.2–5.5. The `in-progress` entry is stale; align it to `review` (then `done` at epic
  close). Does not affect coverage.
- **Standing NFR CONCERNS (surface for schedule-or-accept — NOT a gate blocker) — R-510:** no `pnpm
  audit` dependency-scan CI gate; no coverage reporter. Owner-pending across Epics 2–4; this epic's gate
  is the natural place to schedule or formally accept them.
- **Required-file readiness check (R-513):** documented deferral gated on Story 8.1 (file-metadata
  foundation) landing; wire the `REQUIRED_FILES_DEFERRED` warning to real file metadata when 8.1 ships
  (no rule-shape change).
- **Owner/accounting/legal sign-off items (non-blocking — route to the working session; the engine ships
  these as UNAPPROVED assumptions + `requiresSignOff` warnings, nothing approved in code):** confirm the
  2026-06-18 inclusion pin as pilot policy (R-508); confirm the readiness blocker-vs-warning split incl.
  "low margin" = warning and "missing customer" = blocker (R-509); confirm `persons` stays a flat cap, no
  per-person multiplier (R-512, Epic 4 Q3); approve the "new version required after send" copy (R-514);
  approve the tax-warning non-final wording (R-509); plus the standing Epic 4 carry-overs (rounding mode,
  VAT display default, ROT/grön rates/caps/mix, eligibility disclaimer, personnummer scope, approval
  posture, accepted-price delta shape) — all remain UNAPPROVED placeholders.
- **Residual (documented):** calc-at-scale performance untested (R-510) — pure in-memory logic, no
  Phase-A SLA; deferred to a later calc epic per the test design.

---

**Generated by:** BMad TEA Agent — Test Architect Module
**Workflow:** `bmad-testarch-trace` (v5.0 step-file architecture)
**Phase 1 (coverage matrix) + Phase 2 (gate decision):** complete

---

## Gate Decision Summary

🚨 **GATE DECISION: PASS**

📊 Coverage Analysis:
- P0 Coverage: 100% (Required: 100%) → MET
- P1 Coverage: 100% (PASS target: 90%, minimum: 80%) → MET
- Overall Coverage: 100% (Minimum: 80%) → MET

✅ Decision Rationale: P0 coverage is 100% (15/15), P1 coverage is 100% (8/8), and overall coverage is
100% (26/26). All 11 high-priority risks (≥6) are mitigated + test-proven, and all 8 non-negotiable epic
blockers are met and verified against the real migration/RPC/RLS-inventory/test source. The Epic 5 suite
is green (850/850 unit+golden; INT/RLS/E2E CI-gated) with no active skip/only/fixme.

⚠️ Critical Gaps: 0

📝 Recommended Actions: (1) owner schedule-or-accept the two standing NFR CONCERNS (no `pnpm audit` gate,
no coverage reporter, R-510); (2) wire the required-file readiness check when Story 8.1 lands (R-513,
documented deferral); (3) align the stale `sprint-status.yaml` 5-1 entry (`in-progress` → `review`).

✅ GATE: PASS — Epic 5 coverage meets standards; the epic may proceed to Epic 6.

---
stepsCompleted:
  - step-01-load-context
  - step-02-define-thresholds
  - step-03-gather-evidence
  - step-04-evaluate-and-score
  - step-04e-aggregate-nfr
  - step-05-generate-report
lastStep: step-05-generate-report
lastSaved: '2026-07-01'
workflowType: testarch-nfr-assess
scope: epic-3
mode: advisory_non_blocking
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-3.md
  - _bmad-output/test-artifacts/traceability/epic-3-traceability-report.md
  - _bmad-output/implementation-artifacts/3-1-tenant-owned-crm-data-model-and-commands.md
  - _bmad-output/implementation-artifacts/3-2-crm-tenant-admin-ux-and-lifecycle-context.md
  - _bmad-output/implementation-artifacts/3-3-company-identity-quote-terms-and-vat-defaults.md
  - _bmad-output/implementation-artifacts/3-4-work-roles-and-optional-manual-articles.md
  - _bmad-output/implementation-artifacts/3-5-snapshot-source-contract-for-settings-and-pricing-inputs.md
  - .github/workflows/ci.yml
  - _bmad-output/test-artifacts/nfr-assessment-epic-2.md (prior)
  - _bmad-output/test-artifacts/perf-baseline-epic-2.md
---

# NFR Assessment — Epic 3 (CRM, Company Settings, And Pricing Foundation)

**Date:** 2026-07-01
**Epic:** Epic 3 — tenant-owned CRM data model + commands (3.1), CRM tenant-admin UX + lifecycle context (3.2), company identity / quote terms / VAT defaults with sign-off (3.3), work roles + optional manual articles in integer öre (3.4), pure snapshot-source contract for settings + pricing inputs (3.5)
**Overall Status:** PASS (advisory) ✅ with 2 forward-looking CONCERNS
**Mode:** ADVISORY / non-blocking. This audit sits one tier below the blocking `*trace` gate, which for Epic 3 returned **PASS** (P0 100%, P1 100%, overall 100% — 36/36 mapped requirements FULL). Sequential single-assessor run (no subagents launched), mirroring the Epic-2 NFR audit method.

---

> Note: This assessment summarizes existing evidence; it does not run tests, builds, load tests, or CI workflows. Evidence was read from the five Epic-3 story files, the Epic-3 test design, the Epic-3 traceability report (PASS), the CI workflow, and the prior Epic-2 NFR assessment + perf baseline. The reported green test totals (149 unit + 155 DB-backed integration on a clean `supabase db reset → test:int`, plus the Playwright e2e suite) are taken from the Story Dev Agent Records and the trace report, not re-executed here.

## Scope Statement (what changed since Epic 2)

Epic 2 landed the security/data foundation (auth, `tenants`/`tenant_memberships`/`audit_events`, the command envelope, the H4 RLS inventory gate). **Epic 3 is the first business-domain epic** — it lands the first tenant-owned *business* tables and the first real product UI:

- **6 new tenant-owned tables** (`customers`, `facilities`, `contacts`, `company_settings`, `quote_terms`, `work_roles`, `articles` — 7 by count, across stories 3.1/3.3/3.4), each with direct `tenant_id`, enable+FORCE RLS, own-tenant `is_tenant_admin` policies, explicit GRANTs (`authenticated → SELECT/INSERT/UPDATE`, `service_role → DML`, `anon → none`), composite same-tenant parent FKs, and H4 enrollment (the inventory now covers **9 tenant-owned tables**, gate green + bite-proven).
- **~20 new server commands** (CRM create/update/archive × customer/facility/contact; settings upsert + quote-terms sign-off; work-role/article lifecycle) — all through the existing `defineCommand`/`runCommand` envelope, no bespoke auth/audit/error mechanism.
- **First real product UI** — `/customers`, `/customers/[id]`, `/settings/company`, `/settings/quote-terms`, `/settings/pricing` — force-dynamic App Router screens on the RLS-scoped server client, writing ONLY through the envelope commands (no service-role, no direct `.insert()`/`.update()` from a page/action).
- **First money surface** — VAT stored as `vat_rate_bp` (basis points), work-role rates + article prices as integer öre (`bigint`), non-negative CHECKs, validated by the `isOreAmount` matrix. NO calculation / VAT / ROT engine (Epic 4 owns it) — defaults captured only.
- **First customer-facing legal-text surface** — quote-terms sign-off with a never-auto-approved contract (nullable `approved_at`/`approved_by`; approval is a single deliberate path; any edit invalidates a prior sign-off).
- **First PII field** — `personnummer`, access-controlled, ONLY on `customers`, identifier-by-type CHECK-constrained, never in audit metadata (SAFE_FIELDS drops it), never in the default list projection/DOM, masked on the detail screen.
- **First pure snapshot contract** — a `readonly`/`Object.freeze` builder over the four mutable sources (R-008 immutability), plus a server-side ownership resolver on the RLS client.

Two NFR domains that were N/A in Epic 2 become **assessable this epic**: **money-integrity** (integer öre / basis points, no float kronor) and **snapshot immutability** (frozen-by-value, no silent recompute). Two remain **deliberately deferred N/A for Phase A**: **runtime performance / load at scale** (R-013 — no SLA, single pilot tenant) and **availability / DR / MTTR** (no deployed production runtime with an SLO yet).

**Notable resolution since Epic 2:** the Epic-2 UI-surface / route-redirect CONCERN is now **RESOLVED** — the Playwright E2E runner is live in CI (the new `e2e` job) and the CRM/settings/pricing/auth specs execute (no `.skip` in executable code), asserting tenant-context display, anon route redirect, dialog focus/a11y, and envelope-only writes.

---

## Executive Summary

**Assessment:** 6 PASS, 2 CONCERNS, 0 FAIL across the in-scope categories. Runtime performance/load at scale (R-013) and availability/DR are **N/A — deferred for the internal pilot, no SLA/production runtime yet**.

**Blockers:** 0. Nothing in this advisory audit blocks the epic. Every non-negotiable Epic-3 exit criterion is satisfied and test-proven: cross-tenant + anon-DML isolation for all 6 new tables (H4 gate green over 9 enrolled tables), parent-ownership spoofing denied (`TENANT_ACCESS_DENIED`, pinned — not disjunctive), integer-öre money validation, snapshot freeze / no-recompute across all four source kinds, quote-terms never auto-approved, articles carry no supplier scope, and personnummer access-controlled + masked + never in list/audit.

**High-priority issues:** 0. No new HIGH-priority NFR issue. Both CONCERNS are LOW-priority, forward-looking, and carried from Epic 2 with named owners.

**Recommendation:** **PASS (advisory).** Epic 3 extends the Epic-2 security foundation cleanly onto the first business domain: tenant isolation held across a 3× growth of tenant-owned tables (3 → 9) with zero new isolation mechanism invented, the H4 gate structurally forced every new table to enroll or fail CI, and two new integrity domains (money öre / basis points; snapshot immutability) are proven by mechanism-asserting units + DB introspection. The 2 remaining CONCERNS are **the same two Epic-2 forward items still un-actioned** — (a) no dependency-vulnerability scan gate (`pnpm audit`) in CI, and (b) no runtime performance baseline for the *new* CRM/settings/pricing query paths (R-013, deferred). Neither weakens the tenant boundary or any Epic-3 exit criterion.

---

## In-Scope NFR Matrix (categories + thresholds)

| # | Category (in scope) | Threshold / definition of done | Status |
| - | --- | --- | --- |
| 1 | Tenant isolation (RLS) — 6 new business tables | RLS enable+FORCE on every new tenant-owned table; cross-tenant SELECT/INSERT/UPDATE/DELETE + anon-DML denied by mechanism (`42501` privilege OR RLS-invisible + independent BYPASSRLS re-read), not vacuous; data-driven over the inventory; H4 gate green + bites | PASS ✅ |
| 2 | Authorization — parent-ownership + client-tenant spoof | Cross-tenant parent-link (`createFacility`/`createContact` w/ B-parent) → `TENANT_ACCESS_DENIED` (pinned); client-supplied `tenant_id` ignored (membership-derived authority); snapshot source-id spoof rejected by BOTH resolver + RLS | PASS ✅ |
| 3 | Data protection — PII + service-role containment + audit hygiene | personnummer access-controlled, only on `customers`, masked on detail, never in list projection/DOM or audit metadata; no service-role in any client path / built bundle; audit metadata allow-list drops PII/secrets; audit append-only | PASS ✅ |
| 4 | Money integrity (NEW this epic) | VAT as `vat_rate_bp` basis points [0,10000]; work-role rate / article price integer öre `bigint` w/ non-negative CHECK; float/neg/NaN/Infinity/locale-comma/overflow rejected → `VALIDATION_FAILED`; NO calc engine | PASS ✅ |
| 5 | Data integrity — snapshot immutability + sign-off gating (NEW this epic) | Snapshot builders copy by value + `Object.freeze` (mutate-source-after-build ⇒ prior snapshot byte-unchanged, all 4 kinds); quote-terms never auto-approved (fresh=NULL, approve is only path, edit invalidates); golden masters pinned | PASS ✅ |
| 6 | Testability / maintainability (standing gates + first product UI) | Dual-runner suite in CI extended with 6 new tables' negatives + command/UI tests; H4 gate compile-exhaustive; migration-reset exact-policy enumeration extended (not loosened); Playwright E2E job now live in CI | PASS ✅ |
| 7 | Vulnerability management | 0 critical / 0 high dependency vulns gated in CI | CONCERNS ⚠️ (carried from Epic 2 — still no `pnpm audit` gate) |
| 8 | Runtime performance / load at scale (CRM/settings/pricing query + RLS under many rows/tenants) | SLO/SLA + load evidence for the new business query paths | CONCERNS ⚠️ → effectively N/A this epic (R-013 deferred; no SLA; single pilot tenant; baseline harness exists for auth/RLS only) |

Runtime categories **N/A this epic:** response-time/throughput SLOs, availability/uptime, MTTR, disaster recovery (no deployed production runtime with an SLA yet — pilot stage).

---

## Performance Assessment

**Status:** N/A this epic (deferred by design) ⚠️→✅. No SLO/SLA is defined for CRM/settings/pricing query paths in the PRD or architecture for Phase A, and the internal pilot runs a single tenant initially — there is nothing to load-test against a threshold yet.

### Response Time / Throughput / Resource Usage

- **Status:** N/A (deferred) — no threshold defined; no load test in scope for the new business query paths.
- **Threshold:** UNDEFINED for Phase A. The Epic-3 test design explicitly lists "Auth/RLS/CRUD performance at scale" as **Not in Scope** ("Premature for internal pilot; no SLA defined — carry-forward R-013 from Epic 2") and R-013 (PERF, score 2) as "Monitor; defer load testing to a later epic … The Epic 2 `auth-rls-baseline` perf harness can be extended when needed."
- **Evidence:** `test-design-epic-3.md` Not-in-Scope table + R-013; the Epic-3 trace report confirms R-013 as the one documented residual (not a gate blocker). A **non-gating baseline harness already exists** (`tests/integration/perf/auth-rls-baseline.int.test.ts` + `perf-baseline-epic-2.md`) that logs `p50/p95/max` and asserts only a generous `p95 < 2000ms` catastrophic-regression ceiling — but it measures the **auth/RLS foundation paths** (`resolveTenantContext`, own-tenant membership read), **not** the new Epic-3 CRM/settings/pricing/snapshot query paths.
- **Findings:** Correctly deferred. The positive design note carried from Epic 2 holds: commands use a **single injectable timestamp** and tests assert on it **without sleeps**, so the (now larger) suite has no time-based flake. One forward gap worth naming: when R-013 is brought into scope post-pilot, the existing baseline harness should be **extended to the new business query paths** (a CRM list read under many customers, a settings upsert, a work-role/article read), not just the auth hot path it covers today.

### Scalability (test-suite + schema scalability — the only scalability surface this epic)

- **Status:** PASS ✅ (for the harness/schema; product runtime scalability is N/A/deferred).
- **Evidence:** The cross-tenant + anon RLS negatives are **parameterized over the tenant-table inventory** and use **per-worker tenant pairs** — so enrolling 6 new tables was a **data edit**, not 6 copy-pasted parallel suites, and the H4 gate proved it (9 tables covered, gate green). The per-table metadata is a compile-exhaustive `switch`/`assertNever` (a forgotten seam is a typecheck error). Access-path indexes were added for the RLS/command predicates (`customers(tenant_id)`, `facilities(tenant_id, customer_id)`, `contacts(tenant_id, customer_id)`, `contacts(facility_id)`, and the pricing/settings tenant indexes).
- **Findings:** The test + schema architecture absorbed a 3× growth in tenant-owned tables with no per-table rework and no isolation regression — exactly the scale property the Epic-2 harness was built for. Product/runtime scalability under tenant/row count remains the deferred R-013 concern.

**Carried-forward action:** when a tenant/row scale concern becomes real (post-pilot), bring R-013 into scope and extend the `auth-rls-baseline` harness to the Epic-3 CRM/settings/pricing query paths with an agreed SLO.

---

## Security Assessment

Epic 3 introduces the first business PII, the first customer-facing legal text, and 6 new tenant-owned tables — the highest-surface-growth security epic so far. Every SEC-category risk (R-001..R-005) is FULL/green in the trace report; this NFR audit confirms the *evidence quality* (mechanism-asserting, not vacuous).

### Authentication Strength

- **Status:** PASS ✅ (unchanged from Epic 2; no new auth surface)
- **Threshold:** Server-side auth authority; `getClaims()` re-validation; no anonymous privileged access.
- **Actual / Evidence:** No new authentication mechanism was introduced — all Epic-3 commands and UI reuse the Epic-2 `resolveTenantContext` (server `getClaims()`, not `getSession()`) and the `(app)` server-layout redirect. New product routes are **force-dynamic** and redirect anonymous callers to `/login`, now proven by an **executing Playwright assertion** (`customers.e2e.spec.ts` anon `/customers` + `/customers/[id]` → `/login`; `settings.e2e.spec.ts`; `pricing.e2e.spec.ts` anon → `/login`) — the Epic-2 "gated/skipped" limitation on this dimension is resolved.
- **Findings:** Strong for Phase A. The disclosed Epic-2 residual (no automated brute-force/rate-limit/lockout test on `/login`; relies on Supabase platform throttling) is unchanged and still appropriate for an internal pilot.

### Authorization Controls (tenant isolation + parent-ownership + PII scoping)

- **Status:** PASS ✅
- **Threshold:** Tenant A cannot read/mutate/spoof Tenant B across any of the 6 new tables; a cross-tenant parent link is denied; client-supplied `tenant_id` never widens access; personnummer is access-controlled.
- **Actual / Evidence:**
  - Cross-tenant SELECT/INSERT/UPDATE/DELETE + anon-DML denied on all 6 new tables, asserted by the **denial MECHANISM** — `42501` (privilege) for tables where the seam is a missing grant, and **RLS-invisible** (zero rows + independent BYPASSRLS re-read proving the target row is unchanged) for tables that DO grant `authenticated → UPDATE` (CRM/settings/pricing). The `updateDenialKind` seam was introduced so the data-driven UPDATE negative asserts the CORRECT mechanism per table (privilege vs RLS-invisible) rather than assuming a single code. Spoof-INSERTs use fresh `crypto.randomUUID()` ids so the denial is the privilege/RLS layer, not a `23505` PK collision. (`cross-tenant-isolation.rls.test.ts`, `anon-path-isolation.rls.test.ts`.)
  - **Parent-ownership spoofing denied** — a Tenant-A `createFacility`/`createContact` supplying a Tenant-B `customer_id`/`facility_id` returns `TENANT_ACCESS_DENIED` (parent invisible under A's RLS / composite same-tenant FK `23503` mapped to `TENANT_ACCESS_DENIED`). This was **hardened during code review**: the assertion was pinned from a permissive `["TENANT_ACCESS_DENIED","VALIDATION_FAILED"]` disjunction to an exact `toBe("TENANT_ACCESS_DENIED")`, closing a re-map regression hole (Story 3.1 Review Finding, Med — patched). (`crm-parent-ownership.int.test.ts:98-166`.)
  - **Snapshot source-id spoof rejected by BOTH layers** — a cross-tenant source id is denied by the resolver (`TENANT_ACCESS_DENIED`) AND by RLS (zero rows), across all four source kinds, vacuity-guarded. (`source-ownership.int.test.ts:105-161`.)
  - Client-supplied `tenant_id` is **ignored** — tenant is membership-derived everywhere (CRM commands, settings upsert, snapshot resolver).
- **Findings:** The non-negotiable isolation properties hold across the full 3× table growth, all proven by mechanism. The Epic-2 disclosed residual (own-tenant reads scoped by `tenant`, not `auth.uid()` — a future multi-admin tenant's admins can read co-members' rows *within their own tenant*, never across a boundary) is unchanged and remains the intended single-admin Phase A design + the deferred RBAC-seam follow-up. The cross-**tenant** boundary the harness enforces holds for every new table.

### Data Protection (PII handling + service-role containment + secret handling)

- **Status:** PASS ✅
- **Threshold:** First PII field (personnummer) is access-controlled, minimally surfaced, never in audit metadata; no service-role in any client path / built bundle; user-safe generic errors.
- **Actual / Evidence:**
  - **personnummer** is a single nullable column ONLY on `customers`, identifier-by-type CHECK-constrained (`private` ⇒ personnummer, others ⇒ org_nr), **never routed into audit metadata** (the SAFE_FIELDS allow-list drops it), **never in the default list projection/DOM** (asserted: `customers.e2e.spec.ts` "P0: list never contains personnummer"; `customer-presentation.test.ts`), and **masked on the detail screen** (`customers.e2e.spec.ts` "AC2 detail shows personnummer MASKED"). A schema guard asserts personnummer appears on no other table (`crm-tables-migration-reset.int.test.ts:237-253`).
  - **Service-role containment** carries forward the Epic-2 authoritative built-bundle grep (`verify:bundle-containment` after `pnpm build`) + source-level guard (`verify:service-role-containment`) — both GREEN, and the trace report maps the new UI writes (3.2 AC4 / 3.3 / 3.4) as "envelope-only, no service-role, no direct `.insert()/.update()`" to those gates. The app still uses NO service-role key (anon + RLS).
  - **Audit hygiene** — every Epic-3 mutation writes exactly ONE `audit_events` row via the envelope's `writeAuditEvent`; the allow-list sanitizer (`reason`/`beforeHash`/`afterHash`/`targetVersion` only) is unchanged; no customer name / personnummer / org.nr / email / address is routed into metadata. (`settings-commands.int.test.ts` 1-audit-row-no-PII; CRM command coverage.)
- **Findings:** The first PII field lands with a correct minimal-surface + access-controlled posture. **Disclosed, still-accepted Phase A residual (NOT a defect):** full GDPR / retention treatment of personnummer is **deferred to full release** (internal pilot — explicit owner decision 2026-06-18); the audit-metadata sanitizer is the forward-positive control for when regulated-data processing formalizes. Surfaced in the Story 3.1 PR security statement.

### Money / Tax Data Protection (NEW — customer-visible price + tax data)

- **Status:** PASS ✅
- **Threshold:** Money is integer öre / basis points (never float kronor); rates non-negative; customer-facing tax/legal text never auto-approved.
- **Actual / Evidence:** VAT stored as `vat_rate_bp integer` (basis points, CHECK [0,10000]); work-role rates + article prices are `bigint` öre with non-negative CHECKs; the pure `isOreAmount` validator rejects float/negative/NaN/Infinity/locale-comma/overflow → `VALIDATION_FAILED` (unit matrix + `bigint` column introspection: `pricing-validation.test.ts`, `pricing-tables-migration-reset.int.test.ts:86-120`). Quote-terms sign-off is a never-auto-approved contract (below, Reliability). No VAT/ROT calculation engine (Epic 4).
- **Findings:** The first money surface establishes the integer-öre / basis-points discipline at storage + validation + DB-CHECK layers before any calculation engine exists — the correct order. No float kronor field anywhere.

### Vulnerability Management

- **Status:** CONCERNS ⚠️ (LOW priority; carried from Epic 2, still un-actioned)
- **Threshold (future):** 0 critical / 0 high dependency vulnerabilities gated in CI.
- **Actual:** No `pnpm audit` / dependency-scan gate is wired into CI (confirmed: no `audit`/`snyk`/`dependabot` reference in `.github/` or `package.json`). Epic 3 added **no new runtime dependency** (every story explicitly "NO new dependency"; the snapshot resolver deliberately did NOT add `server-only` for this reason) — so the dependency surface did not grow this epic, but the auth + DB client libraries introduced in Epic 2 remain unscanned by an automated gate.
- **Findings:** Acceptable for an internal pilot given exact pins + frozen-lockfile install, but this CONCERN is now **carried across two epics unaddressed**. A `pnpm audit --audit-level=high` CI step remains the obvious quick win and should land before any external exposure.

### Compliance

- **Status:** N/A this epic (forward-positive controls in place). Regulated-data processing now genuinely begins (personnummer is Swedish PII), but no GDPR/retention policy, DPA, or lawful-basis documentation is in Phase A scope for the internal pilot (owner decision). The access-controlled + minimal-surface + never-in-audit posture is the correct forward-positive control for when compliance formalizes; full GDPR treatment is the disclosed deferred item.

---

## Reliability Assessment

Runtime availability/MTTR/DR are N/A (no production runtime/SLA yet). The **data-integrity slice** of reliability IS in scope this epic and is strong, and Epic 3 adds two NEW data-integrity properties (snapshot immutability; sign-off gating).

### Data Integrity — Snapshot Immutability (NEW)

- **Status:** PASS ✅
- **Threshold:** A built snapshot is frozen-by-value — mutating the source row after the build leaves the prior snapshot byte-for-byte unchanged; no silent recompute; no live reference to the source.
- **Evidence:** The four pure builders COPY every field by value and return `Object.freeze(...)`; `capturedAt` is injected, never read from the wall clock; no arithmetic on öre. `build.test.ts:249-510` asserts mutate-after-build unchanged + frozen for all four kinds; `golden.test.ts` pins expected output against anonymized golden fixtures (`tests/fixtures/golden/snapshots/{work-role,article}-source.json`); `dispatch.test.ts` asserts the `assertNever` exhaustiveness guard. (R-008 green.)
- **Findings:** The freeze-by-value + no-live-reference guarantee is proven per-kind — the snapshot cannot drift or silently recompute when its source mutates. Correct foundation for the Epic-4+ quote-immutability requirement.

### Data Integrity — Sign-Off Gating (customer-facing legal text, NEW)

- **Status:** PASS ✅
- **Threshold:** Customer-facing quote terms are never auto-approved; a fresh record is not-approved; approval is a single deliberate path; any edit invalidates a prior sign-off.
- **Evidence:** `quote_terms` approval is the nullable `approved_at` (DEFAULT NULL = not-approved) + `approved_by`; there is NO `approved`/`status`/`is_approved` column. `updateQuoteTerms` ALWAYS writes `approved_at = null, approved_by = null` (edit invalidates); `approveQuoteTerms` is the ONLY path that sets approval (deterministic injected clock + resolved user). The settings UI ALWAYS shows the sign-off status or a not-approved warning. Proven by 4 P0 DB-row sign-off tests + 3 e2e sign-off assertions (`settings-commands.int.test.ts:300-400`, `settings.e2e.spec.ts`). (R-011 green.)
- **Findings:** The never-auto-approve contract is enforced structurally (there is no column that could carry a stray approval) plus behaviorally (edit resets, approve is the sole setter). Strong.

### Data Integrity — Audit Append-Only + Metadata Hygiene

- **Status:** PASS ✅ (carried from Epic 2, now exercised by ~20 new commands)
- **Evidence:** The Epic-2 two-layer append-only guarantee (privilege `42501` + `audit_events_append_only` trigger backstop) is unchanged; the metadata allow-list sanitizer is unchanged; every new Epic-3 command writes exactly ONE audit row with no PII (verified in the settings/CRM command suites). `audit_events` remains H4-enrolled (cross-tenant + anon covered).
- **Findings:** The audit trail absorbed ~20 new command types without becoming a PII/secret sink and without any new write path bypassing the envelope.

### Determinism / Non-Flakiness

- **Status:** PASS ✅
- **Evidence:** Single injectable command timestamp used for all lifecycle/audit/sign-off/snapshot-`capturedAt` fields; no sleep-based timing anywhere; per-run `crypto.randomUUID()` ids in spoof/seed rows and row-count assertions (per the Story 3.1 factory discipline) so repeat-without-reset local runs don't accumulate. Migration reset from empty is deterministic and green with the new migrations, with the migration-reset exact-policy enumeration **EXTENDED** (12-policy per-table enumeration + "no DELETE policy anywhere") rather than loosened to a superset.
- **Findings:** Determinism is sound and the Epic-2 hardcoded-`correlationId` non-CI flake pattern was NOT repeated in Epic-3 tests (per-run unique ids used throughout). Note: the Epic-2 `envelope-audit-write.int.test.ts` repeat-without-reset flake was a carried Epic-2 quick-win; it is out of Epic-3 scope but remains the CI sequence (`db reset → test:int`) is always green.

### Fault Tolerance / Availability / MTTR / Disaster Recovery

- **Status:** N/A this epic. Still no deployed service, no `/api/health`, no external dependency to retry/break against, no production uptime SLO or backup/restore drill in Phase A scope. The envelope error taxonomy remains a graceful-degradation control (transient infra → retryable `SERVER_ERROR`, never masked as a denial; no raw throw crosses the boundary — the snapshot resolver follows the same mapping) — but classic reliability mechanisms have no runtime surface to apply to yet. Becomes assessable when a deployed runtime + external integrations land (Epic 4+).

---

## Maintainability Assessment

### Test Coverage (extended to the first business domain + first product UI)

- **Status:** PASS ✅
- **Threshold:** Real automated suite executing in CI, extended to the new tables/commands/UI without weakening existing gates.
- **Evidence:** The dual runner grew to a reported **149 unit + 155 DB-backed integration** (clean `supabase db reset → test:int`) plus the **Playwright e2e suite** (CRM/settings/pricing/auth). The Epic-3 trace report is **PASS at P0 100% / P1 100% / overall 100%** (36/36 mapped requirements FULL), verified against actual test source (no `.skip`/`.only`/`xit` in executable code). Every new command has an integration or unit test; every state/lifecycle criterion has both happy and negative assertions.
- **Findings:** The single biggest maintainability advance this epic is that the **Playwright E2E job is now live in CI** (`.github/workflows/ci.yml` `e2e` job: installs chromium, boots the local stack, `db reset`, runs `test:e2e`, uploads the report) — this **resolves the Epic-2 UI-surface / route-redirect CONCERN** that was previously a skipped scaffold. No line-coverage % is computed (no coverage reporter wired) — the same minor forward gap carried from Epic 2; the priority-weighted trace coverage (now 100%) remains the governing metric.

### Standing Regression Mechanism (H4 inventory gate) — proven at scale

- **Status:** PASS ✅
- **Evidence:** The H4 gate absorbed the 3× table growth as designed: all 6 new tables were enrolled in `TENANT_TABLES` (9 total) with BOTH metadata seams (cross-tenant + anon), the compile-exhaustive `switch`/`assertNever` made a forgotten seam a typecheck error (Story 3.1 dev record: the crash-interrupted partial enrollment surfaced as 5 `TS2345 … not assignable to 'never'` errors until all six helpers had CRM branches — the gate biting at compile time, by design), and the gate is green + bite-proven. The `updateDenialKind` extension kept the data-driven UPDATE negative asserting the correct per-table mechanism.
- **Findings:** This is the load-bearing property validated this epic — the standing regression mechanism from Epic 2 forced correct isolation coverage across a large table addition with no reviewer catch required. Excellent.

### Code Quality / Static Analysis

- **Status:** PASS ✅
- **Evidence:** `typecheck` (strict, `isolatedModules`, `@/*`) + `lint` enforced on every PR; exact-pinned toolchain (no `^`/`~`); no new dependency added across the epic; new business migrations are additive (existing migrations untouched — production contract); pure-core extraction continued (snapshot builders/resolver, `isOreAmount`, presentation helpers are unit-testable off-DB). The command envelope was reused for ~20 new commands with no bespoke auth/audit/error mechanism (a `CommandError` escape was added to the envelope, not a parallel path).
- **Findings:** Clean, consistent with the Epic-1/2 posture, extended to the CRM/settings/pricing/snapshot code with no architectural divergence.

### Test Quality

- **Status:** PASS ✅
- **Evidence:** The mechanism-asserting discipline held and was **hardened under review**: DB negatives assert SQLSTATE (`42501`) or RLS-invisible + independent BYPASSRLS re-read (never a vacuous disjunction); the cross-tenant suites seed real Tenant-B business rows so negatives target a concrete row (vacuity-guarded); the parent-ownership assertion was pinned to exactly `TENANT_ACCESS_DENIED` during code review (removing a permissive disjunction that could green a re-map regression). Golden masters pin the snapshot shape; the golden anonymization guard scans fixture DATA, not `_doc` prose.
- **Findings:** High test quality, with a concrete review-driven improvement (the pinned parent-ownership assertion). One disclosed, correctly-backstopped design note (not a defect): `validateUpdateCustomer` does not re-derive identifier-by-type mutual exclusion at the command layer (it can't know the row's existing `customer_type` without a read) and relies on the DB CHECK (`23514 → VALIDATION_FAILED`) as the backstop — the right code is still returned, logged as later hardening (Story 3.1 Review Finding, Low — deferred).

### Documentation Completeness

- **Status:** PASS ✅
- **Evidence:** The standing PR contract ("a product PR adding/touching a tenant-owned table MUST enroll it or CI goes red") continues to be honored and cited by architecture § (not plan numbers). Every story's Dev Agent Record documents the migration, GRANTs/RLS, H4 enrollment, and scope guardrails; the deferred-work items are logged with owners; the trace report enumerates the sanctioned scope decisions (not gaps).
- **Findings:** Documentation is complete and reconciled; deferred items are owned, not lost.

---

## Custom NFR Assessments

### UI-Surface / Route-Redirect NFR Proof (the Epic-2 CONCERN — now RESOLVED)

- **Status:** PASS ✅ (was CONCERNS in Epic 2)
- **Threshold:** An executing assertion that the product UI reflects server-resolved tenant authority, that anonymous requests to `(app)` routes redirect to `/login`, and that dialogs manage focus + programmatically associate validation errors (a11y).
- **Actual / Evidence:** The Playwright E2E runner is **live in CI** (`e2e` job) and the specs execute (no `.skip` in executable code): `customers.e2e.spec.ts` (list states, search/filter, personnummer-never-in-list, detail masking, dialog focus in/out + `aria-invalid`/`aria-describedby`/live-region field-error association, seven-nav, anon route redirect, envelope create round-trip); `settings.e2e.spec.ts` (VAT-rate validation, terms round-trip, not-approved warning); `pricing.e2e.spec.ts` (neg/float rate rejected, round-trip, anon → `/login`).
- **Findings:** The Epic-2 forward CONCERN on this dimension is **closed** — the UI surface is now proven by executing browser assertions, not wiring + a skipped scaffold. Sanctioned residuals (from the trace report, not gaps): "loading" list state is architecturally inapplicable (server read, no client fetch) and "duplicate-like" is a create-dialog advisory; contact `is_primary` un-check + facility-unbind edit-clear and an `approved_by` display-name resolution are minor deferred UX follow-ups with owners.

---

## Quick Wins

2 low-effort, high-leverage items (none required for epic sign-off — both forward-looking, both carried from Epic 2):

1. **Add a `pnpm audit --audit-level=high` dependency-vulnerability gate to CI** (Security/Maintainability) — LOW priority — small. Closes the vulnerability-management CONCERN now carried across two epics. Cheap; the dependency surface is exact-pinned + frozen but unscanned by an automated gate.
2. **Wire a coverage reporter** (Maintainability) — LOW priority — small. The priority-weighted trace coverage (100%) governs the gate, but a line/branch % (e.g. Vitest coverage provider) would make the maintainability signal quantitative.

(The Epic-2 `envelope-audit-write.int.test.ts` hardcoded-`correlationId` non-CI flake quick-win is out of Epic-3 scope but remains a cheap Epic-2-owned fix.)

---

## Recommended Actions

### Immediate (Before Release) - CRITICAL/HIGH Priority

**None.** No CRITICAL/HIGH NFR action blocks the epic. Every non-negotiable Epic-3 exit criterion is satisfied and test-proven; the Epic-3 trace gate is PASS.

### Short-term (Next Milestone) - MEDIUM Priority

1. **Add the `pnpm audit` CI gate** — MEDIUM — owner: near-term CI-hardening. Closes the vulnerability-management CONCERN carried from Epic 2.
2. **Extend the `auth-rls-baseline` perf harness to the new CRM/settings/pricing query paths** — MEDIUM — owner: R-013 / later epic. When R-013 is brought into scope, add non-gating baselines for a CRM list read under many customers, a settings upsert, and a work-role/article read (the current baseline covers only the auth/RLS foundation path).

### Long-term (Backlog) - LOW Priority

1. **Bring R-013 (CRM/settings/pricing performance at scale) into scope post-pilot** — LOW — owner: a later epic. Define an SLO once tenant/row counts grow, then convert the extended baseline from "baseline" to "gate."
2. **Wire a coverage reporter** — LOW — owner: CI-hardening.
3. **Harden `validateUpdateCustomer`** (read-then-validate for identifier-by-type mutual exclusion) — LOW — owner: later hardening (correctly DB-backstopped today).
4. **Formalize GDPR/retention treatment of personnummer** — LOW for the pilot; required before external exposure — owner: owner/legal at full release (deferred by explicit owner decision).

---

## Monitoring Hooks

(Forward-looking — no production runtime to instrument yet; recommended as the pilot deploys.)

### Security Monitoring

- [ ] CI alert on a red `verify:bundle-containment` / `verify:service-role-containment` / H4 inventory-gate run — **Owner:** CI-hardening — **Deadline:** at pilot deploy.
- [ ] (Once a runtime exists) alert on any command returning `TENANT_ACCESS_DENIED` at an anomalous rate (possible enumeration/spoof attempt) — **Owner:** Epic 4+ — **Deadline:** first production runtime.

### Reliability Monitoring

- [ ] Audit-write success-rate + append-only-trigger-violation counter (once a runtime exists) — **Owner:** Epic 4+ — **Deadline:** first production runtime.
- [ ] Sign-off state-change + snapshot-build counters (customer-facing legal-text / immutability observability) — **Owner:** Epic 4+ — **Deadline:** first production runtime.

---

## Fail-Fast Mechanisms

### Validation Gates (Security / Money / Integrity) — already in place ✅

- [x] H4 RLS inventory gate — fails CI on an unenrolled tenant-owned table (live, bite-proven, now over 9 tables).
- [x] Built-bundle + source-level service-role containment — fails CI on a service-role leak (fails-loud if `.next` absent).
- [x] Migration-reset exact-policy enumeration — an unexpected/stray policy or a missing RLS-force fails CI (extended, not loosened, for the 6 new tables).
- [x] Integer-öre / basis-points validation — float/neg/NaN/Infinity/locale-comma/overflow rejected → `VALIDATION_FAILED` + `bigint`/CHECK DB backstop.
- [x] `SUPABASE_TEST_REQUIRED=1` — a missing local stack is a HARD CI failure (no silent false-green).

### Vulnerability Scanning (Security)

- [ ] No `pnpm audit` gate — **Owner:** near-term CI-hardening (the one open Quick Win).

### Rate Limiting (Performance/Security)

- [ ] No application-level rate limit on `/login` or commands — **Owner:** Epic 4+ / external-beta hardening — relies on Supabase platform throttling for the pilot.

---

## Evidence Gaps (forward-looking; none block Epic 3)

- [ ] **Dependency vulnerability scan** — **Owner:** near-term CI-hardening. **Suggested evidence:** `pnpm audit` CI job. **Impact:** unscanned (but exact-pinned + frozen) dependency surface incl. auth/DB clients. (Carried from Epic 2.)
- [ ] **Runtime performance baseline for the new CRM/settings/pricing query paths** — **Owner:** later epic (R-013 deferred). **Suggested evidence:** extend the `auth-rls-baseline` harness with business-query scenarios + an agreed SLO. **Impact:** no load characterization for the new business paths (single pilot tenant initially).
- [ ] **Line/branch coverage number** — **Owner:** CI-hardening. **Suggested evidence:** Vitest coverage report. **Impact:** maintainability coverage is priority-weighted (trace 100%), not quantified as a %. (Carried from Epic 2.)
- [ ] **GDPR/retention policy for personnummer** — **Owner:** owner/legal at full release. **Suggested evidence:** DPA + retention policy + lawful-basis doc. **Impact:** first PII field stored with a correct minimal/access-controlled posture but no formal compliance treatment (deferred by owner decision for the internal pilot).

These are deliberately-deferred follow-ons, each already owned — carried forward, not charged against Epic 3.

---

## Findings Summary (ADR Quality Readiness Checklist lens)

| Category | In scope this epic? | Status |
| --- | --- | --- |
| 1. Testability & Automation | Yes — dual runner extended (149 unit + 155 INT), Playwright E2E now live in CI, H4 gate bite-proven over 9 tables | PASS ✅ (Epic-2 UI-surface CONCERN resolved) |
| 2. Test Data Strategy | Yes — two-tenant factories extended additively with CRM/settings/pricing seeds; per-worker pairs; per-run unique ids; local-Supabase-only | PASS ✅ |
| 3. Scalability & Availability | Partial — test-suite + schema scalability PASS (3× table growth absorbed by data edits); runtime availability N/A (no SLO/deploy) | PASS (harness/schema) / N/A (runtime) |
| 4. Disaster Recovery | No runtime/SLA yet | N/A |
| 5. Security | Yes — isolation across 6 new tables, parent-spoof denial (pinned), first PII access-controlled, service-role containment, money integrity all green | PASS ✅ |
| 6. Monitorability / Debuggability / Manageability | Partial — typed error taxonomy + audit trail + CI bite-signals extended; no runtime APM yet | PASS (in-scope slice) / N/A (runtime APM) |
| 7. QoS / QoE | No runtime SLO/load in scope (R-013 deferred); the perf baseline harness covers auth/RLS only | N/A (deferred) / CONCERNS on the un-extended baseline |
| 8. Deployability | Yes — CI gate sequence extended (6 new tables' migration reset + INT/RLS + E2E job) without weakening existing gates | PASS ✅ |

**Interpretation:** Every category that *can* be satisfied at this stage is PASS. The Epic-2 UI-surface CONCERN is now **resolved** (Playwright E2E live in CI). Two NEW integrity domains (money öre/basis-points; snapshot immutability + sign-off gating) are proven this epic. The remaining advisory CONCERNS (vulnerability-scan gate; runtime performance for the new business paths) are forward-looking with owners and carried from Epic 2 — neither weakens the tenant boundary or any Epic-3 exit criterion.

---

## Gate YAML Snippet

```yaml
nfr_assessment:
  date: '2026-07-01'
  epic_id: '3'
  feature_name: 'CRM, Company Settings, And Pricing Foundation (CRM data model + commands + UX, company identity / quote terms / VAT defaults with sign-off, work roles + integer-öre articles, pure snapshot-source contract)'
  mode: advisory_non_blocking
  relationship_to_blocking_gate: 'one tier below *trace (which returned PASS: P0 100%, P1 100%, overall 100% — 36/36 FULL); this advisory NFR audit is consistent with that PASS posture'
  scope_note: 'First business-domain epic — 6 new tenant-owned tables, first product UI, first PII (personnummer), first money surface (öre/basis-points), first sign-off + snapshot contract. Runtime perf/load at scale (R-013) and availability/DR remain deferred N/A for the internal pilot.'
  categories:
    tenant_isolation_rls: PASS         # 6 new tables, cross-tenant + anon denied by mechanism, H4 green over 9 tables
    authorization_parent_ownership: PASS   # parent-spoof + source-spoof + client-tenant-spoof denied (pinned TENANT_ACCESS_DENIED)
    data_protection_pii_service_role_audit: PASS  # personnummer access-controlled/masked/never-in-audit; service-role contained; audit hygiene
    money_integrity: PASS              # integer öre / basis points, non-negative CHECK, isOreAmount matrix, no calc engine
    snapshot_immutability_signoff: PASS  # freeze-by-value all 4 kinds; quote-terms never auto-approved
    testability_standing_gates_ui: PASS  # dual runner extended; Playwright E2E now live in CI; H4 bite-proven at scale
    vulnerability_management: CONCERNS  # still no pnpm audit gate (carried from Epic 2)
    runtime_performance_load: CONCERNS  # R-013 deferred; baseline harness covers auth/RLS only, not new business query paths -> effectively N/A this epic
    runtime_availability_dr: N/A        # no production runtime/SLA yet
  overall_status: PASS # advisory
  blockers: false
  critical_issues: 0
  high_priority_issues: 0
  concerns: 2
  quick_wins: 2
  evidence_gaps: 4
  recommendations:
    - 'PASS (advisory): tenant isolation held across a 3x growth of tenant-owned tables (3 -> 9) with no new isolation mechanism; parent/source/client-tenant spoofs denied by mechanism (pinned); first PII access-controlled + masked; money integer-öre/basis-points; snapshot immutability + never-auto-approve sign-off all green. No epic blockers.'
    - 'The Epic-2 UI-surface / route-redirect CONCERN is now RESOLVED — the Playwright E2E runner is live in CI and the CRM/settings/pricing/auth specs execute.'
    - 'Carry forward (both from Epic 2, both LOW): add a pnpm audit CI gate; extend the auth-rls-baseline harness to the new business query paths and bring R-013 into scope post-pilot. Deferred by owner: GDPR/retention for personnummer at full release.'
```

---

## Related Artifacts

- **Story Files:** `_bmad-output/implementation-artifacts/3-1…3-5-*.md`
- **Test Design:** `_bmad-output/test-artifacts/test-design-epic-3.md` (risks R-001..R-013; Not-in-Scope incl. perf/load at scale)
- **Traceability + Gate:** `_bmad-output/test-artifacts/traceability/epic-3-traceability-report.md` (**PASS** — P0 100%, P1 100%, overall 100%, 36/36 FULL)
- **CI workflow:** `.github/workflows/ci.yml` (`verify` job + `db` job + NEW `e2e` Playwright job; bundle-containment after build; INT after `supabase db reset`)
- **Prior NFR assessment:** `_bmad-output/test-artifacts/nfr-assessment-epic-2.md` (its UI-surface CONCERN is resolved here; its vulnerability-scan + perf CONCERNS are carried)
- **Perf baseline:** `_bmad-output/test-artifacts/perf-baseline-epic-2.md` + `tests/integration/perf/auth-rls-baseline.int.test.ts` (non-gating; auth/RLS foundation paths only — extend for Epic-3 business paths when R-013 is scoped)
- **Key tests/scripts (evidence):** `tests/integration/rls/*` (cross-tenant, anon-path, inventory-gate, migration-reset exact-policy, crm/pricing migration-reset), `tests/integration/commands/*` (crm/settings/pricing commands, parent-ownership, audit), `tests/integration/snapshots/source-ownership.int.test.ts`, `tests/unit/lib/snapshots/*` (build/immutability/golden/dispatch), `tests/unit/server/commands/*` (pricing/settings/crm validation, isOreAmount), `tests/e2e/*` (crm/settings/pricing/auth)
- **Quality/CI docs:** `docs/quality/quality-gates.md`, `docs/quality/ci.md`

---

## Recommendations Summary

**Release Blocker:** None. Every non-negotiable Epic-3 exit criterion is satisfied at the running-test level and the blocking trace gate is PASS.

**High Priority:** None new. (The Epic-2 HIGH item — un-skip the Playwright E2E — is resolved this epic.)

**Medium Priority:** Add the `pnpm audit` CI gate; extend the perf baseline to the new business query paths when R-013 is scoped.

**Next Steps:** Proceed past the Epic-3 boundary. The 2 advisory CONCERNS are forward-looking, LOW-priority, and carried from Epic 2; neither weakens the tenant boundary. When the pilot deploys / tenant counts grow, bring R-013 into scope and re-run `*nfr-assess` with a business-path baseline; formalize GDPR/retention for personnummer before any external exposure.

---

## Sign-Off

**NFR Assessment (advisory, non-blocking):**

- Overall Status: PASS ✅ (advisory)
- Critical Issues: 0 · High Priority: 0 · Concerns: 2 (both forward-looking, LOW, carried from Epic 2) · Evidence Gaps: 4 (all forward-looking, owned)
- Gate Status: PASS ✅ (advisory) — consistent with the blocking `*trace` PASS gate

**Next Actions:**

- Proceed past the Epic-3 boundary. Add the `pnpm audit` gate and extend the perf baseline in the next milestone; formalize personnummer GDPR/retention before external exposure.
- Re-run `*nfr-assess` with R-013 in scope once the pilot deploys / tenant counts grow.

**Generated:** 2026-07-01
**Workflow:** testarch-nfr (advisory mode)

<!-- Powered by BMAD-CORE™ -->

---
workflowType: 'testarch-test-design'
runScope: 'epic-level'
runKey: 'epic-20'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-10-09'
epic: 20
product: 'Kopplas'
authorRoute: 'gpt-6.1-sol High'
designStatus: 'complete; implementation evidence pending'
pact_mcp_reachable: false
inputDocuments:
  - _bmad/tea/config.yaml
  - AGENTS.md
  - docs/process/agent-model-routing.md
  - docs/process/local-setup.md
  - docs/decisions/ADR-B008-quote-review-authority-and-derived-artifact-validity.md
  - docs/decisions/ADR-B013-kopplas-product-name-and-compatibility.md
  - _bmad-output/implementation-artifacts/spec-20-1-documents-activation-and-source-authorized-aggregation.md
  - _bmad-output/implementation-artifacts/spec-20-2-search-filters-preview-and-archive-restore.md
  - _bmad-output/implementation-artifacts/spec-20-3-entity-panel-links-and-contextual-navigation.md
  - _bmad-output/planning-artifacts/prd-phase-b.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/epics-phase-b.md
  - _bmad-output/planning-artifacts/architecture-phase-b.md
  - _bmad-output/planning-artifacts/early-b2-documents-checkpoint-2026-10-07.md
  - _bmad-output/auto-bmad/preparation/story-20-1/source-authorization-design.md
  - _bmad-output/auto-bmad/preparation/story-20-1/selected-link-contract-design.md
  - _bmad-output/auto-bmad/preparation/story-20-1/cross-story-handoffs.md
  - _bmad-output/test-artifacts/test-design-architecture.md
  - _bmad-output/test-artifacts/test-design-qa.md
  - package.json
  - playwright.config.ts
  - tests/integration/commands/file-signed-access.int.test.ts
  - tests/integration/commands/file-signed-access-refresh.int.test.ts
  - tests/e2e/files/entity-file-preview.e2e.spec.ts
  - tests/factories/tenants/files.ts
  - tests/support/test-env.ts
---

# Test Design: Epic 20 — Documents Center

**Date:** 2026-10-09  
**Author:** TEA delegate for Rasmus, gpt-6.1-sol High  
**Status:** Complete epic test design; author checklist validated. Independent review, implementation, runtime tests and release approval are not claimed.

## Executive Summary

Epic-level plan for approved Phase B Documents stories **20.1→20.2→20.3**: activate one usable `Dokument` destination at `/files`; aggregate existing entity-scoped files through current selected-source authority; provide search/filters/preview and safe audited archive/restore; add contextual entity-panel navigation. Zero new storage tables/buckets/owners/public surfaces. Historical identifiers and signed domains remain intact under ADR-B013; current branding is Kopplas.

Inspected coordinator worktree HEAD: `90e7e42d9ffd837a5910a0ef6d883ad4e166c3c1`; run context supplied by coordinator: `documents-e20-readiness-2026-10-09`, product base `a034b772`. These identify planning context, not tested product revisions. Canonical specs retain approved readiness pins in coordinator records; later product handoffs must bind actual result SHAs.

**Risks:** 16 total, 9 high (score6), 6 medium (score4), 1 low (score2). SEC/DATA dominate: exact source access, proof/lock races, file-wide authority, immutable provenance and replay. **Coverage:** 56 behavior families (18P0,27P1,10P2,1P3), with role/source/state/race variants enumerated at implementation. QA/test-development estimate **~95–164 hours, ~3–5 weeks equivalent for one owner**, including fixture/barrier setup; not a product delivery commitment.

The owner approved **Option A** and waived exact Documents Lovable comparison on2026-10-09. **Actual oracle observations: zero; verified legacy behavior parity: none.** This plan uses approved requirements and bounded patterns. It plans tests only: no product/migration/environment/dependency changes, tests, browser exploration, resources, deployment or shared aggregate updates were performed.

## Not in Scope

| Item | Reason | Mitigation |
| --- | --- | --- |
| Global source-aware generic metadata/Storage enforcement (Option B), instant bearer cancellation | Outside explicit Option A approval | Pair Documents selected-source denial with preserved baseline generic/direct expectations; disclose real expiry. |
| Pending source modules and newly invented owner/purpose/panel routes | Manifest governs live surfaces; activation is module-owned | Synthetic future-activation coherence tests fail loudly; future activation story adds complete adapters and tests. |
| New file repository/folders/content search/editor/physical deletion/byte replacement | FR109 is metadata aggregation and archive-over-delete | Assert existing files/file_links/private bucket, literal metadata search, identity/bytes/locks preservation. |
| AI, vendor APIs, portal/BankID/anonymous signer, offline queues/PWA/native app/self-signup | Phase C hard exclusions | Existing manifest/deferred-token/security guards remain required. |
| Full legal/GDPR retention program, authoritative tax ownership, E31 deletion processing | Owner-deferred scope; not implied by archive | Retain privacy/minimal safe DTO and immutable audit checks; no retention duration or legal compliance certification. |
| Legacy-data migration, broad B1b/B2 release qualification, E15/E14 implementation | E20 has no own legacy storage migration; parallel coordinator owns other streams | Local test fixtures only; retain normal wave checkpoints and serialize shared claims/resources. |
| New Pact suite, utils dependencies, component runner or broad test-harness migration | E20 monolith/source contracts do not create independently deployed consumer/provider boundary; packages absent | Existing Node/Vitest/Playwright harness; relevant contract assertions against checked RPC/SQL. |
| External-beta load/SLO certification | NFR26 defers sizing; no numerical pilot target supplied | Measure pilot behavior and record UNKNOWN thresholds for later owner decision; do not invent targets. |

## Dependencies and Test Blockers

Design inputs are complete; no human decision blocks this document. Execution readiness is separate:

- **20.1:** current admitted base/paths/shared claims, approved all-three-spec pin set and fixed selected-link SQL/HMAC contract. Prepare the exact additive migration only after actual worker admission; historical schema guards stay intact.
- **20.2:** verified integrated20.1 product and test handoff, including Documents read/registry and unchanged signing proof. Origin capture/all-link locks/replay RPC require real schema and transaction evidence.
- **20.3:** verified integrated20.1+20.2 product handoffs and current actual listed panel insertion paths; no fake draft quote/version panel.
- **All:** local-only available DB/Auth/Storage with matching test-only Vault/config fixture, seven source factories/real objects, two tenants and role fixtures; deterministic two-connection barriers; production Next browser server. Do not infer readiness from a green planning label or mock.
- **Coordinator:** reconcile schema:migrations, manifest/nav/matrix/envelope, source panels, shared fixture writes and mutable DB/browser resources with E15/other actors; use separate admitted worktrees/isolated resources. No worker may stop/reset another actor's stack.

Future managed launch uses the resource guard with that actor's latest trusted structured context; acceptance is not readiness. Inspect durable resource state before use; finish with guard Stop (no removal/prune/native Supabase lifecycle teardown). Missing guard context blocks future launches only. Fresh-schema migration evidence must use an authorized disposable/isolated database and documented SQL-only application path where native lifecycle/reset is outside the guard contract. This planning run launched nothing.

## Risk Assessment

### High-priority risks (score ≥6)

| Risk ID | Category | Reachable failure being prevented / basis | P | I | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | List/facets/labels expose a source after missing capability, revoked membership, cross-tenant link or archived ancestry; 20.1 AC3–4 defines stricter source-live semantics than baseline file SELECT. | 2 | 3 | 6 | Seven-adapter real request-RLS and direct-RPC negatives; safe DTO assertion and current role/membership rechecks. | 20.1 author + independent High reviewer | Before 20.1 handoff |
| R-002 | SEC | Prepare succeeds but source/link/role changes before final audit, or alternate live link substitutes for selected revoked context; 20.1 AC7 and selected-link locking contract. | 2 | 3 | 6 | Exact-link prepare/finalize revalidation; deterministic two-connection SHARE-lock and locked-graph tests. | 20.1 author + QA | Before 20.1 handoff |
| R-003 | SEC | Forged actor/path/proof, generic/quote proof substitution, public internal helper or replay returns unauthorized URL/audit; fixed RPC/HMAC contract. | 2 | 3 | 6 | TS/SQL canonical vectors, every bound-field tamper, ACL catalog checks, concurrent finalize replay, no URL on failure. | 20.1 author + security reviewer | Before 20.1 handoff |
| R-004 | DATA | Quote PDF linked under ordinary purpose bypasses durable provenance; reserved/stale PDF signs or immutable attachment history changes; ADR-B008 and 20.1 AC5. | 2 | 3 | 6 | artifact_kind-first branch; actual ordinary-purpose link adversary; exact generated pointer/storage/attachment associations and invalidation regression. | 20.1/20.2 authors + High reviewer | Before each affected handoff |
| R-005 | DATA | Visible link authorizes file-wide mutation with hidden/non-mutable links, concurrent FK insertion or reassigned unlocked parent; 20.2 AC3,7. | 2 | 3 | 6 | File FOR UPDATE before all-link authority, complete-set reread, deterministic source locks/graph reconciliation and insertion races. | 20.2 author + QA | Before 20.2 handoff |
| R-006 | DATA | Restore invents unknown origin, unlocks commitment, resurrects quote PDF or archived link, recreates bytes; 20.2 restore matrix/10.9 guard. | 2 | 3 | 6 | Full provenance-transition matrix; raw DML/RPC spoof negatives; retain lock history, identity, link archival and irreversible PDF guard. | 20.2 author + High reviewer | Before 20.2 handoff |
| R-007 | DATA | Opposite transition replay changes state again or duplicates audit; spoofed capture origin/selected-link identity defeats consumed-history rule; 20.2 exact replay contract. | 2 | 3 | 6 | Under-file-lock committed CHANGED lookup, fixed beforeHash digest, DLC20 conflict; distinguish unconsumed fresh no-op; atomic rollback. | 20.2 author + QA | Before 20.2 handoff |
| R-008 | OPS | Unavailable stack/Storage, old fixme, mock-only UI, or incompatible migration fixture produces hollow green evidence; 20.1 AC10 and existing stack gates. | 2 | 3 | 6 | SUPABASE_TEST_REQUIRED=1, positive executed/zero required skips, exact SHA/argv/environment reports and real surfaces; managed isolated fixture readiness. | Test owner + coordinator | Each check and final epic gate |
| R-013 | SEC | Forged owner tuple/return URL or stale context exposes labels/results or falls back to global list; 20.3 AC2–4. | 2 | 3 | 6 | Atomic context parsing, source RLS/live ancestry, fixed server-derived local returns, no fallback or auth cache; actual panel insertion coverage. | 20.3 author + High reviewer | Before 20.3 handoff |

### Medium-priority risks (score 3–4)

| Risk ID | Category | Reachable failure being prevented / basis | P | I | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-009 | TECH | Nav activates without usable destination, drops quote_version enrollment or permits pending owners; manifest and 20.1 AC1–2. | 2 | 2 | 4 | Same-PR manifest/matrix/nav tests; registry exhaustiveness derives from active owner set and fails on future missing adapter. | 20.1 author | Before activation PR |
| R-010 | DATA | Hidden candidate pages or equal timestamps silently truncate/duplicate authorized links or leak cursor anchors; 20.1 AC6/20.2 query contract. | 2 | 2 | 4 | Beyond-PostgREST-cap fixtures, stable keyset traversal, 50-row filtered pages, revoked anchors and authorized-only cursor/count/facets. | 20.1/20.2 authors | Before relevant handoff |
| R-011 | BUS | Slow prior selection renders old bytes as current or false mutation success after response loss; 20.2 AC2,8. | 2 | 2 | 4 | Latest-selection state unit checks, controlled delayed UI response, persistence confirmation and explicit reconciliation/reconfirm. | 20.2 author | Before 20.2 handoff |
| R-012 | DATA | SQL wildcard search or DST/reversed date parser changes authorized result semantics; 20.2 AC1. | 2 | 2 | 4 | Literal substring parser/filter tests and Europe/Stockholm 23/25-hour calendar-day bounds, AND/facet rules. | 20.2 author | Before 20.2 handoff |
| R-014 | PERF | Complete source filtering across many candidates produces pilot-unresponsive reads; NFR24–26 give no numeric latency/load target. | 2 | 2 | 4 | Bounded traversal assertions and measured realistic/hidden-heavy pilot baseline; record latency/queries/rows with no invented pass threshold. | QA + coordinator/owner | Baseline before epic release; target decision before numeric SLO gate |
| R-015 | BUS | Phone controls/focus/history/errors prevent supported connected journey or upload silently chooses another owner; 20.2 AC8/20.3 AC4–5. | 2 | 2 | 4 | Real desktop/360×640 keyboard and return/upload journeys, server-confirmed state and no automatic owner substitution. | 20.2/20.3 authors | Before relevant handoff |

### Low-priority risks (score 1–2)

| Risk ID | Category | Reachable failure being prevented / basis | P | I | Score | Action | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-016 | OPS | Copy/evidence promises instant/global source-byte revocation although Option A retains generic/direct access and bearer lifetime. | 1 | 2 | 2 | Record separate baseline expectations and TTL disclosure; review copy/release claims. | QA + coordinator | Before release evidence |

Scores are design estimates, not discovered defects or incident rates. P=1 unlikely/low uncertainty, 2 possible/complex edges, 3 likely/known failure; I=1 minor, 2 degraded with workaround, 3 unauthorized exposure or irreversible integrity loss. No known implementation defect warrants P=3 here. SEC=security, DATA=integrity, TECH=architecture, PERF=responsiveness, BUS=customer workflow, OPS=verification/operations.

All mitigations are **planned**, not completed. Residual risk after future verification: baseline generic Files.View/direct Storage remains tenant-role/path governed; raw Storage does not gain generic lifecycle/source filtering. Issued URLs survive to actual expiry (300s default, issuance cap 86400s). Read projections reflect a current request, not an eternal lease. Signing authority linearizes at finalizer locked validation/audit commit, and lifecycle authority at locked transition/audit commit; later revocation/link creation is not retroactive. Unknown numerical performance thresholds remain open. These accepted boundaries do not waive any Documents check.

## NFR Planning and Evidence Coverage

This is a validation plan; final PASS/CONCERNS/FAIL decisions belong to later `nfr-assess` after evidence exists.

| NFR category / requirements | Known threshold / invariant | Risk link / priority | Planned validation | Evidence later consumed |
| --- | --- | --- | --- | --- |
| Security/tenant/privacy: NFR1–8,17–19,42–44 | Zero unauthorized Documents rows/context/counts/new URLs; all five seeded roles and two tenants; no privileged client secret/proof/path in list, errors/logs | R-001–003,R-013; P0 | P0-01–09,18; role/RLS/direct-RPC/catalog/storage negatives; containment build scan | Executed DB reports, sanitized audit/DTO snapshots, catalog ACL evidence, production bundle/containment reports |
| Integrity: NFR7,11–12,23,56/ADR-B008 | Fixed attributable audit atomically with successful signing/transition; immutable bytes/identity/links/locks; every PDF restore denied; safe proven ordinary origin only | R-004–007; P0 | P0-10–17, P1-18–19; origin, committed replay, rollback and quote regression | Before/after metadata/audit assertions and two-connection barrier evidence; quote review/validity regression results |
| Reliability: NFR25, amended53 | No URL/success on failure; explicit retry/response-loss reconciliation; signing final-audit linearization; lifecycle no-op and changed-history semantics as specified | R-002,R-007,R-011; P0/P1 | Fault seams, deterministic races, latest-request state; real E2E persistence/refresh journeys | Vitest reports, UI traces/screenshots, observed audit/state transitions; no raw bearer tokens committed |
| Access TTL/proof boundedness: NFR19, selected-link contract | Default300s/cap86400s issuance; actual Storage JWT expiry; 5min proof challenge; final DB future tolerance5s, parser skew60s distinct; 24h+1min validation tolerance is not issuance entitlement | R-003,R-016; P0/P1 | Canonical/tamper/time vectors, short bounded test TTL/clock-controlled UI expiry, fresh refresh; accepted bearer residual reported | Time/vector reports with TTL configuration description, validated expiry and boundary-specific results |
| Accessibility/connected responsiveness: NFR30/amended31/53, FR109-AC11 | Keyboard-reachable controls/focus/errors and real360×640 floor; success only after server-confirmed persistence; no offline promise | R-015; P1 | Actual desktop/phone search/preview/lifecycle/panel/back/upload flows and keyboard transitions | Playwright report/trace and sanitized screenshots at both viewport sizes |
| Performance/scalability: NFR24–29 | Bounded complete traversal; page size50, actual PostgREST cap exceeded; numerical pilot latency/concurrency/data-volume threshold **UNKNOWN**; external-beta load deferred | R-010,R-014; P1/P2 | Hidden-heavy/realistic pilot dataset, equal timestamps, query/candidate counts, elapsed latency/memory observations | Baseline report with dataset/role/DB/config/SHA and measured values; later explicit SLO decision if needed |
| Maintainability/scope/verification: NFR35–41,43,51 | Active owner/matrix/nav/deny-list derived; unknown surface fails; required DB positive executed and zero skipped; current role/source contract coherence | R-008,R-009; P1 | Scope/unit/type/lint/build/lockfile/containment; clean-schema migration application; acceptance trace100%, measured critical branch/statement coverage target≥80% where instrumented | CI/result manifest with exact commands/SHA/environment/counts, static reports, migration evidence; trace/test-review artifacts |

**Unknowns:** numeric latency/concurrency/volume target and acceptable pilot baseline variance. Owner/coordinator resolves before any numerical SLO release claim. NFR26 permits bounded pilot measurement without external-beta load certification; this does not hold up test-design/ATDD. Code coverage tooling/report availability is unverified: record unavailable rather than deriving coverage from scenario counts. All required scenarios remain mandatory regardless of instrumentation.

## Entry Criteria

- Approved pinned requirements and Option A unchanged; new worker admission/base/path/shared claims complete.
- Prior story product handoffs verified in order; current manifest source set matched.
- Managed local test services ready and isolated, local-only endpoint guard passes; migrations/seed/Vault fixture compatible.
- Real test objects/source records and deterministic barriers exist; role/membership/ancestor variations are seedable.
- Browser fixtures exercise real production server and actual source wrappers; expired/late/failure states controlled without sleeps.
- Check identity/argv/output location and result SHA recording agreed; no required preview case remains silently skipped.

## Exit Criteria

- All required P0/security/integrity/RLS/browser cases pass with zero skipped required coverage.
- All approved ACs traced to implemented/collected evidence; no open consequential authorization/integrity/customer-output defect.
- Nine high risk mitigations have executed evidence and independent High review on actual affected result.
- Generic/direct Storage, quote Sales broker, uploaded/locked evidence and quote invalidation regressions preserved.
- Actual desktop/360×640 supported journeys and server-confirmed persistence proven.
- NFR planned evidence collected or missing/unknown item explicitly retained for later assessment; no fabricated NFR pass.
- Combined integrated result is checked by coordinator; final epic trace/NFR/test-review/retrospective/checkpoint workflow gates complete before epic closure.

## Test Coverage Plan

P0/P1/P2/P3 express **priority, not execution timing**. Each ID is a behavior family with explicit parameterized variants; 56 families are planned, not 56 executed test invocations. Test implementation must enumerate each role/source/provenance/race branch. Security/integrity makes 18/56 families P0; the generic “<10% P0” suggestion is deliberately exceeded because these paths have irreversible effects or unauthorized disclosure with no safe workaround.

Unit tests own pure rules, API/DB integration owns enforced authority and transaction behavior, and E2E owns actual navigation/rendering/persistence feedback. “API” below includes checked command and authenticated RPC/PostgREST/Storage tests under Vitest, not a proposed new HTTP endpoint. A UI journey may exercise the same system path but asserts UI wiring rather than duplicating its exhaustive security matrix. Component behavior uses the existing testable state/projection patterns or the real Playwright journey; no new component runner is required.

### P0 (Critical)

**Criteria:** Unauthorized disclosure/byte grant or irreversible commitment/lifecycle corruption; core trust blocked and no safe workaround.
**Purpose:** Prove enforced boundaries and atomic outcomes before UI wiring.

| Test ID | Atomic requirement / variants | Requirement | Test level | Risk link | Owner |
| --- | --- | --- | --- | --- | --- |
| 20-P0-01 | Current source conjunction rejects missing capability, cross-tenant/missing/archived source/link/required ancestor with generic shape and no rows/labels/facets/counts; all seven adapters and five seeded role sets. | 20.1 AC3–4; FR109-AC3,12 | API/DB-RLS | R-001 | 20.1 author |
| 20-P0-02 | Current membership disable/remove/role removal takes effect on next Documents read/open/refresh; multi-role union does not use stale JWT/client entitlements. | 20.1 AC3,7,10 | API/DB-RLS | R-001,R-002 | 20.1 author |
| 20-P0-03 | Selected link/file mismatch, disappeared context, or another live link to same file never substitutes authority; no signing/audit on denied selection. | 20.1 AC4,7 | API/DB | R-002 | 20.1 author |
| 20-P0-04 | Raw authenticated prepare/finalize calls with forged actor/tenant/source/storage fields deny; internal helpers/key functions and public/anon/service_role RPC execution unavailable; checked wrappers bind auth.uid independently. | 20.1 AC7–8; fixed ACL contract | API/DB + catalog | R-003 | 20.1 author |
| 20-P0-05 | Nonkey source/parent/file/link archive or role/membership mutation committed before finalize denies; mutations started after finalizer SHARE locks serialize after audit. | 20.1 AC7,10 | API/DB two connections | R-002 | 20.1 author |
| 20-P0-06 | Contact F1→F2 reassignment/optional null-parent changes and quote/acceptance ancestry changes between graph gather/lock fail locked-graph reconciliation; unlocked replacement is never authority. | 20.1 AC3,7,10 | API/DB two connections | R-002 | 20.1 author |
| 20-P0-07 | TS and SQL UTF-8 length-prefixed canonical bytes agree; each payload field, command/domain/key, actual URL hash/expiry/time tamper and generic/quote proof substitution is rejected. | 20.1 AC7; selected-link proof contract | API/DB canonical vectors | R-003 | 20.1 author |
| 20-P0-08 | Finalize replay and concurrent same-correlation finalize consume one fixed event; later calls deny and never emit duplicate success audit. | 20.1 AC7 | API/DB two connections | R-003 | 20.1 author |
| 20-P0-09 | Storage/attestation/audit fault or final denial after mint returns no URL, raw challenge/proof/path or success audit; failed audit transaction rolls back. | 20.1 AC7,10 | API/DB + scoped fault seam | R-003,R-008 | 20.1 author |
| 20-P0-10 | Real link_file_with_audit ordinary-purpose link to current or invalidated quote_pdf denies list/prepare/finalize even with another valid PDF context; null-kind/quote_pdf-purpose and unknown nonnull kind deny. | 20.1 AC5; 20.2 AC6 | API/DB | R-004 | 20.1/20.2 authors |
| 20-P0-11 | Strict PDF/snapshot branch requires exact current generated pdf_file_id/live version+quote/Storage and snapshot attachment association; reserved/stale/invalidated artifacts cannot reopen. | 20.1 AC5,7; ADR-B008 | API/DB | R-004 | 20.1 author |
| 20-P0-12 | Archive/restore validates ALL persisted links including hidden, archived-history, unknown/gone/non-mutable sources; one denied context prevents whole state/audit change without identity disclosure. | 20.2 AC3,7 | API/DB | R-005 | 20.2 author |
| 20-P0-13 | File FOR UPDATE blocks pre-linearization FK link insertion; complete link-set reread and parent/role locks prevent raced graph mutation; postcommit generic link creation remains accepted residual. | 20.2 AC7 | API/DB two connections | R-005 | 20.2 author |
| 20-P0-14 | Proven ordinary linked origin restores linked; immutable retained lock history including independently archived links restores locked; unknown/draft/deleted/unlinked/missing-byte/any quote_pdf restore denies, no relink/byte/identity/lock/pointer changes. | 20.2 AC5–6; restore matrix | API/DB | R-006 | 20.2 author |
| 20-P0-15 | DB-owned origin INSERT initialization/nontransition UPDATE/raw DML/RPC payload spoof cannot forge or clear origin; old locked/PDF/draft capture field unchanged; legitimate generic ordinary archive captures only linked. | 20.2 AC4–6; origin contract | API/DB | R-006,R-007 | 20.2 author |
| 20-P0-16 | CHANGED archive C1→restore C2→replay C1 (and inverse) conflicts DLC20 without update/audit; same-state replay changed=false with no duplicate; concurrent identity and changed-link digest mismatch cannot reapply transition. | 20.2 AC4,7 | API/DB two connections | R-007 | 20.2 author |
| 20-P0-17 | Lifecycle state/origin and exactly one fixed attributable success event commit atomically; injected audit failure/deadlock/timeout yields no success/partial changes and preserves bytes/links. | 20.2 AC4,7 | API/DB | R-005,R-007 | 20.2 author |
| 20-P0-18 | Forged/cross-tenant/archived/inaccessible direct context never yields source label/return route/results or automatic global fallback; transient lookup returns retryable no-data state. | 20.3 AC2; FR109-AC10 | API/DB-RLS | R-013 | 20.3 author |

### P1 (High)

**Criteria:** Core or complex behavior with material user reach and limited workaround.
**Purpose:** Cover completeness, contract wiring, resilient user journeys and regressions.

| Test ID | Atomic requirement / variants | Requirement | Test level | Risk link | Owner |
| --- | --- | --- | --- | --- | --- |
| 20-P1-01 | Atomic activation derives one Dokument /files nav from documents/Documents.View; files retains table ownership, documents has zero owner/table/public surfaces, matrix grants only tenant_admin/projektledare and route also requires Files.View. | 20.1 AC1,9 | Unit governance | R-009 | 20.1 author |
| 20-P1-02 | Registry equals manifest active owner set, includes non-creatable quote_version, no pending token facet; future active owner missing source/purpose/SQL/context adapter fails loudly. | 20.1 AC2;20.3 AC6 | Unit registry/coherence | R-009 | 20.1/20.3 authors |
| 20-P1-03 | Safe per-link DTO has only approved metadata; same file/two allowed links returns two link IDs, hidden third absent; no storage/auth/economy/snapshot/role-matrix/signed URL in list. | 20.1 AC4 | Unit projection | R-001 | 20.1 author |
| 20-P1-04 | Ordinary linked/locked eligibility vs draft/orphan/archived/deleted/unknown state/purpose; locks remain visible and quote_version producer purposes both enrolled. | 20.1 AC5 | Unit adapter matrix | R-004 | 20.1 author |
| 20-P1-05 | More candidates than actual PostgREST default cap, hidden-only chunks and equal created_at tuples traverse every authorized row exactly once with created_at DESC,id DESC and no false exhausted page. | 20.1 AC6 | API/DB-RLS | R-010 | 20.1 author |
| 20-P1-06 | Calculation/job stay eligible when optional customer is archived but optional customer label is withheld; facility/contact require live actual ancestry, acceptance quote/version relationships match. | 20.1 AC3,5 | API/DB-RLS | R-001 | 20.1 author |
| 20-P1-07 | Action accepts only exact UUID link_id/file_id pair; rejects extra tenant/path/module/role/TTL/correlation/null/arrays; closed envelope capability gate runs before input/ownership execution. | 20.1 AC7 | Unit command/action contract | R-003 | 20.1 author |
| 20-P1-08 | Fixed access pipeline derives target→prepare→request-bound Storage→validated URL→Documents proof→finalize; no file_id-only/generic/Sales fallback. | 20.1 AC7–8 | Unit command seam | R-002,R-003 | 20.1 author |
| 20-P1-09 | Successful selected-link signing and fresh refresh commit attributable fixed event and validated actual expiry; challenge 5min, DB future tolerance5s, parser skew60s remain distinct; issuance max86400s is not enlarged by validation tolerance. | 20.1 AC7–8 | API/DB | R-003,R-016 | 20.1 author |
| 20-P1-10 | Option A paired baseline: archived-source Documents denial vs preserved generic Files.View/tenant-path raw Storage authority; already-issued bearer lifespan to embedded expiry, generic lifecycle check distinct from raw Storage. | 20.1 AC8,10 | API/DB + Storage | R-016 | 20.1 author |
| 20-P1-11 | Actual allowed nav→/files→supported preview/download→expiry→explicit refresh at desktop and360×640; deny roles/direct route without new entitlement and preserve owner-required upload. | 20.1 AC1,9–10 | E2E real app | R-008,R-015 | QA/20.1 author |
| 20-P1-12 | Query parser rejects duplicates/unknown/mismatched module-type-purpose/mode/invalid ranges; invalid query never becomes unfiltered read; known zero-result selected facet retained. | 20.2 AC1 | Unit filters | R-012 | 20.2 author |
| 20-P1-13 | Trimmed case-insensitive literal substring matches display_name or MIME only; %,_,regex characters literal; AND module/type/purpose/date/mode semantics, no content/PII search. | 20.2 AC1 | Unit filters | R-012 | 20.2 author |
| 20-P1-14 | Gregorian independently optional from/to inclusive date bounds convert Stockholm local midnights correctly across 23h/25h DST days, leap/invalid/reversed dates; never add24UTC hours. | 20.2 AC1 | Unit date bounds | R-012 | 20.2 author |
| 20-P1-15 | Authorized-only facets apply all other filters except own facet; rows/counts/options share lifecycle projection; 50-row filtered keyset pages and checked authorized anchor/filter identity reject malformed/revoked cursor generically. | 20.2 AC1 | API/DB-RLS | R-001,R-010 | 20.2 author |
| 20-P1-16 | Link+file selection token clears URL/content/error on filter/mode/tenant/context change; latest request only can update, unsupported format uses download, denied/transient/expired states distinct. | 20.2 AC2 | Unit preview-state | R-011 | 20.2 author |
| 20-P1-17 | Archived source-authorized metadata never signs even when same file has a different live context; allowed archive affordance respects current/reserved unsent PDF prohibition and lock history. | 20.2 AC2–3,6 | API/DB-RLS | R-004,R-006 | 20.2 author |
| 20-P1-18 | Fresh same-state no-op writes no audit and does not consume correlation; no-op restore C0→changed archive C1→restore C0 rechecks current guards and may become CHANGED, truthfully reports outcome. | 20.2 AC4,7; no-op contract | API/DB | R-007 | 20.2 author |
| 20-P1-19 | Added files origin column can stale whole-row quote review revision; prior proof fails/re-review and content/PDF fingerprint/10.9 guards remain enforced without permissive shape adjustment. | 20.2 AC6; ADR-B008 | API/DB regression | R-004,R-006 | 20.2 author |
| 20-P1-20 | Real search→preview→archive confirmation all-context generic wording→archived metadata→eligible restore→fresh access shows success after persisted transition; forbidden/unknown restore lacks misleading undo. | 20.2 AC8 | E2E real app | R-011,R-015 | QA/20.2 author |
| 20-P1-21 | Response loss/error triggers authorized state reconciliation plus explicit current confirmation; no blind lifecycle retry/stale success; delayed previous selection response cannot render current preview. | 20.2 AC2,8 | E2E controlled response | R-011 | QA/20.2 author |
| 20-P1-22 | Context href fixed /files, exact module/type/UUID tuple and encoded retained validated filters; cursor reset; reject atomic tuple/mapping/duplicate/unknown inputs, no returnTo/open redirect/client label. | 20.3 AC1–2,4 | Unit context URL/parser | R-013 | 20.3 author |
| 20-P1-23 | Seven current source context projections use same authority registry and safe derived local return ancestry; Sales quote-only reference access never grants center/acceptance evidence. | 20.3 AC1–2 | API/DB-RLS | R-001,R-013 | 20.3 author |
| 20-P1-24 | Center query/facets/optional selection constrained to exact owner tuple; same-file other owner cannot substitute; contextual lifecycle still requires ALL links. | 20.3 AC3 | API/DB-RLS | R-002,R-005,R-013 | 20.3 author |
| 20-P1-25 | Real customer/facility/contact, calculation/job, sent locked quote wrapper and acceptance panel links lead to correct context; empty/draft quote wrapper stays null and locked/read-only/upload contracts remain intact. | 20.3 AC1,5,7 | E2E real panels | R-009,R-015 | QA/20.3 author |
| 20-P1-26 | Browser history/server-derived return at desktop/360×640 preserves valid filters/context and focus, clears stale preview; denied context offers explicit neutral center link only, no automatic fallback. | 20.3 AC4,7 | E2E real app | R-013,R-015 | QA/20.3 author |
| 20-P1-27 | Owner picker preselects only validated customer/calculation/job; facility/contact never substitutes parent customer, quote_version stays non-creatable, unsupported picker context returns to shipped entity upload safely. | 20.3 AC5,7 | E2E + existing upload integration regression | R-015 | QA/20.3 author |

### P2 (Medium)

**Criteria:** Secondary presentation/details with narrower reach and acceptable workaround.
**Purpose:** Complete usable states and operational evidence without broadening product scope.

| Test ID | Atomic requirement / variants | Requirement | Test level | Risk link | Owner |
| --- | --- | --- | --- | --- | --- |
| 20-P2-01 | Actual loading, authorized-empty, filtered-empty, invalid filter, read-error/retry and generic unavailable states remain distinct; no hidden IDs/labels in error copy. | 20.1 AC9;20.2 AC8 | E2E state presentation | R-011,R-015 | QA |
| 20-P2-02 | Swedish approved-pattern search/module/type/purpose/date/mode labels and Stockholm date formatting match specified copy; do not label synthetic fixture as observed Lovable behavior. | 20.2 AC1,8 | Unit presentation projection | R-012,R-016 | 20.2 author |
| 20-P2-03 | Selection switches/releases browser references without deleting stored bytes; matching URL refresh controls remain focusable. | 20.2 AC2 | Unit state cleanup | R-011 | 20.2 author |
| 20-P2-04 | Unsupported preview shows authorized download and retained filter/back controls; image/PDF render through established preview components. | 20.1 AC9;20.2 AC2 | E2E format presentation | R-015 | QA |
| 20-P2-05 | Eligible ordinary file origin preserves across same-state archive, restore and later genuine archive; unknown legacy NULL has no fabricated backfill. | 20.2 AC4–5 | API/DB | R-006 | 20.2 author |
| 20-P2-06 | Action pending/disabled state and generic file-wide confirmation omit hidden names/counts; immutable restriction explanation limited to already-visible metadata. | 20.2 AC3,8 | E2E action presentation | R-011,R-015 | QA |
| 20-P2-07 | Authorized contextual empty has validated source heading/return and no hidden-file count implication; unavailable projection contains no tuple/route/label. | 20.3 AC2,4 | Unit context projection | R-013 | 20.3 author |
| 20-P2-08 | Later-source activation fixture requires complete owner/purpose/current-authority/SQL/context/panel/route tests while pending owners remain absent; no pending module is actually activated. | 20.3 AC6 | Unit synthetic manifest fixture | R-009 | 20.3 author |
| 20-P2-09 | Pilot realistic/hidden-heavy beyond-cap traversal records elapsed/read-query/candidate/authorized row metrics and bounded memory/work; no synthetic latency SLO claim. | NFR24–26;20.1 AC6 | Integration measurement | R-010,R-014 | QA |
| 20-P2-10 | Gate report binds SHA, environment, commands, executed/failed/skipped and observed baseline boundary separately; no secret/proof/raw bearer URL in committed evidence. | 20.1 AC10;20.3 AC7;NFR18,41 | Evidence/static check | R-008,R-016 | QA + coordinator |

### P3 (Low)

**Criteria:** Rare/cosmetic presentation with easy workaround.
**Purpose:** Optional supported-browser visual polish; never a replacement for required accessibility.

| Test ID | Atomic requirement | Requirement | Test level | Risk link | Owner |
| --- | --- | --- | --- | --- | --- |
| 20-P3-01 | Long synthetic file names and neutral owner labels wrap/read understandably on supported desktop/phone layout without changing authority. | 20.2 AC8 | Bounded manual visual inspection | R-015 | QA |

### Acceptance traceability

| Story requirement | Primary scenario families |
| --- | --- |
| 20.1 AC1 | P1-01,11 |
| 20.1 AC2 | P1-02,04 |
| 20.1 AC3 | P0-01,02,06; P1-06 |
| 20.1 AC4 | P0-01,03; P1-03 |
| 20.1 AC5 | P0-10,11; P1-04 |
| 20.1 AC6 | P1-05; P2-09 |
| 20.1 AC7 | P0-03–09,11; P1-07–09,11 |
| 20.1 AC8 | P1-10; P2-10 |
| 20.1 AC9 | P1-11; P2-01,04 |
| 20.1 AC10 | All P0 relevant to20.1; P1-01–11; P2-10; regression/gates |
| 20.2 AC1 | P1-12–15; P2-02 |
| 20.2 AC2 | P1-16–17,21; P2-03–04 |
| 20.2 AC3 | P0-12; P1-17,20; P2-06 |
| 20.2 AC4 | P0-15–17; P1-18,20; P2-05 |
| 20.2 AC5 | P0-14–15; P2-05 |
| 20.2 AC6 | P0-10,14–15; P1-19 |
| 20.2 AC7 | P0-12–13,16–17; P1-18 |
| 20.2 AC8 | P1-20–21; P2-01–04,06; P3-01; required focus/mobile journeys |
| 20.3 AC1 | P1-22–23,25 |
| 20.3 AC2 | P0-18; P1-22–23; P2-07 |
| 20.3 AC3 | P1-24 |
| 20.3 AC4 | P1-22,26; P2-07 |
| 20.3 AC5 | P1-25,27 |
| 20.3 AC6 | P1-02; P2-08 |
| 20.3 AC7 | P0-18; P1-23–27; P2-10; real required browser/RLS gates |

All abbreviated IDs above carry prefix20-. FR109-AC1–12 map through the Requirement column and full story AC mapping: activation/enrollment/current authority/context identity/eligibility/traversal/access/lifecycle/restoration/entity links/usable states/evidence. No approved story AC is omitted.

## Execution Strategy

**Run everything in PRs if <15 min; defer only if expensive/long-running.** That is a planning target, not observed timing. Every PR runs functional unit/command/RLS/race/browser coverage plus scope/type/lint/build/containment. Fail fast with a usable-route/checked-access fixture smoke, then critical authority/integrity before remaining functionality; this is scheduler ordering inside the same required gate, not duplicate P0/P1 pipelines.

The existing browser configuration is serial (`workers:1`, shared seeded fixture, production build/start); keep it. Playwright can normally parallelize hundreds of isolated cases into10–15min, but this repo's isolation constraints and existing CI browser budget take precedence. If timing grows, coordinator partitions isolated jobs/resources or improves fixtures; do not skip critical races or increase shared workers speculatively.

| Cadence | Scope |
| --- | --- |
| PR | Every required functional family and listed regression/gate. Required DB suites set SUPABASE_TEST_REQUIRED=1. Production server only, never next dev. |
| Nightly | Additional longer pilot-density measurement/burn-in only when runtime justifies it; all mandatory correctness and beyond-cap checks remain in PR. No load/chaos dependency introduced. |
| Weekly / release rehearsal | Bounded optional supported-browser polish and expensive clean-environment rehearsal when justified. Required migration-from-empty evidence still precedes affected story handoff. |

Record command, exact result SHA, environment identity, executed/failed/skipped counts and artifacts. Retried failures retain diagnostic evidence and are explained; conditional fixme/skips cannot satisfy required cases. Never run CI/tests against demo/production or commit fixture credentials, customer data, raw URL tokens or HMAC proofs.

## Resource Estimates

| Priority | Scenario families | Test development estimate | Included work |
| --- | --- | --- | --- |
| P0 | 18 | ~48–80h | Real source/role/RPC negatives, SQL mirror/proof vectors, transaction barriers, provenance/replay/audit faults |
| P1 | 27 | ~35–60h | Registry/filters/DST/cursors/state contracts, production browser fixtures and journey wiring |
| P2 | 10 | ~10–20h | Additional states/transitions, measured pilot baseline and evidence manifest |
| P3 | 1 | ~2–4h | Bounded synthetic long-label supported-browser polish |
| Total | 56 | **~95–164h; ~3–5weeks equivalent** | Includes reuse/extension of fixtures, setup/debugging and test review, not product/DevOps delivery effort |

Counts are test-design families, not executed counts or code coverage. Actual parameterization increases executable tests; no exact per-test multiplier is claimed. An author also acting as test owner schedules this work with each story. Names/resources are coordinator allocations, not invented commitments.

### Data and Tooling Prerequisites

Use `tests/factories/tenants`, `tests/factories/tenants/files.ts`, `tests/factories/admin-sql.ts`, `tests/factories/audit-events.ts` and `tests/support/test-env.ts` as inspected patterns. Privileged seeding/observation stays test-only; system-under-test reads/actions use real authenticated anon-key clients. Use run-unique IDs and scoped cleanup of the test fixture, without deleting shared services/volumes/profiles.

Data must include seven source kinds/purposes; parent live/archive/missing/reassignment cases; five seeded roles plus anonymous/no-membership/multi-role/changed-role; two tenants; active/locked/archived/unknown-origin/reservation/deleted files; real bytes; generated/reserved/invalidated PDFs and snapshot associations; same file with two allowed/one denied link; independently archived immutable locked link; over-cap hidden candidates/equal timestamps; wildcard strings and Stockholm DST calendar dates. Quote/PDF fixtures use domain provenance or approved test fixture hooks and verify actual constraints, not an impossible seed that bypasses the path being tested.

Node unit loader, Vitest/pg two-session harness and Playwright are already configured. `tea_use_playwright_utils`/`tea_use_pactjs_utils` are true but packages absent in package.json; library-integration mandate requires both flag and installed package. No install or generated executable examples. Pact scaffolding skipped: no E20 independent consumer/provider deployment boundary. **Pact broker: unreachable (SmartBear MCP tools not available). Provider contract requirements derived from repository source/approved checked RPC design; no broker provider states claimed.** Browser exploration skipped under explicit no-launch instruction; future real UI validation remains required.

## Quality Gate Criteria

- **P0:100%; security/integrity and every story-required case:100%, no exceptions.**
- **P1≥95%** general design threshold, but a failed required AC/browser/role/race check still blocks handoff; percentage cannot waive it.
- **P2/P3≥90%** general triage target only. Required lower-priority story behavior is still mandatory; optional P3 omission explicitly recorded.
- **High risk mitigation:100%** complete with actual evidence before release; no author-created waiver. Any new scope/boundary exception requires direct owner decision.
- **Acceptance traceability:100%** of approved ACs; **critical implementation coverage target≥80%** where measured, plus every security/integrity branch family enumerated. No scenario-count-to-code-coverage conversion.
- No open high-severity/consequential reachable defect. Deterministic lint/schema-shape checks remain CI, not repeated review findings.
- All seven adapters, five seeded role sets, two tenants, actual panel paths and both viewports have positive executed evidence. Required tests skipped/fixme/unavailable are missing coverage.
- Migration/catalog/ACL/SQL authority and clean-schema evidence collected for affected additive schema units; no historic migration rewrite.
- Later `nfr-assess` evaluates collected evidence and unknowns; this workflow assigns no final implementation PASS/CONCERNS/FAIL.

## Mitigation Plans and Ownership

All plans are **Planned**; the risk table sets owner and due story handoff. Verification references the coverage IDs and required suites below.

| Risk | Implementation/test mitigation sequence | Verification required / residual |
| --- | --- | --- |
| R-001 | Establish active-source registry and source-live matrix; use request-bound RLS projection; independently recheck wrapper authority; withhold safe DTO fields/counts/labels before filtering. | P0-01–02 and seven-role/source RLS cases; baseline generic file SELECT is not claimed source-filtered. |
| R-002 | Lock current authority at checked prepare/finalize; reconcile exact selected link and locked graph; prove before/after-finalization mutation interleavings with transaction barriers. | P0-03,05–06; lock wait/commit ordering plus resulting audit/denial. Later bearer consumption remains outside transaction. |
| R-003 | Fix command/RPC ACLs and distinct domain-bound proof; match TS/SQL canonical bytes; use actual expiry/hash; audit only after checked finalization; consume one correlation. | P0-04,07–09; no external helper/key grant, no generic/quote proof substitution, no URL on failure. |
| R-004 | Select provenance by artifact_kind; require exact current PDF and immutable attachment association; retain existing invalidation/irreversible PDF archive guard. | P0-10–11, P1-19; actual ordinary-purpose adversarial link; review-proofs may stale after schema change and must fail closed. |
| R-005 | Lock file FOR UPDATE before complete-link set; acquire current authority graph in deterministic order, reread complete population and reconcile references; transition/audit atomically. | P0-12–13,17; two-connection FK insert/source mutation evidence. Generic postcommit link creation remains baseline residual. |
| R-006 | DB-owned ordinary linked-origin capture only; retain immutable lock history including archived links; apply complete restore/provenance matrix; no byte/link resurrection. | P0-14–15; metadata/bytes/hash/locked fields unchanged, all quote_pdf restores denied, unknown legacy origin unavailable. |
| R-007 | Under file lock consume historical committed CHANGED identity and fixed selected-link digest; reject opposite-state replays DLC20; distinguish fresh unconsumed no-op; rollback audit faults. | P0-16–17/P1-18; changed-replay and fresh no-op histories both tested; no all-operation exactly-once claim. |
| R-008 | Require services/fixtures and positive execution counts; remove/replace required preview skips with actual fixture/expiry evidence; bind exact SHA/environment/counts; independent author/reviewer separation. | Collected reports for every required suite and real browser surfaces. No planning/source/mock evidence counted as runtime. |
| R-013 | Validate atomic source tuple using current registry/RLS; emit safe context state and fixed local return from live ancestry; fail closed with no global fallback; keep uploads contextual. | P0-18/P1-22–27; real source wrappers and forged direct queries. Optional neutral center-root link is explicit user navigation only. |

## Assumptions and Dependencies

1. Approved specs and selected-link contract are authoritative over stale early-checkpoint blocker wording; root supplied preparation closure/Option A/oracle disposition. No oracle observations or product runtime results are inferred.
2. At planning base exactly seven active file owners: crm customer/facility/contact; calculation; quote_version/quote_acceptance; job. Jobs uses Jobs.ViewAll, not ungranted Jobs.ViewAssigned. Current Documents/File role ceiling remains tenant_admin/projektledare; multi-role union follows existing matrix.
3. Legacy generic/direct authority and issued-URL limits are accepted; no global byte-revocation claim or generic policy repair is introduced.
4. Test fixtures can use privileged setup/inspection only locally, while tested actions use actual actor authority. No test resource is assumed ready by this document.
5. Existing utilities are absent; preserve current runners and dependencies. No Pact broker/tool/data or mobile runner requirement is fabricated.
6. If newer integrated source changes owner/purpose/matrix/locking/panel interfaces, coordinator refreshes this plan/claims against that actual base before the affected worker; do not silently consume unmerged APIs.
7. QA owner/reviewer capacity and exact calendar scheduling remain coordinator allocations. Effort estimates include setup uncertainty; if constraints grow, extend estimate/isolation rather than remove required coverage.

## Implementation and Check Handoff

Separate admitted story authors build the following **planned** files/suites. Filenames and check identities are fixed by the approved specs; this workflow creates no tests or migrations.

| Story | Check identity | Test paths (repository relative) |
| --- | --- | --- |
| 20.1 | documents-source-unit | tests/unit/server/read-models/documents.test.ts; document-sources.test.ts |
| 20.1 | documents-selected-link-unit | tests/unit/server/storage/document-signed-access-attestation.test.ts; tests/unit/server/commands/documents-signed-access.test.ts |
| 20.1 | documents-integration-rls | tests/integration/rls/documents.rls.test.ts; tests/integration/commands/documents-signed-access.int.test.ts |
| 20.1 | documents-selected-link-lock-races-integration | tests/integration/commands/documents-signed-access-lock-races.int.test.ts |
| 20.1 | documents-browser | tests/e2e/files/documents.e2e.spec.ts plus existing file-index-scope.e2e.spec.ts and entity-file-preview.e2e.spec.ts |
| 20.2 | documents20-2-filter-unit | tests/unit/features/documents/filters.test.ts; date-bounds.test.ts; preview-state.test.ts; tests/unit/server/commands/documents-lifecycle.test.ts |
| 20.2 | documents20-2-lifecycle-integration | tests/integration/commands/documents-lifecycle.int.test.ts; documents-lifecycle-lock-races.int.test.ts; tests/integration/rls/documents-filter-archive.rls.test.ts |
| 20.2 | documents20-2-browser | tests/e2e/files/documents-search-preview-lifecycle.e2e.spec.ts |
| 20.3 | documents20-3-context-unit | tests/unit/features/documents/context-navigation.test.ts; tests/unit/server/read-models/document-context.test.ts; tests/unit/components/documents/entity-documents-link.test.ts |
| 20.3 | documents20-3-context-integration | tests/integration/rls/documents-context.rls.test.ts |
| 20.3 | documents20-3-browser | tests/e2e/files/documents-context-navigation.e2e.spec.ts |

Same-directory abbreviated filenames in table resolve from the first full path in that cell. Use the exact corresponding approved-spec argv:

- Unit focused groups: `node --experimental-strip-types --import ./tests/support/register.mjs --test <listed unit paths>`.
- DB focused groups: `pnpm exec vitest run <listed integration/RLS paths>`; set `SUPABASE_TEST_REQUIRED=1`, retain positive execution and zero required skips.
- Browser groups: `pnpm exec playwright test <listed e2e paths>`; configured production webServer and real local fixtures, both viewport sizes.
- Existing files-signed-access-integration: `pnpm exec vitest run tests/integration/commands/file-signed-access.int.test.ts tests/integration/commands/file-signed-access-refresh.int.test.ts`.
- documents-baseline-storage-boundary: `pnpm exec vitest run tests/integration/rls/documents.rls.test.ts tests/integration/commands/documents-signed-access.int.test.ts tests/integration/commands/file-signed-access.int.test.ts tests/integration/commands/file-signed-access-refresh.int.test.ts`; preserved baseline and selected-source denial are distinct expectations, not duplicate invented suites.
- General gates: `pnpm run test:unit`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`, `pnpm run verify:service-role-containment`, `pnpm run verify:bundle-containment` after build, and `pnpm run verify:lockfiles`; CI scope/nav/matrix/tenant-table/deferred-token/command checks remain derived and retained.
- Future migrations: reserved20.1 `20261009091120_story_20_1_documents_selected_link_access.sql` (function/ACL unit) and20.2 `20261009091121_story_20_2_documents_lifecycle_origin_and_restore.sql` (bounded origin/RPC unit), CLI-first empty/unapplied creation then reviewed local rename per approved checkpoint, only after admitted schema ownership. No migration created here;20.3 has none.

Persist future results under test-artifacts using isolated story-owned names, with trace/report links and sanitized failure evidence. Each story's implementation author owns its verified Suggested Review Order; independent reviewer judges actual changed entry→authority→transaction→Storage paths at Sol High. Coordinator owns combined integration evidence, aggregate state and final gate routing.

## Interworking and Regression

| Component | Impact and mandatory regression |
| --- | --- |
| Files upload/links/lifecycle | Preserve owner-required uploads, existing owner picker, immutable bytes/lock fields and generic authority. Existing file-upload, file-link-ownership, file-link-lock, file-audit-events integration and file-link-lock/file-index-isolation RLS suites; entity-file-panel/file-lock-panel browser journeys. |
| Generic checked signing / direct Storage | file-signed-access and file-signed-access-refresh suites retain attributable post-sign audit and lifecycle behavior; new Documents boundary cases explicitly preserve Option A. No generic policy/proof/domain edits implied. |
| Quotes/acceptance/Sales broker | quote-review-authorization, quote-pdf-validity, generated PDF source-of-truth/retry/storage-privacy/determinism suites; quote PDF state browser coverage; sent snapshots, exact attachment associations, acceptance direct RLS and narrow Sales broker unchanged. Existing10.9 downstream invalidation counts as an enforced validator; do not invent a reachable stale-PDF bypass. |
| Manifest/nav/matrix/envelope | manifest coherence/derivation, nav expected-set, permission negative harness and closed command registry; Documents activation same PR; no pending owner facet or duplicate destination. Serialized coordinator claims. |
| CRM/calculations/jobs/quote panels | Existing detail/file/upload authority and live ancestry; real20.3 links at approved paths, adjacent locked sent wrapper stays read-only/null for draft, no unsupported panel creation. |
| Existing review proofs/source revision |20.2 whole-row files serialization change may invalidate outstanding quote-review proof; stale proof must reject/re-review, preserving content/PDF validity guard. |
| E15/other active streams | Root coordinates shared panels/governance/schema/test resources. E20 test author edits no other epic or orchestration/anchor/aggregate state; integration is coordinator-owned. |

Regression scope is bounded to affected surfaces and approved story requirements, not a broad unrelated implementation audit. Legacy comments saying RED/skipped/CLI lifecycle are historical data; inspect executable checks and current governance before treating them as instructions/evidence.

## Follow-on Workflows and Epic Completion

This design is ready for **separately dispatched** `/bmad-testarch-atdd` using P0 families, then admitted20.1→20.2→20.3 implementation/test expansion. No ATDD/automate/build workflow auto-runs from this document. Coordinator retains independent review and all required tests.

Final E20 closure requires the coordinator's complete three-story integrated checks plus `trace`, `nfr-assess`, `test-review`, retrospective and applicable checkpoint gates. Test plan completion is not epic/product completion or full B2 readiness. Team risk review, allocation and any later numerical performance decision are coordinator/owner work; no reviewer/approver signatures or scheduled dates are invented.

## Approval and Validation Record

Approved source requirements and Option A/oracle disposition are supplied by the coordinator. This deliverable is author-validated against the installed epic-level checklist; independent acceptance/release approval is **pending external evidence**, not self-certified.

Checklist scope: epic prerequisites complete; current spec ACs atomically mapped; 16 unique scored risks with owners/timelines/residuals; 9 high mitigation plans; in-scope NFR thresholds/evidence/UNKNOWN gaps; 56 unique priority families; PR/nightly/weekly execution, range estimates, data/tool/environment needs, entry/exit/gates, regression and separate-workflow handoff present. Optional/system-level two-document/handoff and Pact scaffolding criteria are not applicable. No browser session exists to clean up; no runtime test was performed. Progress checkpoint records all five steps completed and points to this output.

Quality & Testing Progress is recorded only in this E20 document/checkpoint. Sprint, Auto-BMAD state, claims, anchor and coordinator orchestration are untouched.

## Appendix — References

- Canonical [20.1 spec](../implementation-artifacts/spec-20-1-documents-activation-and-source-authorized-aggregation.md), [20.2 spec](../implementation-artifacts/spec-20-2-search-filters-preview-and-archive-restore.md), [20.3 spec](../implementation-artifacts/spec-20-3-entity-panel-links-and-contextual-navigation.md).
- [Phase B PRD](../planning-artifacts/prd-phase-b.md) FR109/NFR42–44,51,53,56; carried [Phase A NFR spine](../planning-artifacts/prd.md) and current amended31; [E20 epics](../planning-artifacts/epics-phase-b.md).
- [Architecture](../planning-artifacts/architecture-phase-b.md) §§9.3,12; [early E20 checkpoint](../planning-artifacts/early-b2-documents-checkpoint-2026-10-07.md) FR109-AC1–12, superseded readiness/oracle conditions per current approved specs.
- [Source authorization](../auto-bmad/preparation/story-20-1/source-authorization-design.md), [selected-link contract](../auto-bmad/preparation/story-20-1/selected-link-contract-design.md), [cross-story handoffs](../auto-bmad/preparation/story-20-1/cross-story-handoffs.md).
- [ADR-B008](../../docs/decisions/ADR-B008-quote-review-authority-and-derived-artifact-validity.md), [ADR-B013](../../docs/decisions/ADR-B013-kopplas-product-name-and-compatibility.md), [routing policy](../../docs/process/agent-model-routing.md), [local setup](../../docs/process/local-setup.md).
- Historical system-level test-design-architecture.md/test-design-qa.md were consulted as baseline data; current approved Phase B/spec/resource governance supersedes obsolete scope/setup assumptions.
- Installed skill knowledge: risk-governance.md (risk ownership/gates), probability-impact.md (P×I), test-levels-framework.md (smallest effective level), test-priorities-matrix.md (priority independent of timing/risk action), nfr-criteria.md (threshold/evidence planning), library-integration-mandate.md and playwright-utils-mandate.md (flag+installed gates), Pact relevance/mandate and pact-mcp.md (free single tool-list probe/degradation), browser CLI guidance (no session launched).
- Supabase skill security guidance consulted only for boundary awareness; this is no Supabase feature implementation, advisor run, changelog compatibility check or schema query claim.

**Generated by:** BMad TEA delegate — `bmad-testarch-test-design`, Epic-Level Create workflow.  
**Completion date:** 2026-10-09.



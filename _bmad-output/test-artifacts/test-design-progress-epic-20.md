---
runScope: 'epic-level'
runKey: 'epic-20'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-10-09'
pact_mcp_reachable: false
outputDocument: '_bmad-output/test-artifacts/test-design-epic-20.md'
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
# Epic 20 test-design progress

## Step 1 — Detect mode
Create (C); epic-level; epic_num=20. No existing epic-20 checkpoint. Canonical specs 20.1, 20.2 and 20.3 exist with complete acceptance criteria. Requirements/design preparation is accepted; implementation and runtime evidence are not present. Scope: Documents only, approved Phase B, Option A, no resource launches, product/spec/aggregate edits or Git mutations. Route: gpt-6.1-sol High for authorization and transactional integrity, per docs/process/agent-model-routing.md.

Workflow customization: uv resolver failed due to sandbox uv-cache access; fallback read default customize.toml. No team override was present; personal override check is pending in context step. Defaults contain no prepend/append/persistent facts/on_complete steps. User Rasmus; communication/output English; test_artifacts is _bmad-output/test-artifacts.

## Step 2 — Context and inputs
Personal/team customization overrides absent; defaults resolved completely. User Rasmus, English. Detected stack: frontend with Next.js server commands and Supabase database/storage integration (full-stack testing responsibility). Existing package runners: Node unit, Vitest integration/RLS, Playwright real production server; workers=1 and shared seeded fixture. Scope remains E20.

Inputs loaded: approved spec-20-1, spec-20-2, spec-20-3; Phase B PRD FR109/NFR amendments; Phase A carried NFR spine; Phase B epics E20; architecture-phase-b §§9.3,12; early B2 Documents checkpoint; source-authorization-design; selected-link-contract-design; cross-story-handoffs; historical system test-design architecture/QA; ADR-B013; AGENTS/model routing; local-setup; package.json, playwright.config.ts; bounded file tests/factories/support patterns. Historical pre-readiness blockers are superseded by approved current specs and the 2026-10-09 owner disposition; no readiness/implementation evidence inferred.

Knowledge: tea-index; risk-governance, probability-impact, test-levels-framework, test-priorities-matrix, nfr-criteria; library-integration-mandate, playwright-utils-mandate, overview; Pact mandate/relevance and pact-mcp; browser CLI guidance. Flags true but utility packages absent: apply library mandate's two-gate rule, retain existing harness, no library install or executable code samples. No E20 independent consumer/provider deployment boundary or Pact package/artifacts identified; no Pact artifacts. pact_mcp_reachable=false (tool-list probe once). Pact broker unreachable (SmartBear MCP tools not available); approved provider/source contracts are the authority, no broker states invented. Browser exploration omitted under explicit no-resource-launch instruction and zero current implementation/oracle observations. No missing requirement blocks design; pilot numerical latency/load thresholds remain UNKNOWN for NFR planning.

Coverage gaps: new Documents read/adapters, selected-link command/RPC/HMAC/races, filter/archive-origin/full-graph lifecycle, context validation and real E20 browser journeys do not yet exist. Existing generic signing/lifecycle/quote invalidation tests are regression requirements, not selected-source coverage. Historical test comments/fixture labels do not prove execution or oracle parity; required preview skips must be resolved during implementation. Configured serial fixture prevents unapproved parallel E2E execution.

## Step 3 — Risk and NFR planning

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

NFR scope: security/privacy (zero unauthorized selected-source disclosures/grants; NFR1–8,17–19,42–44,51), integrity/reliability (atomic audit, immutable provenance, truthful retry; NFR7,11–12,23,56), usability (NFR30/amended31/53 at 360×640), maintainability/evidence (NFR35–41,51), pilot responsiveness (NFR24–26). Known numeric contracts: page size50; URL default300s/cap86400s; proof challenge5min and DB future tolerance5s. Pilot numerical latency/concurrency/data-volume target UNKNOWN; no external-beta load or legal retention program implied. Later nfr-assess consumes test reports, catalog/containment scans, audit snapshots, traces and pilot measurement. No final NFR assessment.

## Step 4 — Coverage and strategy

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

Execution: all functional/gate coverage in PR, existing production server and serial fixture; fail fast on smoke/security then full run without redundant priority pipelines. Nightly/weekly only justified expensive measurements/burn-in or manual polish. No required functional/RLS race test deferred solely for time. Estimates P0~48–80h, P1~35–60h, P2~10–20h, P3~2–4h; total~95–164h / ~3–5weeks one test owner, including fixtures/barriers/setup. Quality gate:100% P0 and all mandatory security/integrity/browser coverage; P1>=95% design target never waives story-required cases; P2/P3>=90% indicative only; all approved AC traceability100%, measured critical code coverage>=80% where instrumented; nine high risks mitigated with actual evidence, zero skipped required suites. NFR evidence/final assessment deferred. Explicitly no runtime tests launched.

## Step 5 — Output and validation

Completed Epic-Level Create workflow, single-worker output. Config execution_mode=auto/capability_probe=true; delegation capability exists but epic-level has one output and remains single-worker by default. No nested delegate required or launched. Output: C:/Users/Rasmus/.codex/worktrees/dbe6/ElproSaas/_bmad-output/test-artifacts/test-design-epic-20.md. All five steps saved; no other scope checkpoint merged.

Validation completed2026-10-09:428-line complete template-adapted plan;16 unique risk register rows with correct P×I,9 high/6 medium/1 low;56 unique scenario families (18P0,27P1,10P2,1P3); all25 approved story ACs and FR109-AC1–12 traced; all linked local Markdown references resolve; no unfilled template placeholders; no executable code examples/library deviations. Range estimates/gates/NFR UNKNOWN numeric pilot thresholds/entry-exit/dependency/migration/regression/final workflow handoffs present. Checklist's simpler PR/nightly/weekly strategy supersedes old template's redundant priority execution tiers. System-level optional handoff/approval signatures/team scheduling/Pact scaffolding not applicable or explicitly unclaimed. git diff --check returned success for owned paths (untracked deliverables additionally inspected). No product/runtime test, service/browser launch, customer/oracle observation or product/spec/aggregate/anchor/orchestration/Git mutation performed.

On-complete resolver invoked with --no-cache but failed on sandbox interpreter-temp persistence access; no hook executed. Complete structural fallback resolved empty on_complete and no overrides. This is a nonblocking tooling limitation, not a missing test-design gate.

Quality & Testing Progress: E20 epic test design complete, output/checkpoint only. Independent review, ATDD/build, actual database/browser tests and combined integrated evidence are later coordinator-owned work. Numerical latency/concurrency/volume threshold remains UNKNOWN for any future SLO claim; owner/QA allocation is not fabricated. Plan ready for separately dispatched ATDD/approved worker setup; no current design blockers.

---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-09-17'
runScope: 'epic-level'
runKey: 'epic-12'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics-phase-b.md'
  - '_bmad-output/planning-artifacts/prd-phase-b.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - '_bmad-output/test-artifacts/test-design-architecture.md'
  - '_bmad-output/test-artifacts/test-design-qa.md'
  - '_bmad-output/test-artifacts/test-design-epic-11.md'
  - 'src/scope/manifest.ts'
  - 'tests/README.md'
---

# Test Design: Epic 12 — Tenant Provisioning and Onboarding

**Date:** 2026-09-17  
**Author:** Rasmus  
**Status:** Draft  
**Generated:** 2026-09-17T15:37:05+02:00

---

## Executive Summary

**Scope:** Epic-level test design for Epic 12 and Stories 12.1–12.3: platform-operator identity, the bounded tenant-provisioning command, the isolated operator console, and the first-Admin onboarding checklist.

The plan treats provisioning as a privileged product boundary, not ordinary CRUD. Exhaustive authorization, transaction, recovery, and isolation permutations sit at unit/DB/command/static levels. Browser coverage stays thin: one operator authorization/resume journey and one full second-tenant journey prove the user-visible outcomes without duplicating lower-level logic.

**Risk Summary:**

- Total risks identified: 13
- High-priority risks (score ≥6): 9
- One score-9 release risk requiring green evidence: recovery across the owner-defined database-commit/Supabase-Auth-invite boundary
- Critical categories: security, data integrity, business-state truthfulness

**Coverage Summary:**

- P0: 27 atomic scenario groups (~60–95 hours)
- P1: 7 atomic scenario groups (~24–40 hours)
- P2: 1 atomic scenario group (~4–8 hours)
- P3: 1 non-gating baseline (~3–6 hours)
- **Total:** 36 groups, ~91–149 hours (approximately 2.5–4 person-weeks, depending on fixture reuse and reconciliation complexity)

The high P0 proportion is deliberate: most Epic 12 behavior is privileged creation, tenant isolation, or durable recovery with no safe workaround. Test priority is separate from execution timing; the PR lane should still run all functional coverage while it remains below 15 minutes.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| Public/self-serve tenant signup | Permanently excluded by FR76/N-2; operator provisioning is the only Phase B entry. | Fail-loud route, copy, nav, and API scope scans. |
| Separate operator deployment | Explicit Phase C hardening option; Phase B uses isolated route territory in the same app. | Import/shell-isolation checks and route-level authorization on every server entry. |
| AI provisioning, AI-authored SQL, or general AI database access | Phase B provisioning is a deterministic bounded operator service; free-text agent instructions and AI product flow are excluded. | Strict request-schema tests, no-generated-SQL/free-text guard, single write-path/catalog inventory. |
| Additional SECURITY DEFINER/general service-role write surfaces | Story 12.1 sanctions only narrow `provision_tenant` actions under normal operator JWT plus server HMAC; a legacy delegate, custom provisioning JWT, second callable writer, owner-role membership, or service-role provisioning DML/call violates Decision 8A. | Catalog/source/grant inventory fails on every forbidden authority path. |
| Commercial price/packaging logic | Subscription terms and overrides are tenant data, never hardcoded application decisions. | Persistence assertions and hardcoded-commercial-value scan. |
| New onboarding settings schema/table | Checklist derives from existing Phase A settings, pricing, and membership state. | Schema/table inventory and migration reset checks. |
| Load/SLO release gate | No latency, throughput, tenant-count, or concurrency threshold is specified. | Record a non-gating pilot baseline; do not invent a PASS threshold. |
| Routine external email-delivery proof | Epic 12 consumes the existing Epic 11 invitation boundary; external delivery is configuration-dependent. | Assert controlled local Auth/invite state; run hosted transport smoke only when Auth template/redirect config changes. |

---

## Risk Assessment

Risk score is probability × impact on a 1–3 scale. Scores 6–8 require mitigation; score 9 blocks completion until mitigated or formally waived. Priority is assigned separately from risk score.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| R-1201 | SEC | `provision_tenant`, its owner/grants, attestation verifier, `is_platform_operator()`, or the platform capability is mis-hardened, enabling search-path/grant escalation, forged/replayed/wrong-domain proof, Vault over-read, legacy/service-role fallback, or a tenant-grantable platform row. | 2 | 3 | 6 | Pin owner/grants/action/HMAC projection; prove dual proof, generic zero-write negatives, filtered Vault, absent fallback/DML, and platform exclusion. | Dev + QA + Security reviewer | Story 12.1 before merge |
| R-1202 | DATA | DB creation succeeds while Auth response is lost, or reservation/outcome/token/readiness logic duplicates dispatch, trusts caller identity, accepts a stale outcome, leaves an older link live, or declares success prematurely. | 3 | 3 | 9 | Enforce signed reserve-before-call/exact-generation outcome, durable-fact provider input, exact states/readiness, provider-free reconciliation, fresh hash-only token per dispatch, one call per retry, three attempts per approval generation, and no `unknown` auto-resend. | Dev + QA | Story 12.1 before Story 12.2 depends on it |
| R-1203 | DATA | Repeated or concurrent same-organization requests create duplicate tenants, memberships, invite intents, or implicit provider calls. | 2 | 3 | 6 | Enforce all-status uniqueness on `(country_code, normalized_organization_number)` plus independent request UUID/hash idempotency; make replay reconciliation-first and test every replay/conflict/race/provider-call branch. | Dev + QA | Story 12.1 before merge |
| R-1204 | SEC | Operator console/read models expose customer, quote, file, money, or other tenant business data. | 2 | 3 | 6 | Exact allow-listed projection plus field/value absence tests through every read entry. | Dev + QA + Security reviewer | Story 12.2 before merge |
| R-1205 | SEC | Authorization is enforced only by layout/navigation, allowing direct server-route/action access. | 2 | 3 | 6 | Independently gate every server entry and enumerate operator, tenant-role, orphan, and anonymous callers. | Dev + QA | Story 12.2 before merge |
| R-1206 | SEC | Auth-admin/service credentials or invite capability become client-reachable, RPC-reachable, or unauthenticated. | 2 | 3 | 6 | Server-only adapter plus source/bundle/service-role containment bite proofs. | Dev + Security reviewer | Story 12.1 before merge |
| R-1207 | BUS | The checklist reports working-state completion while one or more authoritative settings/pricing/user states remain incomplete. | 2 | 3 | 6 | One falsifiable server-derived predicate per item plus aggregate and end-to-end persisted-state proof. | Product + Dev + QA | Story 12.3 before merge |
| R-1208 | SEC | Provisioning/errors/audit summaries leak foreign organization, tenant, user, or business-data existence. | 2 | 3 | 6 | Generic envelopes, exact field absence, two-tenant canaries, and unchanged foreign-row digests. | Dev + QA + Security reviewer | Stories 12.1–12.2 |
| R-1209 | BUS | Public signup or hardcoded commercial prices/discounts slip into the shipped surface. | 2 | 3 | 6 | Route/copy/import/value scans; assert subscription/commercial values are request data persisted per tenant. | Product + Dev + Scope reviewer | Across Epic 12; gate at epic completion |
| R-1214 | SEC/DATA | TypeScript-only or mutable runtime baseline data diverges from the database execution authority, allowing preview/execution mismatch or unauthorized catalogue edits. | 2 | 3 | 6 | Migration-owned insert-only catalogue, zero runtime DML, canonical hash checks, and mandatory DB/TypeScript coherence tests. | Dev + QA + Security reviewer | Story 12.1 before merge |

### Medium-Priority Risks (Score 3–4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| R-1210 | OPS | Audit records omit actor/approver/catalogue/attempt/reconciliation/outcome, expose a raw invitation token, or survive incorrectly after rollback. | 2 | 2 | 4 | Audit atomicity, retry correlation, terminal-outcome uniqueness, exact baseline/attempt facts, and raw-token/secret-absence assertions. | Dev + QA |
| R-1211 | TECH | Wizard resume state follows browser clicks instead of durable server state, producing stale or impossible steps. | 2 | 2 | 4 | Derive steps from server state and test reload, new session, failure, completion, and replay. | Dev + QA |
| R-1212 | OPS | End-to-end provisioning is flaky/destructive because of shared state, external email dependence, or incomplete cleanup. | 2 | 2 | 4 | Unique cleanup-aware local factories, controlled Auth evidence, and executed/skip-count reconciliation. | QA + Dev |

### Low-Priority Risks (Score 1–2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | ---: | ---: | ---: | --- |
| R-1213 | PERF | Provisioning/console latency and supported scale have no numeric threshold. | 1 | 2 | 2 | Record a documented pilot baseline; keep the release threshold UNKNOWN. |

### Risk Category Legend

- **TECH:** architecture, integration, maintainability, or scalability flaws
- **SEC:** authorization, privileged access, tenant isolation, or data exposure
- **PERF:** latency, throughput, load, or resource limits
- **DATA:** loss, duplication, corruption, partial state, or inconsistent recovery
- **BUS:** product-delivery, scope, or user-visible correctness impact
- **OPS:** configuration, auditability, environment, or test-operation reliability

### Residual Risk

After the planned mitigations, residual risk remains at the external Auth transport boundary and at future tenant scale. Local tests can prove request/state/retry correctness but not routine external email delivery, and the project currently has no owner-approved latency or scale SLO. These cannot be reported as PASS by this plan; external transport smoke remains configuration-triggered, and performance stays a measured baseline until a threshold is approved.

---

## NFR Planning

This section plans validation and evidence for later `nfr-assess`; it does not assign final PASS/CONCERNS/FAIL status.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| --- | --- | --- | --- | --- |
| Security / tenant isolation | NFR54: zero cross-tenant leakage; generic denial for non-operators/forged/absent claims; console exposes identity/status/first-Admin state only. | R-1201, R-1204–R-1206, R-1208 | DB/RLS/catalog negatives, direct-route authorization, exact field absence, containment scans, two-tenant E2E. | Vitest executed/pass/skip report, catalog/grant snapshot, scan logs, Playwright report/trace, canary absence/digest assertions. |
| Security / privileged DB | Exactly one public authenticated Epic 12 DEFINER writer under normal operator JWT; every mutation also has valid ≤2-minute domain-separated HMAC. Dedicated NOLOGIN/NOINHERIT owner, exact authenticated EXECUTE, filtered Vault, and no PUBLIC/anon/authenticator/service_role execution/DML, legacy delegate, custom JWT, or second writer. `Platform.Operator.Access` remains non-granting. | R-1201 | Catalog/grant/action/owner inspection, full HMAC negative matrix, Vault-filter proof, direct RPC negatives, service-role containment, permission/manifest coherence, DEFINER inventory. | Catalog/grant output, zero-write evidence, matrix/manifest snapshots, integration/static reports. |
| Reliability / recovery | Atomic DB creation, dual idempotency, zero-write preview, database-catalogue binding, signed reserve-before-provider/exact-generation outcome, and exact state recovery. Replay/reconciliation never rotate/dispatch; each explicit resend gets one fresh token and one call; three dispatches fit one signed approval generation and the fourth requires a new one. | R-1202, R-1203, R-1211 | Fault injection, concurrency, provider-call counting, durable-fact input capture, token-hash change/revocation, stale/out-of-order outcome negatives, and signed fourth-dispatch approval. | Failure matrix, row digests, reservation/generation correlation, token-hash evidence, retry report. |
| Data integrity | One tenant/first-Admin membership per all-status canonical `SE` identity; exact email/VAT; request conflicts never update; migration-owned insert-only catalogue persists exactly and matches TypeScript; no foreign mutation; subscription terms persist exactly. | R-1202, R-1203, R-1208, R-1214 | Canonicalization cases, catalogue hash/immutability/DML-denial/coherence, constraints/concurrency, exact persistence, cross-tenant digests. | Constraint/catalogue evidence, DB/TS coherence report, fixture snapshots, concurrency output. |
| Audit/compliance | Execution and every handoff transition record tenant, operator-derived approver, approval time/generation, request ID, preview hash, baseline ID/version/content hash, reservation/dispatch generation, attempt, reconciliation action, outcome, and sanitized failure facts without credentials, raw tokens, HMAC attestations, or secret material; dry run records nothing. | R-1210 | Preview non-write, transition/rollback audit assertions and raw-token/attestation/secret scans. | Audit evidence keyed by request/tenant plus before/after dry-run snapshot and scan output. |
| User journey / truthfulness | AC-B1a-1 and AC-PH-3: create → baseline → invite → onboarding working state with zero engineering steps and no false-green checklist state. | R-1207 | Predicate units, tenant-scoped read integration, one full persisted-state E2E. | Unit/integration reports and production-server Playwright trace/report. |
| Maintainability / scope | Operator shell isolation; no public signup, extra DEFINER, onboarding table/new settings schema, or hardcoded commercial values. | R-1206, R-1209 | Import, route/copy, catalog, manifest, schema, bundle, and commercial-value guardrails. | CI scan logs, manifest coherence output, migration-reset/catalog report. |
| Performance / scalability | Numeric latency, throughput, tenant count, and concurrency threshold: **UNKNOWN**. | R-1213 | Record non-gating elapsed/query-count baseline on a documented pilot dataset. | Versioned baseline with dataset size, environment, and query counts. |

**Unknown thresholds and out-of-scope operational policy:**

- Performance/scalability release thresholds are UNKNOWN; no value may be invented.
- Audit retention duration/operational SLO is outside this epic; this plan validates content, binding, and atomicity only.

The 2026-09-17 and 2026-09-19 owner contract through Decision 8A resolves all intent-gap rounds: identity, preview/approval, strict schema, dual JWT/HMAC mutation authority, least-privilege ownership/grants, migration-owned catalogue/TypeScript coherence, signed reservation/outcome, hashed token lifecycle, replay/attempt policy, canonicalization, readiness, and platform permission classification. The scenarios below bind to that superseding contract.

---

## Entry Criteria

- [x] Story 12.1 defines normalized identity, canonicalization, dual idempotency, migration-owned catalogue/TypeScript coherence, durable state/readiness, strict-v1/write-nothing preview, signed monotonic approval generation, sole normal-JWT/server-HMAC RPC authority, least-privilege owner/grants, signed dispatch reservation/outcome, hashed Epic 11 tokens, bounded provider-free replay/retry, and non-granting platform classification (owner decisions through 8A, 2026-09-19).
- [ ] Epic 11 role, invitation, callback, and Admin-user lifecycle seams are green.
- [ ] Disposable local Supabase resets from empty and required DB suites run with `SUPABASE_TEST_REQUIRED=1`.
- [ ] Operator/two-tenant/first-Admin factories are unique, cleanup-aware, and local-only.
- [ ] Production-server Playwright is available through the configured `webServer`; `next dev` is not substituted.
- [ ] Eventual route names, selectors, and DTO fields are read from implemented code rather than invented from this plan.

## Exit Criteria

- [ ] P0 pass rate is 100%; P1 pass rate is at least 95% with every failure triaged.
- [ ] Required DB/RLS/command/browser skips are zero and executed counts reconcile with discovery.
- [ ] R-1202 is mitigated with green fault-injection and reconciliation evidence.
- [ ] Every score-6 risk has green automated evidence or a formal, owner-approved, time-bounded waiver.
- [ ] FR73–FR76, NFR54, AC-B1a-1, AC-PH-3, and every story acceptance criterion have mapped automated coverage.
- [ ] No open P0/P1 or high-severity security, isolation, data-integrity, or false-success defect remains.
- [ ] No forbidden public signup, business-data operator read, client-reachable privileged credential, extra DEFINER, new onboarding schema/table, or hardcoded commercial price exists.
- [ ] NFR evidence is ready for `nfr-assess`; this document itself does not claim final NFR status.

---

## Test Coverage Plan

**P0/P1/P2/P3 are priority, not execution timing.** All functional coverage runs in PRs while the complete lane remains below 15 minutes. Atomic scenarios below avoid duplicate coverage: pure predicates/algorithms are unit-tested, persistence and security are DB/command-tested, forbidden structure is scanned, and E2E proves only critical user journeys.

### P0 — Critical

**Criteria:** Security, tenant isolation, data integrity, or core provisioning outcome with no safe workaround.

| Test ID | Requirement / Atomic Scenario | Test Level | Risk Link | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| 12.1-UNIT-001 | Strict schema v1 enforces every required/optional/server-owned/rejected field, returns `UNSUPPORTED_FIELD`/`UNSUPPORTED_SCHEMA_VERSION`, and rejects generated SQL, free text, secrets, pending modules, raw rates, and other v1 exclusions. | Unit | R-1201 | Dev + QA | Unknown/recognized-deferred fields block execution and are never retained. |
| 12.1-UNIT-002 | Identity normalization removes spaces/hyphens, validates ten-digit checksum, distinguishes equivalence/name changes from a different organisation, rejects non-SE/personnummer/sole-proprietor shapes, and accepts VAT only after trim/uppercase/space removal as `SE` + matching organization + `01`. Email trim/NFC + IDNA/lowercase-domain + lowercase-local preserves plus/dots/tags and rejects display names/comments/malformed/multiple addresses. | Unit | R-1203 | Dev + QA | Include active, inactive, archived, Unicode/IDNA, and VAT mismatch cases. |
| 12.1-UNIT-003 | Provisioning/reconciliation transitions permit only `pending_first_admin_invite`, `first_admin_invite_unknown`, `first_admin_invite_requested`, `first_admin_invite_failed`, and `ready`; `ready` requires DB complete + recorded baseline ID/version/hash + active membership + non-null matching Auth identity + no unresolved definitive failure. | Unit | R-1202 | Dev + QA | Timeout → unknown; definitive failure → sanitized failed; provider acceptance alone is neither delivery nor ready. |
| 12.1-INT-001 | Operator self-read works; tenant roles/orphan/anonymous cannot enumerate `platform_operators`. | DB/RLS | R-1201 | Dev + QA | Real local identities. |
| 12.1-INT-002 | Catalog/grants prove one normal-JWT `provision_tenant`, exact authenticated EXECUTE, dedicated least-privilege NOLOGIN/NOINHERIT owner, empty `search_path`, filtered Vault read, and allowed signed actions only; PUBLIC/anon/authenticator/service_role execution/DML, owner membership, legacy delegate, custom JWT, and second writer are absent. | DB/catalog/static | R-1201 | Dev + QA + Security | Initial provision, reserve dispatch, exact outcome, reconciliation recording, and audit only. |
| 12.1-INT-003 | Approved operator request with valid attestation atomically creates canonical facts, tenant, exact database-catalogue baseline and subscription data, invited membership, `pending_first_admin_invite`, and approval audit before Auth; attestation is not stored/audited. | Command/DB | R-1201, R-1202 | Dev + QA | Exact values and DB→reservation→Auth order evidence, not response-only. |
| 12.1-INT-004 | Injected failure at every in-transaction write point leaves no partial DB/audit state. | Fault-injection integration | R-1202, R-1210 | Dev + QA | Before/after counts and keys. |
| 12.1-INT-005 | Dry run returns all required fields and makes zero DB/Auth/audit writes; execution reloads/re-hashes the migration-owned insert-only DB catalogue, requires original request/hash/approval plus valid signed approval generation, and returns `PREVIEW_STALE` on mismatch. TypeScript mirror matches canonical DB content/hash exactly and no runtime role can mutate it. | Command/DB | R-1202, R-1214 | Dev + QA | Published rows immutable; changes insert versions; approver is current allow-listed `auth.uid()`. |
| 12.1-INT-006 | Same request UUID/hash reconciles first and returns tenant/current state/attempt/reconciliation action without provider work; same UUID/different content returns `IDEMPOTENCY_CONFLICT`; different UUID for the same active/inactive/archived identity returns `ALREADY_PROVISIONED` without duplicate or silent update. | Command/DB | R-1203 | Dev + QA | Stable existing identity/status returned; provider call count remains zero. |
| 12.1-INT-007 | Concurrent same-identity requests yield one tenant and one effective first-Admin invite intent. | Concurrency integration | R-1203 | Dev + QA | One winner, one reconciled result. |
| 12.1-INT-008 | After DB commit, signed `reserve_dispatch` installs only fresh token SHA-256/current generation and returns exact durable email/membership/role/expiry/reservation facts; at most one provider call uses those facts, and separately signed requested/failed outcome binds that reservation/generation. | Command/Auth boundary | R-1202 | Dev + QA | Attempts 1–3 share one approval generation; attempt 4 requires a fresh signed monotonic approval generation. |
| 12.1-INT-009 | Timeout persists `unknown` without auto-resend; replay/reconciliation is provider-free and does not rotate. Each explicit resend creates a fresh in-memory token, signed reservation atomically revokes the prior hash, and exact-generation outcome rejects stale/out-of-order/conflicting submissions. Epic 11 accepts only the current binding. | Command/Auth boundary | R-1202, R-1210 | Dev + QA | Prove durable-fact provider input, 32-byte CSPRNG, SHA-256-only DB/RPC, raw-token absence, old-link invalidation, and no blind resend/escrow/derivation/redesign. |
| 12.1-INT-010 | Tenant roles, orphan, anonymous, forged/absent JWT claims, and unsigned/forged/expired/wrong-domain/wrong-key/tampered attestations receive one generic denial with zero side effects. | Authorization integration | R-1201, R-1205, R-1208 | Dev + QA | Enumerate roles/actions and verify no validation oracle. |
| 12.1-INT-011 | Provisioning tenant X cannot read or mutate tenant Y; foreign row digests stay unchanged and no existence signal leaks. | Tenant-isolation integration | R-1208 | Dev + QA + Security | Covers AC-PH-3 path itself. |
| 12.1-INT-012 | Audit records correlate durable tenant/approver/request/preview/baseline/reservation/generation/attempt/action/sanitized-outcome transitions without raw token, HMAC attestation, key, or secret; preview leaves no row. | Audit integration | R-1210 | Dev + QA | Success, replay, unknown, requested, failed, ready, recovery, rotation. |
| 12.1-STATIC-001 | Only sanctioned DEFINER/actions exist; signer/Auth-admin stay server-only; service role cannot call/write provisioning; attestation/raw token cannot reach browser/log/audit; `Platform.Operator.Access` remains non-granting and tenant-excluded. | CI/static/catalog | R-1201, R-1206 | Dev + Security | Red/green canaries, forbidden-function/grant scan, manifest/permission coherence. |
| 12.1-INT-013 | Empty DB reset yields exact operator/catalogue/owner/Vault/grant objects, insert-only baseline rows, constraints, indexes, generation/reservation columns, and manifest inventories; DB/TypeScript catalogue coherence passes. | Migration/catalog | R-1201, R-1203, R-1214 | Dev + QA | Required local stack, zero skip. |
| 12.2-UNIT-001 | Console projection emits only tenant identity/status/created/first-Admin fields and rejects/discards injected business fields. | Unit/read-model | R-1204 | Dev + QA | Exact-key assertion. |
| 12.2-INT-001 | Every console query/action independently authorizes operator and generically denies all other identities with zero effects. | Route/read integration | R-1205, R-1208 | Dev + QA | Layout visibility is not evidence. |
| 12.2-INT-002 | Nested/aliased console reads cannot return seeded business-data canaries from either tenant. | Read-model security | R-1204, R-1208 | Dev + QA + Security | Assert keys, values, errors, summaries. |
| 12.2-STATIC-001 | Operator territory imports no tenant shell/context/nav and every server entry contains the operator gate. | CI/static | R-1205 | Dev + QA | Tenant nav remains operator-free. |
| 12.3-UNIT-001 | Each of five checklist predicates is red at its exact incomplete boundary and green only from authoritative persisted state. | Unit | R-1207 | Dev + QA | Parameterized per item. |
| 12.3-UNIT-002 | Aggregate working-state is green only when all five predicates are green; foreign/pending state cannot satisfy it. | Unit | R-1207, R-1208 | Dev + QA | Stable labels/order/deep links. |
| 12.3-INT-001 | Checklist read is tenant-scoped; tenant A changes cannot affect or reveal tenant B state. | Read-model/RLS | R-1207, R-1208 | Dev + QA | Two-tenant canaries. |
| 12.3-E2E-001 | Full second-tenant proof reaches server-confirmed working state and leaves the existing tenant unchanged. | E2E | R-1202, R-1207, R-1208 | QA + Dev | Create → baseline → invite → onboarding. |
| 12.3-STATIC-001 | No public signup/register route, nav, copy, API, or public capability ships. | CI/static/scope | R-1209 | Dev + Scope reviewer | FR76 fail-loud gate. |
| 12.3-STATIC-002 | No onboarding table/new settings schema or hardcoded price/discount/limit is added. | CI/static/schema | R-1209 | Dev + QA | Subscription values remain tenant data. |

**Total P0:** 27 atomic scenario groups, ~60–95 hours.

### P1 — High

**Criteria:** Core operator/Admin journeys and complex resumability behavior with material impact and limited workaround.

| Test ID | Requirement / Atomic Scenario | Test Level | Risk Link | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| 12.2-UNIT-002 | Wizard step derivation is deterministic from every durable server state. | Unit | R-1211 | Dev + QA | No click-tracking state. |
| 12.2-E2E-001 | Operator sees isolated console/exact columns; tenant Admin and anonymous direct navigation see generic denial and no canary. | E2E | R-1204, R-1205 | QA + Dev | Thin presentation/route proof. |
| 12.2-E2E-002 | Interrupted wizard resumes after reload/new context; replay/reconciliation renders tenant/state/attempt/action without token rotation or provider call; explicit retry displays three distinct signed-reservation/token/outcome generations, and attempt 4 requires fresh preview/approval with newer signed monotonic approval generation rather than duplicate-create or blind resend. | E2E | R-1202, R-1203, R-1211 | QA + Dev | Persistence, durable-fact provider input, generation/hash change, old-link invalidation, exact outcome, provider-call count, and raw-token/HMAC absence asserted at server. |
| 12.3-UNIT-003 | Dismissal affects presentation only; reminder restores incomplete checklist and cannot change completion. | Unit | R-1207 | Dev + QA | Per-admin presentation state. |
| 12.3-INT-002 | Dismissal/resume persists independently for two Admins and cannot mutate item/tenant completion. | Command/DB | R-1207 | Dev + QA | Tenant/member isolation. |
| 12.3-E2E-002 | Dismissed checklist stays hidden after reload, reminder restores it, deep links work, and clicks alone never complete items. | E2E | R-1207 | QA + Dev | Server-confirmed state only. |
| 12.3-INT-003 | Manifest activation, non-granting platform permission metadata, operator-registry consumption, tenant-consumer exclusion, catalogue expectations, and guardrail derivations are coherent in the same change. | Migration/manifest | R-1201, R-1209 | Dev + QA + Scope reviewer | Platform infrastructure is not treated as a tenant module or tenant entitlement. |

**Total P1:** 7 atomic scenario groups, ~24–40 hours.

### P2 — Medium

**Criteria:** Secondary presentation behavior with a workaround and no privilege/data-integrity impact.

| Test ID | Requirement / Atomic Scenario | Test Level | Risk Link | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| 12.2-E2E-003 | Three data-entry steps plus preview/approval have semantic headings/labels, baseline ID/version/hash, field-level unsupported summaries, focus movement, keyboard completion, truthful invite/readiness/attempt-limit copy, explicit retry/rotation confirmation, and deterministic submitting state. | E2E/accessibility | — | QA + Dev | Use resilient semantic selectors from implemented UI; never render a raw token. |

**Total P2:** 1 group, ~4–8 hours.

### P3 — Low

**Criteria:** Non-gating measurement with no approved failure threshold.

| Test ID | Requirement / Atomic Scenario | Test Level | Owner | Notes |
| --- | --- | --- | --- | --- |
| 12.X-PERF-001 | Record provisioning elapsed time and console query count/latency at a documented pilot dataset. | Baseline | QA + Architect | No PASS/FAIL threshold until owner-defined. |

**Total P3:** 1 baseline, ~3–6 hours.

---

## Execution Strategy

- **PR:** Run all Epic 12 unit/static/catalog tests, required Vitest DB/RLS/command/fault-injection coverage with `SUPABASE_TEST_REQUIRED=1` and zero skips, and focused production-server Playwright. Run everything in PRs while the measured lane remains below 15 minutes; shard only when wall time requires it.
- **Nightly:** Burn in concurrent idempotency, response-loss/reconciliation, and the complete Epic 12 browser journeys across repeated unique fixtures if repetition would exceed the PR budget.
- **Weekly or scale-triggered:** Record larger tenant-list/concurrency baselines. No performance gate is asserted until an owner supplies a numeric threshold.
- Playwright remains serial initially because the repository shares a seeded browser fixture. If the Epic 12 factories become independently cleanup-safe, parallelization may be measured and adopted; it is not assumed by this plan.

---

## Resource Estimates

Ranges include fixture extension, fault-injection controls, test implementation, review fixes, and evidence capture.

| Priority | Scenario groups | Effort range | Main work |
| --- | ---: | --- | --- |
| P0 | 27 | ~60–95 hours | Privileged DB/RLS/catalog harness, transaction/recovery, concurrency, isolation canaries, scope/static gates, full journey fixture. |
| P1 | 7 | ~24–40 hours | Wizard/checklist state, browser authorization/resume, dismissal, manifest integration. |
| P2 | 1 | ~4–8 hours | Wizard accessibility and keyboard path. |
| P3 | 1 | ~3–6 hours | Non-gating pilot baseline. |
| **Total** | **36** | **~91–149 hours** | **Approximately 2.5–4 person-weeks.** |

### Prerequisites

**Test data:**

- Extend the existing per-call two-tenant factory with platform operator, new tenant request, first-Admin, subscription/baseline, and cleanup handles.
- Create Swedish checksum/personnummer/VAT/equivalence fixtures plus active/inactive/archived identity collisions, request UUID/hash conflicts, and independently seeded tenant-business canaries.
- Provide deterministic fault points before/after tenant, baseline, membership, audit, Auth invite, and terminal-status transitions.
- Keep service-role/Auth-admin use in test-only factories/support; never use the hosted demo.

**Tooling:**

- Node test runner for pure validation/state/checklist logic.
- Vitest plus disposable local Supabase for DB/RLS/catalog/command/concurrency/fault-injection evidence.
- Existing service-role, bundle-containment, manifest, scope, and migration-reset guardrails.
- Playwright through the configured production `webServer` for thin critical journeys.
- `@seontechnologies/playwright-utils` is configured but not installed; its mandate does not bind and this plan authorizes no invented imports. Adoption belongs to the framework workflow.
- Pact/contract testing is not relevant: no Pact artifacts, dependency, OpenAPI service contract, or microservice boundary exists.

**Environment:**

- Disposable local Supabase only; never shared staging/demo for automated evidence.
- `SUPABASE_TEST_REQUIRED=1` for required DB evidence; zero explicit or dynamic skips.
- Controlled local Auth/Inbucket state where needed; external delivery smoke only on configuration change.
- Production build/start for Playwright; never `next dev`.

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100%.
- **P1 pass rate:** ≥95%; every failure requires owner/triage, and no security/isolation failure can be waived by the percentage.
- **P2/P3 pass rate:** ≥90% when scheduled; the threshold-less P3 baseline is judged on successful measurement, not a fabricated latency target.
- **High-risk mitigation:** 100% complete or formally waived by an authorized owner with reason and expiry.
- **Required skips:** 0; discovered and executed test counts must reconcile.

### Coverage Targets

- FR73–FR76, NFR54, AC-B1a-1, AC-PH-3, and all Story 12.1–12.3 acceptance criteria: 100% mapped scenario coverage.
- Security/tenant-isolation/privileged-path identities, entries, grants, and sanctioned DEFINER surfaces: 100% enumerated coverage.
- Overall epic requirements: ≥80% automated coverage.
- Pure provisioning/checklist business logic: ≥80% branch coverage where project coverage tooling exists; otherwise complete decision-table cases.

### Non-Negotiable Requirements

- [ ] R-1202 has green failure/recovery/replay evidence.
- [ ] No unauthorized caller reaches validation, lookup, audit, Auth admin, or write side effects.
- [ ] No tenant-business field/value can emerge from console paths.
- [ ] No duplicate tenant/membership/invite intent under sequential, concurrent, or response-loss replay.
- [ ] Checklist completion follows authoritative persisted state and cannot be click-forged.
- [ ] No public signup, extra DEFINER write surface, client-reachable privileged credential, new onboarding table/settings schema, or hardcoded commercial value.
- [ ] NFR evidence exists for every in-scope category; final NFR verdict is deferred to `nfr-assess`.

---

## Mitigation Plans

### R-1201 — Privileged DB Surface Mis-Hardening (Score 6)

**Strategy:**

1. Pin dedicated NOLOGIN/NOINHERIT owner, security mode, empty `search_path`, argument/return types, schema refs, filtered Vault read, exact authenticated EXECUTE, and narrow signed provision/reserve/outcome/reconciliation/audit actions from live catalog/source.
2. Exercise operator, tenant roles, orphan, anonymous, forged/absent claims, search-path hijack, rejected actions, unsigned/forged/expired/wrong-domain/wrong-key/tampered attestations, and blocked PUBLIC/anon/authenticator/service_role execution/DML and owner membership.
3. Require `Platform.Operator.Access` as `scope: platform`, `tenantGrantable: false`, `tenantRoles: []`; prove every tenant role/entitlement/nav/settings consumer excludes it and only the operator registry consumes it separately.
4. Fail on any unexpected Epic 12 DEFINER function or PUBLIC execution grant.

**Owner:** Dev + QA + Security reviewer  
**Timeline:** Story 12.1 before merge  
**Status:** Planned  
**Verification:** 12.1-INT-001/002/010/013 and 12.1-STATIC-001.

### R-1202 — Partial DB/Auth Provisioning (Score 9)

**Strategy:**

1. Enforce the owner-defined `pending_first_admin_invite → unknown | requested | failed → ready` state space; timeout is unknown, provider acceptance is requested, and exact readiness requires DB complete + recorded baseline ID/version/hash + active membership + non-null matching Auth identity + no unresolved definitive failure.
2. Inject failure and response loss at every DB/Auth/status boundary after proving the DB commit precedes the Auth call.
3. Reconcile first without provider work. For initial dispatch and every resend, generate a fresh 32-byte token in memory, sign only SHA-256, commit signed `reserve_dispatch`, derive provider identity solely from its durable result, perform at most one call, then submit a separately signed exact-reservation/generation sanitized outcome. Prove old-link rejection and raw-token absence from DB/RPC/operator/log/audit.
4. Reject caller email/membership/operation/role/expiry, stale/out-of-order/conflicting outcomes, and trusted `fresh_approval` booleans. Require explicit retry after reconciliation, three dispatches per approved snapshot, and fresh preview/approval with signed monotonic approval generation before dispatch four. `unknown` never auto-resends; no escrow, derivation, or provider redesign.
5. Replay each state and prove one tenant, one membership, at most one effective invitation, persisted attempts/sanitized outcomes, audited transitions, and no false terminal success.

**Owner:** Dev + QA  
**Timeline:** Story 12.1 before Story 12.2 depends on the command  
**Status:** Planned — completion blocker  
**Verification:** 12.1-UNIT-003, 12.1-INT-003/004/008/009, 12.2-E2E-002, and 12.3-E2E-001.

### R-1203 — Duplicate Tenant Under Retry/Concurrency (Score 6)

**Strategy:**

1. Normalize `SE` organisation identity and exact VAT/email forms in testable functions, reject personnummer/sole-proprietor and malformed identity shapes, and enforce all-status uniqueness on country + normalized organisation number.
2. Persist independent request UUID + canonical request hash semantics and drive same-ID/same-content reconciliation, same-ID/different-content, different-ID/same-identity, archive/inactive, concurrent, and response-loss cases.
3. Assert one durable tenant/settings/membership identity and deterministic reconciled-result / `IDEMPOTENCY_CONFLICT` / `ALREADY_PROVISIONED` semantics with no silent update or implicit provider call.

**Owner:** Dev + QA  
**Timeline:** Story 12.1 before merge  
**Status:** Planned  
**Verification:** 12.1-UNIT-002 and 12.1-INT-006/007/009/013.

### R-1204 — Operator Business-Data Exposure (Score 6)

**Strategy:**

1. Emit a narrow allow-listed DTO rather than serializing tenant/domain rows.
2. Seed unique canaries in customers, quotes, files, and money fields for two tenants.
3. Assert exact keys and absence of canary values through every read, error, and audit-summary path.

**Owner:** Dev + QA + Security reviewer  
**Timeline:** Story 12.2 before merge  
**Status:** Planned  
**Verification:** 12.2-UNIT-001, 12.2-INT-002, and 12.2-E2E-001.

### R-1205 — Layout-Only Operator Authorization (Score 6)

**Strategy:**

1. Inventory every operator page loader, read, command, and server action.
2. Require an independent server-side platform-operator gate at each entry.
3. Drive direct calls/navigation as operator, tenant roles, orphan, and anonymous identities and require indistinguishable denial.

**Owner:** Dev + QA  
**Timeline:** Story 12.2 before merge  
**Status:** Planned  
**Verification:** 12.1-INT-010, 12.2-INT-001, 12.2-STATIC-001, and 12.2-E2E-001.

### R-1206 — Client-Reachable Auth Admin / Service Credential (Score 6)

**Strategy:**

1. Confine Auth administration to a server-only adapter outside the RPC and browser bundle.
2. Extend source and built-bundle containment scans with red/green canaries.
3. Assert no unauthenticated privileged route and no RPC-level Auth responsibility.

**Owner:** Dev + Security reviewer  
**Timeline:** Story 12.1 before merge  
**Status:** Planned  
**Verification:** 12.1-STATIC-001 plus existing containment regression suites.

### R-1207 — False-Green Onboarding Completion (Score 6)

**Strategy:**

1. Define a pure, falsifiable server-derived predicate for each of the five checklist items.
2. Cover exact incomplete/complete boundaries and aggregate all-items completion.
3. Prove dismissal affects presentation only.
4. Complete the full journey through persisted settings/pricing/user state and assert server confirmation.

**Owner:** Product + Dev + QA  
**Timeline:** Story 12.3 before merge  
**Status:** Planned  
**Verification:** 12.3-UNIT-001/002/003, 12.3-INT-001/002, and 12.3-E2E-001/002.

### R-1208 — Cross-Tenant / Existence Leakage (Score 6)

**Strategy:**

1. Use two independent tenants plus business-data canaries and foreign-row digests.
2. Assert generic denial/conflict envelopes and exact response/audit field absence.
3. Compare foreign rows before/after every privileged negative and full E2E journey.

**Owner:** Dev + QA + Security reviewer  
**Timeline:** Stories 12.1–12.3  
**Status:** Planned  
**Verification:** 12.1-INT-010/011, 12.2-INT-001/002, 12.3-INT-001, and 12.3-E2E-001.

### R-1209 — Scope / Commercial Logic Regression (Score 6)

**Strategy:**

1. Scan routes, nav, copy, APIs, and public capability inventories for registration/self-serve surface.
2. Scan application logic/UI defaults for hardcoded subscription prices, discounts, and included-user limits with canary bite proofs.
3. Assert Epic 12 adds no onboarding table/new settings schema and activates only coherent platform-scope metadata.

**Owner:** Product + Dev + Scope reviewer  
**Timeline:** Across Epic 12; gate before epic completion  
**Status:** Planned  
**Verification:** 12.3-STATIC-001/002 and 12.3-INT-003.

---

## Assumptions and Dependencies

### Assumptions

1. Epic 11 invitation and Admin-user lifecycle mechanisms are reused rather than reimplemented, including hash-only token validation, acceptance, and membership activation.
2. Provisioning remains one deterministic internal service/command; orchestration never receives general DB access.
3. `src/scope/manifest.ts` remains the authority for provisioning activation/platform scope, and the permission matrix carries only the non-granting `Platform.Operator.Access` classification for the operator registry.
4. Existing Phase A settings/pricing/user state is sufficient to derive the five onboarding predicates; Story 12.3 introduces no new domain schema.
5. Existing per-call local test factories and production-server Playwright patterns can be extended without targeting the hosted demo.

### Dependencies

1. Story 12.1 implementation contract for normalized identity, migration-owned catalogue/TypeScript coherence, durable state/readiness, dry run/signed approval generation, normal-JWT plus server-HMAC sole-RPC authority, least-privilege owner/grants, signed reservation/outcome, hashed token lifecycle, bounded attempts, and platform capability — required before P0 implementation can finish.
2. Epic 11 invitation/callback/admin-user seams and fixtures — required by Stories 12.1 and 12.3.
3. Disposable local Supabase and deterministic Auth/Inbucket controls — required for DB/Auth boundary tests.
4. Manifest/catalog/test-inventory integration points — required for same-change activation and fail-loud scope checks.
5. Stable operator/read-model/checklist DTOs and semantic UI labels — required before E2E selectors can be finalized.

### Risks to Plan

- **Risk:** The complete DB/Auth contract is explicit, but implementation may split its state, token, attempt, or readiness rules across layers inconsistently.
  - **Impact:** R-1202 tests could pass isolated helpers while the composed recovery promise is false.
  - **Contingency:** Implement the owner-approved transition/readiness table first, then exercise it end-to-end with provider-call counting, token-hash evidence, and persisted attempt/reconciliation output.
- **Risk:** Shared Playwright fixtures keep the full journey serial and may push the PR lane past 15 minutes.
  - **Impact:** Feedback slows or the journey gets incorrectly deferred.
  - **Contingency:** First optimize setup via API/factories; only then measure cleanup-safe parallelization or shard focused specs.
- **Risk:** Source documents contain agent-directed headings such as “Stop Conditions Requiring Human Approval.”
  - **Impact:** They could be mistaken for instructions to this test-design workflow.
  - **Contingency:** Treat them only as product constraints and escalation conditions for future implementation; no source directive was executed by this run.

---

## Follow-on Workflows (Manual)

- Run `/bmad-testarch-atdd` for Story 12.1 P0 red tests when implementation work is authorized.
- Run `/bmad-testarch-automate` for the broader coverage plan after the product seams exist.
- Run `nfr-assess` only after implementation evidence is available.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager — confirms organization-identity semantics, checklist predicates, and performance/scale disposition
- [ ] Tech Lead — confirms DB/Auth recovery and single-DEFINER architecture
- [ ] QA Lead — confirms fixture, fault-injection, coverage, and evidence gates
- [ ] Security reviewer — confirms operator/RPC/read-model/containment coverage

---

## Interworking and Regression

| Service / Component | Impact | Regression Scope |
| --- | --- | --- |
| Supabase Auth invitation/callback | Provisioning initiates the first-Admin invite through the existing server boundary only after signed dispatch reservation commits. | Durable RPC-returned provider identity; one call per reservation; signed exact-generation outcome; Epic 11 binding; fresh token/SHA-256-only persistence; revocation/old-link rejection; provider-free reconciliation; signed three-dispatch approval budget; exact readiness; no service-role DB call; transport smoke. |
| Tenant/membership foundation | Creates a tenant and invited Admin without an existing tenant membership. | Tenant context, membership integrity, last-Admin safety, cross-tenant/anon RLS, factory cleanup. |
| Settings/pricing/work roles | Baseline values are created and later drive checklist truth. | Existing settings/pricing commands, read models, snapshots, VAT/quote warning posture, role management. |
| Audit command envelope | Provisioning and recovery need tenant/actor/approver/correlation evidence. | Audit RLS, anonymous isolation, rollback atomicity, search-path, correlation uniqueness. |
| Scope manifest/permission guardrails | Provisioning changes from pending to active while its live surface and non-granting permission row are platform-scoped. | Manifest/permission coherence, operator-registry consumption, tenant role/entitlement/nav/settings exclusion, nav/widget/table inventories, deferred-surface scans, same-change activation. |
| Operator route territory | Adds privileged same-deployment UI outside the tenant shell. | Middleware/auth routing, client bundle containment, tenant nav/landing, direct-route denial, accessibility. |
| Playwright global fixture | Needs operator and new first-Admin identities plus full cleanup. | Existing login/tenant-context, role-aware navigation, admin-user lifecycle, E2E duration budget. |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — risk ownership, scoring, and mitigation thresholds
- `probability-impact.md` — probability/impact definitions
- `test-levels-framework.md` — unit/integration/E2E selection
- `test-priorities-matrix.md` — P0–P3 classification independent of execution timing
- `nfr-criteria.md` — NFR thresholds, evidence planning, and unknown-threshold handling
- `test-quality.md` and `evidence-integrity.md` — deterministic, falsifiable, non-vacuous coverage
- `fixture-architecture.md`, `data-factories.md`, and `network-first.md` — isolated factories and deterministic UI setup
- `library-integration-mandate.md` and `playwright-utils-mandate.md` — enabled flag plus absent-package behavior
- `playwright-cli.md` — browser exploration fallback; CLI unavailable in this run

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd-phase-b.md`
- Epic: `_bmad-output/planning-artifacts/epics-phase-b.md`
- Architecture: `_bmad-output/planning-artifacts/architecture-phase-b.md`
- Prior system testability: `_bmad-output/test-artifacts/test-design-architecture.md`
- Prior QA strategy: `_bmad-output/test-artifacts/test-design-qa.md`
- Preceding RBAC/invitation design: `_bmad-output/test-artifacts/test-design-epic-11.md`
- Scope authority: `src/scope/manifest.ts`

### Workflow Capability Notes

- Execution mode resolved from config `auto`. Subagent capability is available, but epic-level mode has one output and remains single-worker by default.
- Browser exploration was skipped because `playwright-cli` and a Playwright MCP browser surface are unavailable. No session was opened, so no browser cleanup is required.
- Pact/contract testing and Pact broker probing were skipped as irrelevant to the monolithic Next.js/Supabase boundary.
- No managed background resource, test stack, temporary artifact, branch, commit, push, or PR was created.

---

**Generated by:** BMad TEA Agent — Test Architect Module  
**Workflow:** `bmad-testarch-test-design`  
**Version:** 4.0 (BMad v6)

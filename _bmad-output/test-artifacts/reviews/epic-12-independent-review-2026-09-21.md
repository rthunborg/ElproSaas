# Epic 12 Independent Review — 2026-09-21

## Review identity and scope

- **Delivery:** one independent in-app subagent broad pass; no delegation or external CLI artifact.
- **Model/effort:** `gpt-5.6-luna` / `xhigh`.
- **Frozen review base:** merge-base of `origin/main` and `fa76fedea678bd0455fce15906eb4c127da5f848`, verified as `0ea5f94c55ed7ad9f1200e4d5eb5817eec4c6e56`.
- **Frozen review head:** `fa76fedea678bd0455fce15906eb4c127da5f848`.
- **Diff reviewed:** complete merge-base-to-head diff, 137 files, 11,262 additions and 387 deletions.

I read `AGENTS.md`, the Epic 12 context and story specifications, the review-order/security/local-process documentation, and the complete relevant source and migration paths. Areas inspected were the provisioning validator and server command, HMAC attestation and opaque grants, the final provisioning RPC and owner-role migrations, operator projections/routes/actions, onboarding read model and dismissal action, manifest/permission/H4 inventory, recovery bootstrap SQL, seed extraction, performance harness, integration fixtures, Playwright setup/teardown, and the Story 12.1–12.3 unit/integration/E2E coverage.

The root task supplied the acceptance and targeted evidence context (24/24 acceptance trace, clean typecheck, scoped lint with zero errors, Story 12.3 DB 13/13, targeted console/onboarding E2E 6/6, CI-repair DB 17/17). I did not start services, reset a database, run hosted checks, or modify production code, tests, specs, state, or git history. Historical external CLI attempts produced no artifact and remain unverified.

## Findings in the frozen head

### [P1] Organisation-number guard can admit personnummer-shaped identities and reject valid legal-entity identities

- **Sources:** `src/server/commands/provisioning/validation.ts:111-116,141-146`; the server signs the accepted canonical identity at `src/server/commands/provisioning/provision-tenant.ts:97-110`. The database authority only checks the signed country and ten-digit shape in the effective RPC body (`supabase/migrations/20260919183425_provisioning_review_authority_fixes.sql:93-119`, finalized by `supabase/migrations/20260919192439_provisioning_rpc_attestation_coherence.sql:93-121`).
- **Trigger/reachability:** an authenticated allow-listed platform operator submits a checksum-valid Swedish personal identity in the accepted `YYMMDD-NNNN` shape. The guard's middle expression is ordered as `YYDDMM` and also allows `40-99` as a supposed day (`[4-9]\\d`). For a date whose month is `02` and day is `15`, the expression tests `02` as the day and `15` as the month and therefore accepts the personnummer-shaped value. Conversely, valid organisation-number candidates with the guard's `YYDDMM` pattern can be rejected.
- **Invariant bypass:** `canonicalizeProvisioningRequest` treats the value as a valid organisation number, the server HMAC binds that wrong identity, and the RPC has no independent legal-entity/personnummer check. The durable `(country_code, normalized_organization_number)` unique index only prevents duplicates; it cannot distinguish a sole proprietor's personnummer from a legal-entity organisation number.
- **Impact:** provisioning v1 can create a tenant for an ineligible sole proprietor and persist the personal identity as the canonical tenant identity; valid companies can also be blocked. The owner contract explicitly requires Swedish non-personal legal entities and rejection of personnummer-shaped identities.

### [P1] Concurrent same-request different-content replay can bypass `IDEMPOTENCY_CONFLICT`

- **Sources:** the effective RPC first reads the request row with `FOR UPDATE` before either concurrent transaction has committed (`supabase/migrations/20260919183425_provisioning_review_authority_fixes.sql:93-103`). It then inserts the tenant and durable request (`:107-119`). The final migration replaces the unique-violation handler with an organisation lookup that returns `ALREADY_PROVISIONED` (`supabase/migrations/20260919192439_provisioning_rpc_attestation_coherence.sql:113-121`). The request primary key and identity index are defined at `supabase/migrations/20260919090000_tenant_provisioning.sql:29-33`.
- **Trigger/reachability:** two operator approval submissions use the same `request_id` but different canonical content, which is possible with two tabs or a retry carrying changed company/admin fields. Both initial reads can see no committed request. If the calls use the same organisation, the loser waits on the identity unique index, then its handler finds the winner by organisation and returns `ALREADY_PROVISIONED`; with different organisations, the request primary-key violation is re-raised as a generic database failure. Neither path returns the required `IDEMPOTENCY_CONFLICT`.
- **Invariant bypass:** the required same-ID/different-hash rule is enforced only by the pre-insert read (`v_existing.canonical_request_hash <> v_hash`). The existing concurrent test deliberately uses a different request ID (`tests/factories/platform-operators.ts:393-402`), so it does not exercise this race. No downstream constraint restores the required result code.

### [P2] Frozen operator-console E2E generator can randomly produce a validator-rejected organisation number

- **Sources:** `tests/e2e/auth/operator-console.atdd.e2e.spec.ts:34-41` generates one `556` plus random six-digit suffix and a Luhn digit, then submits it without the production validator. The shared validator applies the additional personnummer guard at `src/server/commands/provisioning/validation.ts:112-116`.
- **Trigger/reachability:** when the generated suffix falls into the guard's date-like pattern, the browser preview stops at validation and the test never reaches the approval/opaque-grant assertions. The random generator has no retry or validator check, so this is a nondeterministic coverage failure. The 3a985fe focused repair was inspected separately and now filters candidates through the shared validator.

### [P2] E2E/global fixture teardown leaves orphan provisioning protocol rows

- **Sources:** `tests/e2e/global-teardown.ts:25-35` deletes audit rows and then tenants while `session_replication_role = replica`; it never deletes `tenant_provisioning_requests`. The generic base cleanup has the same tenant delete behavior (`tests/factories/tenants/core.ts:421-428`). The new request table's tenant FK deliberately has no cascade (`supabase/migrations/20260919090000_tenant_provisioning.sql:31-33`). Epic 12 seeds a handoff request on the base tenant (`tests/e2e/seed-epic-12-browser-fixtures.ts:75-80`), and the E2E approval creates another request for the separately provisioned tenant. The purpose-built provisioning fixture cleanup demonstrates the missing operation (`tests/factories/platform-operators.ts:321-335`).
- **Trigger/reachability:** any completed browser run invokes global teardown. Because FK triggers are disabled for the tenant delete, both the handoff request on the base fixture and the newly created tenant's request can survive with a deleted tenant (and potentially a deleted actor user). Repeated local runs therefore accumulate orphan protocol rows; CI's fresh reset masks the defect.
- **Impact:** test cleanup no longer preserves referential integrity or the promised scoped isolation, and later protocol inventory/reconciliation tests can observe stale rows. This is test-harness contamination rather than a production runtime path.

## Focused review of the post-freeze fix commit

Per the owner instruction, I reviewed only `fa76fed..3a985fef5b11d47916cf0299cc5d397d85ef088e` in `tests/factories/platform-operators.ts` and `tests/e2e/auth/operator-console.atdd.e2e.spec.ts`; the accompanying spec/report bookkeeping was not treated as a new broad pass.

- The E2E repair at `tests/e2e/auth/operator-console.atdd.e2e.spec.ts:4,34-49` preserves random six-digit identity entropy and retries through `normalizeSwedishOrganizationNumber`; no focused regression was found.
- The fault-injection repair at `tests/factories/platform-operators.ts:113-167` keeps DDL, trigger installation, authenticated RPC invocation, and rollback in one transaction, acquires the relations in the RPC write order, and restores the session role through rollback. No focused correctness or isolation regression was found.

## Verdict

- **Actionable findings:** 4 total — 2 production P1 findings, 2 test-harness P2 findings.
- **Release blockers:** the organisation eligibility bypass and concurrent idempotency result are production blockers for the Epic 12 contract. The fixture issues are not production runtime blockers but should be fixed for trustworthy repeated local/CI evidence.
- **Independent evidence coverage:** yes, the review inspected all three stories: 12.1 provisioning authority/invitation recovery, 12.2 operator console and first-admin recovery, and 12.3 server-derived onboarding checklist/dismissal.
- **Operational limitations:** this was source inspection at the frozen snapshot plus a focused diff review; no local service/database rerun or hosted-system inspection was performed. The root-supplied passing evidence and the in-progress fresh CI remain separate from this independent inspection.

## Focused follow-up — orphan-cleanup closure at `bf017460d4b8049d2c57925721cf47a121062726`

- **Base/head:** reviewed only `3a985fef5b11d47916cf0299cc5d397d85ef088e..bf017460d4b8049d2c57925721cf47a121062726`.
- **Paths:** `tests/e2e/global-teardown.ts`, `tests/factories/platform-operators.ts`, `tests/factories/tenants/core.ts`, and the new `tests/integration/fixtures/provisioning-cleanup.int.test.ts`.
- **Scope:** no new broad pass; unrelated working-tree production edits and the separate provisioning idempotency migration were excluded.

The P2 orphan-cleanup finding is **closed** by this delta. The standalone E2E tenant teardown now deletes immutable audit rows under the test-only replica setting, restores normal FK enforcement, deletes only requests belonging to the generated organisation, and then deletes the tenant (`tests/e2e/global-teardown.ts:25-50`). The generic fixture cleanup performs the same scoped protocol-row deletion for both fixture tenant IDs before deleting Auth actors, then preserves the established replica-mode root deletion required by the existing populated quote/job fixture graph (`tests/factories/tenants/core.ts:388-464`). The new integration fixture creates target and unrelated requests, audit data, and fixtures, then asserts target request/tenant/actor/audit removal and preservation of the unrelated request/tenant/actor (`tests/integration/fixtures/provisioning-cleanup.int.test.ts:8-65`). These paths are tenant-ID/organisation scoped; I found no cross-tenant deletion or ordering regression. The existing dedicated provisioned-tenant helper remains correctly ordered (`tests/factories/platform-operators.ts:321-341`).

The one-line fault-helper change is also safe: `tests/factories/platform-operators.ts:150-156` explicitly casts the JWT subject parameter to text while constructing `request.jwt.claims`; it does not widen the actor value or alter the rollback/lock sequencing. No new focused finding was identified. Runtime execution was not rerun because the local database was unavailable; focused lint was reported passing by the owner.

**Focused result:** 0 new findings; prior cleanup P2 resolved at `bf017460…`. The two production findings from the broad snapshot remain separate and were not reassessed in this cleanup-only follow-up.

## Focused P1 closure — production fixes at `acf6625fc1a0073aba8396ed05cf57d584f7eaef`

- **Baseline/head:** reviewed only `3a985fef5b11d47916cf0299cc5d397d85ef088e..acf6625fc1a0073aba8396ed05cf57d584f7eaef` in the four requested paths. The subsequent `6edbd2d9021310b202ab0e4fc828522d4bcf20b5` source tree was reported as the same stable content; this review remains anchored to the requested `acf6625` tree.
- **Delivery:** independent in-app subagent, `gpt-5.6-luna` / `xhigh`; no broad-pass restart, delegation, service, database, hosted-system, or working-tree source changes.
- **Files inspected:** `src/server/commands/provisioning/validation.ts`, `supabase/migrations/20260921170545_repair_provisioning_idempotency_conflict.sql`, `tests/integration/commands/provision-tenant.int.test.ts`, and `tests/unit/provisioning/provisioning-contract.test.ts`.

The organisation-number finding is narrowed during adjudication: the earlier ordinary `YYMMDD` acceptance wording was overstated because the old unprefixed alternative already rejected that shape; the concrete defect was false rejection of valid legal-entity numbers that happened to match the date-like branch. The fix removes date parsing and uses the authoritative ten-digit/Luhn check plus the Swedish third-digit `>= 2` discriminator (`validation.ts:111-120`). Unit coverage exercises later organisation digits that must remain valid and two checksum-valid personnummer-shaped values that must be rejected (`provisioning-contract.test.ts:39-61`). No reachable validator regression was found.

The idempotency repair restores request-ID/hash precedence in both race windows. The pre-insert identity reconciliation seam now compares an existing request ID and hash before returning `ALREADY_PROVISIONED`; the `unique_violation` handler first locks and compares the request row by `request_id`, then falls back to canonical identity for a different request (`20260921170545_repair_provisioning_idempotency_conflict.sql:1-29`). The new integration case holds the winner transaction uncommitted, starts the real loser RPC, waits for the blocker, commits the winner, and asserts `IDEMPOTENCY_CONFLICT` rather than `ALREADY_PROVISIONED` (`provision-tenant.int.test.ts:230-284`). No tenant, authorization, transaction, or replay regression was found by source inspection.

**Focused result:** 0 new findings and 0 fix regressions. The two broad production findings are resolved by the reviewed source changes, with the validator finding retained only in its narrower false-rejection form. At review time, runtime CI was still pending; owner-reported verification was clean typecheck, focused lint with seven files and zero errors/warnings, and full units 1,837 passed with one existing excluded skip. Historical external CLI attempts remain unverified and are not counted as evidence.

---
title: 'Story 14.2: Bookings and Assignees — Schema and Transactional Commands'
type: 'feature'
created: '2026-10-06'
status: 'done'
baseline_revision: '4947dbb44089c0462619c63443f3107712dc4cc7'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - 'docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-14-context.md'
  - '_bmad-output/test-artifacts/test-design-epic-14.md'
  - 'docs/process/review-order.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** The active resource foundation has people and availability but no tenant-safe booking record, multi-assignee relation, or durable command path. Later scheduling views and the booking editor need a stable, idempotent write boundary that can bind to the existing job container without making scheduling a live module.

**Approach:** Add booking, assignee, and conflict-workflow persistence to the already-active `resources` module. Create and update commands use the established envelope and narrow transactional RPCs so the canonical booking, assignees, idempotency outcome, and one audit event succeed or fail together. Story 14.3 integrates the sole detector and derived-conflict persistence/refresh into that authoritative transaction before any 14.4 work or user-facing booking entry.

## Boundaries & Constraints

**Always:** Keep `resources` active and extend its manifest-owned tenant-table inventory with `bookings`, `booking_assignees`, and `booking_conflicts`; retain `scheduling` pending with every live-surface array empty. Store time bounds as UTC `timestamptz`, enforce `ends_at > starts_at`, preserve the approved Europe/Stockholm local interpretation, and allow a fully standalone booking. All optional job, customer, facility, contact, work-role, and profile references must be same-tenant composite relationships. New assignment rejects deactivated people while retaining historical rows. Commands resolve tenant, actor, roles, and correlation server-side; create uses a command UUID plus canonical payload identity, and every mutable write is command-only, RLS-protected, auditable, and atomic.

**Block If:** A schema or command decision would require activating `scheduling`, granting Montör booking mutation, introducing a parallel employee/work-role model, accepting client-supplied conflict results, or defining/conflicting with the shared detection rules that Story 14.3 owns.

**Never:** Add a scheduling route, nav item, calendar/editor UI, recurrence or series command, time reports, notification category/producer, public feed, PWA/offline behavior, service-role path, hosted/demo change, or a second conflict engine. Do not turn an existing basic-job connection into a new job model.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Create standalone booking | Entitled admin/planner, valid UTC range, command key, optional links all absent, distinct active assignees | Exactly one booking and its assignees persist; the transaction records the idempotency result and one target-only audit event; derived-conflict acceptance belongs to 14.3 | Same canonical retry returns the original durable result without another row or audit event |
| Reuse command key | Existing create key with changed canonical payload | No booking, assignee, conflict, idempotency, or audit state changes | Return a stable generic command conflict without echoing payload or tenant data |
| Invalid or foreign relationship | Nonpositive range, duplicate assignee, foreign/mismatched optional parent, or deactivated profile | Transaction writes nothing | Return a typed validation or tenant-access result; never raw SQL or identifiers |
| Transactional update/fault | Existing same-tenant booking with replacement fields/assignees; fault injection after booking or assignee preparation | Successful update replaces mutable booking/assignee state; either injected failure leaves every business, idempotency, and audit row unchanged | Generic retryable server error for unexpected faults; no partial state |
| Role and row scope | Montör reads a booking assigned to their own profile, another worker's booking, or invokes a planner/admin mutation | Own assigned booking is visible; other-worker data and mutation are denied | RLS and command capability both deny without revealing foreign existence |

</intent-contract>

## Code Map

Source inspection at `4d2f29a5b3b084c2f25895b753cc2a0e43f6a1e1`; these are existing anchors, not proposed implementation line numbers.

- `src/scope/manifest.ts:249`, `:256`, `:263` — active resources owns the three tables; scheduling remains pending with empty live arrays.
- `src/server/authz/permission-matrix.ts:31`, `:103`; `src/server/commands/envelope.ts:51`, `:207`, `:295` — closed capabilities, resolved actor/tenant and caller-visible ownership. Capability permission alone does not establish own-row scope.
- `src/server/commands/envelope-core.ts:253`; `src/server/commands/resources/profile-form.ts:27` — normal envelope audit follows execution; use `auditable:false` when the checked SQL transaction owns atomic audit.
- `supabase/migrations/20260710120000_accept_quote_and_create_job.sql:118`; `20260831124310_story_10_8_quote_review_authorization.sql:486`, `:502`; `20260907171252_role_aware_phase_a_policy_evolution.sql:1002`, `:1017`, `:1030`, `:1036` — private INVOKER payload beneath authenticated checked DEFINER wrapper, explicit authority and fresh-only transaction-local audit.
- `supabase/migrations/20260907171252_role_aware_phase_a_policy_evolution.sql:270`, `:308` — owner-only `story_11_2_record_audit_event_internal`; never grant client execution.
- `supabase/migrations/20260929120000_resource_person_profiles_and_work_hours.sql:6`, `:15`, `:117`, `:172`; `20261002171427_resource_command_only_write_acl.sql:3` — reuse membership/profile/work-role composites, checked resource writes and disabled-history semantics. Existing profile RLS excludes Montor, so a caller-RLS profile join cannot prove own-booking access.
- `supabase/migrations/20260630120000_crm_data_model.sql:136`, `:172`; `20260709120000_acceptance_to_job_model.sql:169`, `:195`, `:218` — nullable CRM/job connections and same-tenant composite parents; tenancy alone does not guarantee coherent supplied parent combinations.
- `src/server/commands/quotes/validation.ts:268`; `src/server/commands/provisioning/validation.ts:139`; `supabase/migrations/20260910165124_admin_user_management.sql:101`, `:105`, `:125` — UUID normalization, canonical identity, transaction locks and durable replay precedents. No generic envelope idempotency exists.
- `src/server/commands/crm/crm-db.ts:84`, `:99`; `src/server/commands/command-errors.ts:119` — typed RPC adapter and stable existing `COMMAND_CONFLICT` mapping.
- `tests/integration/rls/tenant-table-inventory.ts:157`, `:319`, `:388`, `:447`, `:917`, `:1164`, `:1399`, `:1706`, `:1769` — exhaustive table enrollment and cross-tenant/anon metadata; writes are privilege-denied, public-column reads remain RLS-scoped.
- `tests/integration/rls/cross-tenant-isolation.rls.test.ts:519`; `tests/support/authz/role-harness.ts:13`, `:29`, `:184`; `tests/integration/rls/role-harness.atdd.int.test.ts:51`, `:67`, `:136`, `:177`; `tests/integration/rls/migration-reset.int.test.ts:224`, `:343`, `:472` — extend public-column projection, actual per-role assignment fixtures, and exact SELECT-only policies/ACL assertions.
- `_bmad-output/planning-artifacts/architecture-phase-b.md:702`, `:741`, `:749`, `:751`, `:763`; `_bmad-output/test-artifacts/test-design-epic-14.md:146`, `:184`; `docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md` — booking/time/workflow facts and retained/transferred acceptance. Story 14.1 continuity: retain existing work-role catalogue and historical deactivated profiles; no duplicate employee model.

## Tasks & Acceptance

**Execution (dependency order):**

- `src/scope/manifest.ts`, `src/server/authz/permission-matrix.ts`, `src/server/commands/envelope.ts` — enroll `bookings`, `booking_assignees`, `booking_conflicts` only in resources. Add resource-owned `Bookings.View` for tenant_admin/projektledare/montor and `Bookings.Manage` for tenant_admin/projektledare; enroll `createBooking`/`updateBooking` in the closed command map. Preserve existing resource-profile permissions and pending scheduling.
- `supabase/migrations/*_bookings_and_assignees.sql` — create one additive migration via `supabase migration new bookings_and_assignees`, following current CLI help. Implement the schema and authority below; extend missing parent composite uniqueness additively. Pin every function search path, qualify relations, enforce same-tenant and mutable-field invariants, and add tenant/range/assignee query indexes. No dependency or environment change is required.
- `src/features/resources/booking-types.ts`, `src/server/commands/bookings/validation.ts` — define pure shared booking types and explicit public read columns; validate the I/O matrix, normalized UUIDs, positive UTC ranges, Stockholm all-day boundaries, one or more distinct assignees, nullable connections, bounded text according to existing validator conventions, status and standalone series seams. Canonicalize equivalent instants, omitted/null connections and assignee order; never trust actor/tenant, digest, derived conflicts or workflow acceptance from caller input.
- `src/server/commands/bookings/booking-db.ts`, `create-booking.ts`, `update-booking.ts` — use typed adapters and `defineCommand`, resolved actor/tenant/correlation, update ownership and SQL-owned audit (`auditable:false`). Invoke only checked outer RPCs. Return the stored target-only result and stable generic error codes; unexpected faults become retryable `SERVER_ERROR`, reused changed-content keys become `COMMAND_CONFLICT`. Do not create a route, server action or UI caller. Supply the private transaction foundation for 14.3 without detector callback/stub or detection-success fields.
- `tests/unit/server/commands/bookings-validation.test.ts`, `tests/unit/server/authz/permission-matrix.test.ts`, `tests/unit/server/authz/role-harness.test.ts`, `tests/unit/scope/resources-activation.atdd.test.ts`, and existing `tests/unit/scope/manifest-coherence.test.ts`, `manifest-derivations.test.ts`, `manifest-shape.test.ts` — pin matrix/manifest scope and every I/O matrix validation/canonicalization edge, including UUID case duplicates, permutation/equivalent-time replay identity, DST all-day boundaries and rejection of fabricated series/conflict authority.
- `tests/integration/rls/tenant-table-inventory.ts`, `tests/integration/rls/cross-tenant-isolation.rls.test.ts`, `tests/support/authz/role-harness.ts`, `tests/integration/rls/role-harness.atdd.int.test.ts`, `tests/integration/rls/migration-reset.int.test.ts` — enroll all exhaustive metadata seams and exact read policies. Add table-specific public read projection for bookings instead of SELECT *, while retaining successful empty cross-tenant reads; separately prove private outcome-column denial. Seed Montor-own, shared-assignee and coworker-only bookings using actual per-role profiles; do not widen existing profile access or weaken exact policy/H4 gates. Seed concrete foreign rows for all three tables and exercise existing anon/cross-tenant suites.
- `tests/integration/commands/bookings.int.test.ts`, `tests/integration/rls/bookings.rls.test.ts` — implement every retained named check below through actual envelope/checked-RPC entry and exact privileged durable-state readbacks. Test INSERT/UPDATE/DELETE denial even for own-tenant admin, private primitive execution denial, forged/missing actors, role revocation, disabled/invited/nonmember/anon states, foreign parent/child links, private outcome visibility, replay after later update/deactivation, membership-deactivation races and audit failure rollback. Use unique fixture IDs and deterministic faults after booking and assignee preparation; do not leave acceptance cases skipped.

**Retained check inventory:** P0: `14.2-INT-001`, `14.2-RLS-001`. P1: `14.2-DB-001`, `14.2-DB-002`, `14.2-DB-003`, `14.2-DB-004`, `14.2-DB-005`; `14.2-INT-002`, `14.2-INT-003`, `14.2-INT-004`, `14.2-INT-005`, `14.2-INT-006`, `14.2-INT-007`, `14.2-INT-009`, `14.2-INT-010`; `14.2-RLS-002`, `14.2-RLS-003`, `14.2-RLS-004`.

**Acceptance Criteria:**

1. Given migrated resources schema, when the manifest/H4/exact-policy/matrix gates inspect it, then exactly the three new resource-owned tables are enrolled, caller direct writes and private primitive execution are denied, and scheduling has no live surface.
2. Given an entitled admin/planner invokes the actual create command, when validation succeeds, then one booking, the exact distinct assignee set, durable command outcome and exactly one attributable target-only audit event commit together (14.2-INT-001, P0).
3. Given an existing same-tenant booking, when a fresh authorized update completes, then identity/create history is preserved and mutable fields, exact replacement assignments, one update outcome and one new audit event change atomically (14.2-INT-002, P1).
4. Given a completed command, when replayed with equivalent canonical input or raced concurrently, then the original target-only outcome is returned with unchanged row/audit counts, including after later update or deactivation; changed canonical content under the same scoped key returns COMMAND_CONFLICT and changes nothing (14.2-INT-003/004/005, P1).
5. Given fresh create or update, when a booking/assignee preparation fault or audit-write fault occurs, then booking, assignments, command outcomes and audit return exactly to the pre-command snapshot; no durable partial state exists (14.2-INT-006/007, P1).
6. Given standalone or linked input, when persisted/reloaded, then independently nullable parents remain valid and coherent supplied same-tenant relationships and existing jobs.id are preserved; foreign/mismatched parents, duplicate/foreign assignees, nonpositive time and invalid all-day bounds fail atomically (14.2-DB-001/002/003/004/005 and INT-009, P1). UTC storage round-trips the intended Stockholm interval across both DST boundaries.
7. Given a deactivated profile, when it is newly added, then assignment is denied; when previously assigned history is read or unchanged assignment retained, then it survives without cascade (14.2-INT-010, P1).
8. Given cross-tenant callers, when they read or directly/indirectly mutate any booking table, then no foreign rows or existence details are exposed and no business/outcome/audit state changes (14.2-RLS-001, P0).
9. Given an active Montor, when reading own/shared/coworker-only bookings and children or attempting mutation, then only assigned bookings, own assignment rows and own-participation conflicts on visible bookings are readable, and mutation is denied; admin/planner succeeds within tenant while every direct callable wrapper independently rechecks authority (14.2-RLS-002/003/004, P1).
10. Given completion of 14.2, when scope and evidence are inspected, then it provides foundation acceptance only, exposes no booking entry point and preserves the mandatory 14.3 detector integration gate before any 14.4 work and the Epic PR.

## Design Notes

### Schema decisions within the approved story

`bookings` carries stable UUID/tenant identity; starts_at/ends_at timestamptz; all_day; nullable work_role_id, job_id, customer_id, facility_id, contact_id; description; status initially `planned|cancelled` (default planned); created_at/updated_at; nullable series_id/occurrence_index and is_exception false. Status is booking planning state, not job completion. Only the listed business facts and assignments are mutable. Commands require at least one assignee. Standalone commands require series_id/occurrence_index null and is_exception false; these reserved columns provide storage compatibility only, with no booking_series table or fabricated recurrence. Future E15 widens the seam additively.

All connections remain independently nullable. Composite FKs prove tenant identity; inside the transaction, supplied customer/facility/contact combinations must agree with each referenced parent's customer and with supplied job-owned links when those links exist. Do not infer or force absent links, change jobs, or require a connection. Work roles reuse the existing active catalogue. Validate newly added assignments against active profile and membership while locking affected memberships in deterministic order; retain unchanged historical disabled assignments instead of delete/reinsert rejection. Assignees are unique `(booking_id,person_profile_id)` with composite same-tenant booking/profile parents.

Timed commands accept explicit UTC instants; validation never uses the host timezone. All-day ranges must be exclusive local-midnight calendar bounds in Europe/Stockholm and may span 23/25-hour UTC days. Pin spring/fall storage round-trips. Local nonexistent/ambiguous-time policy stays first-valid/earlier as architecture specifies; this story does not implement conflict/capacity or recurrence time interpretation.

`booking_conflicts` stores tenant, booking, nullable related_booking and affected profile composite references, type (`double_booking|over_capacity|outside_work_hours|outside_access_window|competence_missing`), positive UTC window, stable natural_key, status (`open|accepted|resolved`), acceptance reason/actor/time and resolution outcome/actor/time. Actor references use same-tenant membership identity resolved from auth.uid; metadata pairs are coherent, accepted requires nonblank reason plus actor/time, resolved requires nonblank outcome plus actor/time. Unique tenant+natural_key separates workflow identity from detection; no acceptance can apply to a different key. 14.2 creates constraints and fixture-readable infrastructure, with no production conflict producer or acceptance/resolution command. 14.3 computes identity/derived rows; 14.4 supplies explicit override.

### Checked transaction and read authority

Use authenticated checked outer create_booking/update_booking wrappers, SECURITY DEFINER with empty search_path, calling private owner-only SECURITY INVOKER transaction primitives and the existing private audit writer. This composes the current quote/resource pattern: standalone INVOKER writes cannot work after caller DML revocation, while regranting DML would bypass the required atomic audit boundary. Recheck nonnull auth.uid, actor equality using IS DISTINCT FROM, active admin/planner role and explicit tenant/target predicates before replay or mutation; no service-role or client-granted private helper. FORCE RLS remains required, and definer code must enforce tenant predicates independently of RLS.

Authenticated has SELECT only on declared public booking columns; keep command keys/digests/results/outcome history owner-only. Anon has no DML. Use a narrow stable hardened boolean ownership helper joining assignment/profile/active membership to auth.uid; do not grant Montor general profile reads or make booking and assignee policies recursively depend on each other. Admin/planner reads same-tenant rows, Montor reads assigned bookings and own assignment rows. Conflict reads for Montor require own affected profile plus own visible booking; never expose unrelated coworker-only rows or unrestricted participant/profile reads. Verify the actual public projection in generated role and cross-tenant probes.

### Durable idempotency without a fourth table

CREATE scope is `(tenant,command UUID)`; UPDATE scope is `(tenant,booking UUID,command UUID)`. Store immutable create_command_id, create_payload_digest and original target-only create result on bookings, with unique tenant+create_command_id. Store append-only update outcomes in private JSONB keyed by normalized UUID, each with canonical digest and original target-only result. Keep all outcomes; no eviction/retention horizon is introduced. Growing history is a documented storage tradeoff.

Acquire a transaction advisory lock for the canonical tenant/create key, or booking FOR UPDATE for updates. Authorize first, inspect/replay existing outcomes next, and only then validate mutable current parent/profile state and prepare new writes. Rebuild canonical identity in SQL from validated typed fields, including operation/target, normalized UUIDs/UTC values, normalized nulls and sorted assignees; never trust a supplied fingerprint. Equal replay returns stored result, unequal replay returns COMMAND_CONFLICT before mutation. New outcomes and a single target-only audit are part of the same transaction; suppress the envelope's additional audit. Rollback covers outcome history and audit as well as business rows.

### Detector handoff and sequencing

14.3 exclusively owns pure `src/features/scheduling/conflicts.ts` and a real authoritative integration mechanism that re-reads current facts and writes conflicts in the same transaction. A PostgreSQL foundation alone does not execute that TypeScript engine. Preserve private transaction extensibility and avoid claiming preview/save equivalence, derived refresh or authoritative detection now. No hardcoded empty-conflict success, stub detector, duplicated rules or client detection authority is allowed.

Mandatory transferred checks: 14.3-INT-003 (P0, derived create atomicity), 14.3-INT-004 (P1, update refresh/stale-row replacement), 14.3-INT-005 (P1, post-conflict rollback), 14.3-INT-006 (P0, collision committed after preview detected at save). These preserve the conflict portions of 14.2-INT-001/002/007 and all original 14.2-INT-008. Every transferred check passes before any 14.4 work and the Epic PR. Retain ATDD, independent review, automation, cumulative regression and all Epic gates. There is no acceptance waiver.

Planning concerns for the future author trail: checked command entry/SQL authority; normalized replay and transaction rollback; row-scoped reads/composite relationships; retained and transferred evidence. The implementation author writes the final Suggested Review Order only after implementation/verification; planning does not manufacture verified implementation stops.

## Verification

Planning used rendered installed Build Auto Step 2 and read-only source inspection at `4d2f29a5b3b084c2f25895b753cc2a0e43f6a1e1`. No product verification is claimed by planning.

**Required implementation commands:**

- `pnpm run typecheck`, `pnpm run lint`, `pnpm run test:unit` — expected: strict schema/capability/inventory types and pure validation/manifest/canonicalization evidence pass.
- With a verified authorized local stack and `$env:SUPABASE_TEST_REQUIRED='1'`, `pnpm exec vitest run tests/integration/commands/bookings.int.test.ts tests/integration/rls/bookings.rls.test.ts tests/integration/rls/role-harness.atdd.int.test.ts tests/integration/rls/migration-reset.int.test.ts tests/integration/rls/rls-inventory-gate.int.test.ts tests/integration/rls/cross-tenant-isolation.rls.test.ts tests/integration/rls/anon-path-isolation.rls.test.ts` — expected: all 18 named obligations, exact durable snapshots, direct RPC/DML negatives, grants/private-column protection and inventory execute without acceptance skips. Use pnpm exec vitest for targeting; do not rely on the previously ineffective pnpm script filter.
- Under the same required local-stack setting, `pnpm run test:int` — expected: full required integration/RLS plus cumulative resource command/RLS regression executes; report executed/failed/skipped counts and explain every skip. Explicitly skipped acceptance is missing evidence.
- Run local lockfile/source containment, build then built-bundle containment, and the required local integration commands above. Per `docs/quality/ci.md` and `.github/workflows/ci.yml`, stage 6 empty DB → all migrations → seed and stage 8 required integration form the separate CI `db` job; that exact chain remains MANDATORY for Epic finalization and before merge. A new local empty-schema replay is not required for each story. Record actual local incremental SQL application separately; do not claim empty-schema or complete stack-rebuild evidence from schema inspection, or launch/reset infrastructure without its applicable authorization.

**Readiness checks:** every task has an implementation path and action; dependency order is explicit; ACs observe the checked command and durable/read surfaces in Given/When/Then form; all retained/transferred obligations are mapped; no unresolved business intent, TODO or stub remains. Compare the intent contract byte-for-byte with the committed draft and verify only this spec changed.

## Spec Change Log

- 2026-10-06: Owner-approved contract C resolves the prior sequencing intent gap. Restored this existing spec to `draft` for Step 2 re-planning; aligned acceptance ownership and preserved the original blocked result below as historical evidence. This preparation does not mark the story ready for development, run ATDD/build/review, or satisfy implementation gates.

- 2026-10-06: Step 2 re-planning at 4d2f29a5b3b084c2f25895b753cc2a0e43f6a1e1 resolved technical command authority, private durable replay storage, own-assignment fixtures/projections and concrete schema semantics. Preserve the intent contract and all historical blocker/recovery evidence; retain all 18 foundation checks and four mandatory transfers. This is planning only.

## Auto Run Result

Status: done

Blocking condition: none

Review loop iterations: 0 (this follow-up invocation; completed review rounds: 2)

Follow-up review recommended: true

### Round 2 canonical completion — 2026-10-06

Canonical HALT: done. All six fresh independent layers completed against one frozen cumulative diff before triage, including the actual external Sol 6.1 High read-only CLI (native 0, `No findings.`). Round 2 patches: high 1, medium 0, low 1; intent_gap=0, bad_spec=0, defer=0, reject=0. High replay-authority correction and the direct checked-RPC clock grammar regression are implemented. Follow-up review recommended: true due to the High patch; weighted medium/low score is 1. Two completed broad rounds are recorded; one further broad round remains available under the three-round cap.

New forward migration `20261006113212_booking_replay_current_authority.sql` rechecks current actor authority under the actor lock after CREATE advisory / UPDATE booking-row serialization, before replay result return. Existing sorted fresh-write locking, historical assignee replay and private ACLs remain. The author reproduced all six waiting-call races before application: native 1, 11 cases, five passed, six failed, zero skipped. After explicit local CLI push, required focused booking verification exited native 0: 32/32 passed, zero failed/skipped. All 91 prior serialized ledger records are unchanged, including 01609/04143; exactly one forward version was added. No reset, new database or hosted action occurred.

The resulting normal-parallel required integration gate exited native 0: 128 files, 1,305 cases; 1,304 passed, zero failed, one explicitly skipped isolated recovery-Storage-loader proof. All 32 booking cases executed. Result: `../test-artifacts/story14-2-followup-round2-completed-integration-results.json`. The preceding two native-1 full reports are preserved separately: 1,303 pass/one failure/one skip, then 1,302 pass/two failures/one skip. Those concrete prerequisite failures led to approved author repairs: recipient readback orders by authoritative delivery_sequence with every snapshot/audit assertion retained; helper metadata queries select exact public UUID signatures, retaining exactly-two-row/SECURITY DEFINER/exact-empty checks and the parallel adversarial test. Required affected evidence: recipient 3/3 and helper/adversarial 15/15 passed with zero skips. No clock tie, reversal, helper defect or historical PFD cause is claimed.

Typecheck and targeted lint exited native 0; full lint native 0 with zero errors and 13 existing warnings. Security advisors exited 0 with no issues. Existing full unit (1,962 passed, zero failed, one Windows Linux-xattr skip), production build/install/audit/containment evidence below is retained from the prior verified revision; no unchanged broad gate was rerun solely for this trail. The final narrow independent fix/trail review reported `No findings.`; checker native 0, exactly one author-written section, 27 references/no errors, actual UTF-8 replacement count zero. Frozen intent remains unchanged against the baseline at repository line endings.

Additional changed files in this follow-up:

| File | Change |
| --- | --- |
| `supabase/migrations/20261006113212_booking_replay_current_authority.sql` | Adds post-serialization current-actor replay checks without rewriting applied migrations. |
| `tests/integration/commands/bookings-replay-authority.int.test.ts` | Retains three sequential cases and adds six deterministic waits plus two direct SQL clock cases. |
| `tests/integration/email/quote-delivery-recipient-snapshot.int.test.ts` | Orders exact recipient snapshot readback by authoritative delivery sequence. |
| `tests/integration/rls/migration-reset.int.test.ts` | Identifies exact public UUID helper signatures in two metadata queries. |
| `_bmad-output/test-artifacts/story14-2-followup-round2-review.md` | Preserves independent layers, triage, reproduced failures, fixes and limits. |
| `_bmad-output/test-artifacts/story14-2-followup-round2-integration-results.json` | Preserves the first resulting full native-1 report. |
| `_bmad-output/test-artifacts/story14-2-followup-round2-final-integration-results.json` | Preserves the second resulting full native-1 report. |
| `_bmad-output/test-artifacts/story14-2-followup-round2-completed-integration-results.json` | Records the final resulting full native-zero report. |

Remaining gates: exact empty-schema migrations → seed → required-integration CI remains mandatory at Epic finalization/before merge; all four transferred 14.3 detector checks remain mandatory before 14.4 and the Epic PR. This story exposes no detector, UI or live scheduling surface. Historical quote-send cause remains unconfirmed. Completion-hook reconciliation re-engages the actual fix author after the local commit; no push or root orchestration-state edit is authorized.
Canonical HALT: done. The approved internal booking foundation is implemented and every required local gate is native zero. All 18 retained Story 14.2 acceptance obligations and three added regressions execute; resources owns the new tables and scheduling remains pending. No detector or booking browser surface is claimed.

Files changed:

| File | Change |
| --- | --- |
| `_bmad-output/implementation-artifacts/spec-14-2-bookings-and-assignees-schema-and-transactional-commands.md` | Records completed scope, gate history, decisions and the author review trail. |
| `_bmad-output/test-artifacts/story14-2-build-routing.md` | Records model/effort choices before implementation and independent review. |
| `_bmad-output/test-artifacts/story14-2-empty-chain-proposal.md` | Preserves the unexecuted contingency without claiming empty replay. |
| `_bmad-output/test-artifacts/story14-2-full-integration-results.json` | Captures the final native-zero normal-parallel integration result. |
| `_bmad-output/test-artifacts/story14-2-independent-review-evidence.md` | Records independent findings, triage, narrow reviews and final local gates. |
| `pnpm-workspace.yaml` | Pins scoped compatible dependency replacements and the exact Next plugin patch. |
| `pnpm-lock.yaml` | Locks the reviewed dependency resolutions and patch hash. |
| `patches/@next__eslint-plugin-next@16.3.6.patch` | Preserves direct directory-root glob semantics for the affected plugin. |
| `src/features/resources/booking-types.ts` | Defines internal booking contracts and the safe public projection. |
| `src/scope/manifest.ts` | Enrolls booking tables in resources while scheduling stays pending. |
| `src/server/authz/permission-matrix.ts` | Defines booking view/manage capabilities and closed role grants. |
| `src/server/commands/envelope.ts` | Enrolls actual create/update booking commands in the capability map. |
| `src/server/commands/bookings/booking-db.ts` | Maps checked SQL results and safe deterministic booking failures. |
| `src/server/commands/bookings/create-booking.ts` | Executes audited transactional create through the command envelope. |
| `src/server/commands/bookings/update-booking.ts` | Executes ownership-checked transactional update through the envelope. |
| `src/server/commands/bookings/validation.ts` | Normalizes payload identity while retaining six-digit instant precision. |
| `supabase/migrations/20261006101609_bookings_and_assignees.sql` | Contains recovered applied schema, authority, replay and atomic write statements. |
| `supabase/migrations/20261006104143_booking_invariant_corrections.sql` | Records forward role-ownership, strict instant and series-coherence corrections. |
| `tests/factories/tenants/core.ts` | Installs safe shared final-send diagnostics on authenticated fixture clients. |
| `tests/integration/commands/bookings.int.test.ts` | Executes retained write/replay/rollback/DST and concurrent-update acceptance. |
| `tests/integration/commands/quote-pdf-validity.int.test.ts` | Retains exact send-precondition failures with safe stage diagnostics. |
| `tests/integration/commands/update-job.int.test.ts` | Retains safe RPC witnesses when its real final-send fixture fails. |
| `tests/integration/rls/bookings.rls.test.ts` | Executes booking reads, direct-write/private ACL and secondary-role revocation. |
| `tests/integration/rls/cross-tenant-isolation.rls.test.ts` | Includes safe booking projections in the parameterized isolation proof. |
| `tests/integration/rls/migration-reset.int.test.ts` | Checks booking FORCE RLS and exact live policies in current schema. |
| `tests/integration/rls/role-harness.atdd.int.test.ts` | Retains every generated command check in separate bounded role cases. |
| `tests/integration/rls/tenant-table-inventory.ts` | Enrolls all three tables and their safe fixture/read projections. |
| `tests/support/authz/role-harness.ts` | Adds booking facts for generated role-boundary probes. |
| `tests/support/bookings-atdd.ts` | Provides exact booking snapshots, fault fixtures and actor facts. |
| `tests/support/quote-send-diagnostics.ts` | Observes send failures without changing builders, authority or results. |
| `tests/unit/admin-users/read-pagination.test.ts` | Aligns bounded role-batch fixtures with the approved 50-ID limit. |
| `tests/unit/dependencies/next-lint-root-globs.test.ts` | Tests the installed patched glob helper and actual Next anchor rule. |
| `tests/unit/quote-send-diagnostics.test.ts` | Tests lazy/fluent identity, untouched unrelated RPCs and redaction. |
| `tests/unit/scope/manifest-derivations.test.ts` | Updates manifest-derived table expectations. |
| `tests/unit/scope/manifest-shape.test.ts` | Updates the exact resource table inventory contract. |
| `tests/unit/scope/resources-activation.atdd.test.ts` | Retains active resources and pending empty scheduling surfaces. |
| `tests/unit/server/authz/permission-matrix.test.ts` | Tests exact booking capability grants. |
| `tests/unit/server/authz/role-harness.test.ts` | Tests generated booking command capability enrollment. |
| `tests/unit/server/commands/bookings-validation.test.ts` | Tests canonical timestamps, assignment identity and invalid inputs. |
| `tests/unit/support/test-env.test.ts` | Derives expected origin independently while preserving exact diagnostics. |

Previously recorded required evidence before this follow-up (retained history, not re-executed where stated):

- Full normal-parallel integration: native 0; 127 files, 1,294 cases, 1,293 passed, zero failed, one explicitly skipped separate isolated recovery-Storage-loader proof. Required mode uses explicit local API/database overrides 55421/55422. The inspected JSON is `../test-artifacts/story14-2-full-integration-results.json`.
- Full unit: native 0; 98 suites, 1,963 cases, 1,962 passed, zero failed, one Linux-xattr skip on Windows, zero todo. The diagnostic-origin fixtures independently derive expectation from controlled environment input and retain all exact status/timeout/privacy assertions.
- Typecheck and full lint: native 0; lint has zero errors and 13 existing warnings. Production build, frozen install, lockfile/source containment and post-build bundle containment pass. Unchanged-threshold dependency audit: native 0, zero high/critical and two moderate advisories; no waiver or threshold change.
- Independent review: all six initial layers executed before triage. Round 1 applied four patches, deferred zero items and rejected one candidate; intent_gap=0 and bad_spec=0. Patched counts: high=0, medium=3, low=1; score `3 × 3 + 1 × 1 = 10` retains follow-up recommendation true. Later independent reviews were narrow fix/dependency/security/diagnostic/trail checks. Evidence: `../test-artifacts/story14-2-independent-review-evidence.md`.
- Exactly one author-written Suggested Review Order has 23 verified stops and zero checker errors. Frozen intent is unchanged against baseline `4947dbb44089c0462619c63443f3107712dc4cc7`.

Applied migrations: `20261006101609` and forward `20261006104143`. The original source was recovered from 32 retained ledger statements with normalized separators/line endings: statement-equivalent recovery, not byte-identical original layout. The forward migration durably records six corrections. No ledger edit, reset or new database occurred.

Remaining boundaries: the exact empty DB → all migrations → seed → required integration GitHub CI database chain remains MANDATORY for Epic finalization/before merge and is not claimed as executed locally. All earlier varying final-send failures and the `time_current=false` post-failure witness remain recorded; mechanism and direction are unconfirmed, and the green cumulative result does not prove a clock fix. No production guard, TTL or machine clock changed. The four transferred Story 14.3 detector checks remain mandatory before 14.4 and the Epic PR; performance/volume remains unmeasured.

Local checkpoint: the parent authorized local author commits for only the reviewed Story 14.2, prerequisite, dependency and evidence files after its evidence-ready handoff. The prerequisite fixture repair is committed separately; remaining reviewed content is committed with this terminal author spec. No push, PR, hosted operation or root orchestration-state edit is authorized. The completion hook reconciles this same trail after committing and reports the actual revision/status through the parent contract.

## Review Triage Log

### 2026-10-06 — Review pass (completed round 2)
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 1, medium 0, low 1)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high]` `[patch]` Completed CREATE/UPDATE replay could return after a serialization wait despite intervening actor revocation. Added forward-only actor SHARE/current-role rechecks and six deterministic production-revocation races; all reproduce before correction and pass after it.
  - `[low]` `[patch]` Strict SQL clock grammar had no authorized direct-RPC negative. Added create/update hour/minute/second boundary rejection and exact unchanged durable-state assertions.

All six required independent layers executed before this triage. Intent and prior round 1 history remain unchanged. Narrow convergence corrected author-trail encoding and separately authorized prerequisite fixtures exposed by actual resulting gates; these do not constitute another broad review round. No rejected or deferred finding requires a dismissal rationale.
## Historical Auto Run Results


### Historical canonical planning halt — 2026-10-06

Status: ready-for-dev

Blocking condition: none

HALT: invocation explicitly required halt after planning. Step 2 readiness gate passed after re-reading the rendered workflow and repaired spec from disk: actionable file-scoped tasks, dependency order, Given/When/Then outer-surface acceptance, complete retained/transferred check inventory and coherent technical boundaries. The intent contract matches the committed draft byte-for-byte; historical blocker/recovery records remain preserved. Oversized warning records the necessary cross-layer planning detail.

Planning evidence: installed renderer completed successfully; two synchronous Sol 6.1 High read-only exploration delegates supplied source maps and acceptance traceability at 4d2f29a5b3b084c2f25895b753cc2a0e43f6a1e1. Only this spec is modified. git diff --check passed. No implementation, product test execution, infrastructure launch, hosted action or Git commit/branch/push/PR occurred. No performance or volume acceptance number is invented; scale remains unmeasured advisory evidence.

On Complete: docs/process/review-order.md Completion-hook protocol preserves this planning result; completed implementation trail reconciliation is inapplicable. No Suggested Review Order was manufactured. Continue through the root-owned ATDD/build/review gates when dispatched.


### Historical planning halt — 2026-10-02

Status: blocked

Blocking condition: intent gap

Evidence: the current codebase has no `src/features/scheduling/conflicts.ts`, booking command, booking table, or conflict detector. The authoritative Epic breakdown assigns the only pure, clock-free detector and its in-transaction recheck to Story 14.3 (`_bmad-output/planning-artifacts/epics-phase-b.md:1536`), while the approved Epic 14 test design assigns Story 14.2 P0 acceptance for current-row save detection and atomically persisted derived conflicts (`_bmad-output/test-artifacts/test-design-epic-14.md:133-134`, `:175`, `:299`). Implementing that detector here would consume Story 14.3 scope; omitting it leaves required Story 14.2 P0 criteria unimplemented.

Unanswered decision: choose one recorded sequencing contract before implementation: (1) move the pure detector and server recheck into Story 14.2, then narrow Story 14.3; (2) make Story 14.3 a prerequisite and run it before resuming Story 14.2; or (3) revise the Story 14.2 acceptance/test-design entries so it supplies only schema and transaction plumbing, with no claimed derived-conflict/current-row evidence until Story 14.3. The current sources do not select among these outcomes.

Resolved planning facts: `resources` owns the new tables because it is already active; `scheduling` remains pending. The existing matrix and test design establish admin/projektledare mutation with Montör own-assignment read only, so capability names are an implementation choice under deny-by-default rather than a blocker.

### Planning recovery — 2026-10-06

Status: draft (re-planning input)

Resolved blocking condition: the owner explicitly selected contract C in `docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md`; the authoritative Epic sketches, test design, and cached context now record the revised acceptance ownership. The historical unanswered decision above is superseded by that approval.

The installed `bmad-build-auto` Step 1 routes an explicitly supplied `draft` spec to Step 2 planning and rejects a `blocked` spec. Reuse this same file; do not treat this recovery as ready-for-dev or as implementation evidence. The root must first commit the preparation and satisfy its clean-tree gate, then resume normal re-planning and remaining quality gates. No build workflow, product code, tests, migrations, local resources, or hosted actions were executed in this preparation.

## Implementation Author Evidence — 2026-10-06

Implemented the internal booking foundation in the final uncommitted working tree based on `4947dbb44089c0462619c63443f3107712dc4cc7`. The implementation author was dispatched as gpt-6.1-sol / High for authorization, tenant isolation and transactional integrity. Before nested test-author dispatch, gpt-6.1-sol / High was selected for actual RLS, authority and transactional rollback assertions. No managed-resource launch, hosted operation, Git commit, push or PR was performed by this implementation author; the nested test author performed no resource launch.

The new migration was created with `supabase migration new bookings_and_assignees` after reading CLI help. The additive SQL was applied only to the parent-verified local database at loopback port 55422 with `supabase db push --db-url <explicit-local-url> --skip-vault --yes`; the password was supplied privately through the child environment. Subsequent owner-only local function/constraint corrections aligned strict instant validation, multi-role Montor ownership and the series pair with the final migration. Existing CRM/job composite uniqueness is reused in the final schema. The initial applied source was subsequently recovered from its 32 original ledger statements with normalized line endings and statement separators; this is statement-equivalent recovery, not a claim of byte-identical original layout. Forward migration `20261006104143_booking_invariant_corrections.sql`, created by CLI and applied to loopback 55422, durably records all effective local corrections in six statements without editing the first ledger entry. Both versions are present; live schema inspection confirms the nonnull series pair, secondary-role ownership and strict hour validation. This is incremental application and local schema inspection, not an empty-schema SQL reset or complete stack rebuild.

Initial author verification (before the accepted review fixes):

- `pnpm run typecheck`: passed; final targeted ESLint passed. Full `pnpm run lint`: zero errors, 13 warnings in pre-existing unrelated files.
- `pnpm run test:unit`: 1,958 tests; 1,957 passed, zero failed, one explicitly skipped Linux-xattr recovery test on Windows. Booking validation includes normalized UUID/equivalent instant/assignee permutations, invalid authority/recurrence input, invalid dates and positive ranges, and both Stockholm DST all-day transitions.
- `node node_modules/vitest/vitest.mjs run` with the seven required booking, booking-RLS, role-harness, migration-inspection, H4, cross-tenant and anon files: 418 passed, zero failed, zero skipped across seven files, with `SUPABASE_TEST_REQUIRED=1` and explicit API/database port overrides 55421/55422. The same Vitest runner was used after a sandbox pnpm store-lock denial. All 18 retained named Story 14.2 checks executed.
- `pnpm run build`, `verify:lockfiles`, `verify:service-role-containment`, and post-build `verify:bundle-containment`: passed.
- `pnpm audit --audit-level=high`: failed on two high and two moderate transitive advisories. The parent is handling authorized compatible remediation; no audit waiver or story dependency mutation is claimed here.
- Parent full normal-parallel integration first run: 1,287 total, 1,285 passed, one failed, one pending. The sole failure was the cumulative generated command-role monolith at 30,017ms against the existing 30-second test budget. The author split that loop into five parameterized role cases while retaining every generated command probe, result/code assertion and before/after audit count. The timeout and normal parallel configuration are unchanged. Final typecheck and targeted harness lint passed; the full resulting integration gate remains pending parent execution.
- Independent review remains parent-owned at this author handoff.

The first full unit run exposed two stale prerequisite pagination fixtures. Exact committed baseline files at `4947dbb44089c0462619c63443f3107712dc4cc7`, extracted to a temporary directory and executed in isolation, reproduced two passes/two failures. `tests/unit/admin-users/read-pagination.test.ts` now derives bounded-role fixture/assertions from the approved 50-ID batch limit. It still proves complete root pagination, every bounded role batch and fail-closed output after a later role-batch failure. Valid 50-member batches with five roles cannot reach the 500-row next-page boundary. No pagination product code or authority invariant changed; the repaired file passes four tests and the full unit gate is green.


## Review Fix Log — Round 1

All six required independent review layers executed. Triage: three Medium patches, one Low accepted finding, one rejected candidate; intent_gap=0, bad_spec=0, deferred=0. Score 10 sets `followup_review_recommended: true`. Subsequent review is restricted to these fixes, introduced regressions and unresolved consequential findings; the three-round cap remains.

- Medium: align public command and checked RPC precision. The validator now accepts 1–6 fractional digits, preserves all six during UTC normalization, compares canonical instants without millisecond truncation, and rejects nonzero fractional all-day boundaries. Actual cross-RPC/envelope create and update replay covers every supported precision and exact durable timestamps/results.
- Medium: add deterministic concurrent UPDATE evidence. A held booking row lock and observed blocking dependency chain prove overlapping same-key calls. Identical inputs commit one outcome/audit; different inputs produce one winner and a stable COMMAND_CONFLICT loser with exact business/outcome/audit readbacks. Production row locking is retained.
- Medium: prove actual secondary Montor RLS. Scalar saljare and ekonomi memberships with a child Montor role see own/shared booking rows, own assignments and own-participation conflicts. Child-role revocation removes those reads; mutation remains denied.
- Low: preserve a real optional-stack context. The prior snapshot's `test.each` callback was already corrected to `test.for`; actual unreachable-loopback execution proves the role-harness metadata case passes and all eight DB/context cases visibly skip. Required mode fails during global setup. Booking tests also use explicit optional/required stack gates; these skips are not acceptance evidence.
- Rejected: adding a new invariant that forever prevents a later CRM contact move. The approved contract validates same-tenant composites and coherent supplied parent facts during booking writes; it does not add permanent CRM immutability or a new parent-mutation guard.

The owner separately authorized bounded prerequisite dependency security repair. `source-map-js` is pinned to 1.2.2. Only `@next/eslint-plugin-next@16.3.6` replaces its fast-glob dependency with pinned tinyglobby 0.2.17, paired with a version-scoped pnpm patch retaining directory-only matches, disabling nested directory expansion and preserving relative/absolute root behavior. Installed patched-helper tests cover physical nested roots, relative/absolute patterns, arrays, braces and missing paths; the actual Next `no-html-link-for-pages` rule still reports an internal `<a>` fixture. No global fast-glob alias, Next upgrade, audit ignore or threshold change was introduced.

Fix-batch evidence: `pnpm install --frozen-lockfile`, typecheck, full lint (zero errors/13 pre-existing warnings), build, lockfile/source containment and post-build bundle containment all passed. Full unit: 1,961 tests, 1,960 passed, zero failed, one Linux-xattr skip on Windows. `pnpm audit --audit-level=high` passed with zero high/critical and two moderate advisories. Booking integration: 21 passed, zero failed/skipped across two files under required local mode, including the 18 retained obligations plus the three new regression cases. Six booking validator tests and two installed dependency regression tests passed. The parent owns the resulting normal-parallel full integration and narrow independent follow-up review; no final cumulative result is manufactured here.

Verification scheduling correction: `docs/quality/ci.md` explicitly assigns empty DB → all migrations → seed → required integration to the separate CI `db` job. Neither the frozen intent nor the ACs requires a new local database per story. The ambiguous Verification scheduling was corrected outside the intent contract: exact empty-chain CI remains MANDATORY at Epic finalization/before merge, while this local run truthfully records incremental migration/function/constraint application. No new database/reset was authorized or executed, and the proposed scratch-database replay remains an unexecuted contingency. Applied-version reconciliation preserves `20261006101609` through statement-equivalent recovery from its read-only ledger snapshot, while `20261006104143` records the forward corrections. Review precision changes require no additional SQL mutation beyond that reconciliation.

### Cumulative PDF-send investigation

The resulting parent full normal-parallel run executed 1,294 tests: 1,292 passed, one failed and one explicitly skipped isolated recovery-loader proof. All booking and generated role-harness cases passed. The failure was the existing sent-quote PDF-regeneration precondition: `sendDraft` returned PFD10 in 766ms. The source path prepares a current-PDF challenge, verifies/signs downloaded bytes and then sends; no shared Vault mutation was found. The cause remains **unconfirmed**, and no baseline/flakiness or resolved product-defect claim is made.

The author added test-only diagnostics retaining only the prepare/send stage and generic SQL code/message. Attestation signatures, payloads and secrets are neither returned nor logged; production code and attestation/immutability guards are unchanged. A bounded focused retry executed that one required-mode case successfully with 26 other cases deselected; this does not substitute for the full gate. Final typecheck, targeted quote-test lint and diff check passed. The subsequent normal-parallel retry again executed 1,294 tests: 1,292 passed, one failed and one skipped. The PDF suite passed, while an existing update-job fixture's production `markQuoteVersionSent` prerequisite returned a false command result in 755ms. The failures are not asserted to share a cause. A test-only RPC observer now retains only failed function/code, allowlisted generic error text and boolean witnesses for current PDF/fingerprint/file/link/Storage, canonical issuance/expiry, exact window, generation time and HMAC agreement. Signing material remains only in the in-memory request and parameterized owner readback; no signature, key, timestamp, identifier or payload is emitted. Production functions, guards, parallelism and timeouts remain unchanged.

A bounded joint retry of the two implicated files passed all 37 cases with zero skips. Installed Vitest source confirms the default isolated fork pool; environment mutations found in failure tests are restored in their isolated workers, and no shared Vault mutation was identified. A subsequent full normal-parallel run again executed 1,294 cases: 1,292 passed, one failed and one skipped. The two previously implicated files passed, while `accept-quote-and-create-job` INT-07 failed its production final-send prerequisite with `VALIDATION_FAILED` in 1,565ms. Those earlier failures have no captured common cause.

The authenticated fixture factory now installs one shared observer for the four prepare/authorize/finalize/legacy-send RPCs. It preserves the actual lazy Postgrest builder, fluent methods, response identity and rejection identity; unrelated RPCs are untouched. Two executed unit cases verify those properties and generic-message redaction. An independent focused High security review reported no findings. Readbacks occur only after failure, so their boolean/time witnesses describe subsequent state rather than the exact locked verifier instant. No proof, secret, identifier, absolute timestamp or payload is emitted; the owner additionally authorized relative numeric time deltas.

An explicit three-run focused cap used the three implicated files with `SUPABASE_TEST_REQUIRED=1`, unchanged normal file parallelism and timeouts: run 1 passed 51/51, run 2 passed 50/51 with one failure, and run 3 passed 51/51; all had zero skips. Run 2 reproduced an update-job fixture failure at `finalize_quote_email_delivery`, PFD10, with the allowlisted invalid-attestation message. The subsequent readback had canonical issued/expiry, exact five-minute window, generation, HMAC, current fingerprint, active file/link and matching Storage all true; `time_current` alone was false. This narrows that reproduced failure to the time boundary but does not identify its direction or establish that the earlier incidents share its cause. The third run included separate future-issued/expired witnesses but did not reproduce an unexpected failure. Bounded read-only sampling found zero backward movements in 200 sequential single-backend statement timestamps, 400 sequential statements alternating eight backends, and 100,000 single-statement clock samples; occasional clock movement is not excluded. Further diagnosis and a native-zero full cumulative gate remain required. Typecheck and targeted observer/factory lint pass; no production guard or machine-clock adjustment was made.

A parent-dispatched independent High time/provenance expert reported that current local definitions match the recorded versions and that 27,028 synthetic microsecond inputs floor to milliseconds, never become future instants, and retain an exact five-minute window. This is separately reported expert evidence; the author did not execute that synthetic probe. The expert found no justified production correction. The owner then authorized a fresh maximum-three focused cap with separate issued/expiry predicates, relative numeric clock deltas and private-correlation `performance.now()` elapsed time from prepare response receipt to finalization completion. All three normal-parallel runs passed 51/51 with zero failures/skips; the cap ended and no automatic further run started. The expected forged-HMAC negative exercised the new timing output while preserving its rejection and authority assertions. No unexpected failure captured a split time predicate, so the original reproduction's time direction and causal mechanism remain unconfirmed. Final observer typecheck/lint and both SDK/redaction unit cases pass. These focused passes do not satisfy the still-required resulting full cumulative gate.

The resulting parent full normal-parallel integration run subsequently exited native zero: 127 files, 1,294 cases, 1,293 passed, zero failed, one explicitly skipped isolated recovery-Storage-loader proof. The JSON report was inspected and confirms these case counts and success. All prior failed runs and the unconfirmed time mechanism above remain historical evidence; this passing cumulative gate does not establish a clock cause or justify changing production guards.

The subsequent parent full unit run with explicit API 55421/database 55422 reported 1,963 cases: 1,960 passed, two failed and one Linux-only skip. Both failures were stale hardcoded diagnostic-origin expectations in `tests/unit/support/test-env.test.ts`. The authorized bounded fixture repair derives the exact expected origin independently from the controlled `process.env.SUPABASE_TEST_URL` input and documented literal local fallback, preserving allowlisted-only output, HTTP status, timeout reason, retry counts and fail-closed assertions. The file executes five passes under the same explicit local overrides and targeted lint passes; no reachability product code or port defaults changed. An intermediate parent full-unit rerun passed 1,962/1,963 with zero failures and one Linux-only skip. The expected-origin fixture was then refined to derive independently from environment input rather than the implementation export; the five targeted cases still pass. The resulting final parent full-unit run exited native zero: 98 suites, 1,963 cases, 1,962 passed, zero failed, one Linux-xattr skip on Windows and zero todo. Full lint exited native zero with zero errors and 13 existing warnings.



## Round 2 Fix Author Evidence — 2026-10-06

The round 2 fix author was dispatched as gpt-6.1-sol / High for current authorization and transactional integrity, against parent HEAD `dc2c0c897a9d3639fff8672b95d3898773126f46` and baseline `4947dbb44089c0462619c63443f3107712dc4cc7`. This author changed the new forward booking migration, booking replay/timestamp regression file and this evidence/review trail; the parent later explicitly added ownership of the scoped recipient-snapshot readback-order and exact public helper metadata-selector fixture repairs. The parent owns final cumulative gates, review disposition and commits.

The corrected reachable path is completed CREATE replay after an advisory-lock wait and completed UPDATE replay after a booking-row wait. Both previously returned a stored outcome after a pre-wait role check, even when another authorized administrator committed a membership revocation during the wait. Forward migration `20261006113212_booking_replay_current_authority.sql` takes a SHARE lock on the actor membership and rechecks the current active scalar/secondary authority inside each replay branch, before digest comparison or outcome return. Replay locks only the actor; fresh writes retain the existing combined sorted actor/assignee locking, avoiding an actor-first change to fresh-write lock ordering. Replay still returns historical outcomes before validating mutable assignment state. The legitimate `admin_manage_membership` path locks the same membership parent before role/status changes, including child-role replacement.

The six deterministic regressions first prove a successful stored CREATE/UPDATE and positive replay, hold the actual command advisory lock or booking row lock, observe `pg_blocking_pids`, commit an authenticated administrator's production membership RPC, and only then release serialization. Both operations cover primary-plus-secondary role removal, secondary-only planner removal and membership disablement. Each requires SQLSTATE `42501`, null result and exact unchanged post-revocation booking/assignment/conflict/outcome/audit snapshots. The one legitimate revocation audit is independently counted before lock release. The three prior sequential envelope/checked-RPC cases remain, including invited and disabled memberships; the production admin lifecycle has no active-to-invited transition to use for a legitimate wait-race case.

The timestamp regression directly calls both authenticated checked RPCs with entitled actors, bypassing TypeScript. It supplies `2026-10-12T24:00:00Z`, invalid minute 60 and second 60 in both start/end positions, with otherwise positive interval endpoints, and requires `23514`, null result and exact unchanged snapshots. This protects the strict SQL clock grammar already recorded in `20261006104143`; no timestamp production correction was needed.

Executed evidence in this fix working tree:

- Before applying the new migration, required replay/timestamp suite: native exit 1; 11 total, five passed, six failed, zero skipped. All six lock-wait authority cases reached the expected final assertion and reproduced stale successful replay; three sequential and two timestamp cases passed. Applied migrations were not rewritten for the red proof.
- CLI `supabase migration new booking_replay_current_authority` generated the new version after help discovery. Explicit loopback 55422 `supabase db push --db-url <private-local-url-with-sslmode=disable> --dry-run --skip-vault --yes` previewed only this version; the corresponding actual push exited native zero and recorded `20261006113212`. An initial non-TLS-unspecified preview failed before migration application because this local database does not support SSL; the explicit local non-TLS preview/push succeeded. No uncertain application retry occurred.
- Privileged local readback compared all 91 prior ledger `version/name/statements` records with the pre-push snapshot and found them unchanged; exactly one new version is present. This is serialized-record equality, not physical ledger-byte identity. `20261006101609` and `20261006104143` source and ledger records remain immutable. The replaced primitive remains SECURITY INVOKER with empty search path and no authenticated/anon/service-role EXECUTE grant.
- Required `pnpm exec vitest run tests/integration/commands/bookings.int.test.ts tests/integration/commands/bookings-replay-authority.int.test.ts tests/integration/rls/bookings.rls.test.ts`: native exit zero; 32 total, 32 passed, zero failed/skipped across three normally parallel files, with explicit API 55421/database 55422 and `SUPABASE_TEST_REQUIRED=1`. Counts are 16 command foundation, five RLS and 11 replay/timestamp cases. This includes all 21 previously retained booking cases, the three sequential cases and eight new cases; authorized historical replay after assignee deactivation remains green.
- Read-only `supabase db advisors --db-url <private-local-url-with-sslmode=disable> --type security --output-format json --fail-on error`: native zero, no issues found on the assigned local database.
- `pnpm typecheck` and targeted ESLint for `tests/integration/commands/bookings-replay-authority.int.test.ts`: native zero. The author corrected an initial PromiseLike typing error before these final passing checks. No timeouts, test parallelism, production validators or authority contracts were weakened.

The parent resulting required full normal-parallel integration gate then exited native 1: 128 files, 1,305 cases, 1,303 passed, one failed and one intentional pending recovery-Storage-loader case. Its sole failure was `quote-delivery-recipient-snapshot.int.test.ts:211`: the completed initial/corrected deliveries were read with `ORDER BY created_at`, but the exact row-array assertion expects delivery sequence 1 followed by 2. Source inspection confirms the correction creates the next delivery sequence and the database enforces scoped sequence uniqueness; it does not establish an actual timestamp tie, backward clock movement or the earlier PFD failure cause.

The parent explicitly authorized a scoped prerequisite fixture repair, retaining this author's High effort for the recipient/audit invariant. The only test change is `tests/integration/email/quote-delivery-recipient-snapshot.int.test.ts:208`, ordering that privileged readback by `o.delivery_sequence`. The exact recipient/source ID, cancellation/queued state, artifact recovery, sequence and correction-audit assertions remain intact. Required execution of this one affected file on API 55421/database 55422 exited native zero: three passed, zero failed/skipped; targeted ESLint exited native zero. The original failed cumulative artifact is retained. At this initial prerequisite repair handoff, the parent-owned resulting full normal-parallel rerun was pending; its subsequent failed result and final passing result are recorded below. Product timestamps, attestation/authority guards, parallelism and clock configuration were not changed.

The parent's second resulting required full normal-parallel run also exited native 1: 128 files, 1,305 cases, 1,302 passed, two failed and one intentional pending recovery-Storage-loader case. Both failures were migration-inspection helper assertions: the global `pg_proc.proname` selector returned three rows while the tests require the two production helpers. The existing adversarial search-path suite deliberately creates `evil_audit.is_active_tenant_member(uuid)`; that separate schema function matches the old name-only predicate. This is a metadata-fixture selector defect and does not demonstrate a production helper or security-guard defect. Booking tests remained green in that parent run.

The parent explicitly authorized correcting only the two helper metadata selectors in `tests/integration/rls/migration-reset.int.test.ts:143` and `:159` to exact regprocedure OIDs for `public.is_active_tenant_member(uuid)` and `public.is_tenant_admin(uuid)`. A missing target fails the cast/query. The exact two names/count, SECURITY DEFINER and exactly empty search-path assertions remain unchanged; the adversarial helper test is unchanged. Required execution of both files together with normal parallelism and explicit API 55421/database 55422 exited native zero: 15 passed, zero failed/skipped (11 migration inspection and four audit search-path cases). Targeted metadata-file ESLint and `pnpm typecheck` exited native zero. No product/helper/migration, ledger, timeout, skip or parallelism change was made. Both failed cumulative JSON artifacts remain retained. At this second prerequisite repair handoff, the single parent-owned resulting full normal-parallel gate was pending; the final passing result follows.

Post-terminal author reconciliation against local implementation commit `1f7bfcd823d2b9a3c4bd2b35f4c7b40b2c36009d`: the parent recorded the resulting required full normal-parallel integration gate as native zero, 128 files, 1,305 cases, 1,304 passed, zero failed and one intentional isolated recovery-Storage-loader skip. The tested source was the final fix working tree based on `dc2c0c897a9d3639fff8672b95d3898773126f46`, subsequently committed at the revision above. This is parent-executed evidence, not a new author test run. Both earlier failed cumulative reports remain historical evidence. The narrow latest-fix and trail review previously reported no findings; this completion hook refreshes only author evidence and the existing single review section, with no additional test/review or terminal-state change.

Limits: this is an incrementally migrated existing local database, not the mandatory empty-schema migration/seed/required-integration CI chain. The final cumulative result above satisfies the resulting local gate only. Prior quote-send investigation and its unconfirmed time cause remain unchanged historical evidence; these focused booking tests do not establish that cause. There is no booking browser flow or new detector acceptance here. The existing mandatory Story 14.3 detector gate remains.

## Suggested Review Order

Author: Story 14.2 implementation/fix author, with a nested test implementation author; round 2 booking fixes and trail refreshed by the round 2 fix author.
Refreshed by the required author completion hook against implementation commit `1f7bfcd823d2b9a3c4bd2b35f4c7b40b2c36009d` and its tested fix working tree based on `dc2c0c897a9d3639fff8672b95d3898773126f46`, retaining baseline `4947dbb44089c0462619c63443f3107712dc4cc7`.

Narrow final trail refresh on 2026-10-08: `/root/merge_review`, `gpt-6.1-sol` High, the bounded merge/harness fix author. Original implementation and round 2 author attribution remains above. This refresh checks current source locations and the carried-forward prerequisite dependency configuration; it does not claim authorship of their booking implementations or another broad review round. The separate Dev Record below distinguishes historical runtime evidence from current outstanding gates.

### Checked internal booking entry

The commands reuse resolved envelope authority and suppress its second audit because SQL owns atomic audit. [Contract C](../../docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md) gates user-facing entry on Story 14.3. The review fix preserves up to six fractional digits across command/RPC identity and validates sub-millisecond positive ranges without Date truncation.

- `src/server/commands/bookings/create-booking.ts:7` — `export const createBooking`: enters the actual envelope with SQL-owned audit.
- `src/server/commands/bookings/update-booking.ts:6` — `export const updateBooking`: checks target ownership before the RPC.
- `src/server/commands/bookings/validation.ts:13` — `function normalizedInstant`: normalizes UTC without losing PostgreSQL microseconds.
- `supabase/migrations/20261006101609_bookings_and_assignees.sql:258` — `create function public.create_booking`: independently rechecks actor and live role.

### Durable replay and indivisible persistence

SQL reconstructs canonical identity and serializes create/update scope. The round 2 correction locks and rechecks the current actor after serialization waits before returning stored outcomes; mutable assignment state remains irrelevant to replay. Fresh writes retain sorted combined membership locks, unchanged history, exact assignment replacement and one target-only transactional audit. Append-only update outcomes have unbounded growth, the approved replay contract's documented storage tradeoff.

- `supabase/migrations/20261006104143_booking_invariant_corrections.sql:26` — `create or replace function public.booking_payload_internal`: rebuilds normalized SQL identity.
- `supabase/migrations/20261006113212_booking_replay_current_authority.sql:23` — `has_tenant_role`: rechecks CREATE replay authority under the actor lock.
- `supabase/migrations/20261006113212_booking_replay_current_authority.sql:36` — `has_tenant_role`: rechecks UPDATE replay authority after the booking row lock.
- `tests/integration/commands/bookings-replay-authority.int.test.ts:136` — `revoked during lock wait`: AC4 refuses stale replay after observed blocking and admin revocation.

### Tenant relationships and assigned-worker visibility

The three tables belong to active resources. Composite references and checked coherent supplied links preserve independently nullable parents and existing job IDs. The forward correction migration retains the final nonrecursive ownership helper, which privately reads profile/membership facts, preserving existing profile access and scoping Montor children to actual own participation; review adds child-role and revocation evidence.

- `supabase/migrations/20261006104143_booking_invariant_corrections.sql:13` — `create or replace function public.booking_owned_by_current_user`: joins assignment and active scalar/secondary Montor roles.
- `supabase/migrations/20261006101609_bookings_and_assignees.sql:104` — `revoke all on public.bookings`: removes direct writes and private outcome visibility.
- `src/features/resources/booking-types.ts:2` — `BOOKING_PUBLIC_COLUMNS`: declares the safe read projection.
- `tests/integration/rls/bookings.rls.test.ts:38` — `secondary Montor grants`: AC9 proves own reads and child-role revocation.

### Scoped prerequisite dependency repair

The owner authorized compatible remediation for the two high transitive advisories. The Next plugin's sole glob consumer requires a version-specific adaptation as well as the scoped dependency replacement. The later independently reviewed maintenance PR 89 carries Next 16.3.8 into this closeout; the scoped override and patched dependency now target that version while retaining the existing compatible patch file. The physical-root and actual-rule regressions exercise the installed patched package and preserve the real lint boundary. The historical 16.3.6 repair evidence above remains attributed to its original author and revision.

- `pnpm-workspace.yaml:6` — `'@next/eslint-plugin-next@16.3.8>fast-glob'`: scopes the replacement to the final affected plugin version.
- `patches/@next__eslint-plugin-next@16.3.6.patch:11` — `expandDirectories: false`: preserves direct directory roots.
- `tests/unit/dependencies/next-lint-root-globs.test.ts:39` — `installed Next lint helper preserves`: proves physical roots, arrays, braces and missing paths.
- `tests/unit/dependencies/next-lint-root-globs.test.ts:55` — `patched Next no-html-link-for-pages`: proves real internal-anchor lint reporting.

### Retained evidence and the detector gate

Actual envelope tests prove AC2/3 exact booking/assignment/outcome/audit state; INT-003/004/005 and their new regressions prove AC4 replay, changed-payload refusal and overlapping create/update writes; INT-006/007 prove AC5 exact rollback. DB-001/002/003/004/005 plus INT-009 cover AC6 standalone/coherent parents, constraints, job continuity and DST; INT-010 covers AC7 history and membership-deactivation races. RLS-001/002/003/004 and exact-policy/H4/cross-tenant/anon probes exercise AC1/8/9. The generated envelope probes retain every role assertion in five bounded tests with the existing 30-second budget and normal parallel configuration. Round 2 direct checked-RPC tests protect strict clock grammar for both operations and exact no-write/no-audit refusal; sequential and observed-wait replay tests cover current active scalar and secondary actor authority.

- `tests/integration/commands/bookings.int.test.ts:19` — `six-digit timestamp replay`: AC4 preserves command/RPC results and exact timestamps.
- `tests/integration/commands/bookings.int.test.ts:53` — `overlapping same-key updates`: AC4 proves identical and changed-payload UPDATE races.
- `tests/integration/commands/bookings.int.test.ts:256` — `14.2-INT-006 booking preparation`: AC5 proves booking and audit fault rollback.
- `tests/integration/commands/bookings-replay-authority.int.test.ts:199` — `out-of-range clock fields`: AC6 bypasses TypeScript and verifies SQL refusal snapshots.

### Shared final-send diagnosis boundary

The cumulative gate exposed existing quote-send fixture failures, so the test factory installs a shared failure observer instead of relying on case-local diagnostics. Its fixed output contains generic stages, guard booleans and authorized relative clock deltas; readback timing remains an explicit evidence limit. The observer retains its original query/results and production attestation/review authority. A later authorized prerequisite fixture repair orders the initial/corrected recipient readback by its asserted delivery sequence while retaining exact recipient, recovery, sequence and correction-audit checks.

- `tests/factories/tenants/core.ts:354` — `return observeQuoteSendRpcs`: binds diagnostics for every authenticated fixture client.
- `tests/support/quote-send-diagnostics.ts:32` — `export function observeQuoteSendRpcs`: reuses one observer while preserving request builders.
- `tests/unit/quote-send-diagnostics.test.ts:21` — `send observer preserves lazy fluent query`: checks SDK identity and generic redaction.
- `tests/integration/email/quote-delivery-recipient-snapshot.int.test.ts:208` — `order by o.delivery_sequence`: matches the exact initial/corrected delivery sequence assertion.

### Exact production helper inspection under parallel adversarial tests

The prerequisite metadata fixture now selects both production helpers by schema-qualified UUID regprocedure identity. It retains exact existence/count, SECURITY DEFINER and empty search-path assertions while the unchanged adversarial suite creates and exercises a separate hostile helper; missing production signatures fail the selector cast.

- `tests/integration/rls/migration-reset.int.test.ts:168` — `public.is_active_tenant_member(uuid)`: selects exact production signatures for the existence assertion.
- `tests/integration/rls/migration-reset.int.test.ts:184` — `public.is_tenant_admin(uuid)`: scopes exact count and function-security metadata checks.
- `tests/integration/commands/record-audit-event-search-path.int.test.ts:77` — `evil_audit.is_active_tenant_member(uuid)`: retains the hostile-shadow runtime proof.

Evidence: see Implementation Author Evidence, Review Fix Log, Round 2 Fix Author Evidence and Cumulative PDF-send Investigation above for executed counts, prerequisite repairs, the unconfirmed final-send incidents and remaining CI/detector gates. Optional-unavailable skip probes validate runner behavior only, and do not count toward the 18 required booking obligations.
Limits: fixtures and privileged readbacks/fault triggers are test-only. There is no booking browser flow in this story. Earlier cumulative final-send causes remain unconfirmed; one focused reproduction isolates a failed time witness without proving a shared cause. Focused/joint success is not full-gate evidence. Local evidence comes from incremental SQL application; the exact empty-schema migration/seed/required-integration CI chain remains MANDATORY before Epic finalization/merge and is not claimed as executed here. Performance and volume are unmeasured. No derived detector, refresh or override acceptance is claimed; 14.3-INT-003/004/005/006 remain mandatory before 14.4 and the Epic PR.

## Narrow author Dev Record — final trail refresh 2026-10-08

Author: `/root/merge_review`, `gpt-6.1-sol` High. Ownership for this refresh is limited to the existing Suggested Review Order and this appended record. All earlier author records, contracts, acceptance criteria, frontmatter, status and the two completed broad review rounds remain unchanged.

The final mechanical checker reproduced 13 stale stops in this story and one nonliteral `createReviewed()` anchor in the author's CI browser configuration evidence. This author inspected the actual cited functions, test bodies, exact helper selectors and dependency settings, refreshed all 13 story stops and corrected the separate CI document anchor to `const createReviewed`. The current dependency rationale now records the carried-forward Next 16.3.8 maintenance change and continued version-scoped plugin patch; it does not rewrite the original 16.3.6 repair history. The booking replay wait, microsecond, direct SQL grammar, rollback and role-visibility assertions retain their existing meaning.

Executed verification for this docs-only refresh: the repository's bounded review-order checker and whitespace check; source inspection verified every cited stop. No product/test implementation, SQL, workflow or configuration was changed by this refresh, and no test suite, database write or service operation was executed. The recorded historical pass counts above remain evidence for their original revisions, not fresh execution claims.

Current gate limits are retained: the parent reports final typecheck native 0, but the corrected ACL probe remains failed with its baseline retained (244 total / 220 passed / 24 failed / 0 skipped). Fresh shared-runner CI is blocked pending the coordinator's required approval message. The earlier `e1e663ce` whole-browser CI result remains 193 passed / 4 failed; the narrow runner-configuration repair is documented separately in `docs/quality/epic14-ci-browser-config-closeout-2026-10-08.md` and still requires fresh execution evidence. No complete required-integration, CI or Epic closeout PASS is invented here. Existing performance, human physical/daylight and Story 15.1 calendar limits remain separate release obligations.

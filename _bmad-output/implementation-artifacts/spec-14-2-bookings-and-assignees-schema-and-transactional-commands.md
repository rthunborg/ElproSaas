---
title: 'Story 14.2: Bookings and Assignees — Schema and Transactional Commands'
type: 'feature'
created: '2026-10-06'
status: 'ready-for-dev'
review_loop_iteration: 0
followup_review_recommended: false
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
- Follow `.github/workflows/ci.yml` and `docs/process/local-setup.md` for empty-schema migration application, lockfile/source containment, build then built-bundle containment, and remaining required gates. Guard-managed infrastructure and tests stay local. Record SQL-only reset versus complete stack rebuild truthfully; do not launch infrastructure in this planning run.

**Readiness checks:** every task has an implementation path and action; dependency order is explicit; ACs observe the checked command and durable/read surfaces in Given/When/Then form; all retained/transferred obligations are mapped; no unresolved business intent, TODO or stub remains. Compare the intent contract byte-for-byte with the committed draft and verify only this spec changed.

## Spec Change Log

- 2026-10-06: Owner-approved contract C resolves the prior sequencing intent gap. Restored this existing spec to `draft` for Step 2 re-planning; aligned acceptance ownership and preserved the original blocked result below as historical evidence. This preparation does not mark the story ready for development, run ATDD/build/review, or satisfy implementation gates.

- 2026-10-06: Step 2 re-planning at 4d2f29a5b3b084c2f25895b753cc2a0e43f6a1e1 resolved technical command authority, private durable replay storage, own-assignment fixtures/projections and concrete schema semantics. Preserve the intent contract and all historical blocker/recovery evidence; retain all 18 foundation checks and four mandatory transfers. This is planning only.

## Auto Run Result

### Canonical planning halt — 2026-10-06

Status: ready-for-dev

Blocking condition: none

HALT: invocation explicitly required halt after planning. Step 2 readiness gate passed after re-reading the rendered workflow and repaired spec from disk: actionable file-scoped tasks, dependency order, Given/When/Then outer-surface acceptance, complete retained/transferred check inventory and coherent technical boundaries. The intent contract matches the committed draft byte-for-byte; historical blocker/recovery records remain preserved. Oversized warning records the necessary cross-layer planning detail.

Planning evidence: installed renderer completed successfully; two synchronous Sol 6.1 High read-only exploration delegates supplied source maps and acceptance traceability at 4d2f29a5b3b084c2f25895b753cc2a0e43f6a1e1. Only this spec is modified. git diff --check passed. No implementation, product test execution, infrastructure launch, hosted action or Git commit/branch/push/PR occurred. No performance or volume acceptance number is invented; scale remains unmeasured advisory evidence.

On Complete: docs/process/review-order.md Completion-hook protocol preserves this planning result; completed implementation trail reconciliation is inapplicable. No Suggested Review Order was manufactured. Continue through the root-owned ATDD/build/review gates when dispatched.

## Historical Auto Run Results

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

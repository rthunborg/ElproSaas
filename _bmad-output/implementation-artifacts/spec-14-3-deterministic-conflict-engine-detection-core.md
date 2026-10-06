---
title: 'Story 14.3: Deterministic Conflict Engine (Detection Core)'
type: 'feature'
created: '2026-10-06'
status: 'ready-for-dev'
baseline_revision: 'd0e9cc3e617966274cea30ba2929cc7b7e941696'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - 'docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-14-context.md'
  - '_bmad-output/test-artifacts/test-design-epic-14.md'
  - 'docs/process/review-order.md'
  - 'docs/process/agent-model-routing.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 14.2 provides tenant-safe booking persistence but does not detect or refresh conflicts. The editor cannot be exposed until one deterministic detector is integrated with authoritative current-fact persistence and every transferred acceptance check has executed.

**Approach:** Build the sole pure conflict engine and golden rule packs, then integrate actual create/update commands through a checked fact snapshot, server detection, and an atomic attested finalize transaction. Revalidate exact current facts under the shared tenant write gate before committing booking, assignments, derived conflict refresh, durable outcome and audit together. Story 14.4 consumes the same engine and authority boundary.

## Boundaries & Constraints

**Always:** Follow approved Contract C and current architecture §§10.1–10.5A. Keep `resources` active with Epic 14 table ownership and `scheduling` pending with empty live surfaces. Detection is pure, deterministic, I/O-free and clock-free; shared feature code under `src/features/scheduling/` does not activate scheduling. Use actual schedules, breaks, individual exceptions, Swedish holidays and tenant calendar reductions; employment percentage never derives availability. Store/compare UTC instants without losing PostgreSQL microseconds and evaluate local windows in Europe/Stockholm with first-valid spring and earlier fall resolution. Preserve existing command validation, authorization, direct-DML/private-helper denials, composite tenancy, durable replay and target-only atomic audit. Every consumed-fact production writer uses the same gate before row locks. All four transferred checks 14.3-INT-003/004/005/006, including P1, pass before any 14.4 work or the Epic PR.

**Block If:** An actual requirement cannot be met without a second detector, client-authored detection authority, privileged application credentials, an unprotected consumed-fact writer, activating scheduling, invented job/competence data, or changing approved warning/override behavior. Missing real external credentials/manual setup that cannot be safely resolved is a needs-human blocker; routine private local/CI synthetic attestation configuration needs no owner decision.

**Never:** Add booking UI, route or user-facing server action; explicit override/acceptance or resolver commands; recurrence/series expansion; time reports; notification categories/producers; public feeds; optimizer; E16 job-depth or E31 HR/competence tables; hosted activation or hosted secret changes; PWA/offline, AI, live supplier APIs, or other Phase C ledger scope. Do not leave a fresh-write legacy RPC or test-only bypass that omits authoritative detection. No stub detector or empty-conflict success claim.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Shared assignee | Positive half-open booking intervals overlap for one of several people | One stable double-booking identity per actual pair/person/window; only colliding people appear | Adjacent endpoints do not collide; repeated/permuted inputs produce identical sorted bytes |
| Availability and capacity | Actual shifts/breaks, exceptions, holidays, reduced/closed days, existing demand, optional buffer | Outside-work-hours and over-capacity violations carry affected people and exact windows; each subtraction is applied once | Malformed required facts fail validation; a valid empty weekly template means zero availability and warnings, never invented free capacity |
| Optional job inputs | Explicit access windows or required work-role IDs are supplied; current basic job has neither | Emit outside-access-window or competence-missing only from supplied authoritative inputs; absent inputs are explicitly unavailable | Standalone/basic-job absence is not a violation and does not imply verified competence |
| Preview becomes stale | Another booking or schedule fact commits after the frozen preview/snapshot | Finalize rejects stale facts without mutation; bounded server refresh reruns the engine and persists newly detected conflicts | Exhausted retry returns retryable SERVER_ERROR with no partial state |
| Fresh create/update | Entitled admin/planner, canonical command, signed current detection | Booking, exact assignments, all affected derived conflict rows, durable outcome and one audit commit together | Forged/missing/expired/cross-actor proof fails closed; failure after conflict preparation rolls everything back |
| Existing workflow | Identical accepted natural key survives or booking change alters/removes its collision | Preserve unchanged acceptance; changed identity is open; remove stale derived rows including peer-owned rows | Detection never grants blanket acceptance or fabricates resolver outcomes |
| Retry/revocation | Completed canonical command, changed payload, or actor downgraded while waiting | Equal authorized replay returns original result without detection write or extra audit; changed payload conflicts; current authority is checked after wait | Generic typed denial/conflict; retain history even after later assignee deactivation |

</intent-contract>

## Code Map

Inspected at full baseline revision above. Existing anchors below are source evidence, not future implementation stops. The valid cached Epic 14 context incorporates Contract C; Story 14.2 is `done` and its Code Map, Design Notes, change log, tasks and completion evidence provide continuity.

- `src/server/commands/bookings/create-booking.ts:7`, `update-booking.ts:6`, `booking-db.ts:19`, `validation.ts:12`/`:69`/`:71` — actual envelope entries, SQL-owned audit, typed adapter and microsecond-preserving canonicalization. Replace execution with snapshot/detect/finalize while preserving ownership and closed caller fields.
- `src/features/resources/booking-types.ts:2` — explicit public booking projection excludes private command identity/history; preserve result compatibility.
- `src/features/resources/schedule-read.ts:20`, `work-hours.ts:9`/`:11`/`:19`/`:39`, `capacity-inputs.ts:5`/`:7` — pure split-shift/break shaping, fractional time parsing and validation. Holiday source is only an input marker; central holiday calculation must actually be implemented here.
- `supabase/migrations/20261006113212_booking_replay_current_authority.sql:3`/`:15`/`:23`/`:28`/`:36`/`:44`/`:48`/`:57`/`:60`/`:64`/`:70`/`:82`/`:95` — current private writer, key/row serialization, post-wait replay authority, sorted memberships/profiles, current parent locks, business persistence and atomic audit. Forward changes preserve these foundations.
- `supabase/migrations/20260929120000_resource_person_profiles_and_work_hours.sql:117`/`:172`/`:208`/`:222` — schedule save, profile upsert, tenant calendar and combined form production writers to gate before row locks/DML.
- `supabase/migrations/20260907171252_role_aware_phase_a_policy_evolution.sql:1297`/`:1354`/`:1516` — work-role upsert/active setter and existing authenticated write revocation; gate the writers, exclude money from detector facts.
- `supabase/migrations/20260910165124_admin_user_management.sql:44`/`:50`/`:56`/`:63`/`:90`/`:101` — lifecycle/roles and invitation preparation already use tenant advisory gate before row locks. Preserve last-admin, role and audit guards.
- `supabase/migrations/20260914092606_admin_accept_membership_invitation_identity_binding.sql:7`/`:31` — current invitation acceptance locks membership first; forward replacement must discover tenant, acquire common gate, reload/lock and revalidate identity/status/token.
- `src/server/quote-pdf/attestation.ts:35`/`:75`/`:84`; `supabase/migrations/20260831124312_story_10_9_quote_pdf_attachment_validity.sql:1298`/`:1318`/`:1325`/`:1335`/`:1487`/`:1690` — domain-separated length-prefixed UTF-8 proof, server env signing, owner-only Vault lookup and SQL HMAC precedent. Reuse the pattern with a dedicated booking domain/key.
- `supabase/migrations/20260709120000_acceptance_to_job_model.sql:169` — basic jobs lack access windows, competence requirements and travel inputs; do not add E16/E31 schema to fill optional detection inputs.
- `tests/integration/commands/bookings.int.test.ts`, `bookings-replay-authority.int.test.ts:100`, `tests/integration/rls/bookings.rls.test.ts`, `tests/integration/rls/migration-reset.int.test.ts`, `tenant-table-inventory.ts` — retain all existing booking/RLS evidence and exact ACL/policy checks; adapt deterministic replay-wait fixtures to common first gate.
- `src/scope/manifest.ts`, `tests/unit/scope/resources-activation.atdd.test.ts` and manifest tests — existing table ownership/activation guards stay authoritative; no new tenant table is needed for content-digest CAS.
- `_bmad-output/planning-artifacts/architecture-phase-b.md:741`/`:749`/`:751`/`:763`/`:771`; `_bmad-output/test-artifacts/test-design-epic-14.md:147`/`:148`/`:162`/`:189`/`:199` — shared-engine, workflow identity, DST, capacity and test authority.

## Tasks & Acceptance

**Execution (9 tasks, dependency order):**

1. [ ] `src/features/scheduling/types.ts`, `conflicts.ts`, `capacity.ts`, `time-zone.ts`, `swedish-holidays.ts`, with existing `src/features/resources/work-hours.ts` and `schedule-read.ts` — define typed frozen fact/config/output contracts and implement one detector with pure helpers. Derive explicit capacity windows from local calendar/schedules, cover all five conflict types, preserve microseconds, exclude cancelled bookings and the candidate's prior state, normalize participants/windows/keys and sort output. Version rules; no fixed company schedule, ambient clock or runtime I/O.
2. [ ] `tests/fixtures/golden/scheduling/conflicts.json`, `capacity.json`, `dst.json`, `regressions.json`, and `tests/unit/features/scheduling/conflicts.test.ts`, `capacity.golden.test.ts`, `dst.golden.test.ts` — implement all 14 named unit obligations and every I/O edge. Pin actual-weekly-schedule examples, all six capacity terms, layered/calendar overlap subtraction, split shifts/breaks, multi-day/all-day, cancellation, permutations, both DST boundary weeks, injected threshold/overtime inputs and optional job requirements. Label fixtures new-expected; do not fabricate Lovable values. Add immutable miss/phantom regression cases as defects are fixed.
3. [ ] `supabase/migrations/*_booking_conflict_detection_integration.sql` — create a new forward migration through discovered `supabase migration new` CLI, without editing applied history. Add owner-only canonical bundle/proof helpers and checked snapshot/finalize RPCs; seal fresh foundation RPC paths. Use the shared tenant gate, post-wait current authority, content-digest verification, schema/tenant output validation, private atomic booking/assignee/conflict/outcome/audit persistence and safe stale result. No revision/challenge table or detection-rule SQL duplicate.
4. [ ] `supabase/migrations/*_booking_conflict_detection_integration.sql` — replace the actual resource, work-role and invitation acceptance writers listed in Code Map to acquire the common gate before row locks. Preserve existing admin lock/guards, invitation verified-email binding, command-only ACLs, nested call safety and parent reference locks. Document the exhaustive consumed-fact writer inventory; do not introduce a late row-trigger lock or unrelated quote/job redesign.
5. [ ] `src/server/bookings/conflict-attestation.ts`, `conflict-facts.ts`, `save-with-conflicts.ts`, `src/server/commands/bookings/booking-db.ts`, `create-booking.ts`, `update-booking.ts`, and `src/server/commands/command-errors.ts` — use the cookie-bound client for checked snapshot/finalize, run the sole engine, sign exact results and retry stale snapshots at most three attempts using the original command UUID. Map final contention to retryable SERVER_ERROR; preserve original target-only replay and SQL-owned audit. Caller input contains no proof/conflicts/accepted-state authority. Export an internal frozen-fact preview seam for 14.4 without an entry point.
6. [ ] `.env.example`, `docs/process/local-setup.md`, `tests/support/test-env.ts`, `tests/support/booking-conflict-attestation.ts`, `supabase/seed.sql`, `playwright.config.ts`, and `.github/workflows/ci.yml` only where needed — document dedicated non-public booking key ID/secret names and missing-key fail-closed behavior; bootstrap matching explicitly synthetic local/CI signing/Vault material using existing test setup patterns. Never commit real keys, log proof/secret bytes, install hosted secrets or edit an actual .env in this planning run. Do not alter existing resource ownership/start/reset behavior or CI gates.
7. [ ] `tests/unit/server/bookings/conflict-attestation.test.ts`, `tests/integration/commands/booking-conflicts.int.test.ts` — prove all six named integration obligations through actual commands and exact durable readbacks. Add deterministic different-key concurrent booking, snapshot/finalize schedule/profile/calendar/role/invitation changes, old/new assignee/window peer refresh, malformed/forged/cross-tenant/actor/expired/version proofs, no legacy fresh-write bypass, bounded stale retry and post-conflict/audit rollback cases. Any test signing seam stays off runtime imports and does not bypass the production verifier.
8. [ ] `tests/integration/commands/bookings-replay-authority.int.test.ts`, existing booking/RLS tests, `tests/integration/rls/migration-reset.int.test.ts` and scope tests — retain all 32 booking cases and authority/ACL negatives. Change race barriers to the new lock order, add exact new RPC/private helper grants/search-path checks and per-consumed-writer races; do not weaken assertions, required flags, counts or exact inventory/policy checks.
9. [ ] `_bmad-output/implementation-artifacts/spec-14-3-deterministic-conflict-engine-detection-core.md`, `_bmad-output/test-artifacts/test-design-progress-epic-14.md`, and `_bmad-output/test-artifacts/story14-3-verification.md` — record ATDD/automation/independent review and executed/failed/skipped evidence at the actual tested revision, map all checks and transfers, and author the final Suggested Review Order after implementation/fixes. Planning has no completed implementation trail or product-test claim.

**Acceptance Criteria:**

1. Given shared-assignee overlaps or adjacent half-open bounds, when the pure engine runs, then only real pair/person collisions emit one stable double_booking identity and adjacent intervals emit none (14.3-UNIT-001/002/003).
2. Given actual weekly shifts, breaks, absences, blocked time, holiday/calendar reductions, existing booking demand and optional buffer, when capacity is evaluated, then each formula component changes only its own term, overlapping unavailability is subtracted once, positive overrun warns and outside-work-hours violations preserve their exact windows; employment percentage does not infer a schedule (14.3-UNIT-004/005/006/012).
3. Given typed optional job access/required work-role inputs, when supplied or explicitly unavailable, then supplied violations emit outside_access_window/competence_missing and absence emits neither without being misrepresented as verified; authorized overtime is injectable rule data, never default ordinary capacity or a new action (14.3-UNIT-007/008/013).
4. Given Stockholm DST gaps/folds and frozen/permuted inputs, when interpreted and detected, then first-valid spring/earlier fall policy and microseconds hold across timed/all-day multi-day bounds, output is byte-equivalent and inputs unchanged with no I/O/clock (14.3-UNIT-009/010/011).
5. Given identical frozen authoritative facts and rules, when the internal preview seam and real save orchestration run, then both call the sole engine and return/persist the same normalized conflicts (14.3-INT-001). No browser preview is claimed before 14.4.
6. Given a preview then another committed booking, when the actual save finalizes, then the stale snapshot cannot suppress the collision: zero stale-attempt writes occur and refreshed authoritative detection persists it (14.3-INT-002 and transferred 14.3-INT-006, P0).
7. Given entitled fresh create, when current attested detection finalizes, then exactly one booking, exact assignments and derived conflict rows, one durable outcome and one attributable audit commit atomically (transferred 14.3-INT-003, P0).
8. Given an existing booking and a fresh replacement/cancellation, when saved, then current conflicts rederive across candidate and affected peers, stale peer-owned rows disappear atomically, identical accepted natural keys retain evidence, and changed keys are open without blanket acceptance or invented resolution (transferred 14.3-INT-004, P1).
9. Given a fault after conflict preparation or at audit, when create/update attempts commit, then every booking/assignee/conflict/outcome/audit snapshot equals its pre-command state (transferred 14.3-INT-005, P1).
10. Given concurrent distinct-key bookings or any enrolled consumed-fact writer, when their transactions race with finalize, then a common first gate plus full digest recheck produces a coherent current result without write skew, deadlock inversion or silently truncated facts; actor revocation after a wait denies even replay, while authorized canonical replay returns the historical outcome without added writes/audit.
11. Given direct Data API callers or malformed/cross-boundary proof, when snapshot/finalize/legacy/private paths are invoked, then tenant/actor/matrix/ACL/proof enforcement prevents unauthorized facts or mutations, including Montör writes, and existing own-assignment read scope stays intact.
12. Given a corrected missed/phantom conflict or completed story evidence, when regression and scope gates run, then a permanent named fixture protects the correction (14.3-UNIT-014), all 14 unit and six integration IDs execute, every transferred P0/P1 check passes, resources remains active, scheduling pending, and no 14.4/UI/E15/Phase C capability has been exposed.

## Design Notes

### Authoritative fact equivalence and atomic persistence

PostgreSQL does not execute the TypeScript detector. The integration is optimistic verification of the detector's exact facts at commit, followed by one atomic persistence transaction; it must not be described as literal TS execution inside SQL. A checked snapshot RPC acquires the common gate and returns a coherent ordered canonical bundle and SQL-computed digest, operation/command/candidate identity, proposed create UUID and database-issued proof validity times. It may return a completed replay after current authorization. The server consumes only that bundle and versioned server rules, overlays the canonical candidate, runs the sole engine, and signs the exact output text bytes.

Finalize acquires the gate before any row lock, rechecks current actor/tenant/role and serializes the create key or update row. Completed canonical replay returns its original result without fresh proof/detection mutation; unequal input remains COMMAND_CONFLICT. Every fresh write requires a dedicated HMAC proof bound to tenant, actor, operation, command UUID, update target/proposed create UUID, canonical candidate digest, complete fact digest, exact derived output bytes, engine/config version, correlation, key ID and database-issued validity bounds. No signature or raw proof payload is returned to the browser, logged or persisted; normalized derived conflict rows are persisted as specified. Missing/unknown keys fail closed. The dedicated key uses the existing server env/private Vault pattern; current planning installs nothing.

After acquiring the gate, VOLATILE orchestration assembles facts in a fresh READ COMMITTED statement, including empty sets and all insert/delete-sensitive values, not just updated_at. Exclude issuance/expiry and other transport-only fields from the fact digest; bind them separately in the proof. Bind one supported engine/config version and exact versioned rule values, so a changed policy invalidates older authority rather than silently accepting mixed versions. Rebuild and compare the same canonical bundle in finalize. Mismatch returns stale without any business, outcome or audit write; server snapshot/detection retries reuse the same command UUID and stop after three attempts. Only an equal bundle permits atomic booking, exact assignments, conflict refresh, durable outcome and one audit. Signed bytes avoid relying on Node and PostgreSQL JSON stringification equality. SQL validates output shape, uniqueness, references and ranges; it does not reimplement conflict rules. Canonical proof/fact encoding and microsecond round trips have cross-language test vectors.

### Lock inventory and ordering

Reuse `pg_advisory_xact_lock(hashtextextended(tenant_id::text,0))`, already used by admin lifecycle/invitation preparation, as the common first gate. Order: tenant gate → create-key or booking-row serialization → sorted actor/assignee memberships → sorted profiles → existing facility/contact/job reference locks → business/derived persistence → audit. Snapshot and finalize both assemble facts after gate acquisition. Instrument resource schedule/profile/calendar/combined form, work-role upsert/active state, booking fresh/replay and membership/invitation operations that change consumed facts; preserve current admin guards and add the gate before invitation acceptance locks its row. Unlocked tenant discovery must be followed by locked identity/status/tenant revalidation.

An AFTER/row trigger acquiring this gate is too late and can invert row/gate order. Do not use it as coverage. Document exact writer coverage and prove each writer class with deterministic barriers. Exclude unrelated mutable CRM/job fields from the detector bundle; retain their existing current SQL parent validation/SHARE locks. Any future integration consuming new job/CRM facts must enroll those writers and facts together.

Replay regression barriers: a test session holds the target membership row; real authenticated admin revocation acquires the tenant gate and demonstrably waits on that row; booking replay demonstrably waits on the gate; release the member row, then observe revocation commit before denied replay. This retains the post-wait authority assertion without assumed FIFO ordering, bypassed admin RPC, larger timeouts or fixture deadlock.

### Pure rules, identity and refresh

Use complete tenant detection facts and a complete post-command derived result set initially: remove the candidate's old version, overlay its canonical proposed version, then evaluate active bookings and affected participants/windows. This correctness-first model refreshes conflicts owned by peers as well as the candidate and avoids a range/assignee closure that silently misses aggregate capacity. Never paginate/truncate the fact set as though complete. Later optimization must prove equivalence over old/new assignees, old/new windows and every capacity window.

Half-open UTC windows and stable sorted booking participants/person/type define natural identities using exact conflict windows, matching architecture §10.2. Booking UUIDs represent materialized occurrences without implementing recurrence. Preserve accepted evidence only for an identical still-current key. New/changed conflicts are open; stale derived rows are removed atomically, with no new resolver outcome or notification behavior. 14.4 supplies explicit acknowledgment/reason against this same freshly verified identity and gate. Derived state is separate from accepted/resolved workflow metadata; neither the engine nor caller invents acceptance.

Availability uses actual templates and dated local layers. Union overlapping holiday/closed/absence/blocked intervals before subtracting availability; keep booked demand and optional buffer separate, without counting a booking both as blocked time and demand. Reduced-capacity days reduce the budget using their actual stored rule data; do not invent an unavailable clock interval that was not supplied. Daily/local capacity windows, thresholds and overtime inputs are explicit versioned config so additional policies need no schema rework. Always warn on positive overrun; a larger-overrun threshold does not grant override. Default authoritative facts contain no overtime authorization unless an existing trusted fact supplies it. Pure injected overtime tests establish the seam, not a shipped overtime action.

The existing holiday marker is insufficient: implement and golden-pin the central Swedish calendar rule source, then layer tenant calendar and person exceptions. Optional job access/competence rule inputs are tested as typed injections; production basic-job adapter explicitly reports those inputs unavailable because E16/E31 data does not exist. Do not add those tables or infer competence from a job's absence of requirements.

### Routing and retained evidence

Build/planning sensitive transaction/conflict work uses gpt-6.1-sol High. A new context-free explorer spawn was refused by the host thread-capacity limit; the root approved synchronous reuse of the existing explicit Sol 6.1 High transaction explorer. It inspected current HEAD and returned the Code Map above; no workflow investigation was omitted. Ordinary mechanical documentation uses Low when independently dispatched; future implementation, security/transaction reviews and ATDD authority work remain High. This run performs planning only and owns no outer state or Git commit.

Historical 14.2 evidence is continuity, not 14.3 execution: 32/32 booking checks passed; required full integration 1,304 passed/0 failed/one intentional recovery Storage-loader skip; unit 1,962 passed/0 failed/one Windows xattr skip. Applied forward replay-authority migration preserves all 91 previous ledger records. Exact empty-chain CI remains required before Epic finalization/merge. No local reset is required by this plan. Performance thresholds/representative volumes remain UNKNOWN; functional correctness cannot certify latency/scalability.

## Verification

Planning: rendered installed Build Auto Step 02, loaded the valid cache and 14.2 continuity, verified clean intended branch/metadata and canonical baseline, and completed synchronous High exploration. No product tests, migration application, resource launch/stop, .env edit or hosted action occurred.

**Required implementation commands and evidence:**

- `pnpm run typecheck`, `pnpm run lint`, `pnpm run test:unit` — all pure/golden/proof/manifest checks pass; report actual executed/failed/skipped counts and host-timezone stability. Map 14.3-UNIT-001 through 014 individually.
- With validated authorized local infrastructure and `$env:SUPABASE_TEST_REQUIRED='1'`, `pnpm exec vitest run tests/integration/commands/booking-conflicts.int.test.ts tests/integration/commands/bookings.int.test.ts tests/integration/commands/bookings-replay-authority.int.test.ts tests/integration/rls/bookings.rls.test.ts tests/integration/rls/migration-reset.int.test.ts tests/integration/rls/rls-inventory-gate.int.test.ts` — all six 14.3 integration obligations, all four transfers and retained booking/RLS/proof/lock tests execute and pass. Direct checked RPC negatives and privileged exact durable readbacks are required; mocks cannot establish acceptance.
- Under the same required setting, `pnpm run test:int` — full normal-parallel cumulative integration/RLS passes, preserving existing suites and counts; explain every skip and never count skipped acceptance as evidence. Add current source-writer invitation/resource/pricing suites to focused testing when changed.
- `pnpm run verify:lockfiles`, `pnpm run verify:service-role-containment`, `pnpm build`, then `pnpm run verify:bundle-containment`; `pnpm audit --audit-level=high` — existing gates remain intact. Discover current local CLI help before migration/advisors operations; verify new incremental application and unchanged prior ledger separately. Use existing local/CI fixture bootstrap; no new DB/reset/hosted or global infrastructure changes.
- Exact empty DB → complete migrations → seed → required integration CI remains mandatory at Epic finalization/before merge per `.github/workflows/ci.yml`; current populated-stack evidence does not claim that chain. Performance remains UNKNOWN until approved targets, rather than becoming a story intent blocker.
- After actual implementation/fixes, author one final Suggested Review Order and run `node scripts/verify/check-review-order.mjs _bmad-output/implementation-artifacts/spec-14-3-deterministic-conflict-engine-detection-core.md`; reviewer checks final stops/evidence narrowly. Planning does not create that completed heading.

Technical references checked for planning: [PostgreSQL transaction isolation](https://www.postgresql.org/docs/15/transaction-iso.html), [explicit/advisory locking](https://www.postgresql.org/docs/15/explicit-locking.html), and [Supabase database functions](https://supabase.com/docs/guides/database/functions). Current official Supabase changelog and relevant September pgcrypto/minor-upgrade entry were checked; no package/host/database upgrade is prescribed.

## Spec Change Log

## Review Triage Log

## Auto Run Result

Status: ready-for-dev

Blocking condition: none

Canonical HALT: ready-for-dev. Invocation explicitly requires halt after planning; implementation Step 03 was not opened or executed. All nine tasks remain unchecked. Ready-for-development gate passed after one self-review repair and disk reread: actionable paths, dependency order, Given/When/Then outer command/durable-state acceptance, complete source-writer map, all 20 named check obligations and four mandatory transfers, no unresolved business intent or placeholder.

Planning decisions: one pure detector; dedicated server HMAC attested fact-equivalence finalize; existing tenant advisory gate first across consumed writers; authoritative full content digest and bounded stale retry; full derived peer refresh; exact natural-key workflow preservation; optional unavailable job-depth inputs; local/CI synthetic key bootstrap only. No completed Suggested Review Order is manufactured on this planning exit, following docs/process/review-order.md Completion-hook protocol.

Effort route: gpt-6.1-sol High planning/build delegate and reused existing Sol 6.1 High transaction explorer. Initial new explorer spawn hit host thread capacity; root-approved synchronous reuse completed the required deep investigation within this turn. No independent implementation review is claimed by exploration.

Verified Git HEAD: d0e9cc3e617966274cea30ba2929cc7b7e941696. Branch: epic/14-wave-b1b-resource-and-scheduling-foundation. Only this uncommitted specification changed; root owns commit, sprint and orchestration state. No resources were requested or stopped. No product verification, migration/ledger/reset, hosted action, secret installation or actual .env edit was performed.

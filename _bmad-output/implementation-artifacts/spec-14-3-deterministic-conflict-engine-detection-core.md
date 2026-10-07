---
title: 'Story 14.3: Deterministic Conflict Engine (Detection Core)'
type: 'feature'
created: '2026-10-06'
status: 'in-progress'
baseline_revision: 'a9e2838e80afbd9718c6d907c5518a152b286b1f'
review_loop_iteration: 0
followup_review_recommended: true
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

1. [x] `src/features/scheduling/types.ts`, `conflicts.ts`, `capacity.ts`, `time-zone.ts`, `swedish-holidays.ts`, with existing `src/features/resources/work-hours.ts` and `schedule-read.ts` — define typed frozen fact/config/output contracts and implement one detector with pure helpers. Derive explicit capacity windows from local calendar/schedules, cover all five conflict types, preserve microseconds, exclude cancelled bookings and the candidate's prior state, normalize participants/windows/keys and sort output. Version rules; no fixed company schedule, ambient clock or runtime I/O.
2. [x] `tests/fixtures/golden/scheduling/conflicts.json`, `capacity.json`, `dst.json`, `regressions.json`, and `tests/unit/features/scheduling/conflicts.test.ts`, `capacity.golden.test.ts`, `dst.golden.test.ts` — implement all 14 named unit obligations and every I/O edge. Pin actual-weekly-schedule examples, all six capacity terms, layered/calendar overlap subtraction, split shifts/breaks, multi-day/all-day, cancellation, permutations, both DST boundary weeks, injected threshold/overtime inputs and optional job requirements. Label fixtures new-expected; do not fabricate Lovable values. Add immutable miss/phantom regression cases as defects are fixed.
3. [x] `supabase/migrations/*_booking_conflict_detection_integration.sql` — create a new forward migration through discovered `supabase migration new` CLI, without editing applied history. Add owner-only canonical bundle/proof helpers and checked snapshot/finalize RPCs; seal fresh foundation RPC paths. Use the shared tenant gate, post-wait current authority, content-digest verification, schema/tenant output validation, private atomic booking/assignee/conflict/outcome/audit persistence and safe stale result. No revision/challenge table or detection-rule SQL duplicate.
4. [x] `supabase/migrations/*_booking_conflict_detection_integration.sql` — replace the actual resource, work-role and invitation acceptance writers listed in Code Map to acquire the common gate before row locks. Preserve existing admin lock/guards, invitation verified-email binding, command-only ACLs, nested call safety and parent reference locks. Document the exhaustive consumed-fact writer inventory; do not introduce a late row-trigger lock or unrelated quote/job redesign.
5. [x] `src/server/bookings/conflict-attestation.ts`, `conflict-facts.ts`, `save-with-conflicts.ts`, `src/server/commands/bookings/booking-db.ts`, `create-booking.ts`, `update-booking.ts`, and `src/server/commands/command-errors.ts` — use the cookie-bound client for checked snapshot/finalize, run the sole engine, sign exact results and retry stale snapshots at most three attempts using the original command UUID. Map final contention to retryable SERVER_ERROR; preserve original target-only replay and SQL-owned audit. Caller input contains no proof/conflicts/accepted-state authority. Export an internal frozen-fact preview seam for 14.4 without an entry point.
6. [x] `.env.example`, `docs/process/local-setup.md`, `tests/support/test-env.ts`, `tests/support/booking-conflict-attestation.ts`, `supabase/seed.sql`, `playwright.config.ts`, and `.github/workflows/ci.yml` only where needed — document dedicated non-public booking key ID/secret names and missing-key fail-closed behavior; bootstrap matching explicitly synthetic local/CI signing/Vault material using existing test setup patterns. Never commit real keys, log proof/secret bytes, install hosted secrets or edit an actual .env in this planning run. Do not alter existing resource ownership/start/reset behavior or CI gates.
7. [x] `tests/unit/server/bookings/conflict-attestation.test.ts`, `tests/integration/commands/booking-conflicts.int.test.ts` — prove all six named integration obligations through actual commands and exact durable readbacks. Add deterministic different-key concurrent booking, snapshot/finalize schedule/profile/calendar/role/invitation changes, old/new assignee/window peer refresh, malformed/forged/cross-tenant/actor/expired/version proofs, no legacy fresh-write bypass, bounded stale retry and post-conflict/audit rollback cases. Any test signing seam stays off runtime imports and does not bypass the production verifier.
8. [x] `tests/integration/commands/bookings-replay-authority.int.test.ts`, existing booking/RLS tests, `tests/integration/rls/migration-reset.int.test.ts` and scope tests — retain all 32 booking cases and authority/ACL negatives. Change race barriers to the new lock order, add exact new RPC/private helper grants/search-path checks and per-consumed-writer races; do not weaken assertions, required flags, counts or exact inventory/policy checks.
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

- 2026-10-06 R1 author: repaired aggregate association/version binding, valid expiry refresh and final-lock invitation expiry; registered both missing AC10 tests, preserved the public result contract and added independent persisted-fact/valid signed-window regressions. Prior reports did not execute the two extra cases; old claims are withdrawn. Current patch verification remains failed; exact diagnostics and observed DB wall-clock regression are preserved without guard/system changes or historical attribution.

- 2026-10-06 implementation author: implemented the sole deterministic engine, real snapshot/sign/finalize save authority, complete derived peer refresh, and common first gates across consumed writers. Added two CLI-generated forward migrations, dedicated synthetic local/CI key bootstrap, real ATDD bindings, activated all 20 named checks, and retained all 32 booking cases. Invitation expiry after a wait now uses the current database instant. Frozen intent/acceptance and historical blocked attempts are preserved.
- 2026-10-06 diagnostic continuation author: corrected reporter observability invocation-only and executed the complete current full integration gate (1,354 passed/0 failed/one intentional skip). No production defect/fix or historical failure cause is invented. Root-authorized `_bmad/render/**` ESLint global ignore addresses immutable generated Markdown/JSON cache EPERM while preserving all source/test coverage and the canonical lint command.

## Review Triage Log

### 2026-10-06 — First independent review dispatch

Routing: all five native reviewer layers and the external Codex reviewer use context-free gpt-6.1-sol High for the actual authorization/RLS/transactional-integrity change. Review covers the complete change from original implementation baseline `2a6c9e6d6859987590f2e875f695a75c16125af6`, including checkpointed implementation and resumed changes. Required focus includes intermittent booking CREATE clock/HMAC/CAS/token-expiry/concurrent-fixture paths; historical unknown causes remain explicit. Root-approved platform capacity batching is three then two native reviewers (five active slots include root/build); every layer remains independent, and no triage or patch occurs until all five native layers and external CLI return. Initial Step03 audit matched seven matrix rows, all 14 named units and all six named integration IDs against the then-current complete report (1,354 passed/0 failed/one intentional recovery skip); it incorrectly credited two uncollected AC10 subcases. R1 discovered that registration gap, and current evidence below corrects the unsupported execution claim. Canonical lint at dispatch had 0 errors/13 inherited warnings.

### 2026-10-06 — Review pass R1
- intent_gap: 0
- bad_spec: 0
- patch: 9: (high 3, medium 5, low 1)
- defer: 0
- reject: 2
- addressed_findings:
  - `[high]` `[patch]` Register both AC10 stale-exhaustion and distinct-key write-skew cases as actual Vitest tests; current named-case reports prove execution.
  - `[medium]` `[patch]` Assert the established retryable SERVER_ERROR contract without inventing a public Result field.
  - `[high]` `[patch]` Persist stable associations for every aggregate-capacity participant, preserve canonical acceptance identity, and version fresh authority as engine v2.
  - `[high]` `[patch]` Forward-replace invitation acceptance to recheck expiry after the operation-row lock before activation; retain all authority and audit guards.
  - `[medium]` `[patch]` Refresh otherwise-valid HMAC-authorized expired proofs through the bounded same-command stale path; retain strict invalid/future/oversized proof rejection.
  - `[medium]` `[patch]` Add independent actual-command assertions for stored dated absence/blocked exceptions and exact UTC warning output.
  - `[medium]` `[patch]` Add correctly signed, otherwise-valid expired/future/oversized-window controls with exact durable no-op assertions.
  - `[medium]` `[patch]` Correct historical false execution evidence and the authored trail using actual registered named-case results; preserve failed results and limits.
  - `[low]` `[patch]` Correct the clerical matrix count from eight to seven outside the frozen intent.

All five native layers and the external Codex layer completed before triage or fixes; the external wrapper's forward-slash `type` retrieval failure was separately retained and its already-written reviewer output recovered with a bounded native-path read. The duplicate aggregate-participant finding was merged. R1 is one completed broad round; two broad rounds remain under the project cap. No additional review round or post-fix independent approval is credited. The same High implementation/fix author implemented all nine corrections, but cumulative patch verification remains blocked. Recommendation is true: three high patches; medium/low score `3 × 5 + 1 = 16`. `review_loop_iteration` remains 0 because no bad-spec re-derivation occurred.

## Auto Run Result

Status: blocked

Blocking condition: patch verification failed

### Canonical R1 correction verification HALT — 2026-10-06

Canonical HALT: **blocked — patch verification failed**. The sole deterministic engine and checked snapshot/detect/attested-finalize implementation are preserved, including all nine R1 corrections, current replay authority, aggregate-participant retrieval, operation-lock invitation expiry, bounded genuine-expiry refresh and honest named-case evidence. No Story 14.4 or Epic gate advances from this result.

Current complete required integration returned native 1: **1,366 total / 1,362 passed / 3 failed / 1 intentional recovery-loader skip**. Failures were the owned AC11 missing-proof valid control, retained 14.2-INT-003 update replay setup, and 7.4-INT-02 quote-acceptance fixture mark-sent setup. Both subsequent bounded 102-case diagnostics returned native 1: **102 total / 101 passed / 1 failed / 0 skipped**; a newly registered exhaustion case and a keyId-tampering valid control respectively failed. They do not replace the full gate. Current affected ten-suite focus passed **143/143 with no skips**, including both formerly uncollected AC10 cases and all nine new regressions. All four transferred INT-003/004/005/006 named cases passed in the current full report; passing those cases does not waive the failed cumulative gate.

The final diagnostic's valid signed control was denied with SQL 42501 (`booking proof denied`). Postfailure readback showed identity/version/config/HMAC/candidate/facts/output/lifetime guards true, expiry still valid, and issuance 772.641 ms ahead of database clock. Its concurrent read-only sampler recorded **six database wall-clock reversals across 1,210 samples**, largest **−827.780 ms while monotonic time advanced 62.090 ms**. This proves clock regression during that diagnostic workload. The failed direct binding lacks an issuance receipt observer: no same-proof before/after claim is made, and historical/full-run failures are not all assigned this cause. Deployed-function and same-call samples ruled out issuance integer casting/serialization advancement; earlier unexplained failures remain historical unknowns. No security guard, time bound, assertion, timeout or system configuration was weakened.

Current typecheck and canonical lint pass (native 0; 0 errors/13 inherited warnings). Unit execution is native 0: **1,993 total / 1,992 passed / 0 failed / 1 inherited Windows xattr skip**; all fourteen named pure cases pass in UTC, America/Los_Angeles and Asia/Tokyo. Lockfiles, service-role containment, build, bundle containment, audit-high (two moderate/zero high) and local security advisors pass. Forward migration `20261006144057` was applied incrementally: 95 ledger records, all 94 prior complete records unchanged; no applied history was edited. Exact empty-chain Epic CI remains pending before merge.

Changed files and per-AC execution evidence are recorded in [author verification](../test-artifacts/story14-3-verification.md), the refreshed author trail below, and the twelve R1 JSON artifacts. Scoped post-fix independent follow-up remains required after stable database-time verification. `followup_review_recommended: true`; `review_loop_iteration: 0`; triage: 9 patches (high 3/medium 5/low 1), 0 defer, 2 reject. All patches are implemented, not cumulatively verified or independently approved after correction.

Tests and the read-only sampler have ceased. Final author and delegate audits found no real secrets, raw proofs/auth tokens or PII in the persistent evidence: fifteen changed/new Markdown/JSON files had zero targeted sensitive-data matches, all twelve new JSON files parse, YAML frontmatter parses as blocked/iteration 0/followup true/deferred empty, and Git whitespace checks pass. The reference checker validates all twenty authored stops; final post-fix reviewer inspection remains pending. Root requested guarded Stop for lifecycle `730ffa3c-8fe8-4b93-b5b8-4da0f9e61cee` (native 0, ok true, stop_requested, verified false), preserving saved state; this delegate acquired/stopped no resource. This delegate made no hosted/global change, reset, deletion, feature commit, branch, push or PR. No more DB use is permitted. Root owns the blocked-leftover checkpoint and orchestration state. Completion hook preserves this blocked/incomplete exit; the existing author-written trail was refreshed and its 20 references validated, but no completed trail or final reviewer approval is manufactured.

### Authorized diagnostic continuation 2026-10-06

The owner explicitly authorized diagnostic, scope-bound fix, re-verification and independent-review continuation. The original fresh context-free gpt-6.1-sol High implementation/fix author confirmed availability before this restoration. Preserve all frozen intent, implementation, baseline history, prior native results and pending gates. Clean pre-restoration checkpoint captured directly from Git: `44247fc8d6a010497fd2d2787405010c8dd0bf4d`. The full unreviewed Story 14.3 implementation remains based on original implementation baseline `2a6c9e6d6859987590f2e875f695a75c16125af6`; later diagnostic baselines must not hide that implementation from its first independent review.

Root has verified the retained isolated stack under new lifecycle `730ffa3c-8fe8-4b93-b5b8-4da0f9e61cee`, API 55421 and DB 55422. Root owns Stop; no subagent launch, original-stack use, reset, deletion or hosted action is authorized. The build delegate restored only this spec; root owns clean checkpoint, sprint and orchestration metadata. Testing waits for that clean checkpoint and service/ledger readiness, then captures current full-workload diagnostics with `STORY143_DIAGNOSTIC=1` before drawing conclusions about the prior INT-004 failure.

Step03 diagnostic-resume baseline captured directly from Git after root clean checkpoint: `a9e2838e80afbd9718c6d907c5518a152b286b1f`. First independent review still covers the complete Story 14.3 change from original implementation baseline `2a6c9e6d6859987590f2e875f695a75c16125af6`; the canonical resume baseline does not limit that review scope.

### Historical resumed implementation verification HALT

Status: blocked

Blocking condition: implementation verification failed

Canonical HALT for the authorized resumed build: blocked at Step 03. Current full required integration on the isolated local stack, with owner-authorized invocation-only `--maxWorkers=8` and file parallelism retained, returned native exit 1: 1,355 total, 1,353 passed, 1 failed, 1 intentional recovery-loader skip. The owned transferred INT-004 failed at its third real CREATE (coworker peer), returning `ok=false`; the original failing run did not capture its underlying typed error. The failure remains unexplained. Current focused 73/73 and representative parallel 146/146 with no failures/skips prove their own executions, but do not explain or waive the failed cumulative result. No further broad retry or independent review was performed after the root-directed hard stop.

Fresh author capacity and scoped implementation are preserved. All four transfers execute in current focused evidence; no Story 14.4 or Epic PR gate is advanced by this result. Canonical lint, cumulative failure diagnosis, independent review and exact empty-chain Epic CI remain outstanding. `followup_review_recommended: false`; `review_loop_iteration: 0`; triage counts: 0 patch, 0 defer, 0 reject. The author-written 20-stop trail is retained with its stated evidence limits; reviewer inspection remains pending.

Completion-hook result: blocked/incomplete exit preserved under docs/process/review-order.md. No completed trail was manufactured by the build delegate, no terminal status was rewritten by reconciliation, and no independent review is credited. Final implementation evidence describes the uncommitted working tree based on full canonical revision `2a6c9e6d6859987590f2e875f695a75c16125af6`. Root owns checkpointing and Stop for lifecycle `79338b7b-db58-4a1a-85a2-5d877d3d45e3`; this delegate acquired no managed resource and performed no Git commit, hosted change, reset or deletion.

### Historical pre-resume terminal metadata

Historical status: blocked

Blocking condition: no subagents

### Historical planning result 2026-10-06

Historical status: ready-for-dev

Historical blocking condition: none

Canonical HALT: ready-for-dev. Invocation explicitly requires halt after planning; implementation Step 03 was not opened or executed. All nine tasks remain unchecked. Ready-for-development gate passed after one self-review repair and disk reread: actionable paths, dependency order, Given/When/Then outer command/durable-state acceptance, complete source-writer map, all 20 named check obligations and four mandatory transfers, no unresolved business intent or placeholder.

Planning decisions: one pure detector; dedicated server HMAC attested fact-equivalence finalize; existing tenant advisory gate first across consumed writers; authoritative full content digest and bounded stale retry; full derived peer refresh; exact natural-key workflow preservation; optional unavailable job-depth inputs; local/CI synthetic key bootstrap only. No completed Suggested Review Order is manufactured on this planning exit, following docs/process/review-order.md Completion-hook protocol.

Effort route: gpt-6.1-sol High planning/build delegate and reused existing Sol 6.1 High transaction explorer. Initial new explorer spawn hit host thread capacity; root-approved synchronous reuse completed the required deep investigation within this turn. No independent implementation review is claimed by exploration.

Verified Git HEAD: d0e9cc3e617966274cea30ba2929cc7b7e941696. Branch: epic/14-wave-b1b-resource-and-scheduling-foundation. Only this uncommitted specification changed; root owns commit, sprint and orchestration state. No resources were requested or stopped. No product verification, migration/ledger/reset, hosted action, secret installation or actual .env edit was performed.

### Implementation attempt 2026-10-06

Status: blocked

Blocking condition: no subagents

Canonical HALT: blocked. Mandatory Step 03 context-free implementation-author dispatch using gpt-6.1-sol High and fork_turns=none failed with the native host result `collab spawn failed: agent thread limit reached`. The orchestrator confirmed that no supported tool can close/release completed agent threads and directed this canonical halt; no inline, reused-context or external CLI implementation author was substituted. The installed workflow's Subagents rule requires this blocking condition when its mandatory subagent cannot be launched.

Baseline revision captured directly from Git before this attempt: 0c4ab83f8b4578933c5297f30ee7138bbfa3ba94. The frozen intent contract and nine unchecked tasks remain intact. Only baseline/status metadata and this result evidence changed. No product implementation, functional verification, SQL migration/application, attestation configuration, resource request/stop, hosted operation or Git commit occurred.

Verification counts for this implementation attempt: executed 0, failed 0, skipped 0; no acceptance coverage is claimed. The previously recorded ATDD collection and 14.2 results remain historical evidence. Review iterations completed: 0; triage counts: 0 patch, 0 defer, 0 reject. Required independent review and external read-only CLI review were not reached. Recommendation: resume this approved story only when a fresh context-free implementation author can be dispatched; no Story 14.4 work is authorized by this result.

Completion-hook result: blocked/incomplete exit preserved without manufacturing a completed Suggested Review Order, following docs/process/review-order.md.
### Authorized implementation resume 2026-10-06

Status: in-progress

Fresh context-free gpt-6.1-sol High implementation-author capacity was proven by successful mandatory author dispatch before this restoration. The approved Contract C, frozen baseline, nine-task plan, existing ATDD artifacts and historical blocking evidence remain intact. This build delegate restored only this spec; root owns sprint and orchestration metadata. Historical no-subagents results above remain historical and are superseded for this authorized resume.

Step03 implementation baseline captured directly from Git: 2a6c9e6d6859987590f2e875f695a75c16125af6. Original frozen planning baseline remains 0c4ab83f8b4578933c5297f30ee7138bbfa3ba94 as recorded above; Code Map anchors describe that original inspected baseline. Root confirmed the clean checkpoint before implementation.

### Historical implementation author evidence 2026-10-06

Tasks 1–8 are implemented. Task 9 is partially complete: author execution/evidence and the review trail exist; independent review and final reconciliation remain pending. Root directed canonical Step 03 `blocked: implementation verification failed`; the build delegate owns terminal HALT/status metadata. No story/epic gate advancement is claimed. See [author verification](../test-artifacts/story14-3-verification.md) for the exhaustive consumed-writer inventory, per-AC evidence, native exits, skips and limits.

The current 73/73 focused run executes all six integration IDs and all four transferred P0/P1 obligations, including the expiry-during-wait correction. All 14 scheduling unit IDs pass under three host timezones; full unit has 1,992 passed/0 failed/one inherited Windows xattr skip. A prior bounded normal-parallel integration run passed 1,353/0 failed/one inherited recovery skip. The current full run after the expiry correction has 1,353 passed/one INT-004 failure/one inherited recovery skip. Isolated INT-004 and authorized representative parallel diagnostics pass (146/146, including all 49 conflicts; peak 30 client connections), which does not explain or waive the cumulative failure. Author verification remains blocked by that unresolved result. Default-worker capacity failures, generated-snapshot canonical-lint EPERM, and every skip remain separately recorded; no configuration/assertion/timeout was weakened.

Both immutable forward migrations were incrementally applied to root-owned isolated 55421/55422, preserving every prior 92 ledger record; final count 94. Root retains lifecycle `79338b7b-db58-4a1a-85a2-5d877d3d45e3` for review. Empty-chain CI, canonical lint under an actor able to read the generated snapshot, cumulative failure resolution and independent review remain outstanding. No UI/browser, hosted, performance or numeric-coverage readiness is claimed.

### Diagnostic continuation author evidence 2026-10-06

Verified root-owned new lifecycle `730ffa3c-8fe8-4b93-b5b8-4da0f9e61cee` readiness on isolated 55421/55422: Auth/REST/Storage HTTP 200, checked schema ready, ledger 94 with all prior 92 and both Story 14.3 records unchanged. Canonical resume baseline is `a9e2838e80afbd9718c6d907c5518a152b286b1f`; first independent review still covers the complete implementation from `2a6c9e6d6859987590f2e875f695a75c16125af6`, including `c8d0a881`.

First resume full diagnostic (eight workers, file parallelism retained, required flag and safe diagnostics enabled) returned native 1: 1,355 total/1,353 passed/one retained INT-009 failure/one intentional recovery skip; all 49 conflicts passed. Peak 44 PostgreSQL clients does not explain the failed linked-job CREATE. JSON-only reporting suppressed console diagnostics. Correcting that invocation to default plus JSON reporters makes existing safe real-RPC codes observable without changing code/assertions/config/timeouts. The corrected complete full workload returned native 0: **1,355 total/1,354 passed/0 failed/one intentional recovery skip**, including all 49 conflicts, all 32 retained booking cases, migration/ACL and inventory tests.

No production defect/fix or infrastructure cause is claimed; historical INT-004 and first-resume INT-009 causes remain unknown and their exact results are preserved. Current full integration is green; independent full-diff review/trail inspection remains pending. No filtered result or skip waiver substitutes for this full execution. Detailed evidence: [authorized continuation](../test-artifacts/story14-3-verification.md#authorized-diagnostic-continuation--2026-10-06). Root owns terminal metadata and lifecycle Stop.

Canonical ESLint EPERM persisted under the build actor, which identified immutable generated cache files as Markdown/JSON rather than lintable source. Root authorized the narrow `_bmad/render/**` global ignore; the author applied only that pattern/comment, preserving all application/test coverage and the unmodified canonical lint command. The build actor then executed canonical `pnpm run lint`: **native 0, 0 errors / 13 inherited warnings**. No DB rerun is needed for this cache-only change. Independent first review includes this delta and specifically investigates possible intermittent CREATE fail-closed clock/HMAC/CAS/token-expiry/concurrent-fixture paths across the full implementation.

### R1 fix-author evidence — 2026-10-06

First independent full-implementation review completed before this scoped patch batch. Historical49-case reports lacked both additional AC10 tests (exhaustion and distinct-key concurrent writes): these were unregistered, not skipped; prior claims that they executed are withdrawn. The new60-case suite collects both actual tests and nine new regression cases. All14 named unit IDs, all six integration IDs, all four transferred P0/P1 cases and the eight consumed-writer classes retain their original obligations.

CLI-generated immutable forward migration `20261006144057` was applied incrementally; all94 prior complete ledger records are unchanged, final95. v2 proof binding blocks old incomplete fresh aggregate authority while authorized historical replay remains intact. Existing first-pair conflict identities retain accepted workflow metadata; supplemental stable rows associate every additional capacity participant. New/changed full identities remain open. Genuine correctly signed otherwise valid expired authority returns stale and uses at most three real same-UUID attempts, preserving the normalized public code/message result. Forged, missing, cross-actor, future, oversized and malformed proofs stay denied. Invitation confirmed identity/expiry is checked after the final blocking operation-row lock. Independent literal persisted absence/blocked windows and four-participant capacity readback now exercise actual writers/commands.

Affected10-suite diagnostic passes native0:143/143,0failed/skipped. Current full required eight-worker integration fails native1:1366total/1362passed/3failed/1intentional recovery skip; all four transfers and both corrected AC10 names pass in that report. A bounded three-suite diagnostic later fails native1:102total/101passed/1failed/0skipped, capturing genuine future-issued proof at exhaustion. The final authorized receipt workload also fails native1:102/101passed/1failed/0skipped at an original valid signed proof control. Its read-only sampler proves six database wall-clock reversals; same-proof receipt for that direct path remains unavailable. No filtered or later green diagnostic waives the full gate. Canonical source/unit/build/containment/audit/advisor checks pass with counts and exact safe failure diagnostics in [R1 evidence](../test-artifacts/story14-3-verification.md#r1-integrity-fixes-and-current-verification--2026-10-06). No security guard/time bound, timeout/assertion/CI, host time-sync or unrelated quote product behavior was weakened or changed. Root owns terminal status/lifecycle Stop; author result remains incomplete pending failed-gate diagnosis and follow-up inspection.

## Suggested Review Order

Author: `/root/build_14_3/author_14_3`, implementation/fix author; its explicitly owned High worker implemented the pure modules.
Refreshed against uncommitted R1 fixes at HEAD `5d61f44c30bbd6eb9e659966b50b69c4dd377d7d`. Full implementation review scope remains baseline `2a6c9e6d6859987590f2e875f695a75c16125af6`, including checkpoint `c8d0a881`; first independent review completed and scoped high fixes require follow-up inspection.

### Actual saves preserve command and replay authority

Existing create/update entries use internal snapshot/detect/finalize orchestration with the original UUID and closed result contract. Genuine valid expiry refreshes through the same three-attempt stale path; exhaustion uses the existing retryable SERVER_ERROR code, without adding a wire field (AC6/10).

- `src/server/commands/bookings/create-booking.ts:7` — `createBooking`: existing public command entry.
- `src/server/commands/bookings/booking-db.ts:15` — `executeBooking`: preserves typed SQL failure mapping.
- `src/server/bookings/save-with-conflicts.ts:19` — `saveWithConflicts`: bounded same-UUID retry and cookie-bound authority.
- `tests/integration/commands/booking-conflicts.int.test.ts:201` — `three real stale attempts`: actually registered exhaustion with exact durable no-op.

### Exact facts and signed validity cross the SQL boundary

Fact-equivalence verification remains the approved bridge between the sole TypeScript detector and SQL. The forward fix returns stale only for genuine otherwise valid expiry after HMAC/current-facts/output checks; strict future/oversized/invalid authority stays denied, and engine v2 binds complete participant associations (AC5/6/11).

- `supabase/migrations/20261006144057_booking_conflict_review_integrity_fixes.sql:25` — `finalize_booking_conflicts`: bound authority, full CAS and verified-expiry refresh.
- `src/server/bookings/conflict-attestation.ts:6` — `BOOKING_CONFLICT_ENGINE_VERSION`: refuses older incomplete fresh authority.
- `tests/unit/server/bookings/conflict-attestation.test.ts:19` — `CONFLICT_CLAIM_FIELDS`: each claim tampering changes authority.
- `tests/integration/commands/booking-conflicts.int.test.ts:677` — `correctly signed otherwise valid`: isolated database-relative clock/lifetime guards and controls.

### Deterministic local windows and capacity remain pure

Half-open UTC microseconds and explicit Stockholm local windows preserve gap/fold policy and layered capacity arithmetic. Independent literal assertions now test persisted dated absence/blocked adapter behavior through actual resource and booking commands, supplementing the pure engine fixtures (AC1–4/12).

- `src/features/scheduling/conflicts.ts:10` — `detectConflicts`: sorted participant/person/window identities.
- `src/features/scheduling/capacity.ts:73` — `dailyCapacity`: actual schedules and separate capacity terms.
- `src/features/scheduling/time-zone.ts:45` — `stockholmLocalToUtc`: first-valid gap and earlier fold.
- `tests/integration/commands/booking-conflicts.int.test.ts:650` — `persisted dated absence`: independent literal UTC warnings from persisted facts.

### Complete associations and final-lock expiry preserve integrity

Full tenant refresh remains necessary for peer and aggregate dependencies. The established first-pair row/key remains stable for unchanged accepted evidence; one supplemental stable row per remaining participant makes every booking retrievable, while changed full identities reopen. Confirmed invitation identity and actual expiry are rechecked after all blocking locks (AC7–10).

- `src/server/bookings/conflict-facts.ts:113` — `bookingIds.slice(2)`: associates every remaining capacity participant.
- `tests/integration/commands/booking-conflicts.int.test.ts:606` — `every participant in four-booking`: literal retrieval, accepted-key preservation and changed-identity refresh.
- `supabase/migrations/20261006144057_booking_conflict_review_integrity_fixes.sql:132` — `clock_timestamp`: actual expiry after the operation-row lock.
- `tests/integration/commands/booking-conflicts.int.test.ts:253` — `holds first gate before row lock`: all eight actual consumed-writer race classes.

### Execution evidence and remaining blockers stay visible

All four transferred P0/P1 obligations use actual commands and exact durable readbacks. The registration audit withdraws historical exhaustion/distinct-key execution claims; current reports distinguish executed failures from filtered diagnostics. Safe observers retain actual RPC responses and emit only guard booleans/time deltas; current full verification remains failed, so focused passes do not imply completion (AC7–12).

Root authorized only immutable generated BMAD Markdown/JSON cache exclusion for canonical lint EPERM; application/test coverage remains intact. Applied migrations stay immutable and the new forward record preserves all94 prior ledger entries.

- `eslint.config.mjs:19` — `_bmad/render/**`: narrow generated-cache ignore.
- `tests/integration/commands/booking-conflicts.int.test.ts:157` — `14.3-INT-005`: exact CREATE/UPDATE rollback snapshots.
- `tests/integration/commands/booking-conflicts.int.test.ts:177` — `14.3-INT-006`: actual stale save keeps original identity.
- `docs/process/local-setup.md:129` — `Booking conflict attestation`: dedicated private key and synthetic local bootstrap.

Evidence: [author verification/AC mapping](../test-artifacts/story14-3-verification.md) and [registration audit](../test-artifacts/story14-3-r1-case-registration-audit.json). Current full8-worker parallel run is native1:1366total/1362passed/3failed/1intentional recovery skip. Focused10-suite diagnostic is native0:143/143,0failed/skipped; both later three-suite diagnostics are native1:102/101passed/1failed/0skipped; the final1210-sample read-only diagnostic observes six DB wall-clock reversals. Canonical lint is native0 with0errors/13inherited warnings; full units1993total/1992passed/0failed/1inherited Windows xattr skip; all14 named scheduling cases repeat under three host timezones. Historical failure evidence remains unchanged and unknown.

Limits: failed cumulative verification remains unwaived. Database wall-clock regression is observed in the final workload; the direct failed proof lacks same-proof receipt and earlier causes remain unknown. Readbacks are postfailure, not the original rejection snapshot. Scoped follow-up review/trail inspection and exact empty-chain Epic CI remain required. No14.4 browser/editor/override, hosted/external, numeric coverage or performance/scalability claim is made.

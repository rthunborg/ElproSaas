---
title: 'Story 14.4: Booking Editor with Live Conflict Warnings and Audited Override'
type: 'feature'
created: '2026-10-07'
status: 'done'
baseline_revision: 'b94be3d33b7161e31ff4e01da79dd36c5474fd73'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - 'docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md'
  - 'docs/decisions/epic-14-story-ownership-contract-d-2026-10-07.md'
  - '_bmad-output/implementation-artifacts/epic-14-context.md'
  - '_bmad-output/test-artifacts/test-design-epic-14.md'
  - '_bmad-output/test-artifacts/atdd-checklist-spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md'
  - 'docs/process/local-setup.md'
  - 'docs/process/review-order.md'
  - 'docs/process/agent-model-routing.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Booking persistence and authoritative conflict detection exist, but users cannot create/edit bookings through the responsive editor or deliberately accept a collision with attributable evidence.

**Approach:** Expose the existing checked detector through a sanitized live preview and use the existing atomic booking transaction for an explicit, reasoned override. Deliver the approved side-sheet/full-screen editor, optional connections, persistent open-conflict count, dirty guard, and connected failure/retry behavior. Under owner-approved Contract D, retain current toolbar and pre-connected job/customer entries and the reusable person/time-prefill seam; only empty-slot click/drag acceptance transfers to Story 15.1 before actual calendar entry-point exposure/completion.

## Boundaries & Constraints

**Always:** Phase B legacy parity; active `resources` owns this capability and `scheduling` remains pending with empty live surfaces. Follow Contract C, owner-approved Contract D and the existing sole detector, current-row verification, shared tenant gate, command-only writes, same-tenant references, exact workflow identity, and atomic booking/assignees/conflicts/acceptance/outcome/audit. `Bookings.Manage` grants admin/project leader writes; Montör reads only its own joined bookings/conflicts and has no editor mutation or tenant-wide preview authority. Resolve actor from current authorized membership and time in SQL. Evaluate Stockholm time/DST through existing helpers; preserve untouched PostgreSQL microseconds. Keep unsent input after transient failure, explicit retry, and success only on confirmed persistence.

**Block If:** A current conflict or candidate can inherit a different preview's acceptance; implementation needs a pending scheduling view, wider permissions, a second detector, privileged application credentials, or new job/competence facts. Routine engineering choices within the existing boundaries need no owner checkpoint.

**Never:** Ship E15 scheduling projections/nav, recurrence controls/expansion, resolver, time reporting, calendar feed, notifications, file ownership, E16 job depth, overtime mutation, hosted changes, AI/PWA/offline/portal/vendor APIs, or other Phase C scope. Do not copy Lovable code. No acceptance flag on the booking, client-authored detector authority, tenant-wide blanket acceptance, independent post-save acceptance write, or edited applied migration.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Standalone/connected | Valid create/update; optional job/customer/facility/contact | Same editor and transaction; connections can be cleared; compatible same-tenant references | Generic validation/authorization errors retain draft |
| Live warning | Assignee/time/role/connection changes; asynchronous preview responses race | Latest candidate's authoritative rule/person/window/collision timeline replaces obsolete warnings and availability hints | Failed preview is visible; never present unknown as conflict-free |
| Conflict save | Current warning set; explicit acknowledgment and nonblank reason | Explicitly reviewed candidate warning set with required reason; selected reviewed candidate-related whole logical groups become accepted, other reviewed candidate conflicts remain open, unrelated tenant conflicts excluded; acceptance actor/time/audit commit atomically | Missing acknowledgment returns BOOKING_CONFLICT_UNACKNOWLEDGED; invalid reason/identity is a no-op |
| Stale review | Candidate/facts change after preview, including concurrent booking | Fresh warnings and renewed explicit acknowledgment; no acceptance/write from stale review | PREVIEW_STALE, retain draft; no silent acceptance across server retry |
| Replay/fault | Response lost after commit, altered reason/selection, revoked actor, or fault before audit | Equal authorized retry returns historical outcome once; changed business decision conflicts; faults roll back all rows | COMMAND_CONFLICT/current denial/retryable SERVER_ERROR; exact no-op evidence |
| Existing workflow | Identical accepted key, changed collision, unrelated peer conflicts | Identical evidence survives; changed identity becomes open; chip counts open only | Never infer resolver outcome or accept unrelated conflicts |

</intent-contract>

## Code Map

Official resumed Step 02 inspected the current files at root-verified full baseline `5ce4d6b54ba3fff1f1406aba9c03373a00ba2635` on `codex/epic14-resume`. Primary planning context is the freshly regenerated `epic-14-context.md`; targeted UI inspection and synchronous context-free `gpt-6.1-sol` High authority exploration cover the actual RBAC/current-facts/transactional-integrity change. Existing anchors are source evidence, not future completed review stops. The original `246c8402fec01fa5f4e46cfaf5466e78c0b9cd5c` baseline remains in the historical result.

- `src/features/resources/booking-types.ts:4`/`:20`; `src/server/commands/bookings/validation.ts:7`/`:27`/`:54`/`:68`/`:71` — closed booking input, canonical UUID/assignee ordering and microsecond preservation; add human decision separately from detector facts.
- `src/server/commands/bookings/create-booking.ts:7`, `update-booking.ts:6`, `booking-db.ts:15`; `src/server/commands/envelope.ts:105`/`:106`; `src/server/authz/permission-matrix.ts:35` — existing actual command entries, ownership gate and Bookings.Manage; SQL owns audit.
- `src/server/bookings/conflict-facts.ts:62`/`:69`/`:101`/`:103`/`:116`, `save-with-conflicts.ts:23`/`:31`, `conflict-attestation.ts:7`/`:20` — checked snapshot/shared preview, full-tenant refresh and bounded retry. Keep original logical groups when translating engine output to persisted rows. The existing stale loop silently re-detects; reviewed editor saves require a stale-review result instead of inheriting acceptance across that loop. Browser review receipt uses a separate authenticated domain/type from private detector proof.
- `src/features/scheduling/conflicts.ts:10`/`:18`/`:23`/`:36`, `time-zone.ts:47` — sole rule engine, complete participant identity and pinned Stockholm conversion. Base v1 plus v2 aggregate associations require a logical-group-to-all-persisted-keys projection; filtering only the candidate's row columns misses aggregate peers.
- `supabase/migrations/20261006144057_booking_conflict_review_integrity_fixes.sql:3`/`:15`/`:25`/`:31`/`:36`/`:53`/`:58`/`:59` — current snapshot/finalize HMAC, authorization before replay, locked fact comparison, expiry/stale paths and commit. Create snapshot currently generates a UUID each time; add a separate stable proposed-create-ID contract without treating it as the update `p_booking_id`. Immutable migration evidence; forward-replace only.
- `supabase/migrations/20261006122441_booking_conflict_detection_integration.sql:5`/`:18`/`:24`/`:52`/`:129`/`:139`/`:216`/`:238`/`:249`/`:277`/`:291`/`:331`/`:340` — common first gate/current SQL roles, booking-only replay digest, complete facts, seven-field derived-output whitelist, replay-only legacy wrappers and private atomic commit/refresh/audit. Extend replay digest with canonical business decision consistently; preserve old authorized outcomes. Acceptance is separately verified workflow input, never extra detector-output fields.
- `supabase/migrations/20261006101609_bookings_and_assignees.sql:42`/`:49`/`:56`/`:60`/`:65`/`:110`/`:113`/`:116`; `20261006104143_booking_invariant_corrections.sql:13` — existing workflow columns/constraints and own-person Montör read scope; no replacement table needed.
- `src/features/resources/read.ts:12`, `actions.ts:15`; `src/components/crm/Dialog.tsx:22`, `src/components/quotes/FollowUpSheet.tsx`, `src/components/resources/PersonSchedulePanel.tsx` — cookie-bound read/action, focus trap/return, pending dismissal protection, visible in-dialog error/retry and draft-retention patterns.
- `src/components/jobs/JobList.tsx:49`, `src/components/jobs/JobDetailView.tsx:42`, `src/components/crm/CustomerDetail.tsx:46`, `src/features/jobs/read.ts:351`, `src/features/crm/read.ts:109`, existing `src/app/(app)/jobs/page.tsx` and detail pages — current jobs-list toolbar and job/customer detail hosts, gated independently by booking entitlement. Existing hosts contain no booking entry yet; attach the new entry and scoped booking summaries here, without a calendar projection or new route/nav.
- `src/components/crm/Dialog.tsx:22`/`:37`/`:82`/`:135` — shared focus trap/return and busy guard exist, but its panel is currently centered `max-w-lg`; add an optional sheet variant preserving all existing dialog callers, then layer booking dirty-close/back guard in the editor.
- `src/app/globals.css`, Phase B UX §§1/4.6/6 — established Tailwind/Geist/Phase A visual posture, side-sheet/full-screen behavior. UX explicitly has no DESIGN.md or new component library; frontend-component skill's foreign project paths do not authorize either.
- `src/scope/manifest.ts:249`/`:263`; Contract C; `_bmad-output/test-artifacts/test-design-epic-14.md:211`–`:223` — active-resource/pending-scheduling and 14.4 acceptance/test authority. Predecessor spec Code Map/Tasks/Design Notes/Spec Change Log/current result and `story14-3-verification.md` establish continuity.

## Tasks & Acceptance

**Execution (dependency order):**

1. `src/features/resources/booking-types.ts`, new `src/features/resources/booking-editor-input.ts`, `src/server/commands/bookings/validation.ts`, `src/server/commands/command-errors.ts`, `src/server/commands/bookings/booking-db.ts` — define closed canonical human decision, whole warning-set review, duplicate-free sorted selected logical identities, trimmed reason, stable create UUID and typed `PREVIEW_STALE`/`BOOKING_CONFLICT_UNACKNOWLEDGED` safe errors. Separate business decision from receipt/proof transport. Unit-test every applicable I/O-matrix edge in `tests/unit/features/resources/booking-editor-input.test.ts` and existing `tests/unit/server/commands/bookings-validation.test.ts`, adding race/state transitions at their integration/browser boundary.
2. `src/server/bookings/conflict-facts.ts`, new `src/server/bookings/editor-preview.ts`, `src/server/bookings/conflict-attestation.ts`, `src/server/bookings/save-with-conflicts.ts`, `src/server/commands/bookings/create-booking.ts`, `src/server/commands/bookings/update-booking.ts` — retain sole-engine output plus complete logical-to-v1/v2-key groups during existing translation. Project only candidate-related warnings, checked display context and availability hints. Authenticate a separate editor receipt binding actor/tenant/operation/target/stable proposed UUID/canonical candidate/full reviewed groups/fact digest/versions/validity. Verify before consuming its group map and carry authenticated claims into SQL. Keep raw detector proof, complete tenant facts, unrelated warnings, secrets and durable history off browser payloads. Stale/expired review requires renewed warnings/review; do not use the existing automatic stale loop for a reviewed save. Any retained conflict-free retry must block newly appearing warnings.
3. New `supabase/migrations/*_booking_editor_audited_override.sql`, generated during implementation with discovered `supabase migration new` — forward-extend checked snapshot/finalize/private commit with stable proposed-create identity and authenticated review claims. Under the existing first gate validate current actor/facts/candidate/full reviewed set, nonblank reason and selected subset before fresh writes; expand each selected candidate-related logical group to all exact v1/v2 persisted keys. Preserve the derived-output whitelist. Apply selected acceptance with current membership/SQL time/reason after refresh and before audit, atomically with booking/assignees/outcome. All fresh authenticated finalize paths enforce review, including direct RPC and obsolete overloads; retain private ACLs, replay-only legacy wrappers and current-role revalidation after waits. Extend snapshot/finalize/commit durable digest consistently with stable ID and normalized review/selected groups/reason; exclude receipt/signature/issuance/expiry/correlation. Preserve authorized legacy-digest replay explicitly without equating it to a new override decision. Reuse existing workflow columns; update exact RPC ACL assertions in `tests/integration/rls/bookings.rls.test.ts` and `tests/integration/rls/migration-reset.int.test.ts`.
4. New `src/features/resources/bookings-read.ts`, `src/features/resources/booking-actions.ts`, `src/features/resources/booking-action-state.ts` — checked cookie-bound reads, booking-entitled same-tenant picker labels/options without money or protected CRM identifiers/contact details, compatible optional connections, host-scoped booking summaries/edit defaults and read-scoped persistent open count. Derive booking entitlement server-side using current matrix helpers; CRM/job host access alone grants no booking authority. Actions resolve tenant/actor server-side and return typed preview/save/retry state. Revalidate `/jobs`, `/jobs/[jobId]`, `/customers/[customerId]` only after confirmation. Preserve exact PostgreSQL timestamp strings when untouched; changed local/all-day input uses existing Stockholm helpers.
5. `src/components/crm/Dialog.tsx`, new `src/components/resources/BookingEditor.tsx`, `src/components/resources/BookingConflictPanel.tsx`, `src/components/resources/BookingEntry.tsx`, `src/components/resources/BookingConflictChip.tsx`; `src/app/(app)/jobs/page.tsx`, `src/app/(app)/jobs/[jobId]/page.tsx`, `src/app/(app)/customers/[customerId]/page.tsx`, `src/components/jobs/JobList.tsx`, `src/components/jobs/JobDetailView.tsx`, `src/components/crm/CustomerDetail.tsx` — add opt-in responsive dialog sheet shape, keeping existing default dialog behavior. Implement approved fields/status, multi-person hints/work-role filter, latest inline warnings with text and mini-timeline, explicit current-set review/reason and selected logical acceptance (empty selection allowed after review/reason). Candidate edits invalidate review; obsolete results cannot overwrite it. Attach `Ny bokning` to jobs-list toolbar and pre-connected `Boka`/`Ny bokning` to job/customer detail; show scoped booking summaries with edit reopening and persisted open chip. Keep action state mounted through pending/success; dirty Escape/back/close prompts retain on cancel and discard deliberately with focus return. In-sheet errors/explicit retry retain unsent input. Use existing tokens/Geist, 360×640 scrolling and ≥44px targets/≥48px field primary actions. Supply reusable person/start/end-prefill props only; actual slot hosts remain in 15.1.
6. New `tests/integration/commands/booking-editor.int.test.ts`, `tests/integration/components/booking-editor.test.ts`, `tests/e2e/booking-editor.e2e.spec.ts`, `tests/unit/scope/booking-editor-scope.test.ts`; existing `tests/integration/commands/booking-conflicts.int.test.ts`, `tests/integration/commands/bookings-replay-authority.int.test.ts`, `tests/integration/rls/bookings.rls.test.ts` — implement every retained named obligation mapped below. Cover stable create preview UUID, candidate sorting third in 3+ participant groups, complete base/association selection, empty selection, forged/unrelated/partial group IDs, review/proof substitution, current facts/concurrent writers, direct RPC bypass, revoked replay, changed reason/selection replay and faults after acceptance/before audit with exact all-row no-op snapshots. Pin unchanged accepted identity, changed-key reopening, microseconds/DST, browser count reload and phone failure/retry. Component rendering proves structural semantics only; actual browser action plus durable readback proves entry/create/edit/retry behavior.
7. `_bmad-output/implementation-artifacts/spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md` and `_bmad-output/test-artifacts/story14-4-verification.md` — record actual revision/commands/executed-failed-skipped evidence, AC mapping, limits and author-written final review trail after implementation/fixes. Parent owns workflow/progress state. Predev ATDD and postdev automation remain separate later phases; planning creates no tests or completed trail.

**Acceptance Criteria:**

1. Given an entitled current toolbar/job/customer entry, when opened and edited, then the desktop side sheet or 360×640 full-screen sheet exposes all approved fields, optional standalone connections, availability hints and prefilled context without E15/recurrence controls (COMP-001/002, E2E-001/006). Only empty-slot click/drag transfers to Story 15.1 actual Schema/Resurser hosts; it must pass before calendar entry-point exposure/completion and is not claimed here.
2. Given changed assignees/time or other detector inputs, when current preview returns, then the visible panel explains every relevant rule/person/window/collision with an accessible mini-timeline, old results cannot overwrite newer warnings, and failures remain visibly unknown (COMP-003/004).
3. Given current warnings, when saving without explicit acknowledgment or with blank/forged/stale/unauthorized acceptance, then the editor shows the corresponding safe error, retains draft and commits no business/outcome/audit rows; authorized explicit current-set review with nonblank reason atomically accepts selected reviewed candidate-related complete logical groups with actor/time/reason and one audit, leaving other reviewed candidate conflicts open and excluding unrelated tenant conflicts (INT-001/002/003).
4. Given accepted/unaccepted/resolved conflicts and a later collision change, when the booking reloads or is updated, then open-only counts persist, identical acceptance survives and changed identity is open; unrelated conflicts are never accepted by this candidate's action (INT-004/005, E2E-002).
5. Given dirty edits, when Escape/back/close is requested, then cancel retains input and deliberate discard closes with predictable focus return; in-flight saves cannot silently dismiss the form (E2E-003/007).
6. Given transient failure or lost response after commit at 360×640, when explicit retry occurs, then suitable unsent state remains, success appears only after server confirmation and durable state contains one booking/assignment/conflict set with one attributable audit (E2E-004/005).
7. Given Montör/unauthorized/cross-tenant/direct RPC requests, when read/preview/save/override is attempted, then existing current role/row authority prevents broader visibility/mutation with generic errors; resources stays active and scheduling pending (GOV-001, retained RLS obligations).

**Named evidence mapping (no execution claimed in planning):**

| Retained obligation | Planned file / observable assertion |
|---|---|
| 14.4-COMP-001/002 | `tests/integration/components/booking-editor.test.ts`: optional sheet shape/focus structure, no recurrence and field/draft bindings; interactive changes also exercised by E2E. |
| 14.4-COMP-003/004 | Same component suite plus editor input units and command integration: newest candidate warnings replace stale results; rule/person/window/context/timeline and non-color semantics. |
| 14.4-INT-001/002/003 | `tests/integration/commands/booking-editor.int.test.ts`: actual checked save denies unreviewed/blank/forged/stale/unauthorized requests with exact no-op; selected whole-group acceptance/current actor/time/reason/audit commits atomically. |
| 14.4-INT-004/005 | Same command suite: reviewed unselected warnings stay open; accepted/resolved excluded from count; unrelated groups excluded; unchanged evidence survives and changed identity reopens. |
| 14.4-E2E-001/007 | `tests/e2e/booking-editor.e2e.spec.ts`: 360×640 full-screen/scroll/reachable actions, keyboard/focus/live regions and measured target bounds; desktop side-sheet counterpart. |
| 14.4-E2E-002/003 | Same browser suite: persisted open-only count after actual reload; dirty Escape/back/close cancellation preserves values, deliberate discard and focus return. |
| 14.4-E2E-004/005 | Same browser suite: induced phone save failure retains unsent input/error/retry and no success; explicit retry yields exactly one confirmed booking and durable related state/audit. |
| 14.4-E2E-006 retained portion | Same browser suite: jobs toolbar standalone create and pre-connected job/customer entries, then reopen/edit persisted booking with correct context. Person/time seam component test is preparation only. |
| 14.4-GOV-001 | `tests/unit/scope/booking-editor-scope.test.ts` plus existing manifest/deferred scans: no recurrence/E15 nav/views/resolver/time reports/notifications/feed. |
| 14.4-E2E-006 transferred portion | Story 15.1 actual Schema/Resurser browser click and drag, selected interval/person context, mandatory before calendar entry-point exposure and 15.1 completion; pending with no 14.4 execution credit. |

## Spec Change Log

- 2026-10-07 preparation author: recorded owner-approved Contract D; reconciled only empty-slot entry ownership and selective reviewed conflict acceptance in the intent contract; retained all other approved intent and historical blocked evidence. Status is draft for the pending official replan, not ready-for-dev or new verification.
- 2026-10-07 official resumed Step 02 author: preserved the prepared intent contract verbatim, loaded freshly compiled Epic 14 context and current predecessor continuity, and rechecked actual UI/authority seams at `5ce4d6b54ba3fff1f1406aba9c03373a00ba2635`. Replaced provisional execution with file-specific dependency order, complete named evidence mapping, stable create identity, separate reviewed receipt, whole-group selective transaction and semantic replay obligations. Historical blocker/evidence stays intact. No implementation or product verification was performed.
- 2026-10-07 implementation author: implemented the responsive editor, current authorized sanitized reads/preview, opaque separate review receipt and atomic selective whole-group acceptance. Preserved the intent contract; added three immutable forward migrations, activated all 92 retained named tests and two component regressions, corrected foreign-reference preview and tenant-scoped fallback identity defects, and recorded final build/required integration/browser evidence below. This author owns the final review trail; parent retains official review and terminal workflow state.
- 2026-10-07 original fix author, Round1: applied all ten accepted patches in one batch without changing frozen intent or driver-owned triage. Added the immutable fourth forward migration and actual large-group/identity red→green evidence; corrected the discard-focus regression found by the first browser run. Refreshed the same author review section against final build `TGBWaTwRYVJLLfZUysZQV`, working-tree fingerprint and actual final gates; preserved original successes, failed diagnostics and cleanup limitations as history.

## Review Triage Log

**Round 1 of 3**

### 2026-10-07 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 10: (high 4, medium 6, low 0)
- defer: 0
- reject: 4: (high 0, medium 0, low 4)
- addressed_findings:
  - `[high]` `[patch]` Preserved each untouched timestamp independently, with pure and mounted durable endpoint regressions.
  - `[high]` `[patch]` Exposed standalone/disconnected reopen and edit through the existing authorized toolbar host.
  - `[medium]` `[patch]` Rendered safe read-error retry while withholding unknown-authority data and controls.
  - `[medium]` `[patch]` Preserved the compatible facility when selecting a customer-level contact, with durable mounted regression.
  - `[medium]` `[patch]` Rendered absent current references explicitly as disabled current-only options; deliberate clears persist.
  - `[medium]` `[patch]` Projected recognizable same-tenant staff identity under the unchanged checked management gate and closed ACL.
  - `[medium]` `[patch]` Distinguished untitled jobs using safe existing customer context and job IDs.
  - `[medium]` `[patch]` Removed the unrelated logical-ID size ceiling consistently in TS/forward SQL, retaining exact signed whole-group validation and tested signed-partial/forged no-ops.
  - `[high]` `[patch]` Blocked submission during discard confirmation and guarded pending/unresolved dismissal; repaired and verified the fix-induced focus regression.
  - `[high]` `[patch]` Retained the exact unresolved attempted command/decision for retry; blocked edits until resolution and reopened the confirmed booking for update.

All six configured layers completed independently at `gpt-6.1-sol` High against the complete 68-file artifact (SHA256 `2C05C6E096CDC39236B5C6FA1EE6D112CE6D497C3901B8A4F64474D25FFA1A04`). This is completed broad round 1 of 3; all ten patches were applied by the original implementation author in one synchronous batch. Security returned `No findings.` Capacity refusals were recovered in batches. The external CLI genuinely completed; its first CMD stdout read failed on forward-slash path formatting, its native-path read recovered the exact result, and the already-started exact native-path retry completed with exit 0. Both runs retain one external-layer/round identity, with the original transport failure preserved. Full provenance and independent classification are retained at `C:/Users/Rasmus/AppData/Local/Temp/story14-4-r1-review-provenance-triage.md`; parent owns durable final reporting. No intent/spec loopback or destructive revert is needed.

Final narrow fix/trail check passed against source/test fingerprint `624e4347d9fd7ded2ec26164a7ec5655706ac597c20711b7aeeb395dde440fc8` (all 48 recorded file hashes matched) and production build `TGBWaTwRYVJLLfZUysZQV`. Required full integration: 1456 registered/1455 passed/0 failed/1 existing recovery skip; affected actual API/RLS/schema 169/0/0. Final corrected-build browser 15/0/0/0 flaky, native 0; unit 2033 registered/2032 passed/0 failed/1 existing xattr skip; final component/read 25/0/0. Full integration preceded the final focus-only UI correction; command/SQL/input files remained unchanged, with affected components and final-build browser rerun afterward. The earlier 13-pass/2-fail diagnostic and zero-body preflight remain preserved. The single original-author Suggested Review Order has 20 verified stops; independent narrow source/test/evidence inspection also passed. This narrow check supplies no broad Round 2 or Phase 7 credit. Follow-up recommendation: true; patched high 4/medium 6/low 0, score 18. Empty-DB Epic CI and transferred Story 15.1 calendar checks remain pending.

## Design Notes

Human acknowledgment and detector attestation are different authority. Bind the editor review to the proposed create UUID and current logical collision set; the existing create snapshot otherwise regenerates the UUID used by identity. A new server-authenticated preview receipt is distinct from the private detector proof. Derive acceptance groups from the same engine output, covering v1 base and v2 aggregate association keys, and verify them in the same transaction. Preserve full-tenant refresh without allowing the editor to accept unrelated conflicts.

The final architecture supersedes older UX wording that an override stays open: accepted is a workflow record, not a booking flag. Contract D settles granularity: explicit review and required reason, selected reviewed candidate-related complete logical groups accepted, other reviewed candidate conflicts open; existing permissions and current server authority remain unchanged.

Review and selection are distinct: empty selection after explicit review/nonblank reason may save with warnings still open. Unselection never revokes an already accepted identical identity; retain its evidence. Selection operates on full engine identities, including the candidate when it sorts third or later among aggregate participants, and expands through the authenticated group map to every persisted association. Display/count projection must deduplicate logical associations; it must not turn one logical warning into multiple warnings merely because persistence uses base/association rows.

Equal committed replay checks current authorization before returning its historical outcome; transport expiry/fact drift after commit does not make a lost-response retry a second write. Before a fresh commit, expired/changed review produces `PREVIEW_STALE` and renewed review, not automatic acceptance. Include normalized reviewed/selected identities/reason in business command identity, while signature/validity/correlation remain transport. Reuse checked current facts and signing/Vault patterns; implementation verifies current Supabase docs/CLI before changing their use, not by browsing or touching hosted projects in this planning run.

## Verification

Final implementation/fix evidence: [story14-4-verification.md](../test-artifacts/story14-4-verification.md) records each of the ten patches, commands, assertions, red/green fixes, migration hashes and limits, preserving the original run as history. HEAD/baseline is `b94be3d33b7161e31ff4e01da79dd36c5474fd73`; final uncommitted source/test fingerprint is `624e4347d9fd7ded2ec26164a7ec5655706ac597c20711b7aeeb395dde440fc8` over48 files (`story14-4-r1-working-tree-evidence.json`). Final production build is `TGBWaTwRYVJLLfZUysZQV`, unchanged before/after browser execution. No product source changed after that build. Frozen intent is byte-identical to HEAD; parent owns subsequent official review/terminal result.

Typecheck, full lint (0 errors/13 existing warnings), production build and lockfile/service-role/bundle containment exited0; dependency audit remains valid original evidence (unchanged dependencies, 2 moderate/no high). Full unit: 2033 registered/2032 passed/0 failed/1 existing Windows xattr skip. Required full integration with normal parallelism and `SUPABASE_TEST_REQUIRED=1`: 1456 registered/1455 passed/0 failed/1 existing CI-only isolated recovery Storage proof skip; it includes169 affected real API/predecessor/RLS/schema passes without skips. Command/SQL/input files have not changed since that full run; the subsequent focus-only UI correction passed affected component/read25/0/0 and final browser15/0/0/0 flaky on the final build. All92 retained named obligations execute; added regressions cover all ten patches. No skipped test receives acceptance credit.

Four authorized SQL-only forward transactions preserved exact prior ledger hashes and progressed95→99 through `20261007131222`; applied files were never edited. The fourth migration's real95-peers-plus-candidate acceptance/identity tests went from2 failed to2 passed, including signed partial-map and forged-selection no-op negatives. No reset, broad seed, hosted action or unmanaged resource launch occurred. Root owns and retains the guarded local resources. Exact empty-DB migration/seed/required integration Epic CI remains mandatory before merge. Story15.1 calendar click/drag remains pending per Contract D. Numeric performance targets remain absent; fixture elapsed times do not establish an NFR pass.

Evidence limits: component rendering and mocked read transport do not prove RLS; actual command/SQL and browser bodies use synthetic isolated fixtures/local signing. Next actions serialize; browser proves invalidation/obsolete discard and latest queued preview, while reverse delivery uses the production response branch. Original Auth setup failure remains unknown with unidentified partial fixtures untouched. Round1 preflight exercised0 bodies due to an omitted required test flag; its first actual browser run13 passed/2 failed exposed the discard-focus regression and disabled-option assertion mismatch, both corrected before the final15/15 pass. Reports and identified fixture/context cleanup are preserved. Independent narrow fix inspection is not another broad review round or approval.

Validate the author trail with `node scripts/verify/check-review-order.mjs _bmad-output/implementation-artifacts/spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md`.

## Suggested Review Order

Author: `/root/build_14_4/implementation_14_4`, implementation and fix author.
Refreshed after the complete Round1 patch batch against baseline `b94be3d33b7161e31ff4e01da79dd36c5474fd73`, final uncommitted fingerprint `624e4347d9fd7ded2ec26164a7ec5655706ac597c20711b7aeeb395dde440fc8` and production build `TGBWaTwRYVJLLfZUysZQV`.

### Current host entry and durable draft

Contract D retains standalone create/update through toolbar/job/customer entries; toolbar summaries now make standalone and disconnected bookings reopenable. Summary projection still excludes command-invalid metadata; each endpoint now tracks changes independently, and absent historical references render as current-only options without additional reads or new assignment authority.

- `src/app/(app)/jobs/page.tsx:42` — `BookingEntry`: exposes the entitled toolbar; job/customer hosts use the same editor.
- `src/components/resources/BookingEntry.tsx:39` — `bookingSummaryDraft`: exposes authorized summaries and projects valid facts for every retained host.
- `src/features/resources/booking-editor-input.ts:24` — `prepareBookingTimes`: preserves each untouched instant; all-day changes deliberately convert both endpoints.
- `src/components/resources/BookingEditor.tsx:139` — `const optional`: shows missing current references distinctly without offering them for new assignment.

### Authorized preview without detector authority in the browser

Reads/actions still resolve current authority independently of host permissions, and same-tenant candidate-reference validation remains before receipt issuance. Failed reads expose only generic retry; existing checked staff lookup now uses membership/Auth email identity for recognizable labels, with a deliberate UUID fallback only when identity is absent. Untitled jobs use current safe customer context and distinguishing existing job IDs.

- `src/features/resources/bookings-read.ts:91` — `readBookingHost`: fails closed while returning sanitized summaries under current booking entitlement.
- `src/features/resources/booking-actions.ts:33` — `previewBookingAction`: checks current tenant and management authority before preview.
- `supabase/migrations/20261007131222_booking_editor_review_round1_fixes.sql:28` — `booking_editor_people`: projects same-tenant staff identity under the unchanged management gate and ACL.
- `src/server/bookings/editor-preview.ts:26` — `openEditorReceipt`: authenticates the encrypted review transport separately from detector proof.

### One current, selective acceptance transaction and replay identity

Selected complete candidate groups are accepted; reviewed unselected groups stay open. I removed the unrelated description-size ceiling from human logical IDs after genuine95-participant preview/save failure, retaining exact signed group validation and the single atomic commit. Existing tenant-plus-command fallback identity correction and current-authority replay remain intact; transport expiry cannot turn a committed retry into another write.

- `src/server/bookings/save-with-conflicts.ts:26` — `saveWithConflicts`: binds current candidate/facts and reviewed business decision before fresh finalization.
- `supabase/migrations/20261007121724_booking_editor_group_alias_fix.sql:3` — `booking_editor_groups_internal`: verifies complete signed candidate groups and every projected association.
- `supabase/migrations/20261007120235_booking_editor_audited_override.sql:279` — `update public.booking_conflicts`: records selected acceptance with SQL actor/time before the single audit.
- `supabase/migrations/20261007131222_booking_editor_review_round1_fixes.sql:2` — `booking_editor_decision_internal`: supports genuine large identities while preserving closed decisions, reason and subset validation.

### Resolve attempted saves before changing identity

An unknown save outcome now retains the exact attempted command, candidate and business decision for explicit replay; edits and dismissal stay locked until resolution, after which the confirmed booking can reopen as an update. Discard confirmation blocks submission, while preserving field focus during confirmation avoids the regression found by the diagnostic browser run; pending/unresolved discard remains guarded.

- `src/components/resources/BookingEditor.tsx:63` — `function change`: prevents candidate identity rotation while an attempted save is unresolved.
- `src/components/resources/BookingEditor.tsx:109` — `discard`: blocks submission while confirmation is open and requires current preview for fresh attempts.
- `src/components/resources/BookingEditor.tsx:114` — `attempted.current`: retains the exact input for retry rather than accepting an edited decision.
- `tests/e2e/booking-editor.e2e.spec.ts:349` — `E2E-005`: blocks attempted edits, replays once and reopens the confirmed booking for update.

### Assertions and operational limits

AC3/4 real SQL asserts large/third-candidate group selection, open/unrelated groups and exact rollback; AC6 browser replay compares exact durable snapshots. The matrix maps every accepted patch and AC to executed assertions, including mounted endpoints/connections and authorization labels; historical diagnostics and structural/mocked limits remain explicit.

- `tests/integration/commands/booking-editor-review-fixes.int.test.ts:12` — `95 peers`: proves complete large-group acceptance and signed-partial/forged no-op negatives.
- `tests/integration/commands/booking-editor.int.test.ts:361` — `after_acceptance`: covers create/update faults and exact acceptance/outcome/audit rollback.
- `tests/e2e/booking-editor.e2e.spec.ts:82` — `endpoint-only`: proves production handlers persist the untouched endpoint exactly.
- `_bmad-output/test-artifacts/story14-4-verification.md:1` — `Story 14.4 implementation verification`: records the full AC matrix, final gates and material limits.

Evidence: required full integration1455 passed/0 failed/1 existing recovery skip, including affected actual169/0/0; final browser15/0/0/0 flaky; unit2032/0/1 existing xattr skip; final component/read25/0/0. Type/lint/build/containment pass; audit remains unchanged dependency evidence. No retained Story14.4 acceptance is skipped. Limits include synthetic fixtures, serialized transport, unidentified original setup fixtures, pending15.1 calendar acceptance and mandatory empty-DB Epic CI. The post-integration focus-only correction passed affected components and final-build browser; narrow fix/trail inspection is not broad-round credit or approval.

## Planning Gate

Current official Step 02 verdict: **ready-for-dev; owner decisions resolved**. [Contract D (2026-10-07)](../../docs/decisions/epic-14-story-ownership-contract-d-2026-10-07.md) records both human approvals. Current baseline: `5ce4d6b54ba3fff1f1406aba9c03373a00ba2635`. Tasks are actionable and dependency-ordered, every AC uses Given/When/Then at the referenced outer surface, all retained named obligations are mapped, and no current intent gap or placeholder remains. Warning: `oversized`. This is readiness for later development, not implementation or editor acceptance evidence.

- Only empty-slot click/drag portion of `14.4-E2E-006` transfers to **Story 15.1: The Five Scheduling Views**, actual `Schema`/`Resurser` hosts. Both real click and drag must open the same editor with selected interval/person context and must pass before applicable calendar entry-point exposure and before 15.1 completion. Story 14.4 keeps its editor, toolbar/job/customer entries and reusable person/time-prefill seam; no scheduling nav/view/slot host is added now. All other 14.4 acceptance stays.
- Conflicted save requires explicit review/acknowledgment of the current candidate warning set plus required nonblank reason. Selected reviewed candidate-related complete logical conflict groups become accepted; other reviewed candidate conflicts stay open. Unrelated tenant conflicts are excluded. Preserve current server authorization/facts, exact identity, stable preview create UUID and atomic booking/acceptance/outcome/audit.

Official draft resume captured the `<intent-contract>...</intent-contract>` block before editing and preserved it byte-identically. Parent invoked the canonical renderer once and the official compile-epic-context delegate freshly regenerated the context; this Step 02 neither rerendered nor recompiled it. Current source/doc investigation plus the synchronous High authority summary found no new unresolved material decision. Original baseline/evidence/blocked result below remain history. No implementation, ATDD, product tests, migration/resource/database/browser/hosted action or root bookkeeping occurred in this planning step. Halt after planning applies; root owns canonical terminal result/completion reporting.

## Historical Planning Gate — blocked before Contract D

Everything in this historical section, including its unanswered questions and unapproved options, describes the pre-approval state; Contract D resolves both and the current Planning Gate supersedes it.

Gate verdict: **blocked — intent gap**. Actionable independent tasks and outermost UI criteria are preserved, but the sufficient/coherent gate cannot pass until the following observable choices are selected. This is not a service/credential/test blocker.

### 1. Empty-slot entry versus pending scheduling views

Evidence: `epics-phase-b.md:1542` requires toolbar, empty-slot click/drag and pre-connected job/customer entries. `ux-design-specification-phase-b.md:240` and `:252` place empty slots in Schema/Resurser scheduling projections. Contract C `:28`, manifest `:249`/`:263`, and test-design 14.4-GOV-001 (`:168`) keep those E15 views/nav absent. Current routes/components contain job/customer hosts but no active slot host. Contract C preserves every Epic acceptance and changes only 14.2/14.3 ownership; it does not authorize a 14.4 transfer.

Unanswered owner question: **Should 14.4 transfer empty-slot click/drag acceptance to E15 while delivering current toolbar/job/customer entry and a reusable person/time-prefill seam, or is a specific active-resource slot host authorized now?**

Options: (A) explicitly transfer the empty-slot obligation to E15 (recommended); (B) authorize and name an active-resource slot host now. Prospective transfer must name the receiving E15 story/entry host and retain the empty-slot portion of 14.4-E2E-006 plus the 14.4 story entry-point acceptance; real click and drag must open the same editor with selected person/start/end and must pass at that host before E15 exposure/completion. Component/prefill-only evidence in 14.4 cannot satisfy that transferred outer UI acceptance. The transfer is currently unapproved; no epic/test-design/ledger/contract artifact was changed. The other option requires the owner to specify/authorize the active host without an implicit E15 activation.

### 2. Mixed-conflict acknowledgment and acceptance granularity

Evidence: final architecture §10.2 (`architecture-phase-b.md:749`) and Epic sketch (`epics-phase-b.md:1542`) require explicit acknowledgment/reason, accepted rows and unacknowledged open rows. UX Journey B2 (`ux-design-specification-phase-b.md:536`) accepts capacity but leaves double-booking for later resolution; test-design INT-004 (`:218`) requires unaccepted detection to remain open. Final wording does not choose between all candidate conflicts accepted and selected candidate logical conflicts accepted; unrelated full-tenant open rows alone could satisfy the latter generic open requirement. Those readings produce different counts and workflow behavior.

Unanswered owner question: **May a user explicitly acknowledge the current candidate warning set, accept selected logical conflicts with a required reason, and leave other reviewed candidate conflicts open; or must Boka ändå accept all candidate-related conflicts?**

Options: (A) explicitly review all candidate warnings and accept selected logical conflicts with reason, leaving others open (recommended, matching the mixed-conflict journey); (B) Boka ändå accepts every candidate-related logical conflict with reason. Either choice must be recorded before implementation. Both require current actor/facts/identity, nonblank reason and atomic audit; neither authorizes accepting unrelated conflicts or silent acceptance after stale preview.

## Auto Run Result

### Current canonical result — 2026-10-07: done

Status: done
Blocking condition: none
Follow-up review recommended: true
Deferred count: 0
Baseline: `b94be3d33b7161e31ff4e01da79dd36c5474fd73` on `codex/epic14-resume`.

Implemented the responsive booking editor and current toolbar/job/customer entry points, authorized live preview with opaque current-review receipts, complete logical-group selective acceptance, and atomic booking/assignee/conflict/outcome/audit persistence. Preserve standalone and optional connections, current role/tenant authority, exact timestamp precision, stable tenant-scoped create identity, reviewed retry identity and explicit failure/retry. Four immutable forward migrations were applied additively, preserving every prior ledger row; the isolated ledger ends at 99 / `20261007131222`.

All six independent configured review layers completed in one broad Round 1 of 3. Actual capacity refusals were recovered in synchronous batches. The external CLI genuinely completed; its Windows stdout-path transport failure, exact output recovery and already-launched path-corrected retry are preserved as one layer identity. Triage: intent_gap 0, bad_spec 0, patch 10 (high 4, medium 6, low 0), defer 0, reject 4. The original author fixed all ten patches in one batch and refreshed the same review trail. Follow-up score `3 × 6 + 0 = 18`; high patches and score independently require `followup_review_recommended: true`. Narrow fix/regression/trail checks pass and provide no broad Round 2 credit. Root's subsequent Phase 7 follow-up remains required.

Final evidence: required configured-parallel integration native 0, 1456 registered / 1455 passed / 0 failed / 1 existing CI-only recovery Storage physical-loader skip; affected actual API/RLS/regressions 169 passed / 0 failed / 0 skipped; browser native 0, 15 passed / 0 failed / 0 skipped / 0 flaky on matching build `TGBWaTwRYVJLLfZUysZQV`; units native 0, 2032 passed / 0 failed / 1 existing Windows xattr skip; affected component/read checks 25 passed / 0 failed / 0 skipped. Typecheck, lint (0 errors, 13 inherited warnings), build, lockfiles, source/bundle containment and high-level audit pass. Skips are not acceptance evidence. All retained named Story 14.4 obligations execute. The final 48-file source/test/migration fingerprint is `624e4347d9fd7ded2ec26164a7ec5655706ac597c20711b7aeeb395dde440fc8`, refreshed after a cosmetic test EOF-only trim without claiming another execution. One author-written Suggested Review Order validates 20 stops; independent narrow checks confirm the final rationale/evidence and source hashes.

The [author verification matrix](../test-artifacts/story14-4-verification.md), [review provenance/triage](../test-artifacts/story14-4-r1-review-provenance-triage.md) and [absolute changed-file manifest](../test-artifacts/story14-4-finalization-manifest.json) record commands, assertions, path descriptions, diagnostics and limits. No owner questions remain; frozen intent is unchanged.

Residual work: exact empty-DB migration/seed/required integration Epic CI before merge; only calendar empty-slot click/drag transferred to Story 15.1 before applicable calendar exposure/completion; separate Phase 6/7 orchestration and fresh broad follow-up. Historical failures, zero-body Auth setup failure with unknown cause/unidentified partial fixture graph, and serialized Next action transport limits remain recorded. No hosted deployment, reset, old-ledger rewrite, scheduling activation or Phase C feature was performed. Root retains its guarded resources for subsequent authorized phases.

Finalization whitespace evidence: default staged `git diff --check` flags only generated terminal blank lines in the already applied, immutable `supabase/migrations/20261007120235_booking_editor_audited_override.sql:292` and `supabase/migrations/20261007121034_booking_editor_whole_group_validation.sql:125`. Their bytes and application hashes are preserved. The normal scoped check of every other staged path exits 0; command-local `git -c core.whitespace=-blank-at-eof diff --cached --check -- <the two exact files>` exits 0, proving no other whitespace issues. No global/repository Git configuration or hook was changed. Fifteen captured TXT presentation copies had trailing/EOF whitespace normalized; their exact raw originals remain in `C:/Users/Rasmus/AppData/Local/Temp/story14-4-raw-output-09ed8ab97a98474cadcb20c5b2c3ffb5`. This cosmetic evidence cleanup does not change commands, outcomes, source behavior or acceptance.

### Files changed

| File | Change |
| --- | --- |
| `_bmad-output/implementation-artifacts/spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md` | Story implementation, triage and author review trail. |
| `_bmad-output/test-artifacts/story14-4-api-conflicts-final-live.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-api-live.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-booking-browser-diagnostic-f9-setup-evidence.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-booking-browser-diagnostic-f9-setup.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-booking-browser-diagnostic-Sfin-evidence.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-booking-browser-diagnostic-Sfin.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-final-booking-browser-evidence.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-final-booking-browser.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-finalization-manifest.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-foundation-rls-live.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-full-int-output.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-full-int.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-lint-results.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-migration-evidence.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-migration2-evidence.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-migration3-evidence.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-migration4-evidence.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-predecessor-live.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-api-focused-output.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-api-focused.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-api-red-output.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-api-red.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-blind-hunter.md` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-booking-browser-diagnostic-output.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-booking-browser-diagnostic.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-booking-browser-final-evidence.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-booking-browser-final-output.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-booking-browser-final.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-booking-browser-preflight-output.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-booking-browser-preflight.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-build-final-output.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-build-output.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-components-reads-final-output.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-components-reads-final.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-components-reads-output.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-components-reads.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-edge-case-hunter.md` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-external-final.md` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-external-first-transport-recovered.md` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-full-int-output.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-full-int.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-intent-alignment.md` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-lint-results.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-review-provenance-triage.md` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-security.md` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-unit-results.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-verification-gap.md` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-r1-working-tree-evidence.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-replay-rls-live.json` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-run-local.mjs` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-unit-results.txt` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-verification.md` | Story verification, diagnostic, migration or review evidence. |
| `_bmad-output/test-artifacts/story14-4-working-tree-evidence.json` | Story verification, diagnostic, migration or review evidence. |
| `src/app/(app)/customers/[customerId]/page.tsx` | Current authorized booking entry and summary host. |
| `src/app/(app)/jobs/[jobId]/page.tsx` | Current authorized booking entry and summary host. |
| `src/app/(app)/jobs/page.tsx` | Current authorized booking entry and summary host. |
| `src/components/crm/CustomerDetail.tsx` | Responsive booking UI, conflict display or dialog behavior. |
| `src/components/crm/Dialog.tsx` | Responsive booking UI, conflict display or dialog behavior. |
| `src/components/jobs/JobDetailView.tsx` | Responsive booking UI, conflict display or dialog behavior. |
| `src/components/jobs/JobList.tsx` | Responsive booking UI, conflict display or dialog behavior. |
| `src/components/resources/BookingConflictChip.tsx` | Responsive booking UI, conflict display or dialog behavior. |
| `src/components/resources/BookingConflictPanel.tsx` | Responsive booking UI, conflict display or dialog behavior. |
| `src/components/resources/BookingEditor.tsx` | Responsive booking UI, conflict display or dialog behavior. |
| `src/components/resources/BookingEntry.tsx` | Responsive booking UI, conflict display or dialog behavior. |
| `src/features/resources/booking-action-state.ts` | Booking input, read, action or user-facing state contract. |
| `src/features/resources/booking-actions.ts` | Booking input, read, action or user-facing state contract. |
| `src/features/resources/booking-editor-input.ts` | Booking input, read, action or user-facing state contract. |
| `src/features/resources/booking-types.ts` | Booking input, read, action or user-facing state contract. |
| `src/features/resources/bookings-read.ts` | Booking input, read, action or user-facing state contract. |
| `src/server/bookings/candidate-references.ts` | Current-fact preview, review receipt or stable save identity. |
| `src/server/bookings/conflict-facts.ts` | Current-fact preview, review receipt or stable save identity. |
| `src/server/bookings/create-identity.ts` | Current-fact preview, review receipt or stable save identity. |
| `src/server/bookings/editor-preview.ts` | Current-fact preview, review receipt or stable save identity. |
| `src/server/bookings/save-with-conflicts.ts` | Current-fact preview, review receipt or stable save identity. |
| `src/server/commands/bookings/booking-db.ts` | Validated checked booking save and safe command errors. |
| `src/server/commands/bookings/create-booking.ts` | Validated checked booking save and safe command errors. |
| `src/server/commands/bookings/update-booking.ts` | Validated checked booking save and safe command errors. |
| `src/server/commands/bookings/validation.ts` | Validated checked booking save and safe command errors. |
| `src/server/commands/command-errors.ts` | Validated checked booking save and safe command errors. |
| `supabase/migrations/20261007120235_booking_editor_audited_override.sql` | Immutable forward booking editor authority or review correction. |
| `supabase/migrations/20261007121034_booking_editor_whole_group_validation.sql` | Immutable forward booking editor authority or review correction. |
| `supabase/migrations/20261007121724_booking_editor_group_alias_fix.sql` | Immutable forward booking editor authority or review correction. |
| `supabase/migrations/20261007131222_booking_editor_review_round1_fixes.sql` | Immutable forward booking editor authority or review correction. |
| `tests/e2e/booking-editor.e2e.spec.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/e2e/support/booking-editor-atdd.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/integration/commands/booking-conflicts.int.test.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/integration/commands/booking-editor-review-fixes.int.test.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/integration/commands/booking-editor.int.test.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/integration/commands/bookings-replay-authority.int.test.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/integration/commands/bookings.int.test.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/integration/components/booking-editor.test.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/integration/features/booking-read-actions.test.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/integration/rls/bookings.rls.test.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/integration/rls/migration-reset.int.test.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/support/booking-conflict-attestation.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/support/booking-editor-atdd.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/support/booking-editor-production.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/support/bookings-atdd.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/unit/features/resources/booking-editor-input.test.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/unit/scope/booking-editor-scope.test.ts` | Production adapter or executable acceptance/regression assertion. |
| `tests/unit/server/commands/bookings-validation.test.ts` | Production adapter or executable acceptance/regression assertion. |

## Historical Auto Run Result — planning 2026-10-07

Status: ready-for-dev
Blocking condition: none
Warning: oversized
Baseline: `5ce4d6b54ba3fff1f1406aba9c03373a00ba2635` on `codex/epic14-resume`.

The official resumed Build Auto run halted after planning. One canonical renderer invocation loaded the installed workflow; the supplied draft routed to official Step 02. The stale Epic 14 context was freshly regenerated through the official compiler and verified nonempty with the required header and a natural write time newer than the planning sources. A fresh context-free `gpt-6.1-sol` High Step 02 author and synchronous High authority explorer completed current-source investigation, preserved the prepared intent contract byte-identically, mapped all retained acceptance, and passed the final workflow/disk readiness reread after one narrow repair.

Contract D resolves both historical intent gaps. Only the empty-slot click/drag portion of `14.4-E2E-006` remains owned by Story 15.1, mandatory before applicable calendar entry exposure and 15.1 completion. No owner questions remain. The current gate is readiness for development; historical blocked results below are retained as history.

Completion hook: the Build Auto delegate preserved this planning-only terminal result under `docs/process/review-order.md`, without manufacturing a completed implementation trail or claiming product verification. Zero product tests, implementation, ATDD, migrations, resource lifecycle operations, hosted actions, or root bookkeeping changes occurred. Root orchestration owns the subsequent ATDD/development phases and Git/state/PR operations; this delegate performed canonical HALT write-back only. No commit was made in this run.

## Historical Auto Run Result — before Contract D approval

Status: blocked
Blocking condition: intent gap

The canonical Build Auto planning run halted before development. Both unanswered owner decisions and their evidence/options are recorded in Planning Gate. No scope transfer or acceptance policy was selected. Warning: oversized.

Baseline: `246c8402fec01fa5f4e46cfaf5466e78c0b9cd5c` on `codex/epic14-resume`; clean tree and writable Git metadata verified before planning. One canonical renderer invocation loaded the installed workflow; Step 01 loaded the valid Epic 14 cache and completed 14.3 continuity; official Step 02 used a fresh context-free `gpt-6.1-sol` High author and synchronous High authority exploration. Final workflow/spec reread confirmed the blocked intent-gap gate.

Completion hook: planning/blocked result preserved per `docs/process/review-order.md`; no completed implementation trail or validation was manufactured. No product tests, implementation, resource lifecycle operations, hosted actions, or root bookkeeping changes occurred. ATDD and implementation remain deferred until the owner decisions resolve the intent gap.

---
title: 'Story 14.4: Booking Editor with Live Conflict Warnings and Audited Override'
type: 'feature'
created: '2026-10-07'
status: 'blocked'
baseline_revision: '246c8402fec01fa5f4e46cfaf5466e78c0b9cd5c'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - 'docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md'
  - '_bmad-output/implementation-artifacts/epic-14-context.md'
  - '_bmad-output/test-artifacts/test-design-epic-14.md'
  - 'docs/process/review-order.md'
  - 'docs/process/agent-model-routing.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Booking persistence and authoritative conflict detection exist, but users cannot create/edit bookings through the responsive editor or deliberately accept a collision with attributable evidence.

**Approach:** Expose the existing checked detector through a sanitized live preview and use the existing atomic booking transaction for an explicit, reasoned override. Deliver the approved side-sheet/full-screen editor, optional connections, persistent open-conflict count, dirty guard, and connected failure/retry behavior. Preserve the full approved entry-point obligation pending the decisions below.

## Boundaries & Constraints

**Always:** Phase B legacy parity; active `resources` owns this capability and `scheduling` remains pending with empty live surfaces. Follow Contract C and the existing sole detector, current-row verification, shared tenant gate, command-only writes, same-tenant references, exact workflow identity, and atomic booking/assignees/conflicts/acceptance/outcome/audit. `Bookings.Manage` grants admin/project leader writes; Montör reads only its own joined bookings/conflicts and has no editor mutation or tenant-wide preview authority. Resolve actor from current authorized membership and time in SQL. Evaluate Stockholm time/DST through existing helpers; preserve untouched PostgreSQL microseconds. Keep unsent input after transient failure, explicit retry, and success only on confirmed persistence.

**Block If:** The entry-host/acceptance-granularity decisions in Planning Gate remain unresolved; a current conflict or candidate can inherit a different preview's acceptance; implementation needs a pending scheduling view, wider permissions, a second detector, privileged application credentials, or new job/competence facts. Routine engineering choices within the existing boundaries need no owner checkpoint.

**Never:** Ship E15 scheduling projections/nav, recurrence controls/expansion, resolver, time reporting, calendar feed, notifications, file ownership, E16 job depth, overtime mutation, hosted changes, AI/PWA/offline/portal/vendor APIs, or other Phase C scope. Do not copy Lovable code. No acceptance flag on the booking, client-authored detector authority, tenant-wide blanket acceptance, independent post-save acceptance write, or edited applied migration.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Standalone/connected | Valid create/update; optional job/customer/facility/contact | Same editor and transaction; connections can be cleared; compatible same-tenant references | Generic validation/authorization errors retain draft |
| Live warning | Assignee/time/role/connection changes; asynchronous preview responses race | Latest candidate's authoritative rule/person/window/collision timeline replaces obsolete warnings and availability hints | Failed preview is visible; never present unknown as conflict-free |
| Conflict save | Current warning set; explicit acknowledgment and nonblank reason | Accepted logical groups and remaining open groups follow owner-selected granularity; acceptance actor/time/audit commit atomically | Missing acknowledgment returns BOOKING_CONFLICT_UNACKNOWLEDGED; invalid reason/identity is a no-op |
| Stale review | Candidate/facts change after preview, including concurrent booking | Fresh warnings and renewed explicit acknowledgment; no acceptance/write from stale review | PREVIEW_STALE, retain draft; no silent acceptance across server retry |
| Replay/fault | Response lost after commit, altered reason/selection, revoked actor, or fault before audit | Equal authorized retry returns historical outcome once; changed business decision conflicts; faults roll back all rows | COMMAND_CONFLICT/current denial/retryable SERVER_ERROR; exact no-op evidence |
| Existing workflow | Identical accepted key, changed collision, unrelated peer conflicts | Identical evidence survives; changed identity becomes open; chip counts open only | Never infer resolver outcome or accept unrelated conflicts |

</intent-contract>

## Code Map

Inspected at the full baseline above; narrow UI inspection plus a synchronous context-free Sol 6.1 High authority explorer. Existing anchors are source evidence, not future completed review stops.

- `src/features/resources/booking-types.ts:4`/`:20`; `src/server/commands/bookings/validation.ts:7`/`:27`/`:54`/`:68`/`:71` — closed booking input, canonical UUID/assignee ordering and microsecond preservation; add human decision separately from detector facts.
- `src/server/commands/bookings/create-booking.ts:7`, `update-booking.ts:6`, `booking-db.ts:15`; `src/server/commands/envelope.ts:105`/`:106`; `src/server/authz/permission-matrix.ts:35` — existing actual command entries, ownership gate and Bookings.Manage; SQL owns audit.
- `src/server/bookings/conflict-facts.ts:62`/`:68`/`:99`/`:103`/`:113`, `save-with-conflicts.ts:19`/`:23`, `conflict-attestation.ts:13` — checked snapshot/shared preview, full-tenant refresh and bounded retry. Create snapshot proposes a booking UUID; preserve that UUID across reviewed preview and save.
- `src/features/scheduling/conflicts.ts:10`/`:18`/`:23`/`:36`, `time-zone.ts:47` — sole rule engine, complete participant identity and pinned Stockholm conversion. Base v1 plus v2 aggregate associations require a logical-group-to-all-persisted-keys projection; filtering only the candidate's row columns misses aggregate peers.
- `supabase/migrations/20261006144057_booking_conflict_review_integrity_fixes.sql:3`/`:25`/`:36`/`:50`/`:53`/`:58` — current snapshot/finalize HMAC, version/actor/candidate/fact binding and stale paths; immutable evidence.
- `supabase/migrations/20261006122441_booking_conflict_detection_integration.sql:18`/`:127`/`:238`/`:280`/`:331`/`:340` — canonical replay, detector-output whitelist, current authority and private atomic commit/refresh/audit; acceptance extends this transaction without changing derived-output semantics.
- `supabase/migrations/20261006101609_bookings_and_assignees.sql:42`/`:49`/`:56`/`:60`/`:65`/`:110`/`:113`/`:116`; `20261006104143_booking_invariant_corrections.sql:13` — existing workflow columns/constraints and own-person Montör read scope; no replacement table needed.
- `src/features/resources/read.ts:12`, `actions.ts:15`; `src/components/crm/Dialog.tsx:22`, `src/components/quotes/FollowUpSheet.tsx`, `src/components/resources/PersonSchedulePanel.tsx` — cookie-bound read/action, focus trap/return, pending dismissal protection, visible in-dialog error/retry and draft-retention patterns.
- `src/components/jobs/JobDetailView.tsx:42`, `src/components/crm/CustomerDetail.tsx:46`, `src/features/jobs/read.ts:351`, `src/features/crm/read.ts:109`, existing `src/app/(app)/jobs/page.tsx` and detail pages — eligible current toolbar/job/customer hosts, gated independently by booking entitlement; no existing slot/calendar host found.
- `src/app/globals.css`, Phase B UX §§1/4.6/6 — established Tailwind/Geist/Phase A visual posture, side-sheet/full-screen behavior. UX explicitly has no DESIGN.md or new component library; frontend-component skill's foreign project paths do not authorize either.
- `src/scope/manifest.ts:249`/`:263`; Contract C; `_bmad-output/test-artifacts/test-design-epic-14.md:211`–`:223` — active-resource/pending-scheduling and 14.4 acceptance/test authority. Predecessor spec Code Map/Tasks/Design Notes/Spec Change Log/current result and `story14-3-verification.md` establish continuity.

## Tasks & Acceptance

**Execution, after both planning decisions are recorded:**

1. `src/features/resources/booking-types.ts`, new `src/features/resources/booking-editor-input.ts`, `src/server/commands/bookings/validation.ts`, `src/server/commands/command-errors.ts`, `booking-db.ts` — define canonical human decision, selected logical identities/reason, preview freshness and stable errors. Business replay includes the normalized decision/reason; transport proof/expiry/correlation does not alter replay identity. Unit-test every matrix edge in `tests/unit/features/resources/booking-editor-input.test.ts` and existing booking validation tests.
2. `src/server/bookings/conflict-facts.ts`, new `src/server/bookings/editor-preview.ts`, `conflict-attestation.ts`, `save-with-conflicts.ts`, existing create/update commands — preserve sole-engine output; project sanitized logical warnings with all participant keys and availability hints. Bind a server-authenticated editor receipt to actor/tenant/canonical candidate/proposed UUID/versions/exact reviewed identities/freshness. Never expose raw detector proof, fact bundle, secret or durable command history. Suppress obsolete UI results. Fresh save cannot silently renew human acceptance after stale facts.
3. New `supabase/migrations/*_booking_editor_audited_override.sql`, generated with discovered `supabase migration new` — extend checked snapshot/finalize/private commit and replay identity to validate the human decision under the first gate, including direct-RPC callers, before any writes. Persist acceptance reason/current membership/time and audit atomically; retain ACL, current authorization/revocation, unchanged-key evidence, changed-key open refresh and legacy replay. Scope every selected whole logical group to the candidate. Update exact RPC ACL assertions in existing booking RLS/reset suites.
4. New `src/features/resources/bookings-read.ts`, `src/features/resources/booking-actions.ts`, `src/features/resources/booking-action-state.ts` — checked cookie-bound reads, same-tenant picker options, optional connections, read-scoped persistent open count and typed preview/save/retry actions. No client tenant authority; no generalized CRM/job read leak. Revalidate actual host routes after confirmation.
5. New `src/components/resources/BookingEditor.tsx`, `src/components/resources/BookingConflictPanel.tsx`, `src/components/resources/BookingEntry.tsx`, `src/components/resources/BookingConflictChip.tsx`; `src/app/(app)/jobs/page.tsx`, `src/app/(app)/jobs/[jobId]/page.tsx`, `src/app/(app)/customers/[customerId]/page.tsx`, `src/components/jobs/JobDetailView.tsx`, `src/components/crm/CustomerDetail.tsx` — implement fields, multi-person availability hints/work-role filter, latest inline warnings with text and mini-timeline, owner-selected acknowledgment/reason, open chip and edit reopening. Reuse existing dialog behavior for responsive side/full-screen sheet, keyboard focus/dirty Escape/back/close guard and in-sheet failure/retry. Connect current toolbar and pre-connected job/customer entries; the slot-host obligation remains governed by Planning Gate, not silently replaced.
6. `tests/integration/commands/booking-editor.int.test.ts`, existing conflict/replay/RLS suites, new `tests/e2e/booking-editor.e2e.spec.ts`, `tests/unit/scope/booking-editor-scope.test.ts` — implement all 14.4-COMP-001..004, INT-001..005, E2E-001..007 and GOV-001 obligations, including authoritative stale preview, forged/unauthorized selection, aggregate candidate sorting third, exact rollback/replay/audit, inherited microseconds/DST, count reload and 360×640 failure/retry. Actual browser action and persistence readback prove the outer surface; mocks do not prove it.
7. `_bmad-output/implementation-artifacts/spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md` and `_bmad-output/test-artifacts/story14-4-verification.md` — record actual revision/commands/executed-failed-skipped evidence, AC mapping, limits and author-written final review trail after implementation/fixes. Parent owns workflow/progress state. Predev ATDD and postdev automation remain separate later phases; planning creates no tests or completed trail.

**Acceptance Criteria, subject to the explicitly unresolved decisions:**

1. Given an entitled current toolbar/job/customer entry, when opened and edited, then the desktop side sheet or 360×640 full-screen sheet exposes all approved fields, optional standalone connections, availability hints and prefilled context without E15/recurrence controls (COMP-001/002, E2E-001/006). The approved empty-slot click/drag obligation is preserved for decision below.
2. Given changed assignees/time or other detector inputs, when current preview returns, then the visible panel explains every relevant rule/person/window/collision with an accessible mini-timeline, old results cannot overwrite newer warnings, and failures remain visibly unknown (COMP-003/004).
3. Given current warnings, when saving without explicit acknowledgment or with blank/forged/stale/unauthorized acceptance, then the editor shows the corresponding safe error, retains draft and commits no business/outcome/audit rows; authorized nonblank override atomically persists the owner-selected accepted groups with actor/time/reason and one audit (INT-001/002/003).
4. Given accepted/unaccepted/resolved conflicts and a later collision change, when the booking reloads or is updated, then open-only counts persist, identical acceptance survives and changed identity is open; unrelated conflicts are never accepted by this candidate's action (INT-004/005, E2E-002).
5. Given dirty edits, when Escape/back/close is requested, then cancel retains input and deliberate discard closes with predictable focus return; in-flight saves cannot silently dismiss the form (E2E-003/007).
6. Given transient failure or lost response after commit at 360×640, when explicit retry occurs, then suitable unsent state remains, success appears only after server confirmation and durable state contains one booking/assignment/conflict set with one attributable audit (E2E-004/005).
7. Given Montör/unauthorized/cross-tenant/direct RPC requests, when read/preview/save/override is attempted, then existing current role/row authority prevents broader visibility/mutation with generic errors; resources stays active and scheduling pending (GOV-001, retained RLS obligations).

## Spec Change Log

## Review Triage Log

## Design Notes

Human acknowledgment and detector attestation are different authority. Bind the editor review to the proposed create UUID and current logical collision set; the existing create snapshot otherwise regenerates the UUID used by identity. A new server-authenticated preview receipt is distinct from the private detector proof. Derive acceptance groups from the same engine output, covering v1 base and v2 aggregate association keys, and verify them in the same transaction. Preserve full-tenant refresh without allowing the editor to accept unrelated conflicts.

The final architecture supersedes older UX wording that an override stays open: accepted is a workflow record, not a booking flag. The remaining granularity decision affects which candidate conflicts become accepted, not this settled state model or existing permissions.

## Verification

Planning execution: source/doc inspection only; zero product tests executed and no resource/database/browser/hosted action. Reported predecessor evidence is historical: required full1368/1367/0/1 intentional recovery skip; affected145/145/0/0; conflict integration62 unskipped; 14 named units and three timezone runs pass. Contract C's four transferred checks passed before this plan; this does not establish 14.4 coverage.

Later implementation commands: `pnpm typecheck`, `pnpm lint`, `pnpm run test:unit`; with `SUPABASE_TEST_REQUIRED=1`, `pnpm exec vitest run tests/integration/commands/booking-editor.int.test.ts tests/integration/commands/booking-conflicts.int.test.ts tests/integration/commands/bookings-replay-authority.int.test.ts tests/integration/rls/bookings.rls.test.ts`, then full `pnpm run test:int`; `pnpm exec playwright test tests/e2e/booking-editor.e2e.spec.ts` using configured production server; lockfiles/source containment/audit-high/build then bundle containment. Report actual counts/skips, preserve mandatory failures and all existing gates. Exact empty-DB/migrations/seed/required integration Epic CI remains mandatory before merge. Performance fixture size/timing may be recorded; numeric targets remain UNKNOWN, no fabricated NFR pass.

After implementation/fixes, author and validate the final review trail with `node scripts/verify/check-review-order.mjs _bmad-output/implementation-artifacts/spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md`; planning has no final Suggested Review Order heading.

## Planning Gate

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

Status: blocked
Blocking condition: intent gap

The canonical Build Auto planning run halted before development. Both unanswered owner decisions and their evidence/options are recorded in Planning Gate. No scope transfer or acceptance policy was selected. Warning: oversized.

Baseline: `246c8402fec01fa5f4e46cfaf5466e78c0b9cd5c` on `codex/epic14-resume`; clean tree and writable Git metadata verified before planning. One canonical renderer invocation loaded the installed workflow; Step 01 loaded the valid Epic 14 cache and completed 14.3 continuity; official Step 02 used a fresh context-free `gpt-6.1-sol` High author and synchronous High authority exploration. Final workflow/spec reread confirmed the blocked intent-gap gate.

Completion hook: planning/blocked result preserved per `docs/process/review-order.md`; no completed implementation trail or validation was manufactured. No product tests, implementation, resource lifecycle operations, hosted actions, or root bookkeeping changes occurred. ATDD and implementation remain deferred until the owner decisions resolve the intent gap.

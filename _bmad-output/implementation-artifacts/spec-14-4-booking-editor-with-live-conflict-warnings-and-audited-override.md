---
title: 'Story 14.4: Booking Editor with Live Conflict Warnings and Audited Override'
type: 'feature'
created: '2026-10-07'
status: 'ready-for-dev'
baseline_revision: '5ce4d6b54ba3fff1f1406aba9c03373a00ba2635'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - 'docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md'
  - 'docs/decisions/epic-14-story-ownership-contract-d-2026-10-07.md'
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

## Review Triage Log

## Design Notes

Human acknowledgment and detector attestation are different authority. Bind the editor review to the proposed create UUID and current logical collision set; the existing create snapshot otherwise regenerates the UUID used by identity. A new server-authenticated preview receipt is distinct from the private detector proof. Derive acceptance groups from the same engine output, covering v1 base and v2 aggregate association keys, and verify them in the same transaction. Preserve full-tenant refresh without allowing the editor to accept unrelated conflicts.

The final architecture supersedes older UX wording that an override stays open: accepted is a workflow record, not a booking flag. Contract D settles granularity: explicit review and required reason, selected reviewed candidate-related complete logical groups accepted, other reviewed candidate conflicts open; existing permissions and current server authority remain unchanged.

Review and selection are distinct: empty selection after explicit review/nonblank reason may save with warnings still open. Unselection never revokes an already accepted identical identity; retain its evidence. Selection operates on full engine identities, including the candidate when it sorts third or later among aggregate participants, and expands through the authenticated group map to every persisted association. Display/count projection must deduplicate logical associations; it must not turn one logical warning into multiple warnings merely because persistence uses base/association rows.

Equal committed replay checks current authorization before returning its historical outcome; transport expiry/fact drift after commit does not make a lost-response retry a second write. Before a fresh commit, expired/changed review produces `PREVIEW_STALE` and renewed review, not automatic acceptance. Include normalized reviewed/selected identities/reason in business command identity, while signature/validity/correlation remain transport. Reuse checked current facts and signing/Vault patterns; implementation verifies current Supabase docs/CLI before changing their use, not by browsing or touching hosted projects in this planning run.

## Verification

Planning execution: source/doc inspection only; zero product tests executed and no resource/database/browser/hosted action. Reported predecessor evidence is historical: required full1368/1367/0/1 intentional recovery skip; affected145/145/0/0; conflict integration62 unskipped; 14 named units and three timezone runs pass. Contract C's four transferred checks passed before this plan; this does not establish 14.4 coverage.

Later implementation commands: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test:unit`; component `pnpm exec vitest run tests/integration/components/booking-editor.test.ts`; with `SUPABASE_TEST_REQUIRED=1`, `pnpm exec vitest run tests/integration/commands/booking-editor.int.test.ts tests/integration/commands/booking-conflicts.int.test.ts tests/integration/commands/bookings-replay-authority.int.test.ts tests/integration/rls/bookings.rls.test.ts tests/integration/rls/migration-reset.int.test.ts`, then full `pnpm run test:int`; `pnpm exec playwright test tests/e2e/booking-editor.e2e.spec.ts` using configured production server. Run `pnpm run verify:lockfiles`, `pnpm run verify:service-role-containment`, `pnpm audit --audit-level=high`, `pnpm run build`, then `pnpm run verify:bundle-containment`. Report actual counts/skips, preserve mandatory failures and all existing gates. Local verification infrastructure follows `docs/process/local-setup.md` and resource guard; do not use historical native Supabase lifecycle/reset directions as new authorization. Exact empty-DB/migrations/seed/required integration Epic CI remains mandatory before merge. Performance fixture size/timing may be recorded; approved numeric targets remain absent and non-gating, no fabricated NFR pass.

After implementation/fixes, author and validate the final review trail with `node scripts/verify/check-review-order.mjs _bmad-output/implementation-artifacts/spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md`; planning has no final Suggested Review Order heading.

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

### Current canonical result — 2026-10-07: ready-for-dev

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

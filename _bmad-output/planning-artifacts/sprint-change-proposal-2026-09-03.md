# Sprint Change Proposal — Phase B Connected Field Posture / Phase C PWA and Offline Deferral

Date: 2026-09-03

Status: approved, applied, verified, and locally committed on 2026-09-03 — all four increments complete; the local commit was separately authorized after proposal approval; no push or external action authorized

Mode: Incremental

Change classification: Moderate — direct adjustment plus backlog reorganization; PM/Architect and PO/Developer coordination

Decision authority: owner course-correction request dated 2026-09-03

Approval evidence: owner response, “Approve all four increments” (2026-09-03)

Subsequent local-commit authorization: owner response, “Proceed with that” (2026-09-03). This did not authorize a push, PR, merge, deployment, demo mutation, or other external action.

## 1. Issue Summary

### Trigger

Story 10.7, `PWA + Offline Field Capability`, reached the Auto-BMAD planning halt with:

- story specification status: `blocked`;
- blocking condition: `intent gap`;
- implementation started: no;
- unresolved decisions: first concrete offline write surface, device-retention period, photo/attachment size limits, signature/legal scope, authorization/replay behavior, and whether the story was platform-only or authorized to activate field modules.

The owner has decided not to resolve those questions inside Phase B. The complete PWA-installability and genuine offline-operation capability is instead deferred to Phase C.

### Current repository evidence (inspection on 2026-09-03)

- Current branch: `story/10-7-pwa-offline-field-capability`.
- Current HEAD: `158460b` (`chore(story-10-7): plan blocked (intent gap)`). The proposal does not rely on older HEAD values recorded in report history.
- Existing working-tree change to preserve: `_bmad-output/auto-bmad/reports/10-7-pwa-offline-field-capability.md` is modified; no other working-tree change was reported by `git status --short --branch`.
- Auto-BMAD state remains top-level `in-progress`, with `build.status: blocked`, `spec_approved: false`, no PR, no completion time, and zero review passes.
- Sprint status still lists `10-7-pwa-offline-field-capability: backlog`.
- No PWA manifest, service worker, PWA/offline dependency, IndexedDB implementation, local operation queue, or offline runtime module exists in `src`, `public`, `package.json`, or `pnpm-lock.yaml`.
- `src/scope/manifest.ts` has no PWA/offline module or live surface. Story 10.7 would not activate a manifest module.

### Core problem

This is a strategic scope correction prompted by a planning-discovered intent gap, not an implementation failure. Current forward planning documents promote the 2026-07-26 N-3 answer into a Phase B requirement through ADR-B007, NFR53, Story 10.7, the field UX contract, and dependencies on Epics 14–18. Those statements now conflict with the owner's 2026-09-03 decision.

Phase B must instead deliver a responsive, phone-usable, connected web application. Field work remains in scope, but continued operation without connectivity does not.

## 2. Replacement Scope Contract

### Phase B — in scope

- Responsive connected web application, including the existing 360×640 field-workflow viewport floor.
- Connected field workflows in Epics 14–18: scheduling, assigned jobs, time, material, diary, deviations, photos, job chat/risks/reports, and completion.
- Connected Phase B self-inspection/checklist workflows when their owning epic activates.
- Transient-failure protection using component state, `sessionStorage` for suitable draft values, and in-memory photo retention where appropriate.
- Explicit retry and plain connectivity-required/failure messaging.
- A submission is shown as successful only after authoritative server confirmation. Locally retained input is an unsent draft, never a submitted record.
- Existing server command, authorization, RLS, audit, idempotency, file, and entitlement-projection patterns continue to govern connected requests.

### Phase B — explicitly out

- PWA installation or a PWA/web app manifest.
- Service workers or service-worker caching.
- Durable offline device storage, including an offline domain cache.
- Offline reads or writes.
- Local operation queues.
- Synchronization, replay, or offline conflict-resolution states.
- Background, reconnect-driven, app-open, or foreground-triggered offline synchronization.
- Any user promise that work can continue without connectivity.
- Any success message for input that exists only in browser/session/component memory.
- Native mobile application.

### Phase C — deferred package

The Phase C ledger will carry one complete PWA/offline package covering installability, manifest and service-worker behavior, durable device storage, scoped offline reads and writes, operation queues, synchronization/replay/conflict handling, reconnect/background behavior, attachments/photos, security and authorization on replay, device-data lifecycle, and offline-specific testing.

Phase C planning must decide—before implementation—the exact offline surfaces and first write type, retention and purge periods, attachment limits, signature/confirmation legality and payload, authorization behavior after access changes, conflict policy by data type, supported browser/platform behavior, and the test/security evidence required. This course correction preserves only existing architectural seams; it does not design the Phase C solution or create Phase B placeholders.

Native mobile remains a separate hard exclusion; moving PWA/offline to Phase C does not authorize a native app.

## 3. Impact Analysis

### Epic and story impact

| Area | Impact |
| --- | --- |
| Epic 10 | Still completable. Retain story number 10.7, but redefine it as a docs/governance course-correction story. Do not treat the halted offline story as delivered. |
| Story 10.7 | Rename to `Phase B Connected Field Posture and Phase C PWA/Offline Deferral`; replace its offline implementation ACs with governance, traceability, backlog, and verification ACs. |
| Epics 14–18 | Remain in Phase B with their substantive connected workflows intact. Remove Story 10.7 and ADR-B007 as dependencies. Carry ADR-B009/NFR53 connected-resilience rules instead. |
| Epic 14 | Keep person/work-hours, bookings, conflict engine, and phone booking editor. Story 14.4 becomes responsive-connected and has no offline states. |
| Epic 15 | Keep five views, recurrence, conflict resolution, time reporting, calendar feed, and `Min dag`. Story 15.6 keeps the 360×640 floor but requires connectivity. |
| Epic 16 | Keep jobs container, my-jobs, members/Arbetsledare, work orders, project upgrade, and workspace. No offline prerequisite. |
| Epic 17 | Keep material usage/requests, payment plan, economy rollup, and billing seam. Connected writes use normal command guarantees, not an offline queue. |
| Epic 18 | Keep diary, deviations, photos, chat, risks, reports, and completion. Story 18.1 retains component/session/in-memory failure protection and honest retry. |
| Later field-shaped surfaces | Any Phase B checklist/self-inspection or phone capture surface inherits the connected posture; no offline promise is implied by reusing the field layout. |
| Phase C | No Phase C epic is authored now. The ledger records the complete capability and its decision gates for later Phase C planning. |

No existing or future Phase B epic becomes obsolete, no Phase B epic is added, and no epic resequencing is required. Removing Story 10.7 as an implementation prerequisite reduces B1b dependency risk.

### PRD impact

The Phase B product goal remains achievable and is narrowed only on delivery posture. The parity workflows remain; they require connectivity. Sections requiring amendment are the field posture and Journey B1, sizing/critical-path language, NFR31, NFR53, B1b acceptance, N-3 disposition, ADR register, Phase C ledger, open questions, and decision history.

### Architecture impact

ADR-B007 must remain as the historical 2026-07-26 decision but cease to be active authority. A new ADR-B009—after the existing ADR-B008—is the active decision and supersedes ADR-B007 for Phase B. Active architecture must remove the local queue, replay API, offline store, service worker, PWA manifest, offline test axis, `server/sync`, `features/offline`, and offline security-risk obligations. The connected transient-failure section becomes authoritative again, refined by server-confirmed success and connectivity honesty.

### UX impact

The field layouts, touch targets, accessibility floor, role surfaces, and 360×640 requirement remain. The offline contract and synchronization state vocabulary are removed from active Phase B UX. The replacement state model distinguishes unsent draft, submitting, server-confirmed success, connection required, and failed-with-retry. The principal field journey demonstrates that a connectivity failure retains eligible input but does not claim submission.

### Technical/runtime impact

No product implementation exists to roll back. No application code, migration, dependency, lockfile, environment file, deployment configuration, infrastructure, CI workflow, or scope manifest change is required. Post-approval work is documentation, planning-state, and backlog bookkeeping only.

### Scope-manifest conclusion

No edit to `src/scope/manifest.ts` or `src/scope/manifest-schema.ts` is proposed. The manifest governs live module surfaces; PWA/offline was a cross-cutting delivery posture with no manifest module, nav item, tenant table, widget, notification category, public surface, or file owner type. Adding a new manifest entry would invent a surface and violate the manifest's purpose.

## 4. Path Forward Evaluation

| Option | Viability | Effort | Risk | Assessment |
| --- | --- | --- | --- | --- |
| 1. Direct adjustment | Viable; recommended | Medium planning effort, zero product implementation | Low after drift verification | Amend the forward baselines, add ADR-B009, repurpose Story 10.7, remove B1b dependencies, and reconcile state. Preserves momentum and all field value. |
| 2. Rollback | Not viable / unnecessary | Low mechanically, no benefit | Medium history risk | No PWA/offline implementation exists to revert. Rewriting or deleting ADR-B007/N-3 history would damage traceability. |
| 3. Fundamental PRD/MVP review | Viable but disproportionate as the primary path | High | Medium | The product goal, epic set, and field workflows remain valid. Only the connected/offline posture changes, so a full replan would create churn without added clarity. |

**Recommended approach:** Option 1, Direct Adjustment, with an explicit Phase B scope amendment in the PRD. Classification is **Moderate** because it changes a cross-cutting NFR/ADR and reorganizes Story 10.7, but it does not alter the feature epic set or product code.

Expected schedule effect: positive. It removes an unresolved, security-sensitive implementation prerequisite from B1b and introduces no replacement Phase B build work.

## 5. Incremental Detailed Change Proposals

### Increment 1 — Decision spine: PRD, brief, owner records, plans, and project context

#### `_bmad-output/planning-artifacts/prd-phase-b.md`

Sections: frontmatter/§0, §1–§4, §9.1–§9.2, §10, §11, §12, §14–§16.

Current requirement:

> Phase B ships an installable PWA with genuine offline capture; Story 10.7 delivers it and it precedes/accompanies field stories.

Replacement requirement:

> Phase B ships a responsive, phone-usable web application whose field workflows require connectivity. PWA installation, service workers, durable offline storage, offline reads/writes, local queues, synchronization/replay/conflict states, and reconnect/background synchronization are Phase C scope. Native mobile remains excluded.

Exact NFR replacements:

```text
NFR31 (Phase B amendment, restated 2026-09-03): Phase B is a responsive web application, including phone-usable field workflows at the 360×640 viewport floor. Field workflows require connectivity. Phase B does not include PWA installation or a PWA manifest, service workers, durable offline device storage, offline reads or writes, local operation queues, synchronization/replay/offline-conflict states, or background/reconnect-driven offline synchronization. No native app.

NFR53 (restated 2026-09-03; supersedes the 2026-07-26 offline wording): Connected field forms must protect suitable unsent input from transient request failures using component state, sessionStorage, and in-memory photo retention where appropriate; show explicit connection-required, failure, and retry states; and render success only after the server confirms persistence. Retained local input is an unsent draft, not a submitted record, and no continued operation without connectivity is promised.
```

Journey B1 changes from an installed/no-signal/queued-sync scenario to a phone browser scenario. Emil performs the same material, diary, photo, deviation, and time workflows while connected. If connectivity drops during a submit, the form retains eligible draft input, says it has not been submitted, and offers retry; only the later server response produces a success state.

`AC-B1b-3` will explicitly prove a Montör can use the connected flow at 360×640 and that a failed/disconnected submission is not falsely confirmed. A phase-level acceptance criterion will assert the absence of Phase B PWA/offline surfaces and the presence of the complete Phase C ledger entry.

The N-3 row will preserve both dates: 2026-07-26 created ADR-B007; 2026-09-03 supersedes it for Phase B via ADR-B009. The ADR register title and rows will expand through ADR-B009, listing ADR-B007 as historical/superseded, ADR-B008 as current quote authority, and ADR-B009 as current field-posture authority.

The Phase C ledger will add the complete deferred package listed in §2 above. The native-mobile row will no longer say Phase B ships a PWA instead.

#### `_bmad-output/planning-artifacts/product-brief-phase-b.md`

Update the Montör description, N-3 gate/disposition, B1b success criteria, explicit Phase C exclusions, vision, and autonomous-run history. The brief will say responsive connected web at 360×640, with no PWA/offline delivery in Phase B. The original recommendation/answer chronology remains citable.

#### `_bmad-output/planning-artifacts/owner-signoff-questions.md`

Keep the 2026-07-26 N-3 decision text intact as historical evidence, label it superseded, and append a dated 2026-09-03 course-correction record containing the current Phase B/Phase C split. Update the living N-3 summary and consequence entry to point to ADR-B009.

#### `docs/discovery/phase-b-owner-answers-2026-07-26.md`

Do not rewrite or delete the original Swedish N-3 answer. Insert a conspicuous 2026-09-03 supersession note immediately before that section, pointing to the current owner register and ADR-B009.

#### `docs/discovery/phase-b-owner-questions-sv.md`

Preserve the historical question and its 2026-07-26 answer note. Add a dated supersession note to the introductory history block so the line naming Story 10.7 as PWA/offline cannot be mistaken for current scope.

#### `_bmad-output/project-context.md`

Update `last_updated` and add a high-priority ADR-B009 field-posture rule near the phase-transition overrides: connected responsive web, 360×640, no PWA/offline, transient draft protection, and server-confirmed success. State that ADR-B007 is historical and Story 10.7 is a governance correction.

#### `docs/planning/saas-rebuild-phased-plan-2026-06-07.md`

Preserve this baseline's historical Phase A/External Beta framing. Add a dated Phase B amendment, change the Phase B mobile-field row to connected responsive operation, and add the full PWA/offline package to Phase C. Do not revise Phase A history.

#### `docs/planning/post-phase-a-plan-2026-07-08.md`

Add a dated amendment to the owner-direction section, close the old mobile-posture question with the two-step decision history, and extend §6 Phase C with the complete PWA/offline package. Preserve the July shaping record.

#### `_bmad-output/planning-artifacts/next-session-prompt.md`

Replace its now-dangerous instruction to reconcile toward PWA/offline with an overriding current note: the 2026-07-26 answer is superseded, Story 10.7 is governance-only, and B1b field work is connected. Retain unrelated handoff content.

### Increment 2 — Architecture: preserve ADR-B007, activate ADR-B009

#### `_bmad-output/planning-artifacts/architecture-phase-b.md`

1. Bump `amendedAt` to 2026-09-03 and update the executive decision list.
2. Retitle the ADR-B007 header/status as **historical — superseded 2026-09-03 by ADR-B009**. Keep its original trigger, decision, rationale, scope, queue/sync/conflict/storage/test content for decision-history traceability. Add a banner stating none of it authorizes Phase B implementation.
3. Add the next sequential decision:

```text
ADR-B009 — Connected Phase B Field Web; PWA and Offline Deferred to Phase C
Status: DECIDED 2026-09-03
Supersedes: ADR-B007 for active Phase B requirements; ADR-B007 remains historical.

Decision: Phase B field workflows use the responsive web application at the 360×640 floor and require connectivity. Phase B has no PWA manifest/installability, service worker, durable offline store, offline read/write path, local operation queue, offline sync/replay/conflict state, or background/reconnect synchronization. Suitable transient drafts may remain in component state/sessionStorage and photos in memory, with explicit retry and connectivity messaging. Only a server-confirmed write is submitted.

Phase C boundary: preserve the existing command/RLS/audit/file/read-model seams, but defer the complete PWA/offline design and all unresolved device, attachment, signature, authorization, conflict, and platform decisions to Phase C planning.
```

4. Make §15.5 the active connected transient-failure contract and explicitly prohibit treating `sessionStorage` or in-memory blobs as durable offline storage or successful submission.
5. Replace §16.7 offline-sync tests with connected-field resilience tests: 360×640 operation, transient failure retains eligible input, disconnected submit never shows success, retry works after connection returns, and no PWA/offline runtime surface exists.
6. Remove `server/sync`, `features/offline`, `integration/sync`, PWA manifest, and service-worker entries from the active Phase B repo-structure delta.
7. Replace offline device-data/replay risk rows with the production-reachable risk: connectivity loss causing false success or avoidable draft loss.
8. Update §19 U13, §20 NFR53 coverage, AB-A9, §22, §23, and §24 cross-references. AB-A9 becomes the active Phase B basis again as refined by ADR-B009.
9. Add a dated course-correction ledger after the 2026-07-26 reconciliation ledger, preserving the full decision chain N-3 → ADR-B007 → planning halt → ADR-B009.

### Increment 3 — UX and epics: connected field workflows, no offline dependency

#### `_bmad-output/planning-artifacts/ux-design-specification-phase-b.md`

Replace the active offline posture in §0, §1, §4.8/§4.8A, §7, §10–§15.

Current state vocabulary:

```text
SavedLocally | WaitingForSync | Syncing | Synced | Conflict | Failed
```

Replacement connected-form vocabulary:

```text
Editing/unsent draft | Submitting | Submitted (server-confirmed only) |
Connection required | Submission failed — retry | Uploading/upload failed
```

These are UX states, not a local queue or replay state machine. `sessionStorage` and in-memory photos may protect a draft from a transient request failure, but the UI must label it unsent and must not promise survival across device/browser lifecycle boundaries.

Keep the phone layout, bottom action bar, camera-first capture, ≥48px field controls, contrast/accessibility rules, and 360×640 floor. Change the capability table so all Phase B field operations require connectivity. Update Flow 1 to demonstrate honest failure and retry. Preserve UXB-A11's chronology: original connected assumption → superseded by ADR-B007 in July → reinstated and refined by ADR-B009 in September.

#### `_bmad-output/planning-artifacts/epics-phase-b.md`

Update frontmatter/governance references, overview dependencies, Cross-Epic Rule 3, NFR31/NFR53, architecture/UX requirement summaries, validation summary, and sprint-planning open items.

Replace Story 10.7:

```text
OLD: Story 10.7 — PWA + Offline Field Capability

NEW: Story 10.7 — Phase B Connected Field Posture and Phase C PWA/Offline Deferral
Type: docs/governance course correction; no product code, migration, dependency,
lockfile, environment, or manifest change.
```

New Story 10.7 acceptance criteria:

1. ADR-B009 records the current decision and ADR-B007 remains intact and clearly historical.
2. All forward Phase B baselines use the connected 360×640 posture and contain none of the prohibited PWA/offline requirements.
3. E14–E18 retain their workflows and have no Story 10.7/offline implementation dependency.
4. Transient draft retention, explicit retry/connectivity messaging, and server-confirmed success are consistent across PRD/architecture/UX/epics.
5. The Phase C ledger contains the complete PWA/offline package and unresolved decision gates without speculative implementation design.
6. Manifest inspection records “no change required”; no live surface is invented.
7. The blocked spec/state/report remain traceable as a halted, superseded planning run and never claim offline delivery.
8. Repository-wide verification classifies every remaining PWA/offline reference as either historical evidence or Phase C deferral.

Specific B1b edits:

- E14 primary NFR becomes connected NFR53; remove Story 10.7 dependency.
- Story 14.4 keeps its phone editor and dirty-state guard but drops installed-PWA/offline states.
- E15 keeps all six stories; Story 15.6 keeps `Min dag`, pull-to-refresh, and 360×640, but data and submissions require connectivity.
- E16 keeps all five stories without an offline prerequisite.
- E17 keeps all four stories; material writes are normal connected writes.
- E18 keeps all four stories; Story 18.1 retains session/component/in-memory protection and explicit retry, and no locally held value is “submitted”.
- Remove the wave preamble, gate banners, validation summary, and open-item language that make Story 10.7/ADR-B007 prerequisites.

#### `_bmad-output/implementation-artifacts/epic-10-context.md`

Regenerate/amend the context so Story 10.7 is the governance correction, remove the PWA/offline technical constraint and cross-story dependency, and carry ADR-B009 plus the no-product-code boundary.

### Increment 4 — Story/Auto-BMAD/sprint disposition and verification

#### Historical Story 10.7 artifacts

- Keep `_bmad-output/implementation-artifacts/spec-10-7-pwa-offline-field-capability.md` at `status: blocked`; add a prominent disposition note. Do not convert the blocked implementation spec to `done`.
- Preserve `_bmad-output/implementation-artifacts/bmad-build-auto-result-10-7-pwa-offline-field-capability.md` as historical evidence.
- Preserve and append—never overwrite—the currently modified `_bmad-output/auto-bmad/reports/10-7-pwa-offline-field-capability.md`, stating that planning halted, implementation never started, the run was superseded by the approved course correction, and no deferred functionality was delivered.
- Move the exact Auto-BMAD state file to `_bmad-output/auto-bmad/state/superseded/10-7-pwa-offline-field-capability.yaml`. Its internal `in-progress`/`blocked` values remain unchanged as truthful halt evidence, while the active-state scanner no longer resumes an obsolete implementation story. This is necessary because the Auto-BMAD top-level state schema supports only `in-progress|done`; marking it `done` would be false.

#### Repurposed Story 10.7 and sprint status

- Create `_bmad-output/implementation-artifacts/10-7-phase-b-connected-field-posture-and-phase-c-pwa-offline-deferral.md` as the docs/governance story record.
- After all approved document edits and verification pass, set that new story record and its sprint key to `done`.
- Replace `10-7-pwa-offline-field-capability: backlog` with `10-7-phase-b-connected-field-posture-and-phase-c-pwa-offline-deferral: done`.
- Update the comments to explain the two distinct outcomes: the old offline run was halted/superseded; the new governance story was completed.
- Set `epic-10: done` only after verification, because Stories 10.1–10.9 and the Epic 10 retrospective will then all be done. This aligns sprint status with the already-done Epic 10 Auto-BMAD anchor without claiming PWA/offline delivery.

#### Proposal status

After explicit approval, change this proposal's status to `approved`, record approval date/conditions, then apply the increments in order.

## 6. Implementation Sequence and Handoff

1. **Owner approval gate:** approve, revise, or reject this complete proposal. No target artifact changes before approval.
2. **PM/Architect responsibility:** update PRD/brief/plans/owner history/project context; add ADR-B009 while preserving ADR-B007.
3. **UX responsibility:** replace the offline contract with the connected resilience contract and update Flow 1/accessibility/platform language.
4. **PO/Developer responsibility:** repurpose Story 10.7, remove E14–E18 dependencies, preserve/retire the halted Auto-BMAD run, and reconcile sprint status.
5. **QA/documentation responsibility:** run the verification matrix below and record evidence in the new governance story and proposal.
6. **Final handoff:** report changed files, verification results, remaining historical/Phase C term matches, and confirm no runtime/config change.

The current Codex task may execute all five post-approval responsibilities. No subagent, commit, push, PR, merge, deployment, demo mutation, or external coordination is authorized by this proposal.

## 7. Verification Matrix

After the approved edits:

1. Run repository searches for:
   - `ADR-B007`
   - `ADR-B009`
   - `NFR53`
   - `Story 10.7` and both old/new story keys
   - `PWA`
   - `offline`
   - `service worker` / `service-worker`
   - `SavedLocally`, `WaitingForSync`, `Syncing`, `Synced`
   - `360×640`
   - `N-3`
2. Classify every remaining PWA/offline match as:
   - historical evidence explicitly pointing to ADR-B009/course correction; or
   - the Phase C deferred package/open decision set.
3. Confirm no forward/current Phase B requirement promises installability or offline operation.
4. Confirm ADR-B007 is preserved and explicitly superseded by ADR-B009.
5. Confirm E14–E18 remain in Phase B with unchanged substantive feature scope and no offline/Story-10.7 implementation dependency.
6. Confirm PRD §14 and the baseline/post-Phase-A plans contain the complete Phase C PWA/offline package.
7. Confirm `src/scope/manifest.ts` is byte-unchanged and still has no PWA/offline module.
8. Confirm no PWA manifest, service worker, PWA/offline dependency, offline store, or operation-queue runtime surface exists.
9. Confirm the old spec/state/report say halted/superseded/no implementation and the repurposed governance story alone is `done`.
10. Confirm sprint status and active Auto-BMAD state scanning no longer select the obsolete offline story.
11. Run `git diff --check` and inspect `git status --short --branch`; verify the pre-existing modified report content was preserved and all changes are documentation/planning only.

No application test suite is required by the zero-runtime-diff course correction. If a repository doc validator covers any edited artifact, run its focused test; do not start Docker, Supabase, WSL, or another persistent service.

## 8. Success Criteria

- No current Phase B source of truth requires or promises PWA installation or offline operation.
- Phase B field workflows remain complete, connected, responsive, and usable at 360×640.
- Transient failures do not produce false success; suitable input remains available for explicit retry where the established browser-memory patterns support it.
- ADR-B007 and the 2026-07-26 N-3 answer remain intact as historical evidence and point clearly to ADR-B009.
- Phase C contains the whole deferred PWA/offline capability and its unresolved gates.
- E14–E18 remain in Phase B and no longer depend on Story 10.7 for an offline platform.
- The scope manifest is unchanged.
- The halted Auto-BMAD run remains truthful; only the replacement docs/governance Story 10.7 is completed.
- No product code, migration, dependency, lockfile, `.env`, infrastructure, or deployment file changes.

## 9. Checklist Status

### Section 1 — Trigger and context

- [x] 1.1 Triggering Story 10.7 identified.
- [x] 1.2 Strategic scope correction / planning intent gap defined.
- [x] 1.3 Repository, state, report, spec, sprint, and no-implementation evidence collected.

### Section 2 — Epic impact

- [x] 2.1 Epic 10 remains completable through Story 10.7 repurposing.
- [x] 2.2 No epic addition/removal; existing scope text and dependencies change.
- [x] 2.3 E14–E18 and later field-shaped surfaces reviewed.
- [x] 2.4 No Phase B epic invalidated; Phase C ledger receives the package.
- [x] 2.5 No resequencing; a blocking prerequisite is removed.

### Section 3 — Artifact conflicts

- [x] 3.1 PRD conflicts and exact NFR/AC changes identified.
- [x] 3.2 Architecture ADR, storage/sync, tests, layout, security, and risk changes identified.
- [x] 3.3 UX platform, state, flow, accessibility, and field-layout impacts identified.
- [x] 3.4 Brief/context/plans/owner records/story/sprint/Auto-BMAD/manifest/runtime searched.

### Section 4 — Path forward

- [x] 4.1 Direct Adjustment viable — Medium effort / Low residual risk.
- [x] 4.2 Rollback unnecessary — no implementation exists; history must remain.
- [x] 4.3 Fundamental MVP replan disproportionate; explicit PRD scope amendment is sufficient.
- [x] 4.4 Option 1 selected with rationale.

### Section 5 — Proposal components

- [x] 5.1 Issue summary complete.
- [x] 5.2 Epic/artifact impacts complete.
- [x] 5.3 Recommended path and alternatives complete.
- [x] 5.4 Phase B/Phase C scope and implementation sequence complete.
- [x] 5.5 Role-based handoff defined.

### Section 6 — Final review and handoff

- [x] 6.1 Applicable checklist items reviewed.
- [x] 6.2 Proposal cross-checked against repository evidence.
- [x] 6.3 Explicit owner approval received on 2026-09-03: “Approve all four increments.”
- [x] 6.4 Sprint status reconciled: only the replacement documentation/governance Story 10.7 is `done`; the blocked implementation run remains historical and undelivered.
- [x] 6.5 Post-edit verification completed and evidence recorded below.

## 10. Approval and Execution Result

The owner approved the complete proposal on 2026-09-03 with the response “Approve all four increments.” All four increments were applied within the authorized documentation/planning/bookkeeping scope. The proposal itself did not authorize a commit. The owner subsequently responded “Proceed with that,” separately authorizing the local course-correction commit. No product code, dependency, migration, environment, push, PR, merge, deployment, demo, or external action was performed.

## 11. Verification Results

- **Artifact alignment:** 106 final assertions passed across the PRD, brief, architecture, UX specification, epics, plans, owner records, project context, Story 10.7 artifacts, sprint tracker, and Auto-BMAD state/report disposition.
- **Required term search:** repository searches for `ADR-B007`, `NFR53`, `Story 10.7`, `PWA`, `offline`, `offline-capable`, `offline sync`, and `N-3` were reviewed. Current affected-artifact matches describe the connected Phase B exclusion or Phase C package; historical matches point to ADR-B009/course correction. Unrelated matches concern local/offline test execution or registry verification, not product capability.
- **E14–E18:** scheduling, time reporting, jobs, materials, diary entries, deviations, photos, checklists/egenkontroller, and completion remain in Phase B as connected workflows, with no Story 10.7 technical prerequisite.
- **Phase C:** the complete PWA/installability and genuine offline-operation package plus all deferred policy questions is present; native mobile remains separately out of scope.
- **Manifest:** no manifest module was invented. SHA-256 remained `2C512A73B0DD2A151C50B7BEF44A5EDEDBFE6C0ECD9AA514834EEFB4EF4B0B3F` for `src/scope/manifest.ts` and `0015923A28D87F5E4D268C2652C3042AE7D381B47B5E633640C301581403BA51` for `src/scope/manifest-schema.ts`.
- **Auto-BMAD:** the exact 4,419-byte halted state is preserved at `state/superseded/10-7-pwa-offline-field-capability.yaml` with SHA-256 `7D92A2923A5B1F157AF03D444513EC1D82709819186CF66833B31671C177424C`; the active scanner reports zero in-flight stories and does not select the obsolete key.
- **Runtime and diff scope:** runtime scans found none of the deferred PWA/offline surfaces, changed-file inspection found only documentation/planning/bookkeeping artifacts, and `git diff --check` passed.

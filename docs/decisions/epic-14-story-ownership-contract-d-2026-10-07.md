# Epic 14 Story Ownership — Contract D

## Recorded owner approval — 2026-10-07

The owner explicitly approved both recommendations from Story 14.4's blocked intent-gap plan: transfer only the empty-slot click/drag entry obligation to Epic 15, and use explicit review with selected logical conflict acceptance. This decision resolves those two questions. It preserves [Contract C](epic-14-story-ownership-contract-c-2026-10-06.md), its Story 14.2/14.3 ownership and all transferred detector prerequisites, original story order, mandatory verification and independent review. It authorizes no implementation by this preparation task.

## Entry ownership and cross-epic acceptance ledger

| Original obligation | Retained in Story 14.4 | Receiving owner and mandatory gate |
| --- | --- | --- |
| Story 14.4 entry-point acceptance / 14.4-E2E-006 | Current toolbar and pre-connected job/customer entry points open the responsive editor with the appropriate context. The editor supports standalone booking and a reusable person/time-prefill seam. All other 14.4 acceptance remains. | **Only empty-slot click/drag transfers to Story 15.1: The Five Scheduling Views**, whose approved `Schema` time grid and `Resurser` person-row timeline supply the actual calendar hosts. The transferred portion retains its source identity `14.4-E2E-006 (empty-slot click/drag portion)` for traceability. |

**Transferred acceptance:** Given an authorized user on Story 15.1's real `Schema` or `Resurser` calendar host, when the user clicks an empty slot or drags an empty interval, then the same booking editor opens with the selected time bounds and person context where the host supplies a person. Verify both actual click and actual drag at the outer browser surface and preserve Story 15.1's keyboard/dialog equivalents. The `Resurser` case must prove selected person/start/end prefill; the `Schema` case must prove its selected interval and any supplied person context. Both host paths must use current server authority and the existing editor/detector boundaries.

This retained obligation is **mandatory before the applicable calendar entry points are exposed and before Story 15.1 completion**. A component/prefill-seam test in 14.4 is not execution credit for real calendar click/drag. Story 14.4 may complete its retained entry portion while this explicitly transferred portion remains pending under Story 15.1; it must disclose that limit. Neither Epic 14 nor Epic 15 may claim the transferred portion executed before that evidence exists. This is an ownership transfer, not a waiver or removal.

`resources` remains active and owns Epic 14 capability/schema. `scheduling` remains pending with empty live surfaces until its separately approved Epic 15 activation. Story 14.4 adds no scheduling nav/views or slot host. Contract D transfers no other editor, detector, override, resolver, recurrence, notification, feed, time-report or Phase C obligation.

## Conflicted save and selective acceptance

Saving with current candidate conflicts requires explicit review/acknowledgment of the current warning set and a required nonblank reason. The user may select which reviewed **candidate-related logical conflicts** become `accepted`; other reviewed candidate conflicts remain `open`. Review is the permission to deliberately save with warnings, while selection is the decision to accept particular conflicts. Review alone never marks every warning accepted. Open-only counts exclude accepted/resolved records.

Acceptance excludes unrelated tenant conflicts. Each selected logical group covers its complete current identity and persisted associations, including aggregate base/association rows; selecting an association must not leave a partial logical acceptance. Current server authorization, current facts and exact reviewed identity govern the decision. Acceptance actor is the current authorized membership; acceptance time comes from SQL. Booking, assignees, derived conflicts, selected acceptance, durable command outcome and audit commit atomically. No client detection authority, booking acceptance flag, blanket acceptance, later independent acceptance write, or silent acceptance across stale preview is authorized. Preserve unchanged-key evidence and reopen changed collision identities. Keep the reviewed create UUID stable as an engineering invariant.

## Planning recovery

Recover the Story 14.4 spec in place as `status: draft`, amend its intent contract only for these owner-selected policies, and preserve the original blocked result as history. Draft means preparation for re-planning, not ready for development, completed acceptance or new verification. The installed Build Auto Step 1 routes a supplied blocked spec to HALT and a supplied draft to Step 2, which preserves the draft intent contract verbatim.

Root orchestration commits the preparation and confirms a clean tree before one official replan with the original Story 14.4 intent and `Halt after planning.` Do not run the renderer, official planning, ATDD or implementation during this preparation. Changed planning sources invalidate the old Epic 14 context cache; regenerate through the official context workflow as required without faking timestamps or cache validity.

## References

- [Epic 14 and receiving Story 15.1 authority](../../_bmad-output/planning-artifacts/epics-phase-b.md)
- [Phase B UX](../../_bmad-output/planning-artifacts/ux-design-specification-phase-b.md)
- [Architecture §10.2](../../_bmad-output/planning-artifacts/architecture-phase-b.md)
- [Epic 14 test design and split 14.4-E2E-006](../../_bmad-output/test-artifacts/test-design-epic-14.md)
- [Recovered Story 14.4 draft and historical blocker](../../_bmad-output/implementation-artifacts/spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md)

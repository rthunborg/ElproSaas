1. **Defensible readings of the intent**
   - **Entry ownership:** Story 14.4 delivers create/edit through the current toolbar and connected job/customer hosts, plus a reusable person/time prefill seam. Contract D explicitly assigns actual calendar click/drag to Story 15.1.
   - **Conflict decision:** Reviewing all current candidate warnings grants permission to save with a required reason. Selecting logical groups separately determines which conflicts become accepted; selection may be empty.
   - **Preview authority:** The existing detector owns candidate-related warnings. Candidate or relevant fact changes invalidate review; full-tenant persistence refresh does not authorize acceptance of unrelated conflicts.
   - **Retry identity:** An equal authorized retry returns the historical outcome. Changing the reason or selection changes the business decision and conflicts. Fresh stale attempts require renewed review.
   - **Workflow continuity:** Identical accepted identities preserve their evidence; changed collision identities become open. “Other reviewed conflicts remain open” therefore applies without reopening identical previously accepted evidence.
   - **Display detail:** “Collision timeline” defensibly means an explanatory warning window with participant labels. A richer diagram showing each participant’s individual interval is also conceivable, but the supplied intent does not expressly require that representation.

2. **Reading implemented by the diff**

   The diff implements the retained Contract D reading above. `/jobs`, job detail, and customer detail use the same editor. The editor renders a desktop sheet/mobile fullscreen dialog, optional connections, current warnings, explicit acknowledgment, reason, group selection, dirty dismissal guards, and explicit retries.

   The server uses the existing detector with a separate encrypted review receipt. Save verifies candidate/fact identity and the complete current logical group map. SQL expands selected groups to their complete v1/v2 associations, resolves acceptance membership/time, and commits booking, assignments, conflicts, acceptance, outcome, and audit together.

   The unresolved-save state retains the exact attempted command and decision, blocks edits/dismissal, and retries that input. The tests cover standalone reopening, cleared connections, endpoint precision, selected/unselected/unrelated groups, signed partial-group rejection, stale no-ops, concurrent editors, rollback, semantic replay, and current authority.

3. **Specific differences between intended surfaces and exercised evidence**

   - **Calendar entries:** Actual empty-slot click/drag remains absent and untested here, as expressly transferred. Prefill receives component rendering evidence; it does not receive calendar interaction or persistence credit.
   - **Preview races:** The browser exercises immediate invalidation, obsolete-response rejection, and the latest queued response. Reverse delivery is exercised through the production state function in component tests because actual Next actions serialize requests.
   - **Stale save UI:** Real command/SQL tests exercise `PREVIEW_STALE`, exact no-op behavior, and refreshed previews. Source clears acknowledgment/selection/reason and requests fresh warnings. The browser suite does not contain a dedicated stale-save-response journey followed by renewed acknowledgment and save.
   - **Timeline representation:** The implemented timeline displays the warning’s start/end window, person/rule, and participant booking labels. The test adapter assigns that warning window to each collision; it does not exercise separate participant interval positions.
   - **Authority evidence:** Read/action transport tests use mocks and components use SSR/state-function assertions. Actual command/RLS tests supply the separate authority evidence.
   - **Execution boundary:** Captured final reports record 15 browser passes, 25 component/read passes, and 1455 integration passes with one existing unrelated skip. These are recorded execution artifacts; I ran no product tests. Empty-database Epic CI and hosted signing/provisioning remain outside that evidence.

**No concrete divergence from the retained behavioral intent was identified.** The differences above describe representation and verification boundaries, rather than establishing a changed product requirement.

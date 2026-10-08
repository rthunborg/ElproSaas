# Current registration follow-up (2026-10-08)

The coordinator applied the reviewed three-row patch on `codex/documents-backlog-registration`, based on integrated main `8a7debbee83c9a4f6eb8ec4496ba2f7ad7db4b4b`. The registration PR is not merged. All three actual canonical lookups now resolve the authorized keys and titles as backlog. E20 has three stories; 20.1 is first=true, last=false, stories_after=2. Epic14 and 14.1–14.4 plus 19.1 remain done. Actual evidence is recorded separately in registration.json under actual_registration_followup.

A minimal epics title/key amendment supplies parser-readable headings for the existing three slots; existing scope and checkpoint gates remain. The spec hash is unchanged. Registration resolves the local lookup gate only; status remains blocked and approval, implementation authorization and executable-plan flags remain false. Registration PR merge, oracle disposition, checked-contract review, checkpoint closure, exact ownership and fresh integrated-base validation remain open. The patch and original failed/prospective checks below are historical evidence and must not be applied twice.

---

# Historical preparation record (before coordinator application)

# E20 prospective canonical registration

This isolated package proposes registration of all three owner-authorized E20 stories as backlog. It does not apply the patch, promote readiness, authorize implementation or initialize claims. The actual canonical lookup still fails because the actual sprint contains no E20 story rows.

The patch inserts the three rows immediately after epic-20 and before epic-20-retrospective. All surrounding backlog/checkpoint comments and other epics remain unchanged. Existing wave comments describe the original baseline; registration alone does not close their admission gates. The coordinator must serialize the aggregate edit with the ongoing Epic14 owner.

## Mapping

- 20.1: Documents activation, source-authorized aggregation and minimal destination — `20-1-documents-activation-and-source-authorized-aggregation` (backlog).
- 20.2: Search, filters, preview and archive/restore — `20-2-search-filters-preview-and-archive-restore` (backlog).
- 20.3: Entity-panel links and contextual navigation — `20-3-entity-panel-links-and-contextual-navigation` (backlog).

## Preconditions and reconciliation

Use registration.json's expected_base_git_blob_sha1_lf for the LF-normalized Git blob and expected_base_git_blob_sha1_bytes / expected_base_sha256_bytes for exact working-file bytes. Verify the current source before applying. A hash mismatch is a reconciliation stop: inspect the current sprint and Epic14 changes, preserve them, regenerate this insertion against the current base and rerun the temporary-copy checks. Never overwrite the whole file with the tested copy. If any E20 rows already exist, reconcile their exact IDs, keys, order and statuses; do not insert duplicates or regress an existing status. A base match is still subject to coordinator ownership serialization.

## Evidence and limits

The unified patch was reconstructed and checked against the prospective content in memory; the prospective sprint was written only in a disposable temporary directory. story_plan.py --resolve 20.1 on that copy reports is_last_in_epic=false and stories_after_in_epic=2. Its --epic 20 result reports epic_story_count=3. Canonical sprint bytes remained unchanged. Results in registration.json explicitly distinguish actual lookup failure from prospective success. This was a bounded artifact check, not product or authorization testing.

## Later readiness checks

After serialized registration, rerun story_plan.py --resolve 20.1 --sprint-status <canonical sprint> --planning-dir <planning artifacts> and --epic 20 against the canonical file: require exact key, backlog status, count 3 and is_last_in_epic=false. Reconcile the owner-authorized titles against canonical planning; temporary evidence did not supply --planning-dir and therefore returned null titles. Run --find-spec --impl-dir <implementation artifacts> --story-key 20-1-documents-activation-and-source-authorized-aggregation and --spec <resolved path>; require unique identity, unchanged blocked status and implementation_authorized=false until the separate admission gates close.

Before any ready promotion, require recorded live-oracle disposition, independent High review of the final spec hash and source-authority optionA, early Documents checkpoint closure, exact schema/wrapper ownership, dependency/base reconciliation with integrated Epic14/19.1 APIs, and shared reservation reconciliation. Then prepare a reviewed version-1 parallel plan with explicit write paths, semantic contracts, required checks and final epic checks; run parallel_run.py plan read-only. Only the coordinator may admit an approved ready spec or initialize a run/claims. Registration is not any of those approvals.

## Targeted review delta

The existing spec changed only canonical_story_key from null to the owner-authorized key. No new story_key field was invented. Status remains blocked, implementation_authorized remains false, and the source-authority optionA contract and prior review wording are untouched. The preparation disposition still correctly says canonical registration is absent.

Final LF-normalized spec SHA256: `7e475bfd42adc41e61fc4ccba5f399a7816025fdf37ad89d12d299c1aba489ab`.

Expected base LF Git blob SHA1: `68d4a3d72f2d3782af36ee5d90e3193fcf4b1ed5`.

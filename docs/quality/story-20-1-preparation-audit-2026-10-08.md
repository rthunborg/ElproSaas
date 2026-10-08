# Story 20.1 preparation authorization and admission audit

Date: 2026-10-08. Reviewer: `/root/documents_audit`, actor `01a11af1-1be3-7110-9fea-57b6b85f03fe`, explicitly routed `gpt-6.1-sol` High for permissions, RLS, signing capabilities and transactional audit authority. Independent of author `/root/documents_spec`. Accepted integrated base: `ab1ca0445b58f5f496be0d938906c744b6dff87e`; branch: `codex/story20-1-documents-preparation`.

## Exact reviewed artifacts and disposition

- Specification: `_bmad-output/implementation-artifacts/spec-20-1-documents-activation-and-source-authorized-aggregation.md`.
- Final LF-normalized SHA256, independently recomputed: `5b5d437acc08e3c4005f615b859fca1a7be55806379941d9bebd2e4dfc699964`.
- Companions: `_bmad-output/auto-bmad/preparation/story-20-1/source-authorization-design.md`, `admission.json`, `orchestration.json`, `preflight.json` and `canonical-resolution.json`.
- Initial full preparation audit covered LF revision `beae28b39b52901ac03fca6b02db9d59b9b0e10e1e8f2dc9d28cc08b36df3ced`. Follow-up was limited to the consolidated template/source-map corrections and their authorization/scope consequences. It was not another broad implementation review.

**Outcome: independent preparation review completed; implementation admission remains BLOCKED.** No additional material authorization/design defect was found in the final proposed contract. This is not approval of a canonical ready-for-dev specification, a selected access policy, a parallel assignment, or an implemented product. No production defect was introduced by this documentation-only preparation.

The owner authorized preparation. The integrated sequencing amendment permits only the bounded early E20/FR109 preparation path. It does not certify the full B1b exit, E19 completion, other B2 admission or Phase C exceptions. The final draft and admission retain `status: blocked`, null canonical identity and boundary choice, and `implementation_authorized: false`.

## Source and authority findings

The active manifest enrollment is exactly seven owners. The final inventory covers their actual tables, existing capabilities and source-specific live-parent rules:

| Owner | Existing source authority | Proposed Documents eligibility |
| --- | --- | --- |
| customer | `customers`, `Customers.View`, CRM RLS | Visible live customer; display name only. |
| facility | `facilities`, `Customers.View`, CRM RLS | Visible live facility and customer parent. |
| contact | `contacts`, `Customers.View`, CRM RLS | Visible live contact/customer and optional referenced facility. |
| calculation | `calculations`, `Calculations.View`, calculation RLS | Live calculation; customer-derived label independently authorized. |
| quote_version | `quote_versions` and `quotes`, `Quotes.View`, quote RLS | Live version/quote; both `quote_attachment_snapshot` and `quote_pdf` producers enrolled. |
| quote_acceptance | `quote_acceptances`, version and quote, `Quotes.View` plus acceptance RLS | Live source chain; no accepted-value snapshot in DTO. Sales reference-only RPC is not evidence authority. |
| job | `jobs`, `Jobs.ViewAll`, job RLS | Live job; independently authorized optional customer label. No unmerged assignment/scheduling contract. |

Evidence: `src/scope/manifest.ts`; `src/server/authz/permission-matrix.ts`; `src/features/{crm,calculations,quotes,jobs}/read.ts`; generic file owner helpers; source migrations and the effective `20260907171252_role_aware_phase_a_policy_evolution.sql`. The draft correctly separates list enrollment from generic command `ACTIVE_OWNER_TYPES`, which excludes domain-created `quote_version` links. The corrected navigation path is `src/components/app-shell/nav-items.ts`; the single existing route is `/files`.

Documents/View and Files/View remain conjunctive, admin/Projektledare only. Source authorization is additional. Each result is an exact authorized `file_link`, with hidden contexts absent from rows, labels, facets, counts and cursors. The final contract requires stable complete bounded traversal beyond the PostgREST cap; source filtering cannot declare a capped or hidden prefix complete.

The final draft requires current source/link/file checks both before signing and during checked audit finalization, including selection-bound refresh and no URL on finalization failure. It does not mistake an unchanged file-ID-only signer for that stronger contract. A file's different visible link cannot replace authority for the selected disappeared context.

## Concrete access boundary and required decision

Current generic file signing and its prepare/finalize SQL check tenant roles, file/object/lifecycle and audit proof, not selected source authority. Effective file/link SELECT and Storage SELECT remain tenant-role scoped; Storage additionally checks private bucket and tenant-prefix. This is an existing capability, not a newly introduced E20 defect.

There is a reachable example: a tenant administrator archives a customer through `customer.archive` / `archive_customer_with_audit`; the checked RPC updates that customer and does not archive its file/link. An admin or Projektledare with the known file ID can still call the existing `previewEntityFileAction` / `createSignedFileAccess`. Direct authenticated Storage access remains separately authorized. Therefore a source-filtered Documents list alone cannot prove global source-sensitive byte denial.

The final package accurately exposes two reviewable alternatives without selecting either:

- **A:** selected-link Documents read/open/refresh authority, including checked finalization, while retaining the wider generic/direct Storage baseline. Explicit owner/checkpoint acceptance of that narrower release guarantee is required. Additive checked wrappers can still require security migration and shared claims.
- **B:** extend current eligible-source enforcement to ordinary metadata, generic signing and direct Storage access, with at least one authorized live link for file capability and the exact selected link for Documents context. This requires an owner/ADR-backed shared policy decision, exact exceptions for upload reservations, the narrow Sales quote broker and commitment history, additive migration ownership, and direct Data API/Storage evidence.

Neither option grants immediate revocation of an issued bearer URL. The repository default is 300 seconds and configurable ceiling is 86400 seconds. The audit reviewed current [Supabase signed URL documentation](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) and [serving documentation](https://supabase.com/docs/guides/storage/serving/downloads). The serving documentation explicitly separates issued URL expiry from Auth-key changes. These capability limits must remain explicit in release evidence and claims.

Quote PDFs retain the current generated association, exact live quote-version link, artifact-kind and Storage-existence contract. Existing 10.9 invalidation already archives/unlinks stale PDFs and clears current references; an absent standalone fingerprint comparison is not a demonstrated bypass. The draft preserves that downstream protection and does not generalize the existing server-only Sales quote-PDF broker. Restore, retention, byte deletion/replacement, lock removal and source resurrection remain outside 20.1.

## Admission blockers and required closure

1. **Canonical identity:** independently executed `python -X utf8 .agents/skills/auto-bmad/scripts/story_plan.py --resolve 20.1 --sprint-status _bmad-output/implementation-artifacts/sprint-status.yaml --planning-dir _bmad-output/planning-artifacts` returned native exit 1, `hard_stop: true`, null story key/status and `story '20.1' not found in sprint-status`. Only the coordinator can serialize approved registration and resolve it. This audit does not invent an approved status.
2. **Owner access boundary:** choice A/B remains null. Record its accepted checkpoint/ADR scope before a ready specification or implementation plan is pinned. Preparation authorization is not that decision.
3. **Oracle disposition:** no live Documents terminology/list/open/error observation exists. The latest companion records that browser inventory became accessible, but no Lovable tab or target URL was available. Resolve the authorized target/session or obtain an explicit authorized disposition; historical audit and synthetic fixtures are not a pass.
4. **Checkpoint and exact finalization:** record owner choice, oracle disposition, full story/checkpoint review, exact wrapper/migration paths and approved canonical specification on the resulting new revision. This audit closes independent review of this blocked preparation revision only.
5. **Reservations and accepted base:** reconcile Epic 14 scheduling/person/schema/permissions/shared APIs/fixtures; Story 19.1 dashboard/registry/manifest/quote reader/AppShell/NotificationBell/CI/tests; and the separate security repair's sole Next/package/lock writer. Idle status releases none. Revalidate integrated upstream contracts and base before dispatch; consume no unmerged Epic 14 or 19.1 implementation.
6. **Planner admission:** emit a helper-valid read-only parallel plan only after approved-spec prerequisites hold. Current `admission.json` correctly says `executable_parallel_plan: false`; no claim/init/worker launch is authorized.

## Verification limits and follow-up

Performed source/design/planning inspection, canonical read-only resolution, final spec LF hashing, command/path checks and a bounded final-revision regression review. The consolidated amendments fix verified nav/purpose mapping and template metadata without selecting a policy or changing blocked status. No material new regression was found.

No product tests, DB queries, browser product journeys, service launches or build were performed by this reviewer; none are claimed as evidence. Future implementation must execute all seven-owner, five-role, two-tenant, source/parent disappearance and revocation, exact-link forgery, presign/finalization race, pagination, multi-link, quote invalidation, and no-URL-on-fault tests. DB/RLS evidence requires `SUPABASE_TEST_REQUIRED=1`, executed counts and zero skipped required cases. Option A must measure/document baseline direct access as a limitation; option B must prove actual direct authenticated metadata/Storage/generic-path denial. Production Playwright desktop and 360×640 journeys and derived scope/security/bundle gates remain required.

Future implementation authors retain Suggested Review Order ownership. 20.2 lifecycle matrix/restore and richer UX, 20.3 entity links, full E20 and normal remaining wave gates remain outstanding. No further broad preparation audit is needed for this exact revision; a changed boundary or readiness promotion requires targeted review of that new contract and evidence.

## Targeted owner-option-A follow-up — 2026-10-08

Reviewer remains `/root/documents_audit`, actor `01a11af1-1be3-7110-9fea-57b6b85f03fe`, `gpt-6.1-sol` High. This follow-up reviewed only the changed specification/source-design lines against preparation commit `92060296` and the new `owner-boundary-decision-2026-10-08.md`, plus corresponding admission consistency. It preserves the historical review above and does not restart a broad review.

The independently recomputed amended specification LF SHA256 is `6e8f68dc01944b512b4fbe3ae5d9d37b941af1c1b5aba58b07e251c20ea3b514`.

**Verdict: owner-option-A amendment reviewed; implementation admission remains BLOCKED. No material authorization/design regression was found.** The owner's explicit “Follow your recommendation” selects the reviewed bounded option A. The historical unresolved A/B finding above is therefore closed. It does not select B, waive oracle evidence, approve a canonical ready specification, authorize implementation/claims or permit merge/deployment.

The changed AC8 fixes the release promise to Documents-specific selected-link listing/open/refresh. Current source/link/file and membership/capability authority remain required before signing and checked final audit. Baseline generic Files.View, ordinary file metadata and direct authenticated Storage authority remain separate. Revocation/disappearance of the selected source can deny a new Documents URL while baseline access remains allowed; issued bearer URLs can remain usable until expiry. The customer-archive example and 300-second default/86400-second configurable ceiling remain disclosed. No generalized Sales signer, global metadata/Storage policy change, retention workflow or immediate URL cancellation is introduced.

The new `documents-baseline-storage-boundary` future check correctly pairs Documents selected-source denial with preservation of baseline generic/direct access as distinct expectations. It requires the assigned real integration suites and `SUPABASE_TEST_REQUIRED=1`; residual direct access must not be labeled a source-revocation denial pass. Required all-owner/role/tenant, current-source, exact-link, lifecycle/audit-fault and browser evidence remains future work. No runtime test was performed or certified by this follow-up.

Bounded evidence consistency follow-ups communicated to the coordinator:

- Add `documents-baseline-storage-boundary` to admission's `required_checks` and update both current spec/review pins; the inspected admission still carried the previous pin while marking amendment review pending.
- The specification Code Map's integration-suite row still describes direct Data API/Storage tests “forB”. Its selected-A test table controls the reviewed contract; align that stale description with selected-source denial and retained baseline access when updating the draft.
- The owner record's collective “tenant-role/path/lifecycle checks” phrase must not be read as a new raw Storage lifecycle predicate. The generic signer has lifecycle checks; current direct Storage authorization is tenant-role/path scoped. More precise wording would keep those boundaries explicit. This is a documentation clarity note, not a discovered new bypass or authorization to tighten the policy.

These notes do not reopen the owner's boundary decision. Canonical registration/resolution, authorized oracle target and behavior or explicit disposition, exact Documents-specific checked contracts and wrapper/migration ownership, early-E20 checkpoint closure, fresh integrated-base validation, shared reservations and helper admission remain open. The previous preparation commit's dependency-audit CI failure remains the separate reserved repair lane; it supplies no Documents verification and is not permission to edit Next/package/lock files.

Only this owned audit appendix was changed by the reviewer. No source/spec/admission/Git changes, product tests, DB/browser journeys, managed resources or implementation claims were performed.

### Final consistency correction and reviewed pin

Within the same targeted option-A follow-up, the author corrected only the integration Code Map description to require A's selected-source negatives and distinct preserved baseline access expectations, and clarified the owner record to distinguish generic signer lifecycle checks from raw authenticated Storage's private-bucket/tenant-path/role checks. The coordinator added `documents-baseline-storage-boundary` to admission's required check list. All three consistency notes above are resolved; none changed the selected boundary or remaining admission gates.

Reviewer `/root/documents_audit`, actor `01a11af1-1be3-7110-9fea-57b6b85f03fe`, `gpt-6.1-sol` High, independently recomputed and reviewed final LF SHA256 `6e52edf490164f36e01a289d71880e163175541b5d990471634b6303b69940fa`. The final targeted verdict is **reviewed-blocked, zero additional material authorization/design defects**. Preparation amendment review is complete for this exact specification; canonical ready-spec approval and implementation admission remain false. The coordinator owns updating the independent-review pin/status in admission to this completed follow-up. This correction check is not another broad review round and supplies no product/runtime/CI passing evidence.

### Targeted prospective registration check — 2026-10-08

Reviewer `/root/documents_audit`, actor `01a11af1-1be3-7110-9fea-57b6b85f03fe`, retains `gpt-6.1-sol` High for specification provenance. Reviewed only the new `registration.json`, `registration.patch`, `registration.md` and the metadata delta. Final independently verified specification LF SHA256: `7e475bfd42adc41e61fc4ccba5f399a7816025fdf37ad89d12d299c1aba489ab`. Replacing its confirmed `canonical_story_key` back with null exactly reproduces prior LF SHA `6e52edf490164f36e01a289d71880e163175541b5d990471634b6303b69940fa`; no option-A, source-authority or readiness contract changed.

The proposed patch inserts exactly the three confirmed E20 keys as backlog immediately after `epic-20`, with titles explicitly recorded in the mapping: 20.1 Documents activation/source-authorized aggregation, 20.2 Search/filters/preview/archive-restore, and 20.3 Entity-panel links/contextual navigation. Independently reconstructed the unified patch in memory, matched all recorded LF/exact-byte hashes, and invoked the real helper with in-memory prospective read substitution. It reports count 3, 20.1 first, not last, two stories after it, and backlog statuses throughout. No temporary file or aggregate source was written. The actual sprint's LF Git blob remains `68d4a3d72f2d3782af36ee5d90e3193fcf4b1ed5`; independently rerun actual canonical lookup still exits 1 with story-not-found. The artifact correctly distinguishes prospective success from actual missing registration. Null prospective helper titles do not establish canonical title lookup; the explicit confirmed mapping and required later planning-title reconciliation retain that readiness gate.

No 20.2/20.3 placeholder specification files were created. Hash mismatch, existing E20 rows or concurrent Epic 14 edits require reconciliation rather than whole-file replacement, duplicate insertion or status regression. Only the coordinator may serialize actual registration with the Epic 14 owner. **Verdict remains reviewed-blocked: no material metadata/registration defect found; proposed key confirmation is not applied registration, specification approval, implementation/claim authority or closure of the retained oracle, checked-contract, checkpoint, base and shared-ownership gates.** Only this audit paragraph was changed by the reviewer; no broad review or product/runtime evidence is claimed.

### Targeted latest-evidence and preparation-merge handoff review — 2026-10-08

Reviewer `/root/documents_audit`, actor `01a11af1-1be3-7110-9fea-57b6b85f03fe`, `gpt-6.1-sol` High. Reviewed only the evidence delta from `2499f417` to `67d049` (oracle-access companion and admission/orchestration additions) and current `preparation-merge-handoff.md`. This is an evidence/handoff follow-up, not another broad specification or code-review pass. Independently recomputed the unchanged specification LF SHA256 `7e475bfd42adc41e61fc4ccba5f399a7816025fdf37ad89d12d299c1aba489ab`.

**Verdict: preparation deliverable complete and reviewable; implementation admission remains BLOCKED. No consequential new evidence defect was found.** Completion here means the bounded preparation package and truthful evidence/remaining blockers are assembled. It does not mean the oracle, canonical registration, exact checked-wrapper contract, early-E20 checkpoint or worker admission gates passed.

The fresh oracle companion records responsive browser discovery and a bounded repository target search, zero live Documents observations, no authorized target URL/tab/session, no navigation/data mutation and no oracle waiver. It correctly identifies missing target access rather than fabricating an authentication failure. Admission retains zero observations and blocked oracle result. The separately observed security baseline `23c48b34c8a6c9158eeaf0edfca74e628d575cbc` is explicitly not integrated into this preparation branch; historical accepted-base fields are not substituted with an unperformed rebase/verification claim. Registration remains prepared-not-applied, the actual sprint still lacks the 20.1 row, and its LF blob remains `68d4a3d72f2d3782af36ee5d90e3193fcf4b1ed5`. `approved`, `implementation_authorized` and `executable_parallel_plan` remain false; option A is unchanged.

The owner-authorized coordinator merge of completed preparation is distinct from implementation admission. The handoff correctly requires review of the final evidence, identification of the exact pushed PR head, every required CI check passing at that head, confirmation of a preparation-only diff, and one serialized coordinator merge. It grants no concurrent merge by this lane, oracle waiver, policy change, registration application or implementation claim. At dispatch, the coordinator reported `67d049` Verify success while database/browser/recovery checks were still running; this audit does not assert full CI success or authorize bypassing the exact-head merge prerequisite. Adding this audit or later handoff changes requires the coordinator to assess the resulting final head and CI, rather than reuse the earlier observation.

Only this append-only audit section was changed by the reviewer. No specification/root-artifact edits, Git mutation, merge, product/runtime tests, DB/browser journeys, managed launch or external-chat messaging were performed. The coordinator owns PR presentation, final CI assessment and the authorized preparation merge; all stated implementation blockers remain recorded for later work.

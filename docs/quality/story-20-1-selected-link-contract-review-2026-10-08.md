# Story 20.1 selected-link contract design review

Date: 2026-10-08. Independent reviewer: `/root/documents_audit`, explicitly routed `gpt-6.1-sol` High. Author: `/root/documents_spec`, `gpt-6.1-sol` High. Current inspected base: `42f5cf60d1ded6d814c2c0f61b70b312144ce10e`.

## Review scope and exact pins

This review covers the newly authorized Documents selected-link contract, its source/spec pointers and checkpoint reconciliation. It does not reopen the earlier broad specification review, supersede historical audit evidence or certify an implementation. The two author corrections below received only targeted regression checks.

Independently recomputed LF-normalized SHA256 pins:

| Artifact | SHA256 |
| --- | --- |
| `_bmad-output/implementation-artifacts/spec-20-1-documents-activation-and-source-authorized-aggregation.md` | `ad9ae965b3cadbe5def211a7e1adc2e2bd77ceab81986930444b05844f96bef0` |
| `_bmad-output/auto-bmad/preparation/story-20-1/selected-link-contract-design.md` | `dd11f47be7bc97f1cfff26340d6b6f2e49f4bf2956c6396290c288c6c8e7a9f8` |
| `_bmad-output/auto-bmad/preparation/story-20-1/source-authorization-design.md` | `fdc7d0a12526f90f860172ac3a7e7db94501e9a82baa9ea7f19e3a9651e54caa` |
| `_bmad-output/auto-bmad/preparation/story-20-1/checkpoint-reconciliation.md` | `732b784196520f80798ca0a3f7532d34316c5b29caf0817a6befecca40272509` |

**Verdict: new contract design review complete; no unresolved material design finding in these final artifacts. Implementation admission remains BLOCKED.** The concrete command/RPC/proof/locking contract replaces the earlier unspecified-wrapper gap at design level. Actual migration allocation, code, ACLs, canonical vectors, concurrency behavior and required runtime evidence remain unimplemented and unproven.

## Closed findings in the new design

### Mutable parent graph during lock acquisition

The first contract gathered candidate ancestor IDs and locked ancestors before the source row, without explicitly requiring the locked source's current references to match the gathered graph. This can matter for a real supported caller: `contact.update` invokes `update_contact_with_audit`, which allows a permitted CRM actor to change a contact's optional facility from F1 to F2. If that commit occurs before the Documents helper locks the contact, validating F2 through an unlocked lookup could permit F2 archival to commit before the final audit even while F1 is locked. Binding the contact owner ID in the HMAC does not itself bind or lock its facility ancestry.

The final contract requires every current source/link relationship, including optional-null transitions, to equal the exact gathered and locked graph after acquisition. A changed reference fails with retryable failure; the helper cannot authorize or acquire an unlocked replacement out of order. A fresh command repeats acquisition and proof creation. The final deterministic race suite explicitly covers F1-to-F2 reassignment and F2 archival between graph acquisition and audit. This closes the design finding; only implemented two-connection tests can prove the locking behavior.

Direct authenticated file-link re-pointing is already revoked, so this finding was grounded in the supported contact RPC rather than an invented direct-DML bypass. Existing `admin_manage_membership` also locks the membership before child-role replacement; the proposed membership SHARE then ordered child-role SHARE sequence is consistent with that supported revocation path. Other writer lock ordering and deadlock/retry behavior remain required implementation evidence.

### Derived PDF linked under an ordinary purpose

The existing authenticated `link_file_with_audit` checks file tenant and owner/purpose eligibility but does not restrict `files.artifact_kind`. It can add an ordinary CRM/calculation link to an existing quote PDF; file/link identity protection does not forbid that additional link. A Documents implementation that classifies only by selected-link purpose could incorrectly send such an artifact through ordinary-file eligibility.

The final contract makes durable artifact kind the discriminator. Ordinary branches require `artifact_kind IS NULL`. Every `quote_pdf` requires the exact selected quote-version/quote-PDF context and generated-current association; unknown kind and mismatched kind/purpose fail closed. The updated tests explicitly deny ordinary-purpose quote-PDF contexts in list, prepare and finalize, even when another valid PDF link exists. This closes the ambiguity without modifying generic links, raw Storage or the owner-approved option-A residual capability.

## Reviewed authority and proof contract

- The action accepts exactly `{link_id, file_id}` with validated UUIDs. It accepts no tenant, actor, owner, purpose, storage identity, role, correlation, TTL, URL or signature authority from the client. The server generates correlation and uses the request-bound anon-key client.
- `document.signedAccess.create` is enrolled in `src/server/commands/envelope.ts` under Documents/View. Files/View and source capability remain additional requirements. Envelope ownership targets the exact file-link; neither another visible link nor the unchanged file-only signer replaces selected-context authority.
- The six-argument `prepare_document_signed_access_audit_attestation` and sixteen-argument `record_document_signed_access_audit_attested` repeat current actor/membership/role and selected-link/source/file/object checks. Internal `story_20_1_document_selected_link_target` is owner-only; external wrappers grant only authenticated EXECUTE and explicitly revoke PUBLIC/anon/service_role. Internal payload/key helpers are externally revoked. Empty search path, schema-qualified objects, fixed audit semantics and explicit definer authorization are required; a nested invoker function is not represented as caller-RLS visibility.
- The source branches retain the seven-owner matrix, required live ancestry, exact acceptance/version/quote consistency, snapshot attachment association and durable quote-PDF provenance. Resources activation contributes no new file owner. Unknown owner/purpose/kind is denied rather than falling back to tenant-wide visibility. Existing PDF invalidation and immutable file/object/link protections remain enforced downstream.
- A separate Documents canonical domain and derived key bind tenant, actor, selected link, file, owner type/ID, purpose, bucket/path, correlation, signed-URL hash and actual expiry, key ID and issuance/expiry times. Generic File and quote proof domains remain unchanged and cannot substitute. The root is the existing server/Vault quote-PDF secret; no new credential or service-role Storage signer is introduced.
- Finalization serializes the tenant/file/correlation replay identity, verifies current target and HMAC/time fields, rejects a consumed fixed Documents event and atomically writes the fixed audit event once. Replay and response-loss handling require a fresh operation; they do not return a cached success URL. Missing key, denied current authority, malformed/stale/tampered proof, Storage failure or audit failure produces no URL-bearing success.
- SHARE locks protect relevant nonkey state changes, rather than relying on KEY SHARE. Successful locked revalidation and audit commit are the defined authority point. Prepare cannot retain those locks across remote Storage work. A later revocation can precede HTTP delivery and does not invalidate the previously issued bearer capability; the design does not promise otherwise.

The final contract preserves option A: generic file metadata/signing and direct authenticated Storage retain their existing authority. Generic signing has file lifecycle checks; raw Storage has private-bucket/tenant-path/role checks. Already issued URLs may survive source revocation until actual expiry, with the existing 300-second default and 86400-second configurable issuance ceiling. The validation tolerance does not increase the configured issuance cap. No global policy-B enforcement, anonymous privileged endpoint, generalized Sales broker, retention workflow or byte replacement is proposed.

## Paths, evidence and checkpoint reconciliation

The new action, command, typed RPC bridge, Documents attestation helper and source/read-model paths are concrete. `src/server/commands/envelope.ts` is an explicit additional command-registry write path. Existing generic signer/RPC/attestation and quote broker files are read-only reuse references rather than automatic write claims. The additive function/ACL-only migration unit is `story_20_1_documents_selected_link_access.sql`; no migration exists from this preparation. Its actual CLI-generated timestamp path must be allocated and pinned in the admitted ownership process before validated implementation claims. The logical basename is settled; the missing physical timestamp is an explicit future path condition, not an unresolved security-policy choice.

Required focused tests cover all owners/roles and two tenants, source/parent disappearance, exact link/file mismatches, direct RPC spoofing, generic/quote proof substitution, every bound-field tamper, expiry, replay and concurrent finalization, supported role/source mutations, parent-graph races, durable artifact-kind classification and no-URL faults. DB evidence requires `SUPABASE_TEST_REQUIRED=1`, positive executed counts and zero skipped required cases. Baseline generic/direct Storage expectations remain distinct from selected-source denial. Canonical golden vectors, matrix/RLS correspondence, grants, production browser journeys and scope/security/bundle checks remain future obligations.

The checkpoint reconciliation correctly follows the retained approved amendment, PRD AC-B2-8 and the early checkpoint's full-canonical-story dispatch row: complete audited/pinned 20.1–20.3 specifications are required before the first E20 dispatch. This does not require implementing later stories before 20.1. No first-story waiver, placeholder later specification or new owner decision is inferred. Standing authorization covers continued design/preparation; it does not supply missing oracle evidence or waive the retained checkpoint.

The final spec now uses integrated base `42f5cf60...` and recognizes canonical registration as resolved. The source companion recognizes resources as active with no file owner. Current registration/handoff evidence distinguishes integrated registration from historical failed/prospective records. Admission's spec pin matches this review and keeps `approved`, `implementation_authorized` and `executable_parallel_plan` false. Its contract-review-pending metadata is coordinator-owned and may be advanced to reviewed-design-only using this report; it cannot be advanced to implemented or ready on this evidence.

Remaining admission conditions are the authorized Lovable target/live evidence or explicit disposition; complete reviewed/pinned later-story specs and early checkpoint closure; actual physical migration/path and fresh shared ownership/test-resource reconciliation; current integrated-base contract validation and a validated ready-spec assignment. Historical merged upstream writers are not presumed active conflicts, and no worker claim is created by this design. Required implementation and combined-integration checks will bind the eventual result SHA rather than this documentation pin.

## Reviewer actions and limits

Inspected the new artifacts and relevant integrated envelope, signing/attestation, grants/audit, source mutation and downstream lock/provenance contracts; independently verified all four final LF pins and current blocked admission flags. Wrote only this owned review report. No product files, SQL migration, database query, runtime test, browser/oracle probe, service/resource, Git mutation, PR action, shared state or other-chat message was performed. Review completion is of the future contract design only; none of its test obligations is claimed as executed evidence.

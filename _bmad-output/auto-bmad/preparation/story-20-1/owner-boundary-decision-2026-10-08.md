# Story20.1 owner boundary decision —2026-10-08

Status: owner-approved bounded optionA; preparation remains blocked for implementation.

The owner replied **“Follow your recommendation”** to the completed preparation package's recommendation for optionA. Root relayed that explicit owner decision to the High specification author for this bounded amendment. This record selects the access boundary, without converting preparation into build/claim/merge authority.

## Approved boundary

Documents-specific selected-link listing, opening and URL refresh must require current active membership, Documents.View, Files.View, source capability and request-bound source RLS visibility, exact live selected link/file and the source/parent eligibility contract. Source disappearance, archive or revocation removes the contextual result and prevents a newly denied Documents selected-link request from returning a URL. Current quote-PDF and checked attributable audit requirements remain. Exact Documents-specific prepare/finalize contracts and any necessary additive wrapper paths must be independently reviewed before implementation admission; this record invents neither wrappers nor passing evidence.

Baseline generic Files.View/file metadata and direct authenticated Storage authority retain their existing checks. The generic signer checks tenant/file ownership and file lifecycle; raw authenticated Storage SELECT/download/sign checks the private bucket, tenant path and role without those generic file-lifecycle checks. These paths may permit byte access independently of a disappeared or revoked selected source. Documents evidence and release wording must distinguish this residual authority from its selected-source checks. The existing customer.archive -> active file/link -> generic signer/direct Storage example in the source design substantiates the boundary; it is existing behavior, not a new defect introduced by Documents.

Already issued signed bearer URLs may remain usable until their embedded expiry after later revocation. Existing default TTL is300 seconds; the configurable ceiling is86400 seconds. No instant URL cancellation or global source-sensitive byte revocation is promised.

## Retained gates and scope

OptionB/global source-sensitive file/metadata/Storage policy enforcement was not selected. Oracle evidence was not waived. Canonical sprint registration, authorized live Lovable target/behavior disposition, exact Documents-specific checked-contract and schema/path admission, independent High amendment review, early-E20 checkpoint closure, current integrated-base validation and reconciled Epic14/19/security/shared reservations remain required. No ready-for-dev status, product implementation, migration, module activation, dependency/environment change, claims, merge or deployment is authorized by this boundary decision.

Author amendment route: `/root/documents_spec`, `gpt-6.1-sol` High. The prior spec revision was`5b5d437acc08e3c4005f615b859fca1a7be55806379941d9bebd2e4dfc699964`(LF SHA256); root owns the new exact-revision pin and independent review record.

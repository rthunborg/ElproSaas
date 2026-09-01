# ADR-B008: Quote Review Authority and Derived-Artifact Validity

Status: decided — 2026-08-31
Scope: **IN** Story 10.8 and Story 10.9; **DEFERRED** global file retention/reclamation (E31 / B2→B3).

## Decision

An authenticated tenant business user explicitly attests to the exact, server-validated quote content at review. This is provenance of the actor and reviewed content; it does not claim that a UI proves human attention. A second reviewer is not required. Until Epic 11 activates, `tenant_admin` is the authority. The future permission seam is `Quotes.Create` for creation, `Quotes.Approve` for final review, and `Quotes.Send` for send; one person may hold all three.

The review authorization is one-time, expires after 15 minutes, and is invalidated by any source, attachment, or customer-visible-content change. It is not an HMAC, service-role, or client-bypass capability. Quote lifecycle mutations succeed only with an atomic actor/correlation audit record. Authenticated direct DML/bypass and the obsolete digest overload are revoked; narrowly scoped, hardened `SECURITY DEFINER` functions are permitted only where they enforce this boundary.

A customer-visible draft change invalidates the current PDF. `start_quote_pdf_render` issues the render/file ID; before a non-upsert Storage upload, the narrow authenticated `reserve_quote_pdf_file` RPC reserves metadata for that exact ID. It is the sole authenticated route that may set the nullable durable `files.artifact_kind='quote_pdf'` marker, and that marker plus the protected file identity/metadata is immutable thereafter. A reserved quote-PDF row remains ineligible for signed access until activation links it.

PDF-byte activation additionally requires a separate server-only HMAC-SHA256 attestation. PostgreSQL verifies it with `pgcrypto` against the matching Supabase Vault secret `quote_pdf_attestation_<key-id>`; review authorization remains separate and non-HMAC. The short-lived attestation binds tenant, actor, quote version, render/file ID, current content fingerprint, bucket, path, checksum, size, MIME, correlation ID, key ID, and issuance/expiry window. It is never returned to a client, logged, or persisted, and any missing, expired, malformed, mismatched, or unverifiable value fails closed. No Edge Function, service-role/elevated Storage credential, or client bypass is introduced.

Render start is correlation-idempotent with a bounded five-minute lease and recovery path. Completion response loss reconciles the committed current generated PDF and must not archive it. Activation and sending require the current fingerprint, reserved object identity, matching Storage metadata, and a valid byte attestation.

Failed, invalidated, completed-but-unsent, and historical quote-PDF metadata stays protected rather than reverting to generic files. A superseded PDF reference is archived/unlinked; bytes remain and normal signed access refuses archived files. A successor initially selects all predecessor attachments that remain active and eligible under its current calculation; the user may change that selection. Eligible files are reused immutably without byte copying; ineligible or archived candidates are omitted with a warning.

The durable marker is the selected Option-A provenance boundary, based on the Round-2 Sol/xhigh security review. This records the decision without claiming final review convergence or DB/Storage test completion.

Fixed-price green inputs are gross, including VAT, before the 97% calculation. ROT and green deductions may coexist only with disjoint allowances; insufficient allowance blocks. Construction reverse charge is mutually exclusive with deductions.

## Consequences

**IN:** Stories 10.8/10.9 implement the authority/audit, HMAC byte-attestation boundary, PDF-currentness/recovery, attachment carry-forward, and exclusive-`validTo` wording correction.
**SEAM:** Epic 11 replaces the temporary role with permissions without changing the attestation model.
**DEFERRED:** physical byte reclamation, legal retention periods, and deletion workflows remain E31 / B2→B3 work. Story 31.7 may add an executor only after E31's central retention-policy workflow; it must be tenant-scoped, dry-run-first, legal-hold-aware, idempotent, and audited per object. This ADR creates no retention implementation commitment.

## Assumptions and Open Verification

- **Assumption:** Storage system metadata remains the server-side evidence for object existence, MIME, and size; the HMAC is the separate byte-binding proof, not a database rehash of Storage bytes.
- **Open verification:** fresh reset/tests and final review convergence remain pending; no historical count is current evidence.

## References

`_bmad-output/planning-artifacts/architecture-phase-b.md`; Stories 10.8 and 10.9; `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-31-story-10-6-followups.md`.

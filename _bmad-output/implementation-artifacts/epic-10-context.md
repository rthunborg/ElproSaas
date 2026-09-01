# Epic 10 Context: Quote Lifecycle Completion (+ Phase B Governance Re-Baseline)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Complete the quote lifecycle on the existing Phase A quote surface while establishing the Phase B scope-governance baseline. The epic adds lost/declined outcomes, follow-up and pipeline visibility, reconciles the accountant-approved tax rules, and hardens review authority and PDF validity so customer-visible commitments are reproducible, current, tenant-authorized, and auditable.

## Stories

- Story 10.1: Phase B Governance Re-Baseline and Scope Manifest
- Story 10.2: Förlorad/Avböjd Status and Lost-Reason Lifecycle
- Story 10.3: Quote Follow-Up Workflow
- Story 10.4: Pipeline Surfacing and Dashboard Read-Model
- Story 10.5: Quote-Table DB Hardening and Read-Model Pagination
- Story 10.6: Tax-Answer Reconciliation
- Story 10.7: PWA + Offline Field Capability
- Story 10.8: Quote Review Provenance, Authority, and Audit
- Story 10.9: Quote PDF Validity and Attachment Carry-Forward

## Requirements & Constraints

- The scope manifest is the machine-readable authority for active and pending product surface. Quote changes stay inside the already-active quotes module; new tenant-owned tables must be enrolled in RLS, H4 tenant inventory, exact-policy checks, and manifest-derived guardrails in the same change.
- Tenant ownership and authorization must be enforced server-side. Browser paths may not receive service-role capabilities, and privileged quote mutations must authenticate the actor, validate tenant membership and object ownership, reject direct-DML bypasses, and commit audit evidence atomically.
- Money remains integer öre. VAT is rounded once per VAT category at document level; customer visibility, invoice-total inclusion, and deduction classification are independent; tax-reduction claims truncate to whole SEK; reverse charge is a distinct VAT type and requires the buyer VAT registration number on customer-visible output.
- Sent and accepted quote snapshots remain immutable. Corrected tax rules apply only to new versions, never by recomputing an existing sent commitment.
- A current generated PDF is a send precondition. Customer-visible draft edits invalidate the active PDF; obsolete references are archived without deleting bytes; normal signed access refuses archived files. Successors carry forward only eligible immutable attachments.
- Global physical file reclamation, legal retention periods, and deletion workflows remain deferred. This epic must not broaden archived-file access or introduce a hard-delete path.
- Quote and file failures must preserve coherent lifecycle state, tenant isolation, and retryability. Tests must cover money/tax edges, authorization expiry and reuse, cross-tenant attempts, current-PDF gating, archive denial, attachment eligibility, and audit rollback.

## Technical Decisions

- Sensitive quote workflows use narrow authenticated server commands backed by hardened PostgreSQL functions. Security-definer functions use an empty search path, explicit schema qualification, caller-derived identity, and least-privilege grants.
- Quote review is a one-time, 15-minute authorization over exact server-validated content. It is invalidated by relevant content changes and is authority evidence, not proof that the user visually inspected a screen.
- PDF rendering uses a database-issued render/file identifier and an immutable quote-PDF reservation before storage upload. Activation and send require matching storage metadata plus a short-lived server-only HMAC attestation verified in PostgreSQL; the attestation is never returned, logged, or persisted.
- Render start is correlation-idempotent and lease-bounded so a lost response can be reconciled without creating a second active render. Generated-PDF validity binds the quote version, current content fingerprint, reserved file identity, storage path, checksum, size, MIME type, correlation, and signing-key window.
- Audit records are append-only operational evidence and retain actor/correlation context without storing secrets, raw file bytes, or broad personal data.

## UX & Interaction Patterns

- Quote detail shows lifecycle status, selected immutable version, totals and tax assumptions, terms, attachments, PDF state and metadata, and lifecycle events.
- Pre-creation review separates blocking issues from warnings and shows the exact customer-visible snapshot, including VAT/tax treatment, reverse-charge buyer VAT number, terms, and selected attachments.
- PDF states distinguish not generated, generating, generated, failed, and stale/invalidation conditions. Failure and retry must not silently change quote lifecycle state.
- Acceptance captures explicit evidence and time, presents field-level validation in plain language, and preserves entered data when validation fails.
- Linked lifecycle files require confirmation before archive/delete operations, and archive state is visible without revealing cross-tenant object existence.

## Cross-Story Dependencies

Story 10.1 precedes all Phase B work. Stories 10.2–10.5 establish and harden the quote lifecycle/read model. Story 10.6 supplies the tax and money semantics consumed by later quote/PDF work. Story 10.8 establishes review authorization and atomic audit authority; Story 10.9 consumes that authority and the Story 10.6 snapshot to enforce current PDF output and attachment carry-forward. Epic 11 later replaces the temporary tenant-admin authority with named quote permissions without changing these invariants.

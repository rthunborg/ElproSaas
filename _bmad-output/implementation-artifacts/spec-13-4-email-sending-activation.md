---
title: 'Email Sending Activation'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_revision: 'dd03e42e9ddf799a850f65a22f287333b355b91d'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - 'docs/decisions/ADR-B011-epic-13-email-release-and-quote-delivery.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - 'docs/process/review-order.md'
warnings: [oversized]
deferred:
  - summary: 'Keep real-recipient delivery disabled until the separate ADR-B011 owner go-live record is approved.'
    evidence: 'ADR-B011 requires the owner go-live record; Story 13.4 verifies only the synthetic sandbox adapter.'
    location: 'docs/decisions/ADR-B011-epic-13-email-release-and-quote-delivery.md'
    severity: high
  - summary: 'Add idempotent provider submission before enabling real-recipient delivery.'
    evidence: 'If a provider accepts submission and the following outcome persistence fails, a retry cannot prove the earlier delivery and could duplicate real-recipient mail.'
    location: 'src/server/email/outbox.ts'
    severity: medium
  - summary: 'Include a scoped unsubscribe URL in every non-essential real-provider-rendered message.'
    evidence: 'Sandbox delivery uses a synthetic body; a real provider template must issue and include the public token URL while preserving its narrow capability and privacy boundary.'
    location: 'src/server/email/templates.ts'
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Story 13.3 can safely queue, suppress, retry, and show email work, but it deliberately cannot call a provider. The product needs an auditable, sandbox-proven delivery path and a narrowly isolated unsubscribe surface without enabling real-recipient sending by configuration accident.

**Approach:** Extend the existing tenant-explicit outbox worker with a server-only provider adapter and delivery envelope, then add release gating, preference enforcement, valid-PDF quote attachment handling, and the ADR-B004 unsubscribe lifecycle. An authorized quote-send request validates the current PDF through ADR-B008 and prepares a distinct private durable delivery artifact bound to its tenant, quote version, and outbox record. The worker may read only that artifact, rechecks quote currentness and eligibility before submission, and never receives authority over the original quote PDF. The sender selects and confirms an existing linked customer/contact email at send time; its normalized value and selected source are frozen in the delivery record. Quote finalization and outbox enqueue occur atomically after artifact preparation. Keep sandbox delivery synthetic and prove every disabled or invalid release posture leaves queued mail untouched.

## Boundaries & Constraints

**Always:** Run delivery only through the authenticated jobs runner; preserve suppression-before-provider ordering, leased `SKIP LOCKED` claims, append-only delivery events, tenant isolation, sanitized Admin projections, and entitlement-safe content. Prepare a private delivery artifact only after the request-bound ADR-B008 PDF validation succeeds; bind it to the tenant, quote version, and outbox record, retain no HMAC attestation, and restrict the worker to that exact artifact. Recheck quote version, content fingerprint, and eligibility immediately before provider submission. Store the normalized recipient and its linked customer/contact source in the delivery record, and require a cancel-and-new-authorized-delivery flow for recipient changes. Treat artifact preparation as cross-system work with an auditable recovery path; the subsequent quote finalization and outbox enqueue are one database transaction. Hash unsubscribe tokens with SHA-256 after generating 256 random bits, apply database-backed token and IP-hash rate limits, use uniform inactive-token responses, and register the public surface and every new tenant table through the active notifications manifest/H4 contracts.

**Block If:** A change needs a real-recipient release, a production sender identity or credential, a provider-specific contract that cannot be represented behind the adapter, a live flow outside an active manifest module, or a public capability beyond unsubscribe. Halt with the concrete missing owner decision or release evidence.

**Never:** Enable real recipients by default; expose provider credentials, recipients, template bodies, token plaintext, or PDF bytes to clients/Admin projections; persist the ADR-B008 HMAC attestation; grant the worker general original-quote-PDF, generic quote-file, service-role Storage, or elevated Storage access; add another job/API execution lane, public quote view/acceptance link, marketing/Fortnox/Auth-mail flow, or a public route that imports app-shell, tenant-context, session, or navigation code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Sandbox delivery | Valid server release control and a synthetic recipient | Claimed queued item renders its entitlement-safe template, the adapter records its provider ID, and the item becomes `sent` with an append-only event | Provider failure follows the existing bounded retry/terminal state path |
| Closed delivery | Missing, malformed, preview-only, or real-recipient configuration | No adapter call; eligible queued item remains queued and truthful | Record only sanitized operational evidence |
| Suppression | Matching tenant, recipient hash, and category | Item becomes `suppressed` before rendering or provider work | Nonmatching tenant/category suppression has no effect |
| Quote attachment | Current valid sent-quote PDF versus stale/invalid/missing PDF | Attach only authorized, current snapshot bytes; never create a public link | Fail closed before provider submission and preserve a recoverable queued state |
| Quote recipient | Sender selects an existing linked customer/contact email versus absent, invalid, or later edited email | Normalize and freeze the selected address and source in the delivery record; retries/reminders use that record | Absent/invalid selection fails enqueue; a change cancels pending delivery and requires a new authorized delivery |
| Quote lifecycle and delivery truth | Artifact prepared, then finalization/enqueue succeeds or fails; provider outcome is queued, sent, failed, or suppressed | Finalize quote and enqueue in one database transaction after preparation; show email status from the outbox/delivery log | Preparation or transaction failure leaves a recoverable, auditable orphan/recovery path; never say email was sent before provider acceptance |
| Unsubscribe token | Valid active, revoked, unknown, or rate-limited token | Valid token changes only its allowed non-essential scope; invalid states share one generic response | Token/IP limits return 429 with retry guidance and disclose no tenant/recipient data |

</intent-contract>

## Code Map

- `src/server/email/outbox.ts:31` -- existing service-only enqueue, claim, suppression, and dark processor; evolve its worker contract without weakening state/lease semantics.
- `src/server/email/templates.ts:1` -- recipient-safe DTO boundary; extend only with values needed by the server-side delivery envelope.
- `src/server/email/provider.ts` -- introduce the single server-only adapter seam and release-control validation.
- `src/app/api/jobs/run/route.ts:66` and `src/server/jobs/{runner,producers,service-client}.ts` -- retain the sole authenticated, tenant-round-robin execution lane and jobs-only elevated access.
- `supabase/migrations/20260923175035_email_outbox_pipeline.sql:3` and `20260923182954_email_outbox_security_and_state_fixes.sql:3` -- preserve forced RLS, raw-read revocation, append-only events, lease-bound outcomes, and `SKIP LOCKED` claims while extending delivery/token data.
- `src/scope/manifest.ts:231`, `tests/integration/rls/tenant-table-inventory.ts:98`, and migration-reset policy tests -- notifications is active; enroll unsubscribe storage and its public surface through the manifest-derived contracts.
- `src/server/commands/quotes/mark-sent.ts:127` -- reuse the authorized narrow, currentness-checked PDF-byte access model to prepare the bound delivery artifact before the finalization/enqueue transaction; never use a signed URL or service-role/elevated Storage read.
- `src/components/notifications/NotificationPreferences.tsx:49`, `src/app/api/notifications/preferences/route.ts:15`, and `src/server/read-models/email-outbox.ts:8` -- enable only server-authorized email preferences and keep the Admin queue redacted.
- `src/app/(public)/**` and `scripts/verify/check-service-role-containment.mjs:224` -- public-shell and provider-containment guardrails that must be extended with focused negative tests.

## Tasks & Acceptance

**Execution:**
- `supabase/migrations/` -- extend the outbox delivery envelope with the private delivery-artifact binding, frozen normalized recipient and linked-source evidence, artifact recovery/audit state, and tenant-scoped unsubscribe token/rate-limit records with forced RLS, explicit grants, exact state/event protections, hashes instead of token plaintext, and H4-compatible keys -- provider delivery, tightly bounded artifact access, and public-token state need durable, tenant-safe authority.
- `src/server/email/outbox.ts` and `src/server/email/{provider,templates}.ts` -- replace dark-only processing with a typed server-only adapter flow that checks release posture before every call, permits synthetic sandbox delivery, records provider outcomes safely, enforces preferences/suppression/dedupe/retry, and keeps real delivery blocked -- delivery remains fail-closed and idempotent.
- `src/app/api/jobs/run/route.ts` and `src/server/jobs/producers.ts` -- dispatch the activated processor exclusively from the existing runner and admit only active-module, priority-defined transactional flows -- no second execution lane or inactive-module send path appears.
- `src/server/commands/quotes/` and the relevant quote/email producer -- after request-bound ADR-B008 verification, prepare the bound private delivery artifact and then atomically finalize the quote and enqueue the outbox record with a sender-confirmed linked customer/contact recipient snapshot; cancel/reissue on recipient changes and stop reminders on every specified terminal condition -- customer mail carries bytes without a public customer capability or worker authority over source quote files.
- `src/server/notifications/`, `src/app/api/notifications/preferences/route.ts`, and `src/components/notifications/NotificationPreferences.tsx` -- make non-essential email preference state available only when the server release posture permits it, enforce it during enqueue/delivery, and retain Swedish unavailable/error states -- client toggles cannot bypass server policy.
- `src/app/(public)/unsubscribe/**` and server-only unsubscribe modules -- implement minimal unsubscribe/re-subscribe handling with generic inactive responses, revocation/audit, token/IP fixed windows, and no authenticated-shell imports -- the token is the entire narrowly scoped capability.
- `src/scope/manifest.ts`, `tests/integration/rls/tenant-table-inventory.ts`, manifest coherence tests, migration-reset inventory tests, and `scripts/verify/check-service-role-containment.mjs` -- declare the active notifications unsubscribe surface, enroll any new tenant tables, and replace the dark-posture provider ban with a narrow server-only adapter allowlist -- scope and containment guards fail loud on bypasses.
- `tests/unit/server/email/**`, `tests/integration/email/**`, `tests/integration/rls/**`, `tests/unit/scripts/verify/**`, and `tests/e2e/**` -- cover provider contracts, synthetic sent delivery, closed-gate no-call, suppression/dedupe/lease/retry, preferences, quote-PDF rejection, each reminder stop, public-token uniformity/rate limits/isolation, and provider/public-shell containment -- required database evidence runs with `SUPABASE_TEST_REQUIRED=1`.

**Acceptance Criteria:**
- Given a valid sandbox release configuration and synthetic recipient, when the sole jobs runner processes an eligible queued item, then it records one provider-backed `sent` outcome without exposing recipient or template data outside server-only paths.
- Given absent, invalid, preview-only, or unapproved real-recipient release state, when work is processed, then no provider call occurs and the item remains queued with no false sent result.
- Given concurrent workers, retries, or matching suppression, when they process outbox work, then existing tenant dedupe, disjoint claims, lease recovery, retry, and suppression-before-send invariants still hold.
- Given a non-essential email preference or unsubscribe token, when it is changed through its authorized surface, then future matching delivery is suppressed while essential categories and other tenants/categories are unaffected.
- Given unknown, revoked, or rate-limited public tokens, when the unsubscribe route is requested, then callers receive the same minimal inactive response or a rate-limit response without tenant enumeration, privileged capability, or authenticated-shell imports.
- Given customer quote delivery, when an authorized sender confirms a valid linked customer/contact address, then the system freezes the normalized address and selected source in the delivery record; later CRM edits cannot redirect retries or reminders, and changing the recipient cancels the pending delivery and requires a new authorized delivery.
- Given customer quote delivery and every terminal reminder condition, when the quote PDF is stale/invalid, the quote changes after artifact preparation, or the quote is accepted, rejected, withdrawn, superseded, or expired, then no attachment/send/reminder occurs; a valid delivery uses only a private artifact prepared from request-authorized current PDF bytes, rechecks currentness before provider submission, and has no public acceptance link.
- Given successful private-artifact preparation, when quote finalization and outbox enqueue run, then they commit in one database transaction and user-visible delivery state remains queued until provider acceptance; preparation or transaction failure yields recoverable audit evidence without a false finalization or sent claim.

## Spec Change Log

### 2026-09-27 — approved post-completion remediation

- Removed the ineffective `quote.delivery` personal preference row from both channels. The active manifest and registry category remain the outbox and recipient-suppression taxonomy.
- Added a database trigger that rejects new direct or API-backed `quote.delivery` preference writes without deleting existing inert rows. ADR-B011 records the frozen CRM-recipient-hash versus authenticated-user-hash mismatch and the retained unsubscribe/suppression boundary.
- Updated the browser fixture and journeys to assert that both removed controls are absent. Required loopback integration evidence verifies authenticated direct writes are rejected.

## Review Triage Log

### 2026-09-24 — implementation and review-fix batches

- intent_gap: 0
- bad_spec: 0
- patch: 7
- defer: 0
- reject: 0
- addressed_findings:
  - `[patch]` Required the outbox worker to have its private quote artifact before adapter submission, retaining the lease-bound recoverable failure path for an absent artifact.
  - `[patch]` Made successful lease-bound sent persistence consume the matching prepared artifact in the same database transaction.
  - `[patch]` Returned the uniform inactive result for revoked unsubscribe tokens before rate-limit accounting; active token/IP attempts still receive the legitimate limited result.
  - `[patch]` Derived the public limiter input only from one validated `x-vercel-forwarded-for` address, with the fixed `unknown` fallback used by local browser coverage.
  - `[patch]` Removed the rendered but nonfunctional reactivation control after unsubscribe, because the consumed token is revoked.
  - `[patch]` Separated the PDF checksum from the quote-currentness fingerprint and activated executing artifact, preference, worker, token, and browser assertions.
  - `[patch]` Repaired the onboarding organization-number seed and the accepted-record/job source fixtures so their valid lifecycle setup satisfies the activated recipient-selection contract.

Review caveat: the bounded cross-model reviewer command exited `1` with no output. It is unavailable review evidence, not a clean external review result. Triage contains only production-reachable findings.

### 2026-09-24 — follow-up review pass

- intent_gap: 0
- bad_spec: 0
- patch: 4 (high 3, low 1)
- defer: 2 (medium 2)
- reject: 5 (low 5)
- addressed_findings:
  - `[high] [patch]` Preserved non-quote email delivery by returning claim category and requiring a private artifact only for `quote.delivery`.
  - `[high] [patch]` Made the sent transition lock and consume the exact prepared quote artifact before committing the `sent` event.
  - `[high] [patch]` Removed anonymous token reactivation; the retained compatibility parameter always creates or preserves suppression.
  - `[low] [patch]` Added an altered-checksum rejection assertion after successful quote-currentness validation.

Deferred: the frontmatter records the two medium findings from this pass: idempotent provider submission after accepted submission but failed outcome persistence, and a scoped unsubscribe URL in every non-essential real provider-rendered body. Both require the deferred real-provider contract; sandbox-only delivery remains the authorized Story 13.4 surface.

## Auto Run Result

Status: done

Follow-up review summary: Corrected quote-only artifact gating, atomic artifact consumption, anonymous unsubscribe reactivation, and checksum coverage.

Follow-up review findings: 4 patches applied (3 high, 1 low; score 10), 2 deferred real-provider concerns, and 5 rejected findings. `followup_review_recommended: true`.

Follow-up verification: `pnpm run typecheck` passed. `supabase db reset --local --yes` completed on the existing local test stack. `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/email/email-delivery-activation.atdd.int.test.ts tests/integration/rls/email-unsubscribe.atdd.rls.test.ts tests/integration/email/quote-delivery-attachment.atdd.int.test.ts` passed 3 files / 12 tests / 0 skips. The external cross-model review command printed no output, so that layer is unavailable evidence.

Summary: Activated sandbox-only email delivery with a private quote-delivery artifact, immutable recipient evidence, server-authorized email preferences, and the narrow public unsubscribe capability. Real-recipient delivery remains disabled pending the separate ADR-B011 owner go-live record.

Review findings: 7 production-reachable patches; 0 intent gaps, bad-spec loopbacks, deferrals, or rejected findings. The patch score is at least 10 under the workflow (three medium-equivalent or greater corrections plus supporting patches), so `followup_review_recommended: true`.

Verification: clean local reset completed. Required serialized Vitest with `SUPABASE_TEST_REQUIRED=1` passed 119 files / 1 skipped file and 1,181 tests / 1 skipped test. `pnpm run typecheck` passed. `pnpm run lint` completed with 0 errors and 13 existing warnings. Unit tests passed 1,894 / 1 skipped. The E2E production build passed. Final Playwright passed 173 / 4 explicit skips / 0 failures (177 discovered).

Integration skip: `tests/integration/ops/recovery-storage-immutability.int.test.ts` is explicitly skipped because `ISOLATED_RECOVERY_STORAGE_PROOF=1` and its separate recovery-stack URL, service key, fixture, and before-row inputs were not provided; it is a CI-only physical recovery-storage proof, not Story 13.4 coverage.

Residual review caveat: the bounded cross-model reviewer command exited `1` with no output, so that review layer is unavailable. The provider evidence uses a synthetic sandbox adapter and does not prove an external provider or production sender configuration.
## Historical E2E Context Halt Evidence

Status: blocked

Blocking condition: implementation verification failed — browser evidence cannot run because the managed production-mode E2E server could not be started: the resource guard returned `HOOK_CONTEXT_UNAVAILABLE` (`The explicit subagent lifecycle context is not registered.`), and no server is listening on `127.0.0.1:3100`. Typecheck, lint, unit tests, clean local migration reset, and required serialized integration/RLS verification passed.

**Resolved 2026-09-24:** An authorized production Next.js server is now running under the trusted resource guard at `http://127.0.0.1:3100`; HTTP 200 is confirmed. Resume browser verification with that guarded server.

## Historical Migration Reset Halt Evidence

Status: blocked

Blocking condition: implementation verification failed — `supabase db reset --local --yes` stops at existing migration `20260919192439_provisioning_rpc_attestation_coherence.sql` with `ERROR: provisioning RPC attestation gate is absent (SQLSTATE P0001)`. The required local integration/RLS and browser verification cannot run against the migrated schema until that prior migration-chain failure is repaired.

**Resolved 2026-09-24:** Historical provisioning migration replay is repaired and committed. A full reset now reaches Story 13.4 migration `20260924090000_email_sending_activation.sql`, then fails because `notification_preferences_check` is missing. This is an implementation bug for the build delegate to fix, not an owner decision; resume Phase 5 implementation.

## Historical Phase 5 Halt Evidence

Status: blocked
Blocking condition: durable quote-delivery worker needs an ADR-B008/B011-approved authorized PDF attachment broker and immutable recipient snapshot semantics. The sole jobs runner has service-role access, while current PDF bytes require a request-bound authenticated RLS client and a non-persistable short-lived attestation; the current quote snapshot has no immutable recipient email. Implementing the producer would otherwise require prohibited service-role Storage access, persisted attestation, or a second execution lane.

Implemented foundation: fail-closed synthetic sandbox provider adapter, leased sent-outcome persistence, notification preference suppression, token-hashed public unsubscribe capability, manifest/H4 enrollment, and static/targeted contract coverage.

Verification: `pnpm run typecheck`, `pnpm run lint`, `node scripts/verify/check-service-role-containment.mjs`, targeted provider/containment tests (4 passed), targeted quote attachment/reminder tests (3 passed), and `node scripts/verify/check-review-order.mjs` passed. Required Supabase delivery/RLS evidence skipped because the local services are stopped; no E2E run completed.

### Owner decision and recovery

**Resolved 2026-09-24:** The owner approved ADR-B011's Option-A delivery contract. The request-authenticated quote-send path validates the current PDF under ADR-B008, creates a distinct private durable artifact bound to the tenant, quote version, and outbox record, then atomically finalizes the quote and enqueues delivery. The worker has narrowly scoped read access only to that artifact; it rechecks current quote version, fingerprint, and sending eligibility before provider submission. The ADR-B008 attestation remains non-persistable. The sender confirms an existing linked customer/contact email at send time; normalized recipient and source are frozen, while recipient changes cancel and reissue delivery. Outbox state remains the truthful email state. Real-recipient release remains closed pending ADR-B011's separate go-live record.

This replaces the historical blocking condition above as the active implementation direction. Resume at Phase 5 with the artifact storage/schema and narrow worker-access design; do not reopen a broad source-PDF broker, a second execution lane, persisted attestation, or elevated Storage access.

## Design Notes

The transport adapter is intentionally provider-agnostic. Release control is evaluated by the server immediately before submission, so a deployment setting cannot turn a queued real-recipient item into a send without the ADR-B011 owner record. The outbox stores only the server-side delivery data required to make that decision and never widens the existing Admin read model.

Quote delivery is a separate bounded artifact contract: request-bound ADR-B008 verification is completed before private artifact preparation, and its HMAC proof is never persisted. The worker reads only the resulting tenant/quote-version/outbox-bound artifact, then independently rejects any no-longer-current or ineligible quote. The selected linked customer/contact recipient is normalized and frozen with the delivery record, so delivery outcomes stay truthful even if CRM data later changes.

Unsubscribe is a separate public capability: the URL carries the only plaintext token, database lookup uses its SHA-256 hash, and the route derives scope solely from the resolved token. This keeps it outside the authenticated app boundary while preserving a narrow, auditable re-subscribe path.

## Verification

**Commands:**
- `pnpm run typecheck` -- expected: no TypeScript errors.
- `pnpm run lint` -- expected: no lint errors.
- `pnpm run test:unit` -- expected: provider, release-control, preference, unsubscribe, and containment unit coverage passes.
- `SUPABASE_TEST_REQUIRED=1 pnpm run test:integration` -- expected: migration, RLS, queue concurrency, token, and quote-PDF integration suites execute with no required skips or failures.
- `pnpm run test:e2e` -- expected: authenticated preference/Admin visibility and public-shell flows pass where their configured browser coverage applies.

## Final Convergence Disposition

The 2026-09-27 convergence check was limited to the remediated Story 13.4 boundaries: personal preference eligibility, linked-recipient correction, terminal-state revalidation, PDF challenge authority, finalization recovery authority, recovery-evidence provenance, and Node/PostgreSQL HMAC parity. It found and fixed a recovery-role mismatch, direct same-tenant recovery forgery, uppercase UUID canonicalization mismatch, and a remaining PDF challenge/private-verifier mismatch that denied valid project-manager and salesperson send commands. `f226415` aligns only those two private send-attestation functions with the exact `Quotes.Send` role set and adds the existing server-only quote-PDF broker for roles without raw Storage access. Exact-head CI then showed the broker had become unconditional, making ordinary Administrator send paths depend on a service credential absent from the normal integration command context. `d770780` restores the request-bound exact-object read for actors who already have it and uses the broker only after a classified RLS denial on the database-issued path. The older reviewer/financial authority remains unchanged, and raw Säljare Storage access, arbitrary files, transient failures, corrupt bytes, and cross-tenant artifacts remain denied. Recovery still requires the short-lived server HMAC rooted in the existing quote-PDF Vault secret with exact actor, tenant, target, and role checks. No consequential Story 13.4 defect remains after those corrections, subject to the exact-head CI receipt recorded in the convergence artifact.

## Suggested Review Order

Author: Story 13.4 implementation and final-convergence fix author.
Refreshed against code head `d770780` after recovery-role alignment, recovery-evidence attestation, UUID canonicalization, exact `Quotes.Send` PDF-challenge alignment, request-bound/broker read repair, and durable runner checkpoint convergence.

### Closed synthetic delivery and suppression

- `src/server/email/provider.ts:11` — `evaluateEmailReleaseControl`: admits only the synthetic sandbox posture; real-recipient release still requires its separate ADR-B011 record.
- `src/server/email/outbox.ts:93` — `processEmailOutbox`: applies suppression before release evaluation and any claim/provider work.
- `src/app/api/jobs/run/route.ts:96` — keeps processing on the sole authenticated jobs lane with the normal release posture closed.
- `supabase/migrations/20260924120000_email_delivery_followup_fixes.sql:49` — hashes/resolves public tokens into one-way recipient/category suppression.
- `tests/integration/email/email-delivery-activation.atdd.int.test.ts` — proves sandbox success, closed release, suppression, artifact consumption, and final claimed-delivery terminal recheck.

### Personal preference eligibility

- `src/server/notifications/registry.ts:26` — retains `quote.delivery` as live outbox metadata but excludes it from personal preferences because the frozen CRM recipient is not the authenticated user identity.
- `src/app/api/notifications/preferences/route.ts:10` and `src/components/notifications/NotificationPreferences.tsx:6` — filter the API and UI to preference-eligible categories.
- `supabase/migrations/20260927100000_remove_quote_delivery_preferences.sql:5` — rejects new direct inserts/updates for `quote.delivery` while leaving retained legacy rows inert.
- `tests/integration/notifications/notifications.atdd.int.test.ts:126` and `tests/e2e/notifications/email-preferences-email-activation.atdd.e2e.spec.ts:13` — prove direct rejection and absence of both ineffective switches.

### Linked recipient, correction, and delivery identity

- `src/components/quotes/MarkSentButton.tsx` and `src/server/commands/quotes/validation.ts:252` — require one existing linked customer/contact source, never accept a freeform address, and canonicalize case-insensitive UUID input before signing.
- `supabase/migrations/20260924110000_quote_email_delivery_artifacts.sql:90` — freezes the normalized linked recipient, private PDF artifact, quote finalization, and sequence-1 enqueue in one transaction.
- `supabase/migrations/20260924130000_quote_delivery_recipient_correction.sql:96` — locks only a queued delivery, cancels it, invalidates the old artifact, and atomically creates an audited next-sequence delivery for the replacement source.
- `tests/integration/email/quote-delivery-recipient-snapshot.int.test.ts` — proves uppercase UUID command success, CRM-edit immunity, tenant/source validation, queued-only cancellation/reissue, fresh sequence/artifact state, and project-manager/sales authority through `Quotes.Send`.

### Attachment and terminal revalidation

- `src/server/email/outbox.ts:58` — reads only the artifact bound to the active tenant/worker claim and verifies its bytes.
- `src/server/commands/quotes/mark-sent.ts:197` — `prepare_quote_pdf_send_attestation`: prepares the exact current PDF challenge before the command prefers the caller's request-bound exact-object read, falls back to the existing server-only broker only for a classified RLS denial on that database-issued path, verifies downloaded bytes, and commits through the private verifier.
- `supabase/migrations/20260927130000_quote_delivery_pdf_send_roles.sql:6` — aligns only the challenge and private verifier with `tenant_admin`, `projektledare`, and `saljare`; fixed search paths and restrictive grants remain, while the older reviewer/financial gate is untouched.
- `supabase/migrations/20260924110000_quote_email_delivery_artifacts.sql:71` — `validate_claimed_quote_email_delivery`: rechecks current sent status, fingerprint, artifact, tenant, worker, and lease immediately before submission.
- `tests/integration/email/quote-delivery-attachment.atdd.int.test.ts` — covers current/private/no-public-link and stale/missing/checksum rejection.
- `tests/integration/email/email-delivery-activation.atdd.int.test.ts:100` — makes an already claimed quote terminal at the last validation boundary and proves no adapter call.
- `tests/integration/notifications/notifications.atdd.int.test.ts:55` — independently covers accepted, rejected, lost/withdrawn, superseded, and expired reminder states.

### Durable, attributable recovery evidence

- `src/server/commands/quotes/mark-sent.ts:79` — records recovery only after a command failure and preserves the originating error if evidence persistence also fails.
- `src/server/email/recovery-attestation.ts` — binds tenant, actor, quote version, correlation, stage, root fingerprint, and five-minute window to a separate HMAC domain/subkey; it reuses the approved quote-PDF root and is server-only.
- `supabase/migrations/20260925100000_quote_email_delivery_recovery.sql:5` — defines the isolated append-only tenant recovery ledger.
- `supabase/migrations/20260927110000_quote_delivery_recovery_sender_roles.sql:4` — aligns the recorder with the exact `Quotes.Send` role set while retaining actor/tenant checks.
- `supabase/migrations/20260927120000_attest_quote_delivery_recoveries.sql:6` — revokes and drops the forgeable five-argument endpoint; `:68` installs the attested signature with fixed search path, target scope, exact role set, time window, and server/Vault verification.
- `tests/unit/server/email/recovery-attestation.test.ts` — proves every provenance field is signed and that malformed PDF key-id failure can still use the existing root.
- `tests/integration/email/quote-delivery-finalization-failure.int.test.ts` — proves atomic rollback, orphaned/invalidated evidence, actor/cross-tenant/direct-forgery denial, and the real send-command recovery path for tenant admin, project manager, and sales actors.
- `tests/integration/commands/quote-pdf-validity.int.test.ts` — proves a salesperson can generate only through the attested reserved-PDF path while raw list/download/sign, general files, direct hardened predicate calls, arbitrary uploads, and cross-tenant broker use stay denied.

### Evidence and limits

Base Epic 13 CI run `36339205329` passed 1,896 unit tests with zero skips, 1,205 required database tests with one separately executed recovery skip, and 172 browser tests with four explicit skips. On the final local source ending at `d770780`, focused unit coverage passed 32/32; the normal Administrator mark-sent dependent suite passed 14/14; the required recovery/finalization integration file passed 5/5 with zero skips; the focused salesperson reserved-PDF/raw-storage denial case passed; changed-file ESLint, TypeScript, service-role containment, and diff checks passed. Exact-head migration/reset and full CI evidence is recorded in `docs/quality/epic-13-convergence-review-2026-09-27.md`.

Real-recipient sending, production provider credentials/sender identity, provider-side idempotency after acceptance, and provider-rendered unsubscribe URLs remain separately gated or deferred. The attestation is not persisted or returned to the browser, and it grants no quote, artifact, or delivery authority.

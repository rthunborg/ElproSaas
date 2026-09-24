---
title: 'Email Sending Activation'
type: 'feature'
created: '2026-09-24'
status: 'blocked'
baseline_revision: '8c3b1c600e43584ffd1bf5f6d86ceccccb65f981'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - 'docs/decisions/ADR-B011-epic-13-email-release-and-quote-delivery.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - 'docs/process/review-order.md'
warnings: [oversized]
deferred:
  - 'Real-recipient delivery remains disabled until the separate ADR-B011 owner go-live record is approved.'
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

## Review Triage Log

## Auto Run Result

Status: blocked

Blocking condition: implementation verification failed — `supabase db reset --local --yes` stops at existing migration `20260919192439_provisioning_rpc_attestation_coherence.sql` with `ERROR: provisioning RPC attestation gate is absent (SQLSTATE P0001)`. The required local integration/RLS and browser verification cannot run against the migrated schema until that prior migration-chain failure is repaired.

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

## Suggested Review Order

Author: implementation author.
Refreshed against the current uncommitted working tree based on `8c3b1c600e43584ffd1bf5f6d86ceccccb65f981`.

### Fail-closed delivery release control

The adapter accepts only synthetic envelopes. The separate ADR-B011 owner go-live record remains outside this code, so every other release posture is closed before a claim can call the adapter.

- `src/server/email/provider.ts:11` — `evaluateEmailReleaseControl`: only the sandbox posture is admitted.
- `src/server/email/outbox.ts:91` — `processEmailOutbox`: applies suppression before release evaluation and records a lease-bound sent result.
- `src/app/api/jobs/run/route.ts:91` — `notifications.email-outbox-delivery`: preserves the sole authenticated runner lane.
- `supabase/migrations/20260924090000_email_sending_activation.sql:26` — `record_email_outbox_delivery`: requires the active worker claim before state becomes `sent`.

### Narrow public unsubscribe capability

The public route supplies only a token and IP-derived hash to the database function. The function returns generic inactive or rate-limit outcomes and never returns tenant, recipient, or token data.

- `src/app/(public)/unsubscribe/[token]/route.ts:10` — `GET`: serves a standalone public form without an authenticated shell.
- `src/server/email/unsubscribe.ts:25` — `handleUnsubscribeRequest`: hashes the plaintext token before the RPC boundary.
- `supabase/migrations/20260924090000_email_sending_activation.sql:42` — `consume_email_unsubscribe_token`: scopes suppression to the resolved token record.

### Quote attachment and reminder eligibility

The quote delivery seam accepts bytes only from a caller that has already resolved the current authorized PDF. It rejects stale, invalid, and absent inputs before adapter submission; terminal reminder states are ineligible.

- `src/server/email/outbox.ts:122` — `processQuoteDelivery`: validates the PDF before constructing a server-only attachment.
- `tests/integration/email/quote-delivery-attachment.atdd.int.test.ts:9` — `[P0][13.4-INT-004]`: exercises current-PDF-only attachment behavior.

### Private quote delivery artifact

ADR-B011 requires a delivery worker to receive an exact private copy, rather than original quote-file authority. The worker path therefore rejects a missing, changed, cross-tenant, or no-longer-current artifact before provider submission.

- `src/server/email/quote-delivery.ts:20` — `normalizeQuoteDeliveryRecipient`: normalizes the selected linked recipient before it can be frozen in delivery state.
- `src/server/email/quote-delivery.ts:28` — `assertQuoteDeliveryArtifact`: verifies the content-addressed artifact bytes.
- `src/server/email/outbox.ts:137` — `Quote delivery artifact is required`: fails closed before the adapter is called.
- `supabase/migrations/20260924110000_quote_email_delivery_artifacts.sql:2` — `email_delivery_artifacts`: stores the outbox-bound private artifact and revokes direct table access.
- `supabase/migrations/20260924110000_quote_email_delivery_artifacts.sql:41` — `read_claimed_email_delivery_artifact`: limits worker reads to its active claim.
- `src/server/commands/quotes/mark-sent.ts:213` — `finalize_quote_email_delivery`: atomically finalizes the quote and queues the prepared delivery.
- `supabase/migrations/20260924110000_quote_email_delivery_artifacts.sql:54` — `validate_claimed_quote_email_delivery`: rechecks the claimed artifact against the current sent quote before submission.

### Confirmed CRM recipient and transaction boundary

The quote form loads only linked customer/contact candidates and requires a selection before it can submit. The authenticated command passes the verified PDF bytes and selected source to one RPC, which validates the current linked address, freezes its normalized value, creates the artifact, and performs the lifecycle transition and queue insert together.

- `src/components/quotes/MarkSentButton.tsx:39` — `delivery-recipients`: loads the scoped candidate list for the draft version.
- `src/components/quotes/MarkSentButton.tsx:81` — `recipient_source_type`: submits the selected source only, never a freeform recipient address.
- `src/server/commands/quotes/mark-sent.ts:213` — `finalize_quote_email_delivery`: takes the atomic delivery path after ADR-B008 byte verification.
- `supabase/migrations/20260924110000_quote_email_delivery_artifacts.sql:73` — `finalize_quote_email_delivery`: validates the linked address and commits artifact, finalization, and queue state.
- `tests/unit/server/commands/mark-quote-version-sent-validation.test.ts:69` — `[13.4]`: proves complete linked-recipient selections are shaped and partial selections are rejected.

### Evidence and limits

AC1 closed-gate/sandbox adapter behavior → `tests/unit/server/email/provider.atdd.test.ts:9` and `:30`. Public-shell containment → `tests/unit/scripts/verify/email-delivery-containment.atdd.test.ts:9` and `:17`. The current private-artifact and terminal reminder invariants → `tests/integration/email/quote-delivery-attachment.atdd.int.test.ts:9`, `:29`, and `:38`.

Evidence: `pnpm run typecheck`, `pnpm run lint` (0 errors), `pnpm run test:unit` (1893 passed, 1 pre-existing skip), `node scripts/verify/check-service-role-containment.mjs`, the provider/quote attachment Vitest selection (4 tests), and the mark-sent validation test (12 tests) passed. Required Supabase integration/RLS evidence and browser coverage were not run in this pass.
Limits: required local Supabase evidence is still outstanding; real-recipient delivery remains closed pending the ADR-B011 owner go-live record. The tested provider boundary is synthetic, so it does not prove production sender configuration or an external provider response.

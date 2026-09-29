# Epic 13 Independent Luna/Xhigh Convergence Review — 2026-09-27

## Review contract

Base convergence review: `46d9b67b6312ad6672b07d3cdc62db3136b8222c`. Latest narrow regression re-review: `d7707802d12a0180c540d7452f5484cbc071d630` on `epic/13-wave-b1a-notifications-and-email-infrastructure`. This follow-up reviews only the request-scoped quote-PDF read and constrained broker fallback change; it is not a new broad PR pass. The original four-story convergence dispositions remain as recorded below, with the 13.4 fallback path updated to this exact head.

I independently inspected the current implementation and remediation diffs, relevant migrations, and test sources. I made no code or spec changes and did not run tests or start services.

## Per-story disposition

| Story | Disposition | Reviewed invariant |
| --- | --- | --- |
| 13.1 | PASS at source-review level | Runner authorization precedes privileged setup. Active producer work is page-bounded, abortable, resumable per tenant/producer, and preserves the input checkpoint when a producer fails; runner cursors preserve later-tenant progress. The active registry remains manifest-derived. |
| 13.2 | PASS | Notification reads and acknowledgements are tenant and recipient scoped. `quote.delivery` remains active delivery metadata but is excluded from effective personal-preference eligibility; API and database guards prevent restoring the ineffective control. |
| 13.3 | PASS | Enqueue retries remain deduplicated; suppression runs before release/claim/artifact/provider work; claim and state transitions remain tenant-, worker-, and lease-bound. |
| 13.4 | PASS at source-review level | Only a valid linked recipient is frozen. Queued correction cancels/reissues on a new sequence; claimed delivery rechecks quote/artifact validity. PDF and recovery attestation enforce exact `Quotes.Send` authority and server provenance; recovery remains append-only. |

No serious production-reachable defect remains in these narrowed boundaries at this source head.

## Remediation intersections rechecked

### 13.1 bounded runner and retained failure checkpoint

`src/app/api/jobs/run/route.ts` authenticates before creating the jobs client, supplies a 45-second internal deadline and an abort signal, and loads the latest per-tenant producer row as cursor authority only when it is `partial` or `failed` and has a string cursor. The producer work in `src/server/notifications/follow-up-producer.ts` bounds due follow-ups and memberships to pages of 25 plus one lookahead, limits status checks to the candidate page, bounds preference lookup and notification batches, and propagates abort to reads and writes. The route's registered email producer also stays closed to real sending and is constrained by its bounded outbox claim.

The `46d9b67` repair closes the later-page retry loss: `runDueProducers` retains the cursor loaded before execution and records it with a `failed` producer row if page execution fails. The route treats that newest failed cursor as retry authority. Migration `20260927140000_preserve_failed_job_checkpoints.sql` permits an optional cursor on failed rows, requires one on partial rows, and disallows one on running/completed rows; therefore completed remains the clearing outcome. The changed unit sources cover same-tenant checkpoint retry after a later-page failure and continued later-tenant work; the route unit covers failed-row cursor loading, and the integration source checks the catalog constraint.

The earlier unbounded active follow-up traversal was addressed in `f226415`: stable follow-up and membership cursors, bounded pages and writes, deadline/abort handling, and later-tenant turns. At the reviewed head, the runner's deadline is checked between producers and the signal reaches the potentially multi-query follow-up producer. Numeric production latency, backlog, capacity and fairness targets remain operating contracts, not claims made by the internal budget.

### 13.2 and 13.3 isolation and state boundaries

The notification registry and preferences route use the active category projection; preference reads and writes include the authenticated tenant and user, and database RLS/trigger protections remain in place. The removal migration excludes `quote.delivery` from personal preference writes while leaving delivery and recipient-scoped suppression intact.

The outbox implementation and migrations preserve unique delivery identity across ordinary retries, allow a fresh delivery sequence only for queued recipient correction, evaluate suppression before claim and content/provider work, and scope worker mutation to tenant and lease. The delivery worker revalidates quote terminal status and the immutable artifact immediately before submission. I found no current bypass in the reviewed callers or wrappers.

### 13.4 attestation, sender-role, broker and recovery boundaries

The prior direct-recovery-RPC forgery is closed: `20260927120000_attest_quote_delivery_recoveries.sql` drops/revokes the old five-argument recorder and verifies a short-lived, domain-separated signature derived from the existing quote-PDF HMAC root. Node and SQL bind the same tenant, actor, quote version, correlation, stage, fingerprint and canonical time fields; SQL resolves the Vault root by fingerprint and independently verifies authenticated actor equality, tenant membership, exact `tenant_admin` / `projektledare` / `saljare` `Quotes.Send` roles and quote ownership. Helpers are not executable by application roles, no new credential or service-role RPC path is introduced, and recovery rows remain append-only. UUID validation canonicalizes accepted quote-version and recipient IDs before either HMAC boundary. The malformed PDF key-ID failure remains recordable through the recovery key derived independently from that key ID.

Migration `20260927130000_quote_delivery_pdf_send_roles.sql` changes only the prepare/private quote-PDF send-attestation functions to the exact `Quotes.Send` role set. The prepare RPC is granted only to authenticated callers; the private verifier has no application-role execute grant; both are security-definer functions with an empty search path. The existing review/financial authority helper and gates are unchanged. At `d770780`, `mark-sent.ts` first downloads only the bucket and object path returned by the authenticated database challenge through the request-bound client. It invokes the existing server-only `signValidatedQuotePdfForAccess` broker only when that read returns a classified 401/403 or Storage-concealed 404. Missing or unclassified responses, transient/network failures, and all other errors fail without elevated retry. The broker's signed URL is checked against the challenge bucket/path and expiry, then bytes from either path are checked against immutable size and SHA-256 before finalization. A deletion race still fails when broker signing or fetch cannot retrieve the challenged object. No caller-supplied arbitrary path, cross-tenant target, generic file signing, raw Säljare Storage access, secret exposure, or browser service-role path was found in this flow. The focused integration test source exercises sender-role finalization failures, spoofed actor/tenant and invalid-signature denial, malformed PDF key-ID recovery, and original-command failure preservation; the reserved-PDF coverage exercises raw Storage and arbitrary/cross-tenant denials.

The `d770780` repair also preserves ordinary Admin/project-manager mark-sent behavior when no global service-role key is configured: actors who already have exact raw Storage access complete via the request-bound read and never invoke the broker. A salesperson's concealed denial can use the same existing broker only for the challenged object. Parent-reported focused checks cover the legacy accept/create-job suite, AC8 finalization/recovery, and salesperson reserved-PDF plus raw/general/arbitrary/cross-tenant denials. I inspected the changed path and relevant test sources but did not independently execute those checks.

## Verified sources and evidence limits

- 13.1: `src/app/api/jobs/run/route.ts`, `src/server/jobs/auth.ts`, `src/server/jobs/runner.ts`, `src/server/jobs/producers.ts`, `src/server/notifications/follow-up-producer.ts`; migration `20260927140000_preserve_failed_job_checkpoints.sql`; tests `tests/unit/server/jobs/route-auth.test.ts`, `route.test.ts`, `runner.test.ts`, `producer-registry.test.ts`, and `tests/integration/jobs/job-runs.int.test.ts`.
- 13.2: notification registry, preferences route/UI, `20260923170000_in_app_notifications.sql`, `20260927100000_remove_quote_delivery_preferences.sql`; notification and outbox RLS integration sources.
- 13.3: `src/server/email/outbox.ts` and the email outbox/state/correction migrations; outbox and RLS integration sources.
- 13.4: `src/server/commands/quotes/mark-sent.ts`, send validation, `src/server/quote-pdf/attestation.ts`, `src/server/email/recovery-attestation.ts`, `src/server/storage/quote-pdf-signer.ts`; migrations `20260927110000_quote_delivery_recovery_sender_roles.sql`, `20260927120000_attest_quote_delivery_recoveries.sql`, `20260927130000_quote_delivery_pdf_send_roles.sql`; unit and `tests/integration/email/quote-delivery-finalization-failure.int.test.ts` sources.

Recorded CI run `36339205329` passed at `83da25f` (1,896 unit; 1,205 required DB/RLS with one isolated recovery-storage skip; separate recovery-storage proof 1/1; E2E 172 with four explicit skips). That run predates the recovery HMAC, UUID, sender-role, broker, runner deadline and checkpoint changes, so it is not exact-head verification. The parent convergence record reports focused tests at `46d9b67`, and the parent reports focused regression checks after `d770780`; this leaf inspected the changed path and relevant test sources but did not independently execute or validate those results. Exact-head full CI remains a separate evidence gate. No historical external whole-epic cross-model review is claimed here.

This source review does not establish production operating readiness or authorize real-recipient sending. Deployment/scheduler evidence, provider identity and credentials, provider-side acceptance idempotency, provider-rendered unsubscribe behavior, numeric throughput/fairness targets, and recovery/retention objectives remain separate owner or deployment gates.

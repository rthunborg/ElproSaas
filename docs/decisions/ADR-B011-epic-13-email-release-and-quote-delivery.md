# ADR-B011: Epic 13 Email Release and Quote Delivery

Status: decided for implementation — 2026-09-23; owner amendments recorded 2026-09-24. Real-recipient email go-live remains separately owner-gated.

Scope: Epic 13, especially Story 13.4. N-6's central sender identity, tenant Reply-To, flow priority, reminder-stop rules, and delivery logging remain in force. This decision reconciles the implementation sequence with Phase B's public-surface and customer online-acceptance exclusions.

## Decision

Epic 13 includes all four stories. Story 13.4 implements the provider adapter and eligible sending paths, proves queued-to-sent behavior and provider outcomes with a sandbox or mock, and leaves real-recipient delivery disabled by default in every deployment, including preview, behind a fail-closed server-side release control. Missing or invalid release configuration makes no real-provider call. Sandbox tests use isolated test configuration and synthetic recipients. A completed story, merged PR, configured provider, or passing test does not itself authorize live delivery. A separate recorded owner go-live decision must identify the exact deployment, verified central sender domain and address, provider configuration, and first enabled flows before any real recipient receives mail. Production secrets stay outside the repository and browser paths.

Only producers belonging to active scope-manifest modules may send. Eligible flows retain N-6's priority order; producers for later modules enter with those modules' activation stories. Existing Supabase Auth invitation and security mail remains its sanctioned path until a deliberate handoff prevents duplicate sends. No invoice or marketing sending path is introduced.

For Phase B customer quote mail, attach the current valid snapshot-derived quote PDF. Do not add a public quote-view URL, customer login, online acceptance/rejection link, or fourth anonymous surface. Authenticated internal notifications may carry app deep links. This replaces only the online-link clause of N-6's quote-flow example; customer online acceptance remains in Phase C.

### Quote-delivery contract — IN

The authorized quote-send request validates the current PDF under ADR-B008, then creates a distinct private durable delivery artifact bound to the tenant, quote version, and email outbox record. The sole queue worker may read only that delivery artifact. It must never receive general access to original quote PDFs, generic quote-file access, or a public link. The ADR-B008 HMAC byte attestation remains request-bound and must never be persisted in the delivery record or artifact.

Before provider submission, the worker revalidates that the quote version, content fingerprint, and sending eligibility remain current. An invalidated, stale, or ineligible quote cannot be delivered. The delivery artifact needs tenant isolation, narrowly scoped worker access, audit evidence, and a lifecycle policy. Its storage mechanism, schema, and retention mechanics remain engineering design work; this decision does not authorize broad service-role or elevated Storage access. If those requirements cannot be met without such broad access, Story 13.4 remains blocked and must not substitute a worker PDF broker without a further owner decision.

The authorized sender selects and confirms an existing email address from the quote's linked customer or contact at send time. Enqueue fails when the selected address is absent or invalid. The normalized recipient address and its selected source are frozen in the delivery record. Retries and reminders use that fixed record; a CRM edit must not redirect queued mail. Changing the recipient cancels the pending delivery and requires a new authorized, audited delivery.

After the private delivery artifact is prepared, quote finalization and email enqueue occur in one database transaction. The Storage upload itself is not part of that transaction. Preparation or transaction failure must fail closed and leave a recoverable, auditable orphan/recovery path rather than claiming cross-system atomicity. The quote lifecycle records internal finalization; the outbox and delivery log exclusively record whether mail is queued, sent, failed, or suppressed. User-facing copy must not say that an email was sent until the provider has accepted it.

The ADR-B004 unsubscribe route and its abuse tests may land with Story 13.4 as the sanctioned public email surface. The email preference control becomes actionable only where sending is enabled; otherwise it explains that delivery is unavailable. Queued mail must remain queued, not appear sent, while real delivery is disabled.

## Go-live boundary

The later go-live record must confirm domain authentication, the exact From and tenant Reply-To behavior, provider and secret rollout, enabled flow list, unsubscribe and suppression behavior, sandbox evidence, observed delivery and rollback/disable steps. It must separately authorize real-recipient delivery. The Epic 13 code review and Auto-BMAD completion are implementation evidence, not that authorization.

## Engineering details still open

- The delivery artifact's private storage representation and cleanup implementation must satisfy the contract above and ADR-B008's deferred retention boundary; this ADR sets no retention period or deletion workflow.
- The precise validation and audit implementation must use the existing linked customer/contact model. This ADR does not grant new role permissions or a separately typed recipient-selection path.

## References

- [Phase B architecture §4.5–4.6](../../_bmad-output/planning-artifacts/architecture-phase-b.md)
- [Epic 13 Story 13.4](../../_bmad-output/planning-artifacts/epics-phase-b.md)
- [ADR-B008 quote artifact validity](ADR-B008-quote-review-authority-and-derived-artifact-validity.md)
- [Phase B scope exclusions](../../AGENTS.md)

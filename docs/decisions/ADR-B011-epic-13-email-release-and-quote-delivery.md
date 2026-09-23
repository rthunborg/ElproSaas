# ADR-B011: Epic 13 Email Release and Quote Delivery

Status: decided for implementation — 2026-09-23. Real-recipient email go-live remains separately owner-gated.

Scope: Epic 13, especially Story 13.4. N-6's central sender identity, tenant Reply-To, flow priority, reminder-stop rules, and delivery logging remain in force. This decision reconciles the implementation sequence with Phase B's public-surface and customer online-acceptance exclusions.

## Decision

Epic 13 includes all four stories. Story 13.4 implements the provider adapter and eligible sending paths, proves queued-to-sent behavior and provider outcomes with a sandbox or mock, and leaves real-recipient delivery disabled by default in every deployment, including preview, behind a fail-closed server-side release control. Missing or invalid release configuration makes no real-provider call. Sandbox tests use isolated test configuration and synthetic recipients. A completed story, merged PR, configured provider, or passing test does not itself authorize live delivery. A separate recorded owner go-live decision must identify the exact deployment, verified central sender domain and address, provider configuration, and first enabled flows before any real recipient receives mail. Production secrets stay outside the repository and browser paths.

Only producers belonging to active scope-manifest modules may send. Eligible flows retain N-6's priority order; producers for later modules enter with those modules' activation stories. Existing Supabase Auth invitation and security mail remains its sanctioned path until a deliberate handoff prevents duplicate sends. No invoice or marketing sending path is introduced.

For Phase B customer quote mail, attach the current valid snapshot-derived quote PDF. Do not add a public quote-view URL, customer login, online acceptance/rejection link, or fourth anonymous surface. Authenticated internal notifications may carry app deep links. This replaces only the online-link clause of N-6's quote-flow example; customer online acceptance remains in Phase C. Quote attachment selection, byte access, and send validity must follow ADR-B008 without a service-role or elevated Storage bypass; an invalidated or stale PDF cannot be sent.

The ADR-B004 unsubscribe route and its abuse tests may land with Story 13.4 as the sanctioned public email surface. The email preference control becomes actionable only where sending is enabled; otherwise it explains that delivery is unavailable. Queued mail must remain queued, not appear sent, while real delivery is disabled.

## Go-live boundary

The later go-live record must confirm domain authentication, the exact From and tenant Reply-To behavior, provider and secret rollout, enabled flow list, unsubscribe and suppression behavior, sandbox evidence, observed delivery and rollback/disable steps. It must separately authorize real-recipient delivery. The Epic 13 code review and Auto-BMAD completion are implementation evidence, not that authorization.

## References

- [Phase B architecture §4.5–4.6](../../_bmad-output/planning-artifacts/architecture-phase-b.md)
- [Epic 13 Story 13.4](../../_bmad-output/planning-artifacts/epics-phase-b.md)
- [ADR-B008 quote artifact validity](ADR-B008-quote-review-authority-and-derived-artifact-validity.md)
- [Phase B scope exclusions](../../AGENTS.md)

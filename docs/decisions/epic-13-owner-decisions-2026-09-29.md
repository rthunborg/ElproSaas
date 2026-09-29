# Epic 13 Owner Decisions — 2026-09-29

## Recorded approval

The owner approved merge commit `78019af39d80627a14e11802ac5dafacd37ac9b5`, merged at 2026-09-29T07:37:01Z with parents `0b4e37e` and `29880f1`.

The owner also approved a controlled hosted rollout with real-recipient email disabled and at least 24 hours of observation. This records authorization to merge and conduct the closed rollout. It does not claim that deployment, database migrations, a healthy operation, or the 24-hour observation has completed.

## Completed scope summary

Epic 12 completed the internal tenant-provisioning and onboarding scope: Platform Operator Identity and Provision Tenant (12.1), Operator Console (12.2), and First Admin Onboarding Checklist (12.3). Production provisioning remains separately gated by ADR-B010 and its recorded hosted release approval. Self-serve tenant signup remains excluded.

Epic 13 completed the email infrastructure and sandbox-only delivery scope, including the private quote-delivery artifact and the narrow unsubscribe capability. Real-recipient email remains disabled. The existing Supabase Auth invitation and security-email path stays in place.

## Internal pilot targets

The owner adopted these internal targets for the future pilot. They are not measured guarantees and do not establish a customer SLA.

| Area | Target |
| --- | --- |
| Missing successful runner completion | Warn at 15 minutes; escalate at 30 minutes. |
| Runner execution | 95% runtime below 30 seconds; retain the existing approximate 45-second budget. |
| Five-minute producers | Eligible-work freshness no greater than 15 minutes. |
| Hourly reminders | Eligible-work freshness no greater than 75 minutes. |
| Tenant fairness | Meet the same freshness bounds; investigate sustained deferral. |
| Future eligible live-email submission | Submit within 15 minutes, excluding retry and suppression time. |
| Failure and recovery review | Review within one business day. |
| Capacity | Test planned pilot workload and twice the forecast peak. |

No volume forecast, batch size, or support owner has been approved. The observation and seven-day reassessment clocks start from a recorded healthy deployed pilot operation, not from story completion or merge.

## One-tenant quote-email pilot preparation

Prepare a one-tenant quote-email pilot, but do not activate real-recipient delivery without a separate owner approval. For this record, a tenant means one electrical-contractor company workspace, not the tenant's end customers.

Before activation, record the following without committing credentials or customer addresses:

- Exact central From identity and sender-domain evidence; tenant Reply-To remains policy.
- Pilot tenant, approved recipients, expected email volume, and the named operations owner.
- Rough average emails per day and a busy-hour burst estimate.
- Provider and secret rollout evidence, enabled-flow list, suppression and unsubscribe behavior, sandbox evidence, disable or rollback steps, and operational contacts.

Every quote sent to a distinct recipient, and every resend, counts as a separate email for the estimates and pilot controls.

## Retention and maintenance boundary

Retention cleanup remains deferred to E31's central retention-policy workflow. This approval authorizes no arbitrary deletion. Any later executor must follow the existing E31 boundary: tenant-scoped, dry-run-first, legal-hold-aware, idempotent, and audited per object.

A separate local maintenance task has been created and begins with read-only diagnosis. This record does not authorize maintenance changes.

## References

- [ADR-B011: Epic 13 Email Release and Quote Delivery](ADR-B011-epic-13-email-release-and-quote-delivery.md)
- [ADR-B008: Quote Review Authority and Derived-Artifact Validity](ADR-B008-quote-review-authority-and-derived-artifact-validity.md)
- [ADR-B010: Tenant Provisioning Production Enablement](ADR-B010-tenant-provisioning-production-enablement.md)
- [Epic 12 and 13 stories](../../_bmad-output/planning-artifacts/epics-phase-b.md)

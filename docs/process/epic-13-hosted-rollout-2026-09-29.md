# Epic 13 Hosted Rollout — 2026-09-29

Status: **CONTROLLED HOLD — code deployed, database schema not applied, scheduler disabled, observation clocks not started**.

This is the redacted operational record for the owner-approved closed Epic 13 rollout. It does not authorize real-recipient email, tenant provisioning, pilot activation, retention deletion, hosted integration tests, or manual migration-history repair.

## State separation

| State | Result |
| --- | --- |
| Merged code | Complete. GitHub `main` is `78019af39d80627a14e11802ac5dafacd37ac9b5`, merged at `2026-09-29T07:37:01Z`. |
| Deployed code | Complete. Production deployment `dpl_2DAG69cR31WeAVT8CQvF7MFh1Kuj` is `READY`, serves the production aliases, and was rebuilt from original deployment `dpl_DucLcfpDbC4YE7857XB4uSLuMCz6`. Vercel metadata identifies Git SHA `78019af39d80627a14e11802ac5dafacd37ac9b5` on `main`. |
| Applied schema | **Blocked.** `elprosaas-demo` still has 62 migrations through `20260922121240_epic_12_function_execute_acl`; none of the 18 Epic 13 migrations is applied. |
| Scheduled execution | **Paused.** The project-level Vercel Cron Jobs control is disabled. The `/api/jobs/run` definition remains registered at `*/5 * * * *` UTC but cannot run while the control is disabled. |
| Real-recipient email | Disabled. The deployed source has a fail-closed release evaluation and the production runner supplies a closed adapter; no real provider submission path is enabled. |
| Tenant provisioning | Disabled after a bounded corrective change described below. No tenant was provisioned. |
| Healthy observation | **Not started.** A `READY` deployment without the required schema and authentic successful cron evidence is not a healthy start. |
| Seven-day reassessment | **Not started.** It begins only after the same recorded healthy operation as the 24-hour observation. |

## Exact hosted targets

- Supabase project: `elprosaas-demo`, ref `wmqmzznmwpheswjjozhq`, region `eu-north-1`, status `ACTIVE_HEALTHY`, Postgres `17.6.1.155`.
- Vercel project: `prj_QYRxEeUBlCStlPL0YZd72y8245rg`, team `team_jvgtCLGEU7h6atn0TyGLNncd` (`enhancior`).
- Production deployment: `dpl_2DAG69cR31WeAVT8CQvF7MFh1Kuj`, created `2026-09-29T07:53:37.828Z`, ready `2026-09-29T07:54:30.967Z`.
- Production aliases include `elpro-saas.vercel.app`, `elpro-saas-enhancior.vercel.app`, and `elpro-saas-git-main-enhancior.vercel.app`.

## Timeline and bounded corrections

All timestamps are UTC.

1. The initial auto-deployment `dpl_DucLcfpDbC4YE7857XB4uSLuMCz6` became ready from merged `main` before the hosted database had the Epic 13 schema.
2. Authentic scheduled requests reached `/api/jobs/run` at `07:40:17.157`, `07:45:17.259`, and `07:50:17.250`. All three returned HTTP 500. Filtered logs identified the application boundary as `Job cursor lookup failed`; the remote database had no `job_runs` table. These failures are real scheduler evidence, not a healthy-run claim.
3. The Vercel project Cron Jobs switch was disabled before any schema mutation. The dashboard confirmed `Disabled`, disabled its Run/View Logs controls, and showed a successful project-specific toggle. It remained disabled after the corrective redeploy and was rechecked by `2026-09-29T08:00:14.163Z`.
4. A redacted authenticated environment read found the pre-existing production `TENANT_PROVISIONING_ENABLED` value was exactly `true`. No ADR-B010 hosted release approval exists. The value was changed only to `false` and verified disabled at `2026-09-29T07:53:28.819Z`; no secret value was displayed or recorded.
5. The original `78019af` production deployment was rebuilt after that correction. The resulting `dpl_2DAG69cR31WeAVT8CQvF7MFh1Kuj` is `READY` and owns the production aliases. Its Vercel metadata retains `originalDeploymentId=dpl_DucLcfpDbC4YE7857XB4uSLuMCz6`, Git SHA `78019af39d80627a14e11802ac5dafacd37ac9b5`, and Git ref `main`.
6. On the serving production alias, `/operator` returned the generic `Åtkomst saknas.` marker at `2026-09-29T07:56:04.966Z`. This is consistent with the server gate short-circuiting while provisioning is disabled. An unauthenticated `/api/jobs/run` request returned HTTP 401 with `Unauthorized` at `2026-09-29T07:56:12.263Z`, confirming the runner front door still requires its secret.

The earlier enabled provisioning flag is a pre-existing configuration defect discovered during this rollout, not an approval or a completed tenant-provisioning release. The corrective deployment closes that boundary.

## Release-setting evidence

Redacted Vercel checks at `2026-09-29T07:59:41.812Z` established:

- the production Supabase URL exactly targets `wmqmzznmwpheswjjozhq`;
- exactly one production `CRON_SECRET` exists and is stored as sensitive metadata;
- `TENANT_PROVISIONING_ENABLED` compares exactly to `false`;
- the existing production quote-PDF key ID, quote-PDF HMAC secret, and Supabase service-role entries are present by name only;
- no environment key named for Resend, Postmark, SendGrid, Mailgun, or a generic email provider is present.

Absence of a provider-named environment key is not the primary email control. The deployed `78019af` source is the authority: `evaluateEmailReleaseControl` always returns `allowed: false`, and the scheduled runner injects an adapter that throws if invoked. A future provider secret or passing sandbox evidence cannot open real delivery without a separately approved code/configuration release.

## Database blocker and pending migrations

Supabase CLI `2.115.0` was run from the clean main checkout with the repository's project-specific `supabase/cli-profile.yaml`. Both `migration list --linked` and `db push --dry-run --linked --skip-vault` stopped before database access with:

`LegacyDbConfigLoginRoleStatusError: unexpected login role status 403`

The CLI credential/API path is rejected with HTTP 403 at the temporary database login-role endpoint; the exact account permission or API compatibility cause is not yet confirmed. No migration, SQL workaround, migration-history repair, or provider mutation was attempted.

The Supabase connector independently confirmed 62 recorded migrations and latest version `20260922121240`. Read-only schema checks confirmed all of these Epic 13 tables are absent: `job_runs`, `notifications`, `notification_preferences`, `email_outbox`, `email_delivery_events`, `email_suppressions`, `email_unsubscribe_tokens`, `email_delivery_artifacts`, and `email_delivery_recoveries`. The `record_job_run_with_system_audit` RPC is also absent.

The exact pending repository files are:

1. `20260923160000_authenticated_job_runner.sql`
2. `20260923161000_job_runs_authenticated_select_grant.sql`
3. `20260923162000_job_runs_lifecycle_constraints.sql`
4. `20260923170000_in_app_notifications.sql`
5. `20260923175035_email_outbox_pipeline.sql`
6. `20260923181728_email_outbox_transition_guard_fix.sql`
7. `20260923182954_email_outbox_security_and_state_fixes.sql`
8. `20260924090000_email_sending_activation.sql`
9. `20260924110000_quote_email_delivery_artifacts.sql`
10. `20260924120000_email_delivery_followup_fixes.sql`
11. `20260924130000_quote_delivery_recipient_correction.sql`
12. `20260925100000_quote_email_delivery_recovery.sql`
13. `20260927100000_remove_quote_delivery_preferences.sql`
14. `20260927110000_quote_delivery_recovery_sender_roles.sql`
15. `20260927120000_attest_quote_delivery_recoveries.sql`
16. `20260927130000_quote_delivery_pdf_send_roles.sql`
17. `20260927140000_preserve_failed_job_checkpoints.sql`
18. `20260928110819_epic_13_reviewbot_followup_atomic_job_run_audit_and_config_recovery.sql`

## Backlog, recovery, and observation evidence

- No Epic 13 durable backlog can be measured because `email_outbox` does not yet exist on the hosted database.
- No Epic 13 recovery row or job-run/system-audit evidence can be produced because the corresponding tables and RPC are absent.
- The three failed cron requests did not create durable runner evidence. Their five-minute cadence and HTTP results are visible only in Vercel request logs.
- Due-producer dispatch, bounded tenant continuation, job-run/system-audit atomicity, and Stockholm business-calendar behavior remain **unverified on the hosted pair**. Repository/CI evidence does not replace authentic scheduled hosted execution.
- No customer email, provider submission, new tenant, customer record, pilot recipient, or pilot workload was created.

This is an empty/unavailable backlog state caused by missing schema, not proof of zero eligible work or successful recovery.

## Required continuation and resume gate

1. Refresh the isolated Supabase CLI credential using `supabase/cli-profile.yaml`, or privately supply the hosted database password to the CLI. The credential must be authorized for the exact `wmqmzznmwpheswjjozhq` project. Do not put a token or password in the repository, command output, or this record.
2. Run `supabase migration list --linked --profile .\supabase\cli-profile.yaml` and confirm the remote remains at `20260922121240` before applying anything.
3. Run `supabase db push --dry-run --linked --skip-vault --profile .\supabase\cli-profile.yaml`. It must list exactly the 18 files above in their original version/name order.
4. Apply those committed migrations with the linked CLI and `--skip-vault`; do not use connector-generated versions, raw SQL concatenation, or migration-history repair.
5. Verify all 18 original versions in remote history plus the required tables, RLS/grants, runner RPCs, and audit paths. Inspect backlog and recovery counts as filtered metadata only.
6. Keep real email closed and tenant provisioning false. Recheck the exact serving deployment before scheduler activation.
7. Re-enable only this Vercel project's Cron Jobs control. Observe an authentic scheduled invocation rather than manually substituting a request. Require HTTP success plus durable `job_runs` and paired system-audit evidence, due-producer selection, bounded continuation behavior, and the Stockholm business-date path.
8. Record the first healthy scheduled completion timestamp. Only that timestamp starts the at-least-24-hour observation and seven-day reassessment clocks.

## Disable and rollback controls

- Current containment: project Cron Jobs disabled; tenant provisioning false; real-recipient email code-closed.
- Immediate scheduler disable: use the `enhancior/elpro-saas` Project Settings → Cron Jobs project switch and verify it reads `Disabled`.
- If a migration fails, leave the scheduler disabled and investigate the failed migration. Do not reset the hosted database or repair history blindly.
- Do not instant-rollback to a historical deployment without checking its embedded environment snapshot. The preceding `dpl_DucLcfpDbC4YE7857XB4uSLuMCz6` carried the unapproved provisioning-enabled value. Any rollback candidate must be rebuilt or independently proven with `TENANT_PROVISIONING_ENABLED=false` before receiving production aliases.
- Real-recipient delivery has no activation rollback to perform in this release because it was never enabled. A later separately approved activation must document its own provider disable and alias/deployment rollback steps.

## One-tenant pilot preparation and deferred work

The approved one-tenant quote-email pilot remains preparation-only. Pilot tenant identity, recipient set, central From/domain evidence, provider configuration, expected daily volume, busy-hour burst, named operations owner, and operational contacts are still unresolved. No recipient address or credential belongs in this repository record, and no activation is authorized.

Retention cleanup remains deferred to E31's central tenant-scoped, dry-run-first, legal-hold-aware, idempotent, audited workflow. No deletion was performed. The separate local infrastructure diagnosis is outside this hosted record.

# Epic 13 Hosted Rollout — 2026-09-29

Status: **CONTROLLED ROLLOUT — code and schema aligned. The `epic-13-hosted-pilot-observation` automation is PAUSED after the completed 24-hour observation; `epic-13-seven-day-operating-review` remains ACTIVE. The 24-hour observation from `2026-09-29T08:15:21.049Z` is complete with a recorded producer/runner failure and evidence gaps; it is not a clean or stable-period finding, and it does not approve activation. The failure received its bounded diagnostic review within one business day, but its deeper root cause remains unestablished. The seven-day reassessment remains pending.**

This is the redacted operational record for the owner-approved closed Epic 13 rollout. It does not authorize real-recipient email, tenant provisioning, pilot activation, retention deletion, hosted integration tests, or manual migration-history repair.

## State separation

| State | Result |
| --- | --- |
| Merged code | Complete. GitHub `main` is `78019af39d80627a14e11802ac5dafacd37ac9b5`, merged at `2026-09-29T07:37:01Z`. |
| Deployed code | Complete. Production deployment `dpl_2DAG69cR31WeAVT8CQvF7MFh1Kuj` is `READY`, serves the production aliases, and was rebuilt from original deployment `dpl_DucLcfpDbC4YE7857XB4uSLuMCz6`. Vercel metadata identifies Git SHA `78019af39d80627a14e11802ac5dafacd37ac9b5` on `main`. |
| Applied schema | Complete. `elprosaas-demo` has all 80 repository migrations through `20260928110819_epic_13_reviewbot_followup_atomic_job_run_audit_and_config_recovery`; local and remote histories match with no local-only or remote-only versions. |
| Scheduled execution | Enabled after schema verification. The project-level Vercel Cron Jobs control is enabled for `/api/jobs/run` at `*/5 * * * *` UTC. The first post-enable authentic scheduled request returned HTTP 200. |
| Real-recipient email | Disabled. The deployed source has a fail-closed release evaluation and the production runner supplies a closed adapter; no real provider submission path is enabled. |
| Tenant provisioning | Disabled after a bounded corrective change described below. No tenant was provisioned. |
| Healthy observation | **24-hour observation completed with recorded failure and evidence gaps.** The window began at `2026-09-29T08:15:21.049Z` and reached its minimum cutoff at `2026-09-30T08:15:21.049Z`. It contains the documented `12:50Z` producer/runner failure; later ordinary successes do not make the period clean or establish stability, activation approval, full-invocation latency, loaded fairness, due-date business logic, recovery, or live-email behavior. |
| Seven-day reassessment | Pending. It is due `2026-10-06T08:15:21.049Z`, measured from the same healthy start. |

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

## Initial database blocker and migration set

This section records the initial hold before access was restored. The blocker and pending migration set were resolved by the bounded continuation below. Its 62-applied/18-pending state is historical evidence and must not be reused as the current expected state or as an instruction to rerun the pre-push gate. The current authority is the state-separation table above and the dated continuation, which record 80 matched migrations and an active observation window.

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

## Initial backlog, recovery, and observation evidence

- No Epic 13 durable backlog can be measured because `email_outbox` does not yet exist on the hosted database.
- No Epic 13 recovery row or job-run/system-audit evidence can be produced because the corresponding tables and RPC are absent.
- The three failed cron requests did not create durable runner evidence. Their five-minute cadence and HTTP results are visible only in Vercel request logs.
- Due-producer dispatch, bounded tenant continuation, job-run/system-audit atomicity, and Stockholm business-calendar behavior remain **unverified on the hosted pair**. Repository/CI evidence does not replace authentic scheduled hosted execution.
- No customer email, provider submission, new tenant, customer record, pilot recipient, or pilot workload was created.

This is an empty/unavailable backlog state caused by missing schema, not proof of zero eligible work or successful recovery.

## Initial required continuation and resume gate (completed)

The following historical checklist governed the resume. Its bounded steps through the first healthy scheduled completion were completed without migration-history repair, a reset, customer data, or a manual substitute for scheduled proof. The commands and expected 62-applied/18-pending result below preserve the executed decision trail; they are not the current expected state and must not be rerun on that assumption. Current authority remains the 80-migration matched state and active observation recorded above and in the dated continuation.

1. Refresh the isolated Supabase CLI credential using `supabase/cli-profile.yaml`, or privately supply the hosted database password to the CLI. The credential must be authorized for the exact `wmqmzznmwpheswjjozhq` project. Do not put a token or password in the repository, command output, or this record.
2. Run `supabase migration list --linked --profile .\supabase\cli-profile.yaml` and confirm the remote remains at `20260922121240` before applying anything.
3. Run `supabase db push --dry-run --linked --skip-vault --profile .\supabase\cli-profile.yaml`. It must list exactly the 18 files above in their original version/name order.
4. Apply those committed migrations with the linked CLI and `--skip-vault`; do not use connector-generated versions, raw SQL concatenation, or migration-history repair.
5. Verify all 18 original versions in remote history plus the required tables, RLS/grants, runner RPCs, and audit paths. Inspect backlog and recovery counts as filtered metadata only.
6. Keep real email closed and tenant provisioning false. Recheck the exact serving deployment before scheduler activation.
7. Re-enable only this Vercel project's Cron Jobs control. Observe an authentic scheduled invocation rather than manually substituting a request. Require HTTP success plus durable `job_runs` and paired system-audit evidence, due-producer selection, bounded continuation behavior, and the Stockholm business-date path.
8. Record the first healthy scheduled completion timestamp. Only that timestamp starts the at-least-24-hour observation and seven-day reassessment clocks.

## Continuation — 2026-09-29

All timestamps are UTC.

### Credential and migration execution

- The user refreshed the isolated CLI credential with the repository profile and verified access using `supabase login --profile .\supabase\cli-profile.yaml --name elprosaas-release --agent no`, `supabase projects list --profile .\supabase\cli-profile.yaml`, and `supabase migration list --linked --profile .\supabase\cli-profile.yaml`.
- The linked target remained exactly `wmqmzznmwpheswjjozhq`. The pre-push history contained 62 remote-applied migrations through `20260922121240` and exactly the 18 repository-only versions listed above; there were no remote-only versions.
- `supabase db push --dry-run --linked --skip-vault --profile .\supabase\cli-profile.yaml` exited successfully and listed exactly those 18 original versions and names in order. It included no seed or role application.
- `supabase db push --skip-vault --yes --linked --profile .\supabase\cli-profile.yaml` exited successfully and applied all 18 migrations in that order. Vault, seed data, roles, and existing migration-history rows were not changed separately.
- The post-push migration list contains 80 matching local and remote versions through `20260928110819`, with no local-only or remote-only entry.

### Bounded schema and release checks

At `2026-09-29T08:11:23.127Z`, read-only hosted metadata established:

- all ten expected tables exist: `job_runs`, `notifications`, `notification_preferences`, `email_outbox`, `email_delivery_events`, `email_suppressions`, `email_unsubscribe_tokens`, `email_unsubscribe_rate_limits`, `email_delivery_artifacts`, and `email_delivery_recoveries`;
- RLS and forced RLS are enabled on all ten tables;
- the critical runner/outbox/delivery RPCs exist as security-definer functions, deny anonymous execution, and retain the intended service-role execution grants; the authenticated grants on the two user-authorized application RPCs remain present;
- the pre-enable hosted counts were zero job runs, zero job system audits, zero unpaired runs, zero outbox rows, and zero delivery-recovery rows.

At `2026-09-29T08:12:13.356Z`, a redacted Vercel API recheck established that production deployment `dpl_2DAG69cR31WeAVT8CQvF7MFh1Kuj` remained `READY`, on `main`, at Git SHA `78019af39d80627a14e11802ac5dafacd37ac9b5`, and had exactly one production provisioning flag whose value compared to `false`. The matching deployed source retains the fail-closed real-recipient email control. No secret value was printed or recorded.

### Scheduler resume and authentic healthy start

- Only the `enhancior/elpro-saas` project Cron Jobs switch was enabled, at `2026-09-29T08:12:49.760Z`, after the schema and release-setting checks passed. The Vercel dashboard visibly confirmed `Enabled` and a successful project-specific change. The schedule remained `/api/jobs/run` at `*/5 * * * *` UTC.
- The first post-enable authentic scheduled request was a production `GET /api/jobs/run` at `2026-09-29T08:15:17.082Z` on deployment `dpl_2DAG69cR31WeAVT8CQvF7MFh1Kuj`, branch `main`. Vercel recorded HTTP 200. No manual request was used as the success proof.
- The corresponding hosted database run window was `2026-09-29T08:15:18.856Z` through `2026-09-29T08:15:21.049Z`. It produced three completed `job_runs`: one `jobs.runner` row and two `notifications.email-outbox-delivery` rows. All three had no error summary and each had its matching `job.producer.executed` system audit; paired audits were 3/3 and unpaired rows were zero.
- The healthy observation therefore starts at the confirmed successful run-window completion, `2026-09-29T08:15:21.049Z`. The minimum 24-hour observation cannot complete before `2026-09-30T08:15:21.049Z`; the seven-day reassessment is due `2026-10-06T08:15:21.049Z`.
- This first empty-workload success proves authenticated scheduling, deployment/schema alignment, completed producer execution, and atomic run/audit persistence. It does not yet prove 24-hour stability, hourly due-producer behavior, Stockholm business-date selection, a non-empty backlog, recovery handling, or bounded continuation across more eligible tenants. Those remain observation items and must not be manufactured with customer data.
- No customer email, provider submission, new tenant, customer record, pilot recipient, or pilot workload was created. Real-recipient email remains disabled and tenant provisioning remains false.

## Bounded observation checkpoint — 2026-09-29T09:50:27.68636Z

All timestamps in this checkpoint are UTC. The healthy observation start remains `2026-09-29T08:15:21.049Z`; the 24-hour window cannot complete before `2026-09-30T08:15:21.049Z`, and the seven-day reassessment remains due `2026-10-06T08:15:21.049Z`. Both scheduled automations remain active.

- Since 08:15, the hosted database records 62 durable `job_runs`, all completed, with zero errors, zero noncompleted rows, zero unpaired `job.producer.executed` audits, and zero duplicate audit pairs when grouped by `target_id=job_run.id`.
- There are 20 completed `jobs.runner` rows. The latest completed at `09:50:19.565Z`; the current success gap at the snapshot is 8.12136 seconds. The maximum interval between runner completions is 302.245 seconds (about 5 minutes 2 seconds), below the 15-minute warning and 30-minute escalation targets.
- `notifications.email-outbox-delivery` has 40 completed rows: 20 executions for each of two existing tenants. This is aggregate-only evidence with no identity recorded. It establishes balanced ordinary visits only; cursor rows are zero, so it does not prove bounded cursor continuation under large load.
- `quotes.follow-up-reminders` has two completed rows from `09:00:18.982Z` through `09:00:20.863Z`, covering two existing tenants in one scheduled window. The run was at minute 0, and there has been no off-hour reminder dispatch since 08:15. This is the first observed authentic hourly producer execution. It does not prove due-notification freshness, Stockholm-midnight behavior, load behavior, or repeated hourly stability.
- `email_outbox`, eligible backlog, active leases, and recovery rows are all zero. This leaves nonempty-workload, recovery, and capacity behavior unexercised; it is not loaded-throughput success.
- Per-run producer duration has p95 0.76545 seconds and maximum 0.832 seconds. The `jobs.runner` summary start and finish timestamps are equal, so its recorded zero seconds does not measure full invocation duration. Request logs supplied no duration field. Full-invocation p95 below 30 seconds remains unverified; producer latency is not substituted for that target.
- Official Vercel CLI/API evidence confirms production alias `dpl_2DAG69cR31WeAVT8CQvF7MFh1Kuj` remains `READY` on `78019af` / `main` for the unchanged target project. Bounded official runtime logs and connector aggregates both show 20 `GET /api/jobs/run` HTTP 200 responses since 08:15.
- A Supabase repository CLI-profile authenticated query confirms 80 migrations through `20260928110819`. A read-only current single-variable Vercel API check confirms exactly one provisioning entry whose plaintext value compares exactly to `false`. Real-recipient email remains code-closed in the unchanged deployed `78019af` source; no activation occurred.

This checkpoint does not complete the 24-hour observation or a Stockholm day-boundary check. It does not establish recovery, nonempty workload, large-tenant continuation, measured capacity, a customer SLA, or real-recipient email approval.

## Bounded observation checkpoint — 2026-09-29T11:03:12.065668Z

All timestamps in this checkpoint are UTC. The healthy observation start remains `2026-09-29T08:15:21.049Z`; the 24-hour window cannot complete before `2026-09-30T08:15:21.049Z`, and the seven-day reassessment remains due `2026-10-06T08:15:21.049Z`. Both scheduled automations remain active.

- Since the healthy start, the hosted database records 108 durable `job_runs`, all completed, with zero noncompleted rows and zero error summaries. Every run has exactly one matching `job.producer.executed` system audit with null actor and matching target/run, tenant, and correlation fields; unpaired and duplicate audit pairs are both zero.
- There are 34 completed `jobs.runner` rows. The latest completed at `11:00:20.940Z`; the current success gap at the snapshot is 171.125668 seconds. The maximum observed completion gap is 302.245 seconds. Both remain below the 15-minute warning and 30-minute escalation targets and show ordinary cadence only.
- `notifications.email-outbox-delivery` has 68 completed producer rows. Aggregate-only evidence shows two existing workspaces, each visited 34 times. This remains ordinary balanced-visit evidence: no non-null job-run cursor rows were observed, so large-tenant keyset continuation and loaded fairness remain unexercised.
- Six `quotes.follow-up-reminders` rows span the authentic hourly windows at 09:00, 10:00, and 11:00. Each window covered the same two existing workspaces, each with three reminder visits in total across the three observed windows; no off-hour dispatch was observed (zero rows where the window minute was nonzero). The new 10:00 window ran from `10:00:17.847Z` through `10:00:20.082Z`, and the 11:00 window from `11:00:18.454Z` through `11:00:19.901Z`. This adds repeated scheduled hourly dispatch evidence only; it does not prove a full 24-hour stable period, due-work freshness, Stockholm business-date behavior, calendar behavior, or load handling.
- `email_outbox`, eligible work, active leases, recovery rows, and notifications are all zero. Loaded-workload, recovery, capacity, and due-notification freshness remain unexercised. No workload or email was manufactured.
- Per-run producer duration has p95 0.75885 seconds and maximum 0.832 seconds. All 34 runner summaries have equal start and finish timestamps, so their recorded zero seconds do not measure full invocation runtime; bounded request logs supplied no duration fields. The approved full-runtime target of 95% below 30 seconds remains unverified, and the approximate 45-second budget is unchanged.
- Official Vercel connector aggregates and separate official CLI request aggregation agree on 15 `GET /api/jobs/run` HTTP 200 responses and zero non-200 responses from 09:50 through 11:00; the latest was `11:00:17.312Z`. The serving production alias remains `elpro-saas.vercel.app` on READY deployment `dpl_2DAG69cR31WeAVT8CQvF7MFh1Kuj`, project `prj_QYRxEeUBlCStlPL0YZd72y8245rg`, team `team_jvgtCLGEU7h6atn0TyGLNncd` (`enhancior`), Git SHA `78019af39d80627a14e11802ac5dafacd37ac9b5` on `main`.
- A repository Supabase CLI-profile authenticated query again confirmed 80 migrations through `20260928110819`; this is a count/latest recheck, not a new full version-set comparison. A private read-only Vercel check again found exactly one production provisioning entry whose plaintext value compares to `false`. Real-recipient email remains code-closed in the unchanged deployed `78019af` source. No flag, schema, secret, local-infrastructure, or retention change occurred, and no email was sent.

This checkpoint does not complete the 24-hour observation. The Stockholm midnight business boundary remains future and unverified; three UTC hourly windows do not prove it. It also does not establish recovery, nonempty workload, large-tenant continuation, measured capacity, a customer SLA, real-recipient email approval, or the unresolved pilot identity, recipient, sender, and operations-owner details. Retention cleanup remains deferred to E31's central workflow.

## Bounded observation checkpoint — 2026-09-29T13:01:21.629163Z

All timestamps in this checkpoint are UTC. The healthy observation start remains `2026-09-29T08:15:21.049Z`; the 24-hour window cannot complete before `2026-09-30T08:15:21.049Z`, and the seven-day reassessment remains due `2026-10-06T08:15:21.049Z`. Both scheduled automations remain active. This checkpoint records an observed failure; later automatic successes do not erase it.

- Since the healthy start, the hosted database records 184 durable `job_runs`: 182 completed, two failed/noncompleted, and one row with an error summary. All 184 runs have exactly one paired `job.producer.executed` system audit; there are zero unpaired or duplicate pairs.
- The failed window began at `12:50:17.589Z` and contains three rows: one completed outbox producer, one failed `notifications.email-outbox-delivery` producer from `12:50:18.808Z` through `12:50:26.909Z`, and one failed `jobs.runner` summary whose start and finish are both `12:50:28.084Z`. A read-only exact-whitelist comparison found the sole error summary to be `Producer cursor lookup failed`; all other summaries are absent. The underlying database or network cause is not established, and this record does not characterize the failure as transient or resolved.
- Authentic later scheduled windows completed normally: the `12:55` window began `12:55:17.366Z`, produced three of three completed rows (one runner and two outbox producers), and finished `12:55:20.860Z`; the `13:00` window began `13:00:17.387Z`, produced five of five completed rows (one runner, two outbox producers, and two reminders), and finished `13:00:29.103Z`. The latest successful runner completed at `13:00:29.103Z`, 52.526163 seconds before the snapshot. The maximum successful completion gap is 599.186 seconds (about 9 minutes 59 seconds), below the 15-minute warning and 30-minute escalation targets. The unsuccessful runner interval remains part of the observation.
- `notifications.email-outbox-delivery` has 116 producer records across two existing workspaces, with 58 ordinary visits for each workspace. Completed outbox visits differ by one (57–58) because one visit failed. There are still zero cursor rows, so no conclusion can be drawn about large-tenant keyset continuation. Later ordinary visits demonstrate observed recovery of ordinary scheduling only.
- Ten `quotes.follow-up-reminders` rows span the authentic 09:00, 10:00, 11:00, 12:00, and 13:00 UTC hourly windows: two rows per window, five visits per existing workspace, and zero off-hour rows. `email_outbox`, recoveries, and notifications remain empty; no eligible workload was manufactured. Loaded fairness, capacity, freshness, nonempty-backlog recovery, and large-tenant continuation remain unexercised.
- Producer duration is p95 0.807 seconds and maximum 8.101 seconds. All 58 runner summaries have zero recorded duration despite 57 completed runner rows, so this field still does not measure full invocation runtime. The latest bounded official CLI request logs since `12:46:10Z` contain three `GET /api/jobs/run` HTTP 200 responses, zero non-200 responses, and latest timestamp `1790686817316` (`13:00:17.316Z`); none of those request-log rows supplied duration fields. HTTP 200 does not establish that every producer succeeded: the `12:50` request was HTTP 200 while durable records failed. The grouped connector query returned no buckets, which is not evidence that application faults were absent. Full-runtime latency is therefore still unverified and is not inferred from producer timing or request logs.
- The serving alias remains unchanged on READY deployment `dpl_2DAG69cR31WeAVT8CQvF7MFh1Kuj`, project `prj_QYRxEeUBlCStlPL0YZd72y8245rg`, team `team_jvgtCLGEU7h6atn0TyGLNncd` (`enhancior`), Git SHA `78019af39d80627a14e11802ac5dafacd37ac9b5` on `main`. A repository Supabase CLI-profile count/latest recheck remains 80 migrations through `20260928110819`; it is not a new full version-set verification. A private read-only Vercel check again found exactly one production provisioning entry whose plaintext value compares to `false`. Real-recipient email remains code-closed. No mutation, email, or tenant workload occurred.

At this checkpoint, the owner target to review a failure and recovery within one business day applied. The subsequent diagnostic-review follow-up records completion of that required review; it records no mitigation, proven root cause, flag change, or schema change. The named operations-owner assignment remains unresolved in pilot preparation. The Stockholm midnight boundary remains future and unverified, and this checkpoint does not restart the observation clock or claim a clean 24-hour period. Retention cleanup remains deferred to E31's central workflow.

## Diagnostic-review follow-up — 2026-09-29T14:34:00Z (recorded at minute precision)

All timestamps in this follow-up are UTC. The required bounded diagnostic review of the 12:50 incident is **completed within one business day**. It was read-only and made no hosted configuration, schema, source, index, retry, flag, email, provisioning, or retention change. The healthy observation start remains `2026-09-29T08:15:21.049Z`; the minimum observation end remains no earlier than `2026-09-30T08:15:21.049Z`, and the seven-day reassessment remains due `2026-10-06T08:15:21.049Z`. Both scheduled automations remain active. This completed review does not establish a deeper database, PostgREST, gateway, or network root cause, does not claim that the cause was fixed, and does not establish a clean 24-hour period.

### Read-only incident diagnosis

- The serving deployment remains `dpl_2DAG69cR31WeAVT8CQvF7MFh1Kuj`, `READY` on `78019af39d80627a14e11802ac5dafacd37ac9b5` / `main`. Its `src/app/api/jobs/run/route.ts` cursor loader (lines 31–42) selects the latest `job_runs` row for the tenant and producer using `ORDER BY created_at DESC, id DESC LIMIT 1`. At its error boundary it reduces the upstream Supabase client error to the generic `Producer cursor lookup failed` message, so the durable error summary does not retain the precise upstream response.
- The runner calls that loader before producer execution and catches and persists the resulting failure with its paired audit (`src/server/jobs/runner.ts`, lines 247–287 and 300–302). This accounts for the paired failed producer and runner records, but it cannot identify the upstream failure category.
- Narrow official Supabase log aggregates for `12:50:16Z` through `12:50:30Z` show one normalized `job_runs` request with HTTP 504 at `12:50:18.814Z` and `response.origin_time=8035ms`. The other three `job_runs` requests and four RPC requests in that interval were HTTP 200. The 8.035-second gateway/Data API interval is consistent with the prior checkpoint's 8.101-second failed producer duration, but timing alone does not establish a correlated underlying cause.
- Official Vercel evidence for the invocation is one HTTP 200 and no grouped runtime error. That HTTP result does not prove producer success; the durable producer and runner failures remain the authoritative outcome for this incident.
- The reviewed evidence contains no contemporaneous SQLSTATE, statement-timeout, cancellation, connection-reset, refusal, or capacity marker. Two PostgREST timeout-marked entries at `12:51:19Z` are later than, outside, and unlinked to the failed run; they are not attributed as its cause.
- The currently present `job_runs_tenant_producer_started_idx` does not cover the `created_at, id` ordering. The observed workload is small, however, and this single incident establishes no query-plan defect. No index, retry, schema, or source change is justified from this evidence alone.

The proved conclusion is a gateway/Data API HTTP 504 during the cursor lookup. The database, PostgREST, gateway, and network root cause remains unknowable from the available evidence. Separately approved future telemetry could retain a sanitized upstream status/category with correlation and alert on durable runner outcomes; it is optional hardening, not a required defect fix or authorization for a change. Full invocation duration also remains unmeasured.

### Routine observation snapshot

At `2026-09-29T14:16:04.338493Z`, aggregate-only hosted evidence shows 231 durable `job_runs`: 229 completed and two failed, with one error summary. All 231 have exactly one paired `job.producer.executed` audit; there are zero unpaired and zero duplicate pairs. There are 72 completed runner rows, the latest at `14:15:23.976Z`; the maximum successful completion gap remains 599.186 seconds. The ordinary hourly 09:00–14:00 UTC windows contain 12 reminder rows and zero off-hour rows. Outbox rows, recoveries, notifications, and cursor rows remain zero. These counts are a dated snapshot only: they preserve the observed failure, demonstrate later ordinary scheduler recovery, and do not prove nonempty-workload recovery, cursor continuation, capacity, full invocation latency, or a clean 24-hour period.

Real-recipient email remains code-closed, production provisioning remains exactly false, and the serving deployment/hash is unchanged. No mutation was performed. Retention cleanup remains deferred to E31's central workflow.

## 24-hour observation completion checkpoint — 2026-09-30T08:32:44Z

All timestamps in this checkpoint are UTC. The healthy start remains `2026-09-29T08:15:21.049Z`; the exact minimum 24-hour cutoff was `2026-09-30T08:15:21.049Z`. The closed-window aggregate was queried after that cutoff at `08:32:43Z`, for durable `job_runs` started from `2026-09-29T08:15:00Z` through before the cutoff. The 24-hour observation is therefore **completed with a recorded failure and evidence gaps**. It is not a clean or stable-period finding and does not approve pilot activation, real-recipient email, tenant provisioning, retention work, or any other change. `epic-13-hosted-pilot-observation` is PAUSED after this completed window; `epic-13-seven-day-operating-review` remains ACTIVE. The seven-day reassessment remains due no earlier than `2026-10-06T08:15:21.049Z`.

- The closed window contains 914 durable runs: 912 completed and two failed, with one error summary. There are zero unpaired `job.producer.executed` system audits and zero duplicate audit pairs. This preserves the `12:50Z` producer/runner failure already recorded above; later ordinary successes do not erase it.
- There are 287 completed `jobs.runner` rows. The latest completed before the cutoff at `08:10:21.287Z`; the maximum successful-run completion gap is 599.186 seconds, below the 15-minute warning and 30-minute escalation targets. This is scheduler-cadence evidence only, not a clean-run or availability conclusion.
- All 288 runner rows have equal `started_at` and `finished_at`, so the full-invocation p95-below-30-seconds target and approximate 45-second budget cannot be evaluated. Non-runner producer duration p95 is 1.66975 seconds and maximum is 8.101 seconds; these timings are not full-invocation measurements.
- Two existing workspaces each had 289 ordinary outbox-producer visits, but cursor rows remain zero. Keyset tenant continuation and loaded fairness were not exercised. The approved forecast of 5 emails/day with occasional 10/hour, and the 10/day and 20/hour benchmark, remain planning inputs only and were not measured.
- The reminder producer recorded 48 rows across 24 hourly windows, from `2026-09-29T09:00:00Z` through `2026-09-30T08:00:00Z`, with two rows in each window and zero off-hour rows. At the Stockholm midnight boundary (`22:00Z` on 2026-09-29), the `21:45`–`21:55Z` interval contained three completed runner rows on local 2026-09-29; the `22:00`–`22:10Z` interval contained three completed runner rows and two reminder rows on local 2026-09-30. This proves scheduler cadence across the Stockholm date boundary, not due-date business logic.
- `notifications`, `email_outbox`, and recovery rows remain zero. There was no eligible due workload or live-email load, so due-notification freshness, email submission, nonempty-backlog behavior, and recovery handling remain unexercised. No workload or email was manufactured.
- The documented `12:50Z` cursor lookup failure received its diagnostic review within one business day. Official Supabase Data API evidence records HTTP 504 at `12:50:18.814Z` with `origin_time=8035ms`; the deeper root cause remains unestablished and no fix is approved. Later ordinary runs succeeded, but the 24-hour observation was not clean. HTTP 200 is insufficient to reveal that producer failure.
- The continuing snapshot as of `2026-09-30T08:32:44Z` records 924 runs, 922 completed and two failed; audits remain coherent. It has 291 completed runner rows, latest `08:30:21.070Z`, with the same maximum successful completion gap. Official Vercel request logs for `08:00`–`08:30Z` show seven `GET /api/jobs/run` HTTP 200 responses and zero non-200 responses; this does not contradict or explain the earlier producer failure.
- The serving deployment remains `dpl_2DAG69cR31WeAVT8CQvF7MFh1Kuj`, `READY`, on `main` at `78019af39d80627a14e11802ac5dafacd37ac9b5`. A read-only repository CLI check remains 80 migrations through `20260928110819`. The earlier redacted verification that `TENANT_PROVISIONING_ENABLED=false` remains the recorded production evidence; this checkpoint does not represent a new flag recheck. Real-recipient email remains code-closed. No hosted mutation, email, provisioning, retention action, or customer data was involved.

The completed 24-hour observation preserves evidence of scheduled execution and atomic audit pairing, while leaving the recorded failure, full-runtime latency, loaded fairness and continuation, due-date business logic, nonempty workload, recovery, and capacity evidence unresolved. Seven-day reassessment remains the next dated observation gate; it cannot be brought forward by this checkpoint.

## Disable and rollback controls

- Current containment: project Cron Jobs enabled only after verified schema alignment; tenant provisioning false; real-recipient email code-closed.
- Immediate scheduler disable: use the `enhancior/elpro-saas` Project Settings → Cron Jobs project switch and verify it reads `Disabled`.
- If a migration fails, leave the scheduler disabled and investigate the failed migration. Do not reset the hosted database or repair history blindly.
- Do not instant-rollback to a historical deployment without checking its embedded environment snapshot. The preceding `dpl_DucLcfpDbC4YE7857XB4uSLuMCz6` carried the unapproved provisioning-enabled value. Any rollback candidate must be rebuilt or independently proven with `TENANT_PROVISIONING_ENABLED=false` before receiving production aliases.
- Real-recipient delivery has no activation rollback to perform in this release because it was never enabled. A later separately approved activation must document its own provider disable and alias/deployment rollback steps.

## One-tenant pilot preparation and deferred work

The approved one-tenant quote-email pilot remains preparation-only. The approved planning forecast is 5 quote emails per day with an occasional burst of 10 per hour; the two-times capacity benchmark is 10 per day and 20 per hour. Pilot tenant identity, recipient set, central From/domain evidence, provider configuration, named operations owner, and operational contacts remain unresolved. No recipient address or credential belongs in this repository record, and no activation is authorized.

Retention cleanup remains deferred to E31's central tenant-scoped, dry-run-first, legal-hold-aware, idempotent, audited workflow. No deletion was performed. The separate local infrastructure diagnosis is outside this hosted record.

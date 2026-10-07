# Epic 13 Seven-Day Operating Review — 2026-10-07

Status: **COMPLETED WITH A RECORDED FAILURE AND EVIDENCE GAPS.** Ordinary scheduled cadence and durable system-audit pairing met the observed bounds. Full invocation runtime, eligible-work freshness, loaded fairness, cursor continuation, recovery and capacity remain unverified. This review makes no activation or release decision.

## Window and scope

The healthy deployed operation began at `2026-09-29T08:15:21.049Z`. The exact seven-day cutoff was `2026-10-06T08:15:21.049Z`; this due review was performed on October 7. The closed-window database query executed at `2026-10-07T09:31:17.243803Z` and selected `job_runs.started_at >= start AND started_at < cutoff`. It therefore excludes producer rows started before the healthy-start instant, including the initial operation's earlier producer rows. The first runner summary at exactly the start is included. Unlike the earlier 24-hour checkpoint's `08:15:00Z` lower bound, this is the exact requested interval; totals should not be compared as identical boundary definitions.

The separate continuing snapshot is bounded from the cutoff through database `now()` at `2026-10-07T09:31:56.311499Z`. Its successful-run gap calculation includes completed runner rows from `2026-10-06T08:00:00Z` to retain continuity across the cutoff. Historical seven-day results and current results are reported separately.

Targets are exactly Supabase `elprosaas-demo` / `wmqmzznmwpheswjjozhq` and Vercel `enhancior/elpro-saas` / project `prj_QYRxEeUBlCStlPL0YZd72y8245rg`, team `team_jvgtCLGEU7h6atn0TyGLNncd`. Reads used the official Supabase and Vercel connectors and their official CLI fallbacks. No hosted workload, email, provisioning, configuration, schema, retention action or local infrastructure was created or changed.

## Closed seven-day evidence

| Measure | Observed result | Meaning and limit |
| --- | --- | --- |
| Durable runs | 6,384 total; 6,382 completed, two failed, zero partial | Preserves the September 29 incident; this was not a clean period. |
| Error summaries | One exact-whitelist `Producer cursor lookup failed`; zero other summaries | No arbitrary error content was returned. |
| Runner summaries | 2,016 total; 2,015 completed | Summary outcomes are authoritative for producer failure; HTTP status is insufficient. |
| Successful runner gap | Maximum 599.186 seconds; zero gaps at least 900 or 1,800 seconds | Below the 15-minute warning and 30-minute escalation thresholds for observed durable completions. |
| Window edges | First success `2026-09-29T08:15:21.049Z`; last success `2026-10-06T08:10:21.630Z`; cutoff age 299.419 seconds | Includes both boundary ages in the cadence assessment. |
| Atomic system audits | Zero missing and zero duplicate fully matching audit pairs across all 6,384 runs | Matched event/target type, target/run ID, tenant, correlation and null actor; no identifiers were output. |
| Outbox producer visits | Two existing workspaces; 2,016 visits each, 2,015–2,016 completed | Balanced ordinary visits. Delivery remains disabled and these are not email delivery metrics. |
| Hourly reminder visits | 168 scheduled windows; exactly two visits per window, 168 per workspace; zero off-hour rows | Repeated authentic hourly dispatch, including daily boundaries; not due-date business logic proof. |
| Per-workspace completed visit gaps | Outbox maximum 599.059 seconds; reminders maximum 3,629.380 seconds; zero above 900/4,500 seconds | Visit cadence met the corresponding bounds; eligible-work freshness and loaded fairness were not exercised. |
| Continuation | Zero non-null cursor rows | Large-tenant keyset continuation and sustained-deferral handling remain unexercised. |
| Producer runtime | Non-runner p95 0.87765 seconds, maximum 17.023 seconds | Producer timing only, not complete invocation timing. |
| Invocation runtime | All 2,016 runner summaries have equal start and finish timestamps | Zero-duration summaries cannot establish p95 below 30 seconds or evaluate the approximate 45-second budget. |
| Created workload | Zero outbox, delivery-event, recovery or notification rows created within the closed window | No nonempty workload, recovery or capacity conclusion is available. These are retained-ledger aggregates, not a reconstruction of historical queue depth. |

The five-minute freshness target of at most 15 minutes and hourly freshness target of at most 75 minutes apply to eligible work. Scheduled visits alone do not measure eligibility-to-persistence delay. No customer or quote rows were selected to manufacture such a denominator. Real-recipient email is excluded from delivery/freshness performance assessment while disabled; the future submission target remains unmeasured.

## Continuing bounded evidence

At `2026-10-07T09:31:56.311499Z`, the post-cutoff interval contains 960 runs, all completed, with zero error summaries, zero incoherent audit pairs and zero cursor rows. It contains 304 completed runner summaries. The latest success is `2026-10-07T09:30:20.837Z`, 95.474499 seconds before the snapshot; the continuity calculation's maximum successful gap is 304.015 seconds. This is a dated continuation snapshot, not a guarantee about later operation.

Current aggregate counts are zero outbox rows, due queued rows, active leases, expired leases, delivery events, recovery rows and notifications. Current emptiness does not reconstruct the historical backlog or establish nonempty-backlog recovery.

A repository Supabase CLI-profile read at `2026-10-07T09:31:59.700130Z` returned 80 migrations, latest `20260928110819`. This is a count/latest recheck; the September 29 full version-set comparison remains the separate historical evidence.

## Changed serving deployment and current closure

The production alias `elpro-saas.vercel.app` now resolves to READY production deployment `dpl_5dk9hhaakcRbJfdFQbjGbsF4ke9o`, Git SHA `34c3b012837a5bf86395b927949f114989cca1ee` on `main`. The latest project deployment is a different preview; the serving production alias was inspected directly. The seven-day observation is therefore not an unchanged-deployment experiment. No deployment timeline or attribution of individual runs to a deployment was reconstructed.

Private official Vercel CLI reads returned only comparison booleans: exactly one production `TENANT_PROVISIONING_ENABLED` project entry compares exactly to `false`, and exactly one production `NEXT_PUBLIC_SUPABASE_URL` entry matches the authorized Supabase project. No environment values or credentials were displayed or saved. The serving deployment API confirmed the exact project but omitted its embedded provisioning and Supabase URL fields. Current project configuration is reverified; the serving deployment's embedded environment snapshot is **not independently verified**. Absence of a returned field is not evidence of a mismatched value. The September 29 deployment's historical embedded verification is not carried forward to this deployment.

The exact serving SHA's repository source was inspected using `git show` / `git grep`: `src/app/api/jobs/run/route.ts` still uses `releaseControl: undefined` and a throwing delivery adapter; `src/server/email/provider.ts` permits only sandbox delivery to synthetic recipients and represents no real-recipient activation. The same route retains `DEFAULT_RUN_BUDGET_MS = 45_000`. This establishes source containment for that SHA; it is not an execution test, an embedded provisioning check, or permission to activate delivery.

## Runtime-log and incident limits

The bounded historical official Vercel grouped query for the exact seven-day window and `/api/jobs/run` aborted with `INVALID_ARGUMENT`. A separate production query for the recent 30-minute window returned no grouped buckets. Neither result supplies invocation durations or proves absence of runtime faults. No broad raw log dump was requested. Full-invocation p95 and budget compliance remain unmeasured; producer durations and zero-duration runner summaries are not substitutes.

The September 29 `12:50Z` incident remains the only durable failed producer/runner interval in the closed window, from `12:50:18.808Z` through `12:50:28.084Z`. The historical bounded diagnostic review established one cursor-lookup Data API HTTP 504 at `12:50:18.814Z`, with `origin_time=8035ms`. Its deeper database, PostgREST, gateway or network cause remains unconfirmed. Later ordinary scheduler success demonstrates resumption, not a proven fix or nonempty-workload recovery. The incident's required diagnostic review was completed within one business day; this review does not claim that any future support response has a named owner. The completed 24-hour observation also remains **completed with failure and evidence gaps**.

## Owner review proposals and unresolved decisions

Retain the adopted 15/30-minute runner-gap thresholds, p95-below-30-seconds target, approximate 45-second budget and 15/75-minute eligible-work freshness bounds for owner review. The observed cadence supports retaining these targets; the missing runtime and nonempty-workload evidence provides no basis to relax or tighten them. No target adjustment has been adopted. Consider sanitized upstream status/category, durable-outcome alerting and complete invocation duration with correlation as future owner-review proposals only; no telemetry implementation or alert routing is approved by this review.

The accepted planning forecast remains five app-generated quote emails/day with occasional ten/hour peaks; the two-times benchmark remains ten/day and twenty/hour. These are planning inputs only, not measured capacity, a customer SLA or approval to send email. A distinct recipient and each resend count separately. No batch size, support owner, pilot tenant or approved recipient set has been selected by this review.

Before any separately approved live pilot, the owner must resolve the named operations owner and contacts, tenant/recipient selection, central From/domain and tenant Reply-To evidence, provider/secret rollout and enabled-flow list, suppression/unsubscribe evidence, sandbox proof and disable/rollback controls. Future permitted workload evidence must cover eligible-work freshness, full invocation duration, nonempty recovery, tenant deferral and cursor continuation. Independent embedded provisioning closure remains a release-evidence gap for the changed serving deployment. These are preparation and owner-review items; this document authorizes no hosted change.

Retention remains deferred to E31's central tenant-scoped, dry-run-first, legal-hold-aware, idempotent and audited workflow. No deletion was performed.

## Evidence boundaries and command results

All data SQL was explicit `SELECT`, with fixed temporal predicates for `job_runs` and created-row closed-window checks. Current backlog counts deliberately use the current snapshot. The audit join uses identifiers internally only. Per-tenant visits and gaps are grouped internally and reduced to producer-level counts, minima and maxima. Output contained only aggregate counts, timestamps, durations, approved producer names, error-whitelist counts and schema metadata; no tenant/user/customer/recipient IDs, tenant rows, arbitrary errors, cursors, audit metadata or secrets were returned. No mutating RPC or privileged application route was invoked. The official Management API query documentation was checked; the current changelog was fetched successfully after the browser tool rejected its Markdown content type.

Supabase CLI v2.115.0 version/help each returned native 0 after authorized sandbox escalation for its ordinary telemetry file. The first query using `--project-ref` without `--linked` refused locally with native 1; the corrected read with `--linked --project-ref wmqmzznmwpheswjjozhq --profile .\supabase\cli-profile.yaml` returned native 0. The CLI emitted `Initialising login role...` as its own query setup; no separate login/role command, credential change, upgrade or data/schema mutation was requested. The connector's SQL calls succeeded. Vercel environment-list connector access returned HTTP 403; its same-target official CLI fallback succeeded, with native 0 for metadata listing, selective entry reads and deployment reads. Vercel API help printed usable documentation but ended native 2 from an update-worker EPIPE; successful subsequent API reads are recorded independently. The initial non-escalated Supabase help/version attempts failed on profile telemetry-file EPERM; their combined shell result did not preserve individual native codes. None of these command/tool failures is counted as an application incident.

## References

- [Owner targets and preparation boundary](../decisions/epic-13-owner-decisions-2026-09-29.md)
- [Hosted rollout, incident diagnosis and completed 24-hour observation](epic-13-hosted-rollout-2026-09-29.md)
- [ADR-B011 email release decision](../decisions/ADR-B011-epic-13-email-release-and-quote-delivery.md)
- [Official Supabase Management API query reference](https://supabase.com/docs/reference/api/v1-run-a-query)

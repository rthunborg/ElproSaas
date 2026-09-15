---
title: 'Epic 11 pilot monitoring: independent Cloudflare remediation'
type: 'operational-correctness-remediation'
created: '2026-09-15'
status: 'ready-for-dev'
baseline_commit: '93d4901ddab3b6bc5c2affc14924ea8747172b80'
context:
  - 'AGENTS.md'
  - 'docs/process/pilot-operations-runbook.md'
  - 'docs/process/review-order.md'
authorization: 'The owner approved the Cloudflare remediation, Free-plan proposal, and the 100 SEK/month cap; root retains merge and deployment authority.'
---

<frozen-after-approval reason="owner-approved pilot-monitoring intent — do not modify unless the owner renegotiates">

## Intent

**Problem:** The existing GitHub Actions monitor has a nominal five-minute cron but ran only twice in about eight hours, so it cannot provide an independent availability history or reliable alert threshold.

**Approach:** Add one private Cloudflare scheduled Worker using one SQLite-backed Durable Object for serialized samples and failure state. It probes the canonical public login URL every five minutes, retains thirty days, alerts an owner-verified inbox after three consecutive actual failures, and leaves the GitHub workflow as an advisory control.

## Boundaries & Constraints

**Always:** Use a 10-second bounded HTTPS GET with manual redirects and require HTTP 200. Validate the exact canonical `https://elpro-saas.vercel.app/login` target before any network call. Store only timestamps, status classes, latency, schedule-gap metadata, and delivery state; email only operational metadata. The single Durable Object is the serialization point: duplicate/stale events make no sample, gaps reset failure counting and remain explicit unknown history, and failed delivery retries with one outage identifier. Keep samples for thirty days. Pin Wrangler and use a Free-plan SQLite Durable Object. Restrict the email binding to the verified recipient and the owner-approved Email Service sender; `monitor@ops.enhancior.se` remains a proposed sender pending platform eligibility.

**Ask First:** A different probe URL, email recipient/sender, paid Cloudflare plan, non-Free resource, changing the GitHub advisory workflow, new persistent credentials, public route, or deployment outside root authority.

**Never:** Commit recipient addresses, tokens, customer data, a broad email binding, a service-role credential, a KV counter, a public test/administrative endpoint, a product-surface change, or an availability/error-rate claim that these synthetic probes cannot prove.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Successful probe | In-order scheduled event; canonical URL responds 200 | One `ok` sample, consecutive failures reset | Purge samples older than 30 days |
| Third failure | Three in-order, ungapped failed probes | One outage email attempt for that outage | Persist delivery failure and retry on later scheduled events without duplicate outage alerts |
| Duplicate, stale, or gap | Same/older scheduled time, or missing five-minute slots | Ignore duplicate/stale; preserve gap count and reset failure run | Never manufacture healthy samples or alert across a gap |
| Isolated alert test | Local scheduled simulation with forced failures | Exercises threshold and message behavior in local/test state only | Does not call or reconfigure production URL, touch production DO history, or expose an HTTP route |

</frozen-after-approval>

## Code Map

- `.github/workflows/pilot-availability.yml` — retained advisory GitHub probe; its artifact history must not be reused by the Worker.
- `scripts/ops/probe-availability.mjs` — existing semantics source: HTTPS-only, 10-second manual-redirect probe with safe samples.
- `scripts/ops/availability-history.mjs` — existing three-consecutive failure behavior to preserve for the advisory monitor.
- `workers/cloudflare-monitor/` — new, standalone pinned Wrangler project; no Next.js runtime/package dependency.
- `tests/unit/ops/pilot-operations.test.ts` — existing GitHub monitor unit evidence; remains intact.
- `docs/process/pilot-operations-runbook.md` — owner deployment, alert-test, history, and monitoring limits documentation.

## Tasks & Acceptance

**Execution:**
- [ ] `workers/cloudflare-monitor/package.json`, `wrangler.jsonc`, and `tsconfig.json` — create the pinned, cron-only Worker with SQLite Durable Object migration, no workers.dev endpoint, production-only five-minute trigger, and recipient/sender-restricted email binding.
- [ ] `workers/cloudflare-monitor/src/*` — implement configuration validation, safe probe, gap-aware state transition, serialized SQLite persistence/retention, and deduplicated retryable alert delivery.
- [ ] `workers/cloudflare-monitor/test/*` — add focused unit coverage for target validation, threshold/recovery, gap/duplicate/stale processing, 30-day query boundary, and delivery retry/dedup models.
- [ ] `docs/process/pilot-operations-runbook.md` — replace GitHub-primary monitoring guidance with practical Cloudflare CLI setup, local isolated alert-test, verification, history interpretation, and evidence limits while retaining GitHub as advisory.

**Acceptance Criteria:**
- Given deployed production configuration, when Cloudflare invokes the cron trigger, then the only accepted probe target is the canonical HTTPS login route and 200 is the sole healthy status.
- Given three consecutive in-order failure samples without a gap, when the third is recorded, then exactly one safe outage delivery is attempted and failed delivery is retried without creating a duplicate outage alert.
- Given a scheduler duplicate, stale event, or gap, when it reaches the Durable Object, then state remains race-free and history never represents missing time as healthy.
- Given thirty days have elapsed, when a new sample is stored, then older samples are deleted and any gap makes monthly availability unknown rather than a passing percentage.
- Given the focused test command and Wrangler dry-run run, when executed locally, then the model tests and Worker configuration/type build pass without a daemon or deployed resource.

## Design Notes

One Durable Object is intentionally used instead of KV: its private SQLite operations are transactional and strongly consistent, while `blockConcurrencyWhile` serializes the fetch-to-state transition across awaited network and email operations. The Worker has no `fetch` export and disables workers.dev; only a configured Cron Trigger calls its internal DO binding.

The monitor measures an unauthenticated synthetic route. It may support a sampled availability numerator/denominator only when the retained sequence has no schedule gaps; it cannot establish the all-request server-error target or a platform SLA.

## Verification

**Commands:**
- `pnpm --dir workers/cloudflare-monitor test` — expected: focused model tests pass.
- `pnpm --dir workers/cloudflare-monitor typecheck` — expected: Worker type check passes.
- `pnpm --dir workers/cloudflare-monitor test:runtime` — expected: a guarded local-only run writes an ignored result JSON with `status: "passed"` after the first SQLite Durable Object sample write.
- From `workers/cloudflare-monitor`, `pnpm run render:private-config` followed by `pnpm exec wrangler deploy --dry-run --config wrangler.private.jsonc` — expected: valid pinned Worker configuration without deployment.
- `node scripts/verify/check-review-order.mjs "_bmad-output/implementation-artifacts/spec-epic-11-cloudflare-monitor-remediation.md"` — expected: final author trail has valid references.

## Suggested Review Order

Author: Codex Cloudflare-monitor implementation agent.
Refreshed against the final uncommitted `codex/epic-11-cloudflare-monitor` worktree from baseline `93d4901ddab3b6bc5c2affc14924ea8747172b80`.

### Restrict the scheduled surface and deployment authority

The Worker has no public fetch route and its only production trigger is the five-minute cron. The checked-in config deliberately cannot deploy until the owner supplies an approved sender and already-verified recipient to the ignored rendering step. The rendered recipient is both the exact restricted binding destination and the runtime message destination, avoiding a source-stored address or an unrestricted binding.

- `workers/cloudflare-monitor/wrangler.jsonc:6` — `workers_dev`: prevents a public workers.dev route.
- `workers/cloudflare-monitor/wrangler.jsonc:17` — `crons`: declares the production five-minute schedule through Wrangler configuration.
- `workers/cloudflare-monitor/wrangler.jsonc:30` — `new_sqlite_classes`: creates the only monitor Durable Object with SQLite storage.
- `workers/cloudflare-monitor/wrangler.jsonc:36` — `destination_address`: makes a deployment fail closed until the private exact-recipient render occurs.
- `workers/cloudflare-monitor/scripts/render-private-config.mjs:20` — `CLOUDFLARE_MONITOR_ALERT_DESTINATION`: accepts one private recipient and sender without committing either.
- `workers/cloudflare-monitor/scripts/render-private-config.mjs:23` — `rendered.includes`: rejects an incomplete private render before deployment.

### Preserve failure meaning across scheduling and delivery boundaries

One named Durable Object serializes the asynchronous probe, state write, and email attempt. Its SQLite transaction makes the sample, active-failure state, new pending alert, and retention cleanup atomic. Pending delivery is separate from active failure continuity: gaps and recovery reset the current failure run but retain an earned undelivered alert for later safe retry with the incident timestamp and recovered/unknown/failing state.

- `workers/cloudflare-monitor/src/index.ts:53` — `waitUntil`: makes the internal DO probe outcome part of the scheduled invocation.
- `workers/cloudflare-monitor/src/index.ts:95` — `blockConcurrencyWhile`: serializes the network-to-SQL transition and prevents counter races.
- `workers/cloudflare-monitor/src/index.ts:109` — `transactionSync`: atomically writes sample, state, newly opened alert, and retention cleanup.
- `workers/cloudflare-monitor/src/index.ts:170` — `toArray()[0]`: safely accepts the empty `monitor_state` table on the first Cron event.
- `workers/cloudflare-monitor/src/index.ts:213` — `DELETE FROM monitor_samples`: retains only thirty days using the indexed `checked_at` predicate.
- `workers/cloudflare-monitor/src/index.ts:218` — `deliverOldestPendingAlert`: retries the oldest due undelivered incident without blocking a new incident.
- `workers/cloudflare-monitor/src/model.ts:85` — `gapSlots > 0`: resets a failure sequence after an observed scheduler gap while delivery remains independent.

### Verify safety properties without a deployed privileged test route

Focused model tests exercise the exact URL, private-address explicitness, event ordering, failure/delivery transitions, gap semantics, and retention calculation. The local runtime test launches a fresh temporary SQLite state only, forces one non-network failure, verifies the Cron outcome, and requires the Durable Object's post-write log. The path-scoped CI workflow runs it and bundles a rendered fake-recipient config with `--dry-run`; it neither logs in nor deploys a Worker.

- `workers/cloudflare-monitor/test/model.test.ts:46` — `opens only one outage`: proves the third ungapped failed sample opens exactly one incident.
- `workers/cloudflare-monitor/test/model.test.ts:57` — `a gap resets`: proves a pre-gap incident cannot turn the first post-gap failure into a continued outage.
- `workers/cloudflare-monitor/test/model.test.ts:95` — `a failed alert delivery remains eligible`: proves pending delivery survives recovery/gap while delivered incidents do not retry.
- `workers/cloudflare-monitor/scripts/verify-local-bootstrap.mjs:80` — `--persist-to`: gives each local bootstrap run an isolated retained Durable Object state.
- `workers/cloudflare-monitor/scripts/verify-local-bootstrap.mjs:98` — `monitor_sample_recorded`: requires the first local Cron event to complete the post-write log after safe empty-state read.
- `.github/workflows/cloudflare-monitor-verify.yml:34` — `pnpm test:runtime`: keeps the Cloudflare runtime bootstrap check independent of the Next.js suite and platform state.
- `docs/process/pilot-operations-runbook.md:76` — `Prepare the Cloudflare monitor`: gives the owner private CLI configuration, local isolated test, and sender-platform stop.

Evidence: focused model tests passed 9/9; Worker and root type checks passed; the root Next build passed after explicitly excluding the standalone Worker type project; the repository lockfile guard passed; and a fake-only private render completed `wrangler deploy --dry-run` with an 11.11 KiB bundle and no deployment. The earlier guarded Windows runtime attempt recorded an ignored JSON result with `status: "failed"` and `failureClass: "AssertionError"`; its diagnostic rerun and the path-scoped Linux CI are pending. Do not treat the local runtime bootstrap as passed until a retained result artifact records `status: "passed"`.

Limits: local runtime coverage uses a simulated first failed probe and email binding, so it does not prove inbox delivery. A thirty-day gap-free history, real inbox delivery, current Free/Paid account capability, and Vercel all-request error rate remain operational evidence, not completed verification. As of this change, the proposed `ops.enhancior.se` Email Sending route requires a separate paid-plan decision; deployment waits for the owner's sender choice.

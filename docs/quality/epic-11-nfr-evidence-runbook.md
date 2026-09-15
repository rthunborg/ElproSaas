# Epic 11 NFR evidence runbook

Status: local R-1108 pilot, local R-1109 Auth-to-Mailpit smoke, a scoped local logical restore rehearsal, and a controlled hosted invitation journey executed on 2026-09-14. The owner approved pilot limits and operating criteria on the same date. Hosted password recovery, monitoring history, and hosted backup/recovery evidence remain pending.

This runbook collects evidence toward resolving the gaps recorded as R-1108 and R-1109 without turning a pilot observation into an SLO. Normal automated evidence uses the isolated local Supabase stack only. **SEAM — controlled hosted mail proof:** the owner expressly authorized one narrow, manual invitation/recovery proof against the current demo Supabase project and Vercel deployment. That exception does not permit automated CI, broad hosted testing, or use of another project. Production monitoring and backup workflows are operational controls, not test database fixtures; they must not be used to run generic integration tests against the hosted project.

## R-1108 pilot baseline

The baseline adds a reproducible two-tenant profile to the current local database: Tenant A has 120 active memberships, Tenant B has 24, the five roles are distributed across Tenant A, and every third Tenant-A membership has a second role. The measuring actor is a real authenticated Tenant-A `tenant_admin`. It measures the tenant-scoped Admin-users projection, a separate synthetic bulk effective-permissions calculation across those 120 returned rows, authenticated RLS request count, the local membership-query plan, and p50/p95/max elapsed time over 25 samples after five warmups. It does not measure a Roles page or full-page experience.

It writes the raw result to `tmp/private/epic-11-r1108-baseline.json` by default. The dataset is a measurement profile only; it is not an approved tenant-capacity limit or threshold.

The initial 2026-09-14 run at `5cc08d2b15b161e4742ddddc3283be4a3c03a059` is historical only: it measured p95 **45.72 ms** for the Admin read and **2.58 ms** for synthetic permissions, but the fixture had 39 secondary-role members and 159 assignments. It therefore did not prove the approved exact profile.

The corrected required probe at current worktree revision `c885185` asserted the approved exact profile: Tenant A 120 active memberships, Tenant B 24, five roles with 24 primary assignments each, 40 secondary-role members, and 160 assignments. Across 25 measured iterations after five warmups, Admin read p95 was **45.98 ms**, synthetic bulk effective-permissions p95 **2.00 ms**, and the projection used exactly three authenticated RLS requests per iteration. The final local unit suite passed **1,780 tests with zero failures and zero skips**; typechecking, focused lint, and review-order validation passed, and independent final review found no finding. PR #64 CI [34887323967](https://github.com/rthunborg/ElproSaas/actions/runs/34887323967) then passed 1,780 units / zero skips, 1,028 required DB/RLS / zero skips with `SUPABASE_TEST_REQUIRED=1`, and 138 browser tests / four existing explicit skips. Its measured CI p95 values were **17.718454 ms** for the read and **4.241466 ms** for synthetic permissions; these CI observations do not replace the local baseline. This is a local regression observation, not a rendering, production-capacity, or production-SLO result.

```powershell
$env:SUPABASE_TEST_REQUIRED = '1'
node --experimental-strip-types --import ./tests/support/register.mjs scripts/nfr/epic-11-r1108-baseline.ts
```

Record the output file, the current revision, local Supabase CLI/database version, and the relevant integration-suite wall time. The owner has approved the pilot targets below. They remain limits for the measured local functions, not a production or full-page SLO.

### Approved pilot targets

- Keep this exact two-tenant profile as the pilot minimum: 120 active memberships in the measured tenant, 24 in a second tenant, five primary roles, and one additional role on every third measured membership.
- Permit at most three authenticated RLS requests for the complete Admin-users read (one membership page plus the two observed child-role batches).
- Use local pilot ceilings of p95 **≤250 ms** for the tenant-scoped projection and **≤25 ms** for the synthetic bulk effective-permissions calculation. They do not apply to rendering or production capacity.
- Apply CI execution budgets, excluding installation, build, and test-infrastructure startup: units **≤3 minutes**, required DB/RLS **≤5 minutes**, and browser **≤5 minutes**. Record a measured result before asserting a gate passes.

The sequential-scan plan is a review input for those decisions. It was fast on a shared local fixture with 1,350 background rows, so it does not alone prove that an index or a production change is required.

## R-1109 controlled Auth delivery proof

The local stack already provisions Mailpit on `127.0.0.1:54324`; no Vercel variable, hosted service-role credential, or external SMTP credential is needed for this proof. The smoke sends a real Supabase Auth Admin invite and password-recovery email, reads the received messages through Mailpit's local API, and consumes each one-time Auth verification URL only far enough to verify its redirect to the configured `/auth/invite/confirm` callback plus a unique marker.

```powershell
$env:SUPABASE_TEST_REQUIRED = '1'
node --experimental-strip-types --import ./tests/support/register.mjs scripts/nfr/epic-11-auth-mail-smoke.ts
```

Requirements are the existing local Supabase API, database, Auth, and Mailpit services on their repository-configured loopback ports. The scripts use the committed local test keys only. Do not set `SUPABASE_TEST_URL` or `SUPABASE_TEST_DB_URL` to a hosted address. `SUPABASE_TEST_MAILPIT_URL` is optional only when the guard-owned local Mailpit UI is on a different unauthenticated loopback HTTP port; the smoke rejects any other address before it sends a request.

This helper proves the local Auth-to-Mailpit path, project templates, and Auth callback construction. It does not itself consume the Next.js callback, establish a browser session cookie, or accept an application membership; those require the separate browser/application journey. It also does not prove third-party SMTP deliverability, recipient mailbox acceptance, production provider uptime, or exactly-once delivery. The owner later authorized a narrow hosted proof with an owner-controlled mailbox against the current demo project. Preserve the recipient address, SMTP credential values, and verification URLs outside the repository and logs. This exception does not make the demo an automated test target.

The controlled hosted invitation proof passed at 2026-09-14T18:59:23Z. A real Google SMTP message arrived in the owner-controlled mailbox; the unmodified message link completed hosted Auth confirmation, browser session handoff, application acceptance, and dashboard continuation. Private checks verified the isolated membership, role, and succeeded delivery outcome. Invitation setup used the authenticated backend operation plus Auth Admin API rather than the Next.js UI/Server Action, so this is a delivery-to-acceptance proof, not user-facing invitation-initiation coverage.

The invitation message was spam-classified and had SPF `permerror`, although DKIM and DMARC passed. The owner inspected the existing `enhancior.se` Cloudflare records and replaced its dead SPF include target with the Google Workspace provider form `v=spf1 include:_spf.google.com ~all`, retaining the soft-fail policy. The saved record was confirmed through authoritative DNS and 1.1.1.1. A controlled recovery delivery then arrived in the inbox at 2026-09-14T19:08:55Z with SPF, DKIM, and DMARC passing. This is a bounded post-change sample, not a general deliverability, spam-placement, or availability result. The displayed sender name remains incorrect and must be corrected in Supabase Auth settings. Password update and fresh sign-in through the hosted recovery journey are still in progress. No recipient, token, URL, or message content is recorded in this runbook.

Earlier 2026-09-14 receipt and 303 observations established local delivery, callback origin/path, and the implicit Auth fragment for invite and recovery. They did **not** safely establish preservation of nested percent-encoded callback context: the original helper decoded the complete verification URL and could promote nested fields into the outer query. The corrected helper decodes only HTML entities and requires two fixed, non-sensitive callback markers plus the run marker to survive each Auth 303. Its final local probe passed for both invite and recovery: `nfrContextA`, `nfrContextB`, and the unique run marker were each verified by parsed callback query parameters, while URLs and fragments remained unlogged.

The initial browser callback journey is retained as historical **RED** evidence: a real invite link reached `/login` because the server callback received neither `code` nor `token_hash` from the implicit fragment. The candidate callback remediation in [PR #62](https://github.com/rthunborg/ElproSaas/pull/62) changes that handoff. The earlier local production-build proof passed **2/2** with zero skips in 12.4 seconds. The final combined local production-build Playwright run, using the CI port `3100` and `SUPABASE_TEST_REQUIRED=1`, ran from `2026-09-14T13:39:02.620Z` to `13:40:58.089Z` against tested app/test code at `d94c593` (only documentation edits were pending): **142 total, 138 passed, four explicit skips, zero failures**, in 1.9 minutes. It included both real Auth journeys plus 136 existing browser tests: Auth-to-Mailpit invitation set the browser cookie and activated the database membership; recovery reached password update followed by a fresh sign-in. The resource-guard stop was accepted. Independent focused review found no consequential finding. This is candidate **GREEN** local application evidence only while PR #62/PR #63 CI, merge, and deployment remain pending.

Read-only inspection also found local Auth allow-list drift: the running service contains only `https://127.0.0.1:3000`, while the committed local configuration also specifies `http://127.0.0.1:3000/auth/invite/confirm`. The drift did not cause the historical callback failure, and the candidate local journey now passes. On 2026-09-14, an authenticated demo-dashboard inspection saved the hosted Site URL as `https://elpro-saas.vercel.app`, retained exactly one hosted redirect URL, `https://elpro-saas.vercel.app/auth/invite/confirm`, and confirmed that the invite and recovery previews use `{{ .ConfirmationURL }}`. Custom SMTP is off, so the platform defaults apply. Confirm-email remains on; anonymous sign-ins and manual linking remain off. This configuration evidence does not prove the deployed application callback, hosted login, or external delivery; none becomes a production PASS from the local proof.

The historical runner-allocation failures remain evidence limits. On 2026-09-14 the repository was confirmed public and reruns succeeded. PR #62 run [34851125570](https://github.com/rthunborg/ElproSaas/actions/runs/34851125570) passed 1,756 units with zero skips, 1,028 required database/RLS tests with zero skips, and 138 browser tests with four explicit skips and zero failures. PR #63 run [34862069987](https://github.com/rthunborg/ElproSaas/actions/runs/34862069987) at its merged head passed the same required suites; post-merge main [34863085288](https://github.com/rthunborg/ElproSaas/actions/runs/34863085288) also passed. PR #64 run [34887323967](https://github.com/rthunborg/ElproSaas/actions/runs/34887323967) passed the current required suites: 1,780 units / 0 skipped, 1,028 DB/RLS / 0 skipped, and 138 browser / four explicit skips. Its unit, DB-plus-pilot, and browser attempts completed in 20.29 s, 74.99 s, and 151.97 s respectively, within the approved budgets. Record a future failure of those limits as a gate result rather than assuming these historical observations enforce one.

## Local logical backup and restore rehearsal

The demo project's current backup inventory is empty and point-in-time recovery is not enabled, so no hosted backup or recovery claim is available. The following prepared rehearsal is deliberately local: it asks the local CLI for separate plain-SQL schema and data dumps, including `supabase_migrations`, restores them into a UUID-named scratch database on `127.0.0.1:54322`, compares migrations, tenant/membership counts, active-membership count, and a membership digest, then drops only that scratch database. It does not reset, stop, or mutate the source `postgres` database.

```powershell
$env:SUPABASE_TEST_REQUIRED = '1'
node --experimental-strip-types --import ./tests/support/register.mjs scripts/nfr/epic-11-local-dr-rehearsal.ts
```

The ignored schema/data dump files are retained under `tmp/private/` for the run record. The rehearsal refuses to report a pass unless both the migration schema and its data occur in the CLI dumps and survive the comparison. The first bounded attempt stopped with PostgreSQL `42501: permission denied to change default privileges`; subsequent attempts exposed cross-schema ordering (`42883`) and a local test-fixture dependency (`3F000`). Each dropped its UUID scratch database, with no source reset or change. The final bounded run at 2026-09-14T15:19:22.1563399Z–15:19:45.3195357Z passed at code head `8c6f4e37984e41531d12a5bbd07f6de5313c2b33` plus its uncommitted rehearsal correction. It used the pre-existing local `supabase_admin` restoration role and one dependency-ordered combined schema/data profile containing `auth`, `storage`, `public`, `supabase_migrations`, and local-only `test_support`; `test_support` is included solely because a local test fixture trigger on `public.audit_events` depends on it, not as a hosted/production-schema claim. Intact ownership, grants, and default privileges were restored into UUID scratch database `epic11_dr_c65dfcec703b428e8098c5dc24c513a2`. Source and scratch matched: 29 migrations, 10 tenants, 1,384 memberships, 270 membership roles, 1,140 active memberships, and an equal membership digest. A post-run catalog query found zero remaining scratch databases. Raw ignored log/result files and the combined-profile dump pair are retained under `tmp/private/epic-11-dr-c65dfcec703b428e8098c5dc24c513a2`. This is a scoped local logical restore PASS. It does not establish platform-role bootstrap, Storage object-byte recovery, a hosted backup policy, immutable storage, recovery-point objective, recovery-time objective, or production recovery capability.

## Existing operational evidence and remaining decisions

| Area | Existing evidence | Smallest remaining proof or decision |
| --- | --- | --- |
| Required DB execution | PR #64 passed 1,028 required database/RLS tests with zero skips and `SUPABASE_TEST_REQUIRED=1`. | Retain executed/failed/skipped counts with any new gate run. |
| Browser execution | PR #64 passed 138 browser tests with four explicit skips and zero failures. | Retain the separate authorized hosted recovery journey evidence. |
| Dependency health | CI blocks `pnpm audit --audit-level=high`. | Record its result from the assessed commit; no new service configuration is required. |
| Deployment availability | The deployed application has a login availability probe and release-window runtime-error inspection. | Configure the approved 99.5% availability, <1% server-error, five-minute check, three-failure alert, and 30-day-history policy; then collect its evidence. |
| Backup and recovery | The scoped local logical rehearsal now passes with an intact selected schema/data profile and no remaining scratch database. | Configure a hosted policy that includes Storage bytes: daily encrypted copies, seven-day retention, 24-hour RPO, four-hour RTO, and a monthly safe restore check. |
| Coverage and duplication | Traceability, deterministic harness enrollment, typecheck, lint, and audit gates exist. | **Decision complete:** keep risk-based regression and traceability gates for this pilot; no blanket percentage threshold is required. |

The operational backup workflow is deliberately disabled pending an approved destination. Its current controls use stable pre/post Storage inventory plus restore-shaped checksums and allow only the exact direct/shared-session pooler target, rejecting query overrides. The monthly Codex heartbeat `elpro-monthly-recovery-check` is configured for the first day of each month at 09:00 local time to inspect backup freshness, recovery evidence, monitoring gaps, and the 100 SEK/month cap; no execution is yet evidence. These controls do not replace a hosted restore exercise, a 30-day monitoring history, or alert-delivery proof.

PR #64 Production deployment `dpl_zt1Xqkvqd9SeB5AqY4fkALNHrYPr` became READY for `efd87fa` at 2026-09-14T19:40:19.592Z with the canonical alias. Post-merge CI [34888266259](https://github.com/rthunborg/ElproSaas/actions/runs/34888266259) passed. A post-deployment manual monitor sample was HTTP 200 in 417 ms at 2026-09-14T19:44:49.911Z. The alert simulation recorded `[false, false, true]`; the separately recorded mailbox receipt establishes bounded notification delivery only.

The configured five-minute monitoring cadence is not met in the pilot: only two scheduled monitor runs occurred over approximately 7 hours 50 minutes after activation, both successful. This is a consequential monitoring gap. It prevents an availability or monitoring PASS even though the manual sample and bounded alert delivery passed.

At 2026-09-14T19:40:46Z, the owner-approved mailbox received the GitHub failure notification for that isolated simulation. This is a bounded alert-delivery PASS only: it does not prove scheduler history, availability, an error-rate denominator, or alert latency. The repository now has server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets for the exact demo project. Database URL, Drive OAuth/folder, and GPG credentials are still absent; `PILOT_BACKUP_ENABLED` stays false and no backup has executed.

## Suggested Review Order

### Measure the real tenant-scoped read

The R-1108 script rejects a missing required local stack, provisions real Auth accounts and memberships in two tenants, uses an authenticated RLS client for the production read model, records measured distributions, and deletes the disposable accounts.

- `scripts/nfr/epic-11-r1108-baseline.ts:92` — `addMembership`: produces the documented five-role, multi-role profile.
- `scripts/nfr/epic-11-r1108-baseline.ts:139` — `readAdminUsersForTenant`: measures the current-tenant production projection through RLS.
- `scripts/nfr/epic-11-r1108-baseline.ts:157` — `explain`: retains the local query plan as evidence without using it for app authorization.

### Prove the controlled Auth transport boundary

The delivery smoke calls real local Supabase Auth, waits for the local Mailpit receipt, and requires the rendered callback to preserve a unique marker for both invite and recovery flows.

- `scripts/nfr/epic-11-auth-mail-smoke.ts:51` — `confirmationUrl`: polls the local SMTP sink rather than mocking a provider result.
- `scripts/nfr/epic-11-auth-mail-smoke.ts:109` — `inviteUserByEmail`: drives an actual invitation template and callback.
- `scripts/nfr/epic-11-auth-mail-smoke.ts:119` — `resetPasswordForEmail`: drives the recovery template and callback.

### Preserve the evidence limits

The runbook separates observed local facts from owner decisions and does not claim external delivery, production availability, backups, coverage, duplication, or any SLO has been measured.

- `docs/quality/epic-11-nfr-evidence-runbook.md:7` — `## R-1108 pilot baseline`: records the profile and command without inventing a threshold.
- `docs/quality/epic-11-nfr-evidence-runbook.md:31` — `## R-1109 controlled Auth delivery proof`: names the exact local requirements and external-delivery limitation.
- `scripts/nfr/epic-11-local-dr-rehearsal.ts:124` — `restore`: restores the intact dependency-ordered selected-profile dumps using the preflighted existing local restoration role.
- `scripts/nfr/epic-11-local-dr-rehearsal.ts:156` — `dropScratch`: removes only the generated scratch database after the comparison.
- `docs/quality/epic-11-nfr-evidence-runbook.md:63` — `## Existing operational evidence and remaining decisions`: confines operational follow-up to owner-approved targets and safe environments.

### Verify the dependent callback repair

The stacked callback repair needs the same required CI evidence before it can be retargeted to `main`. The trigger remains an explicit named repair-branch allowlist; it does not widen verification to a branch pattern or alter CI jobs, permissions, guards, or concurrency.

- `.github/workflows/ci.yml:25` — `codex/story-11-3-auth-callback`: enables the existing CI pipeline for the dependent callback repair base only.

The R-1108 and R-1109 commands executed with `SUPABASE_TEST_REQUIRED=1`; their raw output remains under ignored `tmp/private/`. The scoped local restore rehearsal passed with the preflighted role and intact combined profile; its hosted recovery limits remain open. The historical browser callback proof was RED; the remediated journey is locally GREEN, with the final combined local production-build run passing 138/142 and four explicit skips. PR #62 is deployed, and post-merge main CI [34860862774](https://github.com/rthunborg/ElproSaas/actions/runs/34860862774) succeeded. The retargeted PR #63 head still requires its own current-head CI before merge. Hosted authenticated callback/login and external delivery remain open. A skipped or mocked result is not evidence.

# Epic 11 NFR evidence runbook

Status: local R-1108 pilot and local R-1109 Auth-to-Mailpit smoke executed on 2026-09-14. The recorded observations remain pilot evidence, not approved SLOs or production-delivery evidence. The local DR rehearsal was started safely but has no passing restore result yet.

This runbook collects evidence toward resolving the gaps recorded as R-1108 and R-1109 without turning an unapproved pilot observation into an SLO. It uses the isolated local Supabase stack only. It must never be aimed at the demo project or another hosted project.

## R-1108 pilot baseline

The baseline adds a reproducible two-tenant profile to the current local database: Tenant A has 120 active memberships, Tenant B has 24, the five roles are distributed across Tenant A, and every third Tenant-A membership has a second role. The measuring actor is a real authenticated Tenant-A `tenant_admin`. It measures the tenant-scoped Admin-users projection, a separate synthetic bulk effective-permissions calculation across those 120 returned rows, authenticated RLS request count, the local membership-query plan, and p50/p95/max elapsed time over 25 samples after five warmups. It does not measure a Roles page or full-page experience.

It writes the raw result to `tmp/private/epic-11-r1108-baseline.json` by default. The dataset is a measurement profile only; it is not an approved tenant-capacity limit or threshold.

Executed locally on 2026-09-14 at `13:00:07Z`, against revision `5cc08d2b15b161e4742ddddc3283be4a3c03a059` with an intentionally **dirty** working tree containing `scripts/nfr/epic-11-r1108-baseline.ts`, Node `v22.23.2`, Supabase CLI `2.115.0`, and local PostgreSQL `17.6`. The raw artifact is [epic-11-r1108-baseline.json](../../tmp/private/epic-11-r1108-baseline.json) (ignored): the full fixture-and-measurement harness took **4,112.333 ms**. The authenticated tenant projection completed 25 measured iterations after five warmups at p50 **43.76 ms**, p95 **45.72 ms**, and maximum **45.81 ms**. Its separate synthetic bulk effective-permissions calculation was p50 **1.25 ms**, p95 **2.58 ms**, and maximum **3.19 ms** for 2,224 resolved grants. The projection performed exactly 75 authenticated RLS requests: 25 membership pages and 50 child-role batches, or three per iteration. The captured local membership plan returned 120 rows and removed 1,377 pre-existing background rows from the shared local database; those rows were not created by the pilot, so this is not a clean-database plan. Its database execution time was **0.147 ms**. These are observations from one local pilot run, not a production capacity assertion or an instruction to add an index. The script now records runtime and working-tree identity into every raw result.

```powershell
$env:SUPABASE_TEST_REQUIRED = '1'
node --experimental-strip-types --import ./tests/support/register.mjs scripts/nfr/epic-11-r1108-baseline.ts
```

Record the output file, the current revision, local Supabase CLI/database version, and the relevant integration-suite wall time. Do not report a PASS performance result until the owner has approved targets for: dataset profile, acceptable p95, application RLS request count, and DB-suite duration. Candidate targets may be proposed from the observed measurements, but are decisions, not defaults in the script.

### Proposed pilot targets for owner decision

- Keep this exact two-tenant profile as the pilot minimum: 120 active memberships in the measured tenant, 24 in a second tenant, five primary roles, and one additional role on every third measured membership.
- Permit at most three authenticated RLS requests for the complete Admin-users read (one membership page plus the two observed child-role batches). The observed implementation made exactly three.
- Use local pilot ceilings of p95 **≤250 ms** for the tenant-scoped projection and **≤25 ms** for the synthetic bulk effective-permissions calculation. These are proposed, unapproved thresholds for the measured local functions only; they are not production or full-page SLOs.
- Do not set a database-suite duration ceiling yet: this run records the pilot command duration only, while the required full integration/RLS suite duration must be captured on the assessed revision first.

The sequential-scan plan is a review input for those decisions. It was fast on a shared local fixture with 1,350 background rows, so it does not alone prove that an index or a production change is required.

## R-1109 controlled Auth delivery proof

The local stack already provisions Mailpit on `127.0.0.1:54324`; no Vercel variable, hosted service-role credential, or external SMTP credential is needed for this proof. The smoke sends a real Supabase Auth Admin invite and password-recovery email, reads the received messages through Mailpit's local API, and consumes each one-time Auth verification URL only far enough to verify its redirect to the configured `/auth/invite/confirm` callback plus a unique marker.

```powershell
$env:SUPABASE_TEST_REQUIRED = '1'
node --experimental-strip-types --import ./tests/support/register.mjs scripts/nfr/epic-11-auth-mail-smoke.ts
```

Requirements are the existing local Supabase API, database, Auth, and Mailpit services on their repository-configured loopback ports. The scripts use the committed local test keys only. Do not set `SUPABASE_TEST_URL` or `SUPABASE_TEST_DB_URL` to a hosted address. `SUPABASE_TEST_MAILPIT_URL` is optional only when the guard-owned local Mailpit UI is on a different unauthenticated loopback HTTP port; the smoke rejects any other address before it sends a request.

This helper proves the local Auth-to-Mailpit path, project templates, and Auth callback construction. It does not itself consume the Next.js callback, establish a browser session cookie, or accept an application membership; those require the separate browser/application journey. It also does not prove third-party SMTP deliverability, recipient mailbox acceptance, production provider uptime, or exactly-once delivery. A hosted external-SMTP proof requires an approved non-demo Supabase project and controlled recipient mailbox; neither currently exists.

Earlier 2026-09-14 receipt and 303 observations established local delivery, callback origin/path, and the implicit Auth fragment for invite and recovery. They did **not** safely establish preservation of nested percent-encoded callback context: the original helper decoded the complete verification URL and could promote nested fields into the outer query. The corrected helper decodes only HTML entities and requires two fixed, non-sensitive callback markers plus the run marker to survive each Auth 303. Its final local probe passed for both invite and recovery: `nfrContextA`, `nfrContextB`, and the unique run marker were each verified by parsed callback query parameters, while URLs and fragments remained unlogged.

The initial browser callback journey is retained as historical **RED** evidence: a real invite link reached `/login` because the server callback received neither `code` nor `token_hash` from the implicit fragment. The candidate callback remediation in [PR #62](https://github.com/rthunborg/ElproSaas/pull/62) changes that handoff. The earlier local production-build proof passed **2/2** with zero skips in 12.4 seconds. The final combined local production-build Playwright run, using the CI port `3100` and `SUPABASE_TEST_REQUIRED=1`, ran from `2026-09-14T13:39:02.620Z` to `13:40:58.089Z` against tested app/test code at `d94c593` (only documentation edits were pending): **142 total, 138 passed, four explicit skips, zero failures**, in 1.9 minutes. It included both real Auth journeys plus 136 existing browser tests: Auth-to-Mailpit invitation set the browser cookie and activated the database membership; recovery reached password update followed by a fresh sign-in. The resource-guard stop was accepted. Independent focused review found no consequential finding. This is candidate **GREEN** local application evidence only while PR #62/PR #63 CI, merge, and deployment remain pending.

Read-only inspection also found local Auth allow-list drift: the running service contains only `https://127.0.0.1:3000`, while the committed local configuration also specifies `http://127.0.0.1:3000/auth/invite/confirm`. The drift did not cause the historical callback failure, and the candidate local journey now passes. On 2026-09-14, an authenticated demo-dashboard inspection saved the hosted Site URL as `https://elpro-saas.vercel.app`, retained exactly one hosted redirect URL, `https://elpro-saas.vercel.app/auth/invite/confirm`, and confirmed that the invite and recovery previews use `{{ .ConfirmationURL }}`. Custom SMTP is off, so the platform defaults apply. Confirm-email remains on; anonymous sign-ins and manual linking remain off. This configuration evidence does not prove the deployed application callback, hosted login, or external delivery; none becomes a production PASS from the local proof.

The historical runner-allocation failures remain evidence limits: [PR #62 run 34849927884](https://github.com/rthunborg/ElproSaas/actions/runs/34849927884) at `b9d533d` completed the verify job with **1,756 unit tests passed and zero skips**, but the database and browser jobs had no runner and no steps; [PR #63 run 34849940369](https://github.com/rthunborg/ElproSaas/actions/runs/34849940369) at `d94c593` had no runner, and its skipped dependency job is not coverage. On 2026-09-14 the repository was confirmed public and reruns succeeded. PR #62 run [34851125570](https://github.com/rthunborg/ElproSaas/actions/runs/34851125570) at `2fb018a` passed 1,756 units with zero skips, 1,028 required database/RLS tests with zero skips (Vitest 64.50 seconds), and 138 browser tests passed with four explicit skips and zero failures (2.4 minutes). PR #63 run [34851178821](https://github.com/rthunborg/ElproSaas/actions/runs/34851178821) at pre-retarget head `cb5a1d3` passed 1,756 units with zero skips, 101 database test files / 1,028 tests / zero skips (Vitest 84.67 seconds), and 138 browser tests with four explicit skips and zero failures (2.3 minutes). PR #63 was then retargeted to `main` and cleanly merged with current `origin/main`; its new head requires its own live check result. Runner access is no longer the current blocker.

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
| Required DB execution | PR #62 current-head CI passed 1,028 required database/RLS tests with zero skips. The pre-retarget PR #63 source run passed 101 files / 1,028 tests / zero skips; its retargeted head needs its own live result. | Retain the retargeted PR #63 result and its exact executed/failed/skipped counts. |
| Browser execution | PR #62 current-head CI passed 138 browser tests with four explicit skips and zero failures. The pre-retarget PR #63 source run has the same browser count and outcome. The #62 Production deployment is ready; bounded unauthenticated release probes returned `/login` 200, `/auth/invite/confirm` 307 to the canonical completion route, and that page 200. | Retain the retargeted PR #63 result, then run the authenticated deployed callback/login journey; do not substitute `next dev`. |
| Dependency health | CI blocks `pnpm audit --audit-level=high`. | Record its result from the assessed commit; no new service configuration is required. |
| Deployment availability | The deployed application has a login availability probe and release-window runtime-error inspection. | Owner must decide an uptime/error-rate/MTTR target and monitoring retention/alert policy before these can become PASS evidence. |
| Backup and recovery | The scoped local logical rehearsal now passes with an intact selected schema/data profile and no remaining scratch database. Demo backup inventory remains empty and point-in-time recovery is disabled. | Choose RPO/RTO and a hosted backup/recovery policy before claiming production recovery evidence. |
| Coverage and duplication | Traceability, deterministic harness enrollment, typecheck, lint, and audit gates exist; percentage/trend targets do not. | Owner decides whether a quantitative coverage and duplication metric is required for this pilot; if yes, select a tool and threshold in a separate process change. |

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

# Pilot Operations Runbook

Status: tooling prepared for the `elpro-saas` internal pilot. It becomes an
operational control only after the owner completes the repository-secret and
notification setup below, runs a successful backup, proves notification
delivery, and records a successful isolated restore rehearsal.

## Targets and what is measured

| Target | Implemented control | Evidence / limit |
| --- | --- | --- |
| 99.5% monthly availability | `pilot-availability.yml` probes the public login route every five minutes and keeps each sample for 30 days. | This is a sampled synthetic check, not a complete availability measurement. |
| Server errors below 1% | Each probe records a 5xx response as failed. | A single `/login` sample cannot calculate the error rate across all requests or authenticated commands. Review Vercel runtime logs separately before reporting this target as met. |
| Alert after three consecutive failures | The workflow turns red only after the current plus two immediately preceding scheduled samples failed. | GitHub may notify the account that owns the schedule according to its notification settings. Delivery to the owner-controlled Gmail mailbox remains unverified until the owner performs a controlled three-failure test. |
| Daily encrypted backup, seven daily copies | `pilot-backup.yml` captures a Storage inventory before the database dump, requires it to match before and after byte export, then creates a relative-path checksum manifest, encrypts the archive on the runner, uploads it to the configured private Drive folder, and deletes tagged copies older than the newest seven. | A concurrent Storage object or metadata change fails the run rather than creating a mixed database/byte backup. No database dump, Storage object, access token, or encrypted backup is uploaded to GitHub Actions artifacts. |
| RPO 24 hours / RTO 4 hours | The backup schedule is daily and a monthly isolated restore is required. | Neither RPO nor RTO is certified until a successful monthly restore measures both the newest backup age and restore time. |
| Additional spend at most 100 SEK/month | The implementation uses standard GitHub-hosted Linux runners, existing Supabase Free resources, and existing Workspace Drive capacity. | Recheck usage and quotas before activation. An oversize database/Storage export, Free-plan egress, or a Drive storage upgrade can invalidate the cost assumption. |

GitHub's shortest supported schedule interval is five minutes, but it also warns
that scheduled jobs can be delayed or dropped under load. The monitor therefore
uses an offset cadence (minutes 2, 7, 12, ...) to avoid the top of the hour and
is explicitly a best-effort pilot monitor. It cannot prove a hard five-minute
check interval or independently certify the 99.5% target. Vercel Hobby cannot
replace it: its cron jobs are limited to once daily and can be invoked anywhere
within the selected hour.

GitHub also automatically disables scheduled workflows in public repositories
after 60 days without repository activity. A disabled scheduler cannot report
its own absence. Before treating either workflow as an operational control, the
owner must create an independently maintained monthly calendar reminder outside
GitHub. On that reminder, verify in the Actions UI that both workflows remain
enabled on `main`, that the latest availability run is recent, and that the
latest backup run completed within the last 24 hours. Record the check date,
run URLs, and any remediation in the pilot operations evidence; do not record
customer data or secrets. This owner check is required even in a quiet month.

## One-time owner setup

Do this only on `main`, after reviewing the workflow files. The current Drive
connector is linked to a private Gmail account and does not expose an approved
Enhancior Workspace backup folder, so it must not be used for pilot data.

1. Create a dedicated private folder in the owner-approved Enhancior Workspace
   Drive location. Do not use a personal Drive folder or a folder shared more
   broadly than the pilot recovery operators. Record its folder ID only as a
   GitHub secret, `BACKUP_DRIVE_FOLDER_ID`.
2. Choose and configure an owner-controlled Google OAuth client that can upload
   to that folder. Grant only the Drive file scope needed for files created by
   this backup integration, obtain an offline refresh token for the approved
   Workspace account, and add these GitHub repository secrets:

   - `GOOGLE_DRIVE_CLIENT_ID`
   - `GOOGLE_DRIVE_CLIENT_SECRET`
   - `GOOGLE_DRIVE_REFRESH_TOKEN`
   - `BACKUP_DRIVE_FOLDER_ID`

   The repository does not assume a service account, domain-wide delegation,
   or a personal Drive destination. The upload script marks only its own files
   and refuses to prune a file whose marker or parent folder no longer matches.
3. Add the remaining repository secrets. Keep all values out of terminal
   output, workflow logs, artifacts, commits, and issue text.

   - `SUPABASE_BACKUP_DB_URL`: a TLS database connection string with the
     documented backup/restore privileges for `elprosaas-demo`. It must use the
     either the exact direct host `db.wmqmzznmwpheswjjozhq.supabase.co` with
     user `postgres`, or a Supabase shared session-pooler host on
     `*.pooler.supabase.com` with user `postgres.wmqmzznmwpheswjjozhq`; both
     forms require port/database 5432/`postgres` and `sslmode=require` (or TLS
     verification). GitHub-hosted runners are IPv4-only, so use the shared
     session pooler unless the direct host has approved IPv4 connectivity. Do
     not reuse it in application code.
   - `SUPABASE_URL`: `https://wmqmzznmwpheswjjozhq.supabase.co`.
   - `SUPABASE_SERVICE_ROLE_KEY`: server-only key used solely by the runner's
     Storage export. It is never exposed to a browser or an artifact.
   - `BACKUP_GPG_PASSPHRASE`: an independently stored, high-entropy recovery
     passphrase. Give recovery operators an escrowed copy separate from the
     Drive account; a Drive account alone must not decrypt a backup.
4. Add these repository variables:

   - `BACKUP_MAX_STORAGE_BYTES`: a deliberately conservative integer ceiling
     for one full Storage export. The backup lists object metadata and fails
     before downloading any object when this ceiling would be exceeded. It must
     leave room for 30 daily exports, database traffic, and Drive retention.
   - `ELPRO_MONITOR_URL`: the deployed public HTTPS login URL, for example
     `https://elpro-saas.vercel.app/login`. The monitored route must return 200
     without authenticating or changing data.
   - `PILOT_BACKUP_ENABLED`: leave unset while the backup destination and
     credentials are being prepared. Scheduled runs execute only when this is
     exactly `true`; a manual **Pilot encrypted backup** dispatch remains
     available for setup and fails loudly if a required secret is missing.
5. Configure GitHub Actions failure notifications for the account that owns
   the workflow schedule so they arrive at the owner-controlled Gmail mailbox.
   GitHub associates scheduled-workflow notifications with the account that
   last changes the cron syntax, subject to that account's notification
   settings. After merge, have that owner manually dispatch **Pilot availability
   monitor** with the `alert_test` checkbox selected. That isolated job evaluates
   simulated first, second, and third failed samples, retains a separately named
   `pilot-availability-alert-test-*` artifact, then deliberately fails only
   after the simulated third sample. It neither calls the monitored URL nor
   writes scheduled-history artifacts. Verify mailbox receipt before recording
   the alert as delivered.
   No SMTP, Vercel environment variable, or arbitrary webhook is required or
   configured by this repository.
6. Run **Pilot encrypted backup** manually on `main`. Confirm that the Drive
   folder contains one `.tar.gz.gpg` file, no unencrypted archive, and the
   GitHub run contains no secrets or object names. The workflow fails loudly
   when any required secret is missing, the dump/export fails, encryption
   fails, or Drive upload fails.
7. Complete the isolated restore rehearsal below using that backup and record
   its duration and backup age. Only then set `PILOT_BACKUP_ENABLED` to `true`
   to enable the daily schedule. Do not enable it merely because secrets have
   been entered: the owner must also have completed the controlled
   three-failure notification test in step 5 and verified mailbox delivery.
8. Create the independent monthly scheduler-freshness calendar reminder
   described above. Its owner must have access to both the Actions UI and the
   controlled pilot operations evidence record.

The workflow retains the seven newest *successful* tagged uploads. A missed
daily backup leaves the prior copies intact but immediately violates the
24-hour RPO target; investigate the red scheduled run rather than treating
the existence of seven older copies as compliance.

## Capacity, roles, and configuration limits

Before the first scheduled run, record the `bytes` total in the generated
Storage manifest and the encrypted archive size. Seven retained Drive copies
need approximately seven times the encrypted archive size, plus Drive's normal
headroom. Every daily run reads the current Storage bytes again: thirty daily
exports of `S` Storage bytes consume roughly `30 × S` of outbound transfer
before database-dump overhead. Supabase currently lists 1 GB of Free Storage
and 5 GB/month of Free egress, so a pilot that stores more than about 167 MB
of bytes and exports all of them every day can exceed the egress allowance even
before database traffic. The required `BACKUP_MAX_STORAGE_BYTES` variable
makes the workflow fail before any object-byte transfer if the planned export
grows beyond its approved cap. Do not claim the 100 SEK/month ceiling until the
measured archive size and transfer use fit the existing Workspace and Supabase
allowances; pause the schedule and choose a funded backup architecture if they
do not.

The database URL must have the documented privileges to make the separate
role/schema/data dumps. The Storage API has no narrower backup-reader role in
the current application configuration, so the export uses the server-only
Supabase service-role key. That key bypasses Storage RLS and must be available
only to the protected GitHub Actions environment/repository secret used by
this workflow. It is not an application environment variable, a browser value,
or an artifact. A workflow change that can read this secret is privileged and
requires the same review rigor as a production data-access change.

The backup workflow pins each third-party action to a reviewed full commit SHA.
No backup secret is job-scoped: the database URL is present only for the dump,
the service-role key and byte ceiling only for the Storage export, the GPG
passphrase only for encryption, and the Drive OAuth values only for upload and
retention. Preserve both properties when updating the workflow.

The archive captures logical database contents and Storage object bytes. It
does not by itself recreate a hosted Supabase project, database platform roles
and passwords, a Vercel deployment/environment, Google OAuth configuration,
Supabase Auth SMTP/OAuth provider setup, Vault/root-key material, DNS, or user
sessions. Configure and validate those recovery-target prerequisites separately
before treating an isolated restore as a usable application recovery.

## Monthly isolated restore rehearsal

Never restore into `elprosaas-demo`, run `supabase db reset --linked`, or
replace the current demo project. A restore is destructive to its target and
the target must be a dedicated, empty recovery project or an isolated local
database with no connection to the demo database.

1. Download the newest encrypted archive from the approved Drive folder to a
   controlled recovery workstation. Verify that it is the expected date and
   decrypt it there with the escrowed passphrase. Before using its contents,
   run `(cd backup-workspace && sha256sum --check SHA256SUMS)` from the
   decrypted archive parent. Run `node scripts/ops/verify-backup-checksums.mjs
   backup-workspace` from the repository checkout; it fails for a missing,
   malformed, escaped, or corrupted archive member.
2. Provision and verify an isolated target. Record its project/ref separately;
   do not place it in the repository or these workflows. Confirm its database
   URL points to the isolated target before each restore command.
3. Follow Supabase's current logical restore procedure for the selected target:
   restore roles/schema/data in the required order, account for custom
   `auth`/`storage` schema changes, and restore Storage object bytes from
   `backup-workspace/storage/manifest.json` with an owner-authorized recovery
   credential. Restore only configuration and secrets that are explicitly
   approved for the recovery target; a database dump does not make a copied
   Vercel deployment, Auth provider configuration, or encryption-root setup
   usable by itself.
4. Compare the migration ledger, tenant/membership counts, and a tenant-safe
   integrity digest against the backup source. Confirm expected Storage object
   count and byte totals from the manifest. Record only aggregate evidence and
   duration, never customer bytes, signed URLs, database URLs, bearer tokens,
   or passphrases.
5. Measure from recovery declaration to a verified isolated application check.
   Record whether it completed within four hours and whether the newest backup
   was less than 24 hours old. Stop and decommission the isolated recovery
   target through the owner's normal process after evidence is recorded.

The existing local rehearsal in
[`epic-11-nfr-evidence-runbook.md`](../quality/epic-11-nfr-evidence-runbook.md)
is useful evidence for a dependency-ordered logical database restore. It does
not prove hosted backup recovery, platform-role bootstrap, Storage byte
recovery, or this RPO/RTO target.

## Suggested Review Order

Author: Codex pilot-operations implementation agent.
Refreshed against the final uncommitted pilot-operations worktree on 2026-09-14.

### Backup capture and sensitive trust boundary

The workflow pins its setup actions and scopes each credential to the one shell
step that needs it. It explicitly captures the managed Auth/Storage schemas and
preflights the complete Storage-object plan before any object bytes transfer.

- `.github/workflows/pilot-backup.yml:21` — `vars.PILOT_BACKUP_ENABLED == 'true'`: keeps the daily schedule disabled until the owner has completed the activation evidence, while retaining manual setup dispatches.
- `.github/workflows/pilot-backup.yml:25` — `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683`: uses an immutable reviewed action revision before any secret-scoped step.
- `.github/workflows/pilot-backup.yml:64` — `schema_args=`: includes `public`, `auth`, `storage`, and `supabase_migrations` in both schema and data dumps.
- `.github/workflows/pilot-backup.yml:72` — `BACKUP_MAX_STORAGE_BYTES`: limits the Storage export before object download.
- `scripts/ops/export-supabase-storage.mjs:72` — `planStorageExport`: recursively lists every object and records byte sizes before export.

### Encrypted off-site lifecycle

The runner checksums and encrypts before Drive transfer; the upload is streamed
through a resumable session that resumes from Drive's acknowledged byte range,
and retention deletes only tagged archives returned from the exact configured
folder.

- `.github/workflows/pilot-backup.yml:94` — `Upload encrypted archive and retain seven newest copies`: exposes Drive OAuth secrets only to the encrypted-upload step.
- `scripts/ops/google-drive-backup.mjs:8` — `DRIVE_UPLOAD_API`: starts a resumable Drive upload for archives of any size.
- `scripts/ops/google-drive-backup.mjs:10` — `UPLOAD_CHUNK_BYTES`: streams fixed-size chunks with resumable `Content-Range` boundaries.
- `scripts/ops/google-drive-backup.mjs:88` — `response.headers.get('range')`: resumes from Drive's acknowledged persisted byte range and bounds a no-progress retry.
- `scripts/ops/verify-backup-checksums.mjs:25` — `verifyBackupChecksums`: rejects a missing or corrupted decrypted archive member.

### Best-effort monitoring and evidence limits

The alert threshold is derived from the newest artifacts by timestamp rather
than API response order. The runbook keeps the unmeasured server-error rate,
GitHub schedule gaps, notification delivery, and owner setup explicit.

- `.github/workflows/pilot-availability.yml:67` — `gh api --paginate --slurp`: collects every page of scheduled-result artifacts before selection.
- `.github/workflows/pilot-availability.yml:106` — `Simulate first, second, and third failed samples with the production evaluator`: provides the isolated manual notification-delivery test without probing the public URL or changing scheduled history.
- `scripts/ops/availability-history.mjs:24` — `newestArtifactUrls`: sorts valid result artifacts by `created_at` and excludes the current run.
- `docs/process/pilot-operations-runbook.md:19` — `GitHub's shortest supported schedule interval`: states the five-minute scheduler cannot certify a hard availability SLO.
- `docs/process/pilot-operations-runbook.md:27` — `GitHub also automatically disables scheduled workflows`: requires the independent monthly owner freshness control.

### Evidence

The focused mock-transport suite exercises alert/recovery/history ordering,
Storage pagination and escape rejection, no-transfer byte-cap enforcement,
partial-ack resumable-upload/no-prune behavior, exact seven-copy retention, and
missing/corrupt checksum rejection.

- `tests/unit/ops/pilot-operations.test.ts:36` — `availability history alerts`: pins the three-failure alert and recovery reset.
- `tests/unit/ops/pilot-operations.test.ts:45` — `chooses the two newest`: pins timestamp ordering instead of artifact API order.
- `tests/unit/ops/pilot-operations.test.ts:148` — `partially acknowledged streaming boundary`: proves the next Drive chunk starts at the persisted byte range rather than the planned chunk boundary.
- `tests/unit/ops/pilot-operations.test.ts:207` — `workflow-format checksum generation`: proves the generated relative checksum manifest verifies after extraction.

Evidence: `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/ops/pilot-operations.test.ts` passed 10/10 after the final activation-gate and log-redaction changes; ESLint for `scripts/ops` and this suite, `tsc --noEmit`, and the review-order checker also passed.

Limits: tests use mock Storage and HTTP transports; no Drive folder/OAuth credential, Supabase backup credential, encrypted upload, hosted restore, Gmail notification, 30-day observation, or server-error denominator has been exercised. The owner must complete the setup, monthly independent scheduler check, and isolated restore rehearsal before claiming the targets.

## Provider references

- [GitHub scheduled workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
  documents the five-minute minimum, the possibility of delayed or dropped
  scheduled jobs, and the 60-day public-repository inactivity disablement.
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
  documents free standard hosted runners for public repositories.
- [Vercel cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
  documents the Hobby daily-only limitation and imprecise timing.
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
  recommends Free projects create CLI logical dumps and keep off-site backups;
  it also states database backups do not include Storage objects.
- [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase)
  lists the Free plan's current database, Storage, and egress allowances.
- [Google Drive uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
  documents the resumable upload session used for encrypted archives of any size.

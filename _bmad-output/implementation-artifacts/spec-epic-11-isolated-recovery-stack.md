---
title: 'Add isolated Supabase recovery stack and Storage restore helper'
type: 'feature'
created: '2026-09-15'
status: 'done'
route: 'plan-code-review'
baseline_commit: '6396894c268667ed32177283d21c8b8818f73f1f'
---

# Add isolated Supabase recovery stack and Storage restore helper

## Intent

**Problem:** The encrypted pilot backup can be decrypted and checksum-verified, but the repository lacks an executable isolated Supabase recovery target and the Storage-byte restore inverse needed for a complete rehearsal.

**Approach:** Add pinned, guard-compatible Docker Compose sources with a static base and ignored literal private overrides. Start PostgreSQL alone before the logical restore, remove only verified-empty image schemas, reapply runtime credentials after the dump, then start the full runtime on the same named volumes. A main-only manual GitHub workflow runs that sequence on an ephemeral runner and emits aggregate evidence only.

## Suggested Review Order

### Isolated runtime boundary

The Compose target pins upstream Supabase-compatible images, keeps restored state in a fresh project-scoped named volume set, disables restored cron and HTTP queue dispatch, and places the project name, ports, and credentials only in ignored literal private files because the guard rejects Compose interpolation.

- `ops/recovery/compose.db-bootstrap.yaml:1` — database-only source prevents Auth and Storage migrations before the logical restore.
- `ops/recovery/bootstrap-roles.sql:4` — supplies the local password bootstrap and database JWT settings required by Auth, REST, and Storage; the workflow reapplies it after the role dump.
- `ops/recovery/prepare-empty-restore-target.sql:4` — verifies the target has no user, Storage, or tenant rows before removing only image-provided schemas that would collide with the full source dump.
- `ops/recovery/compose.yaml:1` — full Auth, REST, Storage, and gateway runtime uses the restored database volume, disables `pg_cron`/`pg_net` dispatch, is Docker-internal, and has no fixed project name or port.
- `ops/recovery/runtime.private.compose.example.yaml:4` — the private runtime override gives one fresh project name and loopback-only high ports.
- `ops/recovery/compose.yaml:47` — `storage`: pairs the restored database with a named-volume file backend.
- `ops/recovery/compose.yaml:73` — `gateway`: exposes the recovered Auth, REST, and Storage services through the private loopback API port.
- `ops/recovery/kong.yml:4` — `services`: maps only the required Supabase API prefixes.

### Manifest-driven byte recovery

The restore helper treats the database restore as bucket metadata authority and uploads only archive-verified object bytes to an isolated target.

- `scripts/ops/restore-supabase-storage.mjs:43` — `assertIsolatedRecoveryUrl`: rejects demo and external targets before backup access.
- `scripts/ops/restore-supabase-storage.mjs:79` — `assertStorageManifestIsChecksummed`: requires an exact match between manifest objects and checksummed Storage members.
- `scripts/ops/restore-supabase-storage.mjs:132` — `verifyRestoredObject`: verifies downloaded restored bytes plus preserved MIME/cache metadata without following redirects.
- `scripts/ops/restore-supabase-storage.mjs:154` — `restoreStorageManifest`: verifies `SHA256SUMS`, checks local byte counts, performs per-object upserts, and verifies every restored byte stream.

### Operator execution and evidence

The runbook supplies the guard request fields without embedding actor context or credentials, and tests use synthetic workspace bytes with a mocked loopback transport.

- `.github/workflows/pilot-isolated-recovery-rehearsal.yml:15` — main-only manual dispatch prevents scheduled or branch secret execution.
- `.github/workflows/pilot-isolated-recovery-rehearsal.yml:75` — target preflight, exact dump restore, replication-role data load, and post-dump credential/JWT reapply remain generic in public logs.
- `.github/workflows/pilot-isolated-recovery-rehearsal.yml:103` — Storage byte/MIME verification, archive COPY-count comparison, synthetic Auth sign-in, and aggregate-only evidence.
- `scripts/ops/download-google-drive-backup.mjs:10` — downloads only the newest Drive-owned, tagged ciphertext from the exact Drive folder.
- `scripts/ops/write-recovery-runtime-config.mjs:14` — writes per-run private literal credentials and project configuration without logging secrets.
- `scripts/ops/verify-isolated-recovery-copy-counts.mjs:33` — compares required archive COPY totals against restored aggregates.
- `scripts/ops/verify-isolated-auth-rls.mjs:17` — creates then removes a synthetic isolated Auth account and requires it to see zero tenant rows through REST and no membership through the tenant-isolation RPC.
- `tests/unit/ops/pilot-operations.test.ts:157` — Storage restore proves byte, MIME/cache, and redirect preservation.
- `tests/unit/ops/pilot-operations.test.ts:240` — private runtime configuration creates isolated literal values without touching source paths.
- `tests/unit/ops/pilot-operations.test.ts:263` — Drive download accepts only the latest marked file and disables redirects.
- `tests/unit/ops/pilot-operations.test.ts:286` — COPY-count comparison fails for a restored aggregate mismatch.
- `tests/unit/ops/pilot-operations.test.ts:303` — Auth check proves a disposable signed-in account gets no tenant REST rows or membership-RPC access.

**Evidence:** focused ops tests passed 22/22; `pnpm typecheck`, `pnpm verify:lockfiles`, the review-order checker, and both Compose source combinations rendered with synthetic ignored private files. No container, archive, credential, hosted recovery target, or GitHub recovery workflow was run. The owner must manually dispatch the reviewed workflow from `main` before claiming recovery evidence.

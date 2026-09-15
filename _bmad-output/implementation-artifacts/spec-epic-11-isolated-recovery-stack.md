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

**Approach:** Add pinned, guard-compatible Docker Compose sources with a static base and ignored literal private overrides. Start PostgreSQL alone before the logical restore, then start the full runtime on the same named volumes. Restore only current manifest-listed Storage bytes after archive-wide checksum verification, reject all non-loopback targets, and keep all recovery values outside Git.

## Suggested Review Order

### Isolated runtime boundary

The Compose target pins upstream Supabase-compatible images, keeps restored state in a fresh project-scoped named volume set, and places the project name, ports, and credentials only in ignored literal private files because the guard rejects Compose interpolation.

- `ops/recovery/compose.db-bootstrap.yaml:1` — database-only source prevents Auth and Storage migrations before the logical restore.
- `ops/recovery/bootstrap-roles.sql:4` — supplies the local password bootstrap required by Auth, REST, and Storage service roles on a new volume.
- `ops/recovery/compose.yaml:1` — full Auth, REST, Storage, and gateway runtime uses the restored database volume and no fixed project name or port.
- `ops/recovery/runtime.private.compose.example.yaml:4` — the private runtime override gives one fresh project name and loopback-only high ports.
- `ops/recovery/compose.yaml:47` — `storage`: pairs the restored database with a named-volume file backend.
- `ops/recovery/compose.yaml:73` — `gateway`: exposes the recovered Auth, REST, and Storage services through the private loopback API port.
- `ops/recovery/kong.yml:4` — `services`: maps only the required Supabase API prefixes.

### Manifest-driven byte recovery

The restore helper treats the database restore as bucket metadata authority and uploads only archive-verified object bytes to an isolated target.

- `scripts/ops/restore-supabase-storage.mjs:42` — `assertIsolatedRecoveryUrl`: rejects demo and external targets before backup access.
- `scripts/ops/restore-supabase-storage.mjs:55` — `readStorageManifest`: accepts the current `{ exported_at, objects }` export format and rejects unsafe or duplicate entries.
- `scripts/ops/restore-supabase-storage.mjs:78` — `assertStorageManifestIsChecksummed`: requires an exact match between manifest objects and checksummed Storage members.
- `scripts/ops/restore-supabase-storage.mjs:96` — `readRestoredObjectMetadata`: reads existing local Storage metadata before byte upsert and fails on redirects.
- `scripts/ops/restore-supabase-storage.mjs:125` — `restoreStorageManifest`: verifies `SHA256SUMS`, preserves MIME/cache metadata, checks local byte counts, then performs per-object upserts.

### Operator execution and evidence

The runbook supplies the guard request fields without embedding actor context or credentials, and tests use synthetic workspace bytes with a mocked loopback transport.

- `docs/process/pilot-operations-runbook.md:237` — first `ComposeUp`: DB-only guard request and private literal configuration boundary.
- `docs/process/pilot-operations-runbook.md:262` — second `ComposeUp`: full runtime starts only after roles/schema/data restoration.
- `tests/unit/ops/pilot-operations.test.ts:155` — `Storage restore uploads`: proves object path, bytes, preserved MIME/cache headers, and redirect refusal from checksummed manifest input.
- `tests/unit/ops/pilot-operations.test.ts:188` — `Storage restore refuses`: proves external and low-port endpoints fail before reading a backup.
- `tests/unit/ops/pilot-operations.test.ts:194` — `Storage restore refuses a manifest object missing from SHA256SUMS`: proves an archive cannot supply an unchecked object for upload.
- `tests/unit/ops/pilot-operations.test.ts:212` — private Compose source test: prevents a regression to interpolation or fixed shared runtime settings.

**Evidence:** focused ops tests passed 18/18; `pnpm typecheck` and both Compose source combinations rendered with synthetic ignored private files. No container, archive, credential, or hosted recovery target was run. The owner must restore roles/schema/data into the empty guarded stack and verify the recovered application separately.

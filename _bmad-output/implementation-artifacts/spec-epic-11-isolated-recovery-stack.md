---
title: 'Add isolated Supabase recovery stack and immutable Storage backend restore'
type: 'feature'
created: '2026-09-15'
status: 'done'
route: 'plan-code-review'
baseline_commit: '6396894c268667ed32177283d21c8b8818f73f1f'
---

# Add isolated Supabase recovery stack and immutable Storage backend restore

## Intent

**Problem:** The encrypted pilot backup can be decrypted and checksum-verified, but the repository lacks an executable isolated Supabase recovery target and the Storage-byte restore inverse needed for a complete rehearsal.

**Approach:** Add pinned, guard-compatible Docker Compose sources with a static base and ignored literal private overrides. Start PostgreSQL alone before the logical restore, remove only verified-empty image schemas, reapply runtime credentials after the dump, then materialize versioned Storage backend files without changing the restored database rows, and start the full runtime on the same named volumes. A main-only manual GitHub workflow runs that sequence on an ephemeral runner and emits aggregate evidence only.

## Suggested Review Order

### Isolated runtime boundary

The Compose target pins upstream Supabase-compatible images, keeps restored state in a fresh project-scoped named volume set, disables restored cron and HTTP queue dispatch, and places the project name, ports, and credentials only in ignored literal private files because the guard rejects Compose interpolation.

- `ops/recovery/compose.db-bootstrap.yaml:1` — database-only source preserves the pinned image required `/etc/postgresql` config directory and prevents Auth and Storage migrations before the logical restore.
- `ops/recovery/bootstrap-roles.sql:4` — supplies the local password bootstrap and database JWT settings required by Auth, REST, and Storage; the workflow reapplies it after the role dump.
- `ops/recovery/prepare-empty-restore-target.sql:4` — verifies the target has no user, Storage, or tenant rows before removing only image-provided schemas that would collide with the full source dump.
- `ops/recovery/compose.yaml:1` — full Auth, REST, Storage, and gateway runtime uses the restored database volume, disables `pg_cron`/`pg_net` dispatch, is Docker-internal, and has no fixed project name or port.
- `ops/recovery/runtime.private.compose.example.yaml:4` — the private runtime override gives one fresh project name and loopback-only high ports.
- `ops/recovery/compose.yaml:47` — `storage`: pairs the restored database with a named-volume file backend.
- `ops/recovery/compose.yaml:74` — `gateway`: exposes the recovered Auth, REST, and Storage services through the private loopback API port.
- `ops/recovery/kong.yml:4` — `services`: maps only the required Supabase API prefixes.

### Manifest-driven immutable byte recovery

Logical recovery restores the complete `storage.objects` rows first. A pinned, no-network loader then validates a database-derived plan against the archive and writes only absent version-addressed backend bytes/xattrs. It never invokes an API upsert or modifies row metadata, identifiers, versions, owners, or immutable file markers.

- `ops/recovery/compose.storage-loader.yaml:2` — `storage-loader`: pins the short-lived loader to the same project-scoped Storage volume and mounts only its checked-in script.
- `ops/recovery/restore-storage-file-backend.py:112` — `copy_exclusive`: uses `O_EXCL`, expected byte counts, and `fsync`, refusing an occupied backend key.
- `ops/recovery/restore-storage-file-backend.py:160` — `os.setxattr`: writes the v1.74.0 Linux MIME/cache attributes without a database/API update.
- `ops/recovery/compose.yaml:62` — `TUS_USE_FILE_VERSION_SEPARATOR`: fixes the physical key convention to `-$v-<storage.objects.version>` for loader and Storage API agreement.
- `scripts/ops/restore-supabase-storage.mjs:97` — `readRestoredObjectMetadata`: reads the API’s top-level `content_type`/`cache_control`; nested `metadata` is preserved user metadata.
- `scripts/ops/restore-supabase-storage.mjs:192` — `restoreStorageManifest`: verifies checksummed local bytes by downloading from a loopback-only API and performs no mutation.

### Operator execution and evidence

The runbook supplies the guard request fields without embedding actor context or credentials. A separate no-secret PR job restores current schemas into a fresh recovery Compose target and runs a synthetic absent-byte fixture through the exact loader and Storage API.

- `.github/workflows/ci.yml:208` — `recovery-storage-loader`: executes the no-secret PR gate only after fast verification succeeds.
- `.github/workflows/ci.yml:241` — `Dump synthetic recovery schema source`: takes only the local CI schema plus Storage bucket seed, never a hosted database or backup archive.
- `.github/workflows/ci.yml:251` — `Start database-only isolated recovery target`: prints bounded, credential-redacted Postgres startup diagnostics only for the fresh synthetic CI target before any restore input exists.
- `.github/workflows/ci.yml:279` — `Prove physical Storage loader preserves protected rows`: snapshots complete seeded logical rows before bytes exist, invokes the exact pinned loader, then runs the real API/trigger proof.
- `.github/workflows/pilot-isolated-recovery-rehearsal.yml:15` — main-only manual dispatch prevents scheduled or branch secret execution for the owner backup drill.
- `.github/workflows/pilot-isolated-recovery-rehearsal.yml:100` — derives the exact archive restore plan and full-row digest before loader materialization.
- `scripts/ops/write-isolated-recovery-storage-fixture.mjs:23` — `writeIsolatedRecoveryStorageFixture`: generates only two randomized synthetic linked/quote-PDF logical rows and absent backend bytes.
- `tests/integration/ops/recovery-storage-immutability.int.test.ts:99` — `isolated recovery Storage physical-loader proof`: compares the pre-loader full-row snapshot after loader readback and after each rejected ordinary upsert, with real MIME/cache/user metadata and bytes for both linked generic and quote-PDF objects.
- `tests/unit/ops/isolated-recovery-storage.test.ts:16` — pins the exact `-$v-<version>` filename, both Linux xattrs, and exclusive no-overwrite behavior.
- `scripts/ops/write-recovery-runtime-config.mjs:14` — writes per-run private literal credentials and project configuration without logging secrets.
- `scripts/ops/verify-isolated-recovery-copy-counts.mjs:33` — compares required archive COPY totals against restored aggregates.
- `scripts/ops/verify-isolated-auth-rls.mjs:17` — creates then removes a synthetic isolated Auth account and requires it to see zero tenant rows through REST and no membership through the tenant-isolation RPC.

**Evidence:** author executed the changed pure Node subset on Windows: 23 passed, 0 failed, 1 explicit Linux-xattr skip. The synthetic physical-loader/API/trigger proof is required in the new Ubuntu PR-CI job and has not been executed by this author. A prior 1/1 local trigger/API check used a pre-existing stack without resource ownership evidence; it is explicitly excluded from evidence. No owner archive, credential, hosted recovery target, or main-only recovery workflow was run. The owner must manually dispatch the reviewed main-only workflow before claiming backup recovery evidence.

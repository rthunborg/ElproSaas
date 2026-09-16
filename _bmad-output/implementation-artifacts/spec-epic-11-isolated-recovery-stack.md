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

**Approach:** Add pinned, guard-compatible Docker Compose sources with a static base and ignored literal private overrides. Start PostgreSQL alone before the logical restore, remove only verified-empty image schemas, restore the Auth and Storage migration ledgers that the Supabase CLI deliberately omits, reapply runtime credentials after the dump, then materialize versioned Storage backend files without changing the restored database rows, and start the full runtime on the same named volumes. A main-only manual GitHub workflow runs that sequence on an ephemeral runner and emits aggregate evidence only.

## Suggested Review Order

### Isolated runtime boundary

The Compose target pins upstream Supabase-compatible images, keeps restored state in a fresh project-scoped named volume set, disables restored cron and HTTP queue dispatch, and places the project name, ports, and credentials only in ignored literal private files because the guard rejects Compose interpolation.

- `ops/recovery/compose.db-bootstrap.yaml:1` — database-only source preserves the pinned image required `/etc/postgresql` config directory; the pinned `supabase_admin` administrative principal owns the image schemas used by logical restore.
- `ops/recovery/bootstrap-roles.sql:5` — fails if any of the exact pinned-image login roles used by Auth, REST, and Storage is absent, then idempotently resets only those generated recovery passwords; the workflow reapplies it after the role dump.
- `ops/recovery/prepare-empty-restore-target.sql:4` — verifies the target has no user, Storage, or tenant rows before removing only image-provided schemas that would collide with the full source dump.
- `ops/recovery/compose.yaml:1` — full Auth, REST, Storage, and gateway runtime uses the restored database volume, disables `pg_cron`/`pg_net` dispatch, and has no fixed project name or port.
- `ops/recovery/compose.yaml:92` — `gateway-ingress`: only gateway joins the project-scoped ingress bridge so its private loopback port is published; DB, Auth, REST, Storage, and loader remain on the Docker-internal default network.
- `ops/recovery/runtime.private.compose.example.yaml:4` — the private runtime override gives one fresh project name and loopback-only high ports.
- `ops/recovery/compose.yaml:47` — `storage`: pairs the restored database with a named-volume file backend.
- `ops/recovery/compose.yaml:74` — `gateway`: exposes the recovered Auth, REST, and Storage services through the private loopback API port.
- `ops/recovery/kong.yml:4` — `services`: maps only the required Supabase API prefixes.

### Manifest-driven immutable byte recovery

Logical recovery restores the complete `storage.objects` rows first. A pinned, no-network loader then validates a database-derived plan against the archive and writes only absent version-addressed backend bytes/xattrs below the fixed Storage runtime `stub/stub` prefix. It never invokes an API upsert or modifies row metadata, identifiers, versions, owners, or immutable file markers.

- `ops/recovery/compose.storage-loader.yaml:2` — `storage-loader`: pins the short-lived loader to the same project-scoped Storage volume and mounts only its checked-in script.
- `ops/recovery/restore-storage-file-backend.py:31` — `recovery_runtime_prefix`: validates the fixed `stub/stub` Storage tenant location used by the isolated runtime, never an application tenant UUID.
- `ops/recovery/restore-storage-file-backend.py:122` — `copy_exclusive`: uses `O_EXCL`, expected byte counts, and `fsync`, refusing an occupied backend key.
- `ops/recovery/restore-storage-file-backend.py:170` — `os.setxattr`: writes the v1.74.0 Linux MIME/cache attributes without a database/API update.
- `ops/recovery/compose.yaml:62` — `TUS_USE_FILE_VERSION_SEPARATOR`: fixes the physical key convention to `-$v-<storage.objects.version>` for loader and Storage API agreement.
- `scripts/ops/restore-supabase-storage.mjs:97` — `readRestoredObjectMetadata`: reads the API’s top-level `content_type`/`cache_control`; nested `metadata` is preserved user metadata.
- `scripts/ops/restore-supabase-storage.mjs:192` — `restoreStorageManifest`: verifies checksummed local bytes by downloading from a loopback-only API and performs no mutation.

### Operator execution and evidence

The runbook supplies the guard request fields without embedding actor context or credentials. A separate no-secret PR job restores current schemas into a fresh recovery Compose target and runs a synthetic absent-byte fixture through the exact loader and Storage API.

- `.github/workflows/ci.yml:208` — `recovery-storage-loader`: executes the no-secret PR gate only after fast verification succeeds.
- `.github/workflows/ci.yml:241` — `Dump synthetic recovery schema source`: takes the local CI application schemas plus the declared `test_support` dependency. Native `pg_dump` separately captures the Auth and Storage ledgers that the CLI deliberately excludes, then the source-side nonempty count/digest guard rejects an incomplete synthetic input.
- `.github/workflows/ci.yml:261` — `Start database-only isolated recovery target`: prints bounded, credential-redacted Postgres startup diagnostics only for the fresh synthetic CI target before any restore input exists.
- `.github/workflows/ci.yml:274` — `Restore synthetic schema source`: restores both reserved ledgers and requires their aggregate equality before the pinned runtime can start.
- `.github/workflows/ci.yml:287` — `Start pinned isolated Storage loader and runtime`: captures the actual Compose port query and container binding, requires its loopback Storage status route before the proof, and prints bounded, credential-redacted diagnostics if the mapping or route is unavailable.
- `.github/workflows/ci.yml:330` — `Prove physical Storage loader preserves protected rows`: snapshots complete seeded logical rows before bytes exist, emits synthetic-only versioned-key evidence after the exact loader, then runs the real API/trigger proof.
- `.github/workflows/pilot-backup.yml:52` — captures `auth.schema_migrations` and `storage.migrations` with the exact pinned PostgreSQL 17 client plus nonempty aggregate proof because the pinned CLI excludes those tables.
- `.github/workflows/pilot-isolated-recovery-rehearsal.yml:15` — main-only manual dispatch prevents scheduled or branch secret execution for the owner backup drill; it rejects an archive missing either reserved ledger and checks the isolated result before services start.
- `.github/workflows/pilot-isolated-recovery-rehearsal.yml:100` — derives the exact archive restore plan and full-row digest before loader materialization.
- `.github/workflows/pilot-isolated-recovery-rehearsal.yml:120` — discovers the configured loopback gateway port and requires its Storage status route before private-key API verification.
- `scripts/ops/write-isolated-recovery-storage-fixture.mjs:23` — `writeIsolatedRecoveryStorageFixture`: generates only two randomized synthetic linked/quote-PDF logical rows and absent backend bytes.
- `tests/integration/ops/recovery-storage-immutability.int.test.ts:44` — `storageRows`: reads the full snapshot through the isolated recovery Compose `db` service; Postgres remains internal-only.
- `tests/integration/ops/recovery-storage-immutability.int.test.ts:111` — `isolated recovery Storage physical-loader proof`: compares the pre-loader full-row snapshot after loader GET readback and after each rejected ordinary upsert, with real MIME/cache/user metadata and bytes for both linked generic and quote-PDF objects. The pinned info route confirms DB metadata; GET confirms backend bytes.
- `tests/unit/ops/pilot-operations.test.ts:220` — `recovery Compose sources leave per-drill values in ignored static private files`: prevents the CI proof from restoring its removed host DB URL dependency and requires the explicit internal Compose snapshot contract.
- `tests/unit/ops/isolated-recovery-storage.test.ts:16` — pins the exact `stub/stub/<bucket>/...-$v-<version>` filename, both Linux xattrs, and exclusive no-overwrite behavior.
- `scripts/ops/write-recovery-runtime-config.mjs:14` — writes per-run private literal credentials and project configuration without logging secrets.
- `scripts/ops/verify-isolated-recovery-copy-counts.mjs:33` — compares required archive COPY totals against restored aggregates.
- `scripts/ops/verify-isolated-platform-migration-ledgers.mjs:10` — rejects missing, empty, or mismatched Auth/Storage migration ledgers without disclosing migration rows.
- `scripts/ops/verify-isolated-auth-rls.mjs:17` — creates then removes a synthetic isolated Auth account and requires it to see zero tenant rows through REST and no membership through the tenant-isolation RPC.

**Evidence:** author executed the focused pure Node operations suite on Windows: 24 passed, 0 failed, 0 skipped. It includes the changed topology and workflow-contract assertions. CI run `35012539387` passed at head `36cf8f32dbe1100b88a9651a6cd7c3ca7c074b46`: unit 1,797 passed with zero skips; database 1,028 passed with one documented special skip; browser 138 passed with four documented skips; and the dedicated no-secret synthetic recovery proof passed 1 with zero skips. That recovery job restored a fresh synthetic schema into the pinned isolated Compose target, ran the exact physical loader, read both objects through the Storage API, compared complete logical rows before and after the loader and each rejected ordinary upsert, and verified Auth/Storage migration-ledger equality. A no-launch Compose render confirmed the gateway loopback mapping plus internal backend and project-scoped ingress network topology. A prior 1/1 local trigger/API check used a pre-existing stack without resource ownership evidence; it is explicitly excluded from evidence. This is not owner-archive recovery proof: no owner archive, credential, hosted recovery target, or main-only recovery workflow was run. The earlier private archive remains rejected because it lacks the reserved Auth and Storage ledgers; take a fresh ledger-complete backup before the owner rehearsal. Observed RPO and RTO remain pending that private owner rehearsal.

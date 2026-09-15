import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { assessAvailabilityFailure, newestArtifactUrls } from '../../../scripts/ops/availability-history.mjs';
import { exportStoragePlan, planStorageExport, safeSegment, destination, assertPlanWithinStorageLimit, assertStorageInventoryUnchanged, readStorageInventory } from '../../../scripts/ops/export-supabase-storage.mjs';
import { downloadNewest, prune, runBackup, upload } from '../../../scripts/ops/google-drive-backup.mjs';
import { probeAvailability } from '../../../scripts/ops/probe-availability.mjs';
import { assertIsolatedRecoveryUrl, restoreStorageManifest } from '../../../scripts/ops/restore-supabase-storage.mjs';
import { copyCounts, verifyRestoredCopyCounts } from '../../../scripts/ops/verify-isolated-recovery-copy-counts.mjs';
import { assertMatchingPlatformMigrationLedgers, verifyPlatformMigrationLedgers } from '../../../scripts/ops/verify-isolated-platform-migration-ledgers.mjs';
import { verifyIsolatedAuthRls } from '../../../scripts/ops/verify-isolated-auth-rls.mjs';
import { verifyBackupChecksums } from '../../../scripts/ops/verify-backup-checksums.mjs';
import { assertApprovedBackupDbUrl } from '../../../scripts/ops/validate-backup-db-url.mjs';
import { writeBackupChecksums } from '../../../scripts/ops/write-backup-checksums.mjs';
import { writeRecoveryRuntimeConfig } from '../../../scripts/ops/write-recovery-runtime-config.mjs';

function runBackupDbUrlValidator(chunks: string[]): Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
  const script = fileURLToPath(new URL('../../../scripts/ops/validate-backup-db-url.mjs', import.meta.url));
  const child = spawn(process.execPath, [script], { stdio: ['pipe', 'pipe', 'pipe'], timeout: 5_000, killSignal: 'SIGTERM' });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  for (const chunk of chunks) child.stdin.write(chunk);
  child.stdin.end();
  return new Promise((resolveResult, rejectResult) => {
    child.once('error', rejectResult);
    child.once('close', (code, signal) => resolveResult({ code, signal, stdout, stderr }));
  });
}

test('pilot probe records a failed HTTP response and a transport failure without treating either as available', async () => {
  const failedHttp = await probeAvailability({
    targetUrl: 'https://pilot.example.test/login',
    expectedStatus: 200,
    fetchImpl: async () => new Response('', { status: 503 }),
    now: () => new Date('2026-09-14T00:00:00.000Z'),
    clock: (() => { let tick = 10; return () => (tick += 25); })(),
  });
  assert.deepEqual(failedHttp, {
    checked_at: '2026-09-14T00:00:00.000Z', duration_ms: 25, expected_status: 200, observed_status: 503, status: 'failed',
  });

  const failedTransport = await probeAvailability({
    targetUrl: 'https://pilot.example.test/login',
    fetchImpl: async () => { throw new TypeError('network unavailable'); },
  });
  assert.equal(failedTransport.status, 'failed');
  assert.equal(failedTransport.observed_status, null);
  assert.equal(failedTransport.error, 'TypeError');
});

test('availability history alerts only on the third consecutive sampled failure and resets at recovery', () => {
  assert.deepEqual(assessAvailabilityFailure({ currentStatus: 'failed', priorStatuses: [] }), { consecutiveFailures: 1, alert: false });
  assert.deepEqual(assessAvailabilityFailure({ currentStatus: 'failed', priorStatuses: ['failed'] }), { consecutiveFailures: 2, alert: false });
  assert.deepEqual(assessAvailabilityFailure({ currentStatus: 'failed', priorStatuses: ['failed', 'failed'] }), { consecutiveFailures: 3, alert: true });
  assert.deepEqual(assessAvailabilityFailure({ currentStatus: 'failed', priorStatuses: ['failed', 'ok'] }), { consecutiveFailures: 2, alert: false });
  assert.deepEqual(assessAvailabilityFailure({ currentStatus: 'ok', priorStatuses: ['failed', 'failed'] }), { consecutiveFailures: 0, alert: false });
  assert.throws(() => assessAvailabilityFailure({ currentStatus: 'failed', priorStatuses: ['unknown'] }), /history is missing or invalid/);
});

test('availability history chooses the two newest completed artifact samples rather than API response order', () => {
  const url = (name: string) => `https://api.example.test/artifacts/${name}`;
  const pages = [{ artifacts: [
    { expired: false, workflow_run: { id: 10 }, created_at: '2026-09-14T13:07:00Z', archive_download_url: url('older') },
    { expired: false, workflow_run: { id: 11 }, created_at: '2026-09-14T13:08:00Z', archive_download_url: url('newest') },
    { expired: false, workflow_run: { id: 12 }, created_at: '2026-09-14T13:06:00Z', archive_download_url: url('current') },
    { expired: false, workflow_run: { id: 9 }, created_at: '2026-09-14T13:07:30Z', archive_download_url: url('middle') },
  ] }];
  assert.deepEqual(newestArtifactUrls({ pages, currentRunId: 12 }), [url('newest'), url('middle')]);
  assert.throws(() => newestArtifactUrls({ pages: [{ artifacts: [{ expired: false, workflow_run: { id: 1 }, created_at: 'not-a-date', archive_download_url: url('bad') }] }], currentRunId: 2 }), /invalid sampled result/);
});

test('Storage export plans all paginated and nested objects before transfer and rejects unsafe paths', async () => {
  const calls: Array<{ prefix: string; offset: number }> = [];
  const storage = {
    from: () => ({
      list: async (prefix: string, options: { offset: number }) => {
        calls.push({ prefix, offset: options.offset });
        if (prefix === '' && options.offset === 0) return { data: [{ id: null, name: 'tenant-a' }], error: null };
        if (prefix === 'tenant-a' && options.offset === 0) return { data: [{ id: 'object-1', name: 'invoice.pdf', metadata: { size: 3 }, updated_at: '2026-09-14T00:00:00Z' }], error: null };
        return { data: [], error: null };
      },
      download: async () => { throw new Error('downloads must not begin during planning'); },
    }),
  };
  const plan = await planStorageExport({ storage, bucket: 'tenant-files' });
  assert.deepEqual(plan, [{ bucket: 'tenant-files', path: 'tenant-a/invoice.pdf', bytes: 3, last_modified: '2026-09-14T00:00:00Z' }]);
  assert.deepEqual(calls, [{ prefix: '', offset: 0 }, { prefix: 'tenant-a', offset: 0 }]);
  assert.throws(() => assertPlanWithinStorageLimit(plan, 2), /above BACKUP_MAX_STORAGE_BYTES/);
  assert.throws(() => safeSegment('../escape', 'object name'), /Unsafe object name/);
  assert.throws(() => destination('/safe-root', '..', 'escape'), /escapes/);
});

test('Storage pagination does not silently omit the page beyond the first thousand objects', async () => {
  const firstPage = Array.from({ length: 1000 }, (_, index) => ({ id: `id-${index}`, name: `object-${index}`, metadata: { size: 1 } }));
  const storage = {
    from: () => ({
      list: async (_prefix: string, options: { offset: number }) => ({ data: options.offset === 0 ? firstPage : [{ id: 'id-1000', name: 'object-1000', metadata: { size: 1 } }], error: null }),
    }),
  };
  const plan = await planStorageExport({ storage, bucket: 'tenant-files' });
  assert.equal(plan.length, 1001);
  assert.equal(assertPlanWithinStorageLimit(plan, 1001), 1001);
});

test('Storage consistency inventory rejects object-set or metadata drift before backup encryption', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-storage-inventory-'));
  const snapshot = join(root, 'pre-dump-inventory.json');
  const before = [{ bucket: 'tenant-files', path: 'tenant-a/invoice.pdf', bytes: 3, last_modified: '2026-09-14T00:00:00Z' }];
  await writeFile(snapshot, `${JSON.stringify({ objects: before })}\n`);
  try {
    assert.deepEqual(await readStorageInventory(snapshot), before);
    assertStorageInventoryUnchanged(before, [...before]);
    assert.throws(() => assertStorageInventoryUnchanged(before, [{ ...before[0], last_modified: '2026-09-14T00:01:00Z' }]), /Storage inventory changed/);
    assert.throws(() => assertStorageInventoryUnchanged(before, []), /Storage inventory changed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('backup database URL accepts only exact TLS direct or shared-pooler demo targets', () => {
  assert.doesNotThrow(() => assertApprovedBackupDbUrl('postgresql://postgres:secret@db.wmqmzznmwpheswjjozhq.supabase.co:5432/postgres?sslmode=require'));
  assert.doesNotThrow(() => assertApprovedBackupDbUrl('postgresql://postgres.wmqmzznmwpheswjjozhq:secret@aws-0-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require'));
  assert.throws(() => assertApprovedBackupDbUrl('postgresql://postgres:secret@unrelated.example/wmqmzznmwpheswjjozhq?sslmode=require'), /approved demo database/);
  assert.throws(() => assertApprovedBackupDbUrl('postgresql://postgres.wrong-project:secret@aws-0-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require'), /approved demo database/);
  assert.throws(() => assertApprovedBackupDbUrl('postgresql://postgres:secret@db.wmqmzznmwpheswjjozhq.supabase.co:5432/postgres?sslmode=require&host=attacker.example'), /approved demo database/);
});

test('backup database URL validator accepts approved URLs through its streamed stdin CLI path', async () => {
  for (const input of [
    'postgresql://postgres:secret@db.wmqmzznmwpheswjjozhq.supabase.co:5432/postgres?sslmode=require',
    'postgresql://postgres.wmqmzznmwpheswjjozhq:secret@aws-0-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=verify-full',
  ]) {
    const middle = Math.floor(input.length / 2);
    const result = await runBackupDbUrlValidator([input.slice(0, middle), input.slice(middle)]);
    assert.equal(result.code, 0);
    assert.equal(result.signal, null);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  }
});

test('backup database URL validator rejects forbidden URL parameters through its stdin CLI path', async () => {
  const result = await runBackupDbUrlValidator(['postgresql://postgres:secret@db.wmqmzznmwpheswjjozhq.supabase.co:5432/postgres?sslmode=require&host=attacker.example']);
  assert.equal(result.code, 1);
  assert.equal(result.signal, null);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'SUPABASE_BACKUP_DB_URL must target the approved demo database with TLS\n');
});

test('Storage restore verifies only checksummed manifest objects through a loopback recovery API', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-storage-restore-'));
  const object = join(root, 'storage', 'tenant-files', 'tenant-a', 'document.pdf');
  try {
    await mkdir(join(root, 'storage', 'tenant-files', 'tenant-a'), { recursive: true });
    await writeFile(object, 'restored bytes');
    await writeFile(join(root, 'storage', 'manifest.json'), `${JSON.stringify({ exported_at: '2026-09-15T00:00:00.000Z', objects: [{ bucket: 'tenant-files', path: 'tenant-a/document.pdf', bytes: 14, last_modified: null }] })}\n`);
    await writeBackupChecksums(root);
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const result = await restoreStorageManifest({
      root,
      recoveryUrl: 'http://127.0.0.1:58000',
      serviceRoleKey: 'test-service-role',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init! });
        if (String(url).includes('/object/info/')) {
          return new Response(JSON.stringify({
            content_type: 'application/pdf', cache_control: 'max-age=7200', metadata: { elpro_file_linked_at: 'preserved-user-metadata' },
          }), { status: 200 });
        }
        return new Response('restored bytes', { status: 200 });
      },
    });
    assert.deepEqual(result, { objects: 1, bytes: 14 });
    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.url, 'http://127.0.0.1:58000/storage/v1/object/tenant-files/tenant-a/document.pdf');
    assert.equal(calls[1]!.url, 'http://127.0.0.1:58000/storage/v1/object/info/tenant-files/tenant-a/document.pdf');
    for (const call of calls) {
      assert.equal(call.init.method, undefined);
      assert.deepEqual(call.init.headers, { apikey: 'test-service-role', authorization: 'Bearer test-service-role' });
      assert.equal(call.init.redirect, 'error');
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Storage restore refuses external or demo targets before reading backup contents', () => {
  assert.throws(() => assertIsolatedRecoveryUrl('https://wmqmzznmwpheswjjozhq.supabase.co'), /high loopback/);
  assert.throws(() => assertIsolatedRecoveryUrl('http://localhost:80'), /high loopback/);
  assert.doesNotThrow(() => assertIsolatedRecoveryUrl('http://localhost:58000'));
});

test('Storage restore refuses a manifest object missing from SHA256SUMS before upload', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-storage-restore-'));
  try {
    await mkdir(join(root, 'storage', 'tenant-files'), { recursive: true });
    await writeFile(join(root, 'storage', 'tenant-files', 'document.pdf'), 'restored bytes');
    await writeFile(join(root, 'storage', 'manifest.json'), `${JSON.stringify({ exported_at: '2026-09-15T00:00:00.000Z', objects: [{ bucket: 'tenant-files', path: 'document.pdf', bytes: 14, last_modified: null }] })}\n`);
    await writeBackupChecksums(root);
    const checksumRows = (await readFile(join(root, 'SHA256SUMS'), 'utf8')).split('\n').filter((row) => !row.endsWith('storage/tenant-files/document.pdf'));
    await writeFile(join(root, 'SHA256SUMS'), `${checksumRows.join('\n')}\n`);
    await assert.rejects(
      restoreStorageManifest({ root, recoveryUrl: 'http://127.0.0.1:58000', serviceRoleKey: 'test-service-role', fetchImpl: async () => { throw new Error('upload must not begin'); } }),
      /does not exactly match/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('recovery Compose sources leave per-drill values in ignored static private files', async () => {
  const recoveryDir = fileURLToPath(new URL('../../../ops/recovery/', import.meta.url));
  const [base, bootstrap, roles, recoveryCi, backupWorkflow, rehearsalWorkflow, runbook, dbOverride, runtimeOverride, envExample] = await Promise.all([
    readFile(join(recoveryDir, 'compose.yaml'), 'utf8'),
    readFile(join(recoveryDir, 'compose.db-bootstrap.yaml'), 'utf8'),
    readFile(join(recoveryDir, 'bootstrap-roles.sql'), 'utf8'),
    readFile(fileURLToPath(new URL('../../../.github/workflows/ci.yml', import.meta.url)), 'utf8'),
    readFile(fileURLToPath(new URL('../../../.github/workflows/pilot-backup.yml', import.meta.url)), 'utf8'),
    readFile(fileURLToPath(new URL('../../../.github/workflows/pilot-isolated-recovery-rehearsal.yml', import.meta.url)), 'utf8'),
    readFile(fileURLToPath(new URL('../../../docs/process/pilot-operations-runbook.md', import.meta.url)), 'utf8'),
    readFile(join(recoveryDir, 'db-bootstrap.private.compose.example.yaml'), 'utf8'),
    readFile(join(recoveryDir, 'runtime.private.compose.example.yaml'), 'utf8'),
    readFile(join(recoveryDir, 'recovery.env.example'), 'utf8'),
  ]);
  assert.doesNotMatch(base, /\$\{/);
  assert.doesNotMatch(bootstrap, /\$\{/);
  assert.match(base, /env_file: \.env/);
  assert.match(bootstrap, /99-recovery-roles\.sql:ro/);
  assert.match(roles, /ARRAY\['authenticator', 'supabase_auth_admin', 'supabase_storage_admin'\]/);
  assert.match(roles, /ALTER USER authenticator WITH PASSWORD/);
  assert.match(roles, /ALTER USER supabase_auth_admin WITH PASSWORD/);
  assert.match(roles, /ALTER USER supabase_storage_admin WITH PASSWORD/);
  assert.doesNotMatch(roles, /ALTER USER pgbouncer|ALTER USER supabase_functions_admin/);
  for (const restoreEntryPoint of [rehearsalWorkflow, runbook]) {
    assert.match(restoreEntryPoint, /-U supabase_admin -d postgres/);
    assert.doesNotMatch(restoreEntryPoint, /-U postgres -d postgres/);
  }
  assert.match(recoveryCi, /-U supabase_admin -d postgres/);
  assert.match(recoveryCi, /RECOVERY_TEST_DB_URL=\"postgresql:\/\/supabase_storage_admin:/);
  assert.match(recoveryCi, /--schema public,auth,storage,supabase_migrations,test_support/);
  assert.match(recoveryCi, /docker exec --user postgres "\$source_db" pg_dump/);
  assert.match(recoveryCi, /--table=auth\.schema_migrations --table=storage\.migrations/);
  assert.match(recoveryCi, /platform-migration-ledgers\.sql/);
  assert.match(recoveryCi, /verify-isolated-platform-migration-ledgers\.mjs/);
  assert.match(backupWorkflow, /docker run --rm --entrypoint pg_dump supabase\/postgres:17\.6\.1\.136/);
  assert.match(backupWorkflow, /--table=auth\.schema_migrations --table=storage\.migrations/);
  assert.match(backupWorkflow, /platform-migration-ledgers\.json/);
  assert.match(rehearsalWorkflow, /platform-migration-ledgers\.sql/);
  assert.match(rehearsalWorkflow, /verify-isolated-platform-migration-ledgers\.mjs/);
  assert.match(recoveryCi, /logs --no-color --tail=80 auth rest storage gateway/);
  assert.match(bootstrap, /command: \["postgres", "-D", "\/etc\/postgresql"/);
  assert.match(base, /command: \["postgres", "-D", "\/etc\/postgresql"/);
  assert.match(base, /cron\.launch_active_jobs=off/);
  assert.match(base, /pg_net\.batch_size=0/);
  assert.match(base, /internal: true/);
  assert.match(dbOverride, /^name: elpro-isolated-recovery-/m);
  assert.match(dbOverride, /127\.0\.0\.1:55432:5432/);
  assert.match(runtimeOverride, /^name: elpro-isolated-recovery-/m);
  assert.match(runtimeOverride, /127\.0\.0\.1:58000:8000/);
  assert.match(envExample, /^POSTGRES_PASSWORD=/m);
  assert.match(envExample, /^GOTRUE_DB_DATABASE_URL=postgres:\/\/supabase_auth_admin:/m);
  assert.match(envExample, /^GOTRUE_SITE_URL=http:\/\/127\.0\.0\.1:58000/m);
  assert.match(envExample, /^API_EXTERNAL_URL=http:\/\/127\.0\.0\.1:58000\/auth\/v1/m);
  assert.match(envExample, /^GOTRUE_JWT_SECRET=/m);
});

test('ephemeral recovery runtime configuration writes literal isolated values outside source files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-recovery-runtime-config-'));
  try {
    await writeRecoveryRuntimeConfig(root, { instance: 'fixture', dbPort: 55433, apiPort: 58001 });
    const [env, dbOverride, runtimeOverride] = await Promise.all([
      readFile(join(root, '.env'), 'utf8'),
      readFile(join(root, '.private.db-bootstrap.compose.yaml'), 'utf8'),
      readFile(join(root, '.private.runtime.compose.yaml'), 'utf8'),
    ]);
    assert.doesNotMatch(env, /\$\{/);
    assert.match(env, /^POSTGRES_PASSWORD=[a-f0-9]{64}$/m);
    assert.match(env, /^SERVICE_KEY=.+$/m);
    assert.match(env, /^SERVICE_ROLE_KEY=.+$/m);
    assert.match(env, /^GOTRUE_DB_DATABASE_URL=postgres:\/\/supabase_auth_admin:[a-f0-9]{64}@db:5432\/postgres$/m);
    assert.match(env, /^GOTRUE_SITE_URL=http:\/\/127\.0\.0\.1:58001$/m);
    assert.match(env, /^API_EXTERNAL_URL=http:\/\/127\.0\.0\.1:58001\/auth\/v1$/m);
    assert.match(env, /^GOTRUE_JWT_SECRET=[A-Za-z0-9_-]{43}$/m);
    assert.match(dbOverride, /^name: elpro-isolated-recovery-fixture$/m);
    assert.match(dbOverride, /127\.0\.0\.1:55433:5432/);
    assert.match(runtimeOverride, /127\.0\.0\.1:58001:8000/);
    await assert.rejects(writeRecoveryRuntimeConfig(root, { instance: 'fixture', dbPort: 55433, apiPort: 58001 }), /EEXIST/);
    await assert.rejects(writeRecoveryRuntimeConfig(join(root, 'invalid'), { instance: 'fixture', dbPort: 80, apiPort: 58001 }), /configuration is invalid/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('recovery workflows resolve the configured gateway port and wait for its Storage route', async () => {
  const [ciWorkflow, rehearsalWorkflow] = await Promise.all([
    readFile(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8'),
    readFile(new URL('../../../.github/workflows/pilot-isolated-recovery-rehearsal.yml', import.meta.url), 'utf8'),
  ]);
  for (const workflow of [ciWorkflow, rehearsalWorkflow]) {
    assert.match(workflow, /port gateway 8000/);
    assert.match(workflow, /storage\/v1\/status/);
    assert.match(workflow, /gateway-port\.txt/);
  }
});

test('Drive rehearsal download accepts only the newest Drive-owned marked file and writes ciphertext without redirects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-drive-download-'));
  const output = join(root, 'backup.gpg');
  try {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const result = await downloadNewest({
      token: 'test-token', folderId: 'approvedFolder123', outputPath: output,
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init! });
        if (calls.length === 1) return new Response(JSON.stringify({ files: [{ id: 'owned-file', createdTime: '2026-09-15T00:00:00Z', ownedByMe: true, parents: ['approvedFolder123'], appProperties: { elpro_pilot_backup: 'v1' } }] }), { status: 200 });
        return new Response('ciphertext', { status: 200 });
      },
    });
    assert.deepEqual(result, { createdTime: '2026-09-15T00:00:00Z' });
    assert.equal(await readFile(output, 'utf8'), 'ciphertext');
    assert.match(calls[0]!.url, /appProperties/);
    assert.equal(calls[1]!.url, 'https://www.googleapis.com/drive/v3/files/owned-file?alt=media');
    assert.equal(calls[1]!.init.redirect, 'error');
    await assert.rejects(downloadNewest({
      token: 'test-token', folderId: 'approvedFolder123', outputPath: join(root, 'not-owned.gpg'),
      fetchImpl: async () => new Response(JSON.stringify({ files: [{ id: 'shared-file', parents: ['approvedFolder123'], appProperties: { elpro_pilot_backup: 'v1' } }] }), { status: 200 }),
    }), /No owned encrypted pilot backup/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('isolated recovery requires archive COPY totals to match restored database aggregates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-recovery-facts-'));
  try {
    const data = ['COPY public.tenants (id) FROM stdin;', 'a', '\\.', 'COPY public.tenant_memberships (id) FROM stdin;', 'a', 'b', '\\.', 'COPY auth.users (id) FROM stdin;', 'a', '\\.', 'COPY storage.objects (id) FROM stdin;', 'a', '\\.', 'COPY supabase_migrations.schema_migrations (version) FROM stdin;', 'a', '\\.'].join('\n');
    assert.equal(copyCounts(data).get('public.tenant_memberships'), 2);
    const dataPath = join(root, 'data.sql');
    const factsPath = join(root, 'facts.json');
    await writeFile(dataPath, data);
    await writeFile(factsPath, JSON.stringify({ tenants: 1, memberships: 2, auth_users: 1, storage_objects: 1, migrations: 1 }));
    await verifyRestoredCopyCounts({ dataPath, targetFactsPath: factsPath });
    await writeFile(factsPath, JSON.stringify({ tenants: 1, memberships: 1, auth_users: 1, storage_objects: 1, migrations: 1 }));
    await assert.rejects(verifyRestoredCopyCounts({ dataPath, targetFactsPath: factsPath }), /aggregate verification failed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('isolated recovery requires nonempty matching Auth and Storage migration ledgers', async () => {
  const source = {
    auth: { count: 87, digest: 'a'.repeat(32) },
    storage: { count: 19, digest: 'b'.repeat(32) },
  };
  assert.doesNotThrow(() => assertMatchingPlatformMigrationLedgers(source, structuredClone(source)));
  assert.throws(() => assertMatchingPlatformMigrationLedgers(source, { ...source, auth: { count: 86, digest: 'a'.repeat(32) } }), /migration-ledger verification failed/);
  assert.throws(() => assertMatchingPlatformMigrationLedgers(source, { ...source, storage: { count: 0, digest: 'b'.repeat(32) } }), /migration-ledger verification failed/);
  const root = await mkdtemp(join(tmpdir(), 'elpro-recovery-ledgers-'));
  try {
    const sourcePath = join(root, 'source.json');
    const targetPath = join(root, 'target.json');
    await Promise.all([writeFile(sourcePath, JSON.stringify(source)), writeFile(targetPath, JSON.stringify(source))]);
    await verifyPlatformMigrationLedgers({ sourcePath, targetPath });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('isolated Auth verification uses a disposable user and requires empty tenant REST access', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  await verifyIsolatedAuthRls({
    recoveryUrl: 'http://127.0.0.1:58000', serviceRoleKey: 'test-service-role',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init: init! });
      if (String(url).endsWith('/admin/users') && init?.method === 'POST') return new Response(JSON.stringify({ id: 'synthetic-user' }), { status: 200 });
      if (String(url).includes('/token?grant_type=password')) return new Response(JSON.stringify({ access_token: 'synthetic-token' }), { status: 200 });
      if (String(url).includes('/rest/v1/tenants')) return new Response('[]', { status: 200, headers: { 'content-range': '*/0' } });
      if (String(url).includes('/rest/v1/rpc/is_active_tenant_member')) return new Response('false', { status: 200 });
      if (String(url).endsWith('/admin/users/synthetic-user') && init?.method === 'DELETE') return new Response(null, { status: 204 });
      throw new Error('unexpected request');
    },
  });
  assert.equal(calls.length, 5);
  assert.equal((calls[2]!.init.headers as Record<string, string>).authorization, 'Bearer synthetic-token');
  assert.equal((calls[3]!.init.headers as Record<string, string>).authorization, 'Bearer synthetic-token');
  assert.match(String(calls[3]!.init.body), /^\{"target_tenant_id":"[0-9a-f-]{36}"\}$/);
  assert.equal(calls[4]!.init.redirect, 'error');
});

test('Storage export refuses an object whose downloaded bytes changed after the no-transfer preflight', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-storage-export-'));
  try {
    const storage = { from: () => ({ download: async () => ({ data: new Blob([Buffer.from('four')]), error: null }) }) };
    await assert.rejects(
      exportStoragePlan({ storage, objects: [{ bucket: 'tenant-files', path: 'tenant/object.txt', bytes: 3, last_modified: null }], output: root, manifest: { objects: [] } }),
      /changed size during export/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Storage export failures do not disclose a customer-derived object path in public workflow logs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-storage-export-'));
  const customerPath = 'tenant-49/installation/secret-address-photo.jpg';
  try {
    await assert.rejects(
      exportStoragePlan({
        storage: { from: () => ({ download: async () => ({ data: null, error: { message: 'not found' } }) }) },
        objects: [{ bucket: 'tenant-files', path: customerPath, bytes: 1, last_modified: null }],
        output: root,
        manifest: { objects: [] },
      }),
      (error: unknown) => {
        assert.match(String(error), /Could not download a Storage object/);
        assert.doesNotMatch(String(error), new RegExp(customerPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Drive resumes from a partially acknowledged streaming boundary and never prunes after an upload failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-drive-upload-'));
  const archive = join(root, 'backup.gpg');
  await writeFile(archive, Buffer.alloc(9 * 1024 * 1024, 7));
  try {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    await assert.rejects(
      upload({
        token: 'test-token', folderId: 'approvedFolder123', filePath: archive,
        fetchImpl: async (url, init) => {
          calls.push({ url: String(url), init: init! });
          if (calls.length === 1) return new Response('', { status: 200, headers: { location: 'https://upload.example.test/session' } });
          if (calls.length === 2) return new Response(null, { status: 308, headers: { range: `bytes=0-${4 * 1024 * 1024 - 1}` } });
          return new Response('write failed', { status: 500 });
        },
      }),
      /resumable backup upload failed with HTTP 500/,
    );
    assert.equal(calls.length, 3);
    assert.match(calls[0]!.url, /uploadType=resumable/);
    assert.equal(calls[0]!.init.headers instanceof Headers ? calls[0]!.init.headers.get('x-upload-content-length') : (calls[0]!.init.headers as Record<string, string>)['x-upload-content-length'], String(9 * 1024 * 1024));
    assert.equal(calls[1]!.init.method, 'PUT');
    assert.equal(calls[1]!.init.headers instanceof Headers ? calls[1]!.init.headers.get('content-range') : (calls[1]!.init.headers as Record<string, string>)['content-range'], `bytes 0-${8 * 1024 * 1024 - 1}/${9 * 1024 * 1024}`);
    assert.equal(calls[2]!.init.headers instanceof Headers ? calls[2]!.init.headers.get('content-range') : (calls[2]!.init.headers as Record<string, string>)['content-range'], `bytes ${4 * 1024 * 1024}-${9 * 1024 * 1024 - 1}/${9 * 1024 * 1024}`);

    let pruned = false;
    await assert.rejects(runBackup({ token: 'test-token', folderId: 'approvedFolder123', filePath: archive, uploadBackup: async () => { throw new Error('upload failed'); }, pruneBackups: async () => { pruned = true; return { retained: 7, deleted: 0 }; } }), /upload failed/);
    assert.equal(pruned, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Drive pruning retains seven marked backups and refuses unrelated metadata returned by a bad listing', async () => {
  const owned = Array.from({ length: 8 }, (_, index) => ({ id: `owned-${index}`, parents: ['approvedFolder123'], appProperties: { elpro_pilot_backup: 'v1' } }));
  const deleted: string[] = [];
  await prune({
    token: 'test-token', folderId: 'approvedFolder123',
    fetchImpl: async (url, init) => {
      if (!init?.method) return new Response(JSON.stringify({ files: owned }), { status: 200, headers: { 'content-type': 'application/json' } });
      deleted.push(String(url));
      return new Response(null, { status: 204 });
    },
  });
  assert.deepEqual(deleted, ['https://www.googleapis.com/drive/v3/files/owned-7']);

  const unrelated = [...owned.slice(0, 7), { id: 'not-ours', parents: ['other-folder'], appProperties: { other: 'metadata' } }];
  let deletes = 0;
  await assert.rejects(prune({
    token: 'test-token', folderId: 'approvedFolder123',
    fetchImpl: async (_url, init) => {
      if (!init?.method) return new Response(JSON.stringify({ files: unrelated }), { status: 200, headers: { 'content-type': 'application/json' } });
      deletes += 1;
      return new Response(null, { status: 204 });
    },
  }), /Refusing to delete/);
  assert.equal(deletes, 0);
});

test('workflow-format checksum generation produces relative members that the restore verifier accepts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-checksum-'));
  const member = join(root, 'database.sql');
  try {
    await writeFile(member, 'expected');
    assert.equal(await writeBackupChecksums(root), 1);
    const manifest = await readFile(join(root, 'SHA256SUMS'), 'utf8');
    assert.match(manifest, /^[a-f0-9]{64}  database\.sql\n$/);
    await verifyBackupChecksums(root);
    await rm(member);
    await assert.rejects(verifyBackupChecksums(root), /Backed-up file is missing/);
    await writeFile(member, 'corrupted');
    await assert.rejects(verifyBackupChecksums(root), /checksum mismatch/);
    await writeFile(member, 'expected');
    await verifyBackupChecksums(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

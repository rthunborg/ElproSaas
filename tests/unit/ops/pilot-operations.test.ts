import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { assessAvailabilityFailure, newestArtifactUrls } from '../../../scripts/ops/availability-history.mjs';
import { exportStoragePlan, planStorageExport, safeSegment, destination, assertPlanWithinStorageLimit, assertStorageInventoryUnchanged, readStorageInventory } from '../../../scripts/ops/export-supabase-storage.mjs';
import { prune, runBackup, upload } from '../../../scripts/ops/google-drive-backup.mjs';
import { probeAvailability } from '../../../scripts/ops/probe-availability.mjs';
import { verifyBackupChecksums } from '../../../scripts/ops/verify-backup-checksums.mjs';
import { assertApprovedBackupDbUrl } from '../../../scripts/ops/validate-backup-db-url.mjs';
import { writeBackupChecksums } from '../../../scripts/ops/write-backup-checksums.mjs';

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

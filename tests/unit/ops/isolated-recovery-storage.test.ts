import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const loader = new URL('../../../ops/recovery/restore-storage-file-backend.py', import.meta.url);

async function runPython(args: readonly string[]) {
  return execFileAsync('python3', [loader.pathname, ...args], { windowsHide: true });
}

test('versioned file-backend restore preserves the DB-owned identity and refuses overwrite', {
  skip: process.platform === 'win32' ? 'Linux xattrs are required; this runs on Ubuntu CI in the same Python/Alpine compatibility family as the recovery loader' : false,
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-storage-backend-'));
  const workspace = join(root, 'backup-workspace');
  const backend = join(root, 'backend');
  const source = join(workspace, 'storage', 'tenant-files', 'tenant-a', 'document.pdf');
  const plan = join(root, 'storage-restore-plan.json');
  const version = '11111111-1111-1111-1111-111111111111';
  try {
    await mkdir(join(workspace, 'storage', 'tenant-files', 'tenant-a'), { recursive: true });
    await writeFile(source, 'fixture bytes');
    await writeFile(join(workspace, 'storage', 'manifest.json'), JSON.stringify({
      exported_at: '2026-09-15T00:00:00.000Z',
      objects: [{ bucket: 'tenant-files', path: 'tenant-a/document.pdf', bytes: 13 }],
    }));
    await writeFile(plan, JSON.stringify({
      objects: [{
        bucket: 'tenant-files', path: 'tenant-a/document.pdf', bytes: 13, version,
        content_type: 'application/pdf', cache_control: 'max-age=7200',
      }],
    }));

    const first = await runPython([workspace, plan, backend]);
    assert.equal(first.stdout.trim(), '{"objects":1,"bytes":13}');
    const restored = join(backend, 'stub', 'stub', 'tenant-files', 'tenant-a', `document.pdf-$v-${version}`);
    assert.equal(await readFile(restored, 'utf8'), 'fixture bytes');
    await assert.rejects(readFile(join(backend, 'tenant-files', 'tenant-a', `document.pdf-$v-${version}`), 'utf8'), /ENOENT/);
    const attrs = await execFileAsync('python3', ['-c', 'import os,sys; print(os.getxattr(sys.argv[1], "user.supabase.content-type").decode()); print(os.getxattr(sys.argv[1], "user.supabase.cache-control").decode())', restored], { windowsHide: true });
    assert.equal(attrs.stdout, 'application/pdf\nmax-age=7200\n');

    await assert.rejects(
      runPython([workspace, plan, backend]),
      /Storage backend target already contains a restore object/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

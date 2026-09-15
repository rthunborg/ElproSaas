import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { downloadRecoveryBackup } from '../../../scripts/ops/download-google-drive-backup.mjs';

const folderId = 'approvedFolder123';
const now = Date.parse('2026-09-15T12:00:00Z');

function file({ id, createdTime, ownedByMe = true, parents = [folderId], marker = 'v1' }: {
  id: string;
  createdTime: string;
  ownedByMe?: boolean;
  parents?: string[];
  marker?: string;
}) {
  return { id, createdTime, ownedByMe, parents, appProperties: { elpro_pilot_backup: marker } };
}

test('recovery download selects the newest eligible backup across every Drive listing page', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-recovery-drive-'));
  const output = join(root, 'backup.gpg');
  const calls: string[] = [];
  try {
    const result = await downloadRecoveryBackup({
      output,
      folderId,
      token: 'test-token',
      now,
      fetchImpl: async (url) => {
        const requestUrl = String(url);
        calls.push(requestUrl);
        if (requestUrl.includes('alt=media')) return new Response('ciphertext', { status: 200 });
        if (requestUrl.includes('pageToken=next')) {
          return new Response(JSON.stringify({ files: [
            file({ id: 'eligible-newest', createdTime: '2026-09-15T11:30:00.100Z' }),
            file({ id: 'wrong-parent', createdTime: '2026-09-15T11:59:00Z', parents: ['anotherFolder'] }),
          ] }), { status: 200 });
        }
        return new Response(JSON.stringify({
          nextPageToken: 'next',
          files: [
            file({ id: 'shared-newer', createdTime: '2026-09-15T11:59:00Z', ownedByMe: false }),
            file({ id: 'wrong-marker', createdTime: '2026-09-15T11:58:00Z', marker: 'other' }),
            file({ id: 'eligible-same-second', createdTime: '2026-09-15T11:30:00Z' }),
            file({ id: 'eligible-older', createdTime: '2026-09-15T11:00:00Z' }),
          ],
        }), { status: 200 });
      },
    });
    assert.deepEqual(result, { createdTime: '2026-09-15T11:30:00.100Z', ageMs: 29 * 60 * 1000 + 59_900 });
    assert.equal(await readFile(output, 'utf8'), 'ciphertext');
    assert.equal(calls.at(-1), 'https://www.googleapis.com/drive/v3/files/eligible-newest?alt=media');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('recovery download rejects stale, future, and ineligible backups before downloading media', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-recovery-drive-age-'));
  try {
    for (const [label, candidate, pattern] of [
      ['stale', file({ id: 'stale', createdTime: '2026-09-14T11:59:59Z' }), /older than the 24-hour RPO/],
      ['future', file({ id: 'future', createdTime: '2026-09-15T12:00:01Z' }), /future creation time/],
      ['invalid-time', file({ id: 'invalid-time', createdTime: 'not-a-timestamp' }), /invalid creation time/],
      ['ineligible', file({ id: 'shared', createdTime: '2026-09-15T11:00:00Z', ownedByMe: false }), /No owned encrypted pilot backup/],
    ] as const) {
      let mediaRequests = 0;
      await assert.rejects(downloadRecoveryBackup({
        output: join(root, `${label}.gpg`),
        folderId,
        token: 'test-token',
        now,
        fetchImpl: async (url) => {
          if (String(url).includes('alt=media')) mediaRequests += 1;
          return new Response(JSON.stringify({ files: [candidate] }), { status: 200 });
        },
      }), pattern);
      assert.equal(mediaRequests, 0);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('recovery download accepts a backup exactly at the 24-hour RPO boundary', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-recovery-drive-boundary-'));
  try {
    const result = await downloadRecoveryBackup({
      output: join(root, 'boundary.gpg'),
      folderId,
      token: 'test-token',
      now,
      fetchImpl: async (url) => new Response(
        String(url).includes('alt=media') ? 'ciphertext' : JSON.stringify({ files: [file({ id: 'boundary', createdTime: '2026-09-14T12:00:00Z' })] }),
        { status: 200 },
      ),
    });
    assert.equal(result.ageMs, 24 * 60 * 60 * 1000);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { writeIsolatedRecoveryStorageFixture } from '../../../scripts/ops/write-isolated-recovery-storage-fixture.mjs';

test('synthetic physical Storage recovery fixture supplies logical rows and version-addressed loader inputs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elpro-isolated-storage-fixture-'));
  try {
    const result = await writeIsolatedRecoveryStorageFixture(root);
    assert.deepEqual(result, { root, objects: 2, bytes: 66 });
    const [manifest, plan, fixture, seed] = await Promise.all([
      readFile(join(root, 'backup-workspace', 'storage', 'manifest.json'), 'utf8'),
      readFile(join(root, 'storage-restore-plan.json'), 'utf8'),
      readFile(join(root, 'storage-fixture.json'), 'utf8'),
      readFile(join(root, 'storage-seed.sql'), 'utf8'),
    ]);
    const parsedManifest = JSON.parse(manifest);
    const parsedPlan = JSON.parse(plan);
    const parsedFixture = JSON.parse(fixture);
    assert.equal(parsedManifest.objects.length, 2);
    assert.equal(parsedPlan.objects.length, 2);
    assert.equal(parsedFixture.objects.filter((object: { quotePdf: boolean }) => object.quotePdf).length, 1);
    assert.equal(parsedFixture.objects.filter((object: { quotePdf: boolean }) => !object.quotePdf).length, 1);
    assert.match(seed, /insert into storage\.objects/);
    assert.match(seed, /insert into storage\.buckets/);
    assert.match(seed, /elpro_file_linked_at/);
    assert.match(seed, /'quote_pdf'/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

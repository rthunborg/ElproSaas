import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { availabilityConfigFromEnv, probeAvailability } from '../../../scripts/ops/probe-availability.mjs';

const target = 'https://pilot.example.test/login';
const otherTarget = 'https://other.example.test/login';

for (const [label, env, expectedStatus] of [
  ['canonical only', { KOPPLAS_MONITOR_URL: target, KOPPLAS_MONITOR_EXPECTED_STATUS: '204' }, 204],
  ['legacy only', { ELPRO_MONITOR_URL: target, ELPRO_MONITOR_EXPECTED_STATUS: '204' }, 204],
  ['matching aliases', { KOPPLAS_MONITOR_URL: target, ELPRO_MONITOR_URL: target, KOPPLAS_MONITOR_EXPECTED_STATUS: '204', ELPRO_MONITOR_EXPECTED_STATUS: '204' }, 204],
  ['workflow empty canonical aliases', { KOPPLAS_MONITOR_URL: '', ELPRO_MONITOR_URL: target, KOPPLAS_MONITOR_EXPECTED_STATUS: '', ELPRO_MONITOR_EXPECTED_STATUS: '204' }, 204],
  ['workflow empty legacy aliases', { KOPPLAS_MONITOR_URL: target, ELPRO_MONITOR_URL: '', KOPPLAS_MONITOR_EXPECTED_STATUS: '204', ELPRO_MONITOR_EXPECTED_STATUS: '' }, 204],
  ['default status', { KOPPLAS_MONITOR_URL: target }, 200],
  ['empty status aliases', { KOPPLAS_MONITOR_URL: target, KOPPLAS_MONITOR_EXPECTED_STATUS: '', ELPRO_MONITOR_EXPECTED_STATUS: '' }, 200],
  ['canonical URL and legacy status', { KOPPLAS_MONITOR_URL: target, ELPRO_MONITOR_EXPECTED_STATUS: '204' }, 204],
  ['legacy URL and canonical status', { ELPRO_MONITOR_URL: target, KOPPLAS_MONITOR_EXPECTED_STATUS: '204' }, 204],
] as const) {
  test(`monitor environment compatibility: ${label}`, () => {
    assert.deepEqual(availabilityConfigFromEnv(env), { targetUrl: target, expectedStatus });
  });
}

test('monitor rejects conflicting URLs in either alias order and does not echo either destination', () => {
  for (const [current, legacy] of [[target, otherTarget], [otherTarget, target]]) {
    assert.throws(() => availabilityConfigFromEnv({ KOPPLAS_MONITOR_URL: current, ELPRO_MONITOR_URL: legacy }),
      (error: Error) => error.message === 'KOPPLAS_MONITOR_URL conflicts with ELPRO_MONITOR_URL');
  }
});

test('monitor rejects conflicting statuses in either alias order', () => {
  for (const [current, legacy] of [['200', '204'], ['204', '200']]) {
    assert.throws(() => availabilityConfigFromEnv({ KOPPLAS_MONITOR_URL: target, KOPPLAS_MONITOR_EXPECTED_STATUS: current, ELPRO_MONITOR_EXPECTED_STATUS: legacy }), /conflicts/);
  }
});

test('monitor rejects missing or malformed targets including canonical values over a valid fallback', () => {
  assert.throws(() => availabilityConfigFromEnv({}), /required/);
  assert.throws(() => availabilityConfigFromEnv({ KOPPLAS_MONITOR_URL: '', ELPRO_MONITOR_URL: '' }), /required/);
  for (const value of [' ', 'invalid', '/login', 'http://pilot.example.test/login']) {
    assert.throws(() => availabilityConfigFromEnv({ KOPPLAS_MONITOR_URL: value }));
    assert.throws(() => availabilityConfigFromEnv({ ELPRO_MONITOR_URL: value }));
    assert.throws(() => availabilityConfigFromEnv({ KOPPLAS_MONITOR_URL: value, ELPRO_MONITOR_URL: target }));
  }
});

test('monitor rejects malformed statuses rather than partially parsing them', () => {
  for (const value of ['200junk', '200.5', ' 200', '200 ', '0200', '2e2', '99', '600', 'NaN', 'invalid']) {
    assert.throws(() => availabilityConfigFromEnv({ KOPPLAS_MONITOR_URL: target, KOPPLAS_MONITOR_EXPECTED_STATUS: value }), /HTTP status code/);
    assert.throws(() => availabilityConfigFromEnv({ ELPRO_MONITOR_URL: target, ELPRO_MONITOR_EXPECTED_STATUS: value }), /HTTP status code/);
    assert.throws(() => availabilityConfigFromEnv({ KOPPLAS_MONITOR_URL: target, KOPPLAS_MONITOR_EXPECTED_STATUS: value, ELPRO_MONITOR_EXPECTED_STATUS: '200' }), /conflicts/);
  }
  for (const value of ['100', '599']) {
    assert.equal(availabilityConfigFromEnv({ KOPPLAS_MONITOR_URL: target, KOPPLAS_MONITOR_EXPECTED_STATUS: value }).expectedStatus, Number(value));
  }
});

test('monitor probe uses the Kopplas user agent and the exact configured target without redirects', async () => {
  let called = false;
  const result = await probeAvailability({
    ...availabilityConfigFromEnv({ KOPPLAS_MONITOR_URL: target }),
    fetchImpl: async (url, init) => {
      called = true;
      assert.ok(url instanceof URL);
      assert.ok(init);
      assert.equal(url.href, target);
      assert.equal(init.redirect, 'manual');
      assert.deepEqual(init.headers, { 'user-agent': 'kopplas-pilot-availability-monitor/1.0' });
      return new Response('', { status: 200 });
    },
  });
  assert.equal(called, true);
  assert.equal(result.status, 'ok');
});

test('monitor CLI rejects raw workflow conflicts before emitting an availability result', () => {
  const output = join(tmpdir(), `kopplas-probe-conflict-${crypto.randomUUID()}.json`);
  const script = fileURLToPath(new URL('../../../scripts/ops/probe-availability.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--output', output], {
    env: { ...process.env, KOPPLAS_MONITOR_URL: target, ELPRO_MONITOR_URL: otherTarget },
    encoding: 'utf8', timeout: 5_000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /KOPPLAS_MONITOR_URL conflicts with ELPRO_MONITOR_URL/);
  assert.equal(result.stdout, '');
  assert.equal(existsSync(output), false);
});

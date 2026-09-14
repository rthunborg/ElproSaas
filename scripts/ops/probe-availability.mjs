import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_TIMEOUT_MS = 10_000;

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseArgs(args) {
  const outputIndex = args.indexOf('--output');
  if (outputIndex === -1 || !args[outputIndex + 1]) {
    throw new Error('Usage: node scripts/ops/probe-availability.mjs --output <result.json>');
  }
  return { output: resolve(args[outputIndex + 1]) };
}

function validateTarget(value) {
  const target = new URL(value);
  if (target.protocol !== 'https:' || !target.hostname) {
    throw new Error('ELPRO_MONITOR_URL must be an absolute HTTPS URL');
  }
  return target;
}

async function writeResult(output, result) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result)}\n`, { encoding: 'utf8', mode: 0o600 });
}

export async function probeAvailability({ targetUrl, expectedStatus = 200, fetchImpl = fetch, now = () => new Date(), clock = () => performance.now() }) {
  if (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599) {
    throw new Error('ELPRO_MONITOR_EXPECTED_STATUS must be an HTTP status code');
  }

  const target = validateTarget(targetUrl);
  const startedAt = now();
  const started = clock();
  let result;

  try {
    const response = await fetchImpl(target, {
      headers: { 'user-agent': 'elpro-pilot-availability-monitor/1.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    const durationMs = Math.round(clock() - started);
    result = {
      checked_at: startedAt.toISOString(),
      duration_ms: durationMs,
      expected_status: expectedStatus,
      observed_status: response.status,
      status: response.status === expectedStatus ? 'ok' : 'failed',
    };
  } catch (error) {
    result = {
      checked_at: startedAt.toISOString(),
      duration_ms: Math.round(clock() - started),
      expected_status: expectedStatus,
      observed_status: null,
      status: 'failed',
      error: error instanceof Error ? error.name : 'UnknownError',
    };
  }

  return result;
}

async function main() {
  const { output } = parseArgs(process.argv.slice(2));
  const result = await probeAvailability({
    targetUrl: required('ELPRO_MONITOR_URL'),
    expectedStatus: Number.parseInt(process.env.ELPRO_MONITOR_EXPECTED_STATUS ?? '200', 10),
  });
  await writeResult(output, result);
  console.log(JSON.stringify(result));
  if (result.status !== 'ok') {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

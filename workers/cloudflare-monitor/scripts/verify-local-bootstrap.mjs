import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const port = 8798;
const runId = randomUUID();
const persistenceDir = resolve('.wrangler', 'test-state', runId);
const resultPath = resolve('.wrangler', 'test-results', `bootstrap-${runId}.json`);
const wranglerEntry = resolve('node_modules', 'wrangler', 'bin', 'wrangler.js');
let child;
let childError = null;

let output = '';

function waitForReady() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for local Worker:\n${output}`)), 20_000);
    const check = () => {
      if (childError) {
        clearTimeout(timeout);
        reject(childError);
      } else if (/Ready on|http:\/\/127\.0\.0\.1:8798|http:\/\/localhost:8798/.test(output)) {
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stdout.on('data', check);
    child.stderr.on('data', check);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Local Worker exited before ready (${code}):\n${output}`));
    });
    check();
  });
}

function waitForOutput(pattern, description) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${description}:\n${output}`)), 10_000);
    const check = () => {
      if (pattern.test(output)) {
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stdout.on('data', check);
    child.stderr.on('data', check);
    check();
  });
}

async function stop() {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

let result = { runId, status: 'failed', stage: 'initializing', scheduledAt: null, persistenceDir, runtimeLogRequired: 'monitor_sample_recorded', failureClass: null, failureMessage: null, runtimeOutput: null };

function sanitizedRuntimeOutput(value) {
  return value
    .replaceAll(process.cwd(), '<workdir>')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>')
    .slice(-16_000);
}

try {
  result = { ...result, stage: 'starting local Worker' };
  await mkdir(persistenceDir, { recursive: true });
  child = spawn(process.execPath, [wranglerEntry, 'dev', '--test-scheduled', '--local', '--persist-to', persistenceDir, '--port', String(port), '--config', 'wrangler.test.jsonc'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const append = (chunk) => { output += chunk.toString(); };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.once('error', (error) => { childError = error; });
  await waitForReady();
  result = { ...result, stage: 'dispatching local scheduled event' };
  const scheduledAt = 1_800_000_000_000;
  const response = await fetch(`http://127.0.0.1:${port}/cdn-cgi/local/scheduled?format=json&cron=*/5+*+*+*+*&time=${scheduledAt}`);
  result = { ...result, stage: 'verifying scheduled response', scheduledAt };
  assert.equal(response.status, 200);
  const outcome = await response.json();
  assert.equal(outcome.outcome, 'ok');
  assert.equal(outcome.noRetry, false);
  result = { ...result, stage: 'verifying Durable Object sample write', scheduledAt };
  await waitForOutput(new RegExp(`\\"event\\":\\"monitor_sample_recorded\\"[^\\n]*\\"scheduledAt\\":${scheduledAt}`), 'the first Durable Object sample write');
  result = { ...result, status: 'passed', stage: 'completed', scheduledAt };
  console.log('Local Cloudflare scheduled-event bootstrap passed.');
} catch (error) {
  result = {
    ...result,
    failureClass: error instanceof Error ? error.name : 'UnknownError',
    failureMessage: error instanceof Error ? error.message : 'Unknown runtime failure.',
    runtimeOutput: sanitizedRuntimeOutput(output),
  };
  throw error;
} finally {
  await stop();
  await mkdir(join('.wrangler', 'test-results'), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result)}\n`, { encoding: 'utf8', mode: 0o600 });
  console.log(`Local Cloudflare scheduled-event bootstrap result: ${resultPath}`);
}

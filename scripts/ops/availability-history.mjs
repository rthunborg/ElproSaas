const FAILED = 'failed';
const OK = 'ok';

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function assessAvailabilityFailure({ currentStatus, priorStatuses }) {
  if (![FAILED, OK].includes(currentStatus)) {
    throw new Error('Current probe status is missing or invalid');
  }
  if (!Array.isArray(priorStatuses) || priorStatuses.some((status) => ![FAILED, OK].includes(status))) {
    throw new Error('Prior probe history is missing or invalid');
  }
  if (currentStatus === OK) return { consecutiveFailures: 0, alert: false };

  let consecutiveFailures = 1;
  for (const status of priorStatuses) {
    if (status !== FAILED) break;
    consecutiveFailures += 1;
  }
  return { consecutiveFailures, alert: consecutiveFailures >= 3 };
}

export function newestArtifactUrls({ pages, currentRunId }) {
  if (!Array.isArray(pages)) throw new Error('Artifact history is missing or invalid');
  const artifacts = pages.flatMap((page) => page?.artifacts ?? []);
  const candidates = artifacts
    .filter((artifact) => artifact?.expired === false && artifact?.workflow_run?.id !== Number(currentRunId))
    .map((artifact) => {
      const createdAt = Date.parse(artifact.created_at);
      if (!Number.isFinite(createdAt) || typeof artifact.archive_download_url !== 'string' || !artifact.archive_download_url.startsWith('https://')) {
        throw new Error('Artifact history contains an invalid sampled result');
      }
      return { createdAt, url: artifact.archive_download_url };
    })
    .sort((left, right) => right.createdAt - left.createdAt);
  return candidates.slice(0, 2).map((candidate) => candidate.url);
}

async function main() {
  const [currentStatus, historyPath] = process.argv.slice(2);
  if (currentStatus === '--select-artifacts') {
    if (!historyPath || !process.argv[4]) throw new Error('Usage: node scripts/ops/availability-history.mjs --select-artifacts <pages.json> <current-run-id>');
    const pages = JSON.parse(await readFile(historyPath, 'utf8'));
    console.log(JSON.stringify(newestArtifactUrls({ pages, currentRunId: process.argv[4] })));
    return;
  }
  if (!currentStatus || !historyPath) {
    throw new Error('Usage: node scripts/ops/availability-history.mjs <current-status> <prior-statuses.json>');
  }
  const priorStatuses = JSON.parse(await readFile(historyPath, 'utf8'));
  console.log(JSON.stringify(assessAvailabilityFailure({ currentStatus, priorStatuses })));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

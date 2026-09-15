import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const LEDGERS = ['auth', 'storage'];

function validLedger(value) {
  return Number.isSafeInteger(value?.count) && value.count > 0 && typeof value?.digest === 'string' && /^[a-f0-9]{32}$/.test(value.digest);
}

export function assertMatchingPlatformMigrationLedgers(source, target) {
  for (const ledger of LEDGERS) {
    if (!validLedger(source?.[ledger]) || !validLedger(target?.[ledger]) || source[ledger].count !== target[ledger].count || source[ledger].digest !== target[ledger].digest) {
      throw new Error('Isolated platform migration-ledger verification failed');
    }
  }
}

export async function verifyPlatformMigrationLedgers({ sourcePath, targetPath }) {
  const [source, target] = await Promise.all([
    readFile(sourcePath, 'utf8').then(JSON.parse),
    readFile(targetPath, 'utf8').then(JSON.parse),
  ]);
  assertMatchingPlatformMigrationLedgers(source, target);
}

async function main() {
  const [sourcePath, targetPath] = process.argv.slice(2);
  if (!sourcePath || !targetPath) throw new Error('Usage: node scripts/ops/verify-isolated-platform-migration-ledgers.mjs <source-ledgers.json> <target-ledgers.json>');
  await verifyPlatformMigrationLedgers({ sourcePath, targetPath });
  console.log('Archived platform migration ledgers match the isolated restore target.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const REQUIRED_TABLES = new Map([
  ['public.tenants', 'tenants'],
  ['public.tenant_memberships', 'memberships'],
  ['auth.users', 'auth_users'],
  ['storage.objects', 'storage_objects'],
  ['supabase_migrations.schema_migrations', 'migrations'],
]);

function normalizeTable(value) {
  return value.replaceAll('"', '').toLowerCase();
}

export function copyCounts(sql) {
  const counts = new Map();
  let active;
  for (const line of sql.split('\n')) {
    const match = /^COPY\s+([^\s(]+)\s+\(/i.exec(line);
    if (match) {
      active = normalizeTable(match[1]);
      counts.set(active, 0);
    } else if (line === '\\.') {
      active = undefined;
    } else if (active) {
      counts.set(active, (counts.get(active) ?? 0) + 1);
    }
  }
  return counts;
}

export async function verifyRestoredCopyCounts({ dataPath, targetFactsPath }) {
  const [data, targetFacts] = await Promise.all([readFile(dataPath, 'utf8'), readFile(targetFactsPath, 'utf8').then(JSON.parse)]);
  const counts = copyCounts(data);
  for (const [table, fact] of REQUIRED_TABLES) {
    const expected = counts.get(table);
    if (!Number.isSafeInteger(expected) || !Number.isSafeInteger(targetFacts?.[fact]) || expected !== targetFacts[fact]) {
      throw new Error('Isolated restored database aggregate verification failed');
    }
  }
}

async function main() {
  const [dataPath, targetFactsPath] = process.argv.slice(2);
  if (!dataPath || !targetFactsPath) throw new Error('Usage: node scripts/ops/verify-isolated-recovery-copy-counts.mjs <data.sql> <target-facts.json>');
  await verifyRestoredCopyCounts({ dataPath, targetFactsPath });
  console.log('Archived COPY counts match isolated restored database aggregates.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
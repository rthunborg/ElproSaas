import { pathToFileURL } from 'node:url';

const PROJECT_REF = 'wmqmzznmwpheswjjozhq';
const DIRECT_HOST = `db.${PROJECT_REF}.supabase.co`;

export function assertApprovedBackupDbUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SUPABASE_BACKUP_DB_URL must be a valid PostgreSQL URL');
  }
  const directTarget = url.hostname === DIRECT_HOST && url.username === 'postgres';
  const sharedSessionPooler = url.hostname.endsWith('.pooler.supabase.com') && url.username === `postgres.${PROJECT_REF}`;
  const sslModes = url.searchParams.getAll('sslmode');
  const onlySslMode = [...url.searchParams.keys()].every((name) => name === 'sslmode') && sslModes.length === 1;
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !(directTarget || sharedSessionPooler)
    || (url.port && url.port !== '5432')
    || url.pathname !== '/postgres'
    || url.hash
    || !onlySslMode
    || !['require', 'verify-ca', 'verify-full'].includes(sslModes[0])) {
    throw new Error('SUPABASE_BACKUP_DB_URL must target the approved demo database with TLS');
  }
}

async function main() {
  let input = '';
  // GitHub Actions supplies this secret-derived value through a stdin pipe; fs.readFile does not accept raw descriptor 0 on Node 22.
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;
  assertApprovedBackupDbUrl(input.trim());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

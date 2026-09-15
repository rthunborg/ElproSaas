import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function token(secret, role) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({ role, iss: 'supabase', iat: now, exp: now + 60 * 60 });
  const signed = `${encode({ alg: 'HS256', typ: 'JWT' })}.${payload}`;
  return `${signed}.${createHmac('sha256', secret).update(signed).digest('base64url')}`;
}

export async function writeRecoveryRuntimeConfig(directory, { instance = randomUUID().replaceAll('-', ''), dbPort = 55432, apiPort = 58000 } = {}) {
  if (!/^[a-z0-9]+$/i.test(instance) || !Number.isInteger(dbPort) || !Number.isInteger(apiPort) || dbPort < 1024 || dbPort > 65535 || apiPort < 1024 || apiPort > 65535) {
    throw new Error('Recovery runtime configuration is invalid');
  }
  const root = resolve(directory);
  await mkdir(root, { recursive: true });
  const password = randomBytes(32).toString('hex');
  const jwtSecret = randomBytes(32).toString('base64url');
  const anonKey = token(jwtSecret, 'anon');
  const serviceKey = token(jwtSecret, 'service_role');
  const project = `elpro-isolated-recovery-${instance}`;
  const env = [
    `POSTGRES_PASSWORD=${password}`, `JWT_SECRET=${jwtSecret}`, `ANON_KEY=${anonKey}`, `SERVICE_ROLE_KEY=${serviceKey}`, `SERVICE_KEY=${serviceKey}`,
    `GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:${password}@db:5432/postgres`, `GOTRUE_SITE_URL=http://127.0.0.1:${apiPort}`, `GOTRUE_URI_ALLOW_LIST=http://127.0.0.1:${apiPort}`,
    `API_EXTERNAL_URL=http://127.0.0.1:${apiPort}/auth/v1`, `GOTRUE_JWT_SECRET=${jwtSecret}`, `GOTRUE_JWT_ISSUER=http://127.0.0.1:${apiPort}/auth/v1`,
    `PGRST_DB_URI=postgres://authenticator:${password}@db:5432/postgres`, `PGRST_JWT_SECRET=${jwtSecret}`, `PGRST_APP_SETTINGS_JWT_SECRET=${jwtSecret}`,
    `AUTH_JWT_SECRET=${jwtSecret}`, `DATABASE_URL=postgres://supabase_storage_admin:${password}@db:5432/postgres`, `STORAGE_PUBLIC_URL=http://127.0.0.1:${apiPort}`,
  ].join('\n');
  const dbOverride = `name: ${project}\n\nservices:\n  db:\n    ports:\n      - "127.0.0.1:${dbPort}:5432"\n`;
  const runtimeOverride = `name: ${project}\n\nservices:\n  db:\n    ports:\n      - "127.0.0.1:${dbPort}:5432"\n  gateway:\n    ports:\n      - "127.0.0.1:${apiPort}:8000"\n`;
  await Promise.all([
    writeFile(resolve(root, '.env'), `${env}\n`, { mode: 0o600, flag: 'wx' }),
    writeFile(resolve(root, '.private.db-bootstrap.compose.yaml'), dbOverride, { mode: 0o600, flag: 'wx' }),
    writeFile(resolve(root, '.private.runtime.compose.yaml'), runtimeOverride, { mode: 0o600, flag: 'wx' }),
  ]);
}

async function main() {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: node scripts/ops/write-recovery-runtime-config.mjs <ops-recovery-directory>');
  await writeRecoveryRuntimeConfig(directory);
  console.log('Ephemeral isolated recovery runtime configuration written.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

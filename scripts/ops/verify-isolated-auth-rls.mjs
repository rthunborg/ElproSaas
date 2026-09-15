import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { assertIsolatedRecoveryUrl } from './restore-supabase-storage.mjs';

async function request(fetchImpl, url, options, error) {
  let response;
  try {
    response = await fetchImpl(url, { ...options, redirect: 'error' });
  } catch {
    throw new Error(error);
  }
  if (!response.ok) throw new Error(error);
  return response;
}

export async function verifyIsolatedAuthRls({ recoveryUrl, serviceRoleKey, fetchImpl = fetch }) {
  const target = assertIsolatedRecoveryUrl(recoveryUrl);
  const email = `recovery-check-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  let userId;
  try {
    const created = await request(fetchImpl, new URL('auth/v1/admin/users', target), {
      method: 'POST',
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true }),
    }, 'Isolated Auth verification failed');
    const user = await created.json().catch(() => undefined);
    if (typeof user?.id !== 'string') throw new Error('Isolated Auth verification failed');
    userId = user.id;
    const token = await request(fetchImpl, new URL('auth/v1/token?grant_type=password', target), {
      method: 'POST',
      headers: { apikey: serviceRoleKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }, 'Isolated Auth verification failed');
    const session = await token.json().catch(() => undefined);
    if (typeof session?.access_token !== 'string') throw new Error('Isolated Auth verification failed');
    const tenants = await request(fetchImpl, new URL('rest/v1/tenants?select=id', target), {
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${session.access_token}`, prefer: 'count=exact' },
    }, 'Isolated tenant isolation verification failed');
    const rows = await tenants.json().catch(() => undefined);
    if (!Array.isArray(rows) || rows.length !== 0 || !/\/(?:0|\*)$/.test(tenants.headers.get('content-range') ?? '')) {
      throw new Error('Isolated tenant isolation verification failed');
    }
    const membership = await request(fetchImpl, new URL('rest/v1/rpc/is_active_tenant_member', target), {
      method: 'POST',
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ target_tenant_id: randomUUID() }),
    }, 'Isolated tenant RPC isolation verification failed');
    if (await membership.json().catch(() => undefined) !== false) {
      throw new Error('Isolated tenant RPC isolation verification failed');
    }
  } finally {
    if (userId) {
      await request(fetchImpl, new URL(`auth/v1/admin/users/${encodeURIComponent(userId)}`, target), {
        method: 'DELETE', headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
      }, 'Isolated Auth verification cleanup failed');
    }
  }
}

async function main() {
  const key = process.env.RECOVERY_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('RECOVERY_SUPABASE_SERVICE_ROLE_KEY is required');
  await verifyIsolatedAuthRls({ recoveryUrl: process.env.RECOVERY_SUPABASE_URL, serviceRoleKey: key });
  console.log('Isolated Auth and tenant-safe REST verification passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

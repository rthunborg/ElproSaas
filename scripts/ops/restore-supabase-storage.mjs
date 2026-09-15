import { createReadStream } from 'node:fs';
import { lstat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseChecksumManifest, verifyBackupChecksums } from './verify-backup-checksums.mjs';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function contained(root, ...segments) {
  const candidate = resolve(root, ...segments);
  const relation = relative(root, candidate);
  if (relation === '' || relation === '..' || relation.startsWith(`..${sep}`)) {
    throw new Error('Storage restore path escapes its backup workspace');
  }
  return candidate;
}

function safeBucket(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    throw new Error('Storage restore manifest has an invalid bucket');
  }
  return value;
}

function safeObjectPath(value) {
  if (typeof value !== 'string' || !value) throw new Error('Storage restore manifest has an invalid object path');
  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || /[\\\0]/.test(segment))) {
    throw new Error('Storage restore manifest has an invalid object path');
  }
  return segments;
}

export function assertIsolatedRecoveryUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('RECOVERY_SUPABASE_URL must be a valid loopback HTTP URL');
  }
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname) || !url.port || Number(url.port) < 1024 || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('RECOVERY_SUPABASE_URL must target a high loopback HTTP port');
  }
  return url;
}

export async function readStorageManifest(root) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(contained(root, 'storage', 'manifest.json'), 'utf8'));
  } catch {
    throw new Error('Storage restore manifest is missing or invalid');
  }
  if (typeof manifest?.exported_at !== 'string' || !Array.isArray(manifest.objects)) {
    throw new Error('Storage restore manifest is missing or invalid');
  }
  const seen = new Set();
  return manifest.objects.map((object) => {
    const bucket = safeBucket(object?.bucket);
    const segments = safeObjectPath(object?.path);
    const bytes = object?.bytes;
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Storage restore manifest has an invalid byte count');
    const identity = `${bucket}\0${segments.join('/')}`;
    if (seen.has(identity)) throw new Error('Storage restore manifest has duplicate objects');
    seen.add(identity);
    return { bucket, segments, bytes };
  });
}

async function assertStorageManifestIsChecksummed(root, objects) {
  let checksumEntries;
  try {
    checksumEntries = parseChecksumManifest(await readFile(contained(root, 'SHA256SUMS'), 'utf8'));
  } catch {
    throw new Error('Storage restore checksum manifest is missing or invalid');
  }
  const checksummedStoragePaths = new Set(
    checksumEntries
      .map((entry) => entry.path)
      .filter((path) => path.startsWith('storage/') && path !== 'storage/manifest.json'),
  );
  const manifestStoragePaths = new Set(objects.map((object) => `storage/${object.bucket}/${object.segments.join('/')}`));
  if (checksummedStoragePaths.size !== manifestStoragePaths.size || [...manifestStoragePaths].some((path) => !checksummedStoragePaths.has(path))) {
    throw new Error('Storage restore manifest does not exactly match checksummed objects');
  }
}

export async function readRestoredObjectMetadata(target, object, serviceRoleKey, fetchImpl) {
  const endpoint = new URL(`storage/v1/object/info/${encodeURIComponent(object.bucket)}/${object.segments.map(encodeURIComponent).join('/')}`, target);
  let response;
  try {
    response = await fetchImpl(endpoint, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
      redirect: 'error',
    });
  } catch {
    throw new Error('Isolated Storage object metadata lookup failed');
  }
  if (!response.ok) throw new Error('Isolated Storage object metadata lookup failed');
  let metadata;
  try {
    metadata = await response.json();
  } catch {
    throw new Error('Isolated Storage object metadata lookup failed');
  }
  // Storage API v1.74.0's renderer exposes file metadata at the top level;
  // `metadata` is the opaque DB user_metadata object and must not be reinterpreted.
  const contentType = metadata?.contentType ?? metadata?.content_type;
  const cacheControl = metadata?.cacheControl ?? metadata?.cache_control;
  if (typeof contentType !== 'string' || !contentType || (cacheControl !== undefined && (typeof cacheControl !== 'string' || !cacheControl))) {
    throw new Error('Isolated Storage object metadata lookup failed');
  }
  return { contentType, cacheControl };
}


async function readStorageRestorePlan(planPath, objects) {
  let plan;
  try {
    plan = JSON.parse(await readFile(planPath, 'utf8'));
  } catch {
    throw new Error('Storage restore plan is missing or invalid');
  }
  if (!Array.isArray(plan?.objects)) throw new Error('Storage restore plan is missing or invalid');
  const expected = new Map();
  for (const item of plan.objects) {
    const bucket = safeBucket(item?.bucket);
    const segments = safeObjectPath(item?.path);
    const bytes = item?.bytes;
    const contentType = item?.content_type;
    const cacheControl = item?.cache_control;
    if (!Number.isSafeInteger(bytes) || bytes < 0 || typeof contentType !== 'string' || !contentType || typeof cacheControl !== 'string' || !cacheControl) {
      throw new Error('Storage restore plan is missing or invalid');
    }
    const identity = `${bucket}\0${segments.join('/')}`;
    if (expected.has(identity)) throw new Error('Storage restore plan is missing or invalid');
    expected.set(identity, { bytes, contentType, cacheControl });
  }
  if (expected.size !== objects.length || objects.some((object) => {
    const entry = expected.get(`${object.bucket}\0${object.segments.join('/')}`);
    return !entry || entry.bytes !== object.bytes;
  })) {
    throw new Error('Storage restore plan does not exactly match the backup manifest');
  }
  return expected;
}
async function checksumStream(stream) {
  const hash = createHash('sha256');
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

async function verifyRestoredObject(target, object, localPath, expectedMetadata, serviceRoleKey, fetchImpl) {
  const endpoint = new URL(`storage/v1/object/${encodeURIComponent(object.bucket)}/${object.segments.map(encodeURIComponent).join('/')}`, target);
  let response;
  try {
    response = await fetchImpl(endpoint, {
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
      redirect: 'error',
    });
  } catch {
    throw new Error('Isolated Storage object verification failed');
  }
  if (!response.ok || !response.body) throw new Error('Isolated Storage object verification failed');
  const [sourceChecksum, restoredChecksum, restoredMetadata] = await Promise.all([
    checksumStream(createReadStream(localPath)),
    checksumStream(Readable.fromWeb(response.body)),
    readRestoredObjectMetadata(target, object, serviceRoleKey, fetchImpl),
  ]);
  if (sourceChecksum !== restoredChecksum || !restoredMetadata.contentType || (expectedMetadata && (restoredMetadata.contentType !== expectedMetadata.contentType || restoredMetadata.cacheControl !== expectedMetadata.cacheControl))) {
    throw new Error('Isolated Storage object verification failed');
  }
}

/**
 * Verify a physical, version-addressed file-backend restore through the isolated API.
 * This intentionally performs no Storage upload/upsert and therefore cannot change
 * the already restored storage.objects rows or invoke application immutability triggers.
 */
export async function restoreStorageManifest({ root, recoveryUrl, serviceRoleKey, planPath = undefined, fetchImpl = fetch }) {
  const target = assertIsolatedRecoveryUrl(recoveryUrl);
  if (typeof serviceRoleKey !== 'string' || !serviceRoleKey) throw new Error('RECOVERY_SUPABASE_SERVICE_ROLE_KEY is required');
  const workspace = resolve(root);
  await verifyBackupChecksums(workspace);
  const objects = await readStorageManifest(workspace);
  await assertStorageManifestIsChecksummed(workspace, objects);
  const expectedMetadata = planPath ? await readStorageRestorePlan(planPath, objects) : null;
  let restoredBytes = 0;
  for (const object of objects) {
    const localPath = contained(workspace, 'storage', object.bucket, ...object.segments);
    let stats;
    try {
      stats = await lstat(localPath);
    } catch {
      throw new Error('Storage backup object is missing or has an unexpected byte count');
    }
    if (!stats.isFile() || stats.size !== object.bytes) throw new Error('Storage backup object is missing or has an unexpected byte count');
    await verifyRestoredObject(target, object, localPath, expectedMetadata?.get(`${object.bucket}\0${object.segments.join('/')}`), serviceRoleKey, fetchImpl);
    restoredBytes += object.bytes;
  }
  return { objects: objects.length, bytes: restoredBytes };
}

async function main() {
  const root = process.argv[2];
  if (!root) throw new Error('Usage: node scripts/ops/restore-supabase-storage.mjs <decrypted-backup-workspace>');
  const result = await restoreStorageManifest({
    root,
    recoveryUrl: required('RECOVERY_SUPABASE_URL'),
    serviceRoleKey: required('RECOVERY_SUPABASE_SERVICE_ROLE_KEY'),
    planPath: required('RECOVERY_STORAGE_RESTORE_PLAN'),
  });
  console.log(`Verified ${result.objects} restored Storage object(s), ${result.bytes} byte(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

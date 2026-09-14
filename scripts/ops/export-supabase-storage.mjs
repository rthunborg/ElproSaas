import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseArgs(args) {
  const outputIndex = args.indexOf('--output');
  const inventoryIndex = args.indexOf('--inventory');
  const expectedInventoryIndex = args.indexOf('--expect-inventory');
  if (outputIndex === -1 && inventoryIndex === -1) {
    throw new Error('Usage: node scripts/ops/export-supabase-storage.mjs --output <directory> [--expect-inventory <file>] | --inventory <file>');
  }
  if (outputIndex !== -1 && !args[outputIndex + 1]) throw new Error('--output requires a directory');
  if (inventoryIndex !== -1 && !args[inventoryIndex + 1]) throw new Error('--inventory requires a file');
  if (expectedInventoryIndex !== -1 && !args[expectedInventoryIndex + 1]) throw new Error('--expect-inventory requires a file');
  if (inventoryIndex !== -1 && outputIndex !== -1) throw new Error('--inventory cannot be combined with --output');
  return {
    output: outputIndex === -1 ? null : resolve(args[outputIndex + 1]),
    inventory: inventoryIndex === -1 ? null : resolve(args[inventoryIndex + 1]),
    expectedInventory: expectedInventoryIndex === -1 ? null : resolve(args[expectedInventoryIndex + 1]),
  };
}

export function safeSegment(value, label) {
  if (typeof value !== 'string' || !value || value === '.' || value === '..' || /[\\/\0]/.test(value)) {
    throw new Error(`Unsafe ${label} returned by Storage`);
  }
  return value;
}

export function destination(root, ...segments) {
  const path = resolve(root, ...segments);
  const contained = relative(root, path);
  if (contained.startsWith(`..${sep}`) || contained === '..' || path === root) {
    throw new Error('Storage export path escapes its output directory');
  }
  return path;
}

export async function listAll(storage, bucket, prefix) {
  const entries = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await storage.from(bucket).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error('Could not list Storage objects');
    entries.push(...data);
    if (data.length < PAGE_SIZE) return entries;
  }
}

function objectSize(entry) {
  const size = Number(entry.metadata?.size);
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error('Storage object metadata has no safe byte size');
  }
  return size;
}

export async function planStorageExport({ storage, bucket, prefix = '' }) {
  const entries = await listAll(storage, bucket, prefix);
  const objects = [];
  for (const entry of entries) {
    const name = safeSegment(entry.name, 'object name');
    const objectPath = prefix ? `${prefix}/${name}` : name;
    if (entry.id == null) {
      objects.push(...await planStorageExport({ storage, bucket, prefix: objectPath }));
      continue;
    }
    objects.push({
      bucket,
      path: objectPath,
      bytes: objectSize(entry),
      last_modified: entry.updated_at ?? null,
    });
  }
  return objects;
}

export function normalizedStorageInventory(objects) {
  if (!Array.isArray(objects)) throw new Error('Storage inventory is missing or invalid');
  return objects.map((object) => ({
    bucket: object.bucket,
    path: object.path,
    bytes: object.bytes,
    last_modified: object.last_modified ?? null,
  })).sort((left, right) => `${left.bucket}\0${left.path}`.localeCompare(`${right.bucket}\0${right.path}`));
}

export function assertStorageInventoryUnchanged(before, after) {
  if (JSON.stringify(normalizedStorageInventory(before)) !== JSON.stringify(normalizedStorageInventory(after))) {
    throw new Error('Storage inventory changed during backup; retry after writes have quiesced');
  }
}

export async function readStorageInventory(inventoryPath) {
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  return normalizedStorageInventory(inventory.objects);
}

export async function inventoryStorage({ storage }) {
  const { data: buckets, error } = await storage.listBuckets();
  if (error) throw new Error('Could not list Storage buckets');
  const objects = [];
  for (const bucket of [...(buckets ?? [])].sort((left, right) => left.name.localeCompare(right.name))) {
    objects.push(...await planStorageExport({ storage, bucket: safeSegment(bucket.name, 'bucket name') }));
  }
  return normalizedStorageInventory(objects);
}

export async function exportStoragePlan({ storage, objects, output, manifest }) {
  for (const object of objects) {
    const { bucket, path: objectPath } = object;

    const { data, error } = await storage.from(bucket).download(objectPath);
    if (error) throw new Error('Could not download a Storage object');
    const bytes = Buffer.from(await data.arrayBuffer());
    const localPath = destination(output, bucket, ...objectPath.split('/').map((part) => safeSegment(part, 'object path segment')));
    await mkdir(resolve(localPath, '..'), { recursive: true });
    await writeFile(localPath, bytes, { mode: 0o600 });
    if (bytes.byteLength !== object.bytes) throw new Error('A Storage object changed size during export');
    manifest.objects.push(object);
  }
}

export function parseStorageByteLimit(value) {
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new Error('BACKUP_MAX_STORAGE_BYTES must be a non-negative integer');
  }
  return limit;
}

export function assertPlanWithinStorageLimit(objects, byteLimit) {
  const plannedBytes = objects.reduce((total, object) => total + object.bytes, 0);
  if (plannedBytes > byteLimit) {
    throw new Error(`Storage export would transfer ${plannedBytes} bytes, above BACKUP_MAX_STORAGE_BYTES=${byteLimit}`);
  }
  return plannedBytes;
}

async function main() {
  const { output, inventory, expectedInventory } = parseArgs(process.argv.slice(2));
  const supabaseUrl = new URL(required('SUPABASE_URL'));
  if (supabaseUrl.protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS');
  const storage = createClient(supabaseUrl.toString(), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  }).storage;
  const plan = await inventoryStorage({ storage });
  if (inventory) {
    await mkdir(resolve(inventory, '..'), { recursive: true });
    await writeFile(inventory, `${JSON.stringify({ objects: plan }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    console.log(`Captured Storage inventory with ${plan.length} object(s).`);
    return;
  }

  const root = resolve(output);
  if (expectedInventory) {
    assertStorageInventoryUnchanged(await readStorageInventory(expectedInventory), plan);
  }

  await mkdir(root, { recursive: true });
  const manifest = { exported_at: new Date().toISOString(), objects: [] };
  const byteLimit = parseStorageByteLimit(required('BACKUP_MAX_STORAGE_BYTES'));
  assertPlanWithinStorageLimit(plan, byteLimit);
  await exportStoragePlan({ storage, objects: plan, output: root, manifest });
  assertStorageInventoryUnchanged(plan, await inventoryStorage({ storage }));
  await writeFile(join(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  console.log(`Exported ${manifest.objects.length} Storage object(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

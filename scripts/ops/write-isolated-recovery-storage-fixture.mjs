import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BUCKET = 'tenant-files';
const CONTENT_TYPE = 'application/pdf';
const CACHE_CONTROL = 'max-age=3600';

function quoted(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function objectSeed({ objectId, fileId, path, version, bytes, quotePdf }, tenantId) {
  const metadata = JSON.stringify({ size: String(Buffer.byteLength(bytes)), mimetype: CONTENT_TYPE, cacheControl: CACHE_CONTROL, elpro_file_linked_at: '2026-09-15T00:00:00.000Z' });
  const userMetadata = JSON.stringify({ recovery_regression: 'user-metadata' });
  return [
    `insert into storage.objects (id, bucket_id, name, version, metadata, user_metadata) values (${quoted(objectId)}::uuid, ${quoted(BUCKET)}, ${quoted(path)}, ${quoted(version)}::uuid, ${quoted(metadata)}::jsonb, ${quoted(userMetadata)}::jsonb);`,
    `insert into public.files (id, tenant_id, bucket_id, object_path, display_name, mime_type, size_bytes, lifecycle_state, artifact_kind) values (${quoted(fileId)}::uuid, ${quoted(tenantId)}::uuid, ${quoted(BUCKET)}, ${quoted(path)}, ${quoted(quotePdf ? 'recovery-quote.pdf' : 'recovery-generic.pdf')}, ${quoted(CONTENT_TYPE)}, ${Buffer.byteLength(bytes)}, 'linked', ${quotePdf ? "'quote_pdf'" : 'null'});`,
    `insert into public.file_links (tenant_id, file_id, owner_type, owner_id, purpose) values (${quoted(tenantId)}::uuid, ${quoted(fileId)}::uuid, ${quoted(quotePdf ? 'quote_version' : 'customer')}, ${quoted(crypto.randomUUID())}::uuid, ${quoted(quotePdf ? 'quote_pdf' : 'crm_document')});`,
  ].join('\n');
}

export async function writeIsolatedRecoveryStorageFixture(destination) {
  const root = resolve(destination);
  const workspace = join(root, 'backup-workspace');
  const tenantId = crypto.randomUUID();
  const generic = { objectId: crypto.randomUUID(), fileId: crypto.randomUUID(), version: crypto.randomUUID(), bucket: BUCKET, path: 'recovery-proof/generic.pdf', bytes: 'synthetic recovery generic bytes', quotePdf: false };
  const quotePdf = { objectId: crypto.randomUUID(), fileId: crypto.randomUUID(), version: crypto.randomUUID(), bucket: BUCKET, path: 'recovery-proof/quote.pdf', bytes: 'synthetic recovery quote PDF bytes', quotePdf: true };
  const objects = [generic, quotePdf];
  await mkdir(join(workspace, 'storage', BUCKET, 'recovery-proof'), { recursive: true, mode: 0o700 });
  await Promise.all(objects.map((object) => writeFile(join(workspace, 'storage', object.bucket, object.path), object.bytes, { mode: 0o600 })));
  await writeFile(join(workspace, 'storage', 'manifest.json'), JSON.stringify({ exported_at: '2026-09-15T00:00:00.000Z', objects: objects.map((object) => ({ bucket: object.bucket, path: object.path, bytes: Buffer.byteLength(object.bytes) })) }), { mode: 0o600 });
  await writeFile(join(root, 'storage-restore-plan.json'), JSON.stringify({ objects: objects.map((object) => ({ bucket: object.bucket, path: object.path, bytes: Buffer.byteLength(object.bytes), version: object.version, content_type: CONTENT_TYPE, cache_control: CACHE_CONTROL })) }), { mode: 0o600 });
  await writeFile(join(root, 'storage-fixture.json'), JSON.stringify({ tenantId, objects }), { mode: 0o600 });
  await writeFile(join(root, 'storage-seed.sql'), [
    `insert into storage.buckets (id, name, public) values (${quoted(BUCKET)}, ${quoted(BUCKET)}, false) on conflict (id) do nothing;`,
    `insert into public.tenants (id, name) values (${quoted(tenantId)}::uuid, 'Isolated recovery proof tenant');`,
    ...objects.map((object) => objectSeed(object, tenantId)),
  ].join('\n'), { mode: 0o600 });
  return { root, objects: objects.length, bytes: objects.reduce((total, object) => total + Buffer.byteLength(object.bytes), 0) };
}

async function main() {
  const destination = process.argv[2];
  if (!destination) throw new Error('Usage: node scripts/ops/write-isolated-recovery-storage-fixture.mjs <destination>');
  const result = await writeIsolatedRecoveryStorageFixture(destination);
  console.log(`Prepared ${result.objects} synthetic Storage restore object(s), ${result.bytes} byte(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}

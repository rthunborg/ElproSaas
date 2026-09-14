import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

function contained(root, candidate) {
  const path = resolve(root, candidate);
  const relation = relative(root, path);
  if (!candidate || relation === '' || relation === '..' || relation.startsWith(`..${sep}`)) {
    throw new Error(`Checksum manifest path escapes backup root: ${candidate}`);
  }
  return path;
}

export function parseChecksumManifest(input) {
  const rows = input.trim().split('\n').filter(Boolean);
  if (rows.length === 0) throw new Error('Checksum manifest is empty');
  return rows.map((row) => {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(row);
    if (!match) throw new Error(`Malformed checksum manifest row: ${row}`);
    return { checksum: match[1], path: match[2] };
  });
}

export async function verifyBackupChecksums(root) {
  const manifestPath = resolve(root, 'SHA256SUMS');
  let manifest;
  try {
    manifest = await readFile(manifestPath, 'utf8');
  } catch {
    throw new Error('Backup checksum manifest is missing');
  }
  for (const entry of parseChecksumManifest(manifest)) {
    const path = contained(root, entry.path);
    let bytes;
    try {
      bytes = await readFile(path);
    } catch {
      throw new Error(`Backed-up file is missing: ${entry.path}`);
    }
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== entry.checksum) throw new Error(`Backed-up file checksum mismatch: ${entry.path}`);
  }
}

async function main() {
  const root = process.argv[2];
  if (!root) throw new Error('Usage: node scripts/ops/verify-backup-checksums.mjs <decrypted-backup-workspace>');
  await verifyBackupChecksums(resolve(root));
  console.log('Backup checksums verified.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

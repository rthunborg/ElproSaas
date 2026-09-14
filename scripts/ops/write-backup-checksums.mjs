import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHECKSUM_FILE = 'SHA256SUMS';

async function collectFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(root, path));
    else if (entry.isFile() && !(directory === root && entry.name === CHECKSUM_FILE)) files.push(path);
    else if (!entry.isFile()) throw new Error('Backup workspace contains an unsupported filesystem entry');
  }
  return files;
}

export async function writeBackupChecksums(root) {
  const absoluteRoot = resolve(root);
  const files = await collectFiles(absoluteRoot);
  const lines = [];
  for (const file of files) {
    const relativePath = relative(absoluteRoot, file);
    if (!relativePath || relativePath.startsWith(`..${sep}`) || relativePath === '..') throw new Error('Backup member escapes its workspace');
    const digest = createHash('sha256').update(await readFile(file)).digest('hex');
    lines.push(`${digest}  ${relativePath.split(sep).join('/')}`);
  }
  await writeFile(join(absoluteRoot, CHECKSUM_FILE), `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
  return files.length;
}

async function main() {
  const root = process.argv[2];
  if (!root) throw new Error('Usage: node scripts/ops/write-backup-checksums.mjs <backup-workspace>');
  console.log(`Wrote checksums for ${await writeBackupChecksums(root)} backup member(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

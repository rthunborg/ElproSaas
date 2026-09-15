import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { accessToken, downloadNewest, MAX_RECOVERY_BACKUP_AGE_MS, validateFolderId } from './google-drive-backup.mjs';

export async function downloadRecoveryBackup({ output, folderId, token, fetchImpl = fetch, now }) {
  await mkdir(dirname(resolve(output)), { recursive: true });
  return downloadNewest({
    token,
    folderId,
    outputPath: output,
    fetchImpl,
    now,
    maxAgeMs: MAX_RECOVERY_BACKUP_AGE_MS,
  });
}

async function main() {
  const output = process.argv[2];
  if (!output) throw new Error('Usage: node scripts/ops/download-google-drive-backup.mjs <encrypted-output-path>');
  try {
    const folderId = validateFolderId(process.env.BACKUP_DRIVE_FOLDER_ID ?? '');
    const token = await accessToken();
    const backup = await downloadRecoveryBackup({ output, folderId, token });
    console.log(`Newest owned encrypted pilot backup downloaded. Created ${backup.createdTime}; age ${backup.ageMs} ms.`);
  } catch {
    throw new Error('Newest owned encrypted pilot backup download failed.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

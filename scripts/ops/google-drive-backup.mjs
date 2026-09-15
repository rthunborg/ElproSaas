import { stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,createdTime,size';
const BACKUP_MARKER = { elpro_pilot_backup: 'v1' };
const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_STALLED_RESUME_ATTEMPTS = 3;
export const MAX_RECOVERY_BACKUP_AGE_MS = 24 * 60 * 60 * 1000;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function validateFolderId(value) {
  if (!/^[A-Za-z0-9_-]{10,}$/.test(value)) throw new Error('BACKUP_DRIVE_FOLDER_ID is not a valid Drive folder ID');
  return value;
}

async function responseJson(response, context) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${context} failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

export async function accessToken({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: required('GOOGLE_DRIVE_CLIENT_ID'),
      client_secret: required('GOOGLE_DRIVE_CLIENT_SECRET'),
      refresh_token: required('GOOGLE_DRIVE_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });
  const token = await responseJson(response, 'Google OAuth refresh');
  if (!token.access_token) throw new Error('Google OAuth refresh did not return an access token');
  return token.access_token;
}

export async function upload({ token, folderId, filePath, fetchImpl = fetch }) {
  const fileStats = await stat(filePath);
  if (!fileStats.isFile() || fileStats.size === 0) throw new Error('Encrypted backup file is missing or empty');
  const metadata = {
    name: basename(filePath),
    parents: [folderId],
    mimeType: 'application/octet-stream',
    appProperties: BACKUP_MARKER,
  };
  const startResponse = await fetchImpl(DRIVE_UPLOAD_API, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-type': 'application/octet-stream',
      'x-upload-content-length': String(fileStats.size),
    },
    body: JSON.stringify(metadata),
  });
  if (!startResponse.ok) await responseJson(startResponse, 'Google Drive resumable upload start');
  const uploadUrl = startResponse.headers.get('location');
  if (!uploadUrl || !uploadUrl.startsWith('https://')) throw new Error('Google Drive resumable upload did not return an HTTPS upload URL');

  let start = 0;
  let stalledAttempts = 0;
  while (start < fileStats.size) {
    const end = Math.min(start + UPLOAD_CHUNK_BYTES, fileStats.size) - 1;
    const length = end - start + 1;
    const response = await fetchImpl(uploadUrl, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/octet-stream',
        'content-length': String(length),
        'content-range': `bytes ${start}-${end}/${fileStats.size}`,
      },
      body: createReadStream(filePath, { start, end }),
      duplex: 'half',
    });
    if (response.status === 308) {
      const range = response.headers.get('range');
      const match = /^bytes=0-(\d+)$/.exec(range ?? '');
      if (!match) throw new Error('Google Drive resumable upload did not acknowledge a valid persisted byte range');
      const persistedEnd = Number(match[1]);
      if (!Number.isSafeInteger(persistedEnd) || persistedEnd < start - 1 || persistedEnd > end) {
        throw new Error('Google Drive resumable upload acknowledged a mismatched byte range');
      }
      if (persistedEnd < start) {
        stalledAttempts += 1;
        if (stalledAttempts > MAX_STALLED_RESUME_ATTEMPTS) {
          throw new Error('Google Drive resumable upload made no progress after bounded retries');
        }
        continue;
      }
      stalledAttempts = 0;
      start = persistedEnd + 1;
      continue;
    }
    return responseJson(response, 'Google Drive resumable backup upload');
  }
  throw new Error('Google Drive resumable backup upload ended without a completion response');
}

export async function listBackups({ token, folderId, fetchImpl = fetch }) {
  const query = `'${folderId}' in parents and trashed = false and appProperties has { key='elpro_pilot_backup' and value='v1' }`;
  const results = [];
  let pageToken;
  do {
    const url = new URL(`${DRIVE_API}/files`);
    url.searchParams.set('q', query);
    url.searchParams.set('orderBy', 'createdTime desc');
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('fields', 'nextPageToken,files(id,name,createdTime,parents,appProperties,ownedByMe)');
    url.searchParams.set('spaces', 'drive');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
    const page = await responseJson(response, 'Google Drive backup listing');
    results.push(...(page.files ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return results;
}

function isEligibleBackup(backup, folderId) {
  return Boolean(
    backup?.id
    && backup.ownedByMe === true
    && backup.parents?.includes(folderId)
    && backup.appProperties?.elpro_pilot_backup === 'v1',
  );
}

function newestEligibleBackup(backups, folderId) {
  return backups
    .filter((backup) => isEligibleBackup(backup, folderId))
    .sort((left, right) => Date.parse(right.createdTime ?? '') - Date.parse(left.createdTime ?? ''))[0];
}

export function backupAge({ createdTime, now = Date.now(), maxAgeMs = MAX_RECOVERY_BACKUP_AGE_MS }) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(createdTime ?? '')) {
    throw new Error('Newest owned encrypted pilot backup has an invalid creation time');
  }
  const createdAtMs = Date.parse(createdTime);
  if (!Number.isSafeInteger(createdAtMs) || !Number.isSafeInteger(now) || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 0) {
    throw new Error('Newest owned encrypted pilot backup age cannot be verified');
  }
  if (createdAtMs > now) throw new Error('Newest owned encrypted pilot backup has a future creation time');
  const ageMs = now - createdAtMs;
  if (ageMs > maxAgeMs) throw new Error('Newest owned encrypted pilot backup is older than the 24-hour RPO');
  return ageMs;
}

export async function downloadNewest({ token, folderId, outputPath, fetchImpl = fetch, maxAgeMs = undefined, now = undefined }) {
  const backups = await listBackups({ token, folderId, fetchImpl });
  const backup = newestEligibleBackup(backups, folderId);
  if (!backup) {
    throw new Error('No owned encrypted pilot backup is available in the approved Drive folder');
  }
  const ageMs = maxAgeMs === undefined ? undefined : backupAge({ createdTime: backup.createdTime, now, maxAgeMs });
  let response;
  try {
    response = await fetchImpl(`${DRIVE_API}/files/${encodeURIComponent(backup.id)}?alt=media`, {
      headers: { authorization: `Bearer ${token}` },
      redirect: 'error',
    });
  } catch {
    throw new Error('Google Drive encrypted backup download failed');
  }
  if (!response.ok || !response.body) throw new Error('Google Drive encrypted backup download failed');
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(resolve(outputPath), { flags: 'wx', mode: 0o600 }));
  } catch {
    throw new Error('Google Drive encrypted backup download failed');
  }
  return { createdTime: backup.createdTime, ...(ageMs === undefined ? {} : { ageMs }) };
}

export async function prune({ token, folderId, fetchImpl = fetch }) {
  const backups = await listBackups({ token, folderId, fetchImpl });
  const stale = backups.slice(7);
  for (const backup of stale) {
    if (!backup.parents?.includes(folderId) || backup.appProperties?.elpro_pilot_backup !== 'v1') {
      throw new Error(`Refusing to delete backup ${backup.id}: its folder or marker changed`);
    }
    const response = await fetchImpl(`${DRIVE_API}/files/${encodeURIComponent(backup.id)}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok && response.status !== 404) await responseJson(response, `Google Drive backup deletion for ${backup.id}`);
  }
  return { retained: Math.min(backups.length, 7), deleted: stale.length };
}

export async function runBackup({ token, folderId, filePath, uploadBackup = upload, pruneBackups = prune, fetchImpl = fetch }) {
  const uploaded = await uploadBackup({ token, folderId, filePath, fetchImpl });
  const lifecycle = await pruneBackups({ token, folderId, fetchImpl });
  return { uploaded, lifecycle };
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) throw new Error('Usage: node scripts/ops/google-drive-backup.mjs <encrypted-backup-file>');
  const filePath = resolve(fileArg);
  const fileStats = await stat(filePath);
  if (!fileStats.isFile() || fileStats.size === 0) throw new Error('Encrypted backup file is missing or empty');
  const folderId = validateFolderId(required('BACKUP_DRIVE_FOLDER_ID'));
  const token = await accessToken();
  const { uploaded, lifecycle } = await runBackup({ token, folderId, filePath });
  console.log(`Uploaded encrypted backup ${uploaded.name} (${uploaded.size} bytes); retained ${lifecycle.retained}, deleted ${lifecycle.deleted}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const PLACEHOLDER = '__REPLACE_WITH_OWNER_VERIFIED_RECIPIENT__';
const SENDER_PLACEHOLDER = '__REPLACE_WITH_APPROVED_SENDER__';
const OUTPUT = resolve('wrangler.private.jsonc');

function resolveEmail(value, variableName) {
  if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`${variableName} must be one valid email address.`);
  }
  return value;
}

const config = await readFile('wrangler.jsonc', 'utf8');
if (!config.includes(PLACEHOLDER) || !config.includes(SENDER_PLACEHOLDER)) {
  throw new Error('The committed Wrangler template no longer contains the required private binding placeholders.');
}

const recipient = resolveEmail(process.env.CLOUDFLARE_MONITOR_ALERT_DESTINATION, 'CLOUDFLARE_MONITOR_ALERT_DESTINATION');
const sender = resolveEmail(process.env.CLOUDFLARE_MONITOR_SENDER, 'CLOUDFLARE_MONITOR_SENDER');
const rendered = config.replaceAll(PLACEHOLDER, recipient).replaceAll(SENDER_PLACEHOLDER, sender);
if (rendered.includes(PLACEHOLDER) || rendered.includes(SENDER_PLACEHOLDER)) {
  throw new Error('The rendered Wrangler configuration still contains a private binding placeholder.');
}
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, rendered, { encoding: 'utf8', mode: 0o600 });

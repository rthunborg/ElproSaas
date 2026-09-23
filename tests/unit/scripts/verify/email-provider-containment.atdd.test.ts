import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** RED PHASE — provider SDKs, credentials, public paths, and client reachability are forbidden before Story 13.4. */
test.skip("[P0][AC4][13.3-GUARD-001] rejects email-provider SDK imports and credential references in runtime source", async () => {
  const { scanEmailProviderContainment } = await loadContainmentChecker();
  const root = mkdtempSync(join(tmpdir(), "elpro-email-provider-"));
  const server = join(root, "src", "server", "email");
  mkdirSync(server, { recursive: true });
  writeFileSync(join(server, "provider.ts"), "import { Resend } from 'resend'; const key = process.env.RESEND_API_KEY;");
  const result = scanEmailProviderContainment(root);
  assert.ok(result.violations.some((violation: string) => /provider|credential|resend/i.test(violation)));
});

test.skip("[P0][AC4][13.3-GUARD-002] rejects any alternate email API route or a client-reachable outbox/service import", async () => {
  const { scanEmailProviderContainment } = await loadContainmentChecker();
  const root = mkdtempSync(join(tmpdir(), "elpro-email-route-"));
  const route = join(root, "src", "app", "api", "email", "send");
  const client = join(root, "src", "components");
  mkdirSync(route, { recursive: true }); mkdirSync(client, { recursive: true });
  writeFileSync(join(route, "route.ts"), "import { processDarkEmailOutbox } from '@/server/email/outbox'; export async function POST() {}");
  writeFileSync(join(client, "outbox.tsx"), "'use client'; import { processDarkEmailOutbox } from '@/server/email/outbox';");
  assert.equal(scanEmailProviderContainment(root).violations.length, 2);
});

test.skip("[P1][AC4][13.3-GUARD-003] allows the sole authenticated jobs route to import a server-only dark processor without a provider call path", async () => {
  const { scanEmailProviderContainment } = await loadContainmentChecker();
  const root = mkdtempSync(join(tmpdir(), "elpro-email-jobs-"));
  const route = join(root, "src", "app", "api", "jobs", "run");
  const outbox = join(root, "src", "server", "email");
  mkdirSync(route, { recursive: true }); mkdirSync(outbox, { recursive: true });
  writeFileSync(join(route, "route.ts"), "import { processDarkEmailOutbox } from '@/server/email/outbox';");
  writeFileSync(join(outbox, "outbox.ts"), "export async function processDarkEmailOutbox() { return { state: 'queued' }; }");
  assert.deepEqual(scanEmailProviderContainment(root).violations, []);
});

async function loadContainmentChecker(): Promise<any> {
  return import(["../../../../scripts/verify/check-service-role-containment.mjs"].join(""));
}

/**
 * CI-only proof for the physical, version-addressed recovery loader. The isolated database
 * receives logical Storage rows first; their object files are initially absent. The loader then
 * materializes bytes without a Storage API write, so real Storage API readback works while the
 * restored rows stay byte-for-byte identical and ordinary x-upserts remain rejected.
 */
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const enabled = process.env.ISOLATED_RECOVERY_STORAGE_PROOF === "1";
const recoveryUrl = process.env.RECOVERY_SUPABASE_URL;
const serviceRoleKey = process.env.RECOVERY_SUPABASE_SERVICE_ROLE_KEY;
const fixturePath = process.env.RECOVERY_STORAGE_PROOF_FIXTURE;
const beforeRowsPath = process.env.RECOVERY_STORAGE_PROOF_BEFORE_ROWS;
const execFileAsync = promisify(execFile);
const recoveryComposeFiles = ["-f", "ops/recovery/compose.yaml", "-f", "ops/recovery/.private.runtime.compose.yaml"];
const storageRowsQuery = "select coalesce(jsonb_agg(to_jsonb(o) order by bucket_id, name, id), '[]'::jsonb)::text from storage.objects o;";

function requireLoopbackUrl(value: string | undefined): URL {
  if (!value) throw new Error("RECOVERY_SUPABASE_URL is required for the isolated recovery Storage proof");
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)) {
    throw new Error("isolated recovery Storage proof requires a loopback API URL");
  }
  return url;
}

interface FixtureObject {
  readonly bucket: string;
  readonly path: string;
  readonly bytes: string;
  readonly quotePdf: boolean;
}

interface Fixture {
  readonly objects: readonly FixtureObject[];
}

const suite = enabled ? describe : describe.skip;

async function storageRows(): Promise<Record<string, unknown>[]> {
  const result = await execFileAsync("docker", [
    "compose", ...recoveryComposeFiles, "exec", "-T", "db", "psql",
    "-At", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres",
    "-c", storageRowsQuery,
  ], { windowsHide: true, maxBuffer: 1024 * 1024 });
  const rows = JSON.parse(result.stdout.trim()) as unknown;
  if (!Array.isArray(rows)) throw new Error("isolated recovery Storage proof database snapshot is invalid");
  return rows as Record<string, unknown>[];
}

function safeResponseDetail(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

async function requireSuccessfulResponse(response: Response, operation: string, object: FixtureObject): Promise<void> {
  if (response.ok) return;
  const detail = safeResponseDetail(await response.text());
  throw new Error(`Synthetic Storage ${operation} failed for ${object.bucket}/${object.path}: HTTP ${response.status} ${response.statusText}; ${detail || "empty response"}`);
}

async function readInfo(base: URL, object: FixtureObject): Promise<Record<string, unknown>> {
  const response = await fetch(new URL(`storage/v1/object/info/${object.bucket}/${object.path}`, base), {
    headers: { apikey: serviceRoleKey!, authorization: `Bearer ${serviceRoleKey!}` },
  });
  await requireSuccessfulResponse(response, "object-info", object);
  return response.json() as Promise<Record<string, unknown>>;
}

async function readBytes(base: URL, object: FixtureObject): Promise<Uint8Array> {
  const response = await fetch(new URL(`storage/v1/object/${object.bucket}/${object.path}`, base), {
    headers: { apikey: serviceRoleKey!, authorization: `Bearer ${serviceRoleKey!}` },
  });
  await requireSuccessfulResponse(response, "object-read", object);
  return new Uint8Array(await response.arrayBuffer());
}

async function assertApiObject(base: URL, object: FixtureObject): Promise<void> {
  const info = await readInfo(base, object);
  expect(info.content_type).toBe("application/pdf");
  expect(info.cache_control).toBe("max-age=3600");
  expect(info.metadata).toMatchObject({ recovery_regression: "user-metadata" });
  expect(new TextDecoder().decode(await readBytes(base, object))).toBe(object.bytes);
}

async function assertApiObjects(base: URL, objects: readonly FixtureObject[]): Promise<void> {
  for (const object of objects) await assertApiObject(base, object);
}

async function ordinaryUpsert(base: URL, object: FixtureObject): Promise<Response> {
  const bytes = new TextEncoder().encode("synthetic overwrite must be rejected");
  return fetch(new URL(`storage/v1/object/${object.bucket}/${object.path}`, base), {
    method: "POST",
    headers: {
      apikey: serviceRoleKey!, authorization: `Bearer ${serviceRoleKey!}`,
      "content-type": "application/pdf", "content-length": String(bytes.byteLength),
      "cache-control": "max-age=3600", "x-upsert": "true",
    },
    body: bytes,
  });
}

suite("isolated recovery Storage physical-loader proof", () => {
  it("serves loader-materialized bytes without mutating logical rows and rejects generic plus quote-PDF overwrite attempts", async () => {
    const base = requireLoopbackUrl(recoveryUrl);
    if (!serviceRoleKey) throw new Error("RECOVERY_SUPABASE_SERVICE_ROLE_KEY is required for the isolated recovery Storage proof");
    if (!fixturePath) throw new Error("RECOVERY_STORAGE_PROOF_FIXTURE is required for the isolated recovery Storage proof");
    if (!beforeRowsPath) throw new Error("RECOVERY_STORAGE_PROOF_BEFORE_ROWS is required for the isolated recovery Storage proof");
    const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as Fixture;
    if (!Array.isArray(fixture.objects) || fixture.objects.length !== 2 || !fixture.objects.some((object) => object.quotePdf) || !fixture.objects.some((object) => !object.quotePdf)) {
      throw new Error("isolated recovery Storage proof fixture is invalid");
    }
    const before = JSON.parse(await readFile(beforeRowsPath, "utf8")) as Record<string, unknown>[];
    if (!Array.isArray(before) || before.length !== fixture.objects.length) {
      throw new Error("isolated recovery Storage proof pre-loader row snapshot is invalid");
    }
    await assertApiObjects(base, fixture.objects);
    expect(await storageRows()).toEqual(before);
    for (const object of fixture.objects) {
      expect((await ordinaryUpsert(base, object)).ok).toBe(false);
      await assertApiObjects(base, fixture.objects);
      expect(await storageRows()).toEqual(before);
    }
  });
});

/**
 * CI-only proof for the physical, version-addressed recovery loader. The isolated database
 * receives logical Storage rows first; their object files are initially absent. The loader then
 * materializes bytes without a Storage API write, so real Storage API readback works while the
 * restored rows stay byte-for-byte identical and ordinary x-upserts remain rejected.
 */
import { readFile } from "node:fs/promises";

import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const enabled = process.env.ISOLATED_RECOVERY_STORAGE_PROOF === "1";
const recoveryUrl = process.env.RECOVERY_SUPABASE_URL;
const serviceRoleKey = process.env.RECOVERY_SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.RECOVERY_TEST_DB_URL;
const fixturePath = process.env.RECOVERY_STORAGE_PROOF_FIXTURE;

function requireLoopbackUrl(value: string | undefined): URL {
  if (!value) throw new Error("RECOVERY_SUPABASE_URL is required for the isolated recovery Storage proof");
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)) {
    throw new Error("isolated recovery Storage proof requires a loopback API URL");
  }
  return url;
}

function requireLoopbackDatabase(value: string | undefined): string {
  if (!value || !/(?:127\.0\.0\.1|localhost|\[::1\]|::1)/i.test(value)) {
    throw new Error("isolated recovery Storage proof requires a loopback database URL");
  }
  return value;
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
let pool: Pool | undefined;

async function objectRow(object: FixtureObject): Promise<Record<string, unknown>> {
  const result = await pool!.query<{ row: Record<string, unknown> }>(
    "select to_jsonb(o) as row from storage.objects o where o.bucket_id = $1 and o.name = $2",
    [object.bucket, object.path],
  );
  expect(result.rows).toHaveLength(1);
  return result.rows[0]!.row;
}

async function readInfo(base: URL, object: FixtureObject): Promise<Record<string, unknown>> {
  const response = await fetch(new URL(`storage/v1/object/info/${object.bucket}/${object.path}`, base), {
    headers: { apikey: serviceRoleKey!, authorization: `Bearer ${serviceRoleKey!}` },
  });
  expect(response.ok).toBe(true);
  return response.json() as Promise<Record<string, unknown>>;
}

async function readBytes(base: URL, object: FixtureObject): Promise<Uint8Array> {
  const response = await fetch(new URL(`storage/v1/object/${object.bucket}/${object.path}`, base), {
    headers: { apikey: serviceRoleKey!, authorization: `Bearer ${serviceRoleKey!}` },
  });
  expect(response.ok).toBe(true);
  return new Uint8Array(await response.arrayBuffer());
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
    const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as Fixture;
    if (!Array.isArray(fixture.objects) || fixture.objects.length !== 2 || !fixture.objects.some((object) => object.quotePdf) || !fixture.objects.some((object) => !object.quotePdf)) {
      throw new Error("isolated recovery Storage proof fixture is invalid");
    }
    pool = new Pool({ connectionString: requireLoopbackDatabase(dbUrl), max: 1 });
    const before = await Promise.all(fixture.objects.map(objectRow));
    for (const object of fixture.objects) {
      const info = await readInfo(base, object);
      expect(info.content_type).toBe("application/pdf");
      expect(info.cache_control).toBe("max-age=3600");
      expect(info.metadata).toMatchObject({ recovery_regression: "user-metadata" });
      expect(new TextDecoder().decode(await readBytes(base, object))).toBe(object.bytes);
    }
    for (const object of fixture.objects) expect((await ordinaryUpsert(base, object)).ok).toBe(false);
    expect(await Promise.all(fixture.objects.map(objectRow))).toEqual(before);
  });
});

afterAll(async () => {
  if (pool) await pool.end();
});

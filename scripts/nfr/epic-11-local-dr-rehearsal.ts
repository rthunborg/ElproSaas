/**
 * Local-only logical backup/restore rehearsal for Epic 11 evidence.
 * It never resets, writes to, or stops the source database. The script creates a
 * UUID-named scratch database on the existing loopback Postgres, restores a CLI
 * schema dump plus data dump, compares scoped facts, then drops only that scratch
 * database. Dump files remain under ignored tmp/private for the run record.
 */
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { Client } from "pg";
import { assertLocalStack, isLocalStackReachable, LOCAL_SUPABASE_DB_URL } from "../../tests/support/test-env";

const execFile = promisify(execFileCallback);
const runId = crypto.randomUUID().replaceAll("-", "");
const scratchDatabase = `epic11_dr_${runId}`;
const outputDir = resolve(process.cwd(), "tmp/private", `epic-11-dr-${runId}`);
const scratchRestoreRole = "supabase_admin";
// `test_support` is seeded only in the local test profile. Its forced-audit
// trigger is attached to `public.audit_events`, so the source profile must
// include it for a faithful local logical restore.
const schemas = ["auth", "storage", "public", "supabase_migrations", "test_support"] as const;
const selectedSchemas = schemas.join(",");
const schemaDump = resolve(outputDir, "application-schema.sql");
const dataDump = resolve(outputDir, "application-data.sql");

type Snapshot = {
  readonly migrations: number;
  readonly tenants: number;
  readonly memberships: number;
  readonly membershipRoles: number;
  readonly activeMemberships: number;
  readonly membershipDigest: string | null;
};

function connectionFor(database: string, username?: string): string {
  const url = new URL(LOCAL_SUPABASE_DB_URL);
  url.pathname = `/${database}`;
  if (username) url.username = username;
  return url.toString();
}

async function assertScratchRestoreRole(): Promise<void> {
  const client = new Client({ connectionString: connectionFor("postgres", scratchRestoreRole) });
  try {
    await client.connect();
    const { rows } = await client.query<{ currentUser: string; isSuperuser: boolean }>(`
      select
        current_user as "currentUser",
        (select rolsuper from pg_roles where rolname = current_user) as "isSuperuser"
    `);
    const role = rows[0];
    if (role?.currentUser !== scratchRestoreRole || role.isSuperuser !== true) {
      throw new Error("The local scratch restore role is not a usable Supabase superuser.");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "The local scratch restore role is not a usable Supabase superuser.") {
      throw error;
    }
    throw new Error("The local scratch restore role is unavailable; refusing to alter dump ownership or privilege statements.");
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function assertSourceProfileSchemas(): Promise<void> {
  const client = new Client({ connectionString: connectionFor("postgres") });
  await client.connect();
  try {
    const { rows } = await client.query<{ schema: string }>(
      `select nspname as schema from pg_namespace where nspname = any($1::text[])`,
      [schemas],
    );
    const present = new Set(rows.map((row) => row.schema));
    const missing = schemas.filter((schema) => !present.has(schema));
    if (missing.length > 0) {
      throw new Error(`The local source profile is missing required schemas: ${missing.join(", ")}.`);
    }
  } finally {
    await client.end();
  }
}

async function dump(file: string, dataOnly: boolean): Promise<void> {
  const args = ["db", "dump", "--local", "--file", file];
  if (dataOnly) args.push("--data-only");
  // A single selected-schema dump lets pg_dump order cross-schema objects and
  // data dependencies. Restoring separately dumped schemas can create a
  // trigger before the public function it references exists.
  args.push("--schema", selectedSchemas);
  await execFile("supabase", args, { cwd: process.cwd(), windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
}

async function assertMigrationMetadataDumped(): Promise<void> {
  const [schema, data] = await Promise.all([
    readFile(schemaDump, "utf8"),
    readFile(dataDump, "utf8"),
  ]);
  if (!schema.includes("schema_migrations") || !data.includes("schema_migrations")) {
    throw new Error("The local CLI dump omitted supabase_migrations.schema_migrations; refusing to claim a successful migration-aware restore.");
  }
}

async function snapshot(database: string): Promise<Snapshot> {
  const client = new Client({ connectionString: connectionFor(database) });
  await client.connect();
  try {
    const { rows } = await client.query<Snapshot>(`
      select
        (select count(*)::int from supabase_migrations.schema_migrations) as migrations,
        (select count(*)::int from public.tenants) as tenants,
        (select count(*)::int from public.tenant_memberships) as memberships,
        (select count(*)::int from public.membership_roles) as "membershipRoles",
        (select count(*)::int from public.tenant_memberships where status = 'active') as "activeMemberships",
        (select md5(coalesce(string_agg(id::text || ':' || tenant_id::text || ':' || coalesce(user_id::text, '') || ':' || status || ':' || role, ',' order by id), '')) from public.tenant_memberships) as "membershipDigest"
    `);
    return rows[0]!;
  } finally {
    await client.end();
  }
}

async function restore(database: string, file: string): Promise<void> {
  const client = new Client({ connectionString: connectionFor(database, scratchRestoreRole) });
  await client.connect();
  try {
    // `supabase db dump` emits plain SQL with INSERT statements (not psql meta
    // commands) when --use-copy is absent. The CLI's own dump wrapper also sets
    // session_replication_role around data, preserving the source fixture shape.
    // The local Supabase superuser applies the plain SQL intact, including
    // platform ownership, grants, and default-privilege statements.
    await client.query(await readFile(file, "utf8"));
  } finally {
    await client.end();
  }
}

async function bootstrapScratch(database: string): Promise<void> {
  const client = new Client({ connectionString: connectionFor(database) });
  await client.connect();
  try {
    // The CLI omits platform-owned schemas from its ordinary public dump. These
    // four local extension homes are required before the separately dumped Auth,
    // Storage, and public schemas can be restored into a plain scratch database.
    await client.query(`create schema if not exists extensions; create schema if not exists vault;`);
    await client.query(`create extension if not exists "pg_stat_statements" with schema extensions;`);
    await client.query(`create extension if not exists "pgcrypto" with schema extensions;`);
    await client.query(`create extension if not exists "uuid-ossp" with schema extensions;`);
    await client.query(`create extension if not exists "supabase_vault" with schema vault;`);
  } finally {
    await client.end();
  }
}

async function dropScratch(): Promise<void> {
  const client = new Client({ connectionString: connectionFor("postgres") });
  await client.connect();
  try {
    await client.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`, [scratchDatabase]);
    await client.query(`drop database if exists "${scratchDatabase}"`);
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  if (process.env.SUPABASE_TEST_REQUIRED !== "1") throw new Error("Set SUPABASE_TEST_REQUIRED=1: this rehearsal must never silently skip.");
  assertLocalStack();
  if (!(await isLocalStackReachable())) throw new Error("Local Supabase Auth is unreachable.");
  await assertScratchRestoreRole();
  await assertSourceProfileSchemas();
  await mkdir(outputDir, { recursive: true });
  const source = await snapshot("postgres");
  const admin = new Client({ connectionString: connectionFor("postgres") });
  try {
    await dump(schemaDump, false);
    await dump(dataDump, true);
    await assertMigrationMetadataDumped();
    await admin.connect();
    await admin.query(`create database "${scratchDatabase}"`);
    await bootstrapScratch(scratchDatabase);
    await restore(scratchDatabase, schemaDump);
    await restore(scratchDatabase, dataDump);
    const restored = await snapshot(scratchDatabase);
    if (JSON.stringify(restored) !== JSON.stringify(source)) {
      throw new Error(`Scratch restore facts differ from source: ${JSON.stringify({ source, restored })}`);
    }
    console.log(JSON.stringify({ status: "passed", sourceDatabase: "postgres", scratchDatabase, source, dumpFiles: { schemaDump, dataDump } }, null, 2));
  } finally {
    await admin.end().catch(() => undefined);
    await dropScratch();
  }
}

await main();

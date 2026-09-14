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
const schemas = ["auth", "storage", "public", "supabase_migrations"] as const;
const schemaDumps = Object.fromEntries(schemas.map((schema) => [schema, resolve(outputDir, `${schema}-schema.sql`)])) as Record<(typeof schemas)[number], string>;
const dataDumps = Object.fromEntries(schemas.map((schema) => [schema, resolve(outputDir, `${schema}-data.sql`)])) as Record<(typeof schemas)[number], string>;

type Snapshot = {
  readonly migrations: number;
  readonly tenants: number;
  readonly memberships: number;
  readonly membershipRoles: number;
  readonly activeMemberships: number;
  readonly membershipDigest: string | null;
};

function connectionFor(database: string): string {
  const url = new URL(LOCAL_SUPABASE_DB_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

async function dump(file: string, schema: (typeof schemas)[number], dataOnly: boolean): Promise<void> {
  const args = ["db", "dump", "--local", "--file", file];
  if (dataOnly) args.push("--data-only");
  args.push("--schema", schema);
  await execFile("supabase", args, { cwd: process.cwd(), windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
}

async function assertMigrationMetadataDumped(): Promise<void> {
  const [schema, data] = await Promise.all([
    readFile(schemaDumps.supabase_migrations, "utf8"),
    readFile(dataDumps.supabase_migrations, "utf8"),
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
  const client = new Client({ connectionString: connectionFor(database) });
  await client.connect();
  try {
    // `supabase db dump` emits plain SQL with INSERT statements (not psql meta
    // commands) when --use-copy is absent. The CLI's own dump wrapper also sets
    // session_replication_role around data, preserving the source fixture shape.
    const sql = (await readFile(file, "utf8"))
      // The local `postgres` role is deliberately not allowed to SET ROLE to
      // Supabase's platform-owner role. Ownership does not affect this isolated
      // logical-data verification, so retain scratch ownership as `postgres`.
      // This includes platform-owned types, domains, and views as well as
      // tables/functions. Keeping any `OWNER TO supabase_*` statement would
      // require recreating Supabase platform roles in a scratch database, which
      // would turn this narrow application-data rehearsal into a platform ACL
      // rehearsal. The restored objects stay owned by the scratch `postgres`
      // role; their shape and the scoped application data are still compared.
      .replace(/^ALTER [^\n]* OWNER TO [^;]+;\s*$/gm, "");
    await client.query(sql);
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
  await mkdir(outputDir, { recursive: true });
  const source = await snapshot("postgres");
  const admin = new Client({ connectionString: connectionFor("postgres") });
  try {
    for (const schema of schemas) await dump(schemaDumps[schema], schema, false);
    for (const schema of schemas) await dump(dataDumps[schema], schema, true);
    await assertMigrationMetadataDumped();
    await admin.connect();
    await admin.query(`create database "${scratchDatabase}"`);
    await bootstrapScratch(scratchDatabase);
    for (const schema of schemas) await restore(scratchDatabase, schemaDumps[schema]);
    for (const schema of schemas) await restore(scratchDatabase, dataDumps[schema]);
    const restored = await snapshot(scratchDatabase);
    if (JSON.stringify(restored) !== JSON.stringify(source)) {
      throw new Error(`Scratch restore facts differ from source: ${JSON.stringify({ source, restored })}`);
    }
    console.log(JSON.stringify({ status: "passed", sourceDatabase: "postgres", scratchDatabase, source, dumpFiles: { schemaDumps, dataDumps } }, null, 2));
  } finally {
    await admin.end().catch(() => undefined);
    await dropScratch();
  }
}

await main();

/**
 * Validate that a local `supabase db reset` completed even when the CLI reports a transient 502
 * during its final container restart. This never substitutes for migration execution: it requires
 * the exact repository migration ledger, the local-only seed fixtures, and a healthy auth API.
 */
import { readdir } from "node:fs/promises";
import path from "node:path";

import pg from "pg";

const { Client } = pg;
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const AUTH_HEALTH_URL = "http://127.0.0.1:54321/auth/v1/health";
const MAX_ATTEMPTS = 12;
const POLL_MS = 5_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function expectedMigrationVersions() {
  const migrationDir = path.join(process.cwd(), "supabase", "migrations");
  const entries = await readdir(migrationDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^\d{14}_.+\.sql$/.test(entry.name))
    .map((entry) => entry.name.slice(0, 14))
    .sort();
}

async function inspectReset(expectedVersions) {
  const client = new Client({ connectionString: DB_URL, connectionTimeoutMillis: 3_000 });
  try {
    await client.connect();
    const ledger = await client.query(
      `select version from supabase_migrations.schema_migrations order by version`,
    );
    const actualVersions = ledger.rows.map((row) => String(row.version));
    const ledgerMatches =
      actualVersions.length === expectedVersions.length &&
      actualVersions.every((version, index) => version === expectedVersions[index]);
    const seed = await client.query(`
      select
        to_regclass('test_support.forced_audit_failures') is not null as audit_fixture,
        exists (
          select 1 from vault.secrets where name = 'quote_pdf_attestation_test_v1'
        ) as attestation_fixture
    `);
    const auth = await fetch(AUTH_HEALTH_URL, { signal: AbortSignal.timeout(2_000) });
    return {
      ok:
        ledgerMatches &&
        seed.rows[0]?.audit_fixture === true &&
        seed.rows[0]?.attestation_fixture === true &&
        auth.ok,
      ledgerMatches,
      actualMigrationCount: actualVersions.length,
      expectedMigrationCount: expectedVersions.length,
      auditFixture: seed.rows[0]?.audit_fixture === true,
      attestationFixture: seed.rows[0]?.attestation_fixture === true,
      authHealthy: auth.ok,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

const expectedVersions = await expectedMigrationVersions();
let lastError = null;
let lastInspection = null;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  try {
    lastInspection = await inspectReset(expectedVersions);
    if (lastInspection.ok) {
      console.log(
        `Verified completed local Supabase reset after CLI restart error ` +
          `(${lastInspection.actualMigrationCount} migrations, seed fixtures, auth health).`,
      );
      process.exit(0);
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }
  if (attempt < MAX_ATTEMPTS) await delay(POLL_MS);
}

console.error("Local Supabase reset could not be verified after the bounded recovery window.", {
  lastInspection,
  lastError,
});
process.exit(1);

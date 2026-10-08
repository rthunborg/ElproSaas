/** Bounded local-only verification. All sensitive input comes from inherited env. */
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, readdirSync } from 'node:fs';
import pg from 'pg';

const mode = process.argv[2];
const prefix = '_bmad-output/test-artifacts/epic-14-gate-iter1';
const api = new URL(process.env.SUPABASE_TEST_URL ?? '');
const db = new URL(process.env.SUPABASE_TEST_DB_URL ?? '');
if (api.hostname !== '127.0.0.1' || api.port !== '55421' || db.hostname !== '127.0.0.1' || db.port !== '55422' || process.env.SUPABASE_TEST_REQUIRED !== '1') throw new Error('Local loopback fixture binding mismatch');

if (mode === 'verify') {
  const client = new pg.Client({ connectionString: process.env.SUPABASE_TEST_DB_URL });
  await client.connect();
  try {
    const schema = (await client.query('select count(*)::int as count,max(version) as latest from supabase_migrations.schema_migrations')).rows[0];
    if (schema.count !== 99 || schema.latest !== '20261007131222') throw new Error('Schema baseline mismatch');
    const health = await fetch(`${api.origin}/auth/v1/health`, { headers: { apikey: process.env.SUPABASE_TEST_ANON_KEY } });
    if (!health.ok) throw new Error('Local API health failed');
    const evidence = { schema, apiHealthStatus: health.status, apiLoopbackPort: 55421, dbLoopbackPort: 55422, required: true };
    writeFileSync(`${prefix}-local-binding.json`, JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify(evidence));
  } finally { await client.end(); }
} else if (mode === 'scan') {
  const artifacts = readdirSync('_bmad-output/test-artifacts').filter((name) => name.startsWith('epic-14-gate-iter1')).map((name) => `_bmad-output/test-artifacts/${name}`);
  const files = [...artifacts, 'tests/integration/commands/resources-boundaries.int.test.ts'];
  const forbidden = [process.env.SUPABASE_TEST_ANON_KEY, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY, process.env.SUPABASE_TEST_DB_URL].filter((value) => value && value.length >= 8);
  const password = decodeURIComponent(db.password);
  const passwordLiteral = password.length >= 12 ? password : null;
  const findings = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    // Short database passwords can equal the non-secret SQL username or the
    // official docs path. Match those only in a password assignment context.
    const assignedPassword = content.split(/\r?\n/).some((line) => /password\s*[=:]\s*["']?/i.test(line) && password.length > 0 && line.includes(password));
    if (forbidden.some((value) => content.includes(value)) || (passwordLiteral && content.includes(passwordLiteral)) || assignedPassword || /Bearer\s+[A-Za-z0-9_.-]{40,}/.test(content)) findings.push({ file, kind: 'sensitive literal' });
  }
  const whitespaceFiles = files.filter((file) => /(?:\.ts|\.md|\.mjs|\.ps1)$/.test(file));
  const whitespaceFindings = whitespaceFiles.filter((file) => /[\t ]+$/m.test(readFileSync(file, 'utf8')));
  const evidence = { filesScanned: files.length, findings, whitespaceFilesScanned: whitespaceFiles.length, whitespaceFindings, nativeExitCode: findings.length + whitespaceFindings.length === 0 ? 0 : 1 };
  writeFileSync(`${prefix}-artifact-scan.json`, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence));
  process.exitCode = evidence.nativeExitCode;
} else {
  const tests = ['tests/integration/commands/resources-boundaries.int.test.ts'];
  const common = ['node_modules/vitest/vitest.mjs', 'run'];
  const reporter = ['--reporter=json', `--outputFile=${prefix}-${mode}.json`];
  const args = mode === 'focused' ? [...common, ...tests, ...reporter]
    : mode === 'affected' ? [...common, ...tests, 'tests/integration/commands/resources.int.test.ts', 'tests/integration/rls/resources.rls.test.ts', 'tests/integration/rls/role-harness.atdd.int.test.ts', 'tests/integration/rls/has-tenant-role.rls.test.ts', 'tests/integration/rls/helper-semantics.rls.test.ts', 'tests/integration/rls/migration-reset.int.test.ts', ...reporter]
    : mode === 'full' ? [...common, ...reporter]
    : mode === 'typecheck' ? ['node_modules/typescript/bin/tsc', '--noEmit']
    : mode === 'lint' ? ['node_modules/eslint/bin/eslint.js', ...tests]
    : null;
  if (!args) throw new Error('Unsupported mode');
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, args, { env: process.env, cwd: 'C:/DEV/ElproSaas', encoding: 'utf8', timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(`${prefix}-${mode}-output.txt`, `${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  writeFileSync(`${prefix}-${mode}-execution.json`, JSON.stringify({ mode, nativeExitCode: result.status, signal: result.signal, startedAt, finishedAt: new Date().toISOString(), required: true }, null, 2) + '\n');
  console.log(JSON.stringify({ mode, nativeExitCode: result.status, signal: result.signal }));
  process.exitCode = result.status ?? 1;
}

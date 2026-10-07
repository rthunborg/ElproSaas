/** Local-only SQL/test runner. Private fixture is read only; secrets never printed or argv. */
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import pg from "pg";
const env = { ...process.env };
for (const line of fs.readFileSync("C:/Users/Rasmus/.codex/worktrees/epic14-scheduling/guard-compose-01a0ecb9-r4/.env.test", "utf8").split(/\r?\n/)) {
  const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}
env.SUPABASE_TEST_URL = "http://127.0.0.1:55421";
env.SUPABASE_TEST_DB_URL = `postgresql://postgres:${encodeURIComponent(env.POSTGRES_PASSWORD ?? "")}@127.0.0.1:55422/postgres`;
env.SUPABASE_TEST_ANON_KEY = env.ANON_KEY; env.SUPABASE_TEST_SERVICE_ROLE_KEY = env.SERVICE_ROLE_KEY;
env.SUPABASE_TEST_REQUIRED = "1";
env.NEXT_PUBLIC_SUPABASE_URL=env.SUPABASE_TEST_URL; env.NEXT_PUBLIC_SUPABASE_ANON_KEY=env.ANON_KEY;
env.BOOKING_CONFLICT_ATTESTATION_KEY_ID="test_v1";
env.BOOKING_CONFLICT_ATTESTATION_HMAC_SECRET="local-test-only-booking-conflict-attestation-secret-v1";
if (!env.POSTGRES_PASSWORD || !env.ANON_KEY || !env.SERVICE_ROLE_KEY) throw new Error("Private local fixture unavailable");
if (["migrate","migrate2","migrate3","migrate4"].includes(process.argv[2])) {
  const client = new pg.Client({ connectionString: env.SUPABASE_TEST_DB_URL });
  await client.connect();
  try {
    await client.query("begin");
    const before = (await client.query("select count(*)::int as count,max(version) as latest from supabase_migrations.schema_migrations")).rows[0];
    const second=process.argv[2]==="migrate2";
    const third=process.argv[2]==="migrate3"; const fourth=process.argv[2]==="migrate4";
    const baseline=fourth ? "20261007121724" : third ? "20261007121034" : second ? "20261007120235" : "20261006144057";
    const ledgerSql = `select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(m) order by version),'[]'::jsonb)::text,'sha256'),'hex') as hash from supabase_migrations.schema_migrations m where version<='${baseline}'`;
    const priorHashBefore = (await client.query(ledgerSql)).rows[0].hash;
    const version = fourth ? "20261007131222" : third ? "20261007121724" : second ? "20261007121034" : "20261007120235";
    const name=fourth ? "booking_editor_review_round1_fixes" : third ? "booking_editor_group_alias_fix" : second ? "booking_editor_whole_group_validation" : "booking_editor_audited_override";
    const file=`supabase/migrations/${version}_${name}.sql`;
    if (before.latest !== baseline || before.count !== (fourth ? 98 : third ? 97 : second ? 96 : 95)) throw new Error("Migration baseline mismatch");
    const sql = fs.readFileSync(file, "utf8");
    await client.query(sql);
    await client.query("insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)", [version,name,[sql]]);
    await client.query("notify pgrst,'reload schema'"); await client.query("commit");
    const after = (await client.query("select count(*)::int as count,max(version) as latest from supabase_migrations.schema_migrations")).rows[0];
    const priorHashAfter = (await client.query(ledgerSql)).rows[0].hash;
    const evidence = { before, after, priorHashBefore, priorHashAfter, priorLedgerUnchanged: priorHashBefore===priorHashAfter,
      file, sha256: createHash("sha256").update(sql).digest("hex") };
    fs.writeFileSync(`_bmad-output/test-artifacts/story14-4-migration${fourth ? "4" : third ? "3" : second ? "2" : ""}-evidence.json`, JSON.stringify(evidence,null,2)+"\n");
    console.log(JSON.stringify(evidence));
  } catch (error) { await client.query("rollback"); console.error("Migration failed", error.code ?? error.message); process.exitCode=1; }
  finally { await client.end(); }
} else if (process.argv[2] === "run") {
  const result=spawnSync(process.execPath,process.argv.slice(3),{env,cwd:"C:/DEV/ElproSaas",encoding:"utf8",timeout:600000});
  console.log(result.stdout ?? ""); console.error(result.stderr ?? ""); process.exitCode=result.status ?? 1;
} else throw new Error("Use migrate or run with bounded Node argv");

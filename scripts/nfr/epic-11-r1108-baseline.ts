/**
 * Epic 11 R-1108 pilot baseline. This is deliberately an explicit, local-only
 * measurement command, not a CI threshold: the owner has not approved a capacity
 * or latency target yet. It exercises the production read-model through a real
 * authenticated Supabase client and writes the measured facts to an ignored file.
 *
 * Run after a fresh local migration reset:
 *   $env:SUPABASE_TEST_REQUIRED='1'
 *   node --experimental-strip-types --import ./tests/support/register.mjs scripts/nfr/epic-11-r1108-baseline.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readAdminUsersForTenant, type AdminUsersReadClient } from "@/features/admin-users/read-model";
import { effectivePermissionsForMembership, resolveMembershipRoles } from "@/server/authz/role-catalogue";
import { TENANT_ROLES } from "@/server/authz/roles";
import { closeAdminPool, adminQuery } from "../../tests/factories/admin-sql";
import { cleanupFixture, createTwoTenantFixture, makeAuthedServerClient, type FixtureUser } from "../../tests/factories/tenants";
import { assertLocalStack, isLocalStackReachable, LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from "../../tests/support/test-env";

const ACTIVE_A = 120;
const ACTIVE_B = 24;
const ITERATIONS = 25;
const WARMUP = 5;
const OUTPUT = resolve(process.cwd(), process.env.EPIC11_NFR_OUTPUT ?? "tmp/private/epic-11-r1108-baseline.json");
const execFile = promisify(execFileCallback);

type Stats = { readonly p50Ms: number; readonly p95Ms: number; readonly maxMs: number; readonly samplesMs: readonly number[] };
type QueryCounter = { reads: number; membershipPages: number; rolePages: number };

function percentile(sorted: readonly number[], percentile: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(percentile * sorted.length))]!;
}

function summarize(samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b);
  return { p50Ms: percentile(sorted, 0.5), p95Ms: percentile(sorted, 0.95), maxMs: sorted.at(-1)!, samplesMs: sorted };
}

function countedClient(client: SupabaseClient, counter: QueryCounter): AdminUsersReadClient {
  const wrap = (query: Record<PropertyKey, unknown>, table: "tenant_memberships" | "membership_roles"): unknown => new Proxy(query, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      if (property === "range") {
        return (from: number, to: number) => {
          counter.reads += 1;
          if (table === "tenant_memberships") counter.membershipPages += 1;
          else counter.rolePages += 1;
          return (value as (from: number, to: number) => unknown).call(target, from, to);
        };
      }
      return (...args: unknown[]) => wrap((value as (...inner: unknown[]) => Record<PropertyKey, unknown>).apply(target, args), table);
    },
  });
  return {
    from(table) {
      return wrap(client.from(table) as unknown as Record<PropertyKey, unknown>, table) as ReturnType<AdminUsersReadClient["from"]>;
    },
  };
}

async function createUser(admin: SupabaseClient, label: string): Promise<FixtureUser> {
  const suffix = crypto.randomUUID();
  const email = `nfr-11-${label}-${suffix}@example.test`;
  const password = `Nfr-${suffix}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`pilot fixture user creation failed: ${error?.message ?? "no user"}`);
  return { id: data.user.id, email, password };
}

async function createTrackedUsers(admin: SupabaseClient, labels: readonly string[], created: FixtureUser[]): Promise<FixtureUser[]> {
  const users: FixtureUser[] = [];
  await inBatches(labels, async (label) => {
    const user = await createUser(admin, label);
    // Record every successful creation inside the concurrent work item. If a
    // sibling fails, finally still deletes the accounts that already exist.
    created.push(user);
    users.push(user);
  });
  return users;
}

async function inBatches<T>(values: readonly T[], work: (value: T, index: number) => Promise<void>, size = 6): Promise<void> {
  for (let start = 0; start < values.length; start += size) {
    await Promise.all(values.slice(start, start + size).map((value, offset) => work(value, start + offset)));
  }
}

async function addMembership(tenantId: string, user: FixtureUser, index: number): Promise<void> {
  const primary = TENANT_ROLES[index % TENANT_ROLES.length]!;
  const [{ id: membershipId }] = await adminQuery<{ id: string }>(
    `insert into public.tenant_memberships (tenant_id, user_id, invited_email, role, status)
     values ($1, $2, $3, $4, 'active') returning id`,
    [tenantId, user.id, user.email, primary],
  );
  const secondary = TENANT_ROLES[(index + 1) % TENANT_ROLES.length]!;
  const held = index % 3 === 0 ? [primary, secondary] : [primary];
  await adminQuery(
    `insert into public.membership_roles (tenant_id, membership_id, role)
     select $1, $2, unnest($3::text[])`,
    [tenantId, membershipId, held],
  );
}

async function main(): Promise<void> {
  const startedAt = performance.now();
  if (process.env.SUPABASE_TEST_REQUIRED !== "1") {
    throw new Error("Set SUPABASE_TEST_REQUIRED=1: this evidence command must never silently skip.");
  }
  assertLocalStack();
  if (!(await isLocalStackReachable())) throw new Error("Local Supabase Auth is unreachable.");

  const fixture = await createTwoTenantFixture();
  const created: FixtureUser[] = [];
  try {
    const admin = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const additions = await createTrackedUsers(admin, Array.from({ length: ACTIVE_A - 1 }, (_, index) => `a-${index}`), created);
    await inBatches(additions, (user, index) => addMembership(fixture.tenantA.id, user, index + 1));
    await inBatches(additions.slice(0, ACTIVE_B - 1), (user, index) => addMembership(fixture.tenantB.id, user, index + 10_000));

    const client = await makeAuthedServerClient(fixture.adminA);
    const warmupCounter: QueryCounter = { reads: 0, membershipPages: 0, rolePages: 0 };
    for (let index = 0; index < WARMUP; index += 1) {
      const read = await readAdminUsersForTenant(countedClient(client, warmupCounter), fixture.tenantA.id);
      if (read.error || read.rows.length !== ACTIVE_A) throw new Error("Warmup did not execute the expected current-tenant Admin read.");
    }

    const readSamples: number[] = [];
    const syntheticBulkEffectivePermissionSamples: number[] = [];
    const measuredCounter: QueryCounter = { reads: 0, membershipPages: 0, rolePages: 0 };
    let effectivePermissionGrantCount = 0;
    for (let index = 0; index < ITERATIONS; index += 1) {
      const readStart = performance.now();
      const read = await readAdminUsersForTenant(countedClient(client, measuredCounter), fixture.tenantA.id);
      if (read.error || read.rows.length !== ACTIVE_A) throw new Error("Measured read did not return the full current-tenant profile.");
      readSamples.push(performance.now() - readStart);
      // This is deliberately a synthetic CPU-only bulk calculation over all
      // 120 projected rows. It is not the Roles page or a full-page metric.
      const effectiveStart = performance.now();
      effectivePermissionGrantCount = read.rows.reduce((count, row) => count + effectivePermissionsForMembership(
        row.status,
        resolveMembershipRoles(row.role, row.roles),
      ).length, 0);
      syntheticBulkEffectivePermissionSamples.push(performance.now() - effectiveStart);
    }
    const expectedReadsPerIteration = 3; // one 120-row membership page + 100/20 child-role batches
    if (measuredCounter.reads !== ITERATIONS * expectedReadsPerIteration) {
      throw new Error(`Expected ${expectedReadsPerIteration} RLS reads per iteration; observed ${measuredCounter.reads / ITERATIONS}.`);
    }

    const planRows = await adminQuery<{ "QUERY PLAN": unknown }>(
      `explain (analyze, buffers, format json)
       select id, invited_email, status, role, created_at, invitation_expires_at
       from public.tenant_memberships
       where tenant_id = $1
       order by created_at desc, id desc`,
      [fixture.tenantA.id],
    );
    const report = {
      schemaVersion: 1,
      status: "measured",
      measuredAt: new Date().toISOString(),
      environment: {
        target: "local Supabase only",
        authenticatedActor: "Tenant A tenant_admin",
        gitRevision: (await execFile("git", ["rev-parse", "HEAD"], { cwd: process.cwd() })).stdout.trim(),
        gitWorkingTree: (await execFile("git", ["status", "--porcelain"], { cwd: process.cwd() })).stdout.trim() ? "dirty" : "clean",
        evidenceTool: "scripts/nfr/epic-11-r1108-baseline.ts",
        node: process.version,
        supabaseCli: (await execFile("supabase", ["--version"], { cwd: process.cwd() })).stdout.trim(),
        postgres: (await adminQuery<{ version: string }>("select current_setting('server_version') as version"))[0]?.version ?? "unavailable",
      },
      dataset: {
        tenantAActiveMemberships: ACTIVE_A,
        tenantBActiveMemberships: ACTIVE_B,
        tenantARoleDistribution: "five primary roles, every third membership also holds the next role",
        tenantBShape: "separate tenant rows for 23 of the same authenticated accounts plus its own admin",
      },
      read: {
        warmupIterations: WARMUP,
        measuredIterations: ITERATIONS,
        readStats: summarize(readSamples),
        syntheticBulkEffectivePermissionsStats: summarize(syntheticBulkEffectivePermissionSamples),
        rlsRequestCount: { total: measuredCounter.reads, perIteration: measuredCounter.reads / ITERATIONS, membershipPages: measuredCounter.membershipPages, rolePages: measuredCounter.rolePages },
        effectivePermissionGrantCount,
      },
      membershipQueryPlan: planRows[0]?.["QUERY PLAN"] ?? null,
      harnessElapsedMs: performance.now() - startedAt,
      limits: [
        "This is a local baseline, not a production load test or approved SLO.",
        "The plan is obtained through the local test-only superuser solely to document the actual query shape; application reads use the authenticated RLS client.",
        "The timed read is the tenant-scoped Admin-users projection only; it excludes tenant context, routing, rendering, and other full-page work.",
        "The synthetic bulk effective-permissions metric is CPU-only over all returned rows, not a Roles-page interaction measurement.",
        "No latency, query-count, dataset, or suite-duration threshold is asserted here.",
      ],
    };
    await mkdir(dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ output: OUTPUT, dataset: report.dataset, read: report.read }, null, 2));
  } finally {
    const admin = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    await inBatches(created, async (user) => {
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) console.warn(`pilot cleanup could not remove ${user.id}: ${error.message}`);
    });
    await cleanupFixture(fixture);
    await closeAdminPool();
  }
}

await main();

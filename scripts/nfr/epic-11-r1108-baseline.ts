/**
 * Epic 11 R-1108 pilot baseline. This is deliberately an explicit, local-only
 * performance gate. It exercises the production read-model through a real
 * authenticated Supabase client, writes the measured facts to an ignored file,
 * and fails when the approved local-pilot ceiling regresses.
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
import { EPIC11_PILOT_LIMITS, assessEpic11PilotFixtureProfile, assessEpic11PilotMeasurements } from "./epic-11-pilot-limits";
import { closeAdminPool, adminQuery } from "../../tests/factories/admin-sql";
import { cleanupFixture, createTwoTenantFixture, makeAuthedServerClient, type FixtureUser } from "../../tests/factories/tenants/core";
import { assertLocalStack, isLocalStackReachable, LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from "../../tests/support/test-env";

const ACTIVE_A = EPIC11_PILOT_LIMITS.tenantAActiveMemberships;
const ACTIVE_B = EPIC11_PILOT_LIMITS.tenantBActiveMemberships;
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

async function seedAdminSecondaryRole(tenantId: string, userId: string): Promise<void> {
  const [{ id: membershipId }] = await adminQuery<{ id: string }>(
    "select id from public.tenant_memberships where tenant_id = $1 and user_id = $2",
    [tenantId, userId],
  );
  if (!membershipId) throw new Error("Pilot fixture Tenant A admin membership was not created.");
  await adminQuery(
    `insert into public.membership_roles (tenant_id, membership_id, role)
     values ($1, $2, $3), ($1, $2, $4)`,
    [tenantId, membershipId, TENANT_ROLES[0], TENANT_ROLES[1]],
  );
}

async function assertExactPilotFixture(tenantAId: string, tenantBId: string): Promise<void> {
  const [counts] = await adminQuery<{
    tenant_a_active_memberships: number;
    tenant_b_active_memberships: number;
    tenant_a_extra_role_memberships: number;
    tenant_a_role_assignments: number;
  }>(
    `with tenant_a_active as (
       select id from public.tenant_memberships where tenant_id = $1 and status = 'active'
     ), role_counts as (
       select membership_id, count(*)::int as role_count
       from public.membership_roles where tenant_id = $1 group by membership_id
     )
     select
       (select count(*)::int from tenant_a_active) as tenant_a_active_memberships,
       (select count(*)::int from public.tenant_memberships where tenant_id = $2 and status = 'active') as tenant_b_active_memberships,
       (select count(*)::int from role_counts where role_count = 2) as tenant_a_extra_role_memberships,
       (select count(*)::int from public.membership_roles where tenant_id = $1) as tenant_a_role_assignments`,
    [tenantAId, tenantBId],
  );
  const roleCounts = await adminQuery<{ role: string; count: number }>(
    `select role, count(*)::int as count
     from public.tenant_memberships
     where tenant_id = $1 and status = 'active'
     group by role`,
    [tenantAId],
  );
  const assessment = assessEpic11PilotFixtureProfile({
    tenantAActiveMemberships: counts?.tenant_a_active_memberships ?? Number.NaN,
    tenantBActiveMemberships: counts?.tenant_b_active_memberships ?? Number.NaN,
    tenantAPrimaryRoleCounts: Object.fromEntries(roleCounts.map(({ role, count }) => [role, count])),
    tenantAExtraRoleMemberships: counts?.tenant_a_extra_role_memberships ?? Number.NaN,
    tenantARoleAssignments: counts?.tenant_a_role_assignments ?? Number.NaN,
  });
  if (!assessment.passed) throw new Error(`Pilot fixture does not match the approved profile: ${assessment.violations.join(" ")}`);
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
    await seedAdminSecondaryRole(fixture.tenantA.id, fixture.adminA.id);
    await inBatches(additions, (user, index) => addMembership(fixture.tenantA.id, user, index + 1));
    await inBatches(additions.slice(0, ACTIVE_B - 1), (user, index) => addMembership(fixture.tenantB.id, user, index + 10_000));
    await assertExactPilotFixture(fixture.tenantA.id, fixture.tenantB.id);

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
    const rlsRequestsPerRead = measuredCounter.reads / ITERATIONS;
    const assessment = assessEpic11PilotMeasurements({
      readP95Ms: summarize(readSamples).p95Ms,
      syntheticBulkEffectivePermissionsP95Ms: summarize(syntheticBulkEffectivePermissionSamples).p95Ms,
      authenticatedRlsRequestsPerRead: rlsRequestsPerRead,
    });

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
      status: assessment.passed ? "passed" : "failed",
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
        rlsRequestCount: { total: measuredCounter.reads, perIteration: rlsRequestsPerRead, membershipPages: measuredCounter.membershipPages, rolePages: measuredCounter.rolePages },
        effectivePermissionGrantCount,
      },
      approvedPilotLimits: EPIC11_PILOT_LIMITS,
      assessment,
      membershipQueryPlan: planRows[0]?.["QUERY PLAN"] ?? null,
      harnessElapsedMs: performance.now() - startedAt,
      limits: [
        "This is a local pilot gate, not a production load test or full-page SLO.",
        "The plan is obtained through the local test-only superuser solely to document the actual query shape; application reads use the authenticated RLS client.",
        "The timed read is the tenant-scoped Admin-users projection only; it excludes tenant context, routing, rendering, and other full-page work.",
        "The synthetic bulk effective-permissions metric is CPU-only over all returned rows, not a Roles-page interaction measurement.",
        "The approved ceilings apply only to this exact local two-tenant profile and measured functions.",
      ],
    };
    await mkdir(dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ output: OUTPUT, dataset: report.dataset, read: report.read }, null, 2));
    if (!assessment.passed) throw new Error(`Epic 11 pilot performance gate failed: ${assessment.violations.join(" ")}`);
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

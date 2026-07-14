/**
 * Standalone job creation (owner decision 2026-07-14; spec `spec-list-page-create-entry-points.md`)
 * — the `createJob` command: the standalone happy path (NULL source refs + 'created' status +
 * the job_events 'created' lifecycle row + the envelope `job.created` audit row) and the
 * tenant-isolation negatives on the LIVE command. These are the load-bearing behavioral proofs —
 * the "Skapa nytt jobb" UI mirror is NOT the guarantee (architecture §9).
 *
 *   - Happy path: a customer-only create persists a `jobs` row with `status='created'`,
 *     `quote_acceptance_id IS NULL` + `quote_version_id IS NULL` (standalone — born unconnected;
 *     the 7.4 `jobs_source_ref_lock` keeps a set tuple immutable, and NULL→set is ALSO rejected,
 *     so there is NO connect-later path), tenant_id = the RESOLVED tenant. ONE `job_events`
 *     'created' row is appended with `occurred_at` = the INJECTED clock (H1). EXACTLY ONE
 *     `audit_events` row (`job.created`, target on the target_id COLUMN, metadata `{}` after the
 *     allow-list sanitizer — NO PII/customer/title; R-710).
 *   - Cross-tenant: `createJob` with a FOREIGN customer_id ⇒ TENANT_ACCESS_DENIED BEFORE execute
 *     (RLS invisibility → envelope verifyOwnership; NO existence disclosure) and NO row is written.
 *   - Anon: an unauthenticated caller ⇒ UNAUTHENTICATED.
 *   - Shape: a smuggled source ref / status ⇒ VALIDATION_FAILED (unknown key — the closed
 *     allow-list; the pure half lives in `create-job-validation.test.ts`).
 *
 * Harness conventions mirror `update-job.int.test.ts`: per-run unique fixtures, raw pg readback via
 * the BYPASSRLS admin helpers, runs against the LOCAL Supabase stack ONLY + visibly skips per-test
 * when unreachable. No PII/orgnr in fixtures.
 *
 * [Source: spec-list-page-create-entry-points.md (I/O matrix + AC); src/server/commands/jobs/
 *  create-job.ts; tests/integration/commands/update-job.int.test.ts (the harness pattern)]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  makeAnonServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminSelectJobRow,
  adminSelectJobEventsForJob,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { createJob } from "@/server/commands/jobs";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-14T09:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

describe("createJob — standalone creation: NULL source refs, created event, audited, tenant-isolated", () => {
  let stackUp = false;
  let fx: TwoTenantFixture;
  let clientA: TestServerClient;

  beforeAll(async () => {
    stackUp = await isLocalStackReachable();
    if (!stackUp) return;
    fx = await createTwoTenantFixture();
    clientA = await makeAuthedServerClient(fx.adminA);
  });

  afterAll(async () => {
    if (stackUp && fx) await cleanupFixture(fx);
  });

  /** Count tenant A's jobs rows (BYPASSRLS) — the no-row-written negative proof. */
  async function countJobs(tenantId: string): Promise<number> {
    const rows = await adminQuery<{ n: number }>(
      `select count(*)::int as n from public.jobs where tenant_id = $1`,
      [tenantId],
    );
    return Number(rows[0]?.n ?? 0);
  }

  /** Count a tenant's job_events rows (BYPASSRLS) — the no-lifecycle-row-written proof. */
  async function countJobEvents(tenantId: string): Promise<number> {
    const rows = await adminQuery<{ n: number }>(
      `select count(*)::int as n from public.job_events where tenant_id = $1`,
      [tenantId],
    );
    return Number(rows[0]?.n ?? 0);
  }

  // ── Tenant-isolation negatives (negatives BEFORE positives) ─────────────────────────────────

  it("[P0] a FOREIGN customer_id ⇒ TENANT_ACCESS_DENIED before execute; NO jobs/job_events/audit row is written", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const foreignCustomerId = await adminInsertCustomer({
      tenant_id: fx.tenantB.id,
      display_name: "Främmande kund",
      customer_type: "company",
      org_nr: "556200-0001",
    });
    const jobsBeforeA = await countJobs(fx.tenantA.id);
    const jobsBeforeB = await countJobs(fx.tenantB.id);
    const eventsBefore = await countJobEvents(fx.tenantA.id);
    const correlationId = crypto.randomUUID();
    const result = await runCommand(createJob, {
      client: clientA as never,
      clock: fixedClock,
      correlationId,
      input: { customer_id: foreignCustomerId, title: "hijack attempt" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
    // No row was written in EITHER tenant (the denial fired before execute) — no jobs row,
    // no job_events lifecycle row, and no audit row (the envelope audits only on success).
    expect(await countJobs(fx.tenantA.id)).toBe(jobsBeforeA);
    expect(await countJobs(fx.tenantB.id)).toBe(jobsBeforeB);
    expect(await countJobEvents(fx.tenantA.id)).toBe(eventsBefore);
    expect(await adminSelectAuditEvents({ correlationId })).toHaveLength(0);
  });

  it("[P0] an anon (unauthenticated) caller ⇒ UNAUTHENTICATED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const customerId = await adminInsertCustomer({
      tenant_id: fx.tenantA.id,
      display_name: "Jobbkund anon",
      customer_type: "company",
      org_nr: "556200-0002",
    });
    const anon = await makeAnonServerClient();
    const result = await runCommand(createJob, {
      client: anon as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { customer_id: customerId },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHENTICATED");
  });

  it("[P1] a smuggled source ref / client-set status ⇒ VALIDATION_FAILED (closed key allow-list)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const customerId = await adminInsertCustomer({
      tenant_id: fx.tenantA.id,
      display_name: "Jobbkund smuggle",
      customer_type: "company",
      org_nr: "556200-0003",
    });
    for (const extra of [
      { quote_version_id: crypto.randomUUID() },
      { quote_acceptance_id: crypto.randomUUID() },
      { status: "done" },
      { tenant_id: fx.tenantB.id },
    ]) {
      const result = await runCommand(createJob, {
        client: clientA as never,
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
        input: { customer_id: customerId, ...extra } as never,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
    }
  });

  // ── The standalone happy path ────────────────────────────────────────────────────────────────

  it("[P0] happy path: the job persists (status 'created', NULL source refs, resolved tenant) + ONE job_events 'created' row at the injected clock + EXACTLY ONE job.created audit row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const customerId = await adminInsertCustomer({
      tenant_id: fx.tenantA.id,
      display_name: "Jobbkund standalone",
      customer_type: "company",
      org_nr: "556200-0004",
    });
    const correlationId = crypto.randomUUID();

    const result = await runCommand(createJob, {
      client: clientA as never,
      clock: fixedClock,
      correlationId,
      input: {
        customer_id: customerId,
        title: "Fristående jobb",
        planned_start_date: "2026-08-01",
        planned_end_date: "2026-08-15",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const jobId = result.data.targetId;

    // The jobs row: 'created' status, NULL source refs (standalone), the RESOLVED tenant.
    const row = await adminSelectJobRow(jobId);
    expect(row).not.toBeNull();
    expect(row?.tenant_id).toBe(fx.tenantA.id);
    expect(row?.customer_id).toBe(customerId);
    expect(row?.status).toBe("created");
    expect(row?.title).toBe("Fristående jobb");
    expect(row?.quote_acceptance_id).toBeNull();
    expect(row?.quote_version_id).toBeNull();

    // ONE 'created' lifecycle row, timestamped by the INJECTED clock (H1 — never Date.now()).
    const events = await adminSelectJobEventsForJob(jobId);
    expect(events).toHaveLength(1);
    expect(events[0]?.event_type).toBe("created");
    expect(new Date(events[0]!.occurred_at).toISOString()).toBe(FIXED_ISO);

    // EXACTLY ONE envelope audit row: job.created, target on the target_id COLUMN, metadata {}
    // after the allow-list sanitizer (NO PII / customer / title — R-710).
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.event_type).toBe("job.created");
    expect(audits[0]?.target_type).toBe("job");
    expect(audits[0]?.target_id).toBe(jobId);
    expect(audits[0]?.metadata).toEqual({});
    expect(JSON.stringify(audits[0]?.metadata)).not.toMatch(/Fristående|Jobbkund/i);
  });

  it("[P1] a customer-only create is enough (title/dates optional — born NULL)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const customerId = await adminInsertCustomer({
      tenant_id: fx.tenantA.id,
      display_name: "Jobbkund minimal",
      customer_type: "company",
      org_nr: "556200-0005",
    });
    const result = await runCommand(createJob, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { customer_id: customerId },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = await adminSelectJobRow(result.data.targetId);
    expect(row?.status).toBe("created");
    expect(row?.title).toBeNull();
    expect(row?.planned_start_date).toBeNull();
    expect(row?.planned_end_date).toBeNull();
    expect(row?.quote_acceptance_id).toBeNull();
    expect(row?.quote_version_id).toBeNull();
  });
});

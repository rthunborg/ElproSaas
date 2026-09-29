import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createJobsServiceClient } from "@/server/jobs/service-client";
import { ACTIVE_PRODUCERS, type ProducerDeclaration } from "@/server/jobs/producers";
import { runDueProducers, type JobRunRecord, type RunnerDependencies } from "@/server/jobs/runner";
import { isAuthorizedCronRequest } from "@/server/jobs/auth";
import { emitDueFollowUpNotifications } from "@/server/notifications/follow-up-producer";
import { processEmailOutbox } from "@/server/email/outbox";
import { stockholmBusinessDate } from "@/lib/datetime/business-date";

const unauthorized = () => new Response("Unauthorized", { status: 401 });
const CURSOR_PRODUCER = "jobs.runner";
// Internal containment bound for one serverless invocation. This is deliberately
// separate from the owner-pending production latency and backlog SLOs.
export const DEFAULT_RUN_BUDGET_MS = 45_000;

type JobsRouteDependencies = {
  readonly authorize?: (header: string | null) => boolean;
  readonly createClient?: () => SupabaseClient;
  readonly run?: typeof runDueProducers;
  readonly producers?: readonly ProducerDeclaration[];
  readonly correlationId?: () => string;
  readonly now?: () => Date;
  readonly chunkSize?: number;
  readonly runBudgetMs?: number;
  readonly abortSignal?: AbortSignal;
  /** Test seam; production uses the registered producer implementation in a later story. */
  readonly execute?: RunnerDependencies["execute"];
};

async function loadProducerCursor(client: SupabaseClient, tenantId: string, producer: string): Promise<string | undefined> {
  const { data, error } = await client
    .from("job_runs")
    .select("cursor,outcome")
    .eq("tenant_id", tenantId)
    .eq("producer", producer)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw new Error("Producer cursor lookup failed");
  const latest = data?.[0];
  return (latest?.outcome === "partial" || latest?.outcome === "failed") && typeof latest.cursor === "string" ? latest.cursor : undefined;
}

async function loadResumeCursor(client: SupabaseClient): Promise<string | undefined> {
  const { data, error } = await client
    .from("job_runs")
    .select("cursor,outcome")
    .eq("producer", CURSOR_PRODUCER)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error("Job cursor lookup failed");
  const cursor = data?.[0]?.cursor;
  return data?.[0]?.outcome === "partial" && typeof cursor === "string" ? cursor : undefined;
}

function recordRun(client: SupabaseClient, correlationId: string) {
  return async (record: JobRunRecord) => {
    const { error } = await client.rpc("record_job_run_with_system_audit", {
      p_tenant_id: record.tenantId,
      p_producer: record.producer,
      p_window_started_at: record.windowStartedAt,
      p_started_at: record.startedAt,
      p_finished_at: record.finishedAt,
      p_outcome: record.outcome,
      p_cursor: record.cursor ?? null,
      p_error_summary: record.errorSummary ?? null,
      p_correlation_id: correlationId,
    });
    if (error) throw new Error("Job run persistence failed");
  };
}

/** The one scheduler front door used by both Vercel's GET cron delivery and POST callers. */
export async function handleJobsRunRequest(request: Request, dependencies: JobsRouteDependencies = {}) {
  const authorize = dependencies.authorize ?? isAuthorizedCronRequest;
  // Authentication is deliberately the first action: rejected requests cannot
  // construct a privileged client, load a cursor, dispatch work, or write logs.
  if (!authorize(request.headers.get("authorization"))) return unauthorized();

  const producers = dependencies.producers ?? ACTIVE_PRODUCERS;
  if (producers.length === 0) return Response.json({ outcome: "completed", cursor: null });

  const client = (dependencies.createClient ?? createJobsServiceClient)();
  const run = dependencies.run ?? runDueProducers;
  const now = dependencies.now ?? (() => new Date());
  const windowStartedAt = now();
  const configuredBudget = dependencies.runBudgetMs ?? DEFAULT_RUN_BUDGET_MS;
  const runBudgetMs = Number.isFinite(configuredBudget) ? Math.max(1, configuredBudget) : DEFAULT_RUN_BUDGET_MS;
  const deadline = new Date(windowStartedAt.getTime() + runBudgetMs);
  const abortSignal = dependencies.abortSignal ?? AbortSignal.timeout(runBudgetMs);
  const correlationId = (dependencies.correlationId ?? randomUUID)();
  const cursor = await loadResumeCursor(client);
  const result = await run({
    listTenantIds: async () => {
      const { data, error } = await client.from("tenants").select("id").order("id");
      if (error) throw new Error("Tenant enumeration failed");
      return (data ?? []).map((row) => row.id);
    },
    loadProducerCursor: async (producer, tenantId) => loadProducerCursor(client, tenantId, producer.id),
    execute: dependencies.execute ?? (async (producer, tenantId, producerCursor) => {
      if (producer.id === "quotes.follow-up-reminders") {
        return emitDueFollowUpNotifications(client, tenantId, stockholmBusinessDate(now()), { cursor: producerCursor, signal: abortSignal });
      }
      if (producer.id === "notifications.email-outbox-delivery") {
        // ADR-B011 keeps the production release posture closed. A sandbox test
        // injects its adapter directly; the authenticated runner never gains a
        // second provider or configuration execution lane.
        await processEmailOutbox({ client, deliveryAdapter: { submit: async () => { throw new Error("Email release control is closed"); } }, releaseControl: undefined }, { tenantId, workerId: `jobs:${correlationId}` });
      }
    }),
    record: recordRun(client, correlationId),
    now,
  }, { cursor, producers, chunkSize: dependencies.chunkSize, deadline, windowStartedAt });
  return Response.json({ outcome: result.outcome, cursor: result.cursor ?? null });
}

export async function GET(request: Request) {
  return handleJobsRunRequest(request);
}

export async function POST(request: Request) {
  return handleJobsRunRequest(request);
}

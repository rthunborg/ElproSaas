import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createJobsServiceClient } from "@/server/jobs/service-client";
import { ACTIVE_PRODUCERS, type ProducerDeclaration } from "@/server/jobs/producers";
import { runDueProducers, type JobRunRecord, type RunnerDependencies } from "@/server/jobs/runner";
import { isAuthorizedCronRequest } from "@/server/jobs/auth";
import { emitAcceptedQuoteNotifications, emitDueFollowUpNotifications } from "@/server/notifications/follow-up-producer";

const unauthorized = () => new Response("Unauthorized", { status: 401 });
const CURSOR_PRODUCER = "jobs.runner";

type JobsRouteDependencies = {
  readonly authorize?: (header: string | null) => boolean;
  readonly createClient?: () => SupabaseClient;
  readonly run?: typeof runDueProducers;
  readonly producers?: readonly ProducerDeclaration[];
  readonly correlationId?: () => string;
  readonly now?: () => Date;
  readonly chunkSize?: number;
  /** Test seam; production uses the registered producer implementation in a later story. */
  readonly execute?: RunnerDependencies["execute"];
};

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
    const { error: runError } = await client.from("job_runs").insert({
      tenant_id: record.tenantId,
      producer: record.producer,
      window_started_at: record.windowStartedAt,
      started_at: record.startedAt,
      finished_at: record.finishedAt,
      outcome: record.outcome,
      cursor: record.cursor ?? null,
      error_summary: record.errorSummary ?? null,
      correlation_id: correlationId,
    });
    if (runError) throw new Error("Job run persistence failed");
    const { error: auditError } = await client.from("audit_events").insert({
      tenant_id: record.tenantId,
      actor_user_id: null,
      command: `jobs.${record.producer}`,
      event_type: "job.producer.executed",
      target_type: "job_run",
      target_id: null,
      correlation_id: correlationId,
      metadata: { outcome: record.outcome, cursor: record.cursor ?? null },
      created_at: record.finishedAt,
    });
    if (auditError) throw new Error("System audit persistence failed");
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
  const correlationId = (dependencies.correlationId ?? randomUUID)();
  const cursor = await loadResumeCursor(client);
  const result = await run({
    listTenantIds: async () => {
      const { data, error } = await client.from("tenants").select("id").order("id");
      if (error) throw new Error("Tenant enumeration failed");
      return (data ?? []).map((row) => row.id);
    },
    execute: dependencies.execute ?? (async (producer, tenantId) => {
      if (producer.id === "quotes.follow-up-reminders") {
        await emitDueFollowUpNotifications(client, tenantId, now().toISOString().slice(0, 10));
      }
      if (producer.id === "quotes.accepted") await emitAcceptedQuoteNotifications(client, tenantId);
    }),
    record: recordRun(client, correlationId),
    now,
  }, { cursor, producers, chunkSize: dependencies.chunkSize, windowStartedAt: now() });
  return Response.json({ outcome: result.outcome, cursor: result.cursor ?? null });
}

export async function GET(request: Request) {
  return handleJobsRunRequest(request);
}

export async function POST(request: Request) {
  return handleJobsRunRequest(request);
}

import { ACTIVE_PRODUCERS, type ProducerDeclaration } from "./producers";

export type JobRunOutcome = "completed" | "partial" | "failed";
export type JobRunRecord = {
  readonly tenantId: string;
  readonly producer: string;
  readonly outcome: JobRunOutcome;
  readonly windowStartedAt: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly cursor?: string;
  readonly errorSummary?: string;
};
export type RunnerDependencies = {
  readonly listTenantIds: () => Promise<readonly string[]>;
  readonly loadProducerCursor?: (producer: ProducerDeclaration, tenantId: string) => Promise<string | undefined>;
  readonly execute: (producer: ProducerDeclaration, tenantId: string, cursor?: string) => Promise<void | { readonly cursor?: string }>;
  readonly record: (record: JobRunRecord) => Promise<void>;
  readonly now?: () => Date;
};

const ERROR_LIMIT = 256;
export function sanitizeJobError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Background producer failed";
  return message
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/(["']?(?:password|secret|token|authorization|api[_-]?key)["']?\s*[=:]\s*["']?)[^\s,;"'}\]]+/gi, "$1[redacted]")
    .replace(/([?&](?:password|secret|token|authorization|api[_-]?key)=)[^&#\s]+/gi, "$1[redacted]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^@\s/]+@/gi, "$1[redacted]@")
    .slice(0, ERROR_LIMIT);
}
type RunnerCursor = { readonly nextIndex: number; readonly producerIndex: number; readonly dueProducerIds: readonly string[] };

function parseCronField(field: string, value: number, maximum: number): boolean {
  if (field === "*") return true;
  const exact = /^(\d{1,2})$/.exec(field);
  if (exact) {
    const expected = Number(exact[1]);
    if (expected > maximum) throw new RangeError("Unsupported producer schedule");
    return value === expected;
  }
  const step = /^\*\/(\d{1,2})$/.exec(field);
  if (step) {
    const divisor = Number(step[1]);
    if (divisor < 1 || divisor > maximum) throw new RangeError("Unsupported producer schedule");
    return value % divisor === 0;
  }
  throw new RangeError("Unsupported producer schedule");
}

/**
 * The jobs lane uses the same five-field UTC cron semantics as Vercel. The
 * intentionally small grammar covers the registered forms and fails closed
 * when a future declaration needs a richer schedule expression.
 */
export function isProducerDueAt(schedule: string, instant: Date): boolean {
  if (!Number.isFinite(instant.getTime())) throw new RangeError("Invalid producer schedule instant");
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) throw new RangeError("Unsupported producer schedule");
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  return parseCronField(minute!, instant.getUTCMinutes(), 59)
    && parseCronField(hour!, instant.getUTCHours(), 23)
    && parseCronField(dayOfMonth!, instant.getUTCDate(), 31)
    && parseCronField(month!, instant.getUTCMonth() + 1, 12)
    && parseCronField(dayOfWeek!, instant.getUTCDay(), 6);
}

function parseCursor(cursor?: string): RunnerCursor {
  if (!cursor) return { nextIndex: 0, producerIndex: 0, dueProducerIds: [] };
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return {
      nextIndex: Number.isSafeInteger(value.nextIndex) && value.nextIndex >= 0 ? value.nextIndex : 0,
      producerIndex: Number.isSafeInteger(value.producerIndex) && value.producerIndex >= 0 ? value.producerIndex : 0,
      dueProducerIds: Array.isArray(value.dueProducerIds) && value.dueProducerIds.every((id: unknown) => typeof id === "string")
        ? value.dueProducerIds
        : [],
    };
  } catch {
    return { nextIndex: 0, producerIndex: 0, dueProducerIds: [] };
  }
}

export function encodeCursor(nextIndex: number, producerIndex = 0, dueProducerIds: readonly string[] = []): string {
  const value = {
    nextIndex,
    ...(producerIndex === 0 ? {} : { producerIndex }),
    ...(dueProducerIds.length === 0 ? {} : { dueProducerIds }),
  };
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
export function decodeCursor(cursor?: string): number {
  return parseCursor(cursor).nextIndex;
}

/** Executes a bounded round-robin tenant slice. Empty 13.1 registry performs no DB work. */
export async function runDueProducers(deps: RunnerDependencies, options: { readonly cursor?: string; readonly chunkSize?: number; readonly deadline?: Date; readonly producers?: readonly ProducerDeclaration[]; readonly windowStartedAt?: Date } = {}): Promise<{ readonly outcome: JobRunOutcome; readonly cursor?: string }> {
  const producers = options.producers ?? ACTIVE_PRODUCERS;
  if (producers.length === 0) return { outcome: "completed" };
  const tenants = await deps.listTenantIds();
  if (tenants.length === 0) return { outcome: "completed" };
  const resume = parseCursor(options.cursor);
  const start = resume.nextIndex;
  const max = Math.max(1, options.chunkSize ?? 25);
  const now = deps.now ?? (() => new Date());
  const windowStart = options.windowStartedAt ?? now();
  const windowStartedAt = windowStart.toISOString();
  const dueProducerIds = new Set(producers.filter((producer) => isProducerDueAt(producer.schedule, windowStart)).map((producer) => producer.id));
  const resumedProducerIds = new Set(resume.dueProducerIds);
  const continuationProducerIds = new Set([...resumedProducerIds, ...dueProducerIds]);
  let hadFailure = false;
  let executedProducer = false;
  const persistCursor = async (nextIndex: number, producerIndex = 0) => {
    const timestamp = now().toISOString();
    const cursor = encodeCursor(nextIndex, producerIndex, [...continuationProducerIds]);
    await deps.record({
      tenantId: tenants[Math.min(nextIndex, tenants.length - 1)]!,
      producer: "jobs.runner",
      outcome: "partial",
      cursor,
      windowStartedAt,
      startedAt: timestamp,
      finishedAt: timestamp,
    });
  };
  const persistTerminal = async (outcome: "completed" | "failed") => {
    const timestamp = now().toISOString();
    await deps.record({
      tenantId: tenants[tenants.length - 1]!,
      producer: "jobs.runner",
      outcome,
      windowStartedAt,
      startedAt: timestamp,
      finishedAt: timestamp,
    });
  };
  let completed = 0;
  let hadPartial = false;
  for (let i = start; i < tenants.length; i += 1) {
    const firstProducerIndex = i === start && resume.producerIndex < producers.length ? resume.producerIndex : 0;
    let executedForTenant = false;
    for (let producerIndex = firstProducerIndex; producerIndex < producers.length; producerIndex += 1) {
      const producer = producers[producerIndex]!;
      const startedAt = now().toISOString();
      let producerCursor: string | undefined;
      try {
        producerCursor = await deps.loadProducerCursor?.(producer, tenants[i]!);
        const resumesWindow = continuationProducerIds.has(producer.id);
        const resumesLegacyTuple = continuationProducerIds.size === 0
          && Boolean(options.cursor)
          && i === start
          && producerIndex === firstProducerIndex;
        if (!dueProducerIds.has(producer.id) && !resumesWindow && !resumesLegacyTuple && !producerCursor) continue;
        if (completed >= max || (options.deadline && now() >= options.deadline)) {
          await persistCursor(i, producerIndex);
          return { outcome: "partial", cursor: encodeCursor(i, producerIndex, [...continuationProducerIds]) };
        }
        executedProducer = true;
        executedForTenant = true;
        const result = await deps.execute(producer, tenants[i]!, producerCursor);
        if (result?.cursor) {
          hadPartial = true;
          await deps.record({ tenantId: tenants[i]!, producer: producer.id, outcome: "partial", cursor: result.cursor, windowStartedAt, startedAt, finishedAt: now().toISOString() });
        } else {
          await deps.record({ tenantId: tenants[i]!, producer: producer.id, outcome: "completed", windowStartedAt, startedAt, finishedAt: now().toISOString() });
        }
      } catch (error) {
        hadFailure = true;
        await deps.record({ tenantId: tenants[i]!, producer: producer.id, outcome: "failed", cursor: producerCursor, windowStartedAt, startedAt, finishedAt: now().toISOString(), errorSummary: sanitizeJobError(error) });
      }
    }
    if (executedForTenant) completed += 1;
  }
  if (!executedProducer) return { outcome: "completed" };
  if (hadPartial) {
    await persistCursor(0);
    return { outcome: "partial", cursor: encodeCursor(0, 0, [...continuationProducerIds]) };
  }
  const outcome = hadFailure ? "failed" : "completed";
  await persistTerminal(outcome);
  return { outcome };
}

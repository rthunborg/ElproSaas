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
  readonly execute: (producer: ProducerDeclaration, tenantId: string) => Promise<void>;
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
export function encodeCursor(nextIndex: number): string { return Buffer.from(JSON.stringify({ nextIndex }), "utf8").toString("base64url"); }
export function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try { const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")); return Number.isSafeInteger(value.nextIndex) && value.nextIndex >= 0 ? value.nextIndex : 0; } catch { return 0; }
}

/** Executes a bounded round-robin tenant slice. Empty 13.1 registry performs no DB work. */
export async function runDueProducers(deps: RunnerDependencies, options: { readonly cursor?: string; readonly chunkSize?: number; readonly deadline?: Date; readonly producers?: readonly ProducerDeclaration[]; readonly windowStartedAt?: Date } = {}): Promise<{ readonly outcome: JobRunOutcome; readonly cursor?: string }> {
  const producers = options.producers ?? ACTIVE_PRODUCERS;
  if (producers.length === 0) return { outcome: "completed" };
  const tenants = await deps.listTenantIds();
  if (tenants.length === 0) return { outcome: "completed" };
  const start = decodeCursor(options.cursor);
  const max = Math.max(1, options.chunkSize ?? 25);
  const now = deps.now ?? (() => new Date());
  const windowStartedAt = (options.windowStartedAt ?? now()).toISOString();
  let hadFailure = false;
  const persistCursor = async (nextIndex: number) => {
    const timestamp = now().toISOString();
    await deps.record({
      tenantId: tenants[Math.min(nextIndex, tenants.length - 1)]!,
      producer: "jobs.runner",
      outcome: "partial",
      cursor: encodeCursor(nextIndex),
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
  for (let i = start; i < tenants.length && completed < max; i += 1) {
    if (options.deadline && now() >= options.deadline) {
      await persistCursor(i);
      return { outcome: "partial", cursor: encodeCursor(i) };
    }
    for (const producer of producers) {
      const startedAt = now().toISOString();
      try {
        await deps.execute(producer, tenants[i]!);
        await deps.record({ tenantId: tenants[i]!, producer: producer.id, outcome: "completed", windowStartedAt, startedAt, finishedAt: now().toISOString() });
      } catch (error) {
        hadFailure = true;
        await deps.record({ tenantId: tenants[i]!, producer: producer.id, outcome: "failed", windowStartedAt, startedAt, finishedAt: now().toISOString(), errorSummary: sanitizeJobError(error) });
      }
    }
    completed += 1;
  }
  const next = start + completed;
  if (next < tenants.length) {
    await persistCursor(next);
    return { outcome: "partial", cursor: encodeCursor(next) };
  }
  const outcome = hadFailure ? "failed" : "completed";
  await persistTerminal(outcome);
  return { outcome };
}

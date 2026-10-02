/**
 * Converts the resource read model's full-day optional time representation to
 * the command input shape. Invalid history is deliberately retained so the
 * command validator rejects it instead of turning client-controlled data into
 * a valid write.
 */
export function normalizeStoredExceptions(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => {
    if (!value || typeof value !== "object") return value;
    const exception = { ...(value as Record<string, unknown>) };
    if (exception.start === null) delete exception.start;
    if (exception.end === null) delete exception.end;
    return exception;
  });
}

function renderedTime(value: string): string { return value.slice(0, 5); }

/** Keeps the exact read-model time when the minute-granular form did not change it. */
export function mergeRenderedException(submitted: unknown, existing: readonly unknown[]): unknown[] {
  if (!submitted || typeof submitted !== "object") return [submitted, ...existing.slice(1)];
  const prior = existing[0];
  if (!prior || typeof prior !== "object") return [submitted, ...existing.slice(1)];
  const next = submitted as { kind?: unknown; date?: unknown; start?: unknown; end?: unknown };
  const stored = prior as { kind?: unknown; date?: unknown; start?: unknown; end?: unknown };
  const sameTimedWindow = typeof next.start === "string" && typeof next.end === "string"
    && typeof stored.start === "string" && typeof stored.end === "string"
    && renderedTime(next.start) === renderedTime(stored.start)
    && renderedTime(next.end) === renderedTime(stored.end);
  const sameFullDay = next.start === undefined && next.end === undefined && stored.start === undefined && stored.end === undefined;
  if (next.kind === stored.kind && next.date === stored.date && (sameTimedWindow || sameFullDay)) return [prior, ...existing.slice(1)];
  return [submitted, ...existing.slice(1)];
}

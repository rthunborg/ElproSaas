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

/** Only readonly cursor SELECT callbacks belong at this retry boundary. */
export type CursorReadOptions = {
  readonly scope: "resume" | "producer";
  readonly deadline: Date;
  readonly signal: AbortSignal;
  readonly now: () => Date;
  /** Deterministic clock seam; production waits are cancellable timers. */
  readonly wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
};

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const DIAGNOSTIC_STATUSES = new Set([400, 401, 403, 404, 408, 409, 422, 429, 500, 502, 503, 504]);
export const CURSOR_READ_MAX_ATTEMPTS = 3;
type Category = "transient_exhausted" | "non_transient" | "unknown" | "deadline" | "cancelled";

export class CursorReadError extends Error {
  readonly category: Category;
  constructor(scope: CursorReadOptions["scope"], category: Category, status?: number) {
    super(`Cursor read failed (${scope}; ${category}${status === undefined ? "" : `; HTTP ${status}`})`);
    this.name = "CursorReadError";
    this.category = category;
  }
}

export function cursorAbortCategory(signal: AbortSignal): "deadline" | "cancelled" {
  return signal.reason?.name === "TimeoutError" ? "deadline" : "cancelled";
}

function checkBudget(options: CursorReadOptions): void {
  if (options.signal.aborted) throw new CursorReadError(options.scope, cursorAbortCategory(options.signal));
  if (options.now().getTime() >= options.deadline.getTime()) throw new CursorReadError(options.scope, "deadline");
}

function waitForRetry(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new Error("Cancelled")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

export async function readCursor<T>(
  read: (signal: AbortSignal) => PromiseLike<{ readonly data: T; readonly error: unknown; readonly status?: number }>,
  options: CursorReadOptions,
): Promise<T> {
  for (let attempt = 1; attempt <= CURSOR_READ_MAX_ATTEMPTS; attempt += 1) {
    checkBudget(options);
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), options.deadline.getTime() - options.now().getTime());
    const signal = AbortSignal.any([options.signal, timeout.signal]);
    let cancel: () => void = () => undefined;
    let result: Awaited<ReturnType<typeof read>>;
    try {
      result = await Promise.race([
        Promise.resolve(read(signal)),
        new Promise<never>((_resolve, reject) => {
          cancel = () => reject(new CursorReadError(options.scope, options.signal.aborted ? cursorAbortCategory(options.signal) : "deadline"));
          signal.addEventListener("abort", cancel, { once: true });
          if (signal.aborted) cancel();
        }),
      ]);
      checkBudget(options);
    } catch (error) {
      checkBudget(options);
      if (error instanceof CursorReadError) throw error;
      throw new CursorReadError(options.scope, "unknown");
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
    }
    if (!result.error) return result.data;

    const status = typeof result.status === "number" && DIAGNOSTIC_STATUSES.has(result.status) ? result.status : undefined;
    const code = typeof result.error === "object" && result.error !== null && "code" in result.error ? result.error.code : undefined;
    // A SQL/PostgREST/auth/validation code must not acquire retry semantics from
    // a proxy's 5xx status. Accept only absent or matching numeric HTTP codes.
    const isHttpError = code === undefined || code === "" || code === String(status);
    const transient = status !== undefined && TRANSIENT_STATUSES.has(status) && isHttpError;
    if (!transient) throw new CursorReadError(options.scope, status === undefined ? "unknown" : "non_transient", status);
    if (attempt === CURSOR_READ_MAX_ATTEMPTS) throw new CursorReadError(options.scope, "transient_exhausted", status);
    const delay = attempt * 100;
    checkBudget(options);
    if (options.deadline.getTime() - options.now().getTime() <= delay) throw new CursorReadError(options.scope, "deadline");
    try {
      await (options.wait ?? waitForRetry)(delay, options.signal);
    } catch {
      checkBudget(options);
      throw new CursorReadError(options.scope, "unknown");
    }
    checkBudget(options);
  }
  throw new CursorReadError(options.scope, "unknown");
}

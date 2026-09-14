export type DurationBudget = { readonly label: string; readonly elapsedMs: number; readonly maxMs: number };

/** Keep CI timing policy explicit and testable without measuring a machine in unit tests. */
export function assertDurationWithinBudget({ label, elapsedMs, maxMs }: DurationBudget): void {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error(`${label} duration must be a finite non-negative number.`);
  if (!Number.isFinite(maxMs) || maxMs <= 0) throw new Error(`${label} budget must be a positive finite number.`);
  if (elapsedMs > maxMs) {
    throw new Error(`${label} consumed ${(elapsedMs / 1_000).toFixed(2)}s, exceeding the ${(maxMs / 1_000).toFixed(0)}s CI execution budget.`);
  }
}

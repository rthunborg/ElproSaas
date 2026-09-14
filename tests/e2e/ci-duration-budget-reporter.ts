import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { assertDurationWithinBudget } from "../support/ci-duration-budget";

type ReporterOptions = { readonly label?: string; readonly maxMs?: number };

/**
 * Measures test attempts only. Playwright starts this reporter after its
 * configured production build/web-server bootstrap, so that setup is excluded
 * from the approved browser execution budget.
 */
export default class CiDurationBudgetReporter implements Reporter {
  private elapsedMs = 0;
  private readonly label: string;
  private readonly maxMs: number;

  constructor(options: ReporterOptions = {}) {
    this.label = options.label ?? "Browser tests";
    this.maxMs = options.maxMs ?? 300_000;
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    this.elapsedMs += result.duration;
  }

  async onEnd(): Promise<{ status: "failed" } | void> {
    try {
      assertDurationWithinBudget({ label: this.label, elapsedMs: this.elapsedMs, maxMs: this.maxMs });
      console.log(`${this.label} test attempts consumed ${(this.elapsedMs / 1_000).toFixed(2)}s (budget ${(this.maxMs / 1_000).toFixed(0)}s).`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return { status: "failed" };
    }
  }
}

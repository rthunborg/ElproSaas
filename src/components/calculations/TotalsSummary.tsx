"use client";

/**
 * Totals / readiness summary (Story 5.2, Task 4.2 / AC1/AC4). Presentation-only: it takes a
 * pre-computed total (from the pure `totals.ts` engine-backed derivation — NEVER inline math
 * here) and DISPLAYS it as kronor via the single `formatOreAsKronor`/`oreToKronorString`
 * boundary. The excl/incl/both view is resolved by the engine's `selectVatDisplay`.
 *
 * öre/rounding wording appears ONLY here (a review summary), never in the row editor — the
 * everyday row inputs stay kronor/percent (AC6). On a narrow viewport this panel becomes an
 * inline block below the editor (the parent controls the responsive placement).
 */
import { oreToKronorString } from "@/features/calculations/money-input";
import type { SectionTotal } from "@/features/calculations/totals";
import type { VatDisplayView } from "@/lib/money";

export function TotalsSummary({
  total,
  view,
  inline = false,
}: {
  readonly total: SectionTotal;
  readonly view: VatDisplayView;
  /** True → render as an inline block (narrow viewport) rather than a sticky side panel. */
  readonly inline?: boolean;
}) {
  return (
    <aside
      data-testid="totals-summary"
      data-inline={inline ? "true" : "false"}
      aria-label="Summering"
      className={[
        "flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4",
        inline ? "" : "lg:sticky lg:top-6",
      ].join(" ")}
    >
      <h2 className="text-sm font-semibold text-zinc-900">Summering</h2>
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-zinc-600">Netto (exkl. moms)</dt>
          <dd data-testid="summary-net" className="font-medium text-zinc-900">
            {oreToKronorString(total.netOre)} kr
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-600">Moms</dt>
          <dd data-testid="summary-vat" className="font-medium text-zinc-900">
            {oreToKronorString(total.vatOre)} kr
          </dd>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
          <dt className="text-zinc-900">Totalt (inkl. moms)</dt>
          <dd data-testid="summary-gross" className="font-semibold text-zinc-900">
            {oreToKronorString(total.grossOre)} kr
          </dd>
        </div>
      </dl>
      <p className="text-xs text-zinc-500">
        Belopp beräknas radvis och avrundas till hela öre av kalkylmotorn. Standardvy:{" "}
        {view.posture === "company_excl"
          ? "exkl. moms"
          : view.togglable
            ? "kan visas in-/exkl. moms"
            : "inkl. moms"}
        .
      </p>
    </aside>
  );
}

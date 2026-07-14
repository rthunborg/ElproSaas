"use client";

/**
 * Quote list (Story 6.2, Task 2.1 / AC1) — the thin `/quotes` (Offerter) index island.
 *
 * Renders the tenant's ACTIVE quotes (customer + latest-version status badge + version count +
 * latest quote number), each row linking to the detail at `/quotes/[id]`. A thin index — the
 * DETAIL is the heart of this story. NO deferred-workflow label; NO new nav item (Offerter
 * already exists in the seven-item shell).
 *
 * Since 2026-07-14 (owner decision — list-page create entry points) the header carries the
 * "Skapa ny offert" create affordance (the `CalculationList` "Ny kalkyl" inline-expanding form
 * pattern): a required calculation picker wired to `createQuoteVersionFromCalculationAction` →
 * the EXISTING 6.1 command (the full snapshot is re-captured server-side; the picker is a UX
 * nicety, never the guarantee). On success it navigates to the new quote's detail. An empty
 * picker points the admin at `/calculations` (a quote is always born from a calculation).
 */
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormErrorSummary, SelectField } from "@/components/crm/FormField";
import { createQuoteVersionFromCalculationAction } from "@/features/quotes/actions";
import {
  CREATE_QUOTE_ACTION_INITIAL,
  isRetryableCreateQuoteError,
} from "@/features/quotes/create-quote-action-state";
import { StatusBadge } from "./StatusBadge";
import type { QuoteListRow } from "@/features/quotes/read";

export interface QuoteCalculationOption {
  readonly id: string;
  readonly label: string;
}

export function QuoteList({
  rows,
  loadError,
  calculationOptions,
  optionsLoadError = false,
}: {
  readonly rows: readonly QuoteListRow[];
  readonly loadError: string | null;
  /** The tenant's ACTIVE calculations — the create form's required source picker options. */
  readonly calculationOptions: readonly QuoteCalculationOption[];
  /** True when the calculation-options read FAILED — an empty picker then means "unknown",
   * NOT "no calculations exist", so the form shows a neutral retry message instead of the
   * misleading create-a-calculation hint (submit stays disabled). */
  readonly optionsLoadError?: boolean;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [state, formAction, pending] = useActionState(
    createQuoteVersionFromCalculationAction,
    CREATE_QUOTE_ACTION_INITIAL,
  );

  // On a successful create, navigate to the new quote's detail.
  useEffect(() => {
    if (state.status === "success" && state.quoteId) {
      router.push(`/quotes/${state.quoteId}`);
    }
  }, [state.status, state.quoteId, router]);

  const retryable = isRetryableCreateQuoteError(state);

  return (
    <section
      data-testid="quote-list"
      aria-labelledby="quotes-heading"
      className="flex flex-col gap-6 p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h1 id="quotes-heading" className="text-2xl font-semibold text-zinc-900">
          Offerter
        </h1>
        <button
          type="button"
          data-testid="new-quote-button"
          onClick={() => setShowCreate((s) => !s)}
          aria-expanded={showCreate}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Skapa ny offert
        </button>
      </div>

      {loadError && (
        <p
          role="alert"
          data-testid="quote-list-error"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {loadError}
        </p>
      )}

      {showCreate && (
        <form
          action={formAction}
          data-testid="new-quote-form"
          className="flex max-w-xl flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4"
          noValidate
        >
          <FormErrorSummary message={state.formError} />
          {retryable && (
            <p role="status" className="text-sm text-amber-800">
              Försök igen.
            </p>
          )}
          {optionsLoadError ? (
            <p
              role="alert"
              data-testid="new-quote-options-error"
              className="text-sm text-red-800"
            >
              Kalkylerna kunde inte läsas — försök igen om en stund.
            </p>
          ) : calculationOptions.length === 0 ? (
            <p className="text-sm text-zinc-600" data-testid="new-quote-empty-hint">
              Skapa en{" "}
              <Link
                href="/calculations"
                className="text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                kalkyl
              </Link>{" "}
              först — en offert skapas alltid från en kalkyl.
            </p>
          ) : (
            <SelectField
              name="calculation_id"
              label="Kalkyl"
              required
              defaultValue={state.values.calculation_id ?? ""}
              options={[
                { value: "", label: "Välj kalkyl…" },
                ...calculationOptions.map((c) => ({ value: c.id, label: c.label })),
              ]}
            />
          )}
          <div className="flex justify-end">
            {/* Disabled AFTER success too — the router.push is in flight; a second submit
                would create a duplicate quote (double-submit guard). */}
            <button
              type="submit"
              disabled={
                pending ||
                state.status === "success" ||
                optionsLoadError ||
                calculationOptions.length === 0
              }
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
            >
              {pending ? "Skapar…" : "Skapa offert"}
            </button>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <p data-testid="quote-list-empty" className="text-sm text-zinc-600">
          Inga offerter ännu. Skapa din första offert med “Skapa ny offert” — den
          utgår från en kalkyl.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/quotes/${row.id}`}
                data-testid="quote-list-row"
                className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 px-4 py-3 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-900">
                    {row.customer_display_name ?? "—"}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {row.latest_quote_number
                      ? `Offert #${row.latest_quote_number}`
                      : "Utan nummer"}{" "}
                    · {row.version_count}{" "}
                    {row.version_count === 1 ? "version" : "versioner"}
                  </span>
                </div>
                {row.latest_status ? (
                  <StatusBadge status={row.latest_status} />
                ) : (
                  <span className="text-xs text-zinc-500">—</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

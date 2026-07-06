"use client";

/**
 * Quote list (Story 6.2, Task 2.1 / AC1) — the thin `/quotes` (Offerter) index island.
 *
 * Renders the tenant's ACTIVE quotes (customer + latest-version status badge + version count +
 * latest quote number), each row linking to the detail at `/quotes/[id]`. A thin index — the
 * DETAIL is the heart of this story. NO deferred-workflow label; NO new nav item (Offerter
 * already exists in the seven-item shell). Quotes are created from a ready calculation (Story
 * 6.1) — there is no "new quote" affordance here (a quote is born from the calc → version path).
 */
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import type { QuoteListRow } from "@/features/quotes/read";

export function QuoteList({
  rows,
  loadError,
}: {
  readonly rows: readonly QuoteListRow[];
  readonly loadError: string | null;
}) {
  return (
    <section
      data-testid="quote-list"
      aria-labelledby="quotes-heading"
      className="flex flex-col gap-6 p-6"
    >
      <h1 id="quotes-heading" className="text-2xl font-semibold text-zinc-900">
        Offerter
      </h1>

      {loadError && (
        <p
          role="alert"
          data-testid="quote-list-error"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {loadError}
        </p>
      )}

      {rows.length === 0 ? (
        <p data-testid="quote-list-empty" className="text-sm text-zinc-600">
          Inga offerter ännu. Skapa en offertversion från en färdig kalkyl.
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

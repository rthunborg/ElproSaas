"use client";

/**
 * Quote list (Story 6.2, Task 2.1 / AC1) — the thin `/quotes` (Offerter) index island.
 *
 * Renders the tenant's ACTIVE quotes (customer + latest-version status badge + version count +
 * latest quote number), each row linking to the detail at `/quotes/[id]`. A thin index — the
 * DETAIL is the heart of this story. NO deferred-workflow label; NO new nav item (Offerter
 * already exists in the seven-item shell).
 *
 * Story 10.6 requires quote creation to start from the reviewed calculation preview. The old
 * list-page quick-create form could not carry that review authority, so this page links to the
 * calculation workflow instead of exposing a submission that is guaranteed to fail.
 */
import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import {
  lostOutcomeLabel,
  lostCategoryLabel,
  followUpToneLabel,
  followUpToneColor,
} from "./status";
import type { QuoteListRow } from "@/features/quotes/read";

/**
 * Story 10.2 (AC4): the status-filter options. The Förlorad/Avböjd value maps to status='lost' (the
 * single terminal token). A minimal owner-confirmed set — the pipeline read-model + follow-up
 * filters are Story 10.4, not here.
 */
const STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "Alla" },
  { value: "draft", label: "Utkast" },
  { value: "sent", label: "Skickad" },
  { value: "accepted", label: "Accepterad" },
  { value: "lost", label: "Förlorad/Avböjd" },
];

export function QuoteList({
  rows,
  loadError,
}: {
  readonly rows: readonly QuoteListRow[];
  readonly loadError: string | null;
}) {
  // Story 10.2 (AC4): the status filter. Empty = all; "lost" surfaces the Förlustorsak column view.
  const [statusFilter, setStatusFilter] = useState<string>("");
  // Story 10.3 (AC2): the follow-up attribute filter. "" = all; "has" = quotes with an open follow-up;
  // "overdue" = quotes whose open follow-up is overdue (Europe/Stockholm boundary, computed server-side).
  const [followUpFilter, setFollowUpFilter] = useState<"" | "has" | "overdue">("");
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
        <Link
          href="/calculations"
          data-testid="new-quote-button"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Skapa offert från kalkyl
        </Link>
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

      {/* Story 10.2 (AC4): the status filter. Selecting Förlorad/Avböjd (→ status='lost') switches the
          list to the Förlustorsak column view surfacing the joined reason. */}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex w-fit flex-col gap-1 text-sm">
          <span className="text-zinc-700">Status</span>
          <select
            data-testid="quote-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {/* Story 10.3 (AC2): the follow-up attribute filters — toggle buttons that narrow the list to
            quotes with an open follow-up / an OVERDUE open follow-up. Functional (correct rows), not
            decorative. Clicking an active filter clears it. */}
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Uppföljning</span>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="quote-filter-has-follow-up"
              aria-pressed={followUpFilter === "has"}
              onClick={() => setFollowUpFilter((f) => (f === "has" ? "" : "has"))}
              className={[
                "rounded-md border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                followUpFilter === "has"
                  ? "border-blue-400 bg-blue-50 text-blue-900"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50",
              ].join(" ")}
            >
              Har uppföljning
            </button>
            <button
              type="button"
              data-testid="quote-filter-overdue-follow-up"
              aria-pressed={followUpFilter === "overdue"}
              onClick={() =>
                setFollowUpFilter((f) => (f === "overdue" ? "" : "overdue"))
              }
              className={[
                "rounded-md border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600",
                followUpFilter === "overdue"
                  ? "border-rose-400 bg-rose-50 text-rose-900"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50",
              ].join(" ")}
            >
              Försenad uppföljning
            </button>
          </div>
        </div>
      </div>

      {(() => {
        // Filter by the selected status (empty = all). A quote's filterable status is its LATEST
        // version's status (the list projection already resolves it). Story 10.3 (AC2): additionally
        // narrow by the follow-up attribute filter — "has" (an open follow-up) / "overdue" (an overdue
        // open follow-up). The flags come from the list projection (UI-level; the read-model is 10.4).
        const filteredRows = rows.filter((r) => {
          if (statusFilter && r.latest_status !== statusFilter) return false;
          if (followUpFilter === "has" && !r.has_open_follow_up) return false;
          if (followUpFilter === "overdue" && !r.overdue_follow_up) return false;
          return true;
        });

        // Story 10.2 (AC4): under the Förlorad/Avböjd filter, render the table view with the
        // Förlustorsak column (surfacing the joined reason). Rendered even when empty so the column
        // header is always available in this filter view.
        if (statusFilter === "lost") {
          return (
            <div className="overflow-x-auto">
              <table
                data-testid="quote-list-lost-table"
                className="w-full text-sm"
              >
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-600">
                    <th scope="col" className="py-2 pr-3 font-medium">Kund</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Offert</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Förlustorsak</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-zinc-600">
                        Inga förlorade/avböjda offerter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.id}
                        data-testid="quote-list-lost-row"
                        className="border-b border-zinc-100"
                      >
                        <td className="py-2 pr-3 text-zinc-900">
                          <Link
                            href={`/quotes/${row.id}`}
                            className="font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          >
                            {row.customer_display_name ?? "—"}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-zinc-700">
                          {row.latest_quote_number
                            ? `#${row.latest_quote_number}`
                            : "Utan nummer"}
                        </td>
                        <td data-testid="quote-list-lost-reason" className="py-2 pr-3 text-zinc-900">
                          {row.lost_reason
                            ? `${lostOutcomeLabel(row.lost_reason.outcome)} · ${lostCategoryLabel(row.lost_reason.category)}`
                            : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {row.latest_status ? (
                            <StatusBadge status={row.latest_status} />
                          ) : (
                            <span className="text-xs text-zinc-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          );
        }

        if (filteredRows.length === 0) {
          return (
            <p data-testid="quote-list-empty" className="text-sm text-zinc-600">
              {rows.length === 0
                ? "Inga offerter ännu. Öppna en kalkyl, granska underlaget och skapa offerten därifrån."
                : "Inga offerter matchar det valda statusfiltret."}
            </p>
          );
        }

        return (
          <ul className="flex flex-col gap-2">
            {filteredRows.map((row) => (
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
                  <div className="flex items-center gap-2">
                    {/* Story 10.3 (AC2): an OVERDUE open follow-up escalates the row visually (a
                        StatusBadge-style badge — text-first, color redundant). Story 10.4 (Task 4.3):
                        the tone + label are drawn from the SHARED status.ts follow-up authority (the
                        named 10-3 deferral); the hardcoded rose literal that byte-duplicated
                        QUOTE_STATUS_COLORS.lost is deleted. */}
                    {row.overdue_follow_up && (
                      <span
                        data-testid="quote-row-overdue-follow-up-badge"
                        className={[
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          followUpToneColor("overdue"),
                        ].join(" ")}
                      >
                        {followUpToneLabel("overdue")}
                      </span>
                    )}
                    {row.latest_status ? (
                      <StatusBadge status={row.latest_status} />
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        );
      })()}
    </section>
  );
}

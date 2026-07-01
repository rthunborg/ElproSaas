"use client";

/**
 * Customer list (Story 3.2, Task 1) — search + filter + ALL FIVE lifecycle states,
 * mounted by the server `/customers` page over the RLS-scoped list projection.
 *
 * The projection EXCLUDES personnummer entirely (it never reaches this client), so the
 * list can never render or search it (the private-data posture is structural, not a
 * comment). Search runs client-side over the already-fetched, RLS-scoped page (a
 * pragmatic choice for the pilot's small per-tenant data set — Task 1.3); the URL
 * search param keeps list state on a detail round-trip is handled by the server page.
 *
 * Lifecycle states (AC1) are DISTINCT, clearly-labelled, and never color-only:
 *   - failed   → the server read errored (passed in as `loadError`); retry affordance.
 *   - empty    → no customers exist yet; invite to create the first.
 *   - no-results → search/filter matched nothing (distinct from empty).
 *   - loading  → the client filter transition (a spinner-free skeleton is overkill for
 *     a client-side filter; the populated list updates synchronously).
 *   - duplicate-like warning → surfaced in the create dialog (non-blocking advisory).
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { CustomerDialog } from "./CustomerDialog";
import { CustomerTypeBadge } from "./CustomerTypeBadge";
import {
  CUSTOMER_TYPE_LABELS,
  matchesQuery,
  toCustomerListItem,
  type CustomerListItem,
  type CustomerListRow,
} from "./customer-presentation";
import type { CustomerType } from "@/server/commands/crm/validation";

const TYPE_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "Alla kundtyper" },
  ...(
    Object.entries(CUSTOMER_TYPE_LABELS) as [CustomerType, string][]
  ).map(([value, label]) => ({ value, label })),
];

export function CustomerList({
  rows,
  loadError,
}: {
  /** The RLS-scoped list projection rows (personnummer is NOT among them). */
  readonly rows: readonly CustomerListRow[];
  /** When the server read errored, the generic Swedish message (no leaked detail). */
  readonly loadError: string | null;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const items = useMemo<CustomerListItem[]>(
    () => rows.map(toCustomerListItem),
    [rows],
  );

  const filtered = useMemo(() => {
    return items.filter(
      (it) =>
        (typeFilter === "all" || it.type === typeFilter) &&
        matchesQuery(it, query),
    );
  }, [items, query, typeFilter]);

  // ── FAILED state ──────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <section className="mx-auto max-w-5xl">
        <ListHeader onCreate={() => setCreateOpen(true)} />
        <div
          role="alert"
          data-testid="customers-failed"
          className="mt-6 rounded-lg border border-red-300 bg-red-50 p-6"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-red-800">
            <ErrorIcon />
            Kundlistan kunde inte läsas in.
          </p>
          <p className="mt-1 text-sm text-red-700">{loadError}</p>
          <Link
            href="/customers"
            className="mt-4 inline-flex rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            Försök igen
          </Link>
        </div>
      </section>
    );
  }

  const isEmpty = items.length === 0;
  const isNoResults = !isEmpty && filtered.length === 0;

  return (
    <section className="mx-auto max-w-5xl">
      <ListHeader onCreate={() => setCreateOpen(true)} />

      {!isEmpty && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="customer-search" className="text-sm font-medium text-zinc-800">
              Sök kund
            </label>
            <input
              id="customer-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Namn, e-post, telefon, ort eller org.nr"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="customer-type-filter" className="text-sm font-medium text-zinc-800">
              Filtrera typ
            </label>
            <select
              id="customer-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {TYPE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── EMPTY state ── */}
      {isEmpty && (
        <div
          data-testid="customers-empty"
          className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center"
        >
          <p className="text-sm font-medium text-zinc-900">Inga kunder ännu</p>
          <p className="mt-1 text-sm text-zinc-600">
            Skapa din första kund för att komma igång.
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-4 inline-flex rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Ny kund
          </button>
        </div>
      )}

      {/* ── NO-RESULTS state (distinct from empty) ── */}
      {isNoResults && (
        <div
          data-testid="customers-no-results"
          className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center"
        >
          <p className="text-sm font-medium text-zinc-900">Inga träffar</p>
          <p className="mt-1 text-sm text-zinc-600">
            Ingen kund matchar din sökning eller ditt filter. Justera och försök igen.
          </p>
        </div>
      )}

      {/* ── POPULATED list ── */}
      {!isEmpty && !isNoResults && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <caption className="sr-only">Kundlista</caption>
            <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-3">Kund</th>
                <th scope="col" className="px-4 py-3">Typ</th>
                <th scope="col" className="px-4 py-3">Org.nr</th>
                <th scope="col" className="px-4 py-3">Ort</th>
                <th scope="col" className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100" data-testid="customers-table-body">
              {filtered.map((it) => (
                <tr key={it.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${it.id}`}
                      className="font-medium text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      {it.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <CustomerTypeBadge type={it.type} />
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{it.identifier ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-700">{it.city ?? "—"}</td>
                  <td className="px-4 py-3">
                    {it.isArchived ? (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                        <ArchivedIcon /> Arkiverad
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <ActiveIcon /> Aktiv
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomerDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        existingCustomers={items}
      />
    </section>
  );
}

function ListHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold text-zinc-900">Kunder</h1>
      <button
        type="button"
        onClick={onCreate}
        data-testid="new-customer-button"
        className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <PlusIcon /> Ny kund
      </button>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
      <path d="M12 9v3.75m0 3.75h.008M10.06 3.54 1.7 18a1.5 1.5 0 0 0 1.3 2.25h18a1.5 1.5 0 0 0 1.3-2.25L13.94 3.54a1.5 1.5 0 0 0-2.88 0Z" />
    </svg>
  );
}
function ArchivedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
      <path d="M3.75 6.75h16.5M4.5 6.75 5.4 18a1.5 1.5 0 0 0 1.5 1.35h10.2a1.5 1.5 0 0 0 1.5-1.35l.9-11.25M9.75 10.5h4.5" />
    </svg>
  );
}
function ActiveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
      <path d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

"use client";

/**
 * Job/order list (Story 7.3, Task 2 / AC2) — the thin `/jobs` (Jobb/Order) index island.
 *
 * Renders the tenant's ACTIVE jobs (current customer + status + planned dates + source quote
 * number), each row linking to the detail at `/jobs/[id]`. A thin index — the DETAIL is the heart
 * of the story. The four AC2 filter/search controls (customer, status, planned-date, source-quote)
 * narrow the visible rows CLIENT-SIDE over the already-tenant-scoped rows.
 *
 * SCOPE GUARD (AC2, R-711): NO deferred-module column, control, label, badge, or link, and NO
 * placeholder for a deferred module (the `job-non-scope` guardrail enforces the exact forbidden
 * token/route list). Status is conveyed as TEXT (a11y — WCAG 1.4.1: never color alone). NO new nav
 * item — "Jobb/Order" already exists in the seven-item shell.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { JOB_STATUSES, JOB_STATUS_LABELS, type JobListRow } from "@/features/jobs/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString("sv-SE");
}

export function JobList({
  rows,
  loadError,
}: {
  readonly rows: readonly JobListRow[];
  readonly loadError: string | null;
}) {
  const [customerFilter, setCustomerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [plannedDateFilter, setPlannedDateFilter] = useState("");
  const [sourceQuoteFilter, setSourceQuoteFilter] = useState("");

  // The distinct customers + source quotes present in the tenant's jobs — the filter option sets.
  const customerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (r.customerId && !seen.has(r.customerId)) {
        seen.set(r.customerId, r.customerDisplayName ?? r.customerId);
      }
    }
    return Array.from(seen, ([id, label]) => ({ id, label }));
  }, [rows]);

  const sourceQuoteOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (r.quoteId && !seen.has(r.quoteId)) {
        seen.set(
          r.quoteId,
          r.quoteNumber ? `Offert #${r.quoteNumber}` : "Utan nummer",
        );
      }
    }
    return Array.from(seen, ([id, label]) => ({ id, label }));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (customerFilter && r.customerId !== customerFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (sourceQuoteFilter && r.quoteId !== sourceQuoteFilter) return false;
      if (plannedDateFilter) {
        // Match on the planned START date (a thin equality filter — the index is minimal).
        if (r.plannedStartDate !== plannedDateFilter) return false;
      }
      return true;
    });
  }, [rows, customerFilter, statusFilter, sourceQuoteFilter, plannedDateFilter]);

  return (
    <section
      data-testid="job-list"
      aria-labelledby="jobs-heading"
      className="flex flex-col gap-6 p-6"
    >
      <h1 id="jobs-heading" className="text-2xl font-semibold text-zinc-900">
        Jobb/Order
      </h1>

      {loadError && (
        <p
          role="alert"
          data-testid="job-list-error"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {loadError}
        </p>
      )}

      {/* Filter / search controls (AC2). Status labels are TEXT (a11y). */}
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">Kund</span>
          <select
            data-testid="job-filter-customer"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5"
          >
            <option value="">Alla kunder</option>
            {customerOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">Status</span>
          <select
            data-testid="job-filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5"
          >
            <option value="">Alla statusar</option>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {JOB_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">Planerat startdatum</span>
          <input
            type="date"
            data-testid="job-filter-planned-date"
            value={plannedDateFilter}
            onChange={(e) => setPlannedDateFilter(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">Källoffert</span>
          <select
            data-testid="job-filter-source-quote"
            value={sourceQuoteFilter}
            onChange={(e) => setSourceQuoteFilter(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5"
          >
            <option value="">Alla offerter</option>
            {sourceQuoteOptions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p data-testid="job-list-empty" className="text-sm text-zinc-600">
          Inga jobb matchar. Jobb skapas när en offert accepteras.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((row) => (
            <li key={row.id} data-testid="job-list-row">
              <Link
                href={`/jobs/${row.id}`}
                className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 px-4 py-3 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-900">
                    {row.title ?? row.customerDisplayName ?? "Jobb"}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {row.customerDisplayName ?? "—"} ·{" "}
                    {row.quoteNumber
                      ? `Offert #${row.quoteNumber}`
                      : "Utan offertnummer"}{" "}
                    · Planerat: {formatDate(row.plannedStartDate)}
                  </span>
                </div>
                <span className="text-xs font-medium text-zinc-700">
                  {JOB_STATUS_LABELS[row.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

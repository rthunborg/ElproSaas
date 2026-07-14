"use client";

/**
 * Job/order list (Story 7.3, Task 2 / AC2) — the thin `/jobs` (Jobb/Order) index island.
 *
 * Renders the tenant's ACTIVE jobs (current customer + status + planned dates + source quote
 * number), each row linking to the detail at `/jobs/[id]`. A thin index — the DETAIL is the heart
 * of the story. The four AC2 filter/search controls (customer, status, planned-date, source-quote)
 * narrow the visible rows CLIENT-SIDE over the already-tenant-scoped rows.
 *
 * Since 2026-07-14 (owner decision — standalone job creation) the header carries the
 * "Skapa nytt jobb" create affordance (the `CalculationList` "Ny kalkyl" inline-expanding form
 * pattern): customer required + optional title/planned dates, wired to `createJobAction` → the
 * `createJob` command (NULL source refs; the server is the authority). On success it navigates to
 * the new job's detail.
 *
 * SCOPE GUARD (AC2, R-711): NO deferred-module column, control, label, badge, or link, and NO
 * placeholder for a deferred module (the `job-non-scope` guardrail enforces the exact forbidden
 * token/route list). Status is conveyed as TEXT (a11y — WCAG 1.4.1: never color alone). NO new nav
 * item — "Jobb/Order" already exists in the seven-item shell.
 */
import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormErrorSummary, SelectField, TextField } from "@/components/crm/FormField";
import { createJobAction } from "@/features/jobs/actions";
import {
  JOB_ACTION_INITIAL,
  isRetryableJobError,
} from "@/features/jobs/action-state";
import { JOB_STATUSES, JOB_STATUS_LABELS, type JobListRow } from "@/features/jobs/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString("sv-SE");
}

export interface JobCustomerOption {
  readonly id: string;
  readonly label: string;
}

/** The source-quote filter sentinel for STANDALONE jobs (quoteId === null) — "Utan källoffert".
 * A UUID can never collide with it. */
const NO_SOURCE_QUOTE = "__none__";

export function JobList({
  rows,
  loadError,
  customerOptions,
  optionsLoadError = false,
}: {
  readonly rows: readonly JobListRow[];
  readonly loadError: string | null;
  /** The tenant's ACTIVE customers — the create form's required customer picker options. */
  readonly customerOptions: readonly JobCustomerOption[];
  /** True when the customer-options read FAILED — an empty picker then means "unknown", NOT
   * "no customers exist", so the form shows a neutral retry message instead of the misleading
   * add-a-customer hint (submit stays disabled). */
  readonly optionsLoadError?: boolean;
}) {
  const router = useRouter();
  const [customerFilter, setCustomerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [plannedDateFilter, setPlannedDateFilter] = useState("");
  const [sourceQuoteFilter, setSourceQuoteFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [state, formAction, pending] = useActionState(
    createJobAction,
    JOB_ACTION_INITIAL,
  );

  // On a successful create, navigate to the new job's detail.
  useEffect(() => {
    if (state.status === "success" && state.targetId) {
      router.push(`/jobs/${state.targetId}`);
    }
  }, [state.status, state.targetId, router]);

  const v = (field: string, fallback: string): string =>
    state.values[field] || fallback;
  const retryable = isRetryableJobError(state);

  // The distinct customers + source quotes present in the tenant's jobs — the FILTER option sets
  // (distinct from `customerOptions`, the create form's full active-customer picker).
  const filterCustomerOptions = useMemo(() => {
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
      // The sentinel matches STANDALONE jobs (no source quote); a quote id matches its jobs.
      if (sourceQuoteFilter === NO_SOURCE_QUOTE) {
        if (r.quoteId !== null) return false;
      } else if (sourceQuoteFilter && r.quoteId !== sourceQuoteFilter) {
        return false;
      }
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
      <div className="flex items-center justify-between gap-4">
        <h1 id="jobs-heading" className="text-2xl font-semibold text-zinc-900">
          Jobb/Order
        </h1>
        <button
          type="button"
          data-testid="new-job-button"
          onClick={() => setShowCreate((s) => !s)}
          aria-expanded={showCreate}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Skapa nytt jobb
        </button>
      </div>

      {loadError && (
        <p
          role="alert"
          data-testid="job-list-error"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {loadError}
        </p>
      )}

      {showCreate && (
        <form
          action={formAction}
          data-testid="new-job-form"
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
              data-testid="new-job-options-error"
              className="text-sm text-red-800"
            >
              Kunderna kunde inte läsas — försök igen om en stund.
            </p>
          ) : customerOptions.length === 0 ? (
            <p className="text-sm text-zinc-600">
              Lägg till en kund först under Kunder för att skapa ett jobb.
            </p>
          ) : (
            <SelectField
              name="customer_id"
              label="Kund"
              required
              defaultValue={v("customer_id", "")}
              options={[
                { value: "", label: "Välj kund…" },
                ...customerOptions.map((c) => ({ value: c.id, label: c.label })),
              ]}
            />
          )}
          <TextField name="title" label="Titel" defaultValue={v("title", "")} />
          <TextField
            name="planned_start_date"
            label="Planerat startdatum"
            type="date"
            defaultValue={v("planned_start_date", "")}
          />
          <TextField
            name="planned_end_date"
            label="Planerat slutdatum"
            type="date"
            defaultValue={v("planned_end_date", "")}
          />
          <div className="flex justify-end">
            {/* Disabled AFTER success too — the router.push is in flight; a second submit
                would create a duplicate job (double-submit guard). */}
            <button
              type="submit"
              disabled={
                pending ||
                state.status === "success" ||
                optionsLoadError ||
                customerOptions.length === 0
              }
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
            >
              {pending ? "Skapar…" : "Skapa jobb"}
            </button>
          </div>
        </form>
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
            {filterCustomerOptions.map((c) => (
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
            {/* Standalone jobs (no source quote) are filterable too — never invisible. */}
            <option value={NO_SOURCE_QUOTE}>Utan källoffert</option>
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
          Inga jobb matchar. Skapa ett jobb med “Skapa nytt jobb” — ett jobb skapas
          också när en offert accepteras.
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

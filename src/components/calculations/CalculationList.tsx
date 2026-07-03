"use client";

/**
 * Calculation list (Story 5.2, Task 1.3 / AC1) — the thin `/calculations` index island.
 *
 * Renders the tenant's ACTIVE calculations (title + status + customer + updated), each row
 * linking to the editor at `/calculations/[id]`, and a `Ny kalkyl` create affordance (a calc
 * always needs a customer, so create requires selecting one). The create form wires to the
 * `createCalculationAction` server action → the 5.1 `createCalculation` command; on success
 * it navigates to the new calc's editor. Validation errors preserve input (AC2) and are
 * field-associated (aria-invalid/aria-describedby).
 *
 * The list is a thin index — the EDITOR is the heart of this story. No deferred-workflow
 * label appears; no new nav item (Kalkyler already exists in the seven-item shell).
 */
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormErrorSummary, SelectField, TextField } from "@/components/crm/FormField";
import { createCalculationAction } from "@/features/calculations/actions";
import {
  CALC_ACTION_INITIAL,
  isRetryableCalcError,
} from "@/features/calculations/action-state";
import type { CalculationListRow } from "@/features/calculations/read";

/** Swedish labels for the calc lifecycle status (presentational only). */
const STATUS_LABELS: Record<string, string> = {
  draft: "Utkast",
  ready: "Klar",
  archived: "Arkiverad",
};

export interface CustomerOption {
  readonly id: string;
  readonly label: string;
}

export function CalculationList({
  rows,
  loadError,
  customerOptions,
}: {
  readonly rows: readonly CalculationListRow[];
  readonly loadError: string | null;
  readonly customerOptions: readonly CustomerOption[];
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [state, formAction, pending] = useActionState(
    createCalculationAction,
    CALC_ACTION_INITIAL,
  );

  // On a successful create, navigate to the new calc's editor.
  useEffect(() => {
    if (state.status === "success" && state.targetId) {
      router.push(`/calculations/${state.targetId}`);
    }
  }, [state.status, state.targetId, router]);

  const isMine = state.form === "calculation";
  const v = (field: string, fallback: string): string =>
    (isMine && state.values[field]) || fallback;
  const err = (field: string): string | undefined =>
    isMine ? state.fieldErrors[field] : undefined;
  const retryable = isMine && isRetryableCalcError(state);

  return (
    <section
      data-testid="calculation-list"
      aria-labelledby="calculations-heading"
      className="flex flex-col gap-6 p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h1 id="calculations-heading" className="text-2xl font-semibold text-zinc-900">
          Kalkyler
        </h1>
        <button
          type="button"
          data-testid="new-calculation"
          onClick={() => setShowCreate((s) => !s)}
          aria-expanded={showCreate}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Ny kalkyl
        </button>
      </div>

      {loadError && (
        <p
          role="alert"
          data-testid="calculation-list-error"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {loadError}
        </p>
      )}

      {showCreate && (
        <form
          action={formAction}
          data-testid="new-calculation-form"
          className="flex max-w-xl flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4"
          noValidate
        >
          <FormErrorSummary message={isMine ? state.formError : null} />
          {retryable && (
            <p role="status" className="text-sm text-amber-800">
              Försök igen.
            </p>
          )}
          <TextField
            name="title"
            label="Titel"
            required
            defaultValue={v("title", "")}
            error={err("title")}
          />
          {customerOptions.length === 0 ? (
            <p className="text-sm text-zinc-600">
              Lägg till en kund först under Kunder för att skapa en kalkyl.
            </p>
          ) : (
            <SelectField
              name="customer_id"
              label="Kund"
              required
              defaultValue={v("customer_id", "")}
              error={err("customer_id")}
              options={[
                { value: "", label: "Välj kund…" },
                ...customerOptions.map((c) => ({ value: c.id, label: c.label })),
              ]}
            />
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending || customerOptions.length === 0}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
            >
              {pending ? "Skapar…" : "Skapa kalkyl"}
            </button>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <p data-testid="calculation-list-empty" className="text-sm text-zinc-600">
          Inga kalkyler ännu. Skapa din första kalkyl med “Ny kalkyl”.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/calculations/${row.id}`}
                data-testid="calculation-list-row"
                className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 px-4 py-3 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-900">
                    {row.title}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {row.customer_display_name ?? "—"}
                  </span>
                </div>
                <span className="text-xs font-medium text-zinc-500">
                  {STATUS_LABELS[row.status] ?? row.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

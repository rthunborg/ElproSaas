"use client";

/**
 * Draft-quote edit form (Story 6.2, Task 3.3 / AC2) — rendered ONLY when the selected version
 * is a DRAFT. Editable fields are the customer-visible PRESENTATIONAL draft fields the UX names
 * (intro text, customer-visible notes, validity date, display mode) — NOT lines/price/VAT (a
 * customer-commitment change is a NEW version via Story 6.5).
 *
 * A visible, PERSISTENT warning states that a SENT version becomes IMMUTABLE (customer-visible
 * content can no longer be edited after send). The form wires to `updateDraftQuoteVersionAction`
 * → the `updateDraftQuoteVersion` command (the server re-asserts `status === 'draft'` — the UI
 * read-only state is a convenience, the command is the guarantee). `useActionState` +
 * `role="alert"` banners mirror the calc editor.
 */
import { useActionState } from "react";
import { updateDraftQuoteVersionAction } from "@/features/quotes/actions";
import {
  QUOTE_ACTION_INITIAL,
  isRetryableQuoteError,
} from "@/features/quotes/action-state";

/** The current draft field values (frozen snapshot values, editable in place). */
export interface DraftEditValues {
  readonly quoteId: string;
  readonly quoteVersionId: string;
  readonly introText: string | null;
  readonly customerNotes: string | null;
  readonly validUntil: string | null;
  readonly displayMode: string | null;
}

const DISPLAY_MODE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "detailed", label: "Detaljerad" },
  { value: "summary", label: "Sammanfattning" },
  { value: "text_only", label: "Endast text" },
];

/** Coerce a stored timestamptz into an <input type="date"> value (YYYY-MM-DD), or "". */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toISOString().slice(0, 10);
}

export function DraftQuoteEditor({ values }: { readonly values: DraftEditValues }) {
  const [state, formAction, pending] = useActionState(
    updateDraftQuoteVersionAction,
    QUOTE_ACTION_INITIAL,
  );
  const v = (field: string, fallback: string): string =>
    (state.values[field] as string | undefined) ?? fallback;
  const retryable = isRetryableQuoteError(state);

  return (
    <form
      action={formAction}
      data-testid="draft-quote-editor"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4"
      noValidate
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-zinc-900">Redigera utkast</h3>
      </div>

      {/* The PERSISTENT immutability warning (AC2) — a sent version can no longer be edited. */}
      <p
        role="note"
        data-testid="draft-immutable-warning"
        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      >
        När en offertversion har skickats blir den låst — kundens innehåll kan inte längre
        redigeras. Gör ändringar innan du skickar, eller skapa en ny version efteråt.
      </p>

      {state.status === "success" && (
        <p role="status" data-testid="draft-saved" className="text-sm text-green-800">
          Utkastet sparades.
        </p>
      )}
      {state.status === "error" && state.formError && (
        <p role="alert" data-testid="draft-error" className="text-sm text-red-800">
          {state.formError}
        </p>
      )}
      {retryable && (
        <p role="status" className="text-sm text-amber-800">
          Försök igen.
        </p>
      )}

      <input type="hidden" name="quote_id" value={values.quoteId} />
      <input type="hidden" name="quote_version_id" value={values.quoteVersionId} />

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800">Introtext</span>
        <textarea
          name="intro_text"
          rows={2}
          defaultValue={v("intro_text", values.introText ?? "")}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800">Kundnoteringar</span>
        <textarea
          name="customer_notes"
          rows={2}
          defaultValue={v("customer_notes", values.customerNotes ?? "")}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800">Giltig till</span>
        <input
          type="date"
          name="valid_until"
          defaultValue={v("valid_until", toDateInput(values.validUntil))}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800">Visningsläge</span>
        <select
          name="display_mode"
          defaultValue={v("display_mode", values.displayMode ?? "detailed")}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {DISPLAY_MODE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          data-testid="draft-save"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
        >
          {pending ? "Sparar…" : "Spara utkast"}
        </button>
      </div>
    </form>
  );
}

"use client";

/**
 * Articles editor (Story 3.4, Task 4.3 / AC3/AC5) — an accessible list + create/edit
 * form wired to the 3.4 `upsertArticle` / `archiveArticle` envelope commands via the
 * `saveArticleAction` / `archiveArticleAction` server actions.
 *
 * - A list of the tenant's ACTIVE MANUAL articles (name + unit price shown as KRONOR but
 *   STORED as integer öre).
 * - A create/edit form: `name` (required), optional `sku`/`unit`, and a unit price
 *   "Enhetspris (kr)" (required). The kronor↔öre conversion happens at the boundary.
 *
 * HARD NON-NEGOTIABLE — NO SUPPLIER SCOPE IN THE UI: there is NO supplier / sync / import
 * / Fortnox / external-mapping control anywhere in this editor. Articles are manual,
 * minimal material rows only (name, optional sku/unit, integer-öre price, active flag).
 *
 * Validation feedback is programmatically associated (aria-invalid/aria-describedby + an
 * aria-live blocking summary); input is preserved on a failed submit; no color-only
 * signalling.
 */
import { useActionState } from "react";
import { FormErrorSummary, TextField } from "@/components/crm/FormField";
import {
  saveArticleAction,
  archiveArticleAction,
} from "@/features/pricing/actions";
import { PRICING_ACTION_INITIAL } from "@/features/pricing/action-state";
import { oreToKronorString } from "@/features/pricing/money-display";
import type { ArticleRow } from "@/features/pricing/read";

export function ArticlesEditor({
  articles,
}: {
  readonly articles: readonly ArticleRow[];
}) {
  const [state, formAction, pending] = useActionState(
    saveArticleAction,
    PRICING_ACTION_INITIAL,
  );
  const [, archiveAction] = useActionState(
    archiveArticleAction,
    PRICING_ACTION_INITIAL,
  );

  const mine = state.form === "article";
  const v = (field: string, fallback: string): string =>
    (mine && state.values[field]) || fallback;
  const err = (field: string): string | undefined =>
    mine ? state.fieldErrors[field] : undefined;

  return (
    <section
      data-testid="articles-editor"
      aria-labelledby="articles-heading"
      className="flex flex-col gap-4"
    >
      <h2 id="articles-heading" className="text-lg font-semibold text-zinc-900">
        Artiklar / material
      </h2>

      {articles.length === 0 ? (
        <p className="text-sm text-zinc-600">
          Inga artiklar ännu. Lägg till din första artikel nedan.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {articles.map((article) => (
            <li
              key={article.id}
              className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-900">
                  {article.name}
                  {article.unit ? ` (${article.unit})` : ""}
                </span>
                <span className="text-xs text-zinc-600">
                  {oreToKronorString(article.unit_price_ore)} kr
                </span>
              </div>
              <form action={archiveAction}>
                <input type="hidden" name="id" value={article.id} />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  Arkivera
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex max-w-xl flex-col gap-4" noValidate>
        <FormErrorSummary message={mine ? state.formError : null} />

        {mine && state.status === "success" && (
          <p
            data-testid="settings-saved"
            role="status"
            className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800"
          >
            Artikeln har sparats.
          </p>
        )}

        <TextField
          name="name"
          label="Artikelnamn"
          required
          defaultValue={v("name", "")}
          error={err("name")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            name="sku"
            label="Artikelnummer"
            defaultValue={v("sku", "")}
          />
          <TextField
            name="unit"
            label="Enhet"
            defaultValue={v("unit", "")}
          />
        </div>
        <TextField
          name="unit_price_kronor"
          label="Enhetspris (kr)"
          required
          defaultValue={v("unit_price_kronor", "")}
          error={err("unit_price_kronor")}
        />
        <p className="text-xs text-zinc-500">
          Anges i kronor (t.ex. 12,50). Lagras som heltal i öre. Manuella material –
          ingen leverantörsintegration.
        </p>

        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
          >
            {pending ? "Sparar…" : "Spara artikel"}
          </button>
        </div>
      </form>
    </section>
  );
}

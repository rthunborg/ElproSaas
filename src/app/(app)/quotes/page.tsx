/**
 * `/quotes` (Offerter) — the quote list (Story 6.2, Task 2.1; architecture §4).
 *
 * A SERVER component over the RLS-scoped list read: it reads the tenant's ACTIVE quotes on the
 * per-request cookie-bound RLS client (anon key — NEVER service-role) and hands the rows to the
 * client `QuoteList` island. Each row links to `/quotes/[quoteId]` — the detail is the heart of
 * this story; this list is a thin index. Since 2026-07-14 (owner decision — list-page create
 * entry points) it ALSO fetches the active-calculation options for the island's "Skapa ny offert"
 * create affordance (a quote is always born from an own-tenant calculation via the 6.1 command).
 *
 * `force-dynamic` because this route reads per-request auth/data (the `(app)` layout is the auth
 * boundary). This page adds NO auth mechanism and NO new nav item — Offerter already exists in
 * the seven-item shell nav.
 */
import { QuoteList } from "@/components/quotes/QuoteList";
import { readQuoteList } from "@/features/quotes/read";
import { readCalculationList } from "@/features/calculations/read";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  // The list + the active-calculation options for the create affordance — both RLS reads.
  const [{ rows, error }, { rows: calculations, error: calcError }] =
    await Promise.all([readQuoteList(), readCalculationList()]);
  const calculationOptions = calculations.map((c) => ({
    id: c.id,
    label: c.customer_display_name ? `${c.title} — ${c.customer_display_name}` : c.title,
  }));
  return (
    <QuoteList
      rows={rows}
      loadError={error}
      calculationOptions={calculationOptions}
      // A FAILED options read must not masquerade as "no calculations exist" (the island
      // shows a neutral retry message and keeps submit disabled).
      optionsLoadError={calcError !== null}
    />
  );
}

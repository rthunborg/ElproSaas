/**
 * `/quotes` (Offerter) — the quote list (Story 6.2, Task 2.1; architecture §4).
 *
 * A SERVER component over the RLS-scoped list read: it reads the tenant's ACTIVE quotes on the
 * per-request cookie-bound RLS client (anon key — NEVER service-role) and hands the rows to the
 * client `QuoteList` island. Each row links to `/quotes/[quoteId]` — the detail is the heart of
 * this story; this list is a thin index. Story 10.6 routes creation through the reviewed
 * calculation-preview flow, so this page does not expose a proof-less quick-create path.
 *
 * `force-dynamic` because this route reads per-request auth/data (the `(app)` layout is the auth
 * boundary). This page adds NO auth mechanism and NO new nav item — Offerter already exists in
 * the seven-item shell nav.
 */
import { QuoteList } from "@/components/quotes/QuoteList";
import { readQuoteList } from "@/features/quotes/read";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const { rows, error } = await readQuoteList();
  return <QuoteList rows={rows} loadError={error} />;
}

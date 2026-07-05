/**
 * `/quotes/[quoteId]/versions/[versionId]` (Offertversion) — the immutable sent/accepted
 * snapshot view + the draft edit view before send (Story 6.2, Task 2.2; architecture §4).
 *
 * The SAME server-fetch as the quote-detail page, resolving the SELECTED version to the
 * supplied `versionId`. A foreign/other-tenant quote id → generic not-found; a supplied version
 * id that is not in the timeline falls back to the latest inside `readQuoteDetail` (no leak).
 *
 * `force-dynamic`; the `(app)` layout is the auth boundary (no auth mechanism added here).
 */
import Link from "next/link";
import { QuoteDetailView } from "@/components/quotes/QuoteDetailView";
import { readQuoteDetail } from "@/features/quotes/read";

export const dynamic = "force-dynamic";

export default async function QuoteVersionPage({
  params,
}: {
  params: Promise<{ quoteId: string; versionId: string }>;
}) {
  const { quoteId, versionId } = await params;
  const { detail, error } = await readQuoteDetail(quoteId, versionId);

  if (error) {
    return (
      <section className="mx-auto max-w-3xl">
        <div
          role="alert"
          data-testid="quote-detail-failed"
          className="rounded-lg border border-red-300 bg-red-50 p-6"
        >
          <p className="text-sm font-medium text-red-800">
            Offerten kunde inte läsas in.
          </p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <Link
            href="/quotes"
            className="mt-4 inline-flex rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
          >
            Tillbaka till offerter
          </Link>
        </div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="mx-auto max-w-3xl">
        <div
          data-testid="quote-not-found"
          className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center"
        >
          <p className="text-sm font-medium text-zinc-900">Offerten hittades inte</p>
          <p className="mt-1 text-sm text-zinc-600">
            Offerten finns inte eller så har du inte åtkomst till den.
          </p>
          <Link
            href="/quotes"
            className="mt-4 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Tillbaka till offerter
          </Link>
        </div>
      </section>
    );
  }

  return <QuoteDetailView detail={detail} />;
}

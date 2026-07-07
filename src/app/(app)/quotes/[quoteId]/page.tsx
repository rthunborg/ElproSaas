/**
 * `/quotes/[quoteId]` (Offert) — the quote detail + version timeline (Story 6.2, Task 2.2).
 *
 * A SERVER component: it server-fetches the quote detail (header + all versions + the selected
 * version's frozen lines/attachments + events) by id via the per-request RLS client (anon key —
 * NEVER service-role). A foreign/other-tenant id is invisible under RLS → zero rows → a GENERIC
 * "not found / no access" state that NEVER reveals whether the quote exists in another tenant
 * (mirrors the calc editor page). A read error renders the generic failed state. The selected
 * version defaults to the LATEST; the version subroute selects a specific version.
 *
 * `force-dynamic` because the route reads per-request auth/data; the `(app)` layout is the auth
 * boundary (this page adds no auth mechanism). Every displayed value is read from the frozen
 * snapshot — no recompute (R-616).
 */
import Link from "next/link";
import { QuoteDetailView } from "@/components/quotes/QuoteDetailView";
import { readQuoteDetail } from "@/features/quotes/read";
import { renderAcceptanceFilesPanel } from "@/features/files/acceptance-panel";
import { renderSentQuoteFilesPanel } from "@/features/files/quote-files-panel";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const { detail, error } = await readQuoteDetail(quoteId);

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
    // Invisible under RLS (or genuinely absent) → GENERIC not-found, no leakage.
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

  // Story 8.2 — the acceptance-evidence file panel for the selected version (when accepted).
  // Story 8.5 — the locked commitment-file panel for a non-draft (sent/accepted) version's PDF.
  const [acceptanceFilesPanel, sentQuoteFilesPanel] = await Promise.all([
    renderAcceptanceFilesPanel(detail, quoteId),
    renderSentQuoteFilesPanel(detail, quoteId),
  ]);

  return (
    <QuoteDetailView
      detail={detail}
      acceptanceFilesPanel={acceptanceFilesPanel}
      sentQuoteFilesPanel={sentQuoteFilesPanel}
    />
  );
}

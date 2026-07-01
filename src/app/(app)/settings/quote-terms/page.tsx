/**
 * `/settings/quote-terms` (Offertvillkor) — the tenant-owned quote terms editor with
 * the owner/legal SIGN-OFF status/warning (Story 3.3, Task 4.1 / AC2).
 *
 * A SERVER component over the RLS-scoped settings read: it reads the tenant's
 * quote_terms on the per-request cookie-bound RLS client (anon key — NEVER
 * service-role) and hands the values + sign-off state to the client `QuoteTermsEditor`
 * island. A tenant with no terms row yet renders an empty editor — and a null/empty
 * terms record is, by definition, NOT approved (the not-approved WARNING shows).
 *
 * `force-dynamic` because this route reads per-request auth/data (the `(app)` layout is
 * the auth boundary). This page adds NO auth mechanism.
 */
import Link from "next/link";
import { QuoteTermsEditor } from "@/components/settings/QuoteTermsEditor";
import { readQuoteTerms } from "@/features/settings/read";

export const dynamic = "force-dynamic";

export default async function QuoteTermsPage() {
  const { terms, error } = await readQuoteTerms();

  const defaults = {
    id: terms?.id ?? null,
    terms_text: terms?.terms_text ?? "",
    approved_at: terms?.approved_at ?? null,
    approved_by: terms?.approved_by ?? null,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/settings"
          className="text-sm text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          ← Inställningar
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900">Offertvillkor</h1>
        <p className="text-sm text-zinc-600">
          Återanvändbara offertvillkor för din organisation. Villkoren godkänns av
          ägare/juridik innan de används i skarpa offerter.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      <QuoteTermsEditor defaults={defaults} />
    </div>
  );
}

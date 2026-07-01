/**
 * `/settings/company` (Företagsinställningar) — company identity + VAT display/rate
 * defaults (Story 3.3, Task 4.1).
 *
 * A SERVER component over the RLS-scoped settings read: it reads the tenant's
 * company_settings on the per-request cookie-bound RLS client (anon key — NEVER
 * service-role) and hands the values to the client `CompanySettingsForm` island. A
 * tenant with no settings row yet renders sensible defaults (an empty form with the
 * legacy 25% VAT default).
 *
 * `force-dynamic` because this route reads per-request auth/data (the `(app)` layout is
 * the auth boundary; only the `build` gate catches a missing one). This page adds NO
 * auth mechanism.
 */
import Link from "next/link";
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";
import {
  COMPANY_SETTINGS_DEFAULT_VAT_RATE_BP,
  readCompanySettings,
} from "@/features/settings/read";
import { bpToPercentString } from "@/features/settings/vat-display";

export const dynamic = "force-dynamic";

export default async function CompanySettingsPage() {
  const { settings, error } = await readCompanySettings();

  const defaults = {
    company_name: settings?.company_name ?? null,
    org_nr: settings?.org_nr ?? null,
    address_line1: settings?.address_line1 ?? null,
    address_line2: settings?.address_line2 ?? null,
    postal_code: settings?.postal_code ?? null,
    city: settings?.city ?? null,
    email: settings?.email ?? null,
    phone: settings?.phone ?? null,
    default_vat_display: settings?.default_vat_display ?? "company_togglable",
    vat_rate_percent: bpToPercentString(
      settings?.vat_rate_bp ?? COMPANY_SETTINGS_DEFAULT_VAT_RATE_BP,
    ),
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
        <h1 className="text-2xl font-semibold text-zinc-900">
          Företagsinställningar
        </h1>
        <p className="text-sm text-zinc-600">
          Företagsidentitet för offerter och PDF, samt standardvärden för
          momsvisning och momssats.
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

      <CompanySettingsForm defaults={defaults} />
    </div>
  );
}

"use client";

/**
 * Company settings form (Story 3.3, Task 4.2 / AC1/AC4/AC5) — accessible form wired to
 * the 3.3 `updateCompanySettings` envelope command via the `saveCompanySettingsAction`
 * server action.
 *
 * - Company identity fields (company_name required; org_nr/address/contact optional).
 * - A `default_vat_display` select encoding the owner VAT rule (private always
 *   incl-VAT not togglable / company togglable) as the TENANT DEFAULT — NOT a
 *   per-customer toggle and NOT any VAT CALCULATION (Epic 4).
 * - A VAT-rate input shown as a PERCENT ("Momssats") but STORED as basis points
 *   (converted at the boundary in form-parsing). An out-of-range rate is rejected with
 *   a FIELD-ASSOCIATED error (aria-invalid + aria-describedby) and input is preserved.
 *
 * Validation feedback is programmatically associated (aria-invalid/aria-describedby +
 * an aria-live blocking summary); input is preserved on a failed submit; no color-only
 * signalling (the message text carries the meaning). Mirrors the Story 3.2 CRM form a11y.
 */
import { useActionState } from "react";
import {
  FormErrorSummary,
  SelectField,
  TextField,
} from "@/components/crm/FormField";
import { saveCompanySettingsAction } from "@/features/settings/actions";
import { SETTINGS_ACTION_INITIAL } from "@/features/settings/action-state";
import { VAT_DISPLAY_OPTIONS } from "@/features/settings/vat-display";

/** The current company settings the form hydrates from (null = no row yet). */
export interface CompanySettingsDefaults {
  readonly company_name: string | null;
  readonly org_nr: string | null;
  readonly address_line1: string | null;
  readonly address_line2: string | null;
  readonly postal_code: string | null;
  readonly city: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly default_vat_display: string;
  /** The VAT rate seeded into the percent input (already converted from basis points). */
  readonly vat_rate_percent: string;
}

export function CompanySettingsForm({
  defaults,
}: {
  readonly defaults: CompanySettingsDefaults;
}) {
  const [state, formAction, pending] = useActionState(
    saveCompanySettingsAction,
    SETTINGS_ACTION_INITIAL,
  );

  // Echo-back values from a failed submit take precedence over the initial defaults.
  const v = (field: string, fallback: string | null | undefined): string =>
    state.values[field] ?? fallback ?? "";

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4" noValidate>
      <FormErrorSummary message={state.formError} />

      {state.status === "success" && (
        <p
          data-testid="settings-saved"
          role="status"
          className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          Företagsinställningarna har sparats.
        </p>
      )}

      <TextField
        name="company_name"
        label="Företagsnamn"
        required
        defaultValue={v("company_name", defaults.company_name)}
        error={state.fieldErrors.company_name}
      />
      <TextField
        name="org_nr"
        label="Organisationsnummer"
        defaultValue={v("org_nr", defaults.org_nr)}
      />
      <TextField
        name="address_line1"
        label="Adress"
        defaultValue={v("address_line1", defaults.address_line1)}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          name="postal_code"
          label="Postnummer"
          defaultValue={v("postal_code", defaults.postal_code)}
        />
        <TextField
          name="city"
          label="Ort"
          defaultValue={v("city", defaults.city)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          name="email"
          label="E-post"
          type="email"
          defaultValue={v("email", defaults.email)}
          error={state.fieldErrors.email}
        />
        <TextField
          name="phone"
          label="Telefon"
          defaultValue={v("phone", defaults.phone)}
          error={state.fieldErrors.phone}
        />
      </div>

      <SelectField
        name="default_vat_display"
        label="Standardvisning av moms"
        options={VAT_DISPLAY_OPTIONS}
        defaultValue={v("default_vat_display", defaults.default_vat_display)}
        error={state.fieldErrors.default_vat_display}
      />

      <div className="flex flex-col gap-1">
        <TextField
          name="vat_rate_percent"
          label="Momssats"
          defaultValue={v("vat_rate_percent", defaults.vat_rate_percent)}
          error={state.fieldErrors.vat_rate_percent}
        />
        <p className="text-xs text-zinc-500">
          Anges i procent (t.ex. 25 för 25 %). Lagras som heltal i baspunkter. Ingen
          momsberäkning görs här – endast standardvärdet sparas.
        </p>
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
        >
          {pending ? "Sparar…" : "Spara"}
        </button>
      </div>
    </form>
  );
}

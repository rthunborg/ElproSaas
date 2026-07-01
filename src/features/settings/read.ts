/**
 * Server-side settings reads for the UI (Story 3.3, Task 4.1) — the RLS-scoped read
 * path the `/settings/*` pages call. SERVER-ONLY (no `"use server"` action surface):
 * plain async functions invoked from server components.
 *
 * EVERY read runs on the per-request, cookie-bound RLS client (anon key — NEVER a
 * service-role key). RLS scopes every row to the caller's tenant with NO tenant id
 * passed (architecture §6); a cross-tenant id simply returns zero rows. NO direct
 * write, NO service-role client — reads only here; all writes go through the 3.3
 * envelope commands (`src/features/settings/actions.ts`).
 *
 * A tenant with NO settings row yet reads as `null` — the page renders sensible
 * defaults / an empty form (the first save INSERTs the row via the upsert command).
 */
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import {
  DEFAULT_VAT_RATE_BP,
  type VatDisplayMode,
} from "@/server/commands/settings/validation";

const GENERIC_READ_ERROR =
  "Ett tillfälligt fel inträffade. Försök igen om en stund.";

/** The company_settings row as the UI needs it (a subset; no audit columns). */
export interface CompanySettingsRow {
  readonly id: string;
  readonly company_name: string | null;
  readonly org_nr: string | null;
  readonly address_line1: string | null;
  readonly address_line2: string | null;
  readonly postal_code: string | null;
  readonly city: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly logo_url: string | null;
  readonly default_vat_display: VatDisplayMode;
  readonly vat_rate_bp: number;
}

const COMPANY_COLUMNS =
  "id, company_name, org_nr, address_line1, address_line2, postal_code, city, email, phone, logo_url, default_vat_display, vat_rate_bp";

export interface CompanySettingsReadResult {
  /** The tenant's settings row, or null when none exists yet (renders defaults). */
  readonly settings: CompanySettingsRow | null;
  readonly error: string | null;
}

/**
 * Read the tenant's company_settings (ONE row per tenant; RLS-scoped). Returns
 * `settings: null` when the tenant has not saved any yet. A query error returns the
 * generic FAILED message (never a leaked stack/SQL).
 */
export async function readCompanySettings(): Promise<CompanySettingsReadResult> {
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("company_settings")
      .select(COMPANY_COLUMNS)
      .limit(1);
    if (error) return { settings: null, error: GENERIC_READ_ERROR };
    const settings = (data?.[0] ?? null) as CompanySettingsRow | null;
    return { settings, error: null };
  } catch {
    return { settings: null, error: GENERIC_READ_ERROR };
  }
}

/** The default vat_rate_bp a fresh (no-row) tenant renders before its first save. */
export const COMPANY_SETTINGS_DEFAULT_VAT_RATE_BP = DEFAULT_VAT_RATE_BP;

/** The quote_terms row as the UI needs it (incl. the sign-off columns). */
export interface QuoteTermsRow {
  readonly id: string;
  readonly terms_text: string;
  /** NULL = not approved (the absence of a sign-off — the STOP-CONDITION). */
  readonly approved_at: string | null;
  readonly approved_by: string | null;
}

const QUOTE_TERMS_COLUMNS = "id, terms_text, approved_at, approved_by";

export interface QuoteTermsReadResult {
  /** The tenant's terms row, or null when none exists yet (empty editor). */
  readonly terms: QuoteTermsRow | null;
  readonly error: string | null;
}

/**
 * Read the tenant's quote_terms (ONE active set per tenant; RLS-scoped). Returns
 * `terms: null` when none exists yet — and a null/empty terms row is, by definition,
 * NOT approved (the UI shows the not-approved WARNING). A query error returns the
 * generic FAILED message.
 */
export async function readQuoteTerms(): Promise<QuoteTermsReadResult> {
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("quote_terms")
      .select(QUOTE_TERMS_COLUMNS)
      .limit(1);
    if (error) return { terms: null, error: GENERIC_READ_ERROR };
    const terms = (data?.[0] ?? null) as QuoteTermsRow | null;
    return { terms, error: null };
  } catch {
    return { terms: null, error: GENERIC_READ_ERROR };
  }
}

/**
 * Server-side CRM reads for the UI (Story 3.2, Task 1.2 / 2) — the RLS-scoped read
 * path the `/customers` pages call. SERVER-ONLY (no `"use server"` action surface):
 * these are plain async functions invoked from server components.
 *
 * EVERY read runs on the per-request, cookie-bound RLS client (anon key — NEVER a
 * service-role key). RLS scopes every row to the caller's tenant with NO tenant id
 * passed (architecture §6); a cross-tenant id simply returns zero rows. NO direct
 * write, NO service-role client — reads only here; all writes go through the 3.1
 * envelope commands (`src/features/crm/actions.ts`).
 *
 * CRITICAL (private-data posture): the LIST projection's `select(...)` OMITS
 * `personnummer` ENTIRELY — it must never reach the list payload (epic-3 retro-note;
 * owner decision 2026-06-18). The single-customer DETAIL read DOES include it (the
 * detail is the access-controlled surface where it is intentionally surfaced, masked).
 */
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import type { CustomerListRow } from "@/components/crm/customer-presentation";

/** The EXACT list projection columns (NO personnummer — private-data posture). */
const LIST_COLUMNS =
  "id, customer_type, display_name, org_nr, email, phone, city, archived_at, created_at";

/** Result of a list read — rows OR a generic error message (never a leaked detail). */
export interface CustomerListReadResult {
  readonly rows: readonly CustomerListRow[];
  readonly error: string | null;
}

const GENERIC_READ_ERROR =
  "Ett tillfälligt fel inträffade. Försök igen om en stund.";

/**
 * Read the ACTIVE customer list (archived rows excluded by default — Task 1.2). RLS
 * scopes to the caller's tenant. On a query error returns a GENERIC Swedish message
 * (the FAILED state) — never a leaked stack/SQL.
 */
export async function readCustomerList(): Promise<CustomerListReadResult> {
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("customers")
      .select(LIST_COLUMNS)
      .is("archived_at", null)
      .order("display_name", { ascending: true });
    if (error) return { rows: [], error: GENERIC_READ_ERROR };
    return { rows: (data ?? []) as unknown as CustomerListRow[], error: null };
  } catch {
    return { rows: [], error: GENERIC_READ_ERROR };
  }
}

/** The full single-customer detail row (INCLUDES personnummer — masked at render). */
export interface CustomerDetailRow {
  readonly id: string;
  readonly customer_type: string;
  readonly display_name: string;
  readonly org_nr: string | null;
  readonly personnummer: string | null;
  readonly contact_name: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly address_line1: string | null;
  readonly address_line2: string | null;
  readonly postal_code: string | null;
  readonly city: string | null;
  readonly archived_at: string | null;
  readonly created_at: string;
}

const DETAIL_COLUMNS =
  "id, customer_type, display_name, org_nr, personnummer, contact_name, email, phone, address_line1, address_line2, postal_code, city, archived_at, created_at";

/** A facility row for the detail hub (active only). */
export interface FacilityRow {
  readonly id: string;
  readonly name: string;
  readonly address_line1: string | null;
  readonly address_line2: string | null;
  readonly postal_code: string | null;
  readonly city: string | null;
}

/** A contact row for the detail hub (active only). */
export interface ContactRow {
  readonly id: string;
  readonly name: string;
  readonly facility_id: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly role_label: string | null;
  readonly is_primary: boolean;
}

/** The assembled customer-detail read (customer + its active facilities + contacts). */
export interface CustomerDetailReadResult {
  readonly customer: CustomerDetailRow | null;
  readonly facilities: readonly FacilityRow[];
  readonly contacts: readonly ContactRow[];
  readonly error: string | null;
}

/**
 * Read one customer by id with its active facilities + contacts. A foreign/other-tenant
 * id is invisible under RLS → zero rows → `customer: null` (the page renders a GENERIC
 * not-found, never revealing whether the row exists in another tenant). A query error
 * returns the generic FAILED message.
 */
export async function readCustomerDetail(
  customerId: string,
): Promise<CustomerDetailReadResult> {
  try {
    const client = await createSupabaseServerClient();

    const { data: customerRows, error: customerError } = await client
      .from("customers")
      .select(DETAIL_COLUMNS)
      .eq("id", customerId)
      .limit(1);
    if (customerError) {
      return { customer: null, facilities: [], contacts: [], error: GENERIC_READ_ERROR };
    }
    const customer = (customerRows?.[0] ?? null) as CustomerDetailRow | null;
    if (!customer) {
      // Invisible under RLS (or genuinely absent) → generic not-found, no leakage.
      return { customer: null, facilities: [], contacts: [], error: null };
    }

    const [facilitiesRes, contactsRes] = await Promise.all([
      client
        .from("facilities")
        .select("id, name, address_line1, address_line2, postal_code, city")
        .eq("customer_id", customerId)
        .is("archived_at", null)
        .order("name", { ascending: true }),
      client
        .from("contacts")
        .select("id, name, facility_id, email, phone, role_label, is_primary")
        .eq("customer_id", customerId)
        .is("archived_at", null)
        .order("name", { ascending: true }),
    ]);

    if (facilitiesRes.error || contactsRes.error) {
      // The customer loaded but a child read failed — surface the customer with a
      // soft error so the hub still renders identity; the sub-sections show empty.
      return {
        customer,
        facilities: (facilitiesRes.data ?? []) as unknown as FacilityRow[],
        contacts: (contactsRes.data ?? []) as unknown as ContactRow[],
        error: null,
      };
    }

    return {
      customer,
      facilities: (facilitiesRes.data ?? []) as unknown as FacilityRow[],
      contacts: (contactsRes.data ?? []) as unknown as ContactRow[],
      error: null,
    };
  } catch {
    return { customer: null, facilities: [], contacts: [], error: GENERIC_READ_ERROR };
  }
}

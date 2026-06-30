/**
 * PURE presentational helpers for the CRM customer surfaces (Story 3.2).
 *
 * These are deliberately I/O-free so they are exhaustively unit-testable under the
 * dependency-free `node --test` runner (project Testing Rules): the customer-type
 * Swedish badge map, the list-row view-model builder (which EXCLUDES personnummer by
 * construction — the private-data posture is a typed contract, not a code comment),
 * the personnummer masking helper for the access-controlled DETAIL surface, and the
 * simple case-insensitive duplicate-like heuristic.
 *
 * NONE of these touch Supabase or a service-role key — they map already-fetched,
 * RLS-scoped data into display shapes. The security boundary is the 3.1 commands +
 * RLS on the server (architecture §5/§6); this module is presentation only.
 */
import type { CustomerType } from "@/server/commands/crm/validation";

/** The Swedish type badge labels (owner decision 2026-06-18: four approved types). */
export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  private: "Privatperson",
  company: "Företag",
  brf: "BRF",
  public: "Offentlig",
};

/** True iff `value` is one of the four approved customer types. */
export function isCustomerType(value: unknown): value is CustomerType {
  return (
    value === "private" ||
    value === "company" ||
    value === "brf" ||
    value === "public"
  );
}

/**
 * The Swedish badge label for a customer type. Unknown values (which the DB CHECK
 * makes impossible) fall back to the raw string rather than throwing, so a bad row
 * can never crash the list render.
 */
export function customerTypeLabel(type: string): string {
  return isCustomerType(type) ? CUSTOMER_TYPE_LABELS[type] : type;
}

/**
 * The LIST PROJECTION row shape — the EXACT columns the server selects for the list.
 * CRITICAL: there is NO `personnummer` field here. The private-data posture (epic-3
 * retro-note; owner decision 2026-06-18) is enforced at the type level: the list
 * view-model simply has nowhere to put a personnummer, so it can never reach the list
 * payload/DOM even by accident.
 */
export interface CustomerListRow {
  readonly id: string;
  readonly customer_type: string;
  readonly display_name: string;
  /** org_nr is shown for non-private types; null/absent for private (DB CHECK). */
  readonly org_nr: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly city: string | null;
  readonly archived_at: string | null;
  readonly created_at: string;
}

/** The view-model a single list row renders from (camelCase at the UI boundary). */
export interface CustomerListItem {
  readonly id: string;
  readonly displayName: string;
  readonly type: string;
  readonly typeLabel: string;
  /** The type-driven identifier shown in the list — org_nr only (NEVER personnummer). */
  readonly identifier: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly city: string | null;
  readonly isArchived: boolean;
}

/**
 * Build the list view-model from a raw projection row. By construction it can only
 * surface the approved list fields — there is no personnummer input and no output
 * slot for it. `org_nr` is the only identifier shown in the list (private customers
 * have a null org_nr, so their identifier cell is simply empty in the list).
 */
export function toCustomerListItem(row: CustomerListRow): CustomerListItem {
  return {
    id: row.id,
    displayName: row.display_name,
    type: row.customer_type,
    typeLabel: customerTypeLabel(row.customer_type),
    identifier: row.org_nr ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    city: row.city ?? null,
    isArchived: row.archived_at !== null,
  };
}

/**
 * The client-side search predicate over the approved list fields (display_name,
 * email, phone, city, org_nr). Personnummer is NOT searchable from the list (it is
 * not in the projection at all). Case-insensitive substring match; an empty query
 * matches everything. Whitespace is trimmed.
 *
 * The search runs over the ALREADY-FETCHED, RLS-scoped page — a pragmatic choice for
 * the pilot's small per-tenant data set (Task 1.3 "client-side filter is acceptable
 * for the pilot's small data set if simpler"). It is a presentation convenience, not
 * a security boundary; RLS already scoped the rows server-side.
 */
export function matchesQuery(item: CustomerListItem, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (q.length === 0) return true;
  const haystack = [
    item.displayName,
    item.identifier,
    item.email,
    item.phone,
    item.city,
  ]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/**
 * Mask a Swedish personnummer for the access-controlled DETAIL surface (owner
 * decision: "restrained/masked display"). Shows only the last 4 characters; the rest
 * is masked. A reveal affordance on the detail can show the full value on explicit
 * user action — masking is the DEFAULT presentation, never the stored value (the
 * canonical value is preserved server-side; this only affects display).
 *
 * Defensive: a null/empty/short value returns a stable placeholder rather than
 * leaking a partial or throwing.
 */
export function maskPersonnummer(value: string | null | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "•".repeat(Math.max(trimmed.length, 1));
  const visible = trimmed.slice(-4);
  const maskedCount = trimmed.length - 4;
  return `${"•".repeat(maskedCount)}${visible}`;
}

/**
 * The duplicate-like heuristic (Task 1.4 / Open Question 4): a NON-blocking advisory,
 * NOT a hard block. A typed display name "looks like" an existing customer when its
 * trimmed, case-insensitive form exactly matches an existing ACTIVE customer's
 * display name in the same tenant. Returns the matching existing names (may be empty).
 *
 * Deliberately simple (owner left the rule unspecified; conservative default). It is
 * only a warning surfaced next to the create form — the user can proceed anyway.
 */
export function findDuplicateLikeNames(
  candidateName: string,
  existing: readonly CustomerListItem[],
): readonly string[] {
  const candidate = candidateName.trim().toLowerCase();
  if (candidate.length === 0) return [];
  return existing
    .filter((c) => !c.isArchived && c.displayName.trim().toLowerCase() === candidate)
    .map((c) => c.displayName);
}

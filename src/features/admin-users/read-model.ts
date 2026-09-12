import { chunkValues, readAllPages } from "@/server/read-models/pagination";

export type AdminUserRow = { id: string; email: string | null; status: string; role: string; roles: readonly string[]; createdAt: string };

type MembershipReadRow = { id?: unknown; invited_email?: unknown; status?: unknown; role?: unknown; created_at?: unknown; invitation_expires_at?: unknown };
type MembershipRoleReadRow = { membership_id?: unknown; role?: unknown };
type PageResult = PromiseLike<{ data: unknown[] | null; error: unknown | null }>;
type AdminUsersReadQuery = {
  select(columns: string): AdminUsersReadQuery;
  eq(column: string, value: string): AdminUsersReadQuery;
  in(column: string, values: readonly string[]): AdminUsersReadQuery;
  order(column: string, options: { readonly ascending: boolean }): AdminUsersReadQuery;
  range(from: number, to: number): PageResult;
};

/** The minimal fluent PostgREST shape used by the current-tenant Admin projection. */
export type AdminUsersReadClient = {
  from(table: "tenant_memberships" | "membership_roles"): AdminUsersReadQuery;
};

const ERROR = "Användarna kunde inte läsas. Försök igen om en stund.";

function projectAdminUserRow(row: MembershipReadRow, rolesByMembership: ReadonlyMap<string, readonly string[]>): AdminUserRow {
  const id = String(row.id);
  const expires = typeof row.invitation_expires_at === "string" ? Date.parse(row.invitation_expires_at) : Number.NaN;
  const status = String(row.status) === "invited" && Number.isFinite(expires) && expires <= Date.now() ? "expired" : String(row.status);
  return { id, email: typeof row.invited_email === "string" ? row.invited_email : null, status, role: String(row.role), roles: rolesByMembership.get(id) ?? [String(row.role)], createdAt: String(row.created_at) };
}

/**
 * Reads the complete current-tenant membership projection. PostgREST caps unbounded
 * responses, so both roots and role children use stable paged reads; an error on any
 * page fails closed rather than publishing a partial permissions catalogue.
 */
export async function readAdminUsersForTenant(client: AdminUsersReadClient, tenantId: string): Promise<{ rows: AdminUserRow[]; error: string | null }> {
  const memberships = await readAllPages((from, to) => client
    .from("tenant_memberships")
    .select("id, invited_email, status, role, created_at, invitation_expires_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to));
  if (memberships.error) return { rows: [], error: ERROR };

  const membershipRows = (memberships.data ?? []) as MembershipReadRow[];
  const membershipIds = membershipRows.map((row) => row.id).filter((id): id is string => typeof id === "string" && id !== "");
  const roleRows: MembershipRoleReadRow[] = [];
  for (const membershipIdBatch of chunkValues(membershipIds)) {
    const pageResult = await readAllPages((from, to) => client
      .from("membership_roles")
      .select("membership_id, role")
      .eq("tenant_id", tenantId)
      .in("membership_id", membershipIdBatch)
      .order("membership_id", { ascending: true })
      .order("role", { ascending: true })
      .range(from, to));
    if (pageResult.error) return { rows: [], error: ERROR };
    roleRows.push(...(pageResult.data as MembershipRoleReadRow[]));
  }
  const byMembership = new Map<string, string[]>();
  for (const row of roleRows) {
    if (typeof row.membership_id !== "string" || typeof row.role !== "string") continue;
    byMembership.set(row.membership_id, [...(byMembership.get(row.membership_id) ?? []), row.role]);
  }
  return { rows: membershipRows.map((row) => projectAdminUserRow(row, byMembership)), error: null };
}

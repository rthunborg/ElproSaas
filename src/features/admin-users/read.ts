import { createSupabaseServerClient } from "@/server/db/supabase-server-client";

export type AdminUserRow = { id: string; email: string | null; status: string; role: string; roles: readonly string[]; createdAt: string };
type MembershipReadRow = { id?: unknown; invited_email?: unknown; status?: unknown; role?: unknown; created_at?: unknown };
const ERROR = "Användarna kunde inte läsas. Försök igen om en stund.";

export async function readAdminUsers(): Promise<{ rows: AdminUserRow[]; error: string | null }> {
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.from("tenant_memberships").select("id, invited_email, status, role, created_at, invitation_expires_at").order("created_at", { ascending: false });
    if (error) return { rows: [], error: ERROR };
    const ids = (data ?? []).map((row: MembershipReadRow) => String(row.id)); const { data: roleRows, error: roleError } = await client.from("membership_roles").select("membership_id, role").in("membership_id", ids);
    if (roleError) return { rows: [], error: ERROR };
    const byMembership = new Map<string, string[]>(); for (const row of roleRows ?? []) { const id = String((row as { membership_id?: unknown }).membership_id); const role = (row as { role?: unknown }).role; if (typeof role === "string") byMembership.set(id, [...(byMembership.get(id) ?? []), role]); }
    return { rows: (data ?? []).map((row: MembershipReadRow & { invitation_expires_at?: unknown }) => { const expires = typeof row.invitation_expires_at === "string" ? Date.parse(row.invitation_expires_at) : NaN; const status = String(row.status) === "invited" && Number.isFinite(expires) && expires <= Date.now() ? "expired" : String(row.status); return { id: String(row.id), email: typeof row.invited_email === "string" ? row.invited_email : null, status, role: String(row.role), roles: byMembership.get(String(row.id)) ?? [String(row.role)], createdAt: String(row.created_at) }; }), error: null };
  } catch { return { rows: [], error: ERROR }; }
}

export type AdminUserDetail = AdminUserRow & { events: readonly { id: string; eventType: string; createdAt: string }[] };
export async function readAdminUserDetail(membershipId: string): Promise<{ detail: AdminUserDetail | null; error: string | null }> {
  try {
    const client = await createSupabaseServerClient();
    const { data: membership, error: membershipError } = await client.from("tenant_memberships")
      .select("id, invited_email, status, role, created_at, invitation_expires_at").eq("id", membershipId).maybeSingle();
    if (membershipError || !membership) return { detail: null, error: ERROR };
    const { data: events, error: eventError } = await client.from("audit_events")
      .select("id, event_type, created_at").eq("target_id", membershipId).order("created_at", { ascending: false });
    if (eventError) return { detail: null, error: ERROR };
    const { data: roleRows, error: roleError } = await client.from("membership_roles").select("role").eq("membership_id", membershipId); if (roleError) return { detail: null, error: ERROR };
    const row = membership as MembershipReadRow & { invitation_expires_at?: unknown }; const expires = typeof row.invitation_expires_at === "string" ? Date.parse(row.invitation_expires_at) : NaN; const status = String(row.status) === "invited" && Number.isFinite(expires) && expires <= Date.now() ? "expired" : String(row.status);
    return { detail: { id: String(row.id), email: typeof row.invited_email === "string" ? row.invited_email : null,
      status, role: String(row.role), roles: (roleRows ?? []).map((entry) => entry.role).filter((role): role is string => typeof role === "string"), createdAt: String(row.created_at),
      events: (events ?? []).map((event: { id?: unknown; event_type?: unknown; created_at?: unknown }) => ({ id: String(event.id), eventType: String(event.event_type), createdAt: String(event.created_at) })) }, error: null };
  } catch { return { detail: null, error: ERROR }; }
}

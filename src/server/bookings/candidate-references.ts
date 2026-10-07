// SERVER-ONLY. Preview reference checks use display-safe columns and cookie RLS.
// The atomic SQL commit independently locks/rechecks the same relationships.
import type { BookingFacts } from "@/features/resources/booking-types";
import type { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { CommandError } from "@/server/commands/command-errors";
type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Reference = { id: string; customer_id?: string; facility_id?: string | null; contact_id?: string | null };
export async function validateBookingCandidateReferences(client: Client, tenantId: string, candidate: BookingFacts): Promise<void> {
  async function reference(table: string, id: string | null, columns: string): Promise<Reference | null> {
    if (!id) return null;
    const { data, error } = await client.from(table).select(columns).eq("tenant_id", tenantId).eq("id", id).maybeSingle();
    if (error) throw new CommandError("SERVER_ERROR");
    if (!data) throw new CommandError("TENANT_ACCESS_DENIED");
    return data as unknown as Reference;
  }
  const [role, customer, job, facility, contact] = await Promise.all([
    reference("work_roles", candidate.workRoleId, "id,is_active"), reference("customers", candidate.customerId, "id"),
    reference("jobs", candidate.jobId, "id,customer_id,facility_id,contact_id"),
    reference("facilities", candidate.facilityId, "id,customer_id"), reference("contacts", candidate.contactId, "id,customer_id,facility_id"),
  ]);
  if (role && !(role as unknown as { is_active: boolean }).is_active) throw new CommandError("TENANT_ACCESS_DENIED");
  const customerIds = [customer?.id, job?.customer_id, facility?.customer_id, contact?.customer_id].filter(Boolean);
  if (new Set(customerIds).size > 1 || (facility && contact?.facility_id && contact.facility_id !== facility.id) ||
    (facility && job?.facility_id && job.facility_id !== facility.id) || (contact && job?.contact_id && job.contact_id !== contact.id) ||
    (contact?.facility_id && job?.facility_id && contact.facility_id !== job.facility_id)) throw new CommandError("TENANT_ACCESS_DENIED");
}

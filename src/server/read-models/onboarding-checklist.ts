import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { evaluateOnboardingChecklist, type OnboardingChecklistFacts } from "@/features/onboarding/checklist-state";

export type OnboardingChecklistReadResult =
  | { readonly visible: false }
  | {
      readonly visible: true;
      readonly dismissedAt: string | null;
      readonly checklist: ReturnType<typeof evaluateOnboardingChecklist>;
    };

const emptyFacts: OnboardingChecklistFacts = {
  companyName: null, companyOrganizationNumber: null, tenantOrganizationNumber: null,
  vatDisplay: null, vatRateBasisPoints: null, termsText: null, termsApprovedAt: null,
  activeWorkRoles: 0, additionalRoleBearingMembers: 0,
};

/** Reads only the current RLS-scoped tenant; failures intentionally produce no checklist. */
export async function readOnboardingChecklist(): Promise<OnboardingChecklistReadResult> {
  try {
    const client = await createSupabaseServerClient();
    const context = await resolveTenantContext({ client });
    if (!context.ok || context.data.role !== "tenant_admin") return { visible: false };
    const tenant = await client.from("tenants").select("provisioning_state, normalized_organization_number").eq("id", context.data.tenantId).maybeSingle();
    if (tenant.error || !tenant.data || tenant.data.provisioning_state !== "ready") return { visible: false };
    const currentMembership = await client.from("tenant_memberships")
      .select("id, onboarding_checklist_dismissed_at")
      .eq("tenant_id", context.data.tenantId).eq("user_id", context.data.userId).eq("role", "tenant_admin").eq("status", "active").maybeSingle();
    if (currentMembership.error || !currentMembership.data || typeof currentMembership.data.id !== "string") return { visible: false };
    const membership = currentMembership.data;
    const [company, terms, roles, memberships] = await Promise.all([
      client.from("company_settings").select("company_name, org_nr, default_vat_display, vat_rate_bp").eq("tenant_id", context.data.tenantId).maybeSingle(),
      client.from("quote_terms").select("terms_text, approved_at").eq("tenant_id", context.data.tenantId).maybeSingle(),
      client.from("work_roles").select("id").eq("tenant_id", context.data.tenantId).eq("is_active", true),
      client.from("tenant_memberships").select("id, status, invitation_expires_at").eq("tenant_id", context.data.tenantId),
    ]);
    if (company.error || terms.error || roles.error || memberships.error) return { visible: false };
    const candidates = (memberships.data ?? []).filter((row: { id?: unknown; status?: unknown; invitation_expires_at?: unknown }) => {
      if (row.id === membership.id) return false;
      if (row.status === "active") return true;
      return row.status === "invited" && typeof row.invitation_expires_at === "string" && Date.parse(row.invitation_expires_at) > Date.now();
    });
    const ids = candidates.map((row: { id: string }) => row.id);
    const assignments = ids.length === 0 ? { data: [], error: null } : await client.from("membership_roles").select("membership_id").eq("tenant_id", context.data.tenantId).in("membership_id", ids);
    if (assignments.error) return { visible: false };
    const roleBearingIds = new Set((assignments.data ?? []).map((row: { membership_id?: unknown }) => row.membership_id).filter((id): id is string => typeof id === "string"));
    const facts: OnboardingChecklistFacts = {
      ...emptyFacts,
      companyName: company.data?.company_name ?? null,
      companyOrganizationNumber: company.data?.org_nr ?? null,
      tenantOrganizationNumber: tenant.data.normalized_organization_number ?? null,
      vatDisplay: company.data?.default_vat_display ?? null,
      vatRateBasisPoints: company.data?.vat_rate_bp ?? null,
      termsText: terms.data?.terms_text ?? null,
      termsApprovedAt: terms.data?.approved_at ?? null,
      activeWorkRoles: (roles.data ?? []).length,
      additionalRoleBearingMembers: roleBearingIds.size,
    };
    return { visible: true, dismissedAt: membership.onboarding_checklist_dismissed_at ?? null, checklist: evaluateOnboardingChecklist(facts) };
  } catch { return { visible: false }; }
}

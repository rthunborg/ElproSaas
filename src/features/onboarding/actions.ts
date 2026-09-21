"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import {
  ONBOARDING_ACTION_INPUT_ERROR,
  ONBOARDING_ACTION_PERSISTENCE_ERROR,
  parseOnboardingDismissal,
  type OnboardingActionState,
} from "./action-state";

/** The browser can choose only its own presentation state; checklist facts remain server-derived. */
export async function setOnboardingChecklistDismissed(
  _previous: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const dismiss = parseOnboardingDismissal(formData.get("dismiss"));
  if (dismiss === null) return ONBOARDING_ACTION_INPUT_ERROR;
  try {
    const client = await createSupabaseServerClient();
    const context = await resolveTenantContext({ client });
    if (!context.ok || context.data.role !== "tenant_admin") return ONBOARDING_ACTION_INPUT_ERROR;
    const { data: tenant, error: tenantError } = await client.from("tenants").select("provisioning_state").eq("id", context.data.tenantId).maybeSingle();
    if (tenantError || tenant?.provisioning_state !== "ready") return ONBOARDING_ACTION_INPUT_ERROR;
    const { data, error } = await client.from("tenant_memberships")
      .update({ onboarding_checklist_dismissed_at: dismiss ? new Date().toISOString() : null })
      .eq("tenant_id", context.data.tenantId).eq("user_id", context.data.userId).eq("role", "tenant_admin").eq("status", "active")
      .select("id");
    if (error || !data || data.length !== 1) return ONBOARDING_ACTION_PERSISTENCE_ERROR;
    revalidatePath("/dashboard");
    return { status: "success", message: dismiss ? "Checklistan är dold." : "Checklistan visas igen." };
  } catch { return ONBOARDING_ACTION_PERSISTENCE_ERROR; }
}

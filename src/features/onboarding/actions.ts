"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import type { OnboardingActionState } from "./action-state";

/** The browser can choose only its own presentation state; checklist facts remain server-derived. */
export async function setOnboardingChecklistDismissed(
  _previous: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const rawDismiss = formData.get("dismiss");
  if (rawDismiss !== "true" && rawDismiss !== "false") return { status: "error", message: "Åtgärden kunde inte genomföras." };
  const dismiss = rawDismiss === "true";
  try {
    const client = await createSupabaseServerClient();
    const context = await resolveTenantContext({ client });
    if (!context.ok || context.data.role !== "tenant_admin") return { status: "error", message: "Åtgärden kunde inte genomföras." };
    const { data: tenant, error: tenantError } = await client.from("tenants").select("provisioning_state").eq("id", context.data.tenantId).maybeSingle();
    if (tenantError || tenant?.provisioning_state !== "ready") return { status: "error", message: "Åtgärden kunde inte genomföras." };
    const { data, error } = await client.from("tenant_memberships")
      .update({ onboarding_checklist_dismissed_at: dismiss ? new Date().toISOString() : null })
      .eq("tenant_id", context.data.tenantId).eq("user_id", context.data.userId).eq("role", "tenant_admin").eq("status", "active")
      .select("id");
    if (error || !data || data.length !== 1) return { status: "error", message: "Åtgärden kunde inte sparas. Försök igen." };
    revalidatePath("/dashboard");
    return { status: "success", message: dismiss ? "Checklistan är dold." : "Checklistan visas igen." };
  } catch { return { status: "error", message: "Åtgärden kunde inte sparas. Försök igen." }; }
}

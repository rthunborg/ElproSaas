"use server";
import { revalidatePath } from "next/cache";
import { inviteAdminUser } from "@/server/commands/admin-users/invite";
import { acceptInvitation } from "@/server/commands/admin-users/accept-invitation";
import { changeMembershipLifecycle } from "@/server/commands/admin-users/lifecycle";
import { resendAdminUserInvitation } from "@/server/commands/admin-users/invite";
import type { AdminUsersActionState } from "./action-state";
export type InvitationAcceptanceActionState = { status: "idle" | "success" | "error"; message: string };
export async function inviteAdminUserAction(_: AdminUsersActionState, form: FormData): Promise<AdminUsersActionState> {
  const email = form.get("email"); const roles = form.getAll("roles").filter((v): v is string => typeof v === "string" && v.length > 0);
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email) || roles.length === 0) return { status: "error", message: "Ange e-post och minst en roll." };
  const result = await inviteAdminUser({ email, roles, operationId: form.get("operationId") });
  if (!result.ok) return result.code === "ADMIN_USER_ACTION_UNCERTAIN"
    ? result.reconciliation === "observed"
      ? { status: "error", message: "Leveransen är fortfarande oklar efter kontroll. Du kan nu skicka en ny inbjudan.", retryWithNewOperation: true }
      : { status: "error", message: result.reconciliation === "unavailable" ? "Leveransen är oklar och kunde inte kontrolleras. Försök igen för att kontrollera den tidigare åtgärden." : "Leveransen är oklar. Försök igen för att kontrollera den tidigare åtgärden." }
    : { status: "error", message: "Inbjudan kunde inte genomföras." };
  revalidatePath("/admin/users"); return { status: "success", message: "Inbjudan har förberetts." };
}

export async function acceptAdminInvitationAction(_: InvitationAcceptanceActionState, form: FormData): Promise<InvitationAcceptanceActionState> {
  const result = await acceptInvitation({ membershipId: form.get("membershipId"), attemptToken: form.get("attempt") });
  return result.ok ? { status: "success", message: "Åtkomsten är aktiverad." } : { status: "error", message: "Inbjudan kan inte bekräftas." };
}

export async function lifecycleAdminUserAction(_: AdminUsersActionState, form: FormData): Promise<AdminUsersActionState> {
  const action = form.get("action"); const membershipId = form.get("membershipId");
  const roles = form.getAll("roles").filter((value): value is string => typeof value === "string");
  const result = action === "resend"
    ? await resendAdminUserInvitation({ membershipId, operationId: form.get("operationId") })
    : await changeMembershipLifecycle({ action, membershipId, roles, reason: form.get("reason"), operationId: form.get("operationId") });
  if (!result.ok) return result.code === "ADMIN_USER_ACTION_UNCERTAIN"
    ? "retryWithNewOperation" in result && result.retryWithNewOperation === true
      ? { status: "error", message: action === "reset" ? "Återställningen är fortfarande oklar efter kontroll. Du kan nu skicka en ny återställning." : "Leveransen är fortfarande oklar efter kontroll. Du kan nu skicka en ny inbjudan.", retryWithNewOperation: true }
      : { status: "error", message: action === "reset" ? (result.reconciliation === "unavailable" ? "Återställningen är oklar och kunde inte kontrolleras. Försök igen för att kontrollera den tidigare åtgärden." : "Återställningen är oklar. Försök igen för att kontrollera den tidigare åtgärden.") : (result.reconciliation === "unavailable" ? "Leveransen är oklar och kunde inte kontrolleras. Försök igen för att kontrollera den tidigare åtgärden." : "Leveransen är oklar. Försök igen för att kontrollera den tidigare åtgärden.") }
    : { status: "error", message: "Ändringen kunde inte genomföras." };
  revalidatePath(`/admin/users/${membershipId}`); revalidatePath("/admin/users");
  return { status: "success", message: "Ändringen har bekräftats." };
}

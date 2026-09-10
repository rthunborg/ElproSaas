"use server";
import { revalidatePath } from "next/cache";
import { inviteAdminUser } from "@/server/commands/admin-users/invite";
import { acceptInvitation } from "@/server/commands/admin-users/accept-invitation";
import { changeMembershipLifecycle } from "@/server/commands/admin-users/lifecycle";
import { resendAdminUserInvitation } from "@/server/commands/admin-users/invite";
import type { AdminUsersActionState } from "./action-state";
export async function inviteAdminUserAction(_: AdminUsersActionState, form: FormData): Promise<AdminUsersActionState> {
  const email = form.get("email"); const roles = form.getAll("roles").filter((v): v is string => typeof v === "string" && v.length > 0);
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email) || roles.length === 0) return { status: "error", message: "Ange e-post och minst en roll." };
  const result = await inviteAdminUser({ email, roles, operationId: form.get("operationId") });
  if (!result.ok) return { status: "error", message: "Inbjudan kunde inte genomföras." };
  revalidatePath("/admin/users"); return { status: "success", message: "Inbjudan har förberetts." };
}

export async function acceptAdminInvitationAction(form: FormData): Promise<void> {
  const result = await acceptInvitation({ membershipId: form.get("membershipId"), attemptToken: form.get("attempt") });
  if (!result.ok) throw new Error("Invitation acceptance denied");
}

export async function lifecycleAdminUserAction(_: AdminUsersActionState, form: FormData): Promise<AdminUsersActionState> {
  const action = form.get("action"); const membershipId = form.get("membershipId");
  const roles = form.getAll("roles").filter((value): value is string => typeof value === "string");
  const result = action === "resend"
    ? await resendAdminUserInvitation({ membershipId, operationId: form.get("operationId") })
    : await changeMembershipLifecycle({ action, membershipId, roles, reason: form.get("reason"), operationId: form.get("operationId") });
  if (!result.ok) return { status: "error", message: "Ändringen kunde inte genomföras." };
  revalidatePath(`/admin/users/${membershipId}`); revalidatePath("/admin/users");
  return { status: "success", message: "Ändringen har bekräftats." };
}

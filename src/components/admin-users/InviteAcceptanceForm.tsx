"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptAdminInvitationAction, type InvitationAcceptanceActionState } from "@/features/admin-users/actions";

const INITIAL: InvitationAcceptanceActionState = { status: "idle", message: "" };

export function InviteAcceptanceForm({ membershipId, attempt }: { membershipId: string; attempt: string }) {
  const [state, action, pending] = useActionState(acceptAdminInvitationAction, INITIAL);
  if (state.status === "success") return <section className="mt-3" aria-live="polite"><p role="status">{state.message}</p><Link className="mt-4 inline-block text-blue-700" href="/">Fortsätt</Link></section>;
  return <form action={action} className="mt-3"><p>Din inloggning är bekräftad. Åtkomsten aktiveras först när inbjudan fortfarande är giltig.</p><input type="hidden" name="membershipId" value={membershipId}/><input type="hidden" name="attempt" value={attempt}/>{state.status === "error" && <p role="alert" className="mt-3">{state.message}</p>}<button disabled={pending} className="mt-4 rounded bg-blue-700 px-4 py-2 text-white">{pending ? "Aktiverar…" : "Aktivera åtkomst"}</button></form>;
}

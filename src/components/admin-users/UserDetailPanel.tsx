"use client";

import { useActionState, useRef, type RefObject } from "react";
import { lifecycleAdminUserAction } from "@/features/admin-users/actions";
import { ADMIN_USERS_INITIAL } from "@/features/admin-users/action-state";
import type { AdminUserDetail } from "@/features/admin-users/read";

export function UserDetailPanel({ detail }: { detail: AdminUserDetail }) {
  const [state, action, pending] = useActionState(lifecycleAdminUserAction, ADMIN_USERS_INITIAL);
  const lifecycleOperation = useRef<HTMLInputElement>(null);
  const reRoleOperation = useRef<HTMLInputElement>(null);
  const prepareOperation = (input: RefObject<HTMLInputElement | null>, operationAction: string) => {
    if (input.current && input.current.dataset.action !== operationAction) { input.current.value = crypto.randomUUID(); input.current.dataset.action = operationAction; }
  };
  return <section className="p-6" aria-labelledby="user-events-heading"><h1 id="user-events-heading" className="text-2xl font-semibold">Händelser</h1>
    <p className="mt-2">{detail.email ?? "Inbjuden användare"} · {detail.status} · {detail.roles.join(", ")}</p>
    <p className="mt-2 text-sm text-zinc-600">Inaktivering eller avslut tar bort åtkomsten för detta företag. E14/E15-omfördelning hanteras i ett senare steg.</p>
    <form action={action} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="membershipId" value={detail.id}/><input ref={lifecycleOperation} type="hidden" name="operationId" />
      {detail.status === "active" && <><button name="action" value="reset" onClick={() => prepareOperation(lifecycleOperation, "reset")} disabled={pending}>Återställ inloggning</button><button name="action" value="disable" onClick={() => prepareOperation(lifecycleOperation, "disable")} disabled={pending}>Inaktivera</button><button name="action" value="end" onClick={() => prepareOperation(lifecycleOperation, "end")} disabled={pending}>Avsluta</button></>}
      {detail.status === "disabled" && <button name="action" value="reactivate" onClick={() => prepareOperation(lifecycleOperation, "reactivate")} disabled={pending}>Återaktivera</button>}
      {detail.status === "invited" && <><button name="action" value="resend" onClick={() => prepareOperation(lifecycleOperation, "resend")} disabled={pending}>Skicka igen</button><button name="action" value="revoke" onClick={() => prepareOperation(lifecycleOperation, "revoke")} disabled={pending}>Återkalla inbjudan</button></>}
    </form>
    {detail.status === "active" && <form action={action} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="membershipId" value={detail.id}/><input ref={reRoleOperation} type="hidden" name="operationId"/><input type="hidden" name="action" value="re_role"/><label>Roller<select name="roles" multiple defaultValue={detail.roles} aria-label="Roller"><option value="tenant_admin">Företagsadmin</option><option value="projektledare">Projektledare</option><option value="montor">Montör</option><option value="saljare">Säljare</option><option value="ekonomi">Ekonomi</option></select></label><label>Orsak<input name="reason" required /></label><button onClick={() => prepareOperation(reRoleOperation, "re_role")} disabled={pending}>Ändra roller</button></form>}
    {state.status !== "idle" && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    <ul className="mt-6 divide-y">{detail.events.map((event) => <li key={event.id} className="py-2">{event.eventType} · {event.createdAt}</li>)}</ul></section>;
}

"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Dialog } from "@/components/crm/Dialog";
import { inviteAdminUserAction } from "@/features/admin-users/actions";
import { ADMIN_USERS_INITIAL, operationIdForAdminUsersSubmit } from "@/features/admin-users/action-state";
import type { AdminUserRow } from "@/features/admin-users/read";
const ROLES = [["tenant_admin","Företagsadmin"],["projektledare","Projektledare"],["montor","Montör"],["saljare","Säljare"],["ekonomi","Ekonomi"]] as const;
export function UsersPage({ rows, loadError }: { rows: readonly AdminUserRow[]; loadError: string | null }) {
 const [open,setOpen]=useState(false); const [operationId,setOperationId]=useState(""); const [state,action,pending]=useActionState(inviteAdminUserAction,ADMIN_USERS_INITIAL);
 const submit=(form:FormData)=>{ const next=operationIdForAdminUsersSubmit(state,operationId); if(next!==operationId){ setOperationId(next); form.set("operationId",next); } return action(form); };
 const openInvite=()=>{ setOperationId(crypto.randomUUID()); setOpen(true); }; const closeInvite=()=>{ setOpen(false); setOperationId(""); };
 return <section className="flex flex-col gap-5 p-6" aria-labelledby="users-heading"><div className="flex items-center justify-between"><h1 id="users-heading" className="text-2xl font-semibold">Användare &amp; roller</h1><button onClick={openInvite} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white">Bjud in användare</button></div><p className="text-sm text-zinc-600">När en användare inaktiveras eller avslutas tas åtkomsten bort för detta företag. Historiken behålls.</p>{loadError&&<p role="alert">{loadError}</p>}<ul className="divide-y rounded border">{rows.map(r=><li key={r.id} className="flex justify-between p-3"><span>{r.email ?? "Inväntar inbjuden användare"}</span><span>{r.status} · {r.roles.join(", ")}</span><Link href={`/admin/users/${r.id}`}>Händelser</Link></li>)}</ul><Dialog open={open} onClose={closeInvite} title="Bjud in användare" busy={pending}><form action={submit} className="flex flex-col gap-3"><input type="hidden" name="operationId" value={operationId}/><label>E-post<input name="email" type="email" required className="ml-2 border" /></label><fieldset><legend>Roller</legend>{ROLES.map(([value,label])=><label className="mr-3" key={value}><input name="roles" type="checkbox" value={value}/>{label}</label>)}</fieldset>{state.status!=="idle"&&<p role={state.status==="error"?"alert":"status"}>{state.message}</p>}<button disabled={pending || !operationId} className="rounded bg-blue-700 px-3 py-2 text-white">{pending?"Skickar…":"Skicka inbjudan"}</button></form></Dialog></section>;
}

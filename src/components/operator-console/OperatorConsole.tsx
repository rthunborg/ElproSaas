import { ProvisioningWizard } from "./ProvisioningWizard";
import Link from "next/link";
import type { OperatorConsoleRow } from "@/features/operator-console/projection";

const firstAdminLabel = (state: string): string => ({ pending: "Väntar på första Admin", requested: "Inbjudan har begärts", unknown: "Inbjudans status är okänd", failed: "Inbjudan misslyckades", ready: "Första Admin är klar" }[state] ?? "Inbjudans status är okänd");
const provisioningLabel = (state: string): string => ({ pending_first_admin_invite: "Provisionering väntar på första Admin", first_admin_invite_requested: "Första Admin-inbjudan har begärts", first_admin_invite_unknown: "Första Admin-inbjudans status är okänd", first_admin_invite_failed: "Första Admin-inbjudan misslyckades", ready: "Provisioneringen är klar" }[state] ?? "Provisioneringsstatus saknas");

export function OperatorConsole({ rows }: { readonly rows: readonly OperatorConsoleRow[] }) {
  return <section aria-labelledby="operator-heading" className="grid gap-6">
    <div><h1 id="operator-heading" className="text-2xl font-semibold">Operatörskonsol</h1><p className="text-sm text-zinc-600">Tenantprovisionering</p></div>
    <ProvisioningWizard />
    <section aria-labelledby="tenants-heading"><h2 id="tenants-heading" className="text-xl font-semibold">Provisionerade tenants</h2><ul className="mt-3 divide-y rounded border">{rows.map((row) => <li key={`${row.canonicalOrganisationIdentity}:${row.createdAt}`} className="p-3"><strong>{row.tenantName}</strong><p>{row.canonicalOrganisationIdentity} · {provisioningLabel(row.provisioningState)} · {firstAdminLabel(row.firstAdminState)}</p><time dateTime={row.createdAt}>{row.createdAt}</time><Link className="block text-blue-700" href={`/operator/${encodeURIComponent(row.canonicalOrganisationIdentity)}`}>Öppna provisioneringsstatus</Link></li>)}</ul></section>
  </section>;
}

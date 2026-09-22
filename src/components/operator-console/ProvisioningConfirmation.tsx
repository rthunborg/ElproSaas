import type { OperatorPreviewState } from "@/features/operator-console/actions";

/** Shared safe approval summary for create and invitation renewal. */
export function ProvisioningConfirmation({ confirmation: value }: { readonly confirmation: NonNullable<OperatorPreviewState["confirmation"]> }) {
  return <div className="grid gap-2">
    <p>Företagsnamn: {value.legalName}</p>
    <p>Organisationsidentitet: {value.normalizedIdentity}</p>
    <p>Avtalsstart: {value.contractStartDate}</p>
    <p>Abonnemangsplan: {value.subscriptionPlan}</p>
    <p>Abonnemangsstatus: {value.subscriptionStatus}</p>
    <p>Inkluderade användare: {value.includedUsers}</p>
    <p>Pris per extra användare: {new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(value.additionalUserPriceOre / 100)}</p>
    <p>Första Admin: {value.firstAdminName} ({value.firstAdminEmail})</p>
    <p>Baslinje: {value.baseline.id} v{value.baseline.version}</p>
    <p>Innehållshash: {value.baseline.contentHash}</p>
    <p>Föreslagen åtgärd: {value.proposedAction === "CREATE" ? "Skapa tenant" : "Förnya inbjudan"}</p>
    <p>{value.warnings.length ? `Varningar: ${value.warnings.join(", ")}` : "Inga varningar."}</p>
  </div>;
}

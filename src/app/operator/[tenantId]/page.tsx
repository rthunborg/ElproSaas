import { deriveWizardState } from "@/features/operator-console/wizard-state";
import { readOperatorConsole, readOperatorConsoleResumeState } from "@/server/read-models/operator-console";
import { resolvePlatformOperator } from "@/server/auth/resolve-platform-operator";
import { HandoffRecovery } from "@/components/operator-console/HandoffRecovery";

export const dynamic = "force-dynamic";

const firstAdminLabel = (state: string): string => ({
  pending: "Väntar på första Admin",
  requested: "Inbjudan har begärts",
  unknown: "Inbjudans status är okänd",
  failed: "Inbjudan misslyckades",
  ready: "Första Admin är klar",
}[state] ?? "Inbjudans status är okänd");

export default async function OperatorTenantPage({ params }: { readonly params: Promise<{ tenantId: string }> }) {
  if (!(await resolvePlatformOperator()).ok) return <p>Åtkomst saknas.</p>;
  const { tenantId } = await params;
  const result = await readOperatorConsole(tenantId);
  const row = result.ok ? result.data[0] : null;
  if (!row) return <p>Åtkomst saknas.</p>;
  const resume = await readOperatorConsoleResumeState(tenantId);
  const state = deriveWizardState({ lifecycle: row.provisioningState, firstAdminState: row.firstAdminState, attempt: resume?.attempt });
  return <section aria-labelledby="operator-tenant-heading"><h1 id="operator-tenant-heading">{row.tenantName}</h1><p>{row.canonicalOrganisationIdentity}</p><p role="status">{firstAdminLabel(row.firstAdminState)}</p>{resume && <p>Försök: {resume.attempt}</p>}{state.requiresReconciliation && <p>Inbjudan är okänd och måste kontrolleras innan ett nytt försök.</p>}{state.requiresFreshApprovalForAttempt === 4 && <p>En ny förhandsgranskning och ett nytt godkännande krävs före försök 4. Äldre länkar är ogiltiga.</p>}{resume && (state.requiresReconciliation || (state.canRetry && !state.requiresFreshApprovalForAttempt)) && <HandoffRecovery tenantId={resume.tenantId} requiresReconciliation={Boolean(state.requiresReconciliation)} />}</section>;
}

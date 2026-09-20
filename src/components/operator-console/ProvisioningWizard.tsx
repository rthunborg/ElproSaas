"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { approveOperatorProvisioningAction, previewOperatorProvisioningAction } from "@/features/operator-console/actions";
import { OPERATOR_CONSOLE_INITIAL } from "@/features/operator-console/action-state";
import type { OperatorPreviewState } from "@/features/operator-console/actions";

export function ProvisioningWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [validationMessage, setValidationMessage] = useState("");
  const validationRef = useRef<HTMLParagraphElement>(null);
  const [preview, previewAction, previewPending] = useActionState<OperatorPreviewState, FormData>(previewOperatorProvisioningAction, OPERATOR_CONSOLE_INITIAL);
  const [approval, approvalAction, approvalPending] = useActionState<OperatorPreviewState, FormData>(approveOperatorProvisioningAction, OPERATOR_CONSOLE_INITIAL);
  useEffect(() => { if (validationMessage) validationRef.current?.focus(); }, [validationMessage]);
  const advance = () => {
    const missing = step === 1
      ? ["legalName", "organizationNumber"]
      : step === 2 ? ["contractStartDate"] : [];
    if (missing.some((name) => !(document.querySelector(`[name=\"${name}\"]`) as HTMLInputElement | null)?.value)) {
      setValidationMessage("Fyll i de obligatoriska uppgifterna innan du fortsätter.");
      return;
    }
    setValidationMessage("");
    setStep((current) => Math.min(3, current + 1) as 1 | 2 | 3);
  };

  return <section aria-labelledby="provisioning-heading" className="rounded border p-5">
    <h2 id="provisioning-heading" className="text-xl font-semibold">Provisionera ny tenant</h2>
    <form action={previewAction} className="mt-4 grid gap-3">
      <div hidden={step !== 1}><h3>Företagsuppgifter</h3><label>Företagsnamn<input name="legalName" required={step === 1} className="ml-2 border" /></label><label>Organisationsnummer<input name="organizationNumber" required={step === 1} className="ml-2 border" /></label>{step === 1 && <button type="button" onClick={advance}>Fortsätt</button>}</div>
      <div hidden={step < 2}><h3>Baslinje</h3><p>Baslinjen väljs och kontrolleras på servern.</p><label>Avtalsstart<input name="contractStartDate" type="date" required={step === 2} className="ml-2 border" /></label>{step === 2 && <button type="button" onClick={advance}>Fortsätt</button>}</div>
      <div hidden={step !== 3}><h3>Bjud in första Admin</h3><label>Namn<input name="firstAdminName" required={step === 3} className="ml-2 border" /></label><label>E-post<input name="firstAdminEmail" type="email" required={step === 3} className="ml-2 border" /></label><button disabled={previewPending} type="submit">{previewPending ? "Förhandsgranskar…" : "Förhandsgranska"}</button></div>
      {validationMessage && <p ref={validationRef} role="alert" tabIndex={-1}>{validationMessage}</p>}
      {preview.status === "error" && <p role="alert" tabIndex={-1}>{preview.message}</p>}
    </form>
      {preview.status === "success" && preview.approvalHandle && preview.confirmation && <section aria-live="polite" className="mt-4 grid gap-2"><p role="status">{preview.message}</p><h3>Bekräfta förhandsgranskning</h3><p>Organisationsidentitet: {preview.confirmation.normalizedIdentity}</p><p>Första Admin: {preview.confirmation.firstAdminName} ({preview.confirmation.firstAdminEmail})</p><p>Baslinje: {preview.confirmation.baseline.id} v{preview.confirmation.baseline.version}</p><p>Innehållshash: {preview.confirmation.baseline.contentHash}</p><p>Föreslagen åtgärd: {preview.confirmation.proposedAction === "CREATE" ? "Skapa tenant" : preview.confirmation.proposedAction}</p><p>{preview.confirmation.warnings.length ? `Varningar: ${preview.confirmation.warnings.join(", ")}` : "Inga varningar."}</p><form action={approvalAction}><input type="hidden" name="approvalHandle" value={preview.approvalHandle} /><button disabled={approvalPending} name="explicitApproval" value="true">{approvalPending ? "Godkänner…" : "Godkänn provisionering"}</button></form></section>}
      {approval.status !== "idle" && <section className="mt-3" aria-live="polite"><p role={approval.status === "error" ? "alert" : "status"}>{approval.message}</p>{approval.status === "success" && approval.tenantId && <Link href={`/operator/${approval.tenantId}`}>Öppna provisioneringsstatus</Link>}</section>}
  </section>;
}

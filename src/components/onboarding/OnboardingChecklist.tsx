"use client";
import Link from "next/link";
import { useActionState } from "react";
import { setOnboardingChecklistDismissed } from "@/features/onboarding/actions";
import { ONBOARDING_ACTION_INITIAL } from "@/features/onboarding/action-state";
import type { OnboardingChecklistItem } from "@/features/onboarding/checklist-state";

export function OnboardingChecklist({ items, termsApprovalWarning }: { readonly items: readonly OnboardingChecklistItem[]; readonly termsApprovalWarning: boolean }) {
  const [state, action, pending] = useActionState(setOnboardingChecklistDismissed, ONBOARDING_ACTION_INITIAL);
  const completeCount = items.filter((item) => item.complete).length;
  return <section aria-labelledby="onboarding-heading" className="rounded-lg border border-blue-200 bg-blue-50 p-5">
    <div className="flex items-start justify-between gap-4"><div><h1 id="onboarding-heading" className="text-2xl font-semibold text-zinc-900">Kom igång</h1><p className="mt-1 text-sm text-zinc-700">{completeCount} av {items.length} steg klara</p></div>
      <form action={action}><input type="hidden" name="dismiss" value="true" /><button type="submit" disabled={pending} className="text-sm text-blue-800 underline disabled:opacity-60">Dölj tills vidare</button></form>
    </div>
    <ol className="mt-4 space-y-2" aria-label="Kom igång-steg">{items.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 rounded bg-white p-3">
      <span><span aria-hidden="true" className={item.complete ? "mr-2 text-green-700" : "mr-2 text-zinc-500"}>{item.complete ? "✓" : "○"}</span>{item.label}</span>
      <Link className="text-sm text-blue-700 underline" href={item.href}>{item.complete ? "Granska" : "Öppna"}</Link>
    </li>)}</ol>
    {termsApprovalWarning && <p role="status" className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Offertvillkoren är sparade men saknar fortfarande juridiskt godkännande.</p>}
    {state.status !== "idle" && <p className="mt-3 text-sm" role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
  </section>;
}

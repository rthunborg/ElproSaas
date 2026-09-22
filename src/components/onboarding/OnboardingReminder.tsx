"use client";
import { useActionState } from "react";
import { setOnboardingChecklistDismissed } from "@/features/onboarding/actions";
import { ONBOARDING_ACTION_INITIAL } from "@/features/onboarding/action-state";

export function OnboardingReminder() {
  const [state, action, pending] = useActionState(setOnboardingChecklistDismissed, ONBOARDING_ACTION_INITIAL);
  return <aside className="rounded-lg border border-zinc-200 bg-white p-4" aria-label="Påminnelse om Kom igång">
    <p className="text-sm text-zinc-700">Du har gömt din Kom igång-checklista.</p>
    <form action={action} className="mt-2"><input type="hidden" name="dismiss" value="false" /><button type="submit" disabled={pending} className="text-sm font-medium text-blue-700 underline disabled:opacity-60">Visa checklistan igen</button></form>
    {state.status !== "idle" && <p className="mt-2 text-sm" role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
  </aside>;
}

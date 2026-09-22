export type OnboardingActionState = { readonly status: "idle" | "success" | "error"; readonly message: string };
export const ONBOARDING_ACTION_INITIAL: OnboardingActionState = { status: "idle", message: "" };
export const ONBOARDING_ACTION_INPUT_ERROR: OnboardingActionState = { status: "error", message: "Åtgärden kunde inte genomföras." };
export const ONBOARDING_ACTION_PERSISTENCE_ERROR: OnboardingActionState = { status: "error", message: "Åtgärden kunde inte sparas. Försök igen." };

/** Parses the only presentation-state input accepted from the browser. */
export function parseOnboardingDismissal(value: FormDataEntryValue | null): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

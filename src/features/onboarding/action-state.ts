export type OnboardingActionState = { readonly status: "idle" | "success" | "error"; readonly message: string };
export const ONBOARDING_ACTION_INITIAL: OnboardingActionState = { status: "idle", message: "" };

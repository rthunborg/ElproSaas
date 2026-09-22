import { normalizeSwedishOrganizationNumber } from "@/server/commands/provisioning/validation";

export const ONBOARDING_CHECKLIST_ITEMS = [
  { id: "company", label: "Företagsinställningar", href: "/settings/company" },
  { id: "vat", label: "Moms & visning", href: "/settings/company" },
  { id: "terms", label: "Offertvillkor", href: "/settings/quote-terms" },
  { id: "pricing", label: "Arbetsroller & priser", href: "/settings/pricing" },
  { id: "users", label: "Bjud in användare", href: "/admin/users" },
] as const;

export type OnboardingItemId = (typeof ONBOARDING_CHECKLIST_ITEMS)[number]["id"];
export type OnboardingChecklistItem = (typeof ONBOARDING_CHECKLIST_ITEMS)[number] & { readonly complete: boolean };

export type OnboardingChecklistFacts = {
  readonly companyName: string | null;
  readonly companyOrganizationNumber: string | null;
  readonly tenantOrganizationNumber: string | null;
  readonly vatDisplay: string | null;
  readonly vatRateBasisPoints: number | null;
  readonly termsText: string | null;
  readonly termsApprovedAt: string | null;
  readonly activeWorkRoles: number;
  readonly additionalRoleBearingMembers: number;
};

function nonBlank(value: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedOrganizationNumber(value: string | null): string | null {
  return normalizeSwedishOrganizationNumber(value);
}

function companyConfigured(facts: OnboardingChecklistFacts): boolean {
  return nonBlank(facts.companyName)
    && normalizedOrganizationNumber(facts.companyOrganizationNumber) !== null
    && normalizedOrganizationNumber(facts.companyOrganizationNumber) === normalizedOrganizationNumber(facts.tenantOrganizationNumber);
}

function vatConfigured(facts: OnboardingChecklistFacts): boolean {
  return (facts.vatDisplay === "company_togglable" || facts.vatDisplay === "company_excl")
    && Number.isInteger(facts.vatRateBasisPoints)
    && (facts.vatRateBasisPoints as number) >= 0
    && (facts.vatRateBasisPoints as number) <= 10000;
}

/** Pure, fixed-shape projection. Completion is never supplied by the browser. */
export function evaluateOnboardingChecklist(facts: OnboardingChecklistFacts): {
  readonly items: readonly OnboardingChecklistItem[];
  readonly workingState: boolean;
  readonly termsApprovalWarning: boolean;
} {
  const complete: Record<OnboardingItemId, boolean> = {
    company: companyConfigured(facts),
    vat: vatConfigured(facts),
    terms: nonBlank(facts.termsText),
    pricing: Number.isInteger(facts.activeWorkRoles) && facts.activeWorkRoles > 0,
    users: Number.isInteger(facts.additionalRoleBearingMembers) && facts.additionalRoleBearingMembers > 0,
  };
  const items = ONBOARDING_CHECKLIST_ITEMS.map((item) => ({ ...item, complete: complete[item.id] }));
  return {
    items,
    workingState: items.every((item) => item.complete),
    // This stays separate: persisted terms configure the checklist but never self-approve legal wording.
    termsApprovalWarning: complete.terms && facts.termsApprovedAt === null,
  };
}

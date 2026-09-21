import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { OnboardingReminder } from "@/components/onboarding/OnboardingReminder";
import { readOnboardingChecklist } from "@/server/read-models/onboarding-checklist";

// Shell landing page. Operational, NOT analytics — no fabricated metrics (UX §3).
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const onboarding = await readOnboardingChecklist();
  const showChecklist = onboarding.visible && !onboarding.checklist.workingState && onboarding.dismissedAt === null;
  const showReminder = onboarding.visible && !onboarding.checklist.workingState && onboarding.dismissedAt !== null;
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5">
      {showChecklist && <OnboardingChecklist items={onboarding.checklist.items} termsApprovalWarning={onboarding.checklist.termsApprovalWarning} />}
      {showReminder && <OnboardingReminder />}
      <div><h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1><p className="mt-4 text-sm leading-6 text-zinc-600">Detta är din operativa startvy. Använd menyn för att navigera mellan pilotens moduler.</p></div>
    </section>
  );
}

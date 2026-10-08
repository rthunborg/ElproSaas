import { Suspense } from "react";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { QuotePipelineWidget } from "@/components/dashboard/QuotePipelineWidget";
import { readDashboard } from "@/server/read-models/dashboard";
import { eligibleWidgets, WIDGET_REGISTRY } from "@/scope/widget-registry";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
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
    <section className="mx-auto flex max-w-6xl flex-col gap-5">
      {showChecklist && <OnboardingChecklist items={onboarding.checklist.items} termsApprovalWarning={onboarding.checklist.termsApprovalWarning} />}
      {showReminder && <OnboardingReminder />}
      <div><h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1><p className="mt-4 text-sm leading-6 text-zinc-600">Detta är din operativa startvy. Använd menyn för att navigera mellan pilotens moduler.</p></div>
      <DashboardWidgets />
    </section>
  );
}


/** Check eligibility before exposing a skeleton; isolate the asynchronous card read. */
async function DashboardWidgets() {
  const context = await resolveTenantContext();
  if (!context.ok) return null;
  const registrations = eligibleWidgets(context.data.roles ?? []);
  if (registrations.length === 0) return null;
  return <Suspense fallback={<DashboardGrid><QuotePipelineWidget state="loading" /></DashboardGrid>}>
    <LoadedDashboardWidgets />
  </Suspense>;
}

async function LoadedDashboardWidgets() {
  const dashboard = await readDashboard();
  return <DashboardGrid>{await Promise.all(dashboard.widgets.map(async widget => {
    const registration = WIDGET_REGISTRY.find(entry => entry.id === widget.id);
    return registration ? <div key={widget.id} className="min-w-0 md:col-span-12">{await registration.component(widget)}</div> : null;
  }))}</DashboardGrid>;
}

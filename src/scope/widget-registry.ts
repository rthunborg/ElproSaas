import { SCOPE_MANIFEST } from "./manifest";
import { validateManifestCoherence } from "./manifest-schema";
import { PERMISSION_MATRIX, resolveCapability } from "@/server/authz/permission-matrix";
import type { QuotePipelineDeps, QuotePipelineResult } from "@/server/read-models/quote-pipeline";
import type { EntitlementInput } from "@/server/read-models/entitlements";
import type { PipelinePeriod } from "@/server/read-models/quote-pipeline-aggregate";
import type { DashboardWidget } from "@/server/read-models/dashboard";

/** These are actual loader/presentation registrations, not a second widget ID catalog. */
export const WIDGET_REGISTRY = [{
  id: "quote-pipeline", moduleId: "quotes", requiredCapability: "Quotes.View",
  title: "Offertpipeline", href: "/quotes", span: 12, order: 0,
  load: async (period?: PipelinePeriod, entitlements?: EntitlementInput, deps?: QuotePipelineDeps): Promise<QuotePipelineResult> =>
    (await import("@/server/read-models/quote-pipeline")).readQuotePipelineResult(period, entitlements, deps),
  component: async (widget: DashboardWidget) => {
    const { createElement } = await import("react");
    const { DashboardRetry } = await import("@/components/dashboard/DashboardRetry");
    return createElement(DashboardRetry, { result: widget.result });
  },
}] as const;

/** Active manifest × actual registration × current capability intersection, fail closed. */
export function eligibleWidgets(roles: readonly unknown[]) {
  if (!resolveCapability({ roles, module: "dashboard", capability: "Dashboard.View" }).granted) return [];
  const violations = validateManifestCoherence(SCOPE_MANIFEST, {
    permissionMatrix: PERMISSION_MATRIX, widgetRegistry: WIDGET_REGISTRY,
  });
  if (violations.length > 0) return [];
  const active = SCOPE_MANIFEST.modules.filter(module => module.status === "active");
  return WIDGET_REGISTRY.filter(widget =>
    active.some(module => module.id === widget.moduleId && (module.widgets as readonly string[]).includes(widget.id)) &&
    resolveCapability({ roles, module: widget.moduleId, capability: widget.requiredCapability }).granted,
  ).sort((a, b) => a.order - b.order);
}
